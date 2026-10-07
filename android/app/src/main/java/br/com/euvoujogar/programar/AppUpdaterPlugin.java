package br.com.euvoujogar.programar;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject result = new JSObject();
            result.put("versionName", info.versionName == null ? "0.0.0" : info.versionName);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Could not read app version", exception);
        }
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        String downloadUrl = call.getString("url");
        String expectedSha256 = call.getString("sha256");
        if (!isTrustedDownload(downloadUrl) || expectedSha256 == null || !expectedSha256.matches("(?i)[a-f0-9]{64}")) {
            call.reject("Invalid update information");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getContext().getPackageManager().canRequestPackageInstalls()) {
            getActivity().runOnUiThread(() -> {
                Intent settings = new Intent(
                        android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(settings);
                JSObject result = new JSObject();
                result.put("permissionRequired", true);
                call.resolve(result);
            });
            return;
        }

        executor.execute(() -> downloadAndInstall(call, downloadUrl, expectedSha256.toLowerCase(Locale.ROOT)));
    }

    private void downloadAndInstall(PluginCall call, String downloadUrl, String expectedSha256) {
        File temporaryFile = new File(getContext().getCacheDir(), "eu-vou-programar-update.part");
        File apkFile = new File(getContext().getCacheDir(), "eu-vou-programar-update.apk");
        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(downloadUrl).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Accept", "application/octet-stream");
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("Download failed with HTTP " + connection.getResponseCode());
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long totalBytes = 0;
            try (InputStream input = connection.getInputStream();
                    FileOutputStream output = new FileOutputStream(temporaryFile)) {
                byte[] buffer = new byte[16384];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    totalBytes += count;
                    if (totalBytes > 512L * 1024L * 1024L) {
                        throw new IllegalStateException("APK exceeds the maximum allowed size");
                    }
                    digest.update(buffer, 0, count);
                    output.write(buffer, 0, count);
                }
            } finally {
                connection.disconnect();
            }

            if (totalBytes == 0 || !toHex(digest.digest()).equals(expectedSha256)) {
                throw new SecurityException("APK checksum does not match the release digest");
            }
            if (apkFile.exists() && !apkFile.delete()) {
                throw new IllegalStateException("Could not replace cached APK");
            }
            if (!temporaryFile.renameTo(apkFile)) {
                throw new IllegalStateException("Could not finalize downloaded APK");
            }

            getActivity().runOnUiThread(() -> {
                try {
                    Uri apkUri = FileProvider.getUriForFile(
                            getContext(), getContext().getPackageName() + ".fileprovider", apkFile);
                    Intent installer = new Intent(Intent.ACTION_VIEW);
                    installer.setDataAndType(apkUri, "application/vnd.android.package-archive");
                    installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    getActivity().startActivity(installer);
                    JSObject result = new JSObject();
                    result.put("permissionRequired", false);
                    call.resolve(result);
                } catch (Exception exception) {
                    call.reject("Could not open Android package installer", exception);
                }
            });
        } catch (Exception exception) {
            temporaryFile.delete();
            call.reject("Could not download or verify update", exception);
        }
    }

    private boolean isTrustedDownload(String downloadUrl) {
        if (downloadUrl == null) return false;
        try {
            URL url = new URL(downloadUrl);
            return "https".equals(url.getProtocol())
                    && "github.com".equals(url.getHost())
                    && url.getPath().contains("/releases/download/");
        } catch (Exception exception) {
            return false;
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) result.append(String.format(Locale.ROOT, "%02x", value));
        return result.toString();
    }
}