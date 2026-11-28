import './dev/errorScreen';
import './ui/editor.css';
import './app/engine';
import { detectLang, setLangValue } from './ui/i18n';
import { initLangDom } from './ui/langDom';
import { mountEditor } from './ui/editor';
import { attachPointerHand } from './core/pointerHand';
import type { AuroraApi } from './types/aurora';

// 语言必须在引擎渲染首屏之前定下来
setLangValue(detectLang());

const api = (): AuroraApi => window.__aurora as AuroraApi;

/** 等引擎把 window.__aurora 挂好（引擎同步顶层执行，一般第一帧就有） */
function whenReady(cb: () => void): void {
  if (window.__aurora) { cb(); return; }
  const timer = window.setInterval(() => {
    if (window.__aurora) { window.clearInterval(timer); cb(); }
  }, 60);
}

function hint(text: string): void {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = 'position:fixed;left:50%;bottom:104px;transform:translateX(-50%);z-index:32;' +
    'padding:8px 14px;border-radius:999px;background:rgba(8,14,28,.82);border:1px solid rgba(255,214,150,.3);' +
    'color:#ffe3b8;font-size:11px;letter-spacing:.02em;pointer-events:none;';
  document.body.appendChild(el);
  window.setTimeout(() => el.remove(), 5200);
}

async function probeCamera(): Promise<void> {
  const A = api();
  const md = navigator.mediaDevices;
  if (!md || !md.enumerateDevices) { A.pointer.on = true; return; }
  try {
    const list = await md.enumerateDevices();
    const hasCam = list.some(d => d.kind === 'videoinput');
    A.pointer.on = !hasCam;
    if (!hasCam) hint('没检测到摄像头 · 已切换「鼠标当手」：移动鼠标推粒子，按住加力');
  } catch {
    A.pointer.on = true;
  }
}

whenReady(() => {
  mountEditor();
  attachPointerHand();
  initLangDom();
  void probeCamera();
});
