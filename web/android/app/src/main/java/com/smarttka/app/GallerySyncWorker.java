package com.smarttka.app;

import android.content.ContentUris;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.Data;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * GallerySyncWorker
 *
 * Pengganti GallerySyncService: seluruh logika sinkronisasi galeri berjalan
 * sebagai WorkManager task, bukan foreground service. Alasannya:
 *   - Android 15+ melarang FGS tipe dataSync di-start dari BOOT_COMPLETED.
 *   - FGS dataSync dibatasi 6 jam di Android 15+ (backfill galeri bisa lebih).
 *   - WorkManager menangani reboot, constraint jaringan (WiFi-only), kebijakan
 *     baterai, dan retry otomatis.
 *
 * Satu worker menangani dua mode:
 *   - BACKFILL_WORK (OneTimeWorkRequest) - dipicu startSync / boot receiver.
 *   - PERIODIC_WORK (PeriodicWorkRequest, 15 menit) - menangkap foto baru
 *     secara berkala. Scan hanya delta (_ID > maksimum yang sudah diupload)
 *     plus foto yang masih gagal, jadi tidak memindai seluruh galeri tiap run.
 */
public class GallerySyncWorker extends Worker {

    public static final String PREFS_NAME    = "gallery_sync";
    public static final String BACKFILL_WORK = "gallery_backfill";
    public static final String PERIODIC_WORK = "gallery_periodic";

    private static final String TAG              = "GallerySyncWorker";
    private static final int    SAVE_INTERVAL    = 100;
    private static final int    MAX_RETRY_PASSES = 3;
    private static final long   RETRY_DELAY_MS   = 3_000L;
    private static final long   PERIODIC_MINUTES = 15L;

    private static final AtomicBoolean RUNNING = new AtomicBoolean(false);

    public GallerySyncWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    // Scheduling helpers (dipakai plugin & boot receiver)

    public static void enqueueBackfill(Context context, boolean wifiOnly) {
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(GallerySyncWorker.class)
            .setConstraints(buildConstraints(wifiOnly))
            .build();
        WorkManager.getInstance(context)
            .enqueueUniqueWork(BACKFILL_WORK, ExistingWorkPolicy.KEEP, request);
    }

    public static void schedulePeriodic(Context context, boolean wifiOnly) {
        PeriodicWorkRequest request = new PeriodicWorkRequest.Builder(
                GallerySyncWorker.class, PERIODIC_MINUTES, TimeUnit.MINUTES)
            .setConstraints(buildConstraints(wifiOnly))
            .build();
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork(PERIODIC_WORK, ExistingPeriodicWorkPolicy.KEEP, request);
    }

