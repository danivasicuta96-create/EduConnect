// Cross-platform helper for the Capacitor Android app (Windows, macOS, Linux).
//
//   node scripts/android.mjs sync                 cap sync android (uses CAP_SERVER_URL if set)
//   node scripts/android.mjs dev                  sync for the emulator (http://10.0.2.2:3000) + open Android Studio
//   node scripts/android.mjs prod [url]           sync for a deployment (CAP_SERVER_URL or [url], https only)
//   node scripts/android.mjs apk [--release]      build an APK with Gradle and copy it to public/downloads/educonnect.apk
//                                [--local]        …allow copying an APK that points at a local http:// server
//
// See docs/ANDROID.md.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = join(root, "android");
const isWin = process.platform === "win32";
const [command = "help", ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith("--")));
const args = rest.filter((a) => !a.startsWith("--"));

function die(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function run(cmd, cmdArgs, opts = {}) {
  console.log(`\n› ${cmd} ${cmdArgs.join(" ")}`);
  // On Windows run through cmd.exe so npx.cmd / gradlew.bat resolve. Arguments
  // are fixed strings from this script (never user input), joined into one command.
  const res = isWin
    ? spawnSync([cmd, ...cmdArgs].join(" "), { stdio: "inherit", shell: true, cwd: root, ...opts })
    : spawnSync(cmd, cmdArgs, { stdio: "inherit", cwd: root, ...opts });
  if (res.error) die(res.error.message);
  if (res.status !== 0) process.exit(res.status ?? 1);
}

function cap(capArgs, serverUrl) {
  const env = { ...process.env };
  if (serverUrl !== undefined) env.CAP_SERVER_URL = serverUrl;
  run("npx", ["cap", ...capArgs], { env });
}

function syncedConfig() {
  const file = join(androidDir, "app/src/main/assets/capacitor.config.json");
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

// ─── Toolchain discovery (JDK + Android SDK) ──────────────────────────────────

function javaMajor(javaHome) {
  const bin = join(javaHome, "bin", isWin ? "java.exe" : "java");
  if (!existsSync(bin)) return null;
  const res = spawnSync(bin, ["-version"], { encoding: "utf8" });
  const m = /version "(\d+)(?:\.(\d+))?/.exec(`${res.stderr}${res.stdout}`);
  if (!m) return null;
  return m[1] === "1" ? Number(m[2]) : Number(m[1]);
}

function jdkCandidates() {
  const list = [];
  if (process.env.JAVA_HOME) list.push(process.env.JAVA_HOME);
  if (isWin) {
    const pf = process.env.ProgramFiles ?? "C:\\Program Files";
    list.push(join(pf, "Android", "Android Studio", "jbr"));
  } else if (process.platform === "darwin") {
    list.push("/Applications/Android Studio.app/Contents/jbr/Contents/Home");
  } else {
    list.push(join(homedir(), "android-studio", "jbr"), "/opt/android-studio/jbr", "/snap/android-studio/current/jbr");
  }
  // JDKs downloaded by Android Studio / IntelliJ.
  const jdks = join(homedir(), ".jdks");
  if (existsSync(jdks)) for (const d of readdirSync(jdks)) list.push(join(jdks, d));
  return [...new Set(list)];
}

/** Capacitor 8 compiles with Java 21, so we need a JDK ≥ 21 that the Gradle wrapper can run on. */
function findJdk() {
  const maxSupported = gradleMaxJava();
  const found = jdkCandidates()
    .map((home) => ({ home, major: javaMajor(home) }))
    .filter((j) => j.major !== null);
  const ok = found.filter((j) => j.major >= 21 && j.major <= maxSupported);
  if (ok.length) return ok[0];
  const detail = found.length ? found.map((j) => `${j.home} (Java ${j.major})`).join("\n    ") : "none found";
  die(
    `No suitable JDK found (need Java 21–${maxSupported} for this Gradle version).\n  Candidates:\n    ${detail}\n` +
      "  Install one (Android Studio › Settings › Build Tools › Gradle › Gradle JDK › Download JDK › version 21)\n" +
      "  or set JAVA_HOME, then try again.",
  );
}

/** Newest Java version the Gradle wrapper in android/ can run on. */
function gradleMaxJava() {
  const props = readFileSync(join(androidDir, "gradle/wrapper/gradle-wrapper.properties"), "utf8");
  const m = /gradle-(\d+)\.(\d+)/.exec(props);
  if (!m) return 25;
  const [major, minor] = [Number(m[1]), Number(m[2])];
  // https://docs.gradle.org/current/userguide/compatibility.html
  if (major > 9 || (major === 9 && minor >= 1)) return 25;
  if (major === 9 || (major === 8 && minor >= 14)) return 24;
  return 23;
}

function ensureSdk() {
  const localProps = join(androidDir, "local.properties");
  if (process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || existsSync(localProps)) return;
  const guesses = isWin
    ? [join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "Android", "Sdk")]
    : process.platform === "darwin"
      ? [join(homedir(), "Library", "Android", "sdk")]
      : [join(homedir(), "Android", "Sdk")];
  const sdk = guesses.find((p) => existsSync(p));
  if (!sdk) die("Android SDK not found. Install Android Studio (it installs the SDK) or set ANDROID_HOME.");
  // local.properties is gitignored; forward slashes work on every OS.
  writeFileSync(localProps, `sdk.dir=${sdk.replace(/\\/g, "/")}\n`);
  console.log(`Wrote android/local.properties (sdk.dir=${sdk})`);
}

// ─── Commands ────────────────────────────────────────────────────────────────

function cmdSync() {
  cap(["sync", "android"]);
}

function cmdDev() {
  cap(["sync", "android"], "http://10.0.2.2:3000");
  cap(["open", "android"], "http://10.0.2.2:3000");
  console.log("\nIn Android Studio: pick an emulator and press Run ▶. Keep `npm run dev` running.");
}

function cmdProd() {
  const url = (args[0] ?? process.env.CAP_SERVER_URL ?? "").trim();
  if (!url) die("Set CAP_SERVER_URL to your deployment, e.g.\n  CAP_SERVER_URL=https://<project>.vercel.app npm run android:prod\n  (or: npm run android:prod -- https://<project>.vercel.app)");
  if (!url.startsWith("https://")) die(`CAP_SERVER_URL must be an https:// URL for a production build (got ${url}).`);
  cap(["sync", "android"], url);
  console.log(`\nSynced for ${url}. Next: npm run android:apk -- --release   (or build in Android Studio)`);
}

function cmdApk() {
  const release = flags.has("--release");
  const cfg = syncedConfig();
  if (!cfg) die("android/ hasn't been synced yet. Run `npm run android:prod` (or `npm run cap:sync`) first.");
  const serverUrl = cfg.server?.url ?? "";
  const isLocal = serverUrl.startsWith("http://");
  if (release && !existsSync(join(androidDir, "keystore.properties"))) {
    die(
      "A release APK must be signed. Create android/keystore.properties (see docs/ANDROID.md › Release signing)\n" +
        "  or build a signed APK in Android Studio (Build › Generate Signed App Bundle / APK).",
    );
  }

  const jdk = findJdk();
  ensureSdk();
  console.log(`Using JDK ${jdk.major}: ${jdk.home}`);
  console.log(`APK will load: ${serverUrl}`);

  const task = release ? "assembleRelease" : "assembleDebug";
  // Absolute path (quoted for cmd.exe): Windows may not search the current directory.
  const gradlew = isWin ? `"${join(androidDir, "gradlew.bat")}"` : "./gradlew";
  run(gradlew, [task, "--console=plain"], { cwd: androidDir, env: { ...process.env, JAVA_HOME: jdk.home } });

  const variant = release ? "release" : "debug";
  const outDir = join(androidDir, "app", "build", "outputs", "apk", variant);
  const apk = [`app-${variant}.apk`].map((f) => join(outDir, f)).find((f) => existsSync(f));
  if (!apk) die(`Build finished but no APK found in ${outDir}`);
  const size = statSync(apk).size;
  console.log(`\n✔ Built ${apk} (${(size / 1048576).toFixed(1)} MB)`);

  if (isLocal && !flags.has("--local")) {
    console.log(
      `\nNot copied to public/downloads: this APK points at ${serverUrl}, which only works on the emulator / adb reverse.\n` +
        "Run `npm run android:prod` first, or pass --local to copy it anyway.",
    );
    return;
  }

  const dest = join(root, "public", "downloads", "educonnect.apk");
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(apk, dest);
  const sha256 = createHash("sha256").update(readFileSync(dest)).digest("hex");
  const gradle = readFileSync(join(androidDir, "app", "build.gradle"), "utf8");
  const meta = {
    appId: cfg.appId,
    versionName: /versionName\s+"([^"]+)"/.exec(gradle)?.[1] ?? null,
    versionCode: Number(/versionCode\s+(\d+)/.exec(gradle)?.[1] ?? 0) || null,
    variant,
    serverUrl,
    size,
    sha256,
    builtAt: new Date().toISOString(),
  };
  writeFileSync(join(root, "public", "downloads", "educonnect.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log(`✔ Copied to public/downloads/educonnect.apk (+ educonnect.json, sha256 ${sha256.slice(0, 12)}…)`);
  if (!release) console.log("  Note: this is a DEBUG build — fine for testing; publish a signed --release build for students.");
}

const commands = { sync: cmdSync, dev: cmdDev, prod: cmdProd, apk: cmdApk };
const fn = commands[command];
if (!fn) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(0, 9).join("\n"));
  process.exit(command === "help" ? 0 : 1);
}
fn();
