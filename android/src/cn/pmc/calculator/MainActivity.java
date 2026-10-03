package cn.pmc.calculator;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.*;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.util.*;

/** Only packaged assets run inside this WebView. External links leave the app. */
public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/index.html";
    private static final int OPEN_FILE = 100, SAVE_FILE = 101;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] exportBytes;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        applyScreenMode(getPreferences(MODE_PRIVATE).getString("screenMode", "auto"));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(245, 243, 239));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        android.content.pm.PackageInfo provider = WebView.getCurrentWebViewPackage();
        int major = 0;
        try { major = Integer.parseInt(provider.versionName.split("\\.")[0]); } catch (Exception ignored) { }
        if (major < 107) {
            new AlertDialog.Builder(this).setTitle("请先更新系统网页组件")
                .setMessage("PMC 需要 Android System WebView 107 或更新版本。请在手机应用商店或系统更新中升级网页组件，然后重新打开 PMC。你的已有记录不会被删除。")
                .setPositiveButton("知道了", (d, w) -> finish()).setCancelable(false).show();
            return;
        }
        // Keep content clear of Android 15 edge-to-edge bars and the keyboard.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets.consumeSystemWindowInsets();
        });
        root.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // user-selected documents only
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setTextZoom(100);
        settings.setUserAgentString(settings.getUserAgentString() + " PMCAndroid/1.3.1");
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(false);
        web.addJavascriptInterface(new ExportBridge(), "PMCAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return localResponse(r.getUrl(), r.getMethod());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri uri = r.getUrl();
                if (isLocal(uri)) return false;
                if (r.isForMainFrame()) openExternal(uri);
                return true;
            }
            @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
                if (r.isForMainFrame()) toast("页面加载失败，请退出后重试；不要清除应用数据。");
            }
            @Override public void onReceivedSslError(WebView v, android.webkit.SslErrorHandler h, android.net.http.SslError e) {
                h.cancel();
            }
        });
        // Do not let a web service worker replace the immutable APK resources.
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest r) {
                return localResponse(r.getUrl(), r.getMethod());
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = params.getAcceptTypes();
                boolean images = types.length > 0 && Arrays.stream(types).anyMatch(t -> t.startsWith("image/"));
                intent.setType(images ? "image/*" : "*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                try { startActivityForResult(intent, OPEN_FILE); }
                catch (ActivityNotFoundException ex) { callback.onReceiveValue(null); fileCallback = null; toast("系统没有可用的文件选择器"); }
                return true;
            }
            @Override public boolean onJsAlert(WebView v, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定", (d, w) -> result.confirm())
                    .setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView v, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定", (d, w) -> result.confirm())
                    .setNegativeButton("取消", (d, w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
        });
        web.loadUrl(HOME);
    }

    private void applyScreenMode(String mode) {
        int orientation = mode.equals("portrait") ? android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                : mode.equals("landscape") ? android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                : android.content.pm.ActivityInfo.SCREEN_ORIENTATION_FULL_USER;
        setRequestedOrientation(orientation);
    }

    private boolean isLocal(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && uri.getPort() == -1;
    }

    private WebResourceResponse localResponse(Uri uri, String method) {
        String path = uri.getPath();
        if (!isLocal(uri) || !"GET".equals(method) || path == null || path.contains("..") || path.contains("\\") || path.contains("\0"))
            return errorResponse(403, "Forbidden");
        if (path.equals("/")) path = "/index.html";
        if (path.equals("/sw.js")) return errorResponse(404, "Not Found");
        if (path.equals("/live-teams.json")) return onlineTeamsResponse();
        try {
            InputStream stream = getAssets().open("www" + path);
            String extension = MimeTypeMap.getFileExtensionFromUrl(path);
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            if (path.endsWith(".js") || path.endsWith(".mjs")) mime = "text/javascript";
            if (path.endsWith(".json") || path.endsWith(".webmanifest")) mime = "application/json";
            if (path.endsWith(".svg")) mime = "image/svg+xml";
            if (mime == null) mime = "application/octet-stream";
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("Content-Security-Policy", "default-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'");
            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, stream);
        } catch (IOException ex) { return errorResponse(404, "Not Found"); }
    }

    private WebResourceResponse onlineTeamsResponse() {
        try (InputStream config = getAssets().open("www/team-feed-url.txt")) {
            byte[] configured = new byte[512];
            int length = config.read(configured);
            if (length <= 0) throw new IOException("No team feed URL");
            URL url = new URL(new String(configured, 0, length, "UTF-8").trim());
            if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null || url.getHost().isEmpty())
                throw new IOException("Invalid team feed URL");
            HttpsURLConnection connection = (HttpsURLConnection) url.openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(15000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Cache-Control", "no-cache");
            if (connection.getResponseCode() != 200 || connection.getContentLengthLong() > 10 * 1024 * 1024) {
                connection.disconnect();return errorResponse(503, "Feed Unavailable");
            }
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-store");
            headers.put("X-Content-Type-Options", "nosniff");
            return new WebResourceResponse("application/json", "UTF-8", 200, "OK", headers, new FilterInputStream(connection.getInputStream()) {
                long count = 0;
                @Override public int read() throws IOException { int value = super.read();if (value >= 0 && ++count > 10 * 1024 * 1024) throw new IOException("Feed too large");return value; }
                @Override public int read(byte[] data, int offset, int length) throws IOException { int n = super.read(data, offset, length);if (n > 0 && (count += n) > 10 * 1024 * 1024) throw new IOException("Feed too large");return n; }
                @Override public void close() throws IOException { super.close();connection.disconnect(); }
            });
        } catch (IOException | SecurityException ex) { return errorResponse(503, "Feed Unavailable"); }
    }

    private WebResourceResponse errorResponse(int code, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", code, reason, Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private void openExternal(Uri uri) {
        String scheme = uri.getScheme();
        if (!Arrays.asList("https", "http", "mqqapi", "mqqwpa").contains(scheme)) { toast("不支持此链接类型"); return; }
        try { startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)); }
        catch (ActivityNotFoundException ex) { toast("没有可打开此链接的应用，请安装浏览器或 QQ"); }
    }

    public final class ExportBridge {
        @JavascriptInterface public String getScreenMode() {
            return getPreferences(MODE_PRIVATE).getString("screenMode", "auto");
        }
        @JavascriptInterface public void setScreenMode(String mode) {
            if (!Arrays.asList("auto", "portrait", "landscape").contains(mode)) return;
            runOnUiThread(() -> {
                getPreferences(MODE_PRIVATE).edit().putString("screenMode", mode).apply();
                applyScreenMode(mode);
            });
        }
        @JavascriptInterface public boolean isDarkMode() {
            return (getResources().getConfiguration().uiMode & android.content.res.Configuration.UI_MODE_NIGHT_MASK)
                == android.content.res.Configuration.UI_MODE_NIGHT_YES;
        }
        @JavascriptInterface public void saveFile(String name, String mime, String encoded) {
            if (encoded == null || encoded.length() > 64 * 1024 * 1024 || name == null || name.length() > 200) {
                toast("导出文件过大或文件名无效，请分批导出"); return;
            }
            if (!Arrays.asList("application/json", "image/png", "application/octet-stream").contains(mime)) {
                toast("不支持的导出格式"); return;
            }
            final byte[] bytes;
            try { bytes = Base64.decode(encoded, Base64.DEFAULT); }
            catch (IllegalArgumentException ex) { toast("导出数据无效"); return; }
            runOnUiThread(() -> {
                if (!isLocal(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) return;
                if (exportBytes != null) { toast("请先完成或取消上一次保存"); return; }
                exportBytes = bytes;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime);
                intent.putExtra(Intent.EXTRA_TITLE, name.replaceAll("[\\\\/\\x00-\\x1f]", "_"));
                try { startActivityForResult(intent, SAVE_FILE); }
                catch (ActivityNotFoundException ex) { exportBytes = null; toast("系统没有可用的文件保存器"); }
            });
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == OPEN_FILE && fileCallback != null) {
            List<Uri> uris = new ArrayList<>();
            if (result == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    for (int i = 0; i < data.getClipData().getItemCount(); i++) uris.add(data.getClipData().getItemAt(i).getUri());
                } else if (data.getData() != null) uris.add(data.getData());
            }
            // Reject file:// and remote URIs even from third-party document providers.
            uris.removeIf(uri -> !"content".equals(uri.getScheme()));
            fileCallback.onReceiveValue(uris.isEmpty() ? null : uris.toArray(new Uri[0]));
            fileCallback = null;
        }
        if (request == SAVE_FILE) {
            byte[] bytes = exportBytes;
            exportBytes = null;
            if (result == RESULT_OK && data != null && data.getData() != null && bytes != null) {
                Uri destination = data.getData();
                if (!"content".equals(destination.getScheme())) { toast("保存位置无效"); return; }
                new Thread(() -> {
                    try (OutputStream output = getContentResolver().openOutputStream(destination, "wt")) {
                        if (output == null) throw new IOException("No output stream");
                        output.write(bytes);
                        toast("文件已保存");
                    } catch (IOException | SecurityException ex) { toast("文件保存失败，请换一个位置重试"); }
                }, "pmc-export").start();
            } else if (result == RESULT_OK && bytes == null) toast("应用被系统回收，请重新导出文件");
        }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("(() => {const d=document.querySelector('dialog[open]');if(d){d.dispatchEvent(new Event('cancel',{cancelable:true}));return true;}if(document.activeElement)document.activeElement.blur();return false;})()", handled -> {
            if (!"true".equals(handled)) {
                if (web.canGoBack()) web.goBack();
                else new AlertDialog.Builder(this).setMessage("退出 PMC？已保存的配置会保留在本机。")
                    .setPositiveButton("退出", (d, w) -> finish()).setNegativeButton("继续使用", null).show();
            }
        });
    }

    @Override public void onConfigurationChanged(android.content.res.Configuration configuration) {
        super.onConfigurationChanged(configuration);
        if (web != null) web.evaluateJavascript("window.dispatchEvent(new Event('pmc-system-theme'))", null);
    }

    private void toast(String message) { runOnUiThread(() -> Toast.makeText(this, message, Toast.LENGTH_LONG).show()); }
    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        exportBytes = null;
        if (web != null) { web.removeJavascriptInterface("PMCAndroid"); web.destroy(); }
        super.onDestroy();
    }
}
