// 七顆到齊後的召喚演出：天變暗 → 浮出字 → 搖晃震動 → 白光 → 標題卡 → 結局（四種輪流）。
// 七龍珠的梗只用文字：不畫神龍、不放原作音效和龍珠圖案，冒出來的東西永遠不現身。
import { useEffect, useRef, useState } from 'preact/hooks';
import { playRumble } from '../radar/radarSound';
import { vibrate } from '../ui/common';
import type { Ending } from './treasure';

export interface SummonInfo {
  ending: Ending;
  completedAll: boolean;
  rounds: number;
  walkedM: number;
  ms: number;
}

const TITLES: Record<Ending, string> = {
  undies: '願望實現了！？天上掉下來的那個東西',
  busy: '召喚成功！……嗎？',
  power: '大長老看見了！你隱藏的力量',
  nothing: '天地變色！傳說中的那個終於——',
};

const RUMBLE = [40, 400, 40, 300, 60, 250, 80, 200, 120, 150, 200, 100, 400, 80, 800];
/** 「什麼都沒有」那一種：演得最誇張，震更久 */
const RUMBLE_LONG = [...RUMBLE, 150, 300, 150, 200, 1500];

/** 演出的步驟：0 變暗、1 第一句、2 第二句、3 搖晃、4 白光、5 標題卡、6 結局 */
function schedule(long: boolean): number[] {
  const shake = long ? 5200 : 3200;
  const t3 = 3000;
  return [0, 1200, 2400, t3, t3 + shake, t3 + shake + 500, t3 + shake + 2300];
}

function fmtTime(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return '不到 1 分鐘';
  if (min < 60) return `${min} 分鐘`;
  return `${Math.floor(min / 60)} 小時 ${min % 60} 分鐘`;
}

export function Summon(props: { info: SummonInfo; onAgain: () => void; onClose: () => void }) {
  const { info } = props;
  const long = info.ending === 'nothing';
  const [step, setStep] = useState(0);
  // 收掉計時器、震動和地鳴（演完、跳過、關掉時都要）
  const stopRef = useRef(() => {});

  useEffect(() => {
    const times = schedule(long);
    let stopSound = () => {};
    const timers = times.slice(1).map((t, i) =>
      setTimeout(() => {
        setStep(i + 1);
        if (i + 1 === 3) {
          vibrate(long ? RUMBLE_LONG : RUMBLE);
          stopSound = playRumble((times[4]! - times[3]!) / 1000);
        }
      }, t),
    );
    stopRef.current = () => {
      timers.forEach(clearTimeout);
      vibrate(0);
      stopSound();
    };
    return () => stopRef.current();
  }, []);

  const skip = () => {
    stopRef.current();
    setStep(6);
  };

  return (
    <div class="summon" role="dialog" aria-modal="true" aria-label="七顆全部到齊">
      <div class="summon-stars" aria-hidden="true" />
      <div class={`summon-in${step === 3 ? ' shaking' : ''}`}>
      {step >= 1 && step <= 3 && (
        <div class="summon-lines">
          <p class="summon-line">天空……怎麼突然暗了？</p>
          {step >= 2 && <p class="summon-line">好像有什麼要出來了……</p>}
        </div>
      )}
      {step === 4 && <div class="summon-flash" aria-hidden="true" />}
      {step === 5 && (
        <div class="summon-title">
          <div class="summon-ep">第 {info.rounds} 話</div>
          <div class="summon-ep-name">{TITLES[info.ending]}</div>
        </div>
      )}
      {step >= 6 && (
        <div class="summon-end">
          <Ending info={info} />
          {info.completedAll && (
            <p class="summon-all">
              恭喜你湊滿了全部結局。
              <br />
              如果有意見，請洽開發者。
            </p>
          )}
          <div class="summon-btns">
            <button type="button" class="btn primary" onClick={props.onAgain}>
              {info.ending === 'busy' ? '好吧，再撒一次' : '再來一輪'}
            </button>
            <button type="button" class="btn secondary" onClick={props.onClose}>
              先休息一下
            </button>
          </div>
        </div>
      )}
      </div>
      {step < 6 && (
        // 看過的人可以跳過
        <button type="button" class="summon-skip" onClick={skip}>
          跳過
        </button>
      )}
    </div>
  );
}

function Ending({ info }: { info: SummonInfo }) {
  switch (info.ending) {
    case 'undies':
      return (
        <>
          <div class="summon-fall" aria-hidden="true">
            🩲
          </div>
          <p class="summon-big">你的願望已經實現了。</p>
          <p class="summon-small">（請不要問是誰許的。）</p>
        </>
      );
    case 'busy':
      return (
        <>
          <div class="summon-burst" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <span style={{ '--a': `${(i * 360) / 7}deg` }}>✨</span>
            ))}
          </div>
          <p class="summon-big">您召喚的對象目前不在服務區，請稍後再撥。</p>
          <p class="summon-small">（七顆又飛到四面八方去了。）</p>
        </>
      );
    case 'power':
      return (
        <>
          <p class="summon-big">大長老：嗯……你的潛力，我看到了。</p>
          <dl class="summon-stats">
            <dt>戰鬥力</dt>
            <dd>
              {Math.round(info.walkedM).toLocaleString()}
              <small>（走了幾公尺，用直線估算）</small>
            </dd>
            <dt>花了多久</dt>
            <dd>{fmtTime(info.ms)}</dd>
            <dt>破關紀錄</dt>
            <dd>第 {info.rounds} 輪</dd>
          </dl>
        </>
      );
    case 'nothing':
      return (
        <>
          <div class="summon-crawl" aria-hidden="true">
            <span>🐢</span>
          </div>
          <p class="summon-big">……就這樣。</p>
        </>
      );
  }
}
