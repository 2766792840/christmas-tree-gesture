import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNE, normalizePreset, parsePreset, presetToJson } from './presets';

describe('presets', () => {
  it('空对象回落到默认场景', () => {
    const p = normalizePreset({});
    expect(p.v).toBe(2);
    expect(p.theme).toBe('classic');
    expect(p.field.mode).toBe(0);
    expect(p.field.power).toBe(1);
    expect(p.tune).toEqual(DEFAULT_TUNE);
  });

  it('越界的调参被夹到合法区间，数量取整', () => {
    const p = normalizePreset({ tune: { count: 99999, speed: -3, glow: 9, photoOpacity: 0.01 } });
    expect(p.tune.count).toBe(40000);
    expect(p.tune.speed).toBe(0.2);
    expect(p.tune.glow).toBe(1.6);
    expect(p.tune.photoOpacity).toBe(0.2);
  });

  it('未知主题 / 形态回落到默认值，保留合法值', () => {
    const p = normalizePreset({ theme: 'neon', shape: 'dragon' });
    expect(p.theme).toBe('classic');
    expect(p.shape).toBe('text');
    expect(normalizePreset({ theme: 'cyber', shape: 'flake' }).theme).toBe('cyber');
  });

  it('力场模式只接受 0-3，强度夹在 0-2', () => {
    expect(normalizePreset({ field: { mode: 7, power: 5 } }).field).toEqual({ mode: 0, power: 2 });
    expect(normalizePreset({ field: { mode: 2, power: 0.4 } }).field).toEqual({ mode: 2, power: 0.4 });
  });

  it('坏 JSON 直接判空，不进场景', () => {
    expect(parsePreset('{oops')).toBeNull();
    expect(parsePreset('null')).toBeNull();
    expect(parsePreset('[]')).toBeNull();
  });

  it('导出再解析结果一致', () => {
    const p = normalizePreset({ theme: 'aurora', shape: 'star', field: { mode: 3, power: 1.4 } });
    expect(parsePreset(presetToJson(p))).toEqual(p);
  });
});
