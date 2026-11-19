// 開發用假 GPS：網址加 ?fake=24.99,121.3 就用假位置，console 呼叫 __fakeMove(lat, lon) 移動。只在 dev 模式載入。
export function installFakeGps(): void {
  const m = location.search.match(/fake=(-?[\d.]+),(-?[\d.]+)/);
  if (!m) return;
  let pos = { lat: Number(m[1]), lon: Number(m[2]) };
  const watchers = new Map<number, PositionCallback>();
  let next = 1;
  const make = (): GeolocationPosition =>
    ({
      timestamp: Date.now(),
      coords: { latitude: pos.lat, longitude: pos.lon, accuracy: 8, speed: 0, heading: null, altitude: null, altitudeAccuracy: null },
    }) as unknown as GeolocationPosition;
  const fake = {
    watchPosition(ok: PositionCallback) {
      const id = next++;
      watchers.set(id, ok);
      setTimeout(() => ok(make()), 50);
      return id;
    },
    clearWatch(id: number) {
      watchers.delete(id);
    },
    getCurrentPosition(ok: PositionCallback) {
      setTimeout(() => ok(make()), 50);
    },
  };
  Object.defineProperty(navigator, 'geolocation', { value: fake, configurable: true });
  (window as unknown as { __fakeMove: (lat: number, lon: number) => void }).__fakeMove = (lat, lon) => {
    pos = { lat, lon };
    watchers.forEach((w) => w(make()));
  };
}
