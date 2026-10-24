// Helpers for the public /install page: where the APK lives and whether it has
// been uploaded yet. No database, no auth.
import "server-only";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

/** Public path of the Android build (written by `npm run android:apk`). */
export const APK_PATH = "/downloads/educonnect.apk";
/** Optional metadata written next to the APK by scripts/android.mjs. */
const APK_META_PATH = "/downloads/educonnect.json";

export interface ApkInfo {
  available: boolean;
  /** Absolute URL to download from. */
  href: string;
  size?: number;
  version?: string;
  builtAt?: string;
}

/**
 * Public origin of this deployment, e.g. https://educonnectnova.netlify.app.
 * APP_URL wins when set; otherwise derived from the (proxy) request headers so
 * it is right on every preview / production URL.
 */
export function requestOrigin(h: Headers): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // fall through to the request headers
    }
  }
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return "http://localhost:3000";
  const forwarded = h.get("x-forwarded-proto")?.split(",")[0].trim();
  const local = /^(localhost|127\.0\.0\.1|10\.0\.2\.2)(:|$)/.test(host);
  const proto = forwarded === "http" || forwarded === "https" ? forwarded : local ? "http" : "https";
  return `${proto}://${host}`;
}

/**
 * Looks for the APK. Locally (and on any Node host) it is a file in public/.
 * On Netlify/Vercel, public/ is served by the CDN and isn't on the function's
 * disk, so fall back to a HEAD request against our own origin.
 * ANDROID_APK_URL can point at an external download (e.g. a GitHub release).
 */
export async function getApkInfo(origin: string): Promise<ApkInfo> {
  const external = process.env.ANDROID_APK_URL?.trim();
  if (external) {
    const head = await headSize(external);
    return { available: true, href: external, size: head ?? undefined };
  }

  const href = origin + APK_PATH;
  const publicDir = join(process.cwd(), "public");
  try {
    const s = await stat(join(publicDir, APK_PATH));
    if (s.isFile() && s.size > 0) {
      const meta = await readMeta(join(publicDir, APK_META_PATH));
      return { available: true, href, size: s.size, version: meta.version, builtAt: meta.builtAt ?? s.mtime.toISOString() };
    }
  } catch {
    // not on disk — try over HTTP below
  }

  // On serverless hosts (Netlify, Vercel) public/ is served by the CDN and isn't
  // on the function's disk, so check over HTTP against our own origin.
  if (process.env.NODE_ENV === "production" || process.env.NETLIFY || process.env.VERCEL) {
    const size = await headSize(href);
    if (size !== null) {
      const meta = await fetchMeta(origin + APK_META_PATH);
      return { available: true, href, size: size || undefined, version: meta.version, builtAt: meta.builtAt };
    }
  }
  return { available: false, href };
}

async function readMeta(file: string): Promise<{ version?: string; builtAt?: string }> {
  try {
    const json = JSON.parse(await readFile(file, "utf8")) as Record<string, unknown>;
    return {
      version: typeof json.versionName === "string" ? json.versionName : undefined,
      builtAt: typeof json.builtAt === "string" ? json.builtAt : undefined,
    };
  } catch {
    return {};
  }
}

async function fetchMeta(url: string): Promise<{ version?: string; builtAt?: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000), next: { revalidate: 300 } });
    if (!res.ok) return {};
    const json = (await res.json()) as Record<string, unknown>;
    return {
      version: typeof json.versionName === "string" ? json.versionName : undefined,
      builtAt: typeof json.builtAt === "string" ? json.builtAt : undefined,
    };
  } catch {
    return {};
  }
}

/** Content-Length of a URL via HEAD, 0 if unknown, null if missing/unreachable. */
async function headSize(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000), next: { revalidate: 300 } });
    if (!res.ok) return null;
    return Number(res.headers.get("content-length") ?? 0) || 0;
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
