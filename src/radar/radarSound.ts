// 雷達縮放按鈕的音效：用 Web Audio 現場合成（喀一聲＋三聲嗶），沒有任何音檔。
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/**
 * 手機瀏覽器要使用者先點過畫面才准發出聲音。啟動時掛一個監聽：
 * 第一次點到畫面任何地方就把音效解鎖，之後靠近目標的嗶嗶聲（由 GPS 觸發）才響得出來。
 */
export function installAudioUnlock(): void {
  const unlock = () => {
    const a = audio();
    if (!a) return;
    // 播一段無聲的音，確保解鎖
    const src = a.createBufferSource();
    src.buffer = a.createBuffer(1, 1, a.sampleRate);
    src.connect(a.destination);
    src.start();
    if (a.state === 'running') {
      removeEventListener('pointerdown', unlock, true);
      removeEventListener('keydown', unlock, true);
    }
  };
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);
}

/** 按下去的「喀」：很短的高頻雜訊 */
function click(a: AudioContext, t: number) {
  const len = Math.round(a.sampleRate * 0.025);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = a.createBufferSource();
  src.buffer = buf;
  const hp = a.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1800;
  const g = a.createGain();
  g.gain.value = 0.9;
  src.connect(hp).connect(g).connect(a.destination);
  src.start(t);
}

function beep(a: AudioContext, t: number, freq: number, dur = 0.07) {
  const o = a.createOscillator();
  o.type = 'square';
  o.frequency.value = freq;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3500;
  const g = a.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12, t + 0.005);
  g.gain.setValueAtTime(0.12, t + dur - 0.01);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(lp).connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.01);
}

/** 靠近目標：越近嗶越多、越快、越高（band 1～3） */
export function playNear(band: number): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  const n = [0, 2, 3, 5][band] ?? 2;
  const gap = [0, 0.22, 0.16, 0.1][band] ?? 0.2;
  const freq = 1900 + band * 250;
  for (let i = 0; i < n; i++) beep(a, t + i * gap, freq, 0.06);
}

/** stage：放大後是第幾段（0 = 回到全範圍）。段數越高，嗶聲越高 */
export function playZoom(stage: number): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  click(a, t);
  const base = stage === 0 ? 1500 : 1700 + stage * 300;
  for (let i = 0; i < 3; i++) beep(a, t + 0.14 + i * 0.13, base);
}

/** 撿到寶物：往上爬的四個音，最後一個拉長 */
export function playCollect(): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  [1318, 1568, 1976, 2637].forEach((f, i) => beep(a, t + i * 0.09, f, i === 3 ? 0.28 : 0.08));
}
