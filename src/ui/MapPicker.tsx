// 在地圖上選一個點：可以搜尋地名，也可以直接點地圖。地圖和搜尋都用 OpenStreetMap。
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { LatLon } from '../radar/geo';

interface Hit {
  name: string;
  full: string;
  lat: number;
  lon: number;
}

const TAIWAN: LatLon = { lat: 23.7, lon: 121 };

async function search(q: string, near: LatLon | null): Promise<Hit[]> {
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', 'accept-language': 'zh-TW' });
  if (near) {
    // 優先找附近的（約 ±0.5 度），找不到 Nominatim 還是會給遠的
    params.set('viewbox', `${near.lon - 0.5},${near.lat + 0.5},${near.lon + 0.5},${near.lat - 0.5}`);
  }
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as { name?: string; display_name: string; lat: string; lon: string }[];
  return rows.map((r) => ({ name: r.name || r.display_name.split(',')[0]!, full: r.display_name, lat: +r.lat, lon: +r.lon }));
}

export function MapPicker(props: { me: LatLon | null; onPick: (at: LatLon, name: string) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.CircleMarker | null>(null);
  const [at, setAt] = useState<LatLon | null>(null);
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const place = (p: LatLon, label = '') => {
    setAt(p);
    setName(label);
    const m = map.current!;
    if (!marker.current) {
      marker.current = L.circleMarker([p.lat, p.lon], { radius: 10, color: '#fff', weight: 3, fillColor: '#ffd23f', fillOpacity: 1 }).addTo(m);
    } else marker.current.setLatLng([p.lat, p.lon]);
  };

  useEffect(() => {
    const start = props.me ?? TAIWAN;
    const m = L.map(box.current!, { zoomControl: false, attributionControl: true }).setView([start.lat, start.lon], props.me ? 16 : 7);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(m);
    if (props.me) L.circleMarker([props.me.lat, props.me.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#ff3b30', fillOpacity: 1 }).addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => place({ lat: e.latlng.lat, lon: e.latlng.lng }));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  const doSearch = async (e: Event) => {
    e.preventDefault();
    if (!q.trim()) return;
    setMsg('搜尋中…');
    try {
      const r = await search(q.trim(), props.me);
      setHits(r);
      setMsg(r.length ? null : '找不到，換個關鍵字，或直接在地圖上點');
    } catch {
      setMsg('搜尋失敗，可能是網路不穩');
    }
  };

  return (
    <div class="picker">
      <form class="picker-bar" onSubmit={doSearch}>
        <button type="button" class="icon-btn" aria-label="關閉" onClick={props.onClose}>
          ✕
        </button>
        <input type="search" placeholder="搜尋地名，或直接點地圖" value={q} onInput={(e) => setQ(e.currentTarget.value)} enterKeyHint="search" />
        <button type="submit" class="chip">
          搜尋
        </button>
      </form>
      {(msg || hits?.length) && (
        <div class="picker-hits">
          {msg && <p class="muted small">{msg}</p>}
          {hits?.map((h) => (
            <button
              key={`${h.lat},${h.lon}`}
              type="button"
              class="hit"
              onClick={() => {
                place(h, h.name);
                map.current?.setView([h.lat, h.lon], 17);
                setHits(null);
              }}
            >
              <b>{h.name}</b>
              <span>{h.full}</span>
            </button>
          ))}
        </div>
      )}
      <div class="picker-map" ref={box} />
      <div class="picker-foot">
        <button type="button" class="btn primary" disabled={!at} onClick={() => at && props.onPick(at, name)}>
          {at ? '就是這裡' : '點地圖選一個位置'}
        </button>
      </div>
    </div>
  );
}
