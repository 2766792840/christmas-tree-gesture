/**
 * 手势交互控制器：One Euro 滤波 + 统一状态机（IDLE → CANDIDATE → ACTIVE → COOLDOWN）。
 *
 * 职责边界：
 * - 只吃「已经算好的手势特征」（label / conf / 掌心坐标 / 捏合距离），不认识 MediaPipe；
 * - 只吐「稳定后的手势」和滤波后的坐标，不认识 Three.js；
 * - 所有阈值、保持时间、冷却时间都可注入，方便单测与真机调参。
 *
 * 与 V2 的 `pending/stable` 计数相比，这里解决三件事：
 * 1. 边缘抖动：进入/退出用不同阈值（迟滞），过渡帧不再来回切；
 * 2. 手抖：坐标走 One Euro，静止时压住抖动、快速移动时自动让路；
 * 3. 断手：追踪丢失一段时间后重置滤波器，重新出现时不会被旧值拖出残影。
 */
import { OneEuroFilter, type OneEuroOptions } from './oneEuro';
import type { GestureDebugState } from '../types/aurora';

export type FsmState = 'IDLE' | 'CANDIDATE' | 'ACTIVE' | 'COOLDOWN';

export interface GestureSample {
  /** 原始分类结果，例如 fist / two / pinch / none */
  label: string;
  /** 该分类的置信度，0–1 */
  conf: number;
  /** 掌心横坐标（0–1，画面归一化） */
  cx: number;
  /** 掌心纵坐标（0–1） */
  cy: number;
  /** 拇指–食指捏合距离（按掌宽归一化） */
  pinchD: number;
  /** 掌宽（归一化），供下游换算尺度 */
  palm: number;
  /** 毫秒时间戳（performance.now） */
  t: number;
}

export interface GestureOutput {
  state: FsmState;
  /** 稳定后的手势；没进入 ACTIVE 时是 'none' */
  label: string;
  conf: number;
  cx: number;
  cy: number;
  pinchD: number;
  palm: number;
  /** 当前稳定手势的起始时间（毫秒），没进入 ACTIVE 时为 0 */
  since: number;
  committed: boolean;
  /** 本帧是否刚从「有手势」掉回「无手势」 */
  dropped: boolean;
}

export interface GestureControllerOptions {
  /** false 时跳过滤波、并把保持时间压到一帧，用于 A/B（?oe=0） */
  enabled?: boolean;
  /** 进入 ACTIVE 所需的置信度 */
  enterConf?: number;
  /** 低于此置信度视为识别质量不足，保持现状而不是切换 */
  exitConf?: number;
  /** 新标签需要连续保持多久才提交（毫秒） */
  enterHoldMs?: number;
  /** 手势消失需要持续多久才提交回 none（毫秒） */
  exitHoldMs?: number;
  /** 掉回 none 后的冷却时间（毫秒），期间不接受新提交 */
  cooldownMs?: number;
  /** 追踪丢失多久后重置滤波器（毫秒） */
  lostResetMs?: number;
  cx?: OneEuroOptions;
  cy?: OneEuroOptions;
  pinchD?: OneEuroOptions;
  palm?: OneEuroOptions;
}

