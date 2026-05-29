#!/usr/bin/env node

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(root, "src-tauri", "icons");
const accent = [0xD4, 0xE8, 0x15, 0xFF];
const ink = [0x06, 0x06, 0x06, 0xFF];

const pngTargets = [
  ["icon.png", 512],
  ["32x32.png", 32],
  ["64x64.png", 64],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
  ["StoreLogo.png", 50],
  ["Square30x30Logo.png", 30],
  ["Square44x44Logo.png", 44],
  ["Square71x71Logo.png", 71],
  ["Square89x89Logo.png", 89],
  ["Square107x107Logo.png", 107],
  ["Square142x142Logo.png", 142],
  ["Square150x150Logo.png", 150],
  ["Square284x284Logo.png", 284],
  ["Square310x310Logo.png", 310],
  ["android/mipmap-mdpi/ic_launcher.png", 48],
  ["android/mipmap-mdpi/ic_launcher_foreground.png", 48],
  ["android/mipmap-mdpi/ic_launcher_round.png", 48],
  ["android/mipmap-hdpi/ic_launcher.png", 72],
  ["android/mipmap-hdpi/ic_launcher_foreground.png", 72],
  ["android/mipmap-hdpi/ic_launcher_round.png", 72],
  ["android/mipmap-xhdpi/ic_launcher.png", 96],
  ["android/mipmap-xhdpi/ic_launcher_foreground.png", 96],
  ["android/mipmap-xhdpi/ic_launcher_round.png", 96],
  ["android/mipmap-xxhdpi/ic_launcher.png", 144],
  ["android/mipmap-xxhdpi/ic_launcher_foreground.png", 144],
  ["android/mipmap-xxhdpi/ic_launcher_round.png", 144],
  ["android/mipmap-xxxhdpi/ic_launcher.png", 192],
  ["android/mipmap-xxxhdpi/ic_launcher_foreground.png", 192],
  ["android/mipmap-xxxhdpi/ic_launcher_round.png", 192],
  ["ios/AppIcon-20x20@1x.png", 20],
  ["ios/AppIcon-20x20@2x.png", 40],
  ["ios/AppIcon-20x20@2x-1.png", 40],
  ["ios/AppIcon-20x20@3x.png", 60],
  ["ios/AppIcon-29x29@1x.png", 29],
  ["ios/AppIcon-29x29@2x.png", 58],
  ["ios/AppIcon-29x29@2x-1.png", 58],
  ["ios/AppIcon-29x29@3x.png", 87],
  ["ios/AppIcon-40x40@1x.png", 40],
  ["ios/AppIcon-40x40@2x.png", 80],
  ["ios/AppIcon-40x40@2x-1.png", 80],
  ["ios/AppIcon-40x40@3x.png", 120],
  ["ios/AppIcon-60x60@2x.png", 120],
  ["ios/AppIcon-60x60@3x.png", 180],
  ["ios/AppIcon-76x76@1x.png", 76],
  ["ios/AppIcon-76x76@2x.png", 152],
  ["ios/AppIcon-83.5x83.5@2x.png", 167],
  ["ios/AppIcon-512@2x.png", 1024],
];

const cache = new Map();

for (const [relativePath, size] of pngTargets) {
  writePng(relativePath, size);
}

writeFileSync(path.join(iconsDir, "icon.ico"), createIco([16, 32, 48, 64, 128, 256]));
writeFileSync(path.join(iconsDir, "icon.icns"), createIcns());

function writePng(relativePath, size) {
  const filePath = path.join(iconsDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, png(size));
}

