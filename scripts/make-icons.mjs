// 產生 PWA 圖示（PNG），不依賴任何外部套件。
// 圖樣：深色底、螢光綠同心圓與掃描扇形的簡單雷達。
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [5, 16, 10];
const GREEN = [57, 255, 122];

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x + 0.5, y + 0.5);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, t) => a.map((v, i) => Math.round(v + (GREEN[i] - v) * t));

// scale：雷達半徑佔圖示半寬的比例（maskable 圖示要留安全區）
function radar(size, scale) {
  const c = size / 2;
  const R = c * scale;
  const w = Math.max(1.5, size / 64);
  return (x, y) => {
    const dx = x - c;
    const dy = y - c;
    const d = Math.hypot(dx, dy);
    let t = 0;
    for (const [r, a] of [[R, 1], [R * 0.62, 0.6], [R * 0.25, 0.45]]) {
      t = Math.max(t, a * Math.max(0, 1 - Math.abs(d - r) / w));
    }
    if (d < R * 0.07) t = 1;
    if (d < R) {
      if (Math.abs(dx) < w * 0.5 || Math.abs(dy) < w * 0.5) t = Math.max(t, 0.25);
      // 掃描扇形：從正上方順時針 60 度，越往前越亮
      const ang = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI);
      const span = Math.PI / 3;
      if (ang < span) t = Math.max(t, 0.45 * (ang / span));
    }
    return mix(BG, Math.min(1, t));
  };
}

const out = new URL('../public/', import.meta.url);
writeFileSync(new URL('icon-192.png', out), png(192, radar(192, 0.86)));
writeFileSync(new URL('icon-512.png', out), png(512, radar(512, 0.86)));
writeFileSync(new URL('icon-maskable-512.png', out), png(512, radar(512, 0.66)));
writeFileSync(new URL('apple-touch-icon.png', out), png(180, radar(180, 0.8)));
console.log('icons written');
