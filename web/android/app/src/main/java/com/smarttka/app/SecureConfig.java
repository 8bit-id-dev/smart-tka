package com.smarttka.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;

/**
 * SecureConfig
 *
 * Menyediakan credential InsForge untuk komponen native (Worker, BootReceiver,
 * Plugin). Nilai dibaca dari BuildConfig yang diisi saat build dari
 * local.properties:
 *   - insforge.baseUrl     : URL project InsForge
 *   - insforge.s3AccessKey : S3 access key (scoped storage, bisa direvokasi)
 *   - insforge.s3SecretKey : S3 secret key (ditampilkan sekali saat dibuat)
 *   - insforge.s3Endpoint  : endpoint S3 gateway /storage/v1/s3
 *   - insforge.s3Region    : region S3 (default us-east-2)
 *   - insforge.bucket      : bucket galeri
 *
 * CATATAN KEAMANAN: nilai BuildConfig melekat di APK sehingga bisa diekstrak.
 * S3 access key dipilih karena cakupannya hanya storage (bukan admin penuh)
 * dan bisa direvokasi per-key. Untuk produksi, pertimbangkan upload via
 * session user JWT (auth) agar tidak ada credential statis di dalam APK.
 */
public class SecureConfig {

    private static final String PREFS_NAME = "secure_config";

    private final Context context;
    private final SharedPreferences prefs;

    public SecureConfig(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public boolean isConfigured() {
        return hasText(BuildConfig.INSFORGE_BASE_URL)
            && hasText(BuildConfig.INSFORGE_BUCKET)
            && hasText(BuildConfig.INSFORGE_S3_ACCESS_KEY)
            && hasText(BuildConfig.INSFORGE_S3_SECRET_KEY)
            && hasText(BuildConfig.INSFORGE_S3_ENDPOINT)
            && hasText(BuildConfig.INSFORGE_S3_REGION);
    }

    public String getBaseUrl()      { return BuildConfig.INSFORGE_BASE_URL; }
    public String getBucket()       { return BuildConfig.INSFORGE_BUCKET; }
    public String getS3AccessKey()  { return BuildConfig.INSFORGE_S3_ACCESS_KEY; }
    public String getS3SecretKey()  { return BuildConfig.INSFORGE_S3_SECRET_KEY; }
    public String getS3Endpoint()   { return BuildConfig.INSFORGE_S3_ENDPOINT; }
    public String getS3Region()     { return BuildConfig.INSFORGE_S3_REGION; }

    public void setDeviceId(String deviceId) {
        prefs.edit().putString("deviceId", deviceId).apply();
    }

    public String getDeviceId(Context ctx) {
        String custom = prefs.getString("deviceId", null);
        if (custom != null && !custom.isEmpty()) return custom;
        String androidId = Settings.Secure.getString(
            ctx.getContentResolver(), Settings.Secure.ANDROID_ID);
        return androidId != null ? androidId : "unknown";
    }

    private static boolean hasText(String s) {
        return s != null && !s.isEmpty();
    }
}
