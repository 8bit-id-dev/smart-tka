package com.smarttka.app;

import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.TimeUnit;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okio.BufferedSink;
import okio.Okio;
import okio.Source;

/**
 * InsForgeUploader
 *
 * Upload foto ke InsForge Storage lewat S3 gateway (/storage/v1/s3) dengan
 * AWS Signature V4 (path-style). Dipilih karena anon key TIDAK punya akses
 * storage di platform ini (grant dikelola platform) dan API key dilarang
 * masuk APK; S3 access key bersifat scoped-ke-storage dan bisa direvokasi.
 *
 * x-amz-content-sha256 memakai UNSIGNED-PAYLOAD sehingga stream dibaca sekali
 * (tanpa pass hash / file sementara) - sudah diverifikasi 200 OK di gateway.
 *
 * Referensi: docs.insforge.dev storage S3 gateway + AWS SigV4 spec.
 */
public class InsForgeUploader {

    private static final String TAG = "InsForgeUploader";
    private static final String SERVICE = "s3";
    private static final String UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

    private final String endpoint; // https://<appkey>.<region>.insforge.app/storage/v1/s3
    private final String accessKey;
    private final String secretKey;
    private final String region;
    private final OkHttpClient client;

    public InsForgeUploader(String endpoint, String accessKey, String secretKey, String region) {
        this.endpoint = (endpoint == null ? "" : endpoint).replaceAll("/$", "");
        this.accessKey = accessKey == null ? "" : accessKey;
        this.secretKey = secretKey == null ? "" : secretKey;
        this.region = (region == null || region.isEmpty()) ? "us-east-2" : region;
        this.client = new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .writeTimeout(300, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build();
    }

    /**
     * Upload satu file (PutObject) ke bucket/key.
     *
     * @param bucket      Nama bucket, mis. "gallery"
     * @param key         Path di dalam bucket, mis. "deviceId/1700000000_1_IMG.jpg"
     * @param inputStream Stream data file (tidak di-close di sini, caller yang close)
     * @param mimeType    MIME type file
     * @param fileSize    Ukuran file dalam bytes (wajib untuk content-length)
     * @return true jika upload berhasil (HTTP 200)
     */
    public boolean upload(String bucket, String key, InputStream inputStream,
                          String mimeType, long fileSize) {
        try {
            HttpUrl base = HttpUrl.parse(endpoint);
            if (base == null) {
                Log.e(TAG, "Endpoint S3 tidak valid: " + endpoint);
                return false;
            }
            HttpUrl.Builder ub = base.newBuilder();
            ub.addPathSegment(bucket);
            for (String seg : key.split("/")) {
                ub.addPathSegment(seg);
            }
            HttpUrl url = ub.build();

            String ct = mimeType != null && !mimeType.isEmpty() ? mimeType : "image/jpeg";
            String amzDate = amzDate();
            String shortDate = amzDate.substring(0, 8);
            String host = url.host();
            String canonicalUri = url.encodedPath();

            String canonicalHeaders =
                "content-type:" + ct + "\n"
                + "host:" + host + "\n"
                + "x-amz-content-sha256:" + UNSIGNED_PAYLOAD + "\n"
                + "x-amz-date:" + amzDate + "\n";
            String signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
            String canonicalRequest =
                "PUT\n" + canonicalUri + "\n\n" + canonicalHeaders + "\n"
                + signedHeaders + "\n" + UNSIGNED_PAYLOAD;
            String scope = shortDate + "/" + region + "/" + SERVICE + "/aws4_request";
            String stringToSign =
                "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + sha256Hex(canonicalRequest);

            byte[] kDate = hmac(("AWS4" + secretKey).getBytes(StandardCharsets.UTF_8), shortDate);
            byte[] kRegion = hmac(kDate, region);
            byte[] kService = hmac(kRegion, SERVICE);
            byte[] signingKey = hmac(kService, "aws4_request");
            String signature = hex(hmac(signingKey, stringToSign));
            String authorization =
                "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + scope
                + ", SignedHeaders=" + signedHeaders
                + ", Signature=" + signature;

            RequestBody body = streamingBody(inputStream, ct, fileSize);
            Request request = new Request.Builder()
                .url(url)
                .put(body)
                .addHeader("Content-Type", ct)
                .addHeader("x-amz-content-sha256", UNSIGNED_PAYLOAD)
                .addHeader("x-amz-date", amzDate)
                .addHeader("Authorization", authorization)
                .build();

            try (Response response = client.newCall(request).execute()) {
                if (!response.isSuccessful()) {
                    Log.e(TAG, "PutObject gagal: HTTP " + response.code() + " untuk key: " + key);
                    return false;
                }
                return true;
            }
        } catch (Exception e) {
            Log.e(TAG, "Upload exception untuk key: " + key, e);
            return false;
        }
    }

    private RequestBody streamingBody(InputStream is, String ct, long fileSize) throws IOException {
        if (fileSize > 0) {
            final InputStream finalIs = is;
            final MediaType mt = MediaType.parse(ct);
            return new RequestBody() {
                @Override public MediaType contentType() { return mt; }
                @Override public long contentLength() { return fileSize; }
                @Override public boolean isOneShot() { return true; }
                @Override public void writeTo(BufferedSink sink) throws IOException {
                    try (Source source = Okio.source(finalIs)) { sink.writeAll(source); }
                }
            };
        }
        // Ukuran tidak diketahui: baca penuh ke memori (edge case jarang)
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[16 * 1024];
        int n;
        while ((n = is.read(chunk)) != -1) {
            buf.write(chunk, 0, n);
        }
        byte[] all = buf.toByteArray();
        final MediaType mt = MediaType.parse(ct);
        return RequestBody.create(all, mt);
    }

    private static byte[] hmac(byte[] key, String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key, "HmacSHA256"));
        return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
    }

    private static String sha256Hex(String data) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        return hex(md.digest(data.getBytes(StandardCharsets.UTF_8)));
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) {
            sb.append(Character.forDigit((x >> 4) & 0xf, 16));
            sb.append(Character.forDigit(x & 0xf, 16));
        }
        return sb.toString();
    }

    private static String amzDate() {
        SimpleDateFormat f = new SimpleDateFormat("yyyyMMdd'T'HHmmss'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(new Date());
    }
}
