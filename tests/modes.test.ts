import { describe, expect, it } from 'vitest';
import { destination, distanceM, bearingDeg } from '../src/radar/geo';
import { ENDINGS, collect, coverKm, emptySaga, finishRound, pickRadius, remaining, roundStats, scatter } from '../src/modes/treasure';
import { rank, variants } from '../src/ui/geocode';
import {
  DRAGON_LIMIT,
  addGroup,
  addSpot,
  emptyBook,
  isFull,
  nextHome,
  parseLatLon,
  removeGroup,
  type SpotBook,
} from '../src/modes/spots';
import { buildQuery, parsePlaces, rowToPlace, shortName, tileKey, tilesAround } from '../src/modes/food';
import { compassFromAlpha, smoothAngle } from '../src/sensors/heading';

const HOME = { lat: 24.99, lon: 121.3 };

/** 固定種子的亂數 */
function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

describe('地理', () => {
  it('destination 走出去的距離和方位對得上', () => {
    const p = destination(HOME, 45, 500);
    expect(distanceM(HOME, p)).toBeCloseTo(500, 0);
    expect(bearingDeg(HOME, p)).toBeCloseTo(45, 0);
  });
  it('方向平滑與指南針換算', () => {
    const s = smoothAngle(350, 10, 0.5);
    expect(s < 5 || s > 355).toBe(true);
    expect(compassFromAlpha(90)).toBe(270);
  });
});

describe('尋寶', () => {
  it('撒七個，都在範圍內、不會太靠近自己，編號由近到遠', () => {
    const h = scatter(HOME, 800, 1, seeded(7));
    expect(h.items).toHaveLength(7);
    const d = h.items.map((t) => distanceM(HOME, t));
    for (const x of d) {
      expect(x).toBeGreaterThanOrEqual(79);
      expect(x).toBeLessThanOrEqual(801);
    }
    expect(h.items.map((t) => t.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
  });
  it('完全隨機，但任兩顆至少隔 15% 半徑', () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      const h = scatter(HOME, 800, 1, seeded(seed));
      for (const a of h.items) for (const b of h.items) if (a !== b) expect(distanceM(a, b)).toBeGreaterThanOrEqual(120 - 1);
    }
  });
  it('100 公尺的小範圍：離自己、兩顆之間都至少 30 公尺', () => {
    for (const seed of [1, 2, 3, 42, 99]) {
      const h = scatter(HOME, 100, 1, seeded(seed));
      expect(h.items).toHaveLength(7);
      for (const a of h.items) {
        expect(distanceM(HOME, a)).toBeGreaterThanOrEqual(29);
        expect(distanceM(HOME, a)).toBeLessThanOrEqual(101);
        for (const b of h.items) if (a !== b) expect(distanceM(a, b)).toBeGreaterThanOrEqual(29);
      }
    }
  });
  it('不會每次都平均分在七個方向', () => {
    // 換幾種亂數，至少有一次某個 1/7 扇區放了兩顆以上
    const crowded = [1, 2, 3, 4, 5, 6, 7, 8].some((seed) => {
      const h = scatter(HOME, 800, 1, seeded(seed));
      const sectors = h.items.map((t) => Math.floor(bearingDeg(HOME, t) / (360 / 7)));
      return new Set(sectors).size < 7;
    });
    expect(crowded).toBe(true);
  });
  it('走到 25 公尺內才撿到，撿過的不會再撿', () => {
    const h = scatter(HOME, 300, 1, seeded(11));
    const t = h.items[2]!;
    const far = destination(t, 0, 40);
    expect(collect(h, { ...far, accuracy: 10 }, 2).got).toHaveLength(0);
    const near = destination(t, 0, 15);
    const r = collect(h, { ...near, accuracy: 10 }, 2);
    expect(r.got.map((x) => x.id)).toEqual([t.id]);
    expect(remaining(r.hunt)).toHaveLength(6);
    expect(collect(r.hunt, { ...near, accuracy: 10 }, 3).got).toHaveLength(0);
  });
  it('定位誤差大時撿取範圍放寬，但最多 50 公尺', () => {
    expect([pickRadius(5), pickRadius(35), pickRadius(200)]).toEqual([25, 35, 50]);
  });
});