    public static void cancelAll(Context context) {
        WorkManager.getInstance(context).cancelUniqueWork(BACKFILL_WORK);
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC_WORK);
    }

    private static Constraints buildConstraints(boolean wifiOnly) {
        return new Constraints.Builder()
            .setRequiredNetworkType(wifiOnly ? NetworkType.UNMETERED : NetworkType.CONNECTED)
            .build();
    }

    // Worker body

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SecureConfig config = new SecureConfig(ctx);
        if (!config.isConfigured()) {
            Log.w(TAG, "InsForge belum dikonfigurasi, lewati");
            return Result.success();
        }

        if (!RUNNING.compareAndSet(false, true)) {
            Log.d(TAG, "Worker lain sedang berjalan, lewati");
            return Result.success();
        }

        try {
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean wifiOnly = prefs.getBoolean("cfg_wifiOnly", false);

            // Jangan scan kalau izin baca media dicabut/ditolak; laporkan ke UI
            if (!hasMediaPermission(ctx)) {
                prefs.edit()
                    .putBoolean("permDenied", true)
                    .putBoolean("isRunning", false)
                    .apply();
                Log.w(TAG, "Izin baca media belum diberikan, lewati sync");
                return Result.success();
            }
            prefs.edit().putBoolean("permDenied", false).apply();

            if (wifiOnly && !isWifiConnected(ctx)) return Result.retry();

            String deviceId = config.getDeviceId(ctx);

            Set<String> uploadedIds = new HashSet<>(prefs.getStringSet("uploadedIds", new HashSet<>()));
            Set<String> failedIds   = new HashSet<>(prefs.getStringSet("failedIds",   new HashSet<>()));

            List<PhotoInfo> allPhotos = scanAllPhotos(ctx, uploadedIds, failedIds);
            int total = allPhotos.size();

            final int baseUploaded = uploadedIds.size();
            prefs.edit()
                .putBoolean("isRunning", true)
                .putInt("total", total)
                .putInt("uploaded", 0)
                .apply();
            publish("Memindai " + total + " foto...", total, 0, failedIds.size());

            InsForgeUploader uploader = new InsForgeUploader(
                    config.getS3Endpoint(), config.getS3AccessKey(),
                    config.getS3SecretKey(), config.getS3Region());
            int uploaded = 0;
            int savedAt  = 0;

            // Main pass
            for (int i = 0; i < allPhotos.size(); i++) {
                PhotoInfo photo = allPhotos.get(i);
                if (isStopped()) {
                    saveProgress(prefs, uploadedIds, failedIds, total, uploaded);
                    return Result.failure();
                }
                if (uploadedIds.contains(photo.id)) continue;

                if (wifiOnly && i % 50 == 0 && !isWifiConnected(ctx)) {
                    saveProgress(prefs, uploadedIds, failedIds, total, uploaded);
                    return Result.retry();
                }

                if (uploadPhoto(ctx, uploader, photo, config.getBucket(), deviceId)) {
                    uploadedIds.add(photo.id);
                    failedIds.remove(photo.id);
                    uploaded++;
                    if (uploaded - savedAt >= SAVE_INTERVAL) {
                        savedAt = uploaded;
                        saveProgress(prefs, uploadedIds, failedIds, total, uploaded);
                        publish("Mengupload " + uploaded + " / " + total + " foto",
                                total, uploaded, failedIds.size());
                    }
                } else {
                    failedIds.add(photo.id);
                    Log.w(TAG, "Gagal upload: " + photo.name);
                }
            }
            saveProgress(prefs, uploadedIds, failedIds, total, uploaded);

            // Retry pass
            performRetry(ctx, uploader, allPhotos, uploadedIds, failedIds, prefs,
                    total, uploaded, config.getBucket(), deviceId, wifiOnly);

            // Selesai
            int finalUploaded = uploadedIds.size() - baseUploaded;
            prefs.edit()
                .putBoolean("isRunning", false)
                .putLong("lastSync", System.currentTimeMillis())
                .apply();
            publish(
                failedIds.isEmpty()
                    ? "Selesai: " + finalUploaded + " foto tersinkron"
                    : "Selesai: " + finalUploaded + " berhasil, " + failedIds.size() + " gagal",
                total, finalUploaded, failedIds.size());
            return Result.success();

        } catch (Exception e) {
            Log.e(TAG, "doWork error", e);
            return Result.failure();
        } finally {
            RUNNING.set(false);
        }
    }

    private void performRetry(Context ctx, InsForgeUploader uploader, List<PhotoInfo> allPhotos,
                              Set<String> uploadedIds, Set<String> failedIds, SharedPreferences prefs,
                              int total, int uploaded, String bucket, String deviceId, boolean wifiOnly) {
        int pass = 0;
        while (!failedIds.isEmpty() && pass < MAX_RETRY_PASSES) {
            if (isStopped()) return;
            pass++;
            publish("Retry " + pass + "/" + MAX_RETRY_PASSES + ": " + failedIds.size() + " foto gagal...",
                    total, uploaded, failedIds.size());
            sleepSafe(RETRY_DELAY_MS * pass);
            if (wifiOnly && !isWifiConnected(ctx)) return;

            Set<String> stillFailing = new HashSet<>();
            for (PhotoInfo photo : allPhotos) {
                if (isStopped()) return;
                if (!failedIds.contains(photo.id)) continue;

                if (uploadPhoto(ctx, uploader, photo, bucket, deviceId)) {
                    uploadedIds.add(photo.id);
                    uploaded++;
                } else {
                    stillFailing.add(photo.id);
                    Log.w(TAG, "Retry " + pass + " gagal: " + photo.name);
                }
            }
            failedIds.clear();
            failedIds.addAll(stillFailing);
            saveProgress(prefs, uploadedIds, failedIds, total, uploaded);
        }
    }

    private boolean uploadPhoto(Context ctx, InsForgeUploader uploader, PhotoInfo photo,
                                String bucket, String deviceId) {
        try (InputStream is = ctx.getContentResolver().openInputStream(photo.uri)) {
            if (is == null) return false;
            String remotePath = deviceId + "/" + photo.dateAdded + "_" + photo.id + "_"
                    + sanitizeFileName(photo.name);
            return uploader.upload(bucket, remotePath, is, photo.mimeType, photo.size);
        } catch (Exception e) {
            Log.e(TAG, "uploadPhoto error: " + photo.name, e);
            return false;
        }
    }

    private static List<PhotoInfo> scanAllPhotos(Context ctx, Set<String> uploadedIds,
                                                 Set<String> failedIds) {
        List<PhotoInfo> photos = new ArrayList<>();
        String[] projection = {
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.MIME_TYPE,
            MediaStore.Images.Media.SIZE,
            MediaStore.Images.Media.DATE_ADDED,
        };
        String selection = buildDeltaSelection(uploadedIds, failedIds);
        try (Cursor cursor = ctx.getContentResolver().query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection, selection, null,
                MediaStore.Images.Media.DATE_ADDED + " ASC")) {

            if (cursor == null) return photos;

            int idCol   = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID);
            int nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME);
            int mimeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.MIME_TYPE);
            int sizeCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.SIZE);
            int dateCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED);

            while (cursor.moveToNext()) {
                long id = cursor.getLong(idCol);
                PhotoInfo photo = new PhotoInfo();
                photo.id        = String.valueOf(id);
                photo.name      = cursor.getString(nameCol);
                photo.uri       = ContentUris.withAppendedId(
                        MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                photo.mimeType  = cursor.getString(mimeCol);
                if (photo.mimeType == null) photo.mimeType = "image/jpeg";
                photo.size      = cursor.getLong(sizeCol);
                photo.dateAdded = cursor.getLong(dateCol);
                photos.add(photo);
            }
        } catch (Exception e) {
            Log.e(TAG, "scanAllPhotos error", e);
        }
        return photos;
    }

    private static boolean hasMediaPermission(Context ctx) {
        String perm = android.os.Build.VERSION.SDK_INT >= 33
            ? android.Manifest.permission.READ_MEDIA_IMAGES
            : android.Manifest.permission.READ_EXTERNAL_STORAGE;
        return androidx.core.content.ContextCompat.checkSelfPermission(ctx, perm)
            == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    // Jalur periodic: hanya scan foto baru (_ID > maksimum yang sudah diupload)
    // plus foto yang masih gagal, agar tidak memindai seluruh galeri tiap 15 menit.
    private static String buildDeltaSelection(Set<String> uploadedIds, Set<String> failedIds) {
        long maxUploadedId = 0L;
        for (String id : uploadedIds) {
            try {
                maxUploadedId = Math.max(maxUploadedId, Long.parseLong(id));
            } catch (NumberFormatException ignored) {}
        }
        if (maxUploadedId <= 0L) return null; // backfill awal: scan penuh
        StringBuilder sb = new StringBuilder();
        sb.append(MediaStore.Images.Media._ID).append(" > ").append(maxUploadedId);
        if (!failedIds.isEmpty()) {
            sb.append(" OR ").append(MediaStore.Images.Media._ID).append(" IN (");
            boolean first = true;
            for (String id : failedIds) {
                if (!first) sb.append(',');
                sb.append(id);
                first = false;
            }
            sb.append(')');
        }
        return sb.toString();
    }

    private static boolean isWifiConnected(Context ctx) {
        ConnectivityManager cm =
            (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return true;
        Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI);
    }

    private static String sanitizeFileName(String name) {
        if (name == null) return "photo.jpg";
        return name.replaceAll("[^a-zA-Z0-9._\\-]", "_");
    }

    private void saveProgress(SharedPreferences prefs, Set<String> uploadedIds,
                              Set<String> failedIds, int total, int uploaded) {
        prefs.edit()
            .putStringSet("uploadedIds", new HashSet<>(uploadedIds))
            .putStringSet("failedIds",   new HashSet<>(failedIds))
            .putInt("total",    total)
            .putInt("uploaded", uploaded)
            .putInt("failed",   failedIds.size())
            .apply();
    }

    private void publish(String message, int total, int uploaded, int failed) {
        setProgressAsync(new Data.Builder()
            .putString("message", message)
            .putInt("total", total)
            .putInt("uploaded", uploaded)
            .putInt("failed", failed)
            .build());
    }

    private void sleepSafe(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    static class PhotoInfo {
        String id;
        String name;
        Uri    uri;
        String mimeType;
        long   size;
        long   dateAdded;
    }
}
