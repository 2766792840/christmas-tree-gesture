import type { FieldMode, PresetV2, ShapeKey, ThemeKey, TuneState } from '../types/aurora';

export const THEME_KEYS: ThemeKey[] = ['classic', 'ice', 'rose', 'aurora', 'cyber'];
export const SHAPE_KEYS: ShapeKey[] = ['heart', 'star', 'flake', 'wreath', 'galaxy', 'text'];

export const TUNE_LIMITS: Record<keyof TuneState, [number, number]> = {
  count: [6000, 40000],
  speed: [0.2, 2.5],
  bright: [0.4, 2],
  contrast: [0.6, 1.8],
  size: [0.5, 2],
  glow: [0, 1.6],
  photoSize: [0.5, 2],
  photoOpacity: [0.2, 1]
};

export const DEFAULT_TUNE: TuneState = {
  count: 26000, speed: 1, bright: 1, contrast: 1, size: 1, glow: 0.55, photoSize: 1, photoOpacity: 0.92
};

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

/** 把任意来源（localStorage / 粘贴的 JSON / 老版本）的配置整理成合法 PresetV2 */
export function normalizePreset(raw: unknown): PresetV2 {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<PresetV2> & { tune?: Partial<TuneState> };
  const tune = { ...DEFAULT_TUNE };
  if (src.tune && typeof src.tune === 'object') {
    (Object.keys(TUNE_LIMITS) as (keyof TuneState)[]).forEach(k => {
      const v = src.tune?.[k];
      if (typeof v === 'number') {
        const [min, max] = TUNE_LIMITS[k];
        tune[k] = k === 'count' ? Math.round(clamp(v, min, max)) : clamp(v, min, max);
      }
    });
  }
  const mode = src.field?.mode;
  const power = src.field?.power;
  return {
    v: 2,
    theme: pick<ThemeKey>(src.theme, THEME_KEYS, 'classic'),
    shape: pick<ShapeKey>(src.shape, SHAPE_KEYS, 'text'),
    field: {
      mode: (mode === 1 || mode === 2 || mode === 3 ? mode : 0) as FieldMode,
      power: typeof power === 'number' ? clamp(power, 0, 2) : 1
    },
    tune
  };
}

export function presetToJson(p: PresetV2): string {
  return JSON.stringify(p, null, 2);
}

/** 解析用户粘贴 / 导入的 JSON 文本，失败返回 null，不让坏数据进场景 */
export function parsePreset(text: string): PresetV2 | null {
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return normalizePreset(raw);
  } catch {
    return null;
  }
}
