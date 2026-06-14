import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const outDir = new URL("../public/icons/", import.meta.url);

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

function makeIcon(size, maskable = false) {
  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const safe = maskable ? size * 0.19 : size * 0.08;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const dist = Math.hypot(x - center, y - center) / center;
      const shade = Math.min(1, dist * 0.55);
      pixels[i] = blend(20, 9, shade);
      pixels[i + 1] = blend(107, 55, shade);
      pixels[i + 2] = blend(98, 92, shade);
      pixels[i + 3] = 255;

      if (x > size * 0.58 && y < size * 0.46) {
        pixels[i] = 157;
        pixels[i + 1] = 53;
        pixels[i + 2] = 92;
      }

      if (x > safe && x < size - safe && y > size * 0.66 && y < size * 0.76) {
        pixels[i] = 208;
        pixels[i + 1] = 155;
        pixels[i + 2] = 44;
      }

      const fieldX = Math.abs(x - center) / (size * 0.28);
      const fieldY = Math.abs(y - size * 0.46) / (size * 0.19);
      if (fieldX * fieldX + fieldY * fieldY < 1) {
        pixels[i] = 246;
        pixels[i + 1] = 243;
        pixels[i + 2] = 237;
      }

      const line = Math.abs(x - center) < size * 0.015 || Math.abs(y - size * 0.46) < size * 0.012;
      if (line && fieldX * fieldX + fieldY * fieldY < 0.8) {
        pixels[i] = 23;
        pixels[i + 1] = 32;
        pixels[i + 2] = 27;
      }
    }
  }

  return writePng(size, size, pixels);
}

await mkdir(outDir, { recursive: true });
await writeFile(new URL("icon-192.png", outDir), makeIcon(192));
await writeFile(new URL("icon-512.png", outDir), makeIcon(512));
await writeFile(new URL("maskable-512.png", outDir), makeIcon(512, true));
await writeFile(new URL("apple-touch-icon.png", outDir), makeIcon(180));

console.log("Generated PWA icons");
