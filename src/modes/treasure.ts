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
/** 撒在身邊多遠以內（公尺） */
export const HUNT_RADIUS_M = 800;
/** 定位誤差在這以內才撒，免得用到剛打開時不準的網路定位 */
export const GOOD_ACCURACY_M = 100;
/** 離撒寶物的地方這麼遠，就讓使用者在新的位置重撒 */
export const TOO_FAR_M = 3000;

/**
 * 雷達最大範圍：一定蓋得到最遠的那顆（留 15% 邊），至少 1 公里。
 * 取好讀的數字，縮放鈕的三段是它的 1、1/2、1/4。
 */
export function coverKm(farthestM: number): number {
  const need = Math.max(1, (farthestM / 1000) * 1.15);
  for (const r of [1, 1.5, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000, 5000]) if (r >= need) return r;
  return 20000;
}

/** 兩顆寶物至少隔這麼遠（半徑的比例），免得兩顆疊在一起、一次撿兩顆 */
export const MIN_GAP = 0.15;

/**
 * 在 center 周圍完全隨機撒 count 個：方向、距離都是亂數（距離 10%～100% 半徑，面積平均）。
 * 唯一的限制是兩顆不能太近；所以有時候會好幾顆擠在同一邊、某一邊空空的，看起來才像真的亂撒。
 */
export function scatter(center: LatLon, radiusM: number, now: number, rand: () => number = Math.random, count = TREASURE_COUNT): Hunt {
  const minR = radiusM * 0.1;
  const gap = radiusM * MIN_GAP;
  const items: Treasure[] = [];
  for (let tries = 0; items.length < count && tries < 2000; tries++) {
    const bearing = rand() * 360;
    const r = Math.sqrt(minR ** 2 + rand() * (radiusM ** 2 - minR ** 2));
    const p = destination(center, bearing, r);
    // 試太多次都放不下（幾乎不會發生）就不管間距了
    if (tries < 1500 && items.some((t) => distanceM(t, p) < gap)) continue;
    items.push({ id: `t${now}-${items.length}`, n: 0, ...p });
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

// ---------- 七顆到齊後的召喚結局 ----------

/** 四種結局，照這個順序輪流出現 */
export const ENDINGS = ['undies', 'busy', 'power', 'nothing'] as const;
export type Ending = (typeof ENDINGS)[number];

/** 存在手機裡的破關紀錄 */
export interface Saga {
  /** 總共破了幾輪 */
  rounds: number;
  /** 下一次輪到 ENDINGS 的第幾個 */
  next: number;
  /** 看過哪些結局 */
  seen: Ending[];
}

export const emptySaga = (): Saga => ({ rounds: 0, next: 0, seen: [] });

/** 破一輪：輪到哪個結局、這次是不是剛好湊滿四種 */
export function finishRound(s: Saga): { saga: Saga; ending: Ending; completedAll: boolean } {
  const ending = ENDINGS[s.next % ENDINGS.length]!;
  const seen = s.seen.includes(ending) ? s.seen : [...s.seen, ending];
  const completedAll = s.seen.length < ENDINGS.length && seen.length === ENDINGS.length;
  return { saga: { rounds: s.rounds + 1, next: (s.next + 1) % ENDINGS.length, seen }, ending, completedAll };
}

/** 這一輪的成績：照撿到的順序，從撒寶物的地方一顆一顆走直線，至少走了多遠；花了多久 */
export function roundStats(hunt: Hunt): { walkedM: number; ms: number } {
  const order = hunt.items.filter((t) => t.foundAt).sort((a, b) => a.foundAt! - b.foundAt!);
  let walkedM = 0;
  let at: LatLon = hunt.center;
  for (const t of order) {
    walkedM += distanceM(at, t);
    at = t;
  }
  const last = order.at(-1)?.foundAt ?? hunt.startedAt;
  return { walkedM, ms: Math.max(0, last - hunt.startedAt) };
}
