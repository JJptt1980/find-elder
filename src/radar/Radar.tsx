// 雷達元件（從 DB-radar 拆出來）：圓形螢幕、方格底、黃色光點是目標、中間紅色三角形是自己。全部用 Canvas 畫。
// 只認得「目標點」：位置、名字、要不要特別標示。目標代表什麼由各模式決定。
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { bearingDeg, distanceM, type LatLon } from './geo';
import { clampRange, clusterDots, clusterRadius, fitRange, nextZoom, niceStep, zoomStage, type Placed } from './radarZoom';
import { playZoom } from './radarSound';
import { useTilt } from './useTilt';

/** 不是從主畫面圖示打開（一般瀏覽器分頁） */
export const inBrowser = (): boolean =>
  !matchMedia('(display-mode: standalone)').matches && !matchMedia('(display-mode: fullscreen)').matches && !(navigator as Navigator & { standalone?: boolean }).standalone;

export interface Target extends LatLon {
  id: string;
  /** 在雷達上點旁邊顯示的短名字（showLabels 時才畫） */
  label?: string;
  /** 分數越高越亮、群聚時當代表；沒給就一樣亮 */
  score?: number;
}

export interface Seen<T extends Target> {
  t: T;
  distM: number;
  bearing: number;
}

/** 從 me 看每個目標的距離、方位，近的排前面 */
export function look<T extends Target>(me: LatLon, targets: readonly T[]): Seen<T>[] {
  return targets
    .map((t) => ({ t, distM: distanceM(me, t), bearing: bearingDeg(me, t) }))
    .sort((a, b) => a.distM - b.distM);
}

/** 螢幕上距離這麼近的點合成一個 */
const CLUSTER_PX = 30;

const COLORS = {
  screen: '#1d6b35',
  grid: 'rgba(5, 30, 14, 0.75)',
  ring: 'rgba(200, 255, 210, 0.4)',
  label: 'rgba(225, 255, 230, 0.9)',
  dot: '#ffd23f',
  best: '#fff3a0',
  me: '#ff3b30',
  sweep: 'rgba(160, 255, 180, 0.22)',
};

/** 白色外殼：上方受光較亮、下方較暗，加一道高光和落在桌面上的陰影 */
function drawBezel(ctx: CanvasRenderingContext2D, c: number, Ro: number, R: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  const body = ctx.createLinearGradient(0, c - Ro, 0, c + Ro);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.55, '#eef0f2');
  body.addColorStop(1, '#c9cdd1');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(c, c, Ro, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, Ro, 0, Math.PI * 2);
  ctx.arc(c, c, R + 3, 0, Math.PI * 2, true);
  ctx.clip();
  const shine = ctx.createRadialGradient(c - Ro * 0.45, c - Ro * 0.55, 0, c - Ro * 0.45, c - Ro * 0.55, Ro * 1.1);
  shine.addColorStop(0, 'rgba(255,255,255,0.95)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(c - Ro, c - Ro, Ro * 2, Ro * 2);
  ctx.restore();

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.beginPath();
  ctx.arc(c, c, Ro - 0.5, 0, Math.PI * 2);
  ctx.stroke();

  const rim = ctx.createLinearGradient(0, c - R, 0, c + R);
  rim.addColorStop(0, '#5d6469');
  rim.addColorStop(1, '#a7adb2');
  ctx.lineWidth = 3;
  ctx.strokeStyle = rim;
  ctx.beginPath();
  ctx.arc(c, c, R + 1.5, 0, Math.PI * 2);
  ctx.stroke();
}

