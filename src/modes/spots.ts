// 私房地圖（純邏輯）：
// 第一組「地球」、第二組「納美克星」各只能放七個點（七龍珠梗），想放第八個就會被說不是粉絲；
// 第三組以後自己取名，只是記錄點，不限數量。
import type { LatLon } from '../radar/geo';

export const DRAGON_LIMIT = 7;
export const NOT_A_FAN = '你不是七龍珠的粉絲！';

export type GroupKind = 'earth' | 'namek' | 'custom';

export interface Spot extends LatLon {
  id: string;
  name: string;
  createdAt: number;
}

export interface Group {
  id: string;
  name: string;
  kind: GroupKind;
  spots: Spot[];
}

export interface SpotBook {
  groups: Group[];
  activeId: string;
}

export function emptyBook(): SpotBook {
  return {
    groups: [
      { id: 'earth', name: '地球', kind: 'earth', spots: [] },
      { id: 'namek', name: '納美克星', kind: 'namek', spots: [] },
    ],
    activeId: 'earth',
  };
}

export const limitOf = (g: Group): number | null => (g.kind === 'custom' ? null : DRAGON_LIMIT);
export const isFull = (g: Group): boolean => {
  const l = limitOf(g);
  return l != null && g.spots.length >= l;
};

export const activeGroup = (b: SpotBook): Group => b.groups.find((g) => g.id === b.activeId) ?? b.groups[0]!;

/** 加一個點；組已經滿七顆就回傳 null（呼叫的人負責說「你不是七龍珠的粉絲」） */
export function addSpot(b: SpotBook, groupId: string, spot: Omit<Spot, 'id' | 'createdAt'>, now: number): SpotBook | null {
  const g = b.groups.find((x) => x.id === groupId);
  if (!g || isFull(g)) return null;
  const s: Spot = { ...spot, name: spot.name.trim() || `記錄點 ${g.spots.length + 1}`, id: `s${now}-${Math.random().toString(36).slice(2, 7)}`, createdAt: now };
  return { ...b, groups: b.groups.map((x) => (x.id === groupId ? { ...x, spots: [...x.spots, s] } : x)) };
}

export function updateSpot(b: SpotBook, spotId: string, patch: Partial<Pick<Spot, 'name'>>): SpotBook {
  return { ...b, groups: b.groups.map((g) => ({ ...g, spots: g.spots.map((s) => (s.id === spotId ? { ...s, ...patch } : s)) })) };
}

export function removeSpot(b: SpotBook, spotId: string): SpotBook {
  return { ...b, groups: b.groups.map((g) => ({ ...g, spots: g.spots.filter((s) => s.id !== spotId) })) };
}

export function addGroup(b: SpotBook, name: string, now: number): SpotBook {
  const id = `g${now}`;
  const n = b.groups.filter((g) => g.kind === 'custom').length + 3;
  return { groups: [...b.groups, { id, name: name.trim() || `第 ${n} 組`, kind: 'custom', spots: [] }], activeId: id };
}

export function renameGroup(b: SpotBook, id: string, name: string): SpotBook {
  return { ...b, groups: b.groups.map((g) => (g.id === id && g.kind === 'custom' && name.trim() ? { ...g, name: name.trim() } : g)) };
}

/** 只有自訂組可以刪；地球和納美克星永遠都在 */
export function removeGroup(b: SpotBook, id: string): SpotBook {
  const groups = b.groups.filter((g) => g.id !== id || g.kind !== 'custom');
  return { groups, activeId: groups.some((g) => g.id === b.activeId) ? b.activeId : 'earth' };
}

/** 地球滿了建議去納美克星；兩顆星都滿了就建議開自訂組 */
export function nextHome(b: SpotBook, fullId: string): Group | null {
  return b.groups.find((g) => g.id !== fullId && !isFull(g)) ?? null;
}

const inRange = (lat: number, lon: number) => Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

/**
 * 從貼上的文字讀出經緯度：
 * - Google 地圖長按複製的「25.0330, 121.5654」
 * - 網址裡的 @25.03,121.56、!3d25.03!4d121.56、q=、query=、ll=、destination=
 * maps.app.goo.gl 這種短網址瀏覽器沒辦法展開，回傳 'short-link'。
 */
export function parseLatLon(text: string): LatLon | 'short-link' | null {
  const t = text.trim();
  let m = t.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (!m) m = t.match(/[?&](?:q|query|ll|destination|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i);
  if (!m) m = t.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!m) m = t.match(/^\(?\s*(-?\d{1,2}(?:\.\d+)?)\s*[,，\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*\)?$/);
  if (m) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    if (inRange(lat, lon)) return { lat, lon };
  }
  if (/goo\.gl\/|maps\.app\.goo\.gl/i.test(t)) return 'short-link';
  return null;
}
