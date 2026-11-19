// 地名搜尋：以「你現在的位置」為中心找，近的排前面。在台灣找台灣的，出國就找當地的。
// 主要用 Photon（OpenStreetMap 的模糊搜尋，會依位置加權），同時問 Nominatim 補漏，合併後去重。
import { distanceM, type LatLon } from '../radar/geo';

export interface Hit extends LatLon {
  name: string;
  full: string;
  distM: number | null;
}

const DIGIT: Record<string, string> = { 零: '0', 〇: '0', 一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9' };

/**
 * 同一個意思的幾種寫法：「一零一」→「101」、臺↔台、去掉「大樓」「大廈」。
 * OpenStreetMap 上台北 101 叫「台北101」，打「101大樓」原本找不到。
 */
/** OpenStreetMap 上正式名字跟大家平常講的不一樣的地標 */
const ALIAS: Record<string, string> = { '101': '台北101' };

export function variants(q: string): string[] {
  const base = q.trim().replace(/\s+/g, ' ');
  const out = new Set<string>([base]);
  const digits = base.replace(/[零〇一二三四五六七八九]{2,}/g, (m) => [...m].map((c) => DIGIT[c]).join(''));
  for (const s of [base, digits]) {
    out.add(s);
    out.add(s.replace(/臺/g, '台'));
    out.add(s.replace(/台/g, '臺'));
    const bare = s.replace(/(大樓|大廈|大楼)$/, '');
    if (bare && bare !== s) out.add(bare);
    const alias = ALIAS[bare];
    if (alias) out.add(alias);
  }
  return [...out].filter(Boolean).slice(0, 5);
}

async function photon(q: string, near: LatLon | null, signal: AbortSignal): Promise<Hit[]> {
  const p = new URLSearchParams({ q, limit: '8' });
  if (near) {
    p.set('lat', near.lat.toFixed(4));
    p.set('lon', near.lon.toFixed(4));
    p.set('zoom', '12');
    p.set('location_bias_scale', '0.3');
  }
  const res = await fetch(`https://photon.komoot.io/api/?${p}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as { features: { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }[] };
  return j.features.map((f) => {
    const pr = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const name = pr.name ?? pr.street ?? q;
    const full = [pr.street && pr.housenumber ? `${pr.street}${pr.housenumber}號` : pr.street, pr.district, pr.city, pr.state, pr.country]
      .filter((x, i, a) => x && x !== name && a.indexOf(x) === i)
      .join('・');
    return { name, full, lat, lon, distM: near ? distanceM(near, { lat, lon }) : null };
  });
}

async function nominatim(q: string, near: LatLon | null, signal: AbortSignal): Promise<Hit[]> {
  const p = new URLSearchParams({ q, format: 'jsonv2', limit: '5', 'accept-language': 'zh-TW' });
  if (near) p.set('viewbox', `${near.lon - 0.5},${near.lat + 0.5},${near.lon + 0.5},${near.lat - 0.5}`);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${p}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string; type?: string }[];
  return rows
    .filter((r) => r.type !== 'postcode')
    .map((r) => {
      const lat = +r.lat;
      const lon = +r.lon;
      return { name: r.name || r.display_name.split(',')[0]!, full: r.display_name, lat, lon, distM: near ? distanceM(near, { lat, lon }) : null };
    });
}

/**
 * 排序：名字像不像、離你多近一起算。
 * 名字一模一樣但在 20 公里外的，會排在名字只是包含、但就在旁邊的後面。
 */
export function rank(hits: readonly Hit[], q: string): Hit[] {
  const qs = variants(q).map((v) => v.toLowerCase());
  const score = (h: Hit) => {
    const n = h.name.toLowerCase();
    if (qs.includes(n)) return 0;
    if (qs.some((v) => n.startsWith(v) || v.startsWith(n))) return 1;
    if (qs.some((v) => n.includes(v) || v.includes(n))) return 2;
    return 3;
  };
  const seen: Hit[] = [];
  for (const h of hits) {
    // 同名而且 150 公尺內的當成同一個地方
    if (seen.some((s) => s.name === h.name && distanceM(s, h) < 150)) continue;
    seen.push(h);
  }
  const value = (h: Hit) => score(h) + Math.log((h.distM ?? 0) + 100);
  return seen.sort((a, b) => value(a) - value(b)).slice(0, 8);
}

export async function searchPlaces(q: string, near: LatLon | null, signal: AbortSignal): Promise<Hit[]> {
  const vs = variants(q);
  const jobs = [...vs.map((v) => photon(v, near, signal)), nominatim(vs[0]!, near, signal)];
  const results = await Promise.allSettled(jobs);
  const hits = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (!hits.length && results.every((r) => r.status === 'rejected')) throw new Error('search failed');
  return rank(hits, q);
}
