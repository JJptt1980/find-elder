// 一個模式的畫面骨架：上方卡片、小字、滿版雷達、右上喇叭。三種模式都用它。
import type { ComponentChildren } from 'preact';
import { Radar, look, type Target } from '../radar/Radar';
import { compassLabel, fmtDist, type LatLon } from '../radar/geo';
import { useHeading } from '../sensors/heading';
import { useWakeLock } from '../sensors/wakeLock';
import { SoundBadge, useBeepFlash, useNearBeep, useSound } from './common';

export function RadarScreen<T extends Target>(props: {
  me: LatLon | null;
  targets: readonly T[];
  bestId?: string | null;
  maxKm: number;
  showLabels?: boolean;
  /** 要嗶嗶提醒的目標；沒給就是全部 */
  beepTargets?: readonly T[];
  onPick?: (t: T, count: number) => void;
  top: ComponentChildren;
  foot?: string;
  radarKey?: string;
}) {
  const heading = useHeading();
  const [sound, toggleSound] = useSound();
  const [beep, flash] = useBeepFlash();
  useWakeLock(true);
  useNearBeep(props.beepTargets ?? props.targets, sound, flash);
  const dir = heading.source === 'compass' ? '手機朝上' : heading.source === 'gps' ? '前進方向朝上' : '北方朝上';
  return (
    <div class="radar-page">
      {props.top}
      <p class="radar-foot">{props.foot ? `${props.foot}・${dir}` : dir}</p>
      <Radar
        key={props.radarKey}
        me={props.me}
        targets={props.targets}
        bestId={props.bestId}
        heading={heading.deg}
        maxKm={props.maxKm}
        showLabels={props.showLabels}
        sound={sound}
        onPick={props.onPick}
      >
        <SoundBadge key={beep?.at ?? 0} on={sound} beepBand={beep && Date.now() - beep.at < 1500 ? beep.band : 0} onToggle={toggleSound} />
      </Radar>
    </div>
  );
}

/** 最近的那一個在哪：箭頭（跟著手機方向轉）＋方位＋距離 */
export function Pointer(props: { me: LatLon; to: LatLon; title?: string; sub?: string }) {
  const heading = useHeading();
  const [s] = look(props.me, [{ ...props.to, id: 'x' }]);
  const rot = s!.bearing - (heading.deg ?? 0);
  return (
    <section class="radar-card">
      <div class="radar-main">
        <span class="arrow" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
          ↑
        </span>
        <span class="main-text">
          {props.title && <span class="main-title">{props.title}</span>}
          {compassLabel(s!.bearing)} {fmtDist(s!.distM)}
        </span>
      </div>
      {props.sub && <div class="radar-sub">{props.sub}</div>}
    </section>
  );
}
