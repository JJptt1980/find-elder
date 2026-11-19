// 雷達縮放與光點合併（純函式，方便測試）。

/** 雷達最小範圍（公里） */
export const MIN_RANGE_KM = 0.1;

/** 角落按鈕的三段範圍：最大、一半、四分之一 */
export function zoomLevels(maxKm: number): number[] {
  return [maxKm, maxKm / 2, maxKm / 4];
}

/** 按一下角落按鈕：往下一段放大，已經是最大倍率就回到全範圍 */
export function nextZoom(currentKm: number, maxKm: number): number {
  const next = zoomLevels(maxKm).find((k) => k < currentKm / 1.05);
  return next ?? maxKm;
}

/** 目前範圍是第幾段（0 = 全範圍）；雙指縮放到中間值時取最接近的 */
export function zoomStage(currentKm: number, maxKm: number): number {
  const levels = zoomLevels(maxKm);
  let best = 0;
  levels.forEach((k, i) => {
    if (Math.abs(Math.log(k / currentKm)) < Math.abs(Math.log(levels[best]! / currentKm))) best = i;
  });
  return best;
}

/**
 * 打開雷達時自動選範圍：三段裡最小、但能看到至少 3 個點（點不到 3 個就全部）和第一名的那一段，
 * 不要一打開什麼都沒有。
 */
export function fitRange(distKm: readonly number[], bestKm: number | null, maxKm: number): number {
  const need = Math.min(3, distKm.length);
  for (const level of [...zoomLevels(maxKm)].reverse()) {
    const inside = distKm.filter((d) => d <= level * 0.95).length;
    if (inside >= need && (bestKm == null || bestKm <= level * 0.95)) return level;
  }
  return maxKm;
}

/** 靠近目標時的距離分段（公尺）：越近段數越高 */
export const NEAR_BANDS_M = [500, 250, 100] as const;

/** 目前在第幾段：0 = 還很遠，1 = 500 m 內，2 = 250 m 內，3 = 100 m 內 */
export function nearBand(distM: number): number {
  return NEAR_BANDS_M.filter((b) => distM <= b).length;
}

/**
 * 靠近目標時要不要嗶：每個目標各自記住「最近到過哪一段」，
 * 進入更近的一段才嗶（同一顆不會一直響），離開 700 公尺以上就重置，下次再靠近會再響。
 * 回傳這次要嗶的段數（0 = 不嗶）。
 */
export function nearBeep(
  memory: Map<string, number>,
  dots: readonly { id: string; distM: number }[],
): number {
  let play = 0;
  for (const d of dots) {
    if (d.distM > 700) {
      memory.delete(d.id);
      continue;
    }
    const band = nearBand(d.distM);
    const prev = memory.get(d.id) ?? 0;
    if (band > prev) {
      play = Math.max(play, band);
      memory.set(d.id, band);
    }
  }
  return play;
}

export const clampRange = (km: number, maxKm: number): number => Math.min(maxKm, Math.max(MIN_RANGE_KM, km));

/** 好讀的刻度：0.1、0.2、0.25、0.5、1、2、2.5、5… 取不小於 x 的最小值 */
export function niceStep(x: number): number {
  const p = 10 ** Math.floor(Math.log10(x));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= x - 1e-9) return m * p;
  return 10 * p;
}

export interface Placed<T> {
  item: T;
  x: number;
  y: number;
  score: number;
}

export interface Cluster<T> {
  /** 這一群裡分數最高的點，位置就用它的（點過去就是最好的那格） */
  best: T;
  x: number;
  y: number;
  score: number;
  count: number;
}

/**
 * 螢幕上距離 radiusPx 以內的點合成一個：從分數最高的開始當中心，
 * 其他點加入第一個夠近的群。放大雷達時距離拉開，群會自然分開。
 */
export function clusterDots<T>(dots: readonly Placed<T>[], radiusPx: number): Cluster<T>[] {
  const out: Cluster<T>[] = [];
  for (const d of [...dots].sort((a, b) => b.score - a.score)) {
    const hit = out.find((c) => Math.hypot(c.x - d.x, c.y - d.y) <= radiusPx);
    if (hit) hit.count++;
    else out.push({ best: d.item, x: d.x, y: d.y, score: d.score, count: 1 });
  }
  return out;
}

/** 光點半徑：一個點 6px，點越多越大，最大 18px */
export const clusterRadius = (count: number): number => Math.min(18, 6 + 3 * Math.sqrt(count - 1));
