// 附近好吃的畫面
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { look } from '../radar/Radar';
import { compassLabel, distanceM, fmtDist, type LatLon } from '../radar/geo';
import { Dialog } from '../ui/Dialog';
import { GPS_TEXT, load, save, useFix, useGpsStatus } from '../ui/common';
import { Pointer, RadarScreen } from '../ui/RadarScreen';
import { KIND_LABEL, MAX_PLACES, REFETCH_M, SEARCH_M, amenityLabel, cuisineText, fetchPlaces, type FoodKind, type Place } from './food';

const CACHE_KEY = 'fe-food';
const FILTER_KEY = 'fe-food-filter';
type Filter = FoodKind | 'all';

interface Cache {
  at: LatLon;
  places: Place[];
}

export function FoodMode() {
  const fix = useFix();
  const gps = useGpsStatus();
  const [cache, setCache] = useState<Cache | null>(() => load<Cache | null>(CACHE_KEY, null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(() => load<Filter>(FILTER_KEY, 'all'));
  const [picked, setPicked] = useState<{ p: Place; count: number } | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const refresh = (at: LatLon) => {
    inflight.current?.abort();
    const ctl = new AbortController();
    inflight.current = ctl;
    setBusy(true);
    setError(null);
    fetchPlaces(at, ctl.signal)
      .then((places) => {
        const c = { at: { lat: at.lat, lon: at.lon }, places };
        save(CACHE_KEY, c);
        setCache(c);
      })
      .catch(() => {
        if (!ctl.signal.aborted) setError('抓不到店家資料，可能是網路不穩，等一下再試');
      })
      .finally(() => {
        if (inflight.current === ctl) setBusy(false);
      });
  };

  // 第一次定位、或離上次搜尋的地方超過 300 公尺時重新找
  const needFetch = !!fix && !busy && !error && (!cache || distanceM(cache.at, fix) > REFETCH_M);
  useEffect(() => {
    if (needFetch && fix) refresh(fix);
  }, [needFetch]);
  useEffect(() => () => inflight.current?.abort(), []);

  const shown = useMemo(() => {
    if (!cache || !fix) return [];
    const all = filter === 'all' ? cache.places : cache.places.filter((p) => p.kind === filter);
    return look(fix, all)
      .filter((s) => s.distM <= SEARCH_M * 1.2)
      .slice(0, MAX_PLACES)
      .map((s) => s.t);
    // 位置每一筆都會變，但店家清單只在移動一段距離後才需要重排
  }, [cache, filter, fix && Math.round(fix.lat * 2000), fix && Math.round(fix.lon * 2000)]);
  const nearest = shown[0] ?? null;

  const pickFilter = (f: Filter) => {
    save(FILTER_KEY, f);
    setFilter(f);
  };

  const chips = (
    <div class="chips filter-chips">
      {(['all', 'restaurant', 'snack', 'cafe'] as const).map((f) => (
        <button key={f} type="button" class={`chip${filter === f ? ' active' : ''}`} onClick={() => pickFilter(f)}>
          {f === 'all' ? '全部' : KIND_LABEL[f]}
        </button>
      ))}
    </div>
  );

  let card;
  if (!fix) card = <section class="radar-card muted">{GPS_TEXT[gps] || '等待定位…'}</section>;
  else if (error)
    card = (
      <section class="radar-card">
        <div class="radar-sub">{error}</div>
        <button type="button" class="btn secondary small-btn" onClick={() => refresh(fix)}>
          再試一次
        </button>
      </section>
    );
  else if (!cache || (busy && !shown.length)) card = <section class="radar-card muted">正在找附近好吃的…</section>;
  else if (!nearest) card = <section class="radar-card muted">1 公里內沒有找到{filter === 'all' ? '' : KIND_LABEL[filter]}</section>;
  else card = <Pointer me={fix} to={nearest} title={nearest.name} sub={`最近的${amenityLabel(nearest.amenity)}・附近共 ${shown.length} 家`} />;

  return (
    <>
      <RadarScreen
        radarKey={`food-${filter}`}
        me={fix}
        targets={shown}
        bestId={nearest?.id ?? null}
        beepTargets={[]}
        maxKm={1}
        showLabels
        onPick={(p, count) => setPicked({ p, count })}
        top={
          <div class="card-stack">
            {card}
            {chips}
          </div>
        }
        foot={`${busy ? '更新中…・' : ''}資料 © OpenStreetMap 貢獻者`}
      />
      {picked && fix && <PlaceDialog me={fix} p={picked.p} count={picked.count} onClose={() => setPicked(null)} />}
    </>
  );
}

function PlaceDialog(props: { me: LatLon; p: Place; count: number; onClose: () => void }) {
  const { p } = props;
  const [s] = look(props.me, [p]);
  const cuisine = cuisineText(p.cuisine);
  return (
    <Dialog title={p.name} onClose={props.onClose}>
      <dl class="facts">
        <dt>類型</dt>
        <dd>
          {amenityLabel(p.amenity)}
          {cuisine && `・${cuisine}`}
        </dd>
        <dt>在哪</dt>
        <dd>
          {compassLabel(s!.bearing)}方 {fmtDist(s!.distM)}
        </dd>
        {p.hours && (
          <>
            <dt>營業時間</dt>
            <dd class="hours">{p.hours}</dd>
          </>
        )}
      </dl>
      {props.count > 1 && <p class="muted small">這附近還有 {props.count - 1} 家擠在一起，放大雷達就會分開。</p>}
      <a class="btn primary as-link" href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`} target="_blank" rel="noopener">
        在 Google 地圖打開
      </a>
    </Dialog>
  );
}
