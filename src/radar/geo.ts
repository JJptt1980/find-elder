export interface LatLon {
  lat: number;
  lon: number;
}

/** 兩點直線距離（公尺）。 */
export function distanceM(a: LatLon, b: LatLon): number {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLon = (b.lon - a.lon) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 從 a 看 b 的方位角（度，0 = 北，順時針） */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const toRad = Math.PI / 180;
  const y = Math.sin((b.lon - a.lon) * toRad) * Math.cos(b.lat * toRad);
  const x =
    Math.cos(a.lat * toRad) * Math.sin(b.lat * toRad) -
    Math.sin(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.cos((b.lon - a.lon) * toRad);
  return (Math.atan2(y, x) / toRad + 360) % 360;
}

const DIRS = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];

export function compassLabel(deg: number): string {
  return DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]!;
}

/** 從 from 往 bearing 方向走 distM 公尺後的位置 */
export function destination(from: LatLon, bearing: number, distM: number): LatLon {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const d = distM / R;
  const b = bearing * toRad;
  const la = from.lat * toRad;
  const lo = from.lon * toRad;
  const lat2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lon2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(lat2));
  return { lat: lat2 / toRad, lon: ((lon2 / toRad + 540) % 360) - 180 };
}

/** 好讀的距離：900 m、1.2 km */
export const fmtDist = (m: number): string => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
