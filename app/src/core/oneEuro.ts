/**
 * One Euro 滤波（Casiez et al. 2012）。
 *
 * 低速时强平滑压抖动，高速时自动降低平滑、把滞后让出去，
 * 正好对付 MediaPipe 关键点：静止时 1px 都在抖，挥手时又怕延迟。
 * 纯数值模块，不碰 Three.js / DOM，方便单测与离线轨迹回放。
 */

export interface OneEuroOptions {
  /** 静止时的截止频率（Hz）。越小越稳、越滞后。 */
  minCutoff?: number;
  /** 速度系数：cutoff = minCutoff + beta * |dx|。越大越跟手。 */
  beta?: number;
  /** 速度信号自身的截止频率（Hz）。 */
  dCutoff?: number;
}

const TWO_PI = Math.PI * 2;

/** 一阶低通在给定 dt 下的 alpha；cutoff 单位为 Hz。 */
export function smoothingAlpha(cutoff: number, dt: number): number {
  if (!(cutoff > 0) || !(dt > 0)) return 1;
  const tau = 1 / (TWO_PI * cutoff);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  readonly minCutoff: number;
  readonly beta: number;
  readonly dCutoff: number;

  private xPrev = 0;
  private dxPrev = 0;
  private tPrev = 0;
  private started = false;

  constructor(opts: OneEuroOptions = {}) {
    this.minCutoff = opts.minCutoff ?? 1.0;
    this.beta = opts.beta ?? 1.5;
    this.dCutoff = opts.dCutoff ?? 1.0;
  }

  /** 丢掉历史。追踪丢失后必须调用，否则重新出现时会被旧值拖着走。 */
  reset(): void {
    this.xPrev = 0;
    this.dxPrev = 0;
    this.tPrev = 0;
    this.started = false;
  }

  get initialized(): boolean {
    return this.started;
  }

  /** @param t 单位秒 */
  filter(x: number, t: number): number {
    if (!Number.isFinite(x)) return this.started ? this.xPrev : 0;
    if (!this.started) {
      this.xPrev = x;
      this.tPrev = t;
      this.dxPrev = 0;
      this.started = true;
      return x;
    }
    const dt = t - this.tPrev;
    // 同一时间戳 / 时间倒流：不能拿 dt=0 去算导数，直接沿用上一次输出
    if (!(dt > 0)) return this.xPrev;

    const dx = (x - this.xPrev) / dt;
    const aD = smoothingAlpha(this.dCutoff, dt);
    this.dxPrev += aD * (dx - this.dxPrev);

    const cutoff = this.minCutoff + this.beta * Math.abs(this.dxPrev);
    const a = smoothingAlpha(cutoff, dt);
    this.xPrev += a * (x - this.xPrev);
    this.tPrev = t;
    return this.xPrev;
  }

  /** 只读当前估计速度（单位/秒），调试与自测用。 */
  get velocity(): number {
    return this.dxPrev;
  }
}
