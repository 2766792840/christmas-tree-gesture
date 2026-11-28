import { describe, expect, it } from 'vitest';
import { ndcFromClient, stepPower } from './pointer';

describe('ndcFromClient', () => {
  it('屏幕中心是原点', () => {
    expect(ndcFromClient(640, 360, 1280, 720)).toEqual({ nx: 0, ny: 0 });
  });

  it('左上角是 (-1, 1)，y 轴朝上', () => {
    expect(ndcFromClient(0, 0, 1280, 720)).toEqual({ nx: -1, ny: 1 });
  });

  it('右下角是 (1, -1)', () => {
    expect(ndcFromClient(1280, 720, 1280, 720)).toEqual({ nx: 1, ny: -1 });
  });

  it('超出视口被夹在 -1..1', () => {
    const out = ndcFromClient(-200, 900, 1280, 720);
    expect(out.nx).toBe(-1);
    expect(out.ny).toBe(-1);
  });

  it('尺寸为 0 时不产生 Infinity', () => {
    const out = ndcFromClient(100, 100, 0, 0);
    expect(Number.isFinite(out.nx)).toBe(true);
    expect(Number.isFinite(out.ny)).toBe(true);
  });
});

describe('stepPower', () => {
  it('向上滚加、向下滚减，步长 0.06', () => {
    expect(stepPower(1, -100)).toBe(1.06);
    expect(stepPower(1, 100)).toBe(0.94);
  });

  it('夹在 0..2 之间', () => {
    expect(stepPower(2, -100)).toBe(2);
    expect(stepPower(0, 100)).toBe(0);
  });
});
