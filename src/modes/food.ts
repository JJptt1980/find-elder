// 附近好吃的：用 OpenStreetMap 的 Overpass API 找附近有名字的餐廳、小吃、咖啡店。
import type { LatLon } from '../radar/geo';

export type FoodKind = 'restaurant' | 'snack' | 'cafe';

export interface Place extends LatLon {
  id: string;
  name: string;
  label: string;
  kind: FoodKind;
  /** OSM 原本的分類，例如 restaurant、fast_food */
  amenity: string;
  cuisine?: string;
  hours?: string;
}

export const KIND_LABEL: Record<FoodKind, string> = { restaurant: '餐廳', snack: '小吃', cafe: '咖啡甜點' };

export const KIND_OF: Record<string, FoodKind> = {
  restaurant: 'restaurant',
  fast_food: 'snack',
  food_court: 'snack',
  cafe: 'cafe',
  ice_cream: 'cafe',
  bakery: 'cafe',
};

const AMENITY_LABEL: Record<string, string> = {
  restaurant: '餐廳',
  fast_food: '小吃／速食',
  food_court: '美食街',
  cafe: '咖啡廳',
  ice_cream: '冰品',
  bakery: '麵包店',
};

export const amenityLabel = (a: string): string => AMENITY_LABEL[a] ?? a;

export const SEARCH_M = 1000;
/** 離上次搜尋的位置這麼遠才重新搜尋 */
export const REFETCH_M = 300;
export const MAX_PLACES = 60;

export function buildQuery(at: LatLon, radiusM = SEARCH_M): string {
  const around = `(around:${radiusM},${at.lat.toFixed(5)},${at.lon.toFixed(5)})`;
  return `[out:json][timeout:20];(nwr["amenity"~"^(restaurant|fast_food|food_court|cafe|ice_cream)$"]["name"]${around};nwr["shop"="bakery"]["name"]${around};);out center 200;`;
}

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

/** 名字太長在雷達上會擠：最多 8 個字 */
export const shortName = (s: string): string => (s.length > 8 ? `${s.slice(0, 7)}…` : s);

export function parsePlaces(json: { elements?: OsmElement[] }): Place[] {
  const out: Place[] = [];
  for (const e of json.elements ?? []) {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const t = e.tags ?? {};
    const name = t['name:zh'] ?? t['name:zh-Hant'] ?? t.name;
    const amenity = t.amenity ?? (t.shop === 'bakery' ? 'bakery' : '');
    const kind = KIND_OF[amenity];
    if (lat == null || lon == null || !name || !kind) continue;
    out.push({ id: `${e.type}/${e.id}`, lat, lon, name, label: shortName(name), kind, amenity, cuisine: t.cuisine, hours: t.opening_hours });
  }
  return out;
}

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

/** 即時查詢 Overpass（只有身邊沒有預先整理好的資料時才用，例如出國）：兩台同時問，誰先回用誰 */
async function fetchOverpass(at: LatLon, signal?: AbortSignal): Promise<Place[]> {
  const ctl = new AbortController();
  const stop = () => ctl.abort();
  signal?.addEventListener('abort', stop);
  const timer = setTimeout(stop, 30_000);
  try {
    return await Promise.any(
      ENDPOINTS.map(async (url) => {
        const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: buildQuery(at) }), signal: ctl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parsePlaces(await res.json());
      }),
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
    ctl.abort();
  }
}

// ---------- 預先整理好的方格資料（scripts/build-food.py 產生，放在 GitHub Pages） ----------

/** 方格裡一家店：[緯度, 經度, 名字, 類別代碼, 料理?, 營業時間?] */
export type TileRow = [number, number, string, string, string?, string?];
interface FoodIndex {
  tile: number;
  tiles: string[];
}

const CODE: Record<string, string> = { r: 'restaurant', f: 'fast_food', c: 'food_court', k: 'cafe', i: 'ice_cream', b: 'bakery' };

