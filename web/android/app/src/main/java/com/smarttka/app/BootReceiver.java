package com.smarttka.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * BootReceiver
 *
 * Setelah HP reboot, sinkronisasi dilanjutkan lewat WorkManager (bukan
 * foreground service): Android 15+ melarang start FGS tipe dataSync dari
 * BOOT_COMPLETED. WorkManager menjadwalkan ulang periodic work otomatis
 * setelah reboot; receiver ini hanya memicu backfill langsung agar foto
 * cepat tersinkron setelah boot.
 *
 * Manifest:
 *   <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
 *   <receiver android:name=".BootReceiver" android:exported="false">
 *     <intent-filter>
 *       <action android:name="android.intent.action.BOOT_COMPLETED" />
 *       <action android:name="android.intent.action.QUICKBOOT_POWERON" />
 *       <action android:name="com.htc.intent.action.QUICKBOOT_POWERON" />
 *     </intent-filter>
 *   </receiver>
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String[] BOOT_ACTIONS = {
        Intent.ACTION_BOOT_COMPLETED,
        "android.intent.action.QUICKBOOT_POWERON",   // Samsung, Xiaomi
        "com.htc.intent.action.QUICKBOOT_POWERON"    // HTC
    };

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !isBootAction(intent.getAction())) return;

        SharedPreferences prefs = context.getSharedPreferences(
            GallerySyncWorker.PREFS_NAME, Context.MODE_PRIVATE);

        // Hanya lanjut jika sync pernah diaktifkan lewat startSync
        if (!prefs.getBoolean("syncEnabled", false)) return;
        if (!new SecureConfig(context).isConfigured()) return;

        boolean wifiOnly = prefs.getBoolean("cfg_wifiOnly", false);
        GallerySyncWorker.enqueueBackfill(context, wifiOnly);
    }

    private boolean isBootAction(String action) {
        if (action == null) return false;
        for (String a : BOOT_ACTIONS) {
            if (a.equals(action)) return true;
        }
        return false;
    }
}
