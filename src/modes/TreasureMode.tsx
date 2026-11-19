// 尋寶遊戲畫面：一打開就在身邊撒七個寶物，範圍用雷達的縮放鈕看，不用選。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { onFix } from '../sensors/gps';
import { playCollect } from '../radar/radarSound';
import { look } from '../radar/Radar';
import { distanceM, fmtDist } from '../radar/geo';
import { Dialog } from '../ui/Dialog';
import { GPS_TEXT, load, save, useFix, useGpsStatus, vibrate } from '../ui/common';
import { Pointer, RadarScreen } from '../ui/RadarScreen';
import { GOOD_ACCURACY_M, HUNT_RADIUS_M, TOO_FAR_M, TREASURE_COUNT, collect, coverKm, remaining, scatter, type Hunt, type Treasure } from './treasure';

const HUNT_KEY = 'fe-hunt';

export function TreasureMode() {
  const fix = useFix();
  const gps = useGpsStatus();
  const [hunt, setHunt] = useState<Hunt | null>(() => load<Hunt | null>(HUNT_KEY, null));
  const [got, setGot] = useState<Treasure[] | null>(null);
  const huntRef = useRef(hunt);
  huntRef.current = hunt;

  const update = (h: Hunt | null) => {
    huntRef.current = h;
    save(HUNT_KEY, h);
    setHunt(h);
  };
  const start = () => {
    if (!fix) return;
    update(scatter(fix, HUNT_RADIUS_M, Date.now()));
    setGot(null);
  };

  // 還沒開始：等定位夠準（剛打開時常先拿到誤差好幾百公尺的網路定位）就自動撒
  const accurate = !!fix && fix.accuracy <= GOOD_ACCURACY_M;
  useEffect(() => {
    if (!hunt && accurate) start();
  }, [!hunt && accurate]);

  // 每一筆定位都檢查有沒有走到寶物旁邊
  useEffect(
    () =>
      onFix((f) => {
        const h = huntRef.current;
        if (!h) return;
        const r = collect(h, f, Date.now());
        if (!r.got.length) return;
        update(r.hunt);
        setGot(r.got);
        playCollect();
        vibrate([80, 60, 80, 60, 200]);
      }),
    [],
  );

  const left = useMemo(() => (hunt ? remaining(hunt) : []), [hunt]);
  const found = hunt ? TREASURE_COUNT - left.length : 0;
  const seen = useMemo(() => (fix ? look(fix, left) : []), [fix, left]);
  const nearest = seen[0]?.t ?? null;
  // 範圍一定蓋得到最遠的寶物，按縮放鈕再往內看
  const maxKm = coverKm(seen.at(-1)?.distM ?? 0);
  const tooFar = !!fix && !!hunt && left.length > 0 && distanceM(hunt.center, fix) > TOO_FAR_M;

  let top;
  if (!fix || !hunt) {
    top = <section class="radar-card muted">{fix ? `定位中…（誤差 ${Math.round(fix.accuracy)} m，等準一點再撒寶物）` : GPS_TEXT[gps] || '等待定位…'}</section>;
  } else if (tooFar) {
    top = (
      <section class="radar-card">
        <div class="radar-main">寶物都在 {fmtDist(seen[0]!.distM)} 外</div>
        <div class="radar-sub">你離上次撒寶物的地方太遠了</div>
        <button type="button" class="btn primary small-btn top-gap" onClick={start}>
          在這裡重新撒
        </button>
      </section>
    );
  } else if (nearest) {
    top = <Pointer me={fix} to={nearest} title="最近的寶物" sub={`已找到 ${found} / ${TREASURE_COUNT}`} />;
  } else {
    top = (
      <section class="radar-card">
        <div class="radar-main">七顆全部到齊！</div>
        <button type="button" class="btn primary small-btn top-gap" onClick={start}>
          再來一輪
        </button>
      </section>
    );
  }

  return (
    <>
      <RadarScreen radarKey={`hunt-${hunt?.startedAt ?? 0}`} me={fix} targets={left} bestId={nearest?.id ?? null} maxKm={maxKm} autoFit={false} top={top} foot="尋寶" />
      {got && (
        <Dialog title={left.length ? `找到第 ${got.map((t) => t.n).join('、')} 顆！` : '七顆全部到齊！'} onClose={() => setGot(null)}>
          <p class="big-emoji" aria-hidden="true">
            {left.length ? '✨' : '🎉'}
          </p>
          <p>{left.length ? `還差 ${left.length} 顆，雷達上找找看。` : '大長老感應到你的努力了。'}</p>
          {left.length ? (
            <button type="button" class="btn primary" onClick={() => setGot(null)}>
              繼續找
            </button>
          ) : (
            <button type="button" class="btn primary" onClick={start}>
              再來一輪
            </button>
          )}
        </Dialog>
      )}
    </>
  );
}
