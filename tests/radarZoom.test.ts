import { describe, expect, it } from 'vitest';
import { clampRange, clusterDots, clusterRadius, nextZoom, niceStep, zoomStage } from '../src/radar/radarZoom';

describe('雷達縮放', () => {
  it('按鈕三段循環：6 → 3 → 1.5 → 6', () => {
    expect(nextZoom(6, 6)).toBe(3);
    expect(nextZoom(3, 6)).toBe(1.5);
    expect(nextZoom(1.5, 6)).toBe(6);
    expect(nextZoom(4, 6)).toBe(3); // 雙指縮到中間值時往下一段
    expect(nextZoom(1, 6)).toBe(6);
  });
  it('段數與範圍限制', () => {
    expect([zoomStage(6, 6), zoomStage(3.2, 6), zoomStage(1.4, 6)]).toEqual([0, 1, 2]);
    expect([clampRange(0.05, 6), clampRange(9, 6)]).toEqual([0.1, 6]);
  });
  it('好讀的刻度', () => {
    expect([niceStep(2), niceStep(1.2), niceStep(0.6), niceStep(0.3), niceStep(0.18)]).toEqual([2, 2, 1, 0.5, 0.2]);
  });
});

describe('光點合併', () => {
  it('近的合成一個，中心是分數最高的點，點數越多越大', () => {
    const cl = clusterDots(
      [
        { item: 'a', x: 0, y: 0, score: 100 },
        { item: 'b', x: 10, y: 0, score: 300 },
        { item: 'c', x: 25, y: 0, score: 200 },
        { item: 'd', x: 200, y: 0, score: 50 },
      ],
      30,
    );
    expect(cl.map((c) => [c.best, c.count, c.x])).toEqual([['b', 3, 10], ['d', 1, 200]]);
    expect(clusterRadius(1)).toBe(6);
    expect(clusterRadius(3)).toBeGreaterThan(clusterRadius(2));
    expect(clusterRadius(100)).toBe(18);
  });
});

import { fitRange, nearBand } from '../src/radar/radarZoom';

describe('打開雷達自動選範圍', () => {
  it('選最小、但看得到 3 個點和第一名的那一段', () => {
    expect(fitRange([0.5, 1, 2, 9], 1, 12)).toBe(3);
    expect(fitRange([0.5, 1, 2, 9], 5, 12)).toBe(6);
    expect(fitRange([4, 7, 10], 4, 12)).toBe(12);
    expect(fitRange([1], 1, 12)).toBe(3); // 只有一個點也要看得到
    expect(fitRange([], null, 12)).toBe(3);
  });
});

describe('靠近熱點的距離分段', () => {
  it('500／250／100 公尺', () => {
    expect([nearBand(800), nearBand(400), nearBand(200), nearBand(50)]).toEqual([0, 1, 2, 3]);
  });
});

import { clampTilt } from '../src/radar/useTilt';

describe('體感', () => {
  it('轉動角度有上限', () => {
    expect([clampTilt(30), clampTilt(-30), clampTilt(5)]).toEqual([14, -14, 5]);
  });
});

import { nearBeep } from '../src/radar/radarZoom';

describe('靠近目標嗶嗶', () => {
  it('每個目標進入更近的一段才嗶，不會一直響；離開再回來會再響', () => {
    const mem = new Map<string, number>();
    const at = (a: number, b: number) => [
      { id: 'A', distM: a },
      { id: 'B', distM: b },
    ];
    expect(nearBeep(mem, at(900, 2000))).toBe(0);
    expect(nearBeep(mem, at(450, 2000))).toBe(1);
    expect(nearBeep(mem, at(420, 2000))).toBe(0); // 同一段不再響
    expect(nearBeep(mem, at(200, 2000))).toBe(2);
    expect(nearBeep(mem, at(80, 2000))).toBe(3);
    expect(nearBeep(mem, at(300, 480))).toBe(1); // 換靠近另一顆
    expect(nearBeep(mem, at(800, 900))).toBe(0); // 都離開了
    expect(nearBeep(mem, at(450, 900))).toBe(1); // 回來再響
  });
});