const DEFAULTS = {
  enterConf: 0.55,
  exitConf: 0.34,
  enterHoldMs: 170,
  exitHoldMs: 150,
  cooldownMs: 260,
  lostResetMs: 220
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export class GestureController {
  readonly cfg: {
    enabled: boolean;
    enterConf: number;
    exitConf: number;
    enterHoldMs: number;
    exitHoldMs: number;
    cooldownMs: number;
    lostResetMs: number;
  };

  private readonly cxF: OneEuroFilter;
  private readonly cyF: OneEuroFilter;
  private readonly pinchF: OneEuroFilter;
  private readonly palmF: OneEuroFilter;

  private committed = 'none';
  private committedAt = 0;
  private candidate = 'none';
  private candidateAt = 0;
  private state: FsmState = 'IDLE';
  private lostAt: number | null = null;
  private cooldownUntil = 0;
  private confEma = 0;

  private outCx = 0;
  private outCy = 0;
  private outPinch = 0;
  private outPalm = 0;
  private hasSample = false;

  constructor(opts: GestureControllerOptions = {}) {
    const enabled = opts.enabled ?? true;
    this.cfg = {
      enabled,
      enterConf: opts.enterConf ?? DEFAULTS.enterConf,
      exitConf: opts.exitConf ?? DEFAULTS.exitConf,
      enterHoldMs: enabled ? (opts.enterHoldMs ?? DEFAULTS.enterHoldMs) : 40,
      exitHoldMs: enabled ? (opts.exitHoldMs ?? DEFAULTS.exitHoldMs) : 40,
      cooldownMs: enabled ? (opts.cooldownMs ?? DEFAULTS.cooldownMs) : 0,
      lostResetMs: enabled ? (opts.lostResetMs ?? DEFAULTS.lostResetMs) : 40
    };
    this.cxF = new OneEuroFilter({ minCutoff: 1.2, beta: 2.0, dCutoff: 1.2, ...(opts.cx || {}) });
    this.cyF = new OneEuroFilter({ minCutoff: 1.2, beta: 2.0, dCutoff: 1.2, ...(opts.cy || {}) });
    this.pinchF = new OneEuroFilter({ minCutoff: 0.9, beta: 0.45, dCutoff: 1.0, ...(opts.pinchD || {}) });
    this.palmF = new OneEuroFilter({ minCutoff: 0.6, beta: 0.3, dCutoff: 1.0, ...(opts.palm || {}) });
  }

  /** 完全复位：摄像头关掉 / 重新开启时调用，避免上一轮的旧手势残留。 */
  reset(): void {
    this.resetFilters();
    this.committed = 'none';
    this.committedAt = 0;
    this.candidate = 'none';
    this.candidateAt = 0;
    this.state = 'IDLE';
    this.lostAt = null;
    this.cooldownUntil = 0;
    this.confEma = 0;
    this.outCx = 0;
    this.outCy = 0;
    this.outPinch = 0;
    this.outPalm = 0;
    this.hasSample = false;
  }

  private resetFilters(): void {
    this.cxF.reset();
    this.cyF.reset();
    this.pinchF.reset();
    this.palmF.reset();
  }

  private computeState(t: number): FsmState {
    if (this.committed !== 'none') return 'ACTIVE';
    if (this.candidate !== 'none') return 'CANDIDATE';
    return t < this.cooldownUntil ? 'COOLDOWN' : 'IDLE';
  }

  private snapshotOutput(t: number, dropped: boolean): GestureOutput {
    this.state = this.computeState(t);
    const active = this.committed !== 'none';
    return {
      state: this.state,
      label: this.committed,
      conf: active ? clamp01(this.confEma) : 0,
      cx: this.outCx,
      cy: this.outCy,
      pinchD: this.outPinch,
      palm: this.outPalm,
      since: active ? this.committedAt : 0,
      committed: active,
      dropped
    };
  }

  /** 每帧喂一个样本；调用频率建议与手势识别同频（约 18 Hz 起）。 */
  update(s: GestureSample): GestureOutput {
    const t = s.t;

    // 从「断手」里恢复：一定要重新走候选，不能凭旧状态直接 ACTIVE
    if (this.lostAt !== null) {
      if (t - this.lostAt >= this.cfg.lostResetMs) this.resetFilters();
      this.lostAt = null;
      this.candidate = 'none';
      this.candidateAt = t;
    }

    if (this.cfg.enabled) {
      const sec = t / 1000;
      this.outCx = this.cxF.filter(s.cx, sec);
      this.outCy = this.cyF.filter(s.cy, sec);
      this.outPinch = this.pinchF.filter(s.pinchD, sec);
      this.outPalm = this.palmF.filter(s.palm, sec);
    } else {
      this.outCx = s.cx;
      this.outCy = s.cy;
      this.outPinch = s.pinchD;
      this.outPalm = s.palm;
    }
    this.hasSample = true;

    const confTarget = s.label === 'none' ? 0 : clamp01(s.conf);
    this.confEma = this.confEma === 0 ? confTarget : this.confEma + 0.25 * (confTarget - this.confEma);

    // 迟滞三档：明确消失 / 质量不足保持 / 明确且够置信才切换
    let target: string;
    if (s.label === 'none') target = 'none';
    else if (s.conf < this.cfg.exitConf) target = this.committed;
    else if (s.conf < this.cfg.enterConf) target = 'none';
    else target = s.label;

    let dropped = false;
    if (target === this.committed) {
      this.candidate = target;
      this.candidateAt = t;
    } else {
      if (target !== this.candidate) {
        this.candidate = target;
        this.candidateAt = t;
      }
      const hold = target === 'none' ? this.cfg.exitHoldMs : this.cfg.enterHoldMs;
      const cooling = t < this.cooldownUntil;
      if (!cooling && t - this.candidateAt >= hold) {
        const was = this.committed;
        this.committed = target;
        this.committedAt = t;
        this.candidate = target;
        this.candidateAt = t;
        if (target === 'none') {
          this.cooldownUntil = t + this.cfg.cooldownMs;
          dropped = was !== 'none';
        }
      }
    }

    return this.snapshotOutput(t, dropped);
  }

  /** 每帧在「没检测到手」时调用；内部按丢失时长决定何时掉手势、何时清过滤器。 */
  lost(t: number): GestureOutput {
    if (this.lostAt === null) this.lostAt = t;
    const gone = t - this.lostAt;
    let dropped = false;

    if (gone >= this.cfg.exitHoldMs && this.committed !== 'none') {
      this.committed = 'none';
      this.committedAt = t;
      this.candidate = 'none';
      this.candidateAt = t;
      this.cooldownUntil = t + this.cfg.cooldownMs;
      dropped = true;
    }
    if (gone >= this.cfg.lostResetMs) this.resetFilters();

    this.confEma += 0.25 * (0 - this.confEma);
    return this.snapshotOutput(t, dropped);
  }

  /** 调试快照：真机调阈值时看这个，不参与业务。 */
  debug(): GestureDebugState {
    return {
      state: this.state,
      committed: this.committed,
      candidate: this.candidate,
      confEma: Number(this.confEma.toFixed(3)),
      filtersLive: this.cxF.initialized,
      cooldownLeftMs: Math.max(0, Math.round(this.cooldownUntil - performance.now())),
      hasSample: this.hasSample,
      config: { ...this.cfg }
    };
  }
}