export function rowToPlace(r: TileRow): Place | null {
  const [lat, lon, name, code, cuisine, hours] = r;
  const amenity = CODE[code];
  const kind = amenity ? KIND_OF[amenity] : undefined;
  if (!amenity || !kind) return null;
  return { id: `${code}${lat},${lon}`, lat, lon, name, label: shortName(name), kind, amenity, cuisine: cuisine || undefined, hours: hours || undefined };
}

export const tileKey = (lat: number, lon: number, size: number): string => `${Math.floor(lat / size)}_${Math.floor(lon / size)}`;

/** 以 at 為中心、半徑 radiusM 的方框碰到哪些格子 */
export function tilesAround(at: LatLon, radiusM: number, size: number): string[] {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((at.lat * Math.PI) / 180));
  const keys: string[] = [];
  for (let y = Math.floor((at.lat - dLat) / size); y <= Math.floor((at.lat + dLat) / size); y++) {
    for (let x = Math.floor((at.lon - dLon) / size); x <= Math.floor((at.lon + dLon) / size); x++) keys.push(`${y}_${x}`);
  }
  return keys;
}

const BASE = `${import.meta.env.BASE_URL}food/`;
let indexP: Promise<{ size: number; has: Set<string> } | null> | null = null;
const tileCache = new Map<string, Promise<Place[]>>();

function loadIndex() {
  indexP ??= fetch(`${BASE}index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<FoodIndex>) : null))
    .then((j) => (j ? { size: j.tile, has: new Set(j.tiles) } : null))
    .catch(() => {
      indexP = null;
      return null;
    });
  return indexP;
}

function loadTile(key: string): Promise<Place[]> {
  let p = tileCache.get(key);
  if (!p) {
    p = fetch(`${BASE}${key}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<TileRow[]>;
      })
      .then((rows) => rows.map(rowToPlace).filter((x): x is Place => !!x));
    p.catch(() => tileCache.delete(key));
    tileCache.set(key, p);
  }
  return p;
}

export type FoodSource = 'tiles' | 'live';

export async function fetchPlaces(at: LatLon, signal?: AbortSignal): Promise<{ places: Place[]; source: FoodSource }> {
  const idx = await loadIndex();
  if (idx) {
    // 身邊 3 公里內有任何一格有資料，就當作這裡有整理好的資料（沒檔案的格子就是沒有店）
    const covered = tilesAround(at, 3000, idx.size).some((k) => idx.has.has(k));
    if (covered) {
      const keys = tilesAround(at, SEARCH_M, idx.size).filter((k) => idx.has.has(k));
      const lists = await Promise.all(keys.map(loadTile));
      return { places: lists.flat(), source: 'tiles' };
    }
  }
  return { places: await fetchOverpass(at, signal), source: 'live' };
}

/** 常見料理類型翻成中文，沒有的就照原文 */
const CUISINE: Record<string, string> = {
  chinese: '中式',
  taiwanese: '台式',
  japanese: '日式',
  korean: '韓式',
  thai: '泰式',
  vietnamese: '越式',
  italian: '義式',
  american: '美式',
  burger: '漢堡',
  pizza: '披薩',
  noodle: '麵食',
  ramen: '拉麵',
  sushi: '壽司',
  coffee_shop: '咖啡',
  breakfast: '早餐',
  bubble_tea: '手搖飲',
  tea: '茶飲',
  hot_pot: '火鍋',
  barbecue: '燒烤',
  dumpling: '水餃',
  dessert: '甜點',
  ice_cream: '冰品',
  chicken: '雞肉',
  seafood: '海鮮',
  vegetarian: '素食',
  indian: '印度',
  sandwich: '三明治',
  steak_house: '牛排',
  curry: '咖哩',
};

export const cuisineText = (c?: string): string | null =>
  c ? c.split(';').map((s) => CUISINE[s.trim()] ?? s.trim()).join('、') : null;