function png(size) {
  if (!cache.has(size)) {
    cache.set(size, encodePng(size, size, drawIcon(size)));
  }
  return cache.get(size);
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size;
  const square = {
    x: 0.08 * scale,
    y: 0.08 * scale,
    w: 0.84 * scale,
    h: 0.84 * scale,
    r: 0.19 * scale,
  };
  const h = {
    left: 0.34 * scale,
    right: 0.55 * scale,
    top: 0.30 * scale,
    bottom: 0.70 * scale,
    bar: 0.105 * scale,
    midTop: 0.455 * scale,
    midBottom: 0.545 * scale,
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const coverage = sampledCoverage(x, y, (sx, sy) => roundedRect(sx, sy, square));
      const index = (y * size + x) * 4;
      if (coverage > 0) {
        put(pixels, index, accent, coverage);
      }
      const hCoverage = sampledCoverage(x, y, (sx, sy) => letterH(sx, sy, h));
      if (hCoverage > 0) {
        put(pixels, index, ink, hCoverage);
      }
    }
  }
  return pixels;
}

function sampledCoverage(x, y, contains) {
  let hits = 0;
  const samples = 4;
  for (let sy = 0; sy < samples; sy += 1) {
    for (let sx = 0; sx < samples; sx += 1) {
      if (contains(x + (sx + 0.5) / samples, y + (sy + 0.5) / samples)) {
        hits += 1;
      }
    }
  }
  return hits / (samples * samples);
}

function roundedRect(x, y, rect) {
  const innerX = Math.max(rect.x + rect.r, Math.min(x, rect.x + rect.w - rect.r));
  const innerY = Math.max(rect.y + rect.r, Math.min(y, rect.y + rect.h - rect.r));
  return (x - innerX) ** 2 + (y - innerY) ** 2 <= rect.r ** 2;
}

function letterH(x, y, h) {
  return (
    (x >= h.left && x <= h.left + h.bar && y >= h.top && y <= h.bottom) ||
    (x >= h.right && x <= h.right + h.bar && y >= h.top && y <= h.bottom) ||
    (x >= h.left && x <= h.right + h.bar && y >= h.midTop && y <= h.midBottom)
  );
}

function put(pixels, index, color, alpha) {
  const sourceAlpha = alpha * (color[3] / 255);
  const destAlpha = pixels[index + 3] / 255;
  const outAlpha = sourceAlpha + destAlpha * (1 - sourceAlpha);
  if (outAlpha <= 0) {
    return;
  }
  for (let offset = 0; offset < 3; offset += 1) {
    const source = color[offset] / 255;
    const dest = pixels[index + offset] / 255;
    pixels[index + offset] = Math.round(((source * sourceAlpha) + (dest * destAlpha * (1 - sourceAlpha))) / outAlpha * 255);
  }
  pixels[index + 3] = Math.round(outAlpha * 255);
}

function encodePng(width, height, rgba) {
  const rowLength = width * 4 + 1;
  const raw = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * rowLength] = 0;
    rgba.copy(raw, y * rowLength + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk("IHDR", Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])])),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function createIco(sizes) {
  const images = sizes.map((size) => ({ size, data: png(size) }));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry[0] = image.size === 256 ? 0 : image.size;
    entry[1] = image.size === 256 ? 0 : image.size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.data.length;
    entries.push(entry);
  }
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

function createIcns() {
  const chunks = [
    icnsChunk("icp4", png(16)),
    icnsChunk("icp5", png(32)),
    icnsChunk("icp6", png(64)),
    icnsChunk("ic07", png(128)),
    icnsChunk("ic08", png(256)),
    icnsChunk("ic09", png(512)),
    icnsChunk("ic10", png(1024)),
    icnsChunk("ic11", png(32)),
    icnsChunk("ic12", png(64)),
    icnsChunk("ic13", png(256)),
    icnsChunk("ic14", png(512)),
  ];
  const size = 8 + chunks.reduce((sum, item) => sum + item.length, 0);
  return Buffer.concat([Buffer.from("icns"), u32(size), ...chunks]);
}

function icnsChunk(type, data) {
  return Buffer.concat([Buffer.from(type), u32(data.length + 8), data]);
}

function chunk(type, data) {
  return Buffer.concat([u32(data.length), Buffer.from(type), data, u32(crc32(Buffer.concat([Buffer.from(type), data])))]);
}

function u32(value) {
  const buffer = Buffer.alloc(4);
  buffer.writeUInt32BE(value >>> 0, 0);
  return buffer;
}

function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
