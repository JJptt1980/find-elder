// 產生 PWA 圖示（PNG）：從 design/icon-elder.svg 轉檔。
// 轉檔用 macOS 內建的 qlmanage，所以只能在 Mac 上跑；產出的 PNG 會 commit 進 public/。
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = readFileSync(join(root, 'design/icon-elder.svg'), 'utf8');
// maskable 用的內層：拿掉天空和海的底色（改由外層畫），避免縮放後邊緣出現接縫
const inner = src
  .replace(/^<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<rect[^>]*fill="url\(#(sky|sea)\)"\/>/g, '');

// maskable：畫面縮到 80% 放在安全區內，外圍用同樣的天空與海延伸，接縫看不出來
const S = 0.8;
const off = (512 * (1 - S)) / 2;
const horizon = off + 378 * S;
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="oSky" gradientUnits="userSpaceOnUse" x1="0" y1="${off}" x2="0" y2="${512 - off}">
      <stop offset="0" stop-color="#0b3b36"/><stop offset="0.55" stop-color="#2f8f6a"/><stop offset="1" stop-color="#b8e07a"/>
    </linearGradient>
    <linearGradient id="oSea" gradientUnits="userSpaceOnUse" x1="0" y1="${horizon}" x2="0" y2="${512 - off}">
      <stop offset="0" stop-color="#3fa58c"/><stop offset="1" stop-color="#0f4a43"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#oSky)"/>
  <rect y="${horizon}" width="512" height="${512 - horizon}" fill="url(#oSea)"/>
  <svg x="${off}" y="${off}" width="${512 * S}" height="${512 * S}" viewBox="0 0 512 512">${inner}</svg>
</svg>`;

const tmp = mkdtempSync(join(tmpdir(), 'fe-icons-'));
function render(svg, size, out) {
  const f = join(tmp, 'icon.svg');
  writeFileSync(f, svg);
  execFileSync('qlmanage', ['-t', '-s', String(size), '-o', tmp, f], { stdio: 'ignore' });
  renameSync(join(tmp, 'icon.svg.png'), join(root, 'public', out));
}

render(src, 192, 'icon-192.png');
render(src, 512, 'icon-512.png');
render(src, 180, 'apple-touch-icon.png');
render(maskable, 512, 'icon-maskable-512.png');
rmSync(tmp, { recursive: true });
console.log('icons written');
