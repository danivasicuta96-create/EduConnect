// Capacitor configuration for the EduConnect AI Android app.
//
// The Android app is a thin native shell that loads the HOSTED web app
// (`server.url`). Nothing secret ships in the APK: auth, the database and the
// AI keys stay on the server. See docs/ANDROID.md.
//
// The server URL is read at `cap sync` time from CAP_SERVER_URL:
//   CAP_SERVER_URL=https://<project>.vercel.app npm run android:prod
// Without it, the app points at the dev server on the host machine as seen
// from the Android emulator (http://10.0.2.2:3000).
import type { CapacitorConfig } from "@capacitor/cli";

// ─── Identity — change these in ONE place ────────────────────────────────────
// android/app/build.gradle reads appId/appName back from the synced
// capacitor.config.json, so a change here + `npm run cap:sync` is enough.
// (The Java package of MainActivity stays ro.educonnect.app; it doesn't have to
// match the application id.)
export const APP_ID = "ro.educonnect.app";
export const APP_NAME = "EduConnect AI";

/** Page opened when the app starts. /login forwards signed-in users to their portal. */
const START_PATH = "/login";
const DEFAULT_SERVER_URL = "http://10.0.2.2:3000";
/** The only hosts allowed over plain HTTP — must match network_security_config.xml. */
const CLEARTEXT_HOSTS = new Set(["10.0.2.2", "localhost", "127.0.0.1"]);
const WEB_DIR = "mobile-shell";

function resolveServerUrl(): URL {
  const raw = (process.env.CAP_SERVER_URL ?? "").trim() || DEFAULT_SERVER_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`CAP_SERVER_URL is not a valid URL: "${raw}"`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`CAP_SERVER_URL must start with https:// (got "${raw}")`);
  }
  if (url.protocol === "http:" && !CLEARTEXT_HOSTS.has(url.hostname)) {
    throw new Error(
      `CAP_SERVER_URL "${raw}" uses plain HTTP. Only ${[...CLEARTEXT_HOSTS].join(", ")} may use http:// ` +
        "(emulator / adb reverse). Use the https:// URL of your deployment.",
    );
  }
  return url;
}

const server = resolveServerUrl();
const isCleartext = server.protocol === "http:";
const startUrl = server.origin + START_PATH;

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: APP_NAME,
  webDir: WEB_DIR,
  // Lets the web app recognise the shell (e.g. the /install page).
  appendUserAgent: "EduConnectApp/1.0",
  backgroundColor: "#ffffff",
  server: {
    url: startUrl,
    cleartext: isCleartext,
    // Only the app's own host is loaded inside the WebView; any other domain,
    // tel: and mailto: open in the system browser / dialler / mail app.
    allowNavigation: [server.hostname],
    // Shown when the server can't be reached (network errors only — the app's
    // own 404/500 pages are kept; see MainActivity).
    errorPath: "index.html",
  },
  android: {
    allowMixedContent: false,
    // Web debugging (chrome://inspect) only for local http builds.
    webContentsDebuggingEnabled: isCleartext,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: "#ffffff",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    // Built into Capacitor 8: pads the WebView so content never sits under the
    // status/navigation bars, with dark icons on the white app background.
    SystemBars: {
      insetsHandling: "css",
      style: "LIGHT",
    },
  },
};

export default config;
