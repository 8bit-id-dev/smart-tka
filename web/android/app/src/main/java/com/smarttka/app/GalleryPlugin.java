package com.smarttka.app;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(
    name = "Gallery",
    permissions = {
        @Permission(alias = "photos", strings = { 
            android.Manifest.permission.READ_MEDIA_IMAGES,
            android.Manifest.permission.READ_MEDIA_VIDEO,
            android.Manifest.permission.READ_MEDIA_AUDIO,
            android.Manifest.permission.READ_EXTERNAL_STORAGE
        })
    }
)
public class GalleryPlugin extends Plugin {

    private static final int MAX_RECURSION_DEPTH = 5;
    private String pendingTreeUri = null;

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        String permission = getPermissionForSdk();
        
        int status = androidx.core.content.ContextCompat.checkSelfPermission(getContext(), permission);
        if (status == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            result.put("granted", true);
        } else if (androidx.core.app.ActivityCompat.shouldShowRequestPermissionRationale(getActivity(), permission)) {
            result.put("granted", false);
            result.put("showRationale", true);
        } else {
            result.put("granted", false);
            result.put("showRationale", false);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        String permission = getPermissionForSdk();
        
        if (androidx.core.content.ContextCompat.checkSelfPermission(getContext(), permission) 
            == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }

        requestPermissionForAlias("photos", call, "permissionCallback");
    }

    @ActivityCallback
    private void permissionCallback(PluginCall call) {
        String permission = getPermissionForSdk();
        JSObject result = new JSObject();
        if (androidx.core.content.ContextCompat.checkSelfPermission(getContext(), permission) 
            == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            result.put("granted", true);
            call.resolve(result);
        } else {
            result.put("granted", false);
            call.reject("Permission denied");
        }
    }

    @PluginMethod
    public void pickDirectory(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        
        startActivityForResult(call, intent, "directoryPickerCallback");
    }

    @ActivityCallback
    private void directoryPickerCallback(PluginCall call, Intent data) {
        if (data == null || data.getData() == null) {
            call.reject("No directory selected");
            return;
        }

        Uri treeUri = data.getData();
        Activity activity = getActivity();
        
        // Persist URI permission
        try {
            final int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION 
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
            activity.getContentResolver().takePersistableUriPermission(treeUri, takeFlags);
        } catch (Exception e) {
            call.reject("Failed to persist permission: " + e.getMessage());
            return;
        }

        String displayName = getDisplayNameForUri(treeUri);
        pendingTreeUri = treeUri.toString();

        JSObject result = new JSObject();
        result.put("treeUri", treeUri.toString());
        result.put("displayName", displayName);
        result.put("persisted", true);
        call.resolve(result);
    }

    @PluginMethod
    public void listFiles(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        if (treeUriStr == null) {
            call.reject("treeUri is required");
            return;
        }

        boolean recursive = call.getBoolean("recursive", false);
        int maxDepth = call.getInt("maxDepth", MAX_RECURSION_DEPTH);
        
        JSArray mimeTypesArray = call.getArray("mimeTypes");
        String[] mimeTypes = null;
        if (mimeTypesArray != null) {
            mimeTypes = new String[mimeTypesArray.length()];
            for (int i = 0; i < mimeTypesArray.length(); i++) {
                try {
                    mimeTypes[i] = mimeTypesArray.getString(i);
                } catch (Exception e) {
                    mimeTypes[i] = null;
                }
            }
        }

        Uri treeUri = Uri.parse(treeUriStr);
        ArrayList<Map<String, String>> files = new ArrayList<>();

        try {
            listFilesRecursive(treeUri, files, 0, recursive ? maxDepth : 1, mimeTypes);
        } catch (Exception e) {
            call.reject("Failed to list files: " + e.getMessage());
            return;
        }

        JSObject result = new JSObject();
        JSObject filesObj = new JSObject();
        for (int i = 0; i < files.size(); i++) {
            Map<String, String> file = files.get(i);
            JSObject fileObj = new JSObject();
            fileObj.put("id", file.get("id"));
            fileObj.put("name", file.get("name"));
            fileObj.put("path", file.get("path"));
            fileObj.put("uri", file.get("uri"));
            fileObj.put("mimeType", file.get("mimeType"));
            fileObj.put("size", file.get("size"));
            fileObj.put("dateAdded", file.get("dateAdded"));
            fileObj.put("dateModified", file.get("dateModified"));
            filesObj.put(String.valueOf(i), fileObj);
        }
        result.put("files", filesObj);
        result.put("count", files.size());
        call.resolve(result);
    }

