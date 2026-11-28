/**
 * 无摄像头模式：鼠标 / 触屏就是手掌。
 * - 指针位置 → 力场中心（引擎每帧 screenToWorld）
 * - 按住 = 握紧，力场强度 ×1.45
 * - Shift + 滚轮 = 力场强度，1–6 = 六种形态，G = 切力场，空格 = 脉冲
 */
import type { AuroraApi, ShapeKey } from '../types/aurora';
import { ndcFromClient, stepPower } from './pointer';

const api = (): AuroraApi => window.__aurora as AuroraApi;

const SHAPE_KEYS: ShapeKey[] = ['heart', 'star', 'flake', 'wreath', 'galaxy', 'text'];

export function attachPointerHand(): void {
  const A = api();
  if (!A) return;

  const ring = document.createElement('div');
  ring.id = 'handCursor';
  document.body.appendChild(ring);

  let lx = window.innerWidth / 2;
  let ly = window.innerHeight / 2;
  let shown = false;

  function inPanel(target: EventTarget | null): boolean {
    const t = target as HTMLElement | null;
    return !!(t && t.closest && t.closest('#editorPanel,#tunePanel,#studioPanel,#camPanel,.topbar,.gesturebar,.shapebar,.brushbar'));
  }

  function syncNdc(): void {
    const { nx, ny } = ndcFromClient(lx, ly, window.innerWidth, window.innerHeight);
    A.pointer.nx = nx;
    A.pointer.ny = ny;
    A.pointer.on = !A.camera.running;
  }

  window.addEventListener('pointermove', (e: PointerEvent) => {
    lx = e.clientX; ly = e.clientY;
    ring.style.left = lx + 'px';
    ring.style.top = ly + 'px';
    if (inPanel(e.target)) return;                 // 鼠标在面板上时不动力场
    syncNdc();
  }, { passive: true });

  window.addEventListener('pointerdown', (e: PointerEvent) => {
    if (inPanel(e.target)) return;
    A.pointer.grabbing = true;
    ring.classList.add('grab');
  });
  (['pointerup', 'pointercancel', 'blur'] as const).forEach(ev =>
    window.addEventListener(ev, () => { A.pointer.grabbing = false; ring.classList.remove('grab'); })
  );

  // Shift + 滚轮调力场强度；不按 Shift 时保持原来的镜头缩放
  window.addEventListener('wheel', (e: WheelEvent) => {
    if (!e.shiftKey || inPanel(e.target)) return;
    const f = A.field;
    f.power = stepPower(f.power, e.deltaY);
    if (f.mode === 0) A.setField(2, f.power);
    else A.setField(f.mode, f.power);
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false, capture: true });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (/^[1-6]$/.test(e.key)) {
      A.setShape(SHAPE_KEYS[Number(e.key) - 1]);
      (window as unknown as { __editor?: { syncAll(): void } }).__editor?.syncAll();
    } else if (e.key.toLowerCase() === 'g') {
      const m = ((A.field.mode + 1) % 4) as 0 | 1 | 2 | 3;
      A.setField(m, A.field.power);
      (window as unknown as { __editor?: { syncAll(): void } }).__editor?.syncAll();
    } else if (e.code === 'Space') {
      A.pulse();
      e.preventDefault();
    }
  });

  // 摄像头关掉后自动接管；开了就交还给手势
  window.setInterval(() => {
    const want = !A.camera.running;
    A.pointer.on = want;
    const ringOn = want && A.field.mode !== 0;
    if (ringOn !== shown) { ring.classList.toggle('on', ringOn); shown = ringOn; }
    if (!want) { A.pointer.grabbing = false; ring.classList.remove('grab'); }
  }, 600);

  const drive = (): void => {
    if (!A.camera.running) syncNdc();
    window.requestAnimationFrame(drive);
  };
  window.requestAnimationFrame(drive);
}
