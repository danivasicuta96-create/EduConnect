package ro.educonnect.app;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

/**
 * Native shell for the hosted EduConnect AI web app.
 *
 * Capacitor already opens tel:, mailto: and links to other domains in the
 * system apps (Bridge#launchIntent): only the configured server host is loaded
 * inside the WebView. On top of that this activity adds:
 *  - Back button: goes back in WebView history; leaves the app on a "root"
 *    page (portal home, sign-in, landing) or on the offline page.
 *  - The offline page only for network errors, so the app's own branded
 *    404 / 500 pages still show.
 *  - File downloads (e.g. "Download my data") via the system DownloadManager,
 *    using the signed-in session cookie.
 */
public class MainActivity extends BridgeActivity {

    /** Pages where Back leaves the app instead of going back in history. */
    private static final Set<String> ROOT_PATHS = new HashSet<>(
        Arrays.asList("", "/", "/login", "/student", "/teacher", "/counselor", "/admin", "/parent", "/onboarding")
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final Bridge bridge = getBridge();
        if (bridge == null || bridge.getWebView() == null) {
            return;
        }

        bridge.setWebViewClient(new ShellWebViewClient(bridge));
        bridge.getWebView().setDownloadListener(this::startDownload);

        // Registered after Capacitor's own callbacks, so it takes precedence.
        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    WebView webView = bridge.getWebView();
                    String url = webView.getUrl();
                    if (!isOfflinePage(bridge, url) && !isRootPage(url) && webView.canGoBack()) {
                        webView.goBack();
                    } else {
                        // Leave the app (keeps it in recents, like other apps' Back at root).
                        moveTaskToBack(true);
                    }
                }
            }
        );
    }

    private static boolean isOfflinePage(Bridge bridge, String url) {
        String errorUrl = bridge.getErrorUrl();
        return url != null && errorUrl != null && url.startsWith(errorUrl);
    }

    private static boolean isRootPage(String url) {
        if (url == null) {
            return true;
        }
        String path = Uri.parse(url).getPath();
        if (path == null) {
            return true;
        }
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }
        return ROOT_PATHS.contains(path);
    }

    private void startDownload(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
        try {
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme();
            if (!"https".equals(scheme) && !"http".equals(scheme)) {
                // blob:/data: downloads can't go through DownloadManager.
                Toast.makeText(this, "This file can't be downloaded in the app. Open EduConnect in your browser.", Toast.LENGTH_LONG).show();
                return;
            }
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            DownloadManager.Request request = new DownloadManager.Request(uri);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) {
                request.addRequestHeader("Cookie", cookies);
            }
            request.addRequestHeader("User-Agent", userAgent);
            request.setMimeType(mimeType);
            request.setTitle(fileName);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+: no storage permission needed for the public Downloads folder.
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            }
            DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            dm.enqueue(request);
            Toast.makeText(this, "Downloading " + fileName + "…", Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            // Last resort: let the system browser handle it.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (ActivityNotFoundException ignored) {
                Toast.makeText(this, "Download failed.", Toast.LENGTH_SHORT).show();
            }
        }
    }

    /**
     * Capacitor shows the offline page (server.errorPath) for network errors
     * AND for any HTTP error status. We keep it for network errors only, so a
     * 404/500 shows the web app's own error page instead of "can't reach".
     */
    private static class ShellWebViewClient extends BridgeWebViewClient {

        private final Bridge shellBridge;

        ShellWebViewClient(Bridge bridge) {
            super(bridge);
            this.shellBridge = bridge;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            // Tell the offline page where "Try again" should go (the server's start URL).
            // It can't load extra local files: only the error page itself is served locally.
            if (isOfflinePage(shellBridge, url)) {
                view.evaluateJavascript("window.EDUCONNECT_START_URL = " + JSONObject.quote(shellBridge.getAppUrl()) + ";", null);
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            // Intentionally not calling super: let the page render normally.
        }
    }
}
