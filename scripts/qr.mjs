// Print-ready QR code for installing the EduConnect AI Android app.
//
//   node scripts/qr.mjs https://your-project.vercel.app      # or
//   APP_URL=https://your-project.vercel.app node scripts/qr.mjs
//
// The code points to <origin>/install (instructions + one-tap APK download).
// Pass a full URL with a path (e.g. …/downloads/educonnect.apk) to encode it as is.
// Writes public/install-qr.svg (vector, for print) and public/install-qr.png (1200 px).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const input = (process.argv[2] ?? process.env.APP_URL ?? "").trim();
if (!input) {
  console.error("Usage: node scripts/qr.mjs <https://your-app-url>   (or set APP_URL)");
  process.exit(1);
}

let url;
try {
  url = new URL(input);
} catch {
  console.error(`Not a valid URL: ${input}`);
  process.exit(1);
}
if (url.pathname === "/" && !url.search) url.pathname = "/install";
if (url.protocol !== "https:") {
  console.warn(`⚠ ${url.href} is not https — phones outside your machine can't open it. Use your Vercel URL for printing.`);
}
const target = url.href;

const options = {
  errorCorrectionLevel: "M",
  margin: 4, // the standard 4-module quiet zone
  color: { dark: "#b42d35", light: "#ffffff" }, // brand coral (dark shade, ≥ 6:1 contrast for reliable scanning)
};

const svg = await QRCode.toString(target, { ...options, type: "svg" });
writeFileSync(join(root, "public/install-qr.svg"), svg);
await QRCode.toFile(join(root, "public/install-qr.png"), target, { ...options, type: "png", width: 1200 });

console.log(`QR code for ${target}`);
console.log("  public/install-qr.svg  (vector — best for print)");
console.log("  public/install-qr.png  (1200 × 1200 px)");
console.log("Print at least 3 × 3 cm; test-scan before printing in bulk.");
