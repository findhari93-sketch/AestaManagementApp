import sharp from "sharp";
import path from "path";
import { mkdir } from "fs/promises";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "public", "favicon.png");
const OUT_DIR = path.join(ROOT, "public", "icons");

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

await mkdir(OUT_DIR, { recursive: true });

// Standard icons
for (const size of SIZES) {
  await sharp(SOURCE)
    .resize(size, size, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toFile(path.join(OUT_DIR, `icon-${size}x${size}.png`));
  console.log(`Generated icon-${size}x${size}.png`);
}

// Apple touch icon (180x180 with white background)
await sharp(SOURCE)
  .resize(160, 160, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .extend({
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .resize(180, 180)
  .png()
  .toFile(path.join(OUT_DIR, "apple-touch-icon.png"));
console.log("Generated apple-touch-icon.png");

// Maskable icons (safe zone = 60% of canvas, #1976d2 background)
for (const size of [192, 512]) {
  const iconSize = Math.floor(size * 0.6);
  const padding = Math.floor((size - iconSize) / 2);
  await sharp(SOURCE)
    .resize(iconSize, iconSize, {
      fit: "contain",
      background: { r: 25, g: 118, b: 210, alpha: 1 },
    })
    .extend({
      top: padding,
      bottom: size - iconSize - padding,
      left: padding,
      right: size - iconSize - padding,
      background: { r: 25, g: 118, b: 210, alpha: 1 },
    })
    .png()
    .toFile(path.join(OUT_DIR, `maskable-icon-${size}x${size}.png`));
  console.log(`Generated maskable-icon-${size}x${size}.png`);
}

console.log("\nAll icons generated successfully!");