describe('私房地圖', () => {
  const fill = (b: SpotBook, id: string, n: number) => {
    for (let i = 0; i < n; i++) b = addSpot(b, id, { lat: 25, lon: 121 + i / 1000, name: '' }, i)!;
    return b;
  };
  it('地球和納美克星各只能七顆，第八顆不給存', () => {
    let b = fill(emptyBook(), 'earth', DRAGON_LIMIT);
    expect(isFull(b.groups[0]!)).toBe(true);
    expect(addSpot(b, 'earth', { lat: 25, lon: 121, name: '第八顆' }, 99)).toBeNull();
    expect(nextHome(b, 'earth')?.name).toBe('納美克星');
    b = fill(b, 'namek', DRAGON_LIMIT);
    expect(addSpot(b, 'namek', { lat: 25, lon: 121, name: 'x' }, 99)).toBeNull();
    expect(nextHome(b, 'namek')).toBeNull();
  });
  it('沒取名字就自動編號', () => {
    const b = fill(emptyBook(), 'earth', 2);
    expect(b.groups[0]!.spots.map((s) => s.name)).toEqual(['記錄點 1', '記錄點 2']);
  });
  it('第三組以後自訂名字、不限數量；只有自訂組能刪', () => {
    let b = addGroup(emptyBook(), '  宵夜  ', 5);
    expect(b.groups[2]).toMatchObject({ name: '宵夜', kind: 'custom' });
    expect(b.activeId).toBe(b.groups[2]!.id);
    b = fill(b, b.activeId, 20);
    expect(b.groups[2]!.spots).toHaveLength(20);
    expect(isFull(b.groups[2]!)).toBe(false);
    expect(addGroup(b, '', 6).groups[3]!.name).toBe('第 4 組');
    expect(removeGroup(b, 'earth').groups).toHaveLength(3);
    const r = removeGroup(b, b.groups[2]!.id);
    expect(r.groups).toHaveLength(2);
    expect(r.activeId).toBe('earth');
  });
  it('讀得懂各種座標格式', () => {
    expect(parseLatLon('25.0330, 121.5654')).toEqual({ lat: 25.033, lon: 121.5654 });
    expect(parseLatLon('(25.0330,121.5654)')).toEqual({ lat: 25.033, lon: 121.5654 });
    expect(parseLatLon('https://www.google.com/maps/place/x/@25.0339639,121.5644722,17z/data=!3m1!4b1!4m6!3m5!8m2!3d25.0339640!4d121.5644720')).toEqual({ lat: 25.033964, lon: 121.564472 });
    expect(parseLatLon('https://www.google.com/maps/@24.99,121.3,15z')).toEqual({ lat: 24.99, lon: 121.3 });
    expect(parseLatLon('https://maps.google.com/?q=24.5,121.2')).toEqual({ lat: 24.5, lon: 121.2 });
    expect(parseLatLon('https://maps.app.goo.gl/AbCdEf')).toBe('short-link');
    expect(parseLatLon('台北 101')).toBeNull();
    expect(parseLatLon('95, 121')).toBeNull();
  });
});

describe('好吃的', () => {
  it('查詢字串帶位置和半徑', () => {
    const q = buildQuery(HOME, 1000);
    expect(q).toContain('around:1000,24.99000,121.30000');
    expect(q).toContain('restaurant');
  });
  it('只留有名字、有位置的店，分好類', () => {
    const out = parsePlaces({
      elements: [
        { type: 'node', id: 1, lat: 25, lon: 121, tags: { amenity: 'restaurant', name: '阿婆麵' } },
        { type: 'way', id: 2, center: { lat: 25.1, lon: 121.1 }, tags: { amenity: 'cafe', name: 'Cafe' } },
        { type: 'node', id: 3, lat: 25, lon: 121, tags: { amenity: 'fast_food' } },
        { type: 'node', id: 4, lat: 25, lon: 121, tags: { shop: 'bakery', name: '麵包' } },
      ],
    });
    expect(out.map((p) => [p.id, p.kind])).toEqual([
      ['node/1', 'restaurant'],
      ['way/2', 'cafe'],
      ['node/4', 'cafe'],
    ]);
  });
  it('名字太長會截短', () => {
    expect(shortName('一二三四五六七八九十')).toBe('一二三四五六七…');
    expect(shortName('短')).toBe('短');
  });
});

