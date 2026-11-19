// 尋寶遊戲（純邏輯）：在身邊撒七個寶物，走到附近就撿起來。
import { destination, distanceM, type LatLon } from '../radar/geo';

export interface Treasure extends LatLon {
  id: string;
  /** 第幾顆（1～7） */
  n: number;
  foundAt?: number;
}

export interface Hunt {
  center: LatLon;
  /** 撒的範圍（公尺） */
  radiusM: number;
  items: Treasure[];
  startedAt: number;
}

export const TREASURE_COUNT = 7;
export const RANGES = [
  { m: 300, label: '近 300 m' },
  { m: 800, label: '中 800 m' },
  { m: 2000, label: '遠 2 km' },
] as const;

/**
 * 在 center 周圍撒 count 個：距離在半徑的 25%～100% 之間（面積平均，不會擠在中間），
 * 方位均分成 count 等份再各自亂數偏移，才不會好幾顆擠在同一邊。
 */
export function scatter(center: LatLon, radiusM: number, now: number, rand: () => number = Math.random, count = TREASURE_COUNT): Hunt {
  const minR = radiusM * 0.25;
  const offset = rand() * 360;
  const items: Treasure[] = [];
  for (let i = 0; i < count; i++) {
    const bearing = (offset + (i + 0.15 + rand() * 0.7) * (360 / count)) % 360;
    const r = Math.sqrt(minR ** 2 + rand() * (radiusM ** 2 - minR ** 2));
    items.push({ id: `t${now}-${i}`, n: 0, ...destination(center, bearing, r) });
  }
  // 編號照距離排：第 1 顆最近
  items.sort((a, b) => distanceM(center, a) - distanceM(center, b)).forEach((t, i) => (t.n = i + 1));
  return { center, radiusM, items, startedAt: now };
}

/** 走到多近算撿到：一般 25 公尺，定位誤差大時放寬，最多 50 公尺 */
export const pickRadius = (accuracy: number): number => Math.min(50, Math.max(25, accuracy));

/** 這次定位撿到哪些（回傳新的 hunt 和撿到的那幾顆） */
export function collect(hunt: Hunt, at: LatLon & { accuracy: number }, now: number): { hunt: Hunt; got: Treasure[] } {
  const limit = pickRadius(at.accuracy);
  const got: Treasure[] = [];
  const items = hunt.items.map((t) => {
    if (t.foundAt || distanceM(at, t) > limit) return t;
    const found = { ...t, foundAt: now };
    got.push(found);
    return found;
  });
  return { hunt: got.length ? { ...hunt, items } : hunt, got };
}

export const remaining = (hunt: Hunt): Treasure[] => hunt.items.filter((t) => !t.foundAt);
