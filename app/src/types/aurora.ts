/**
 * 引擎对外的语义 API 契约。
 * 编辑器 / 鼠标输入 / 测试都只依赖这里的类型，不直接摸 Three.js 内部。
 */
export type ThemeKey = 'classic' | 'ice' | 'rose' | 'aurora' | 'cyber';
export type ShapeKey = 'heart' | 'star' | 'flake' | 'wreath' | 'galaxy' | 'text';
export type FieldMode = 0 | 1 | 2 | 3;
export type BackendMode = 'auto' | 'webgl' | 'webgpu';

export interface TuneState {
  count: number;
  speed: number;
  bright: number;
  contrast: number;
  size: number;
  glow: number;
  photoSize: number;
  photoOpacity: number;
}

export interface FieldState {
  mode: FieldMode;
  power: number;
  pulse: boolean;
  pulseT: number;
}

export interface PointerState {
  on: boolean;
  nx: number;
  ny: number;
  grabbing: boolean;
}

export interface PhotoSprite {
  visible: boolean;
  userData: { src?: string; hidden?: boolean; slot?: number; [k: string]: unknown };
}

export interface LayerObject {
  visible: boolean;
}

export interface BackendState {
  mode: BackendMode;
  active: boolean;
  ready: boolean;
  error: string;
  /** ?backend=fbo 时为 true：粒子位置常驻显存，无回读 */
  gpuResident?: boolean;
  readbackHz?: number;
}

export interface GestureDebugState {
  state: 'IDLE' | 'CANDIDATE' | 'ACTIVE' | 'COOLDOWN';
  committed: string;
  candidate: string;
  confEma: number;
  filtersLive: boolean;
  cooldownLeftMs: number;
  hasSample: boolean;
  config: Record<string, number | boolean>;
}

export interface SceneStats {
  fps: number;
  count: number;
  gpu: string;
  backend: BackendMode;
  backendReady: boolean;
  backendError: string;
}

export interface PresetV2 {
  v: 2;
  theme: ThemeKey;
  shape: ShapeKey;
  field: { mode: FieldMode; power: number };
  tune: TuneState;
}

export interface AuroraApi {
  version: string;
  themes: ThemeKey[];
  theme: ThemeKey;
  setTheme(k: ThemeKey): void;
  shapes: ShapeKey[];
  shape: ShapeKey;
  shapeLabels: Record<ShapeKey, string>;
  setShape(k: ShapeKey): void;
  tune: TuneState;
  tuneDefaults: TuneState;
  rebuild(n: number): void;
  syncTune(): void;
  field: FieldState;
  fieldNames: string[];
  pulse(): void;
  setFieldSim(on: number): void;
  setField(mode: FieldMode, power?: number): void;
  pointer: PointerState;
  backend(): BackendState;
  setBackend(k: BackendMode | string): void;
  photos(): PhotoSprite[];
  addPhotoFile(file: File): Promise<boolean>;
  removePhotoAt(i: number): void;
  togglePhotoAt(i: number): void;
  layers(): Record<string, LayerObject | undefined>;
  preset(): PresetV2;
  applyPreset(p: Partial<PresetV2> | null): boolean;
  savePresetLocal(): void;
  loadPresetLocal(): void;
  snapshot(): void;
  record(): void;
  isRecording(): boolean;
  stats(): SceneStats;
  camera: { running: boolean };
  /** 手势控制器状态（One Euro + 迟滞 FSM），真机调参用 */
  gesture(): GestureDebugState;
}

declare global {
  interface Window {
    __aurora?: AuroraApi;
  }
}
