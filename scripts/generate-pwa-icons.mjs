import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const outDir = new URL("../public/icons/", import.meta.url);
const iconVersion = "v27";

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    rows[rowStart] = 0;
    pixels.copy(rows, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function blend(a, b, amount) {
  return Math.round(a + (b - a) * amount);
}

function paint(pixels, size, x, y, color) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3] ?? 255;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleDiff(a, b) {
  let diff = a - b;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function inBlade(angle, radius, direction, width = 0.18) {
  const curve = direction + (radius - 0.4) * 1.25;
  return radius > 0.18 && radius < 0.92 && Math.abs(angleDiff(angle, curve)) < width + radius * 0.08;
}

function makeIcon(size, maskable = false) {
  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const cy = size * 0.47;
  const safe = maskable ? size * 0.22 : size * 0.1;
  const radius = size * 0.5 - safe;
  const red = [226, 35, 26, 255];
  const green = [28, 218, 58, 255];
  const gold = [222, 154, 44, 255];
  const navy = [15, 28, 62, 255];
  const black = [23, 30, 25, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const shadow = ((x - center) / (radius * 0.72)) ** 2 + ((y - size * 0.84) / (radius * 0.14)) ** 2;
      if (shadow < 1) {
        const alpha = Math.round((1 - shadow) * 80);
        paint(pixels, size, x, y, [150, 150, 150, alpha]);
      }

      const dx = x - center;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) continue;

      const r = dist / radius;
      const angle = Math.atan2(dy, dx);
      const shade = clamp(r * 0.3 + Math.max(0, (x - center) / radius) * 0.09 + Math.max(0, (y - cy) / radius) * 0.1, 0, 0.5);
      let color = [blend(252, 210, shade), blend(252, 216, shade), blend(248, 224, shade), 255];

      if (r > 0.96) color = [185, 188, 184, 255];
      if (inBlade(angle, r, -2.25, 0.16) || inBlade(angle, r, -0.12, 0.17) || inBlade(angle, r, 2.02, 0.17)) color = black;
      if (inBlade(angle, r, -2.78, 0.08) && r > 0.44) color = red;
      if (inBlade(angle, r, 1.43, 0.08) && r > 0.58) color = green;
      if (inBlade(angle, r, -0.65, 0.07) && r > 0.62) color = gold;

      const upperNavy = ((x - size * 0.2) / (radius * 0.16)) ** 2 + ((y - size * 0.22) / (radius * 0.09)) ** 2;
      const lowerNavy = ((x - size * 0.15) / (radius * 0.16)) ** 2 + ((y - size * 0.69) / (radius * 0.08)) ** 2;
      const rightNavy = ((x - size * 0.86) / (radius * 0.11)) ** 2 + ((y - size * 0.32) / (radius * 0.12)) ** 2;
      if (upperNavy < 1 || lowerNavy < 1 || rightNavy < 1) color = navy;

      const highlight = ((x - size * 0.36) / (radius * 0.32)) ** 2 + ((y - size * 0.29) / (radius * 0.24)) ** 2;
      if (highlight < 1 && color[0] > 180) color = [blend(color[0], 255, 0.34), blend(color[1], 255, 0.34), blend(color[2], 255, 0.34), 255];

      paint(pixels, size, x, y, color);
    }
  }

  return writePng(size, size, pixels);
}

await mkdir(outDir, { recursive: true });
await writeFile(new URL("icon-192.png", outDir), makeIcon(192));
await writeFile(new URL("icon-512.png", outDir), makeIcon(512));
await writeFile(new URL("maskable-512.png", outDir), makeIcon(512, true));
await writeFile(new URL("apple-touch-icon.png", outDir), makeIcon(180));
await writeFile(new URL("page-ball.png", outDir), makeIcon(256));
await writeFile(new URL(`icon-192-${iconVersion}.png`, outDir), makeIcon(192));
await writeFile(new URL(`icon-512-${iconVersion}.png`, outDir), makeIcon(512));
await writeFile(new URL(`maskable-512-${iconVersion}.png`, outDir), makeIcon(512, true));
await writeFile(new URL(`apple-touch-icon-${iconVersion}.png`, outDir), makeIcon(180));
await writeFile(new URL(`page-ball-${iconVersion}.png`, outDir), makeIcon(256));

console.log("Generated PWA icons");
