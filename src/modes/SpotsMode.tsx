// 私房地圖畫面：地球、納美克星各七顆，之後的組別自己取名、不限數量。
import { useMemo, useState } from 'preact/hooks';
import { look } from '../radar/Radar';
import { compassLabel, fmtDist, type LatLon } from '../radar/geo';
import { Dialog } from '../ui/Dialog';
import { MapPicker } from '../ui/MapPicker';
import { GPS_TEXT, load, save, useFix, useGpsStatus } from '../ui/common';
import { Pointer, RadarScreen } from '../ui/RadarScreen';
import {
  DRAGON_LIMIT,
  NOT_A_FAN,
  activeGroup,
  addGroup,
  addSpot,
  emptyBook,
  isFull,
  limitOf,
  nextHome,
  parseLatLon,
  removeGroup,
  removeSpot,
  renameGroup,
  updateSpot,
  type Group,
  type Spot,
  type SpotBook,
} from './spots';

const BOOK_KEY = 'fe-spots';

type Flow =
  | { step: 'source' }
  | { step: 'map' }
  | { step: 'paste' }
  | { step: 'details'; at: LatLon; name: string; groupId: string }
  | { step: 'fan'; group: Group; draft?: { at: LatLon; name: string } }
  | { step: 'new-group'; draft?: { at: LatLon; name: string } }
  | { step: 'manage' }
  | { step: 'spot'; spot: Spot; count: number };

