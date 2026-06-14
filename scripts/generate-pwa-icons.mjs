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

function paint(pixels, size, x, y, color) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  pixels[i] = color[0];
  pixels[i + 1] = color[1];
  pixels[i + 2] = color[2];
  pixels[i + 3] = color[3] ?? 255;
}

function makeIcon(size, maskable = false) {
  const pixels = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const safe = maskable ? size * 0.2 : size * 0.08;
  const gold = [219, 166, 54, 255];
  const goldDark = [164, 108, 28, 255];
  const goldLight = [252, 219, 120, 255];
  const cream = [250, 247, 238, 255];
  const ink = [20, 28, 24, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const dist = Math.hypot(x - center, y - center) / center;
      const shade = Math.min(1, dist * 0.62);
      pixels[i] = blend(18, 9, shade);
      pixels[i + 1] = blend(104, 65, shade);
      pixels[i + 2] = blend(91, 80, shade);
      pixels[i + 3] = 255;

      if (x > size * 0.62 && y < size * 0.4) {
        pixels[i] = 176;
        pixels[i + 1] = 60;
        pixels[i + 2] = 43;
      }
    }
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const bowlTop = size * 0.18;
      const bowlBottom = size * 0.56;
      const withinBowlY = y >= bowlTop && y <= bowlBottom;
      if (withinBowlY) {
        const t = (y - bowlTop) / (bowlBottom - bowlTop);
        const halfWidth = size * (0.26 - t * 0.09);
        if (Math.abs(dx) < halfWidth) {
          const shine = Math.max(0, 1 - Math.abs(x - size * 0.42) / (size * 0.18)) * 0.38;
          const shadow = Math.max(0, (x - center) / (size * 0.28)) * 0.32;
          paint(pixels, size, x, y, [
            blend(gold[0], goldLight[0], shine) - Math.round(shadow * 40),
            blend(gold[1], goldLight[1], shine) - Math.round(shadow * 28),
            blend(gold[2], goldLight[2], shine) - Math.round(shadow * 10),
            255,
          ]);
        }
      }

      const leftHandle = ((x - size * 0.31) / (size * 0.16)) ** 2 + ((y - size * 0.35) / (size * 0.2)) ** 2;
      const rightHandle = ((x - size * 0.69) / (size * 0.16)) ** 2 + ((y - size * 0.35) / (size * 0.2)) ** 2;
      const handleCut = ((x - center) / (size * 0.22)) ** 2 + ((y - size * 0.36) / (size * 0.24)) ** 2;
      if ((leftHandle < 1 && leftHandle > 0.58 && handleCut > 0.78) || (rightHandle < 1 && rightHandle > 0.58 && handleCut > 0.78)) {
        paint(pixels, size, x, y, gold);
      }

      if (x > center - size * 0.055 && x < center + size * 0.055 && y > size * 0.54 && y < size * 0.72) {
        paint(pixels, size, x, y, goldDark);
      }

      if (x > safe && x < size - safe && y > size * 0.7 && y < size * 0.8) {
        const inset = Math.abs(x - center) / (size * 0.31);
        if (inset < 1) paint(pixels, size, x, y, gold);
      }

      const ball = ((x - center) / (size * 0.18)) ** 2 + ((y - size * 0.8) / (size * 0.18)) ** 2;
      if (ball < 1) {
        paint(pixels, size, x, y, cream);
        const seamVertical = Math.abs(x - center) < size * 0.011;
        const seamLeft = Math.abs((x - center) + (y - size * 0.8) * 0.65) < size * 0.011;
        const seamRight = Math.abs((x - center) - (y - size * 0.8) * 0.65) < size * 0.011;
        if ((seamVertical || seamLeft || seamRight) && ball < 0.78) paint(pixels, size, x, y, ink);
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