describe('尋寶範圍', () => {
  it('雷達一定蓋得到最遠的寶物，至少 1 公里', () => {
    expect([coverKm(0), coverKm(100), coverKm(300), coverKm(800), coverKm(1200), coverKm(4000)]).toEqual([0.3, 0.3, 0.5, 1, 1.5, 5]);
  });
});

describe('好吃的方格資料', () => {
  it('格子編號與身邊 1 公里碰到的格子', () => {
    expect(tileKey(25.0339, 121.5645, 0.02)).toBe('1251_6078');
    const keys = tilesAround({ lat: 25.0339, lon: 121.5645 }, 1000, 0.02);
    expect(keys).toContain('1251_6078');
    expect(keys.length).toBeGreaterThanOrEqual(1);
    expect(keys.length).toBeLessThanOrEqual(4);
  });
  it('方格一列轉成店家', () => {
    expect(rowToPlace([25, 121, '阿婆麵', 'f', 'noodle'])).toMatchObject({ kind: 'snack', amenity: 'fast_food', cuisine: 'noodle' });
    expect(rowToPlace([25, 121, '麵包', 'b'])).toMatchObject({ kind: 'cafe', amenity: 'bakery' });
    expect(rowToPlace([25, 121, '?', 'z'])).toBeNull();
  });
});

describe('地名搜尋', () => {
  it('一零一、臺／台、大樓都換成找得到的寫法', () => {
    expect(variants('一零一大樓')).toEqual(expect.arrayContaining(['101大樓', '101']));
    expect(variants('臺北101')).toContain('台北101');
    expect(variants('101')).toContain('台北101');
    expect(variants('101大樓')).toContain('台北101');
    const h = (name: string, distM: number) => ({ name, full: '', lat: 25, lon: 121 + distM / 1e5, distM });
    expect(rank([h('101', 21_500), h('101國際購物中心', 130)], '101')[0]!.name).toBe('101國際購物中心');
  });
  it('名字像不像和距離一起算：一模一樣但很遠的，排在包含而且就在旁邊的後面', () => {
    const h = (name: string, distM: number) => ({ name, full: '', lat: 25, lon: 121 + distM / 1e5, distM });
    const r = rank([h('台北101/世貿', 100), h('台北101', 900), h('台北101', 50), h('隨便', 10)], '台北101');
    expect(r.map((x) => [x.name, x.distM])).toEqual([
      ['台北101', 50],
      ['台北101/世貿', 100],
      ['台北101', 900],
      ['隨便', 10],
    ]);
  });
});

describe('召喚結局', () => {
  it('四種結局照順序輪流，第五輪回到第一種', () => {
    let saga = emptySaga();
    const got: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = finishRound(saga);
      got.push(r.ending);
      saga = r.saga;
    }
    expect(got).toEqual([...ENDINGS, ENDINGS[0]]);
    expect(saga.rounds).toBe(5);
  });

  it('湊滿四種的恭喜只出現一次', () => {
    let saga = emptySaga();
    const flags: boolean[] = [];
    for (let i = 0; i < 9; i++) {
      const r = finishRound(saga);
      flags.push(r.completedAll);
      saga = r.saga;
    }
    expect(flags).toEqual([false, false, false, true, false, false, false, false, false]);
  });

  it('roundStats 照撿到的順序算直線距離和時間', () => {
    const a = destination(HOME, 0, 100);
    const b = destination(a, 90, 200);
    const hunt = {
      center: HOME,
      radiusM: 800,
      startedAt: 1000,
      items: [
        { id: 'b', n: 2, ...b, foundAt: 9000 },
        { id: 'a', n: 1, ...a, foundAt: 5000 },
      ],
    };
    const s = roundStats(hunt);
    expect(s.walkedM).toBeCloseTo(300, 0);
    expect(s.ms).toBe(8000);
  });
});
