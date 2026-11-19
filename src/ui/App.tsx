// 尋找大長老：三種雷達模式，下方分頁切換。
import { useState } from 'preact/hooks';
import { FoodMode } from '../modes/FoodMode';
import { SpotsMode } from '../modes/SpotsMode';
import { TreasureMode } from '../modes/TreasureMode';
import { Dialog } from './Dialog';
import { load, save } from './common';

type Tab = 'treasure' | 'food' | 'spots';
const TAB_KEY = 'fe-tab';
const WELCOME_KEY = 'fe-welcome';

const TABS: { id: Tab; label: string; icon: preact.JSX.Element }[] = [
  {
    id: 'treasure',
    label: '尋寶',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
      </svg>
    ),
  },
  {
    id: 'food',
    label: '好吃的',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
        <path d="M7 3v8M4.5 3v5a2.5 2.5 0 0 0 5 0V3M7 11v10M17 21V3c-2.2 1.2-3.5 3.8-3.5 7v3H17" />
      </svg>
    ),
  },
  {
    id: 'spots',
    label: '私房地圖',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
        <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
      </svg>
    ),
  },
];

export function App() {
  const [tab, setTab] = useState<Tab>(() => load<Tab>(TAB_KEY, 'treasure'));
  const [welcome, setWelcome] = useState(() => !load(WELCOME_KEY, false));
  const pick = (t: Tab) => {
    save(TAB_KEY, t);
    setTab(t);
  };
  return (
    <div class="app fit">
      <main class="page">
        {tab === 'treasure' && <TreasureMode />}
        {tab === 'food' && <FoodMode />}
        {tab === 'spots' && <SpotsMode />}
      </main>
      <nav class="tabbar">
        {TABS.map((t) => (
          <button key={t.id} type="button" class={`tab${tab === t.id ? ' active' : ''}`} onClick={() => pick(t.id)}>
            <span class="tab-icon">{t.icon}</span>
            <span class="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>
      {welcome && (
        <Dialog
          title="尋找大長老"
          onClose={() => {
            save(WELCOME_KEY, true);
            setWelcome(false);
          }}
        >
          <p>一個好玩的雷達。三種玩法：</p>
          <ul class="steps">
            <li>
              <b>尋寶</b>：在你身邊撒七個寶物，走過去撿。
            </li>
            <li>
              <b>好吃的</b>：附近一公里的餐廳、小吃、咖啡店。
            </li>
            <li>
              <b>私房地圖</b>：存下你自己的秘密地點，靠近時會嗶嗶叫。
            </li>
          </ul>
          <p class="muted small">需要定位權限。走路時請注意路況，不要邊走邊盯著手機。</p>
          <button
            type="button"
            class="btn primary"
            onClick={() => {
              save(WELCOME_KEY, true);
              setWelcome(false);
            }}
          >
            開始
          </button>
        </Dialog>
      )}
    </div>
  );
}
