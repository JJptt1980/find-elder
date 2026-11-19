// 三種模式共用的小工具：目前位置、靠近時嗶嗶、喇叭按鈕、本機儲存。
import { useEffect, useRef, useState } from 'preact/hooks';
import { distanceM, type LatLon } from '../radar/geo';
import { nearBeep } from '../radar/radarZoom';
import { playNear } from '../radar/radarSound';
import { gpsStatus, lastFix, onFix, onGpsStatus, type Fix, type GpsStatus } from '../sensors/gps';

export function load<T>(key: string, fallback: T): T {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
}

let persistAsked = false;
export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存不起來（私密模式等）就算了，畫面照常
  }
  if (!persistAsked) {
    persistAsked = true;
    void navigator.storage?.persist?.().catch(() => undefined);
  }
}

export function vibrate(p: number | number[]): void {
  try {
    navigator.vibrate?.(p);
  } catch {
    // 不支援震動就算了
  }
}

/** 每一筆 GPS 都更新的目前位置 */
export function useFix(): Fix | null {
  const [f, setF] = useState<Fix | null>(lastFix);
  useEffect(() => onFix(setF), []);
  return f;
}

export function useGpsStatus(): GpsStatus {
  const [s, setS] = useState(gpsStatus);
  useEffect(() => onGpsStatus(() => setS(gpsStatus())), []);
  return s;
}

/** 靠近目標時嗶嗶：進入 500／250／100 公尺各響一次，越近嗶越多越快 */
export function useNearBeep(targets: readonly (LatLon & { id: string })[], on: boolean, onBeep?: (band: number) => void) {
  const memory = useRef(new Map<string, number>());
  const latest = useRef({ targets, on, onBeep });
  latest.current = { targets, on, onBeep };
  useEffect(
    () =>
      onFix((f) => {
        const { targets: ts, on: enabled } = latest.current;
        const band = nearBeep(
          memory.current,
          ts.map((t) => ({ id: t.id, distM: distanceM(f, t) })),
        );
        if (band && enabled) {
          playNear(band);
          latest.current.onBeep?.(band);
          vibrate(band === 3 ? [60, 60, 60] : 40);
        }
      }),
    [],
  );
}

const SOUND_KEY = 'fe-sound';
export function useSound(): [boolean, () => void] {
  const [on, setOn] = useState(() => load(SOUND_KEY, true));
  return [
    on,
    () => {
      save(SOUND_KEY, !on);
      setOn(!on);
    },
  ];
}

/** 雷達右上角的喇叭：會響（綠、呼吸）／不響（灰、打叉）；嗶的時候跟著閃 */
export function SoundBadge(props: { on: boolean; beepBand: number; onToggle: () => void }) {
  const label = props.on ? '靠近時的嗶嗶聲：開' : '靠近時的嗶嗶聲：關';
  return (
    <button
      type="button"
      class={`radar-sound${props.on ? ' on' : ''}${props.on && props.beepBand ? ` beep-${props.beepBand}` : ''}`}
      onClick={props.onToggle}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 32 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" />
        {props.on ? (
          <>
            <path d="M16 9.5a3.5 3.5 0 0 1 0 5" />
            <path d="M19.5 7a7 7 0 0 1 0 10" />
            <path d="M23 4.5a10.5 10.5 0 0 1 0 15" />
          </>
        ) : (
          <path d="M17 8.5l7 7M24 8.5l-7 7" />
        )}
      </svg>
    </button>
  );
}

/** 嗶的時候讓喇叭閃一下（換 key 讓動畫重播） */
export function useBeepFlash(): [{ band: number; at: number } | null, (band: number) => void] {
  const [beep, setBeep] = useState<{ band: number; at: number } | null>(null);
  return [beep, (band) => setBeep({ band, at: Date.now() })];
}

export const GPS_TEXT: Record<GpsStatus, string> = {
  idle: '等待定位…',
  waiting: '等待定位…',
  ok: '',
  denied: '沒有定位權限：請到瀏覽器設定允許這個網站使用位置',
  unavailable: '暫時抓不到定位，到空曠一點的地方試試',
  unsupported: '這個瀏覽器不支援定位',
};
