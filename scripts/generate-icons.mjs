// Generates the EduConnect AI app icons (PWA + Android launcher PNGs) from one
// SVG definition: a white sparkle on the coral → pink brand gradient.
//
//   node scripts/generate-icons.mjs
//
// Uses `sharp` (installed with Next.js) to rasterise. Output is committed, so
// this only needs re-running when the mark changes. The Android adaptive icon
// itself is a vector drawable (android/app/src/main/res/drawable/ic_launcher_*.xml);
// the PNGs written here are the legacy fallbacks for Android 7.x.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.error("This script needs `sharp` (normally installed with Next.js). Run `npm install` and try again.");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Sparkle mark, 24×24 units, centred on (12,12).
const GLYPH = [
  "M11 4c.7 4.9 4.1 8.3 9 9-4.9.7-8.3 4.1-9 9-.7-4.9-4.1-8.3-9-9 4.9-.7 8.3-4.1 9-9z",
  "M19.5 2c.25 1.3 1.2 2.25 2.5 2.5-1.3.25-2.25 1.2-2.5 2.5-.25-1.3-1.2-2.25-2.5-2.5 1.3-.25 2.25-1.2 2.5-2.5z",
];

/**
 * @param {object} o
 * @param {"square"|"rounded"|"circle"} o.shape  background shape
 * @param {number} o.glyph  glyph size as a fraction of the icon
 * @param {number} [o.inset] background inset as a fraction (legacy launcher padding)
 */
function iconSvg({ shape, glyph, inset = 0 }) {
  const S = 512;
  const pad = S * inset;
  const w = S - pad * 2;
  const bg =
    shape === "circle"
      ? `<circle cx="${S / 2}" cy="${S / 2}" r="${w / 2}" fill="url(#g)"/>`
      : `<rect x="${pad}" y="${pad}" width="${w}" height="${w}" rx="${shape === "rounded" ? w * 0.225 : 0}" fill="url(#g)"/>`;
  const scale = (S * glyph) / 20; // glyph bbox is 20 units wide (2..22)
  const t = S / 2 - 12 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f25c5c"/>
      <stop offset="0.55" stop-color="#e8466b"/>
      <stop offset="1" stop-color="#fb87ab"/>
    </linearGradient>
  </defs>
  ${bg}
  <g transform="translate(${t} ${t}) scale(${scale})" fill="#ffffff">${GLYPH.map((d) => `<path d="${d}"/>`).join("")}</g>
</svg>
`;
}

async function png(svg, size, file) {
  const out = join(root, file);
  mkdirSync(dirname(out), { recursive: true });
  await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(out);
  console.log(`  ${file} (${size}×${size})`);
}

function svgFile(svg, file) {
  const out = join(root, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, svg);
  console.log(`  ${file}`);
}

const rounded = iconSvg({ shape: "rounded", glyph: 0.56 });
const fullBleed = iconSvg({ shape: "square", glyph: 0.56 });
// Maskable: the glyph stays inside the 80 % safe circle.
const maskable = iconSvg({ shape: "square", glyph: 0.44 });

console.log("Web / PWA icons:");
svgFile(rounded, "src/app/icon.svg"); // <link rel="icon"> via the Next.js file convention
await png(fullBleed, 180, "src/app/apple-icon.png"); // iOS rounds the corners itself
await png(rounded, 192, "public/icons/icon-192.png");
await png(rounded, 512, "public/icons/icon-512.png");
await png(maskable, 192, "public/icons/maskable-192.png");
await png(maskable, 512, "public/icons/maskable-512.png");

console.log("Android legacy launcher icons (API < 26):");
const res = "android/app/src/main/res";
const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const legacy = iconSvg({ shape: "rounded", glyph: 0.46, inset: 0.08 });
const legacyRound = iconSvg({ shape: "circle", glyph: 0.46, inset: 0.04 });
for (const [d, size] of Object.entries(densities)) {
  await png(legacy, size, `${res}/mipmap-${d}/ic_launcher.png`);
  await png(legacyRound, size, `${res}/mipmap-${d}/ic_launcher_round.png`);
}
console.log("Done.");
