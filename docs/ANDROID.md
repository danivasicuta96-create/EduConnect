# EduConnect AI — Android app

The Android app is a **Capacitor native shell that loads the hosted web app**
(`server.url`). The APK contains no business logic and **no secrets**: sign-in,
the database and the AI keys stay on the server (Netlify). Students install the
APK by scanning a QR code; the APK is served from the same deployment at
`/downloads/educonnect.apk`, with instructions at `/install`.

```
 phone ── EduConnect app (WebView) ──https──▶ https://educonnectnova.netlify.app  (Next.js, MongoDB, AI)
                    │
                    └─ offline? → bundled mobile-shell/index.html ("Can't reach EduConnect" + Try again)
```

## Files to check

| File | What it does |
|---|---|
| `capacitor.config.ts` | **App id / name** (`APP_ID`, `APP_NAME` — the only place to change them), server URL from `CAP_SERVER_URL` (default `http://10.0.2.2:3000` = your PC as seen from the emulator), start page `/login`, `cleartext` only for http, `allowNavigation` = the server host only, offline page, splash and system-bar settings. |
| `mobile-shell/index.html` | `webDir`: the offline / can't-reach page bundled in the APK. |
| `android/app/build.gradle` | Reads `appId`/`appName` from the synced config; `versionCode`/`versionName` (bump for every release); optional release signing from `android/keystore.properties`. |
| `android/variables.gradle` | SDK levels: `minSdkVersion 24` (Android 7), `compileSdkVersion`/`targetSdkVersion 36`, AndroidX versions. |
| `android/gradle/wrapper/gradle-wrapper.properties` | **Gradle 9.5.1** (Capacitor ships 8.14.3, which cannot run on Java 25 — Android Studio 2026's bundled JDK). Don't go to Gradle ≥ 9.6 while the project uses AGP 8.x (`android/build.gradle`): 9.6 removed an internal API AGP 8 needs. |
| `android/app/src/main/AndroidManifest.xml` | References the network security config; backups disabled (the WebView holds the session cookie). |
| `android/app/src/main/res/xml/network_security_config.xml` | HTTPS everywhere; plain HTTP **only** for `10.0.2.2`, `localhost`, `127.0.0.1` (dev). |
| `android/app/src/main/java/ro/educonnect/app/MainActivity.java` | Back button (history back; leaves the app on a portal home / sign-in / offline page), offline page only for network errors (the site's own 404/500 pages still show), file downloads (e.g. "Download my data") via the system download manager. |
| `android/app/src/main/res/drawable/*`, `mipmap-*` | Adaptive launcher icon (vector, coral → pink gradient + white sparkle, themed-icon monochrome), splash. |
| `scripts/android.mjs` | `npm run android:*` helper (Windows / macOS / Linux). |
| `scripts/qr.mjs` | Print-ready QR (`public/install-qr.svg` + `.png`). |
| `scripts/generate-icons.mjs` | Re-generates PWA icons and the legacy Android launcher PNGs from one SVG. |
| `src/app/(public)/install/` | Public install page with the QR code and download button. |
| `src/app/manifest.ts`, `src/app/icon.svg`, `src/app/apple-icon.png`, `public/icons/` | PWA manifest + icons ("Add to Home Screen" — the iPhone route). |

How links behave inside the app (built into Capacitor, `Bridge#launchIntent`):
pages on the server host load in the app; **`tel:`, `mailto:` and any other
domain open in the dialler / mail app / browser**.

## Prerequisites

* Node 20+ and `npm install` done.
* **Android Studio** (it installs the Android SDK, an emulator and a JDK).
  * SDK Manager: *Android SDK Platform 36* (Gradle downloads it automatically on first build if the licence is accepted) and an emulator image.
  * JDK: Capacitor 8 compiles with **Java 21+**. Android Studio's bundled JDK (Java 25) works with the Gradle 9.5.1 wrapper used here — no extra JDK needed.

## Run on the emulator (development)

1. Start the web app: `npm run dev` (http://localhost:3000).
2. Sync and open Android Studio:
   ```bash
   npm run android:dev
   ```
   (= `CAP_SERVER_URL=http://10.0.2.2:3000 npx cap sync android` + `npx cap open android`)
3. In Android Studio wait for *Gradle sync* to finish.
4. *Device Manager* → pick or create an emulator (e.g. *Medium Phone, API 36+*).
5. Press **Run ▶**. The app opens on `/login` from your dev server.
6. Web debugging: Chrome → `chrome://inspect` (enabled for http dev builds only).

After changing `capacitor.config.ts` or `mobile-shell/`, run `npm run cap:sync`
again. Changes to the web app itself need no rebuild — the app loads the server.

### Physical phone over USB (no Wi-Fi setup)

```bash
adb reverse tcp:3000 tcp:3000
CAP_SERVER_URL=http://localhost:3000 npm run cap:sync   # PowerShell: $env:CAP_SERVER_URL="http://localhost:3000"; npm run cap:sync
```
then Run ▶ on the phone. (`http://192.168.x.x` LAN addresses are rejected on
purpose — cleartext is only allowed for `10.0.2.2` / `localhost`.)

## Release: build, upload, deploy, print

1. **The web app is deployed on Netlify** at `https://educonnectnova.netlify.app`
   (prefer a stable production domain — the APK is tied to it).
2. **Sync for production:**
   ```bash
   CAP_SERVER_URL=https://educonnectnova.netlify.app npm run android:prod
   # PowerShell:  $env:CAP_SERVER_URL="https://educonnectnova.netlify.app"; npm run android:prod
   # or:          npm run android:prod -- https://educonnectnova.netlify.app
   ```
3. **Bump** `versionCode` (+1) and `versionName` in `android/app/build.gradle`.
4. **Build a signed APK** — either:
   * `npm run android:apk -- --release` (needs `android/keystore.properties`, below), or
   * Android Studio → *Build › Generate Signed App Bundle / APK › APK*, then copy
     `android/app/release/app-release.apk` to `public/downloads/educonnect.apk`.

   `npm run android:apk` (no flag) builds a **debug** APK — fine for testing.
   The script copies the APK to `public/downloads/educonnect.apk` and writes
   `public/downloads/educonnect.json` (version, size, sha256). It refuses to
   publish an APK that points at a local `http://` server unless you pass `--local`.
5. **Upload with the deployment.** Other APKs in `public/downloads/` are gitignored; the published `educonnect.apk` is not. Pick one:
   * commit `public/downloads/educonnect.apk` and `public/downloads/educonnect.json` and push to `main` — Netlify deploys it (the release APK is whitelisted in `.gitignore`), or
   * host the APK elsewhere (e.g. a GitHub Release asset) and set `ANDROID_APK_URL` in Netlify's environment variables.
6. Open `https://<your-domain>/install` — it should show **Download for Android** with the size.
   (If it says *"The Android build hasn't been uploaded yet"*, the file isn't reachable at `/downloads/educonnect.apk`.
   On password-protected preview deploys the server can't see the file either — use production.)
7. **Print the QR code:**
   ```bash
   npm run android:qr -- https://educonnectnova.netlify.app
   ```
   → `public/install-qr.svg` (vector, for print) and `public/install-qr.png`. It points to `/install`.
   The `/install` page also shows a live QR for whatever URL it's opened on.

### Release signing

Never commit keys. `*.jks`, `*.keystore` and `keystore.properties` are gitignored.

1. Create a keystore **outside the repo** (once; keep it and its passwords safe —
   you need the same key for every future update):
   ```bash
   keytool -genkeypair -v -keystore C:/Users/<you>/keys/educonnect-release.jks -alias educonnect -keyalg RSA -keysize 2048 -validity 10000
   ```
   (`keytool` is in Android Studio's `jbr/bin`.) Or create it in Android Studio's *Generate Signed APK* wizard.
2. Create `android/keystore.properties`:
   ```properties
   storeFile=C:/Users/<you>/keys/educonnect-release.jks
   storePassword=…
   keyAlias=educonnect
   keyPassword=…
   ```
3. `npm run android:apk -- --release`.

### Installing on a phone (what students see)

Scan the QR → `/install` → **Download for Android** → open the file → Android asks
to allow installs from the browser (*Settings → Allow from this source*) → Install → Open.
Updates: install the newer APK over the old one (same signing key, higher `versionCode`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank / white screen or the "Can't reach EduConnect" page on the emulator | Is `npm run dev` running? Open `http://10.0.2.2:3000` in the emulator's Chrome. Check `android/app/src/main/assets/capacitor.config.json` → `server.url`; re-run `npm run android:dev`. |
| `net::ERR_CLEARTEXT_NOT_PERMITTED` | You are using `http://` with a host other than `10.0.2.2`/`localhost`. Use https, or `adb reverse` + `http://localhost:3000`. |
| Physical device can't reach the dev server | `adb reverse tcp:3000 tcp:3000` and sync with `CAP_SERVER_URL=http://localhost:3000`. |
| The site URL changed | The URL is baked in at sync time: `npm run android:prod -- <new url>`, bump `versionCode`, rebuild and re-upload the APK, re-print the QR. Use a stable production domain to avoid this. |
| Gradle: *Unsupported class file major version* / *incompatible Java and Gradle* | The JDK is newer than the Gradle wrapper supports (Gradle 8.14 runs on Java ≤ 24; 9.1–9.5 on Java 25). Check `gradle-wrapper.properties` still says 9.5.1 (a Capacitor upgrade or an IDE "upgrade assistant" may change it), or in Android Studio: *Settings › Build, Execution, Deployment › Build Tools › Gradle › Gradle JDK* → choose/download a **JDK 21**. On the command line `npm run android:apk` picks a suitable JDK from `JAVA_HOME`, Android Studio's `jbr` and `~/.jdks`. |
| `invalid source release: 21` | The JDK is older than 21 — select a JDK 21 as above. |
| SDK location not found | Open the project once in Android Studio, or set `ANDROID_HOME` (the script writes `android/local.properties` for you). |
| Splash/icon still the Capacitor default | Uninstall the old app from the emulator (launchers cache icons), then Run again. |
| Changed `APP_ID` | `npm run cap:sync` and rebuild — it's a *new* app for Android (installs next to the old one). |

## The release signing key (important)

The published APK (version 1.0, versionCode 1) is signed with the key in
`C:\Users\rober\.educonnect-keys\educonnect-release.jks` (alias `educonnect`).
Its passwords are in `android/keystore.properties`, which is gitignored.

**Back up both files somewhere safe and private** (e.g. a password manager).
Android only installs an update over an existing app if it is signed with the
**same key** — if the key is lost, students would have to uninstall and
reinstall the app. Never commit the key or the properties file.

To publish an update: bump `versionCode` (and `versionName`) in
`android/app/build.gradle`, run `npm run android:prod -- https://educonnectnova.netlify.app`,
`npm run android:apk -- --release`, commit `public/downloads/educonnect.apk` +
`educonnect.json`, and push to `main`.