    @PluginMethod
    public void persistDirectory(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        if (treeUriStr == null) {
            call.reject("treeUri is required");
            return;
        }

        Uri treeUri = Uri.parse(treeUriStr);
        try {
            final int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION 
                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
            getActivity().getContentResolver().takePersistableUriPermission(treeUri, takeFlags);
            JSObject result = new JSObject();
            result.put("persisted", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to persist: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPersistedDirectories(PluginCall call) {
        List<UriPermission> perms = getContext().getContentResolver()
                .getPersistedUriPermissions();
        
        JSObject result = new JSObject();
        JSObject dirs = new JSObject();
        for (int i = 0; i < perms.size(); i++) {
            UriPermission perm = perms.get(i);
            if (perm.isReadPermission()) {
                dirs.put(String.valueOf(i), perm.getUri().toString());
            }
        }
        result.put("directories", dirs);
        result.put("count", perms.size());
        call.resolve(result);
    }

    private void listFilesRecursive(Uri uri, ArrayList<Map<String, String>> results, 
                                     int depth, int maxDepth, String[] mimeTypes) {
        if (depth >= maxDepth) return;

        ContentResolver resolver = getContext().getContentResolver();
        String[] projection = {
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.SIZE,
                MediaStore.Files.FileColumns.MIME_TYPE,
                MediaStore.Files.FileColumns.DATE_ADDED,
                MediaStore.Files.FileColumns.DATE_MODIFIED
        };

        try {
            Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(
                    uri, DocumentsContract.getTreeDocumentId(uri));

            try (Cursor cursor = resolver.query(childrenUri, projection, null, null, null)) {
                if (cursor == null) return;

                int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns._ID);
                int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME);
                int sizeColumn = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.SIZE);
                int mimeColumn = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.MIME_TYPE);
                int dateAddedColumn = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_ADDED);
                int dateModifiedColumn = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DATE_MODIFIED);

                while (cursor.moveToNext()) {
                    String mimeType = cursor.getString(mimeColumn);
                    String name = cursor.getString(nameColumn);

                    if (mimeType != null && mimeType.equals("resource/folder") 
                            && !name.startsWith(".")) {
                        // Recurse into subdirectory
                        String childDocId = cursor.getString(idColumn);
                        Uri childUri = DocumentsContract.buildDocumentUriUsingTree(uri, childDocId);
                        listFilesRecursive(childUri, results, depth + 1, maxDepth, mimeTypes);
                    } else if (mimeType != null && !mimeType.equals("resource/folder")) {
                        // Skip if mimeTypes filter is set and doesn't match
                        if (mimeTypes != null && mimeTypes.length > 0) {
                            boolean matches = false;
                            for (String mt : mimeTypes) {
                                if (mimeType.startsWith(mt)) {
                                    matches = true;
                                    break;
                                }
                            }
                            if (!matches) continue;
                        }

                        String docId = cursor.getString(idColumn);
                        Uri docUri = DocumentsContract.buildDocumentUriUsingTree(uri, docId);
                        long size = cursor.getLong(sizeColumn);

                        Map<String, String> file = new HashMap<>();
                        file.put("id", docId);
                        file.put("name", name);
                        file.put("path", uri.toString() + "/" + name);
                        file.put("uri", docUri.toString());
                        file.put("mimeType", mimeType);
                        file.put("size", String.valueOf(size));
                        file.put("dateAdded", cursor.getString(dateAddedColumn));
                        file.put("dateModified", cursor.getString(dateModifiedColumn));
                        results.add(file);
                    }
                }
            }
        } catch (Exception e) {
            // Ignore errors for individual directories
        }
    }

    private String getPermissionForSdk() {
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            return android.Manifest.permission.READ_MEDIA_IMAGES;
        } else {
            return android.Manifest.permission.READ_EXTERNAL_STORAGE;
        }
    }

    private String getDisplayNameForUri(Uri uri) {
        String displayName = "Selected Directory";
        try {
            ContentResolver resolver = getContext().getContentResolver();
            String[] projection = {MediaStore.Files.FileColumns.DISPLAY_NAME};
            try (Cursor cursor = resolver.query(uri, projection, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameColumn = cursor.getColumnIndexOrThrow(MediaStore.Files.FileColumns.DISPLAY_NAME);
                    displayName = cursor.getString(nameColumn);
                }
            }
        } catch (Exception e) {
            // Use default name
        }
        return displayName;
    }
}
