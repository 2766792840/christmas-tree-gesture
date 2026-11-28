/**
 * 完整场景编辑器：主题 / 形态 / 粒子参数 / 力场 / 照片管理 / 层级 / 预设 / 导出
 * 只通过 window.__aurora 这个语义 API 改场景，不直接碰 Three.js。
 */
import './editor.css';
import type { AuroraApi, ThemeKey, ShapeKey, FieldMode, TuneState } from '../types/aurora';
import { parsePreset } from '../core/presets';

const api = (): AuroraApi => window.__aurora as AuroraApi;

const THEME_LABEL: Record<ThemeKey, string> = {
  classic: '暖金圣诞', ice: '冰蓝雪夜', rose: '玫瑰微光', aurora: '极光幻想', cyber: '赛博全息'
};

const TUNE_META: { key: keyof TuneState; label: string; min: number; max: number; step: number }[] = [
  { key: 'count', label: '粒子数量', min: 6000, max: 40000, step: 500 },
  { key: 'speed', label: '流动速度', min: 0.2, max: 2.5, step: 0.05 },
  { key: 'bright', label: '亮度', min: 0.4, max: 2, step: 0.05 },
  { key: 'contrast', label: '对比度', min: 0.6, max: 1.8, step: 0.02 },
  { key: 'size', label: '粒子大小', min: 0.5, max: 2, step: 0.05 },
  { key: 'glow', label: '辉光强度', min: 0, max: 1.6, step: 0.05 },
  { key: 'photoSize', label: '照片尺寸', min: 0.5, max: 2, step: 0.05 },
  { key: 'photoOpacity', label: '照片透明度', min: 0.2, max: 1, step: 0.02 }
];

const LAYER_META: { key: string; label: string }[] = [
  { key: 'tree', label: '粒子树' },
  { key: 'star', label: '树顶星' },
  { key: 'halo', label: '树顶光晕' },
  { key: 'photos', label: '照片星球' },
  { key: 'sky', label: '星空' },
  { key: 'snow', label: '飘雪' },
  { key: 'aurora', label: '极光' },
  { key: 'nebula', label: '银河雾' },
  { key: 'ground', label: '地面微光' },
  { key: 'groundDisc', label: '雪地底盘' },
  { key: 'ink', label: '3D 笔迹' },
  { key: 'fireworks', label: '烟花' }
];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

let root: HTMLElement;
let toastEl: HTMLElement;
let toastTimer = 0;

function toast(msg: string) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function section(title: string, sub?: string) {
  const s = el('section', 'edSec');
  s.appendChild(el('div', 'edSecHead', `<span>${title}</span>${sub ? `<em>${sub}</em>` : ''}`));
  const body = el('div', 'edSecBody');
  s.appendChild(body);
  return { sec: s, body };
}

