// 體感：手機傾斜時，雷達像實體裝置一樣跟著立體轉一點（純噱頭，設定可關）。
import type { RefObject } from 'preact';
import { useEffect } from 'preact/hooks';

/** 最多轉幾度 */
const MAX_DEG = 28;
/** 手機傾斜 1 度，雷達轉幾度（放大才看得出來） */
const GAIN = 2;
/** 基準點慢慢跟上目前角度（感測器約每秒 60 次，約 4 秒追上），手機架固定的角度會自動當成「正面」 */
const RECENTER = 0.004;
/** 畫面上的平滑 */
const SMOOTH = 0.18;

export const clampTilt = (d: number): number => Math.max(-MAX_DEG, Math.min(MAX_DEG, d));

/**
 * 依 deviceorientation 的 beta（前後傾）、gamma（左右傾）相對於基準的差，
 * 對 el 套用 perspective + rotateX/rotateY。關掉時清掉 transform。
 */
export function useTilt(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!enabled) {
      el.style.transform = '';
      return;
    }
    let base: { b: number; g: number } | null = null;
    let target = { x: 0, y: 0 };
    const shown = { x: 0, y: 0 };
    let raf = 0;

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      if (!base) base = { b: e.beta, g: e.gamma };
      base.b += (e.beta - base.b) * RECENTER;
      base.g += (e.gamma - base.g) * RECENTER;
      // 往前傾（beta 變小）→ 雷達上緣離你遠一點：rotateX 正值
      target = { x: clampTilt((base.b - e.beta) * GAIN), y: clampTilt((e.gamma - base.g) * GAIN) };
    };
    const frame = () => {
      shown.x += (target.x - shown.x) * SMOOTH;
      shown.y += (target.y - shown.y) * SMOOTH;
      el.style.transform = `perspective(900px) rotateX(${shown.x.toFixed(2)}deg) rotateY(${shown.y.toFixed(2)}deg)`;
      raf = requestAnimationFrame(frame);
    };
    addEventListener('deviceorientation', onOrient);
    raf = requestAnimationFrame(frame);
    return () => {
      removeEventListener('deviceorientation', onOrient);
      cancelAnimationFrame(raf);
      el.style.transform = '';
    };
  }, [ref, enabled]);
}
