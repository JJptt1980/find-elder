// 尋寶遊戲畫面
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { onFix } from '../sensors/gps';
import { playCollect } from '../radar/radarSound';
import { Dialog } from '../ui/Dialog';
import { GPS_TEXT, load, save, useFix, useGpsStatus, vibrate } from '../ui/common';
import { Pointer, RadarScreen } from '../ui/RadarScreen';
import { RANGES, TREASURE_COUNT, collect, remaining, scatter, type Hunt, type Treasure } from './treasure';

const HUNT_KEY = 'fe-hunt';
const RANGE_KEY = 'fe-hunt-range';

export function TreasureMode() {
  const fix = useFix();
  const gps = useGpsStatus();
  const [hunt, setHunt] = useState<Hunt | null>(() => load<Hunt | null>(HUNT_KEY, null));
  const [rangeM, setRangeM] = useState<number>(() => load(RANGE_KEY, 800));
  const [got, setGot] = useState<Treasure[] | null>(null);
  const [setup, setSetup] = useState(false);
  const huntRef = useRef(hunt);
  huntRef.current = hunt;

  const update = (h: Hunt | null) => {
    save(HUNT_KEY, h);
    setHunt(h);
  };

  // 每一筆定位都檢查有沒有走到寶物旁邊
  useEffect(
    () =>
      onFix((f) => {
        const h = huntRef.current;
        if (!h) return;
        const r = collect(h, f, Date.now());
        if (!r.got.length) return;
        huntRef.current = r.hunt;
        update(r.hunt);
        setGot(r.got);
        playCollect();
        vibrate([80, 60, 80, 60, 200]);
      }),
    [],
  );

  const start = (m: number) => {
    if (!fix) return;
    save(RANGE_KEY, m);
    setRangeM(m);
    update(scatter(fix, m, Date.now()));
    setSetup(false);
    setGot(null);
  };

  const left = useMemo(() => (hunt ? remaining(hunt) : []), [hunt]);
  const found = hunt ? TREASURE_COUNT - left.length : 0;
  const nearest = useMemo(() => {
    if (!fix || !left.length) return null;
    let best: Treasure | null = null;
    let bestD = Infinity;
    for (const t of left) {
      const d = Math.hypot(t.lat - fix.lat, (t.lon - fix.lon) * Math.cos((fix.lat * Math.PI) / 180));
      if (d < bestD) [best, bestD] = [t, d];
    }
    return best;
  }, [fix, left]);
  const maxKm = Math.max(0.5, ((hunt?.radiusM ?? rangeM) * 1.25) / 1000);

  let top;
  if (!fix) {
    top = <section class="radar-card muted">{GPS_TEXT[gps] || '等待定位…'}</section>;
  } else if (!hunt) {
    top = (
      <section class="radar-card">
        <div class="radar-main">撒七個寶物在你附近</div>
        <div class="radar-sub">選一個範圍，走過去把它們全部撿回來</div>
        <RangeChips value={rangeM} onPick={start} />
      </section>
    );
  } else if (nearest) {
    top = (
      <div class="card-stack">
        <Pointer me={fix} to={nearest} title="最近的寶物" sub={`已找到 ${found} / ${TREASURE_COUNT}`} />
        <button type="button" class="link-btn" onClick={() => setSetup(true)}>
          重新撒一次
        </button>
      </div>
    );
  } else {
    top = (
      <section class="radar-card">
        <div class="radar-main">七顆全部到齊！</div>
        <div class="radar-sub">再撒一輪？</div>
        <RangeChips value={rangeM} onPick={start} />
      </section>
    );
  }

  return (
    <>
      <RadarScreen
        radarKey={`hunt-${hunt?.startedAt ?? 0}`}
        me={fix}
        targets={left}
        bestId={nearest?.id ?? null}
        maxKm={maxKm}
        top={top}
        foot={hunt ? `尋寶・範圍 ${hunt.radiusM >= 1000 ? `${hunt.radiusM / 1000} km` : `${hunt.radiusM} m`}` : '尋寶'}
      />
      {got && (
        <Dialog title={left.length ? `找到第 ${got.map((t) => t.n).join('、')} 顆！` : '七顆全部到齊！'} onClose={() => setGot(null)}>
          <p class="big-emoji" aria-hidden="true">
            {left.length ? '✨' : '🎉'}
          </p>
          <p>{left.length ? `還差 ${left.length} 顆，雷達上找找看。` : '大長老感應到你的努力了。要再來一輪嗎？'}</p>
          {left.length ? (
            <button type="button" class="btn primary" onClick={() => setGot(null)}>
              繼續找
            </button>
          ) : (
            <RangeChips value={rangeM} onPick={start} />
          )}
        </Dialog>
      )}
      {setup && (
        <Dialog title="重新撒一次" onClose={() => setSetup(false)}>
          <p>目前找到的會清掉，在你現在的位置周圍重新撒七個。</p>
          <RangeChips value={rangeM} onPick={start} />
        </Dialog>
      )}
    </>
  );
}

function RangeChips(props: { value: number; onPick: (m: number) => void }) {
  return (
    <div class="chips range-chips">
      {RANGES.map((r) => (
        <button key={r.m} type="button" class={`chip${props.value === r.m ? ' active' : ''}`} onClick={() => props.onPick(r.m)}>
          {r.label}
        </button>
      ))}
    </div>
  );
}