export function mountEditor() {
  const A = api();
  if (!A) return;

  root = el('aside');
  root.id = 'editorPanel';
  root.innerHTML = `
    <header class="edHead">
      <div>
        <h2>AURORA TREE STUDIO</h2>
        <p>场景编辑器 · V2.2</p>
      </div>
      <button class="edClose" data-act="close" title="关闭">✕</button>
    </header>
    <div class="edBody"></div>
    <footer class="edFoot">
      <span data-hud="fps">-- fps</span>
      <span data-hud="count">--</span>
      <span data-hud="gpu">--</span>
      <span data-hud="src">鼠标</span>
    </footer>`;
  document.body.appendChild(root);

  toastEl = el('div', 'edToast');
  document.body.appendChild(toastEl);

  const body = root.querySelector('.edBody') as HTMLElement;

  /* ---------- 输入源 ---------- */
  const inSec = section('输入源', 'INPUT');
  const inRow = el('div', 'edRow edRowBtns');
  inRow.innerHTML = `
    <button class="edBtn" data-src="pointer">鼠标 / 触屏</button>
    <button class="edBtn" data-src="camera">摄像头手势</button>`;
  inSec.body.appendChild(inRow);
  inSec.body.appendChild(el('p', 'edHint', '没有摄像头时，鼠标就是你的手：移动=手掌位置，按住左键=握紧加力，Shift+滚轮=力场强度。'));
  const camStat = el('p', 'edHint edCamStat', '');
  inSec.body.appendChild(camStat);
  body.appendChild(inSec.sec);

  /* ---------- 渲染后端 ---------- */
  const beSec = section('渲染后端', 'GPU BACKEND');
  const beRow = el('div', 'edChips');
  [['auto', '自动'], ['webgl', 'WebGL 着色器'], ['webgpu', 'WebGPU ping-pong']].forEach(([k, label]) => {
    const b = el('button', 'edChip', label);
    b.dataset.edbackend = k;
    beRow.appendChild(b);
  });
  beSec.body.appendChild(beRow);
  const beStat = el('p', 'edHint', '');
  beSec.body.appendChild(beStat);
  beSec.body.appendChild(el('p', 'edHint', 'WebGPU 模式：粒子位置由 compute shader 双缓冲积分，算完异步读回给 WebGL 渲染；不支持时自动回落。'));
  body.appendChild(beSec.sec);

  /* ---------- 主题 ---------- */
  const thSec = section('主题', 'THEME');
  const thRow = el('div', 'edChips');
  (A.themes || []).forEach((k: ThemeKey) => {
    const b = el('button', 'edChip', THEME_LABEL[k] || k);
    b.dataset.edtheme = k;
    thRow.appendChild(b);
  });
  thSec.body.appendChild(thRow);
  body.appendChild(thSec.sec);

  /* ---------- 形态 ---------- */
  const shSec = section('形态', 'SHAPE');
  const shRow = el('div', 'edChips');
  (A.shapes || []).forEach((k: ShapeKey) => {
    const b = el('button', 'edChip', A.shapeLabels?.[k] || k);
    b.dataset.edshape = k;
    shRow.appendChild(b);
  });
  shSec.body.appendChild(shRow);
  shSec.body.appendChild(el('p', 'edHint', '手势 1–6 指也能切同样的形态；握拳回到圣诞树。'));
  body.appendChild(shSec.sec);

  /* ---------- 粒子参数 ---------- */
  const tnSec = section('粒子参数', 'PARTICLES');
  const sliders: Record<string, HTMLInputElement> = {};
  TUNE_META.forEach(m => {
    const row = el('div', 'edSlider');
    row.innerHTML = `<label>${m.label}</label>`;
    const rng = el('input');
    rng.type = 'range';
    rng.min = String(m.min); rng.max = String(m.max); rng.step = String(m.step);
    rng.dataset.tune = m.key;
    const out = el('span', 'edVal', '');
    out.dataset.out = m.key;
    if (m.key === 'count') {
      out.dataset.out = 'count';
    }
    row.appendChild(rng); row.appendChild(out);
    sliders[m.key] = rng;
    tnSec.body.appendChild(row);
  });
  const tnBtns = el('div', 'edRow edRowBtns');
  tnBtns.innerHTML = `<button class="edBtn" data-act="resetTune">恢复默认粒子参数</button>`;
  tnSec.body.appendChild(tnBtns);
  body.appendChild(tnSec.sec);

  /* ---------- 力场 ---------- */
  const fdSec = section('力场', 'FORCE FIELD');
  const fdRow = el('div', 'edChips');
  ['关', '排斥', '吸引', '涡旋'].forEach((label, i) => {
    const b = el('button', 'edChip', label);
    b.dataset.edfield = String(i);
    fdRow.appendChild(b);
  });
  fdSec.body.appendChild(fdRow);
  const fdPower = el('div', 'edSlider');
  fdPower.innerHTML = `<label>力场强度</label>`;
  const fdRng = el('input');
  fdRng.type = 'range'; fdRng.min = '0'; fdRng.max = '2'; fdRng.step = '0.02'; fdRng.dataset.fieldPower = '1';
  const fdOut = el('span', 'edVal', '1.00');
  fdPower.appendChild(fdRng); fdPower.appendChild(fdOut);
  fdSec.body.appendChild(fdPower);
  const fdBtns = el('div', 'edRow edRowBtns');
  fdBtns.innerHTML = `<button class="edBtn" data-act="pulse">脉冲冲击波</button><button class="edBtn" data-act="fieldSim">演示动效</button>`;
  fdSec.body.appendChild(fdBtns);
  fdSec.body.appendChild(el('p', 'edHint', '排斥=粒子逃离掌心；吸引=涌成发光球壳；涡旋=绕手掌旋转。'));
  body.appendChild(fdSec.sec);

  /* ---------- 照片管理 ---------- */
  const phSec = section('照片星球', 'MEMORY ORBS');
  const phGrid = el('div', 'edPhotos');
  phSec.body.appendChild(phGrid);
  const phBtns = el('div', 'edRow edRowBtns');
  phBtns.innerHTML = `<button class="edBtn" data-act="addPhoto">添加照片</button>
    <button class="edBtn" data-act="openPhotoPanel">从相册面板添加</button>`;
  phSec.body.appendChild(phBtns);
  const phInput = el('input');
  phInput.type = 'file'; phInput.accept = 'image/*'; phInput.multiple = true;
  phInput.style.display = 'none';
  phSec.body.appendChild(phInput);
  phSec.body.appendChild(el('p', 'edHint', '每张照片是一颗记忆球：可隐藏、可删除；伸手能把它抓出来。'));
  body.appendChild(phSec.sec);

  /* ---------- 层级 ---------- */
  const lySec = section('层级可见性', 'LAYERS');
  const lyWrap = el('div', 'edLayers');
  LAYER_META.forEach(m => {
    const lab = el('label', 'edLayer');
    lab.innerHTML = `<input type="checkbox" data-layer="${m.key}" checked><span>${m.label}</span>`;
    lyWrap.appendChild(lab);
  });
  lySec.body.appendChild(lyWrap);
  body.appendChild(lySec.sec);

  /* ---------- 预设 ---------- */
  const psSec = section('场景预设', 'PRESET');
  const psBtns = el('div', 'edRow edRowBtns');
  psBtns.innerHTML = `
    <button class="edBtn" data-act="savePreset">保存当前</button>
    <button class="edBtn" data-act="loadPreset">载入预设</button>
    <button class="edBtn" data-act="exportPreset">导出 JSON</button>
    <button class="edBtn" data-act="importPreset">导入 JSON</button>`;
  psSec.body.appendChild(psBtns);
  const psInput = el('input');
  psInput.type = 'file'; psInput.accept = '.json,application/json';
  psInput.style.display = 'none';
  psSec.body.appendChild(psInput);
  const psCode = el('textarea', 'edJson') as HTMLTextAreaElement;
  psCode.placeholder = '当前场景配置会显示在这里，也可以粘一份 JSON 进来点「应用」';
  psSec.body.appendChild(psCode);
  const psApply = el('div', 'edRow edRowBtns');
  psApply.innerHTML = `<button class="edBtn" data-act="applyJson">应用这段 JSON</button>`;
  psSec.body.appendChild(psApply);
  body.appendChild(psSec.sec);

  /* ---------- 导出 ---------- */
  const exSec = section('导出', 'EXPORT');
  const exBtns = el('div', 'edRow edRowBtns');
  exBtns.innerHTML = `<button class="edBtn" data-act="shot">存图 PNG</button>
    <button class="edBtn" data-act="rec">录制 8 秒 WebM</button>`;
  exSec.body.appendChild(exBtns);
  exSec.body.appendChild(el('p', 'edHint', '录制会抓取画布实时画面，8 秒自动停止并下载。'));
  body.appendChild(exSec.sec);

  /* ================= 事件 ================= */
  let fieldSim = false;

  root.addEventListener('click', async (e) => {
    const t = e.target as HTMLElement;
    const act = t.closest('[data-act]') as HTMLElement | null;
    const themeBtn = t.closest('[data-edtheme]') as HTMLElement | null;
    const shapeBtn = t.closest('[data-edshape]') as HTMLElement | null;
    const fieldBtn = t.closest('[data-edfield]') as HTMLElement | null;
    const srcBtn = t.closest('[data-src]') as HTMLElement | null;
    const beBtn = t.closest('[data-edbackend]') as HTMLElement | null;
    const photoAct = t.closest('[data-photo-act]') as HTMLElement | null;

    if (beBtn) {
      api().setBackend(beBtn.dataset.edbackend ?? 'auto');
      setTimeout(syncBackend, 500);
      return;
    }
    if (themeBtn) { api().setTheme(themeBtn.dataset.edtheme as ThemeKey); syncChips(); return; }
    if (shapeBtn) { api().setShape(shapeBtn.dataset.edshape as ShapeKey); syncChips(); return; }
    if (fieldBtn) {
      api().setField(Number(fieldBtn.dataset.edfield) as FieldMode, api().field.power);
      syncChips();
      return;
    }
    if (srcBtn) {
      if (srcBtn.dataset.src === 'camera') {
        (document.getElementById('btnCam') as HTMLElement)?.click();
        setTimeout(checkCamera, 900);
      } else {
        api().pointer.on = true;
        toast('已切到鼠标手势：移动鼠标就是手掌');
      }
      return;
    }
    if (photoAct) {
      const i = Number(photoAct.dataset.idx);
      if (photoAct.dataset.photoAct === 'hide') { api().togglePhotoAt(i); renderPhotos(); }
      if (photoAct.dataset.photoAct === 'del') { api().removePhotoAt(i); renderPhotos(); }
      return;
    }
    if (!act) return;
    switch (act.dataset.act) {
      case 'close': close(); break;
      case 'pulse': api().pulse(); toast('脉冲冲击波'); break;
      case 'fieldSim':
        fieldSim = !fieldSim;
        api().setFieldSim(fieldSim ? 1 : 0);
        if (fieldSim && api().field.mode === 0) api().setField(2, api().field.power);
        act.classList.toggle('on', fieldSim);
        toast(fieldSim ? '演示动效：虚拟手掌绕着树推粒子' : '演示动效已关');
        syncChips();
        break;
      case 'resetTune': {
        const d = api().tuneDefaults;
        Object.assign(api().tune, d);
        api().tune.count = d.count;
        api().syncTune();
        api().rebuild(Math.round(d.count));
        syncSliders();
        break;
      }
      case 'addPhoto': phInput.click(); break;
      case 'openPhotoPanel': (document.getElementById('btnPhotos') as HTMLElement)?.click(); break;
      case 'savePreset': api().savePresetLocal(); break;
      case 'loadPreset': api().loadPresetLocal(); syncAll(); break;
      case 'exportPreset': {
        const json = JSON.stringify(api().preset(), null, 2);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = 'aurora-scene.json';
        a.click();
        psCode.value = json;
        toast('配置已导出');
        break;
      }
      case 'importPreset': psInput.click(); break;
      case 'applyJson': {
        const p = parsePreset(psCode.value);
        if (!p) { toast('JSON 解析失败'); break; }
        api().applyPreset(p);
        syncAll();
        toast('已应用 JSON 配置');
        break;
      }
      case 'shot': api().snapshot(); break;
      case 'rec': api().record(); break;
    }
  });

  phInput.addEventListener('change', async () => {
    const files = Array.from(phInput.files || []);
    for (const f of files) {
      try { await api().addPhotoFile(f); } catch (e) { toast('这张图读不出来'); }
    }
    phInput.value = '';
    renderPhotos();
  });

  psInput.addEventListener('change', async () => {
    const f = psInput.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      const p = parsePreset(text);
      if (!p) { toast('文件解析失败'); psInput.value = ''; return; }
      psCode.value = text;
      api().applyPreset(p);
      syncAll();
      toast('已导入场景配置');
    } catch (e) { toast('文件解析失败'); }
    psInput.value = '';
  });

  ['input', 'change'].forEach(ev => tnSec.body.addEventListener(ev, (e) => {
    const t = e.target as HTMLInputElement;
    const key = t.dataset.tune as keyof TuneState | undefined;
    if (!key) return;
    const v = Number(t.value);
    api().tune[key] = v;
    const out = tnSec.body.querySelector(`[data-out="${key}"]`) as HTMLElement;
    if (out) out.textContent = key === 'count' ? `${Math.round(v / 1000)}k` : v.toFixed(2);
    if (key === 'count') {
      clearTimeout((t as any)._rt);
      (t as any)._rt = setTimeout(() => api().rebuild(Math.round(v)), 260);
    }
  }));

  fdSec.body.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.dataset.fieldPower) return;
    const v = Number(t.value);
    api().field.power = v;
    fdOut.textContent = v.toFixed(2);
  });

  lyWrap.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    const obj = api().layers()[t.dataset.layer as string];
    if (obj) obj.visible = t.checked;
  });

  /* 阻止编辑器内的指针事件穿透到画布手势 */
  ['pointerdown', 'pointermove', 'wheel', 'touchstart'].forEach(ev =>
    root.addEventListener(ev, (e) => e.stopPropagation(), { passive: true })
  );

  /* ================= 同步 ================= */
  function syncChips() {
    const curTheme = api().theme;
    root.querySelectorAll('[data-edtheme]').forEach((b: any) => b.classList.toggle('on', b.dataset.edtheme === curTheme));
    root.querySelectorAll('[data-edshape]').forEach((b: any) => b.classList.toggle('on', b.dataset.edshape === api().shape));
    root.querySelectorAll('[data-edfield]').forEach((b: any) => b.classList.toggle('on', Number(b.dataset.edfield) === api().field.mode));
  }

  function syncSliders() {
    TUNE_META.forEach(m => {
      const v = api().tune[m.key];
      const rng = sliders[m.key];
      if (rng) rng.value = String(v);
      const out = tnSec.body.querySelector(`[data-out="${m.key}"]`) as HTMLElement;
      if (out) out.textContent = m.key === 'count' ? `${Math.round(v / 1000)}k` : Number(v).toFixed(2);
    });
    fdRng.value = String(api().field.power);
    fdOut.textContent = Number(api().field.power).toFixed(2);
  }

  function syncLayers() {
    const L = api().layers();
    lyWrap.querySelectorAll('input[data-layer]').forEach((i: any) => {
      const o = L[i.dataset.layer];
      i.checked = o ? o.visible : true;
    });
  }

  let lastPhotoSig = '';
  function renderPhotos() {
    const list = api().photos() as any[];
    const sig = list.map(p => (p.userData.src || '') + (p.userData.hidden ? '0' : '1')).join('|');
    if (sig === lastPhotoSig) return;
    lastPhotoSig = sig;
    phGrid.innerHTML = '';
    if (!list.length) {
      phGrid.appendChild(el('p', 'edHint', '还没有照片。加几张，它们会绕着树浮成星球。'));
      return;
    }
    list.forEach((sp, i) => {
      const item = el('div', 'edPhoto' + (sp.userData.hidden ? ' hidden' : ''));
      const img = el('img');
      img.src = sp.userData.src;
      item.appendChild(img);
      item.appendChild(el('span', 'edPhotoIdx', String(i + 1)));
      const ops = el('div', 'edPhotoOps');
      ops.innerHTML = `<button data-photo-act="hide" data-idx="${i}">${sp.userData.hidden ? '显示' : '隐藏'}</button>
        <button data-photo-act="del" data-idx="${i}">删除</button>`;
      item.appendChild(ops);
      phGrid.appendChild(item);
    });
  }

  function checkCamera() {
    const cam = api().camera;
    const on = !!(cam && cam.running);
    if (on) api().pointer.on = false;
    else api().pointer.on = true;
    camStat.textContent = on ? '摄像头已开启 · 手势控制中' : '未开摄像头 · 鼠标当手（自动生效）';
    root.querySelectorAll('[data-src]').forEach((b: any) => b.classList.toggle('on', (b.dataset.src === 'camera') === on));
    (root.querySelector('[data-hud="src"]') as HTMLElement).textContent = on ? '手势' : '鼠标';
  }

  function syncBackend() {
    const b = api().backend();
    root.querySelectorAll('[data-edbackend]').forEach((x: any) => x.classList.toggle('on', x.dataset.edbackend === b.mode));
    beStat.textContent = b.active
      ? '运行中 · WebGPU ping-pong compute'
      : (b.ready ? '已就绪但当前走 WebGL 着色器路径' : (b.error ? '不可用：' + b.error : '未初始化（桌面端自动尝试）'));
  }

  function syncAll() {
    syncChips(); syncSliders(); syncLayers(); renderPhotos(); checkCamera(); syncBackend();
  }

  function open() {
    root.classList.add('show');
    document.body.classList.add('editorOpen');
    syncAll();
  }
  function close() {
    root.classList.remove('show');
    document.body.classList.remove('editorOpen');
  }
  function toggle() { root.classList.contains('show') ? close() : open(); }

  // 拦截顶栏「工作室」按钮，改开新编辑器
  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('#btnStudio')) {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  }, true);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'e' || e.key === 'E') { if (!e.target || (e.target as HTMLElement).tagName !== 'INPUT') toggle(); }
    if (e.key === 'Escape') close();
  });

  setInterval(() => {
    const st = api().stats();
    (root.querySelector('[data-hud="fps"]') as HTMLElement).textContent = st.fps + ' fps';
    (root.querySelector('[data-hud="count"]') as HTMLElement).textContent = (st.count / 1000).toFixed(1) + 'k 粒子';
    (root.querySelector('[data-hud="gpu"]') as HTMLElement).textContent = st.gpu;
    renderPhotos();
    syncBackend();
  }, 800);

  setInterval(checkCamera, 1500);
  syncAll();

  (window as any).__editor = { open, close, toggle, syncAll };
  return { open, close, toggle };
}