/** 玻璃：左上一片淡淡的反光，邊緣一圈內陰影 */
function drawGlass(ctx: CanvasRenderingContext2D, c: number, R: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, R, 0, Math.PI * 2);
  ctx.clip();
  const edge = ctx.createRadialGradient(c, c, R * 0.82, c, c, R);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,20,8,0.45)');
  ctx.fillStyle = edge;
  ctx.fillRect(c - R, c - R, R * 2, R * 2);
  const glare = ctx.createLinearGradient(c - R, c - R, c, c);
  glare.addColorStop(0, 'rgba(255,255,255,0.16)');
  glare.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glare;
  ctx.beginPath();
  ctx.ellipse(c - R * 0.25, c - R * 0.35, R * 0.75, R * 0.45, -Math.PI / 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function Radar<T extends Target>(props: {
  me: LatLon | null;
  targets: readonly T[];
  /** 要閃爍、範圍外也貼在邊緣指方向的那一個 */
  bestId?: string | null;
  heading: number | null;
  maxKm: number;
  showLabels?: boolean;
  /** 自動放大到剛好看得到最近幾個點；關掉就從最大範圍（看得到全部）開始 */
  autoFit?: boolean;
  sound: boolean;
  onPick?: (t: T, count: number) => void;
  children?: ComponentChildren;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  useTilt(boxRef, true);
  const latest = useRef(props);
  latest.current = props;
  const placed = useRef<{ t: T; count: number; x: number; y: number }[]>([]);
  const zoom = useRef({ target: props.maxKm, shown: props.maxKm });
  const userZoomed = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; range: number } | null>(null);
  const [pressed, setPressed] = useState(0);

  // 換了目標（或第一次定位）時，自動選一個看得到點的範圍；換模式時 key 會換，userZoomed 也跟著重來
  const hasMe = !!props.me;
  useEffect(() => {
    const me = latest.current.me;
    if (userZoomed.current || !me || !props.targets.length || props.autoFit === false) {
      if (!userZoomed.current) zoom.current.target = props.maxKm;
      return;
    }
    const seen = look(me, props.targets);
    const best = seen.find((s) => s.t.id === props.bestId);
    zoom.current.target = fitRange(
      seen.map((s) => s.distM / 1000),
      best ? best.distM / 1000 : null,
      props.maxKm,
    );
  }, [props.targets, props.bestId, props.maxKm, hasMe, props.autoFit]);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let size = 0;
    let last = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const wrap = canvas.parentElement!.parentElement!;
      // 加到主畫面（全螢幕）時一個畫面放得下，照剩下的高度畫；
      // 用網址在瀏覽器裡打開時高度被網址列吃掉，改成跟螢幕一樣寬，頁面可以往下滑（滑了網址列也會收起來）
      const limit = inBrowser() ? wrap.clientWidth : Math.min(wrap.clientWidth, wrap.clientHeight);
      size = Math.max(200, Math.min(limit, 560));
      canvas.style.width = canvas.style.height = `${size}px`;
      canvas.parentElement!.style.setProperty('--s', `${size}px`);
      canvas.width = canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    addEventListener('resize', resize);
    const ro = new ResizeObserver(() => resize());
    ro.observe(canvas.parentElement!.parentElement!);

    const draw = (now: number) => {
      const p = latest.current;
      const z = zoom.current;
      z.target = clampRange(z.target, p.maxKm);
      const dt = Math.min(100, now - last);
      last = now;
      const k = 1 - Math.exp(-dt / 160);
      z.shown = Math.exp(Math.log(z.shown) + (Math.log(z.target) - Math.log(z.shown)) * k);
      if (Math.abs(Math.log(z.shown / z.target)) < 0.002) z.shown = z.target;
      const range = z.shown;

      const c = size / 2;
      const Ro = c - 1;
      const bezel = Math.max(8, size * 0.035);
      const R = Ro - bezel;
      const pxPerKm = R / range;
      const rot = ((p.heading ?? 0) * Math.PI) / 180;
      ctx.clearRect(0, 0, size, size);
      drawBezel(ctx, c, Ro, R);

      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, R, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.screen;
      ctx.fill();
      ctx.clip();

      // 方格：格子大小跟著範圍換成好讀的距離，跟著方向轉
      const gridKm = niceStep(range / 5);
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(-rot);
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1.5;
      const span = Math.ceil((range * 1.5) / gridKm);
      for (let i = -span; i <= span; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridKm * pxPerKm, -R * 1.5);
        ctx.lineTo(i * gridKm * pxPerKm, R * 1.5);
        ctx.moveTo(-R * 1.5, i * gridKm * pxPerKm);
        ctx.lineTo(R * 1.5, i * gridKm * pxPerKm);
        ctx.stroke();
      }
      ctx.restore();

      // 距離圈
      const ringKm = niceStep(range / 3);
      ctx.strokeStyle = COLORS.ring;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.fillStyle = COLORS.label;
      ctx.font = '13px system-ui, sans-serif';
      for (let km = ringKm; km <= range + 1e-9; km += ringKm) {
        ctx.beginPath();
        ctx.arc(c, c, km * pxPerKm, 0, Math.PI * 2);
        ctx.stroke();
        const label = km < 1 ? `${Math.round(km * 1000)} m` : `${+km.toFixed(2)} km`;
        ctx.fillText(label, c + km * pxPerKm - ctx.measureText(label).width - 4, c - 5);
      }
      ctx.setLineDash([]);

      // 掃描線
      const a = ((now % 3000) / 3000) * Math.PI * 2 - Math.PI / 2;
      const g = ctx.createConicGradient?.(a - Math.PI / 3, c, c);
      if (g) {
        g.addColorStop(0, 'rgba(160,255,180,0)');
        g.addColorStop(1 / 6, COLORS.sweep);
        g.addColorStop(1 / 6 + 0.001, 'rgba(160,255,180,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.arc(c, c, R, a - Math.PI / 3, a);
        ctx.fill();
      }

      // 目標：範圍外的不畫（標示的那一個例外，貼在邊緣指出方向），附近的合成一個點
      const pts: Placed<T>[] = [];
      if (p.me) {
        for (const s of look(p.me, p.targets)) {
          const km = s.distM / 1000;
          const isBest = p.bestId === s.t.id;
          if (km > range && !isBest) continue;
          const r = Math.min(R - 12, km * pxPerKm);
          const ang = ((s.bearing - (p.heading ?? 0)) * Math.PI) / 180;
          pts.push({ item: s.t, x: c + r * Math.sin(ang), y: c - r * Math.cos(ang), score: s.t.score ?? 1 });
        }
      }
      const clusters = clusterDots(pts, CLUSTER_PX);
      placed.current = [];
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      for (const cl of clusters) {
        const t = cl.best;
        placed.current.push({ t, count: cl.count, x: cl.x, y: cl.y });
        const isBest = p.bestId === t.id;
        const blink = isBest ? 0.55 + 0.45 * Math.abs(Math.sin(now / 350)) : 1;
        const rad = clusterRadius(cl.count);
        ctx.globalAlpha = blink;
        ctx.beginPath();
        ctx.arc(cl.x, cl.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = isBest ? COLORS.best : COLORS.dot;
        ctx.fill();
        if (isBest) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = COLORS.dot;
          ctx.beginPath();
          ctx.arc(cl.x, cl.y, rad + 6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (p.showLabels && t.label) {
          const text = cl.count > 1 ? `${t.label} +${cl.count - 1}` : t.label;
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(5, 30, 14, 0.85)';
          ctx.strokeText(text, cl.x + rad + 6, cl.y);
          ctx.fillStyle = '#fffbe0';
          ctx.fillText(text, cl.x + rad + 6, cl.y);
        }
      }
      ctx.textBaseline = 'alphabetic';
      ctx.restore();

      drawGlass(ctx, c, R);

      // 北方標示
      const nA = -rot;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', c + (R - 16) * Math.sin(nA), c - (R - 16) * Math.cos(nA));
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

      // 自己：紅色三角形（還沒定位時變淡）
      ctx.save();
      ctx.translate(c, c);
      ctx.globalAlpha = p.me ? 1 : 0.35 + 0.25 * Math.abs(Math.sin(now / 500));
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(11, 10);
      ctx.lineTo(-11, 10);
      ctx.closePath();
      ctx.fillStyle = COLORS.me;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
      ro.disconnect();
    };
  }, []);

  const onClick = (e: MouseEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let best: { t: T; count: number; d: number } | null = null;
    for (const p of placed.current) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < 32 && (!best || d < best.d)) best = { t: p.t, count: p.count, d };
    }
    if (best) props.onPick?.(best.t, best.count);
  };

  const spread = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const onPointerDown = (e: PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      pinch.current = { dist: spread(), range: zoom.current.target };
      userZoomed.current = true;
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pc = pinch.current;
    const d = spread();
    if (pc && d > 0) {
      const km = clampRange((pc.range * pc.dist) / d, latest.current.maxKm);
      zoom.current.target = zoom.current.shown = km;
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  const onZoomButton = () => {
    const z = zoom.current;
    z.target = nextZoom(z.target, props.maxKm);
    userZoomed.current = true;
    if (props.sound) playZoom(zoomStage(z.target, props.maxKm));
    try {
      navigator.vibrate?.(20);
    } catch {
      // 不支援震動就算了
    }
    setPressed((n) => n + 1);
  };

  return (
    <div class="radar-wrap">
      <div class="radar-box" ref={boxRef}>
        <canvas
          ref={ref}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="雷達"
        />
        {props.children}
      </div>
      <button
        key={pressed}
        type="button"
        class={`radar-zoom zoom-bc${pressed ? ' pressed' : ''}`}
        onClick={onZoomButton}
        aria-label="切換雷達範圍"
      >
        <span class="body" />
        <span class="cap" />
      </button>
    </div>
  );
}
