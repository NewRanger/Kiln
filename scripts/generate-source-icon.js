// One-off generator for build-resources/icon.png — a 1024x1024 placeholder
// (dark rounded square with a white "K"). Uses only Node built-ins (zlib, fs)
// to write a raw PNG, so no extra image library is required.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SIZE = 1024;
const RADIUS = 192;
const PADDING = 64;

const DARK = [0x1f, 0x1f, 0x1d, 0xff];
const WHITE = [0xff, 0xff, 0xff, 0xff];
const TRANSPARENT = [0, 0, 0, 0];

const sqL = PADDING;
const sqT = PADDING;
const sqR = SIZE - PADDING;
const sqB = SIZE - PADDING;
const cx = SIZE / 2;
const cy = SIZE / 2;

const kHeight = (sqB - sqT) * 0.6;
const kStroke = kHeight * 0.14;
const kVx = cx - kHeight * 0.2;
const kArmEnd = kVx + kHeight * 0.45;

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function inRoundedSquare(x, y) {
  if (x < sqL || x > sqR || y < sqT || y > sqB) return false;
  if (x < sqL + RADIUS && y < sqT + RADIUS) {
    const dx = x - (sqL + RADIUS);
    const dy = y - (sqT + RADIUS);
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  }
  if (x > sqR - RADIUS && y < sqT + RADIUS) {
    const dx = x - (sqR - RADIUS);
    const dy = y - (sqT + RADIUS);
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  }
  if (x < sqL + RADIUS && y > sqB - RADIUS) {
    const dx = x - (sqL + RADIUS);
    const dy = y - (sqB - RADIUS);
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  }
  if (x > sqR - RADIUS && y > sqB - RADIUS) {
    const dx = x - (sqR - RADIUS);
    const dy = y - (sqB - RADIUS);
    return dx * dx + dy * dy <= RADIUS * RADIUS;
  }
  return true;
}

function inK(x, y) {
  const halfStroke = kStroke / 2;
  if (distToSegment(x, y, kVx, cy - kHeight / 2, kVx, cy + kHeight / 2) <= halfStroke) return true;
  if (distToSegment(x, y, kVx, cy, kArmEnd, cy - kHeight / 2) <= halfStroke) return true;
  if (distToSegment(x, y, kVx, cy, kArmEnd, cy + kHeight / 2) <= halfStroke) return true;
  return false;
}

function colorAt(x, y) {
  if (!inRoundedSquare(x, y)) return TRANSPARENT;
  if (inK(x, y)) return WHITE;
  return DARK;
}

const crcTable = new Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const checkData = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(checkData), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

const rowBytes = 1 + SIZE * 4;
const raw = Buffer.alloc(rowBytes * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * rowBytes] = 0;
  for (let x = 0; x < SIZE; x++) {
    const i = y * rowBytes + 1 + x * 4;
    const [r, g, b, a] = colorAt(x, y);
    raw[i] = r;
    raw[i + 1] = g;
    raw[i + 2] = b;
    raw[i + 3] = a;
  }
}

const compressed = zlib.deflateSync(raw);

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  sig,
  makeChunk('IHDR', ihdr),
  makeChunk('IDAT', compressed),
  makeChunk('IEND', Buffer.alloc(0))
]);

const outDir = path.resolve(__dirname, '..', 'build-resources');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), png);
console.log(`Generated build-resources/icon.png (${SIZE}x${SIZE})`);
