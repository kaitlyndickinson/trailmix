// Regenerates the PWA / favicon PNGs from scripts/icon.svg.
// Usage: node scripts/generate-icons.mjs
import { readFile, copyFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("./icon.svg", import.meta.url));

const outputs = [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["src/app/apple-icon.png", 180],
];

for (const [path, size] of outputs) {
  await sharp(svg).resize(size, size).png().toFile(path);
}

// The glyph already sits inside the maskable safe zone (center 80%),
// so the maskable icon is the same image.
await copyFile(
  "public/icons/icon-512.png",
  "public/icons/icon-maskable-512.png",
);
await copyFile(new URL("./icon.svg", import.meta.url), "src/app/icon.svg");
