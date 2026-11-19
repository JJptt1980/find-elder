// GPS（SPEC 3.1）：前景時持續定位，提供最後已知位置與「按下按鈕後的新定位」。

export interface Fix {
  ts: number;
  lat: number;
  lon: number;
  accuracy: number;
  speed: number | null;
  heading: number | null;
}

export type GpsStatus = 'idle' | 'waiting' | 'ok' | 'denied' | 'unavailable' | 'unsupported';

type Listener = (fix: Fix) => void;

let watchId: number | null = null;
let last: Fix | null = null;
let status: GpsStatus = 'idle';
const listeners = new Set<Listener>();
const statusListeners = new Set<() => void>();

function setStatus(s: GpsStatus) {
  if (s === status) return;
  status = s;
  statusListeners.forEach((l) => l());
}

function toFix(p: GeolocationPosition): Fix {
  const c = p.coords;
  return {
    ts: p.timestamp || Date.now(),
    lat: c.latitude,
    lon: c.longitude,
    accuracy: c.accuracy,
    speed: c.speed ?? null,
    heading: c.heading == null || Number.isNaN(c.heading) ? null : c.heading,
  };
}

function onPosition(p: GeolocationPosition) {
  last = toFix(p);
  setStatus('ok');
  listeners.forEach((l) => l(last!));
}

function onError(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) setStatus('denied');
  else if (!last) setStatus('unavailable');
}

export function startGps(): void {
  if (!('geolocation' in navigator)) {
    setStatus('unsupported');
    return;
  }
  if (watchId !== null) return;
  if (status !== 'ok') setStatus('waiting');
  watchId = navigator.geolocation.watchPosition(onPosition, onError, {
    enableHighAccuracy: true,
    maximumAge: 5_000,
    timeout: 30_000,
  });
}

export function stopGps(): void {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export const lastFix = (): Fix | null => last;
export const gpsStatus = (): GpsStatus => status;

export function onFix(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function onGpsStatus(l: () => void): () => void {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
}

/** 等一筆比 after 更新的定位，逾時回傳 null（SPEC 2.3：逾時 10 秒保留舊值）。 */
export function freshFix(after: number, timeoutMs = 10_000): Promise<Fix | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (f: Fix | null) => {
      if (done) return;
      done = true;
      off();
      clearTimeout(timer);
      resolve(f);
    };
    const off = onFix((f) => {
      if (f.ts >= after - 1_000) finish(f);
    });
    const timer = setTimeout(() => finish(null), timeoutMs);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const f = toFix(p);
          if (f.ts >= after - 1_000) {
            last = f;
            setStatus('ok');
            finish(f);
          }
        },
        () => undefined,
        { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
      );
    }
  });
}
