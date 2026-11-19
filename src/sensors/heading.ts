// 方向：走路時手機朝哪裡就是哪裡，所以優先用指南針；
// 指南針不能用、但正在快速移動（騎車、坐車）時用 GPS 行進方向；都沒有就北方朝上。
import { useEffect, useState } from 'preact/hooks';
import { onFix, type Fix } from './gps';

export type HeadingSource = 'compass' | 'gps' | null;

const FAST_MS = 15 / 3.6;
const STALE_MS = 3_000;
const SMOOTH = 0.25;
/** 指南針變化小於這個角度就不轉，減少抖動 */
const COMPASS_DEADBAND = 4;

/** 角度的指數移動平均：用單位向量平均，避免 359° → 1° 時繞一大圈 */
export function smoothAngle(prev: number | null, next: number, k = SMOOTH): number {
  if (prev == null) return next;
  const r = Math.PI / 180;
  const x = (1 - k) * Math.cos(prev * r) + k * Math.cos(next * r);
  const y = (1 - k) * Math.sin(prev * r) + k * Math.sin(next * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

/** deviceorientationabsolute 的 alpha（逆時針）換成羅盤方位，並修正螢幕旋轉 */
export function compassFromAlpha(alpha: number, screenAngle = 0): number {
  return (((360 - alpha + screenAngle) % 360) + 360) % 360;
}

/** 兩個角度相差幾度（0～180） */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function useHeading(): { deg: number | null; source: HeadingSource } {
  const [state, setState] = useState<{ deg: number | null; source: HeadingSource }>({ deg: null, source: null });

  useEffect(() => {
    let compass: number | null = null;
    let compassAt = 0;
    let gps: number | null = null;
    // Android Chrome：deviceorientationabsolute 是以北方為準；一般的 deviceorientation 只是相對角度，
    // 只有 iOS 的 webkitCompassHeading 或標明 absolute 的才能當指南針
    const absEvent = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';

    const onOrient = (e: DeviceOrientationEvent) => {
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      let raw: number | null = null;
      if (ios != null) raw = ios;
      else if (e.alpha != null && (absEvent === 'deviceorientationabsolute' || e.absolute)) {
        raw = compassFromAlpha(e.alpha, screen.orientation?.angle ?? 0);
      }
      if (raw == null) return;
      compassAt = Date.now();
      if (compass != null && angleDiff(compass, raw) < COMPASS_DEADBAND) return;
      compass = smoothAngle(compass, raw);
      setState({ deg: compass, source: 'compass' });
    };
    const offFix = onFix((f: Fix) => {
      if (f.speed != null && f.speed >= FAST_MS && f.heading != null) {
        gps = smoothAngle(gps, f.heading);
        if (Date.now() - compassAt > STALE_MS) setState({ deg: gps, source: 'gps' });
      }
    });
    addEventListener(absEvent, onOrient as EventListener);

    const timer = setInterval(() => {
      if (compass != null && Date.now() - compassAt > STALE_MS) {
        compass = null;
        setState(gps != null ? { deg: gps, source: 'gps' } : { deg: null, source: null });
      }
    }, 1_000);

    return () => {
      offFix();
      removeEventListener(absEvent, onOrient as EventListener);
      clearInterval(timer);
    };
  }, []);

  return state;
}