export function SpotsMode() {
  const fix = useFix();
  const gps = useGpsStatus();
  const [book, setBook] = useState<SpotBook>(() => load(BOOK_KEY, emptyBook()));
  const [flow, setFlow] = useState<Flow | null>(null);
  const group = activeGroup(book);
  const full = isFull(group);

  const update = (b: SpotBook) => {
    save(BOOK_KEY, b);
    setBook(b);
  };
  const setActive = (id: string) => update({ ...book, activeId: id });

  const nearest = useMemo(() => (fix && group.spots.length ? look(fix, group.spots)[0]!.t : null), [fix, group]);
  const maxKm = useMemo(() => {
    if (!fix || !group.spots.length) return 1;
    const far = look(fix, group.spots).at(-1)!.distM / 1000;
    for (const r of [0.5, 1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) if (r >= far * 1.15) return r;
    return 20000;
  }, [fix, group]);

  /** 按「存一個點」：組滿七顆就先被說不是粉絲 */
  const onAdd = () => setFlow(full ? { step: 'fan', group } : { step: 'source' });

  const countText = (g: Group) => {
    const l = limitOf(g);
    return l ? `${g.spots.length} / ${l} 顆` : `${g.spots.length} 個點`;
  };

  let card;
  if (!fix) card = <section class="radar-card muted">{GPS_TEXT[gps] || '等待定位…'}</section>;
  else if (!nearest)
    card = (
      <section class="radar-card">
        <div class="radar-main">{group.name}還是空的</div>
        <div class="radar-sub">{group.kind === 'custom' ? '存幾個你自己的記錄點吧' : `存下你的七個私房地點（${group.name}只有七顆）`}</div>
      </section>
    );
  else card = <Pointer me={fix} to={nearest} title={nearest.name} sub={`${group.name}・${countText(group)}`} />;

  return (
    <>
      <RadarScreen
        radarKey={`spots-${group.id}`}
        me={fix}
        targets={group.spots.map((s) => ({ ...s, label: s.name.length > 8 ? `${s.name.slice(0, 7)}…` : s.name }))}
        bestId={nearest?.id ?? null}
        maxKm={maxKm}
        showLabels
        onPick={(t, count) => {
          const spot = group.spots.find((s) => s.id === t.id);
          if (spot) setFlow({ step: 'spot', spot, count });
        }}
        top={
          <div class="card-stack">
            <div class="chips group-chips">
              {book.groups.map((g) => (
                <button key={g.id} type="button" class={`chip${g.id === group.id ? ' active' : ''}`} onClick={() => setActive(g.id)}>
                  {g.name}
                </button>
              ))}
              <button type="button" class="chip add-chip" aria-label="新增一組" onClick={() => setFlow({ step: 'new-group' })}>
                ＋
              </button>
            </div>
            {card}
            <div class="btn-row">
              <button type="button" class="btn primary small-btn" onClick={onAdd}>
                {full ? `新增第 ${DRAGON_LIMIT + 1} 顆` : '＋ 存一個點'}
              </button>
              <button type="button" class="btn secondary small-btn" onClick={() => setFlow({ step: 'manage' })}>
                管理
              </button>
            </div>
          </div>
        }
        foot={`私房地圖・${group.name} ${countText(group)}`}
      />

      {flow?.step === 'source' && (
        <Dialog title={`存到${group.name}`} onClose={() => setFlow(null)}>
          <div class="btn-col">
            <button
              type="button"
              class="btn primary"
              disabled={!fix}
              onClick={() => fix && setFlow({ step: 'details', at: { lat: fix.lat, lon: fix.lon }, name: '', groupId: group.id })}
            >
              存目前位置{fix ? `（誤差約 ${Math.round(fix.accuracy)} m）` : '（還沒定位）'}
            </button>
            <button type="button" class="btn secondary" onClick={() => setFlow({ step: 'map' })}>
              在地圖上選／搜尋地名
            </button>
            <button type="button" class="btn secondary" onClick={() => setFlow({ step: 'paste' })}>
              貼上 Google 地圖的座標
            </button>
          </div>
        </Dialog>
      )}

      {flow?.step === 'map' && (
        <MapPicker me={fix} onClose={() => setFlow({ step: 'source' })} onPick={(at, name) => setFlow({ step: 'details', at, name, groupId: group.id })} />
      )}

      {flow?.step === 'paste' && <PasteDialog onBack={() => setFlow({ step: 'source' })} onDone={(at) => setFlow({ step: 'details', at, name: '', groupId: group.id })} />}

      {flow?.step === 'details' && (
        <DetailsDialog
          me={fix}
          book={book}
          at={flow.at}
          name={flow.name}
          groupId={flow.groupId}
          onClose={() => setFlow(null)}
          onFull={(g, draft) => setFlow({ step: 'fan', group: g, draft })}
          onNewGroup={(draft) => setFlow({ step: 'new-group', draft })}
          onSave={(groupId, name) => {
            const b = addSpot(book, groupId, { ...flow.at, name }, Date.now());
            if (!b) return;
            update({ ...b, activeId: groupId });
            setFlow(null);
          }}
        />
      )}

      {flow?.step === 'fan' && (
        <FanDialog
          book={book}
          group={flow.group}
          onClose={() => setFlow(null)}
          onGo={(g) => {
            if (flow.draft) setFlow({ step: 'details', ...flow.draft, groupId: g.id });
            else {
              setActive(g.id);
              setFlow({ step: 'source' });
            }
          }}
          onNewGroup={() => setFlow({ step: 'new-group', draft: flow.draft })}
        />
      )}

      {flow?.step === 'new-group' && (
        <NameDialog
          title="新增一組"
          hint="第三組以後自己取名，只是記錄點，存幾個都可以。"
          placeholder={`第 ${book.groups.filter((g) => g.kind === 'custom').length + 3} 組`}
          onClose={() => setFlow(null)}
          onSave={(name) => {
            const b = addGroup(book, name, Date.now());
            update(b);
            setFlow(flow.draft ? { step: 'details', ...flow.draft, groupId: b.activeId } : null);
          }}
        />
      )}

      {flow?.step === 'manage' && <ManageDialog me={fix} book={book} group={group} update={update} onClose={() => setFlow(null)} />}

      {flow?.step === 'spot' && (
        <SpotDialog
          me={fix}
          spot={flow.spot}
          count={flow.count}
          onClose={() => setFlow(null)}
          onRename={(name) => update(updateSpot(book, flow.spot.id, { name }))}
          onDelete={() => {
            update(removeSpot(book, flow.spot.id));
            setFlow(null);
          }}
        />
      )}
    </>
  );
}

function FanDialog(props: { book: SpotBook; group: Group; onClose: () => void; onGo: (g: Group) => void; onNewGroup: () => void }) {
  const home = nextHome(props.book, props.group.id);
  return (
    <Dialog title={NOT_A_FAN} onClose={props.onClose}>
      <p class="big-emoji" aria-hidden="true">
        🙅
      </p>
      <p>
        {props.group.name}只有 {DRAGON_LIMIT} 顆，不能再多了。
        {home ? `要存更多，可以去${home.name}${home.kind === 'custom' ? '' : `（還有 ${DRAGON_LIMIT - home.spots.length} 個位置）`}，或開一組自訂的。` : '要存更多就開一組自訂的，自訂組不限數量。'}
      </p>
      <div class="btn-col">
        {home && (
          <button type="button" class="btn primary" onClick={() => props.onGo(home)}>
            {home.kind === 'custom' ? `存到「${home.name}」` : `前往${home.name}`}
          </button>
        )}
        <button type="button" class={`btn ${home ? 'secondary' : 'primary'}`} onClick={props.onNewGroup}>
          開一組自訂的
        </button>
        <button type="button" class="btn secondary" onClick={props.onClose}>
          好啦
        </button>
      </div>
    </Dialog>
  );
}

function PasteDialog(props: { onBack: () => void; onDone: (at: LatLon) => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    const r = parseLatLon(text);
    if (r === 'short-link') setErr('這是短網址，網頁沒辦法讀。請在 Google 地圖長按那個地點，複製上方出現的座標（像 25.0330, 121.5654）再貼過來。');
    else if (!r) setErr('看不出座標。可以貼「25.0330, 121.5654」這種格式，或網址列上的長網址。');
    else props.onDone(r);
  };
  return (
    <Dialog title="貼上座標" onClose={props.onBack}>
      <p class="muted small">在 Google 地圖長按一個地點，上方會出現座標，點它就會複製，再回來貼在這裡。</p>
      <label class="field">
        <span>座標或網址</span>
        <input value={text} placeholder="25.0330, 121.5654" onInput={(e) => setText(e.currentTarget.value)} />
      </label>
      {err && <p class="error">{err}</p>}
      <div class="btn-row">
        <button
          type="button"
          class="btn secondary"
          onClick={async () => {
            try {
              setText(await navigator.clipboard.readText());
            } catch {
              setErr('讀不到剪貼簿，請長按輸入框貼上');
            }
          }}
        >
          從剪貼簿貼上
        </button>
        <button type="button" class="btn primary" disabled={!text.trim()} onClick={submit}>
          下一步
        </button>
      </div>
    </Dialog>
  );
}

function DetailsDialog(props: {
  me: LatLon | null;
  book: SpotBook;
  at: LatLon;
  name: string;
  groupId: string;
  onClose: () => void;
  onFull: (g: Group, draft: { at: LatLon; name: string }) => void;
  onNewGroup: (draft: { at: LatLon; name: string }) => void;
  onSave: (groupId: string, name: string) => void;
}) {
  const [name, setName] = useState(props.name);
  const [gid, setGid] = useState(props.groupId);
  const g = props.book.groups.find((x) => x.id === gid) ?? props.book.groups[0]!;
  const draft = { at: props.at, name };
  const where = props.me ? look(props.me, [{ ...props.at, id: 'x' }])[0]! : null;
  return (
    <Dialog title="存一個點" onClose={props.onClose}>
      <p class="muted small">
        {where ? `${compassLabel(where.bearing)}方 ${fmtDist(where.distM)}・` : ''}
        {props.at.lat.toFixed(5)}, {props.at.lon.toFixed(5)}
      </p>
      <label class="field">
        <span>名字</span>
        <input value={name} placeholder={`記錄點 ${g.spots.length + 1}`} maxLength={30} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <div class="field">
        <span>存到哪一組</span>
        <div class="chips">
          {props.book.groups.map((x) => (
            <button
              key={x.id}
              type="button"
              class={`chip${x.id === gid ? ' active' : ''}${isFull(x) ? ' full' : ''}`}
              onClick={() => (isFull(x) ? props.onFull(x, draft) : setGid(x.id))}
            >
              {x.name}
              {limitOf(x) ? ` ${x.spots.length}/${limitOf(x)}` : ''}
            </button>
          ))}
          <button type="button" class="chip add-chip" aria-label="新增一組" onClick={() => props.onNewGroup(draft)}>
            ＋
          </button>
        </div>
      </div>
      <button type="button" class="btn primary" onClick={() => (isFull(g) ? props.onFull(g, draft) : props.onSave(g.id, name))}>
        存起來
      </button>
    </Dialog>
  );
}

function NameDialog(props: { title: string; hint?: string; placeholder: string; initial?: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(props.initial ?? '');
  return (
    <Dialog title={props.title} onClose={props.onClose}>
      {props.hint && <p class="muted small">{props.hint}</p>}
      <label class="field">
        <span>名字</span>
        <input value={name} placeholder={props.placeholder} maxLength={20} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <button type="button" class="btn primary" onClick={() => props.onSave(name)}>
        好
      </button>
    </Dialog>
  );
}

function ManageDialog(props: { me: LatLon | null; book: SpotBook; group: Group; update: (b: SpotBook) => void; onClose: () => void }) {
  const { book, group } = props;
  const [confirm, setConfirm] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const dist = (s: Spot) => (props.me ? fmtDist(look(props.me, [s])[0]!.distM) : '');
  if (renaming)
    return (
      <NameDialog
        title="改組名"
        placeholder={group.name}
        initial={group.name}
        onClose={() => setRenaming(false)}
        onSave={(name) => {
          props.update(renameGroup(book, group.id, name));
          setRenaming(false);
        }}
      />
    );
  return (
    <Dialog title={group.name} onClose={props.onClose}>
      {group.spots.length === 0 ? (
        <p class="muted">這一組還沒有記錄點。</p>
      ) : (
        <ul class="spot-list">
          {group.spots.map((s, i) => (
            <li key={s.id}>
              <span class="spot-n">{i + 1}</span>
              <span class="spot-name">{s.name}</span>
              <span class="muted small">{dist(s)}</span>
              {confirm === s.id ? (
                <button type="button" class="chip danger-chip" onClick={() => props.update(removeSpot(book, s.id))}>
                  確定刪除
                </button>
              ) : (
                <button type="button" class="icon-btn" aria-label={`刪除 ${s.name}`} onClick={() => setConfirm(s.id)}>
                  🗑
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {group.kind === 'custom' && (
        <div class="btn-row">
          <button type="button" class="btn secondary" onClick={() => setRenaming(true)}>
            改組名
          </button>
          {confirm === group.id ? (
            <button
              type="button"
              class="btn danger"
              onClick={() => {
                props.update(removeGroup(book, group.id));
                props.onClose();
              }}
            >
              確定刪除整組
            </button>
          ) : (
            <button type="button" class="btn danger" onClick={() => setConfirm(group.id)}>
              刪除這一組
            </button>
          )}
        </div>
      )}
    </Dialog>
  );
}

function SpotDialog(props: { me: LatLon | null; spot: Spot; count: number; onClose: () => void; onRename: (name: string) => void; onDelete: () => void }) {
  const [name, setName] = useState(props.spot.name);
  const [confirm, setConfirm] = useState(false);
  const where = props.me ? look(props.me, [props.spot])[0]! : null;
  return (
    <Dialog title={props.spot.name} onClose={props.onClose}>
      {where && (
        <p>
          {compassLabel(where.bearing)}方 {fmtDist(where.distM)}
        </p>
      )}
      {props.count > 1 && <p class="muted small">這附近還有 {props.count - 1} 個點擠在一起，放大雷達就會分開。</p>}
      <label class="field">
        <span>名字</span>
        <input value={name} maxLength={30} onInput={(e) => setName(e.currentTarget.value)} onBlur={() => name.trim() && props.onRename(name.trim())} />
      </label>
      <a class="btn primary as-link" href={`https://www.google.com/maps/search/?api=1&query=${props.spot.lat},${props.spot.lon}`} target="_blank" rel="noopener">
        在 Google 地圖打開
      </a>
      <button type="button" class="btn danger" onClick={() => (confirm ? props.onDelete() : setConfirm(true))}>
        {confirm ? '確定刪除' : '刪除這個點'}
      </button>
    </Dialog>
  );
}
