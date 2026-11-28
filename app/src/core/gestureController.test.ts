import { describe, expect, it } from 'vitest';
import { GestureController, type GestureOutput } from './gestureController';

const DT = 1000 / 60;

interface FrameInit {
  label?: string;
  conf?: number;
  cx?: number;
  cy?: number;
  pinchD?: number;
  palm?: number;
}

/** 按 60 Hz 回放一条轨迹，返回每帧输出 */
function replay(
  ctrl: GestureController,
  frames: FrameInit[],
  startAt = 0,
  onFrame?: (i: number, t: number) => FrameInit | null
): GestureOutput[] {
  const out: GestureOutput[] = [];
  for (let i = 0; i < frames.length; i++) {
    const t = startAt + i * DT;
    const override = onFrame ? onFrame(i, t) : null;
    const f = override ?? frames[i];
    if (!f) continue;
    out.push(ctrl.update({
      label: f.label ?? 'none',
      conf: f.conf ?? 0,
      cx: f.cx ?? 0.5,
      cy: f.cy ?? 0.5,
      pinchD: f.pinchD ?? 0.5,
      palm: f.palm ?? 0.2,
      t
    }));
  }
  return out;
}

function hold(n: number, f: FrameInit): FrameInit[] {
  return Array.from({ length: n }, () => ({ ...f }));
}

/** 交替抖动坐标：最坏情况的高频噪声 */
function alternating(base: number, amp: number): (i: number) => number {
  return (i) => base + (i % 2 === 0 ? amp : -amp);
}

describe('One Euro 手势控制器', () => {
  it('静止时高频抖动被压住，且不会误切手势', () => {
    const ctrl = new GestureController();
    const frames = hold(360, { label: 'two', conf: 0.82 });
    const out = replay(ctrl, frames, 0, (i) => ({
      label: 'two', conf: 0.82, cx: alternating(0.5, 0.004)(i), cy: 0.5, pinchD: 0.5, palm: 0.2
    }));

    const tail = out.slice(-120);
    expect(tail.every(o => o.label === 'two')).toBe(true);

    const raw = tail.map((_, i) => alternating(0.5, 0.004)(i + 240));
    const rawStd = Math.sqrt(raw.reduce((a, v) => a + (v - 0.5) ** 2, 0) / raw.length);
    const outStd = Math.sqrt(tail.reduce((a, o) => a + (o.cx - 0.5) ** 2, 0) / tail.length);
    expect(outStd).toBeLessThan(rawStd * 0.35);
  });

  it('真实换手势时在保持窗口内提交，不拖太久', () => {
    const ctrl = new GestureController();
    const frames = [...hold(60, { label: 'two', conf: 0.85 }), ...hold(60, { label: 'three', conf: 0.85 })];
    const out = replay(ctrl, frames);
    expect(out[59].label).toBe('two');

    const switchAt = out.findIndex((o, i) => i > 0 && o.label === 'three');
    expect(switchAt).toBeGreaterThanOrEqual(0);
    // 170 ms 保持 + 一帧余量
    expect((switchAt - 60) * DT).toBeLessThanOrEqual(210);
  });

  it('边缘来回跳的标签不会触发切换（迟滞 + 候选计时）', () => {
    const ctrl = new GestureController();
    const frames = hold(180, { label: 'two', conf: 0.7 });
    const out = replay(ctrl, frames, 0, (i) => ({
      label: i % 2 === 0 ? 'two' : 'three', conf: 0.7, cx: 0.5, cy: 0.5, pinchD: 0.5, palm: 0.2
    }));
    expect(out.every(o => o.label === 'none')).toBe(true);
    expect(out.every(o => o.state !== 'ACTIVE')).toBe(true);
  });

  it('只闪过几帧的手势不会被当作命令', () => {
    const ctrl = new GestureController();
    const frames = [...hold(8, { label: 'two', conf: 0.85 }), ...hold(40, { label: 'none', conf: 0 })];
    const out = replay(ctrl, frames);
    expect(out.every(o => o.label === 'none')).toBe(true);
  });

  it('低置信度视为识别质量不足，保持已有的手势而不是切走', () => {
    const ctrl = new GestureController();
    const frames = [...hold(60, { label: 'two', conf: 0.85 }), ...hold(60, { label: 'two', conf: 0.25 })];
    const out = replay(ctrl, frames);
    expect(out[59].label).toBe('two');
    expect(out[out.length - 1].label).toBe('two');
  });

  it('追踪丢失后滤波器清零，重新出现不会被旧位置拖出残影', () => {
    const ctrl = new GestureController();
    // 先在左侧稳定一段时间
    replay(ctrl, hold(90, { label: 'two', conf: 0.85, cx: 0.2, cy: 0.3 }));

    // 断手 300 ms
    let t = 90 * DT;
    let lastLost: GestureOutput | null = null;
    for (let i = 0; i < 18; i++) {
      lastLost = ctrl.lost(t);
      t += DT;
    }
    expect(lastLost?.label).toBe('none');

    // 在右上方重新出现：第一帧就必须贴着新位置，不能被 0.2 拖住
    const first = ctrl.update({ label: 'two', conf: 0.85, cx: 0.85, cy: 0.7, pinchD: 0.5, palm: 0.2, t });
    expect(Math.abs(first.cx - 0.85)).toBeLessThan(0.01);
    expect(Math.abs(first.cy - 0.7)).toBeLessThan(0.01);
    // 重新出现不能立刻算 ACTIVE
    expect(first.committed).toBe(false);
  });

  it('快速移动时滤波让路：阶跃后 100 ms 内跟上', () => {
    const ctrl = new GestureController();
    const out = replay(ctrl, hold(180, { label: 'two', conf: 0.82 }), 0, (i) => ({
      label: 'two', conf: 0.82, cx: i < 60 ? 0.3 : 0.7, cy: 0.5, pinchD: 0.5, palm: 0.2
    }));
    const settle = out.slice(60).findIndex(o => Math.abs(o.cx - 0.7) < 0.035);
    expect(settle).toBeGreaterThanOrEqual(0);
    expect(settle * DT).toBeLessThanOrEqual(100);
  });

  it('缓慢漂移 + 高频噪声：跟得上趋势，又不把噪声带出去', () => {
    const ctrl = new GestureController();
    const ideal = (i: number) => 0.2 + i * 0.0005;
    const raw = (i: number) => ideal(i) + alternating(0, 0.004)(i);
    const out = replay(ctrl, hold(600, { label: 'two', conf: 0.82 }), 0, (i) => ({
      label: 'two', conf: 0.82, cx: raw(i), cy: 0.5, pinchD: 0.5, palm: 0.2
    }));

    const tail = out.slice(300);
    // 输入每帧在 ±0.004 之间跳（步长 0.008），输出不应跟着跳
    let maxStep = 0;
    for (let i = 1; i < tail.length; i++) maxStep = Math.max(maxStep, Math.abs(tail[i].cx - tail[i - 1].cx));
    expect(maxStep).toBeLessThan(0.008 * 0.2);
    // 同时没把缓慢趋势拉停
    expect(Math.abs(tail[tail.length - 1].cx - ideal(599))).toBeLessThan(0.01);
  });
});
