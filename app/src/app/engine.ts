// @ts-nocheck —— 3.1k 行由单文件 demo 迁入，内部仍有大量隐式类型；对外契约见 src/types/aurora.ts
/* ============================================================
   1. 基础
   ============================================================ */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { PingPongParticles } from '../webgpu/compute';
import { resolveBackend } from '../core/backend';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const rand = (a, b) => a + Math.random() * (b - a);
const softstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

const IS_TOUCH = matchMedia('(hover:none)').matches;
const LOW = IS_TOUCH || innerWidth < 820;
const Q = LOW ? 0.55 : 1;
let TREE_N = Math.round(26000 * Q);
const SKY_N = Math.round(4200 * Q);
const SNOW_N = Math.round(2800 * Q);
const FW_MAX = LOW ? 1500 : 2800;
const H = 11, R = 4.6, STAR_R = 1.25;

const canvas = $('scene');
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  $('loader').innerHTML = '<div style="padding:40px;text-align:center;color:#9fb4cf;font-size:14px;line-height:2">' +
    '这个页面需要 WebGL 支持。<br>请用最新的 Chrome / Edge / Safari 打开，或在设置里开启硬件加速。</div>';
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LOW ? 1.2 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x02040a, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 5.6, 27);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth * 0.62, innerHeight * 0.62), LOW ? 0.42 : 0.55, 0.45, 0.46);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const U = {
  uTime: { value: 0 }, uPixel: { value: 1 },
  uBright: { value: 1 }, uContrast: { value: 1 }, uSizeK: { value: 1 }
};
function syncPixel() { U.uPixel.value = renderer.getPixelRatio() * innerHeight * 0.55; }
syncPixel();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloomPass.setSize(innerWidth * 0.62, innerHeight * 0.62);
  syncPixel();
});

/* ============================================================
   2. 主题
   ============================================================ */
const THEMES = {
  classic: {
    foA: 0x0b3a2b, foB: 0x2fcb8d, foC: 0xe6fff2,
    band: 0xffcf78, bandB: 0xfff6dc, trunk: 0x7a5a34,
    orn: [0xff4d6d, 0xffd166, 0x8ce8ff, 0xff9ecb, 0xc6ff9e],
    star: 0xfff3cc, snow: 0xeaf7ff,
    fw: [[0xffd98a, 0xfff4d6, 0xffab5e], [0xff6b8a, 0xffe0ec, 0xff3d63], [0x9fe8ff, 0xffffff, 0x7fd8ff]]
  },
  ice: {
    foA: 0x0a2a4a, foB: 0x4fb4ff, foC: 0xe8fbff,
    band: 0xbfefff, bandB: 0xffffff, trunk: 0x4b6f92,
    orn: [0x9fe8ff, 0x5f7dff, 0xffffff, 0x7fffd4, 0xc9d4ff],
    star: 0xf2feff, snow: 0xffffff,
    fw: [[0xa9e8ff, 0xffffff, 0x5fa8ff], [0xffffff, 0xdff6ff, 0x9fd0ff], [0x8a7bff, 0xdcd6ff, 0xc2b6ff]]
  },
  rose: {
    foA: 0x3a1026, foB: 0xff8fb6, foC: 0xfff0f6,
    band: 0xffd3e6, bandB: 0xffffff, trunk: 0x8a5568,
    orn: [0xff6fa5, 0xffd3e6, 0xffe9c4, 0xffffff, 0xc98cff],
    star: 0xfff0f7, snow: 0xffe9f2,
    fw: [[0xffd3e6, 0xffffff, 0xff6fa5], [0xc98cff, 0xffe6ff, 0xffffff], [0xffe9c4, 0xfff6e6, 0xffc98a]]
  },
  aurora: {
    foA: 0x083a38, foB: 0x5ff0c0, foC: 0xe6fff8,
    band: 0xc2ffe9, bandB: 0xffffff, trunk: 0x3f7d78,
    orn: [0x6ff5c9, 0x8a7bff, 0xffffff, 0xc2ffe9, 0x7fd8ff],
    star: 0xecfff9, snow: 0xe6fff8,
    fw: [[0x6ff5c9, 0xe6fff8, 0x2ff0b0], [0x8a7bff, 0xd8d0ff, 0xffffff], [0xc2ffe9, 0xffffff, 0x7fd8ff]]
  },
  cyber: {
    foA: 0x0d0a24, foB: 0x00e0ff, foC: 0xffe4ff,
    band: 0xff5bd0, bandB: 0xfff0ff, trunk: 0x3a2a6b,
    orn: [0x7ef9ff, 0xff5bd0, 0x8affc1, 0xc9a6ff, 0xfff08a],
    star: 0xf4fdff, snow: 0xd6e9ff,
    fw: [[0x7ef9ff, 0xe8ffff, 0x2ff0ff], [0xff5bd0, 0xffe6f9, 0xff2fa8], [0x8affc1, 0xeafff4, 0x2fe08f]]
  }
};
let themeKey = 'classic';
const TC = {};
for (const k in THEMES) {
  const t = THEMES[k];
  TC[k] = {
    foA: new THREE.Color(t.foA), foB: new THREE.Color(t.foB), foC: new THREE.Color(t.foC),
    band: new THREE.Color(t.band), bandB: new THREE.Color(t.bandB), trunk: new THREE.Color(t.trunk),
    star: new THREE.Color(t.star), snow: new THREE.Color(t.snow),
    orn: t.orn.map(h => new THREE.Color(h)),
    fw: t.fw.map(a => a.map(h => new THREE.Color(h)))
  };
}
const theme = () => TC[themeKey];
function themeColors(name) {
  const c = theme();
  return {
    foA: c.foA.getHex(), foB: c.foB.getHex(), foC: c.foC.getHex(),
    band: c.band.getHex(), orn: c.orn.map(o => o.getHex())
  };
}

/* ============================================================
   3. 程序化贴图
   ============================================================ */
function radialTexture(size = 128, stops = [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,240,210,0.55)'], [1, 'rgba(255,220,180,0)']]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(s => grd.addColorStop(s[0], s[1]));
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function flareTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2;
  const grd = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.12, 'rgba(255,246,220,0.92)');
  grd.addColorStop(0.32, 'rgba(255,214,150,0.32)');
  grd.addColorStop(0.6, 'rgba(255,190,120,0.08)');
  grd.addColorStop(1, 'rgba(255,180,110,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'lighter';
  // 十字光芒
  g.translate(cx, cx);
  for (let i = 0; i < 4; i++) {
    g.rotate(Math.PI / 2);
    const lg = g.createLinearGradient(0, 0, cx, 0);
    lg.addColorStop(0, 'rgba(255,250,235,0.85)');
    lg.addColorStop(0.4, 'rgba(255,230,190,0.12)');
    lg.addColorStop(1, 'rgba(255,220,170,0)');
    g.fillStyle = lg;
    g.beginPath();
    g.moveTo(0, -S * 0.028);
    g.lineTo(cx, -S * 0.012);
    g.lineTo(cx, S * 0.012);
    g.lineTo(0, S * 0.028);
    g.closePath();
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
function starSpriteTexture() {
  const S = 256;
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = S;
  const t = tmp.getContext('2d');
  const cx = S / 2;
  t.translate(cx, cx);
  const R1 = S * 0.44, R2 = R1 * 0.44;
  t.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? R1 : R2;
    t.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  t.closePath();
  const grd = t.createLinearGradient(0, -R1, 0, R1);
  grd.addColorStop(0, 'rgba(255,255,255,.95)');
  grd.addColorStop(0.45, 'rgba(255,238,200,.85)');
  grd.addColorStop(1, 'rgba(255,200,120,.7)');
  t.fillStyle = grd;
  t.fill();

  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  // 星形柔光：多重模糊叠加
  [[16, 0.55], [8, 0.65], [2.5, 0.5]].forEach(([b, a]) => {
    g.globalAlpha = a;
    g.filter = 'blur(' + b + 'px)';
    g.drawImage(tmp, 0, 0);
  });
  g.filter = 'none';
  g.globalAlpha = 1;
  // 中心亮核
  const rg = g.createRadialGradient(cx, cx, 0, cx, cx, S * 0.16);
  rg.addColorStop(0, 'rgba(255,255,252,.95)');
  rg.addColorStop(0.4, 'rgba(255,240,205,.5)');
  rg.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const glowTex = radialTexture(128);
const starTex = flareTexture();
const starShapeTex = starSpriteTexture();

/* ============================================================
   4. 星尘圣诞树
   ============================================================ */
function buildTree(count) {
  const group = new THREE.Group();
  const n = Math.max(2000, Math.round(count || TREE_N));
  const aTree = new Float32Array(n * 3);
  const aShapeA = new Float32Array(n * 3);
  const aShapeB = new Float32Array(n * 3);
  const aColor = new Float32Array(n * 3);
  const aSize = new Float32Array(n);
  const aSeed = new Float32Array(n);
  const aKind = new Float32Array(n);
  const meta = { kind: new Uint8Array(n), t: new Float32Array(n), ci: new Uint8Array(n), seed: new Float32Array(n) };

  // —— 分层树形：7 层树冠，每层下沿微外张，剪影像真的圣诞树 ——
  const TIERS = 7;
  const envAt = h => {
    const hh = clamp(h, 0, 0.9999) * TIERS;
    const ti = Math.floor(hh), tl = hh - ti;
    return R * (0.99 - (ti / TIERS) * 0.80) * (0.85 + 0.19 * (1 - tl));
  };
  const yAt = h => 0.4 + clamp(h, 0, 1) * H * 0.97;

  // 装饰球：贴着树冠表面挂
  const orn = [];
  for (let k = 0; k < 84; k++) {
    const h = rand(0.03, 0.95);
    const th = rand(0, Math.PI * 2);
    const rad = envAt(h) * rand(0.95, 1.03);
    orn.push({ x: Math.cos(th) * rad, y: yAt(h) + rand(-0.12, 0.12), z: Math.sin(th) * rad, ci: k % 5 });
  }

  for (let i = 0; i < n; i++) {
    const p = i * 3;
    let kind, t = 0, ci = 0, size = 0.12;
    let x = 0, y = 0, z = 0;
    const roll = Math.random();

    if (roll < 0.010) {
      // 树干
      kind = 4;
      const h = Math.random();
      const rad = 0.55 * (0.35 + h * 0.3);
      const th = rand(0, Math.PI * 2);
      x = Math.cos(th) * rad; y = -1.55 + h * 2.3; z = Math.sin(th) * rad;
      size = rand(0.1, 0.2);
    } else if (roll < 0.135) {
      // 螺旋光带 —— 五道金线绕着分层树冠盘旋（贴表面，更醒目）
      kind = 1; t = Math.random();
      const h = rand(0.008, 0.995);
      const arm = Math.floor(Math.random() * 5);
      const th = h * Math.PI * 2 * 5.2 + arm * Math.PI * 2 / 5 + rand(-0.05, 0.05);
      const rad = envAt(h) * (1.01 + rand(-0.04, 0.035));
      x = Math.cos(th) * rad; y = yAt(h) + rand(-0.03, 0.03); z = Math.sin(th) * rad;
      size = rand(0.2, 0.4);
      t = 0.3 + h * 0.7;
    } else if (roll < 0.215) {
      // 彩灯球
      kind = 2;
      const c = orn[Math.floor(Math.random() * orn.length)];
      ci = c.ci;
      const u = Math.random(), v = Math.random();
      const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
      const rr = 0.17 * Math.pow(Math.random(), 0.45);
      x = c.x + Math.sin(ph) * Math.cos(th) * rr;
      y = c.y + Math.cos(ph) * rr;
      z = c.z + Math.sin(ph) * Math.sin(th) * rr;
      size = rand(0.22, 0.42);
      t = Math.random();
    } else if (roll < 0.239) {
      // 树顶五角星（轮廓为主，内部稀疏）
      kind = 3;
      const ang = Math.random() * Math.PI * 2;
      const seg = Math.PI * 2 / 5;
      const loc = ang % seg;
      const edge = STAR_R * Math.cos(Math.PI / 5) / Math.cos(loc - Math.PI / 5);
      const rr = (Math.random() < 0.7)
        ? edge * (0.9 + Math.random() * 0.1)
        : edge * Math.pow(Math.random(), 0.85);
      x = Math.cos(ang) * rr;
      y = H + 0.66 + Math.sin(ang) * rr;
      z = rand(-0.16, 0.16);
      size = rand(0.085, 0.16);
      t = Math.random();
    } else if (roll < 0.261) {
      // 层沿光环：每层树冠下沿一圈亮边，让层次一眼可见
      kind = 5; t = Math.random();
      const k = 1 + Math.floor(Math.random() * TIERS);
      const h = clamp(k / TIERS, 0, 0.992);
      const th = rand(0, Math.PI * 2);
      const rad = envAt(h) * (0.975 + rand(-0.02, 0.02));
      x = Math.cos(th) * rad; y = yAt(h) + rand(-0.07, 0.07); z = Math.sin(th) * rad;
      size = rand(0.11, 0.21);
    } else {
      // 树冠：按层分布，外层密、里层疏，带旋转纹理
      kind = 0; t = Math.random();
      const h = Math.pow(Math.random(), 0.82);
      const env = envAt(h);
      const u = Math.pow(Math.random(), 0.42);
      const rad = env * (0.40 + 0.60 * u);
      const th = h * Math.PI * 2 * 7.2 + rand(0, Math.PI * 2 * 0.8) + (1 - u) * 0.5;
      x = Math.cos(th) * rad;
      y = yAt(h) + rand(-0.1, 0.1);
      z = Math.sin(th) * rad;
      size = rand(0.07, 0.17);
    }

    aTree[p] = x; aTree[p + 1] = y; aTree[p + 2] = z;

    // 初始散开形态：三臂旋涡星系（写入 A/B 两份，切换时以 A 为起点）
    const arm = Math.floor(Math.random() * 3);
    const tt = Math.pow(Math.random(), 0.62);
    const rad = 3.2 + tt * 16.5;
    const ang = arm * Math.PI * 2 / 3 + tt * 4.6 + rand(-0.5, 0.5);
    const sx = Math.cos(ang) * rad;
    const sy = rand(-1, 1) * (1.2 + (1 - tt) * 2.4) + 6.1;
    const sz = Math.sin(ang) * rad;
    aShapeA[p] = sx; aShapeA[p + 1] = sy; aShapeA[p + 2] = sz;
    aShapeB[p] = sx; aShapeB[p + 1] = sy; aShapeB[p + 2] = sz;

    aSize[i] = size;
    aSeed[i] = Math.random();
    aKind[i] = kind;
    meta.kind[i] = kind; meta.t[i] = t; meta.ci[i] = ci; meta.seed[i] = aSeed[i];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(aTree.slice(), 3));
  geo.setAttribute('aTree', new THREE.BufferAttribute(aTree, 3));
  geo.setAttribute('aShapeA', new THREE.BufferAttribute(aShapeA, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aShapeB', new THREE.BufferAttribute(aShapeB, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  // WebGPU ping-pong compute 写回的绝对位置（未启用时全 0，靠 uGpu=0 走原有着色器路径）
  const aPhys = new Float32Array(n * 3);
  geo.setAttribute('aPhys', new THREE.BufferAttribute(aPhys, 3).setUsage(THREE.DynamicDrawUsage));

  const uni = { uSpread: { value: 0 }, uScale: { value: 1 }, uDawn: { value: 0 },
    uMorph: { value: 0 }, uPointer: { value: new THREE.Vector3(0, 4, 0) }, uPointerOn: { value: 0 },
    // V2 力场：手掌排斥 / 吸引 / 涡旋 / 脉冲冲击波（全部在顶点着色器里算，CPU 零回读）
    uHandPos: { value: new THREE.Vector3(0, 6, 0) }, uHandOn: { value: 0 },
    uHandMode: { value: 1 }, uHandPow: { value: 1 },
    uCurl: { value: 0 }, uPulseT: { value: -999 }, uPulseOrg: { value: new THREE.Vector3(0, 6, 0) },
    uGpu: { value: 0 } };

  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, uni),
    vertexShader: `
      attribute vec3 aTree; attribute vec3 aShapeA; attribute vec3 aShapeB; attribute vec3 aColor; attribute vec3 aPhys;
      attribute float aSize; attribute float aSeed; attribute float aKind;
      uniform float uTime, uSpread, uPixel, uScale, uDawn, uMorph, uPointerOn, uSizeK;
      uniform float uHandOn, uHandMode, uHandPow, uCurl, uPulseT, uGpu;
      uniform vec3 uPointer, uHandPos, uPulseOrg;
      varying vec3 vColor; varying float vA; varying float vK; varying float vField;
      void main(){
        vField = 0.0;
        vec3 shapeP = mix(aShapeA, aShapeB, uMorph);
        vec3 p = mix(aTree, shapeP, uSpread);
        // WebGPU ping-pong 已经算好绝对位置时，直接用它（力场 uniform 会在 CPU 侧被清零）
        if (uGpu > 0.5) p = aPhys;
        // 指尖 / 鼠标牵引：靠近指端的粒子被推开，形成涟漪
        float pd = distance(p, uPointer);
        float pull = uPointerOn * (1.0 - smoothstep(0.0, 4.4, pd));
        p += normalize(p - uPointer + vec3(0.0001)) * pull * 1.1;

        /* ---- V2 GPU 力场 ---- */
        // 1) 手掌排斥 / 吸引：以掌部世界坐标为球心，按距离衰减
        float hd = distance(p, uHandPos);
        float reach = 7.4 + aSeed * 1.8;
        float fall = 1.0 - smoothstep(0.0, reach, hd);
        float dirSign = uHandMode > 1.5 ? -1.0 : 1.0;   // 1=排斥，2=吸引
        float shellK = dirSign < 0.0 ? smoothstep(0.4, 2.4, hd) : 1.0;  // 吸引时中心留空，粒子成球壳而非塌成一点
        p += normalize(p - uHandPos + vec3(0.0001)) * fall * shellK * uHandOn * uHandPow * dirSign * 3.2;
        vField = fall * uHandOn * uHandPow;

        // 2) 涡旋：手掌附近绕竖直轴的角向剪切，粒子越多越像流体
        float ang = fall * uCurl * uHandOn * (0.55 + aSeed * 0.9) * uHandPow;
        float cs = cos(ang), sn = sin(ang);
        vec3 rel = p - vec3(uHandPos.x, p.y, uHandPos.z);
        vec3 rot = vec3(rel.x * cs - rel.z * sn, 0.0, rel.x * sn + rel.z * cs);
        p += (rot - rel) * 0.42;

        // 3) 脉冲冲击波：从掌心向外扩散的环带，随时间自衰减
        float age = uTime - uPulseT;
        if (age > 0.0 && age < 2.6) {
          float r = age * 7.5;
          float band = 1.0 - smoothstep(0.0, 1.7, abs(distance(p, uPulseOrg) - r));
          p += normalize(p - uPulseOrg + vec3(0.0001)) * band * (1.0 - age / 2.6) * 4.2;
        }
        /* ---- /V2 力场 ---- */

        float amp = 0.015 + 0.11 * uSpread;
        p.x += sin(uTime * 0.5 + aSeed * 41.0) * amp;
        p.y += cos(uTime * 0.42 + aSeed * 23.0) * amp * 1.2;
        p.z += sin(uTime * 0.58 + aSeed * 13.0) * amp;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = max(0.6, -mv.z);
        float tw = 0.62 + 0.38 * sin(uTime * (1.3 + aSeed * 3.4) + aSeed * 60.0);
        float sz = aSize * uScale * uPixel / dist * (1.0 - 0.5 * uSpread) * uSizeK;
        gl_PointSize = clamp(sz, 0.9, 9.0);
        vColor = aColor;
        vA = (0.5 + 0.5 * min(1.0, sz / 2.6)) * (0.62 + 0.55 * tw) * uDawn;
        vA *= (1.0 + 0.9 * vField);
        vColor = mix(vColor, vColor * 1.25 + vec3(0.10, 0.07, 0.02), clamp(vField, 0.0, 1.0));
        vK = aKind;
      }`,
    fragmentShader: `
      varying vec3 vColor; varying float vA; varying float vK; varying float vField;
      uniform float uBright, uContrast;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        if(d > 0.5) discard;
        float core = smoothstep(0.5, 0.03, d);
        float halo = pow(max(0.0, 1.0 - d * 2.0), 2.4);
        vec3 col = vColor * (0.32 + 1.15 * core) * (0.5 + 0.55 * halo);
        col = (col - 0.5) * uContrast + 0.5;
        col *= uBright;
        float a = (halo * 0.5 + core * 0.8) * vA;
        gl_FragColor = vec4(max(col, 0.0), a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 1;
  group.add(points);

  // 树顶光晕
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: starTex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false, opacity: 0.62
  }));
  halo.name = 'treeHalo';
  halo.position.set(0, H + 0.5, 0);
  halo.scale.set(2.9, 2.9, 1);
  halo.renderOrder = 5;
  group.add(halo);

  // 清晰星形
  const starSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: starShapeTex, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: false, opacity: 0.48
  }));
  starSprite.name = 'treeStar';
  starSprite.position.set(0, H + 0.5, 0.2);
  starSprite.scale.set(2.7, 2.7, 1);
  starSprite.renderOrder = 6;
  group.add(starSprite);

  // 树心柔光
  const core = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: new THREE.Color(0x2f8f68), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0.16
  }));
  core.name = 'treeCore';
  core.position.set(0, 4.4, 0);
  core.scale.set(10, 13, 1);
  core.renderOrder = 0;
  group.add(core);

  return { group, points, geo, mat, uni, halo, core, starSprite, meta, aColor, aShapeA, aShapeB, aTree };
}

let tree = buildTree();
tree.group.name = 'treeGroup';
scene.add(tree.group);

function paintTree() {
  const c = theme();
  const { kind, t, ci, seed } = tree.meta;
  const arr = tree.aColor;
  const tmp = new THREE.Color();
  const N = tree.meta.kind.length;
  for (let i = 0; i < N; i++) {
    const p = i * 3, k = kind[i];
    let bright = 1;
    if (k === 0) {
      tmp.copy(c.foA).lerp(c.foB, t[i]);
      bright = 0.15 + 0.19 * t[i];
      if (seed[i] > 0.93) { tmp.lerp(c.foC, 0.6); bright = 0.32; }
      else if (seed[i] < 0.1) bright = 0.07;
    } else if (k === 1) {
      tmp.copy(c.bandB).lerp(c.band, Math.pow(t[i], 0.7));
      bright = 0.32 + 0.18 * (1 - Math.abs(t[i] - 0.55) * 2);
    } else if (k === 2) {
      tmp.copy(c.orn[ci[i]]);
      bright = 0.4;
    } else if (k === 3) {
      tmp.copy(c.star).lerp(new THREE.Color(0xffffff), 0.35);
      bright = 0.55;
    } else if (k === 5) {
      // 层沿光环：暖金细边，比树冠亮一点但不抢戏
      tmp.copy(c.band).lerp(new THREE.Color(0xffe6c0), 0.35);
      bright = 0.28 + 0.09 * t[i];
    } else {
      tmp.copy(c.trunk);
      bright = 0.12;
    }
    arr[p] = tmp.r * bright;
    arr[p + 1] = tmp.g * bright;
    arr[p + 2] = tmp.b * bright;
  }
  tree.geo.attributes.aColor.needsUpdate = true;
  tree.halo.material.color.copy(c.star);
  tree.starSprite.material.color.copy(c.star);
  tree.core.material.color.copy(c.foB);
}
paintTree();

/* ============================================================
   4.5 多形态：星云 / 爱心 / 雪花 / 五角星 / 文字
   ============================================================ */
const SHAPE_ORDER = ['heart', 'star', 'flake', 'wreath', 'galaxy', 'text'];
const SHAPE_LABEL = { heart: '爱心', star: '五角星', flake: '雪花', wreath: '花环', galaxy: '星云', text: 'MERRY' };
let shapeNow = 'galaxy';
let shapeTextPts = null;
const srnd = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

function textSamples() {
  if (shapeTextPts) return shapeTextPts;
  const cv = document.createElement('canvas');
  cv.width = 1100; cv.height = 300;
  const g = cv.getContext('2d');
  g.fillStyle = '#fff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 150px Cinzel, Georgia, serif';
  g.fillText('MERRY', 550, 92);
  g.font = '700 118px Cinzel, Georgia, serif';
  g.fillText('CHRISTMAS', 550, 218);
  const d = g.getImageData(0, 0, cv.width, cv.height).data;
  const pts = [];
  for (let y = 0; y < cv.height; y += 1) {
    for (let x = 0; x < cv.width; x += 1) {
      if (d[(y * cv.width + x) * 4 + 3] > 110) { pts.push(x, y); }
    }
  }
  shapeTextPts = pts;
  return pts;
}

let flakeSegs = null;
function ensureFlakeSegs() {
  if (flakeSegs) return flakeSegs;
  const a = [];
  const push = (x1, y1, x2, y2, w) => a.push(x1, y1, x2, y2, w);
  for (let k = 0; k < 6; k++) {
    const ang = k * Math.PI / 3, dx = Math.cos(ang), dy = Math.sin(ang) * 0.9;
    const L = 11.4;
    push(dx * 2.0, dy * 2.0, dx * L, dy * L, 3.4); // 主臂
    for (const rr of [6.2, 9.4]) {                  // 两处 45° 分叉
      const bx = dx * rr, by = dy * rr;
      for (const dir of [1, -1]) {
        const ba = ang + dir * Math.PI / 4;
        const bl = rr > 8 ? 1.3 : 1.7;
        push(bx, by, bx + Math.cos(ba) * bl, by + Math.sin(ba) * bl * 0.9, 1.5);
      }
    }
    const ang2 = (k + 1) * Math.PI / 3;             // 中心六边形的一边
    push(dx * 2.0, dy * 2.0, Math.cos(ang2) * 2.0, Math.sin(ang2) * 2.0 * 0.9, 0.9);
  }
  flakeSegs = a;
  return a;
}

function shapePoint(name, i, out, p) {
  if (name === 'heart') {
    const t = srnd(i, 4) * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const s = 0.6 + 0.4 * Math.pow(srnd(i, 5), 0.5);
    const jx = (srnd(i, 6) - 0.5) * 0.55, jy = (srnd(i, 7) - 0.5) * 0.55;
    out[p] = hx * 0.42 * s + jx;
    out[p + 1] = hy * 0.42 * s + 6.8 + (1 - s) * 2.6 + jy;
    out[p + 2] = (srnd(i, 8) * 2 - 1) * 1.7 * Math.sqrt(Math.max(0, 1 - s * s));
  } else if (name === 'flake') {
    const S6 = ensureFlakeSegs();
    const pick = srnd(i, 7) * 61.8;
    let acc = 0, j = 0;
    for (; j < S6.length; j += 5) { acc += S6[j + 4]; if (pick <= acc) break; }
    j = Math.min(j, S6.length - 5);
    const u = srnd(i, 8);
    out[p] = (S6[j] + (S6[j + 2] - S6[j]) * u) * 0.68 + (srnd(i, 9) - 0.5) * 0.26;
    out[p + 1] = (S6[j + 1] + (S6[j + 3] - S6[j + 1]) * u) * 0.68 + 5.6 + (srnd(i, 10) - 0.5) * 0.26;
    out[p + 2] = (srnd(i, 11) * 2 - 1) * 0.7;
  } else if (name === 'star') {
    if (srnd(i, 14) < 0.14) {
      // 五个尖角处加密，让星形棱角更清晰
      const k = Math.floor(srnd(i, 15) * 5);
      const a = Math.PI / 2 + k * (Math.PI * 2 / 5);
      const rr = 9.0 * (0.92 + 0.08 * Math.pow(srnd(i, 16), 0.5));
      out[p] = Math.cos(a) * rr + (srnd(i, 17) - 0.5) * 0.3;
      out[p + 1] = Math.sin(a) * rr + 5.6 + (srnd(i, 18) - 0.5) * 0.3;
      out[p + 2] = (srnd(i, 19) * 2 - 1) * 1.0;
      return;
    }
    const ang = srnd(i, 9) * Math.PI * 2;
    const loc = ang % (Math.PI * 2 / 5);
    const edge = 9.0 * Math.cos(Math.PI / 5) / Math.cos(loc - Math.PI / 5);
    const rr = srnd(i, 10) < 0.7 ? edge * (0.965 + 0.035 * srnd(i, 11)) : edge * Math.pow(srnd(i, 12), 1.4) * 0.92;
    out[p] = Math.cos(ang) * rr;
    out[p + 1] = Math.sin(ang) * rr + 5.6;
    out[p + 2] = (srnd(i, 13) * 2 - 1) * 1.1;
  } else if (name === 'wreath') {
    // 圣诞花环：双股编织环带 + 顶部蝴蝶结 + 零散浆果
    const pick = srnd(i, 20);
    if (pick < 0.17) {
      const k = srnd(i, 21) < 0.5 ? -1 : 1;
      if (srnd(i, 22) < 0.64) {
        // 蝴蝶结左/右环
        const th = srnd(i, 23) * Math.PI * 2;
        out[p] = k * (0.95 + Math.cos(th) * 0.86) + (srnd(i, 34) - 0.5) * 0.1;
        out[p + 1] = 12.86 + Math.sin(th) * 0.66 + (srnd(i, 35) - 0.5) * 0.1;
        out[p + 2] = Math.sin(th) * 0.38;
      } else {
        // 两条飘带
        const u = srnd(i, 24);
        out[p] = k * (0.35 + u * 1.55) - k * Math.sin(u * 3.1) * 0.22;
        out[p + 1] = 12.5 - u * 2.2;
        out[p + 2] = (srnd(i, 25) * 2 - 1) * 0.45;
      }
      return;
    }
    const ang = srnd(i, 26) * Math.PI * 2;
    const strand = srnd(i, 27);                                  // 两股错开的枝条
    const tw = Math.sin(ang * 7 + strand * Math.PI) * 0.34;      // 编织起伏
    const off = (srnd(i, 29) * 2 - 1) * 0.82;
    const rr = 6.85 + (strand < 0.55 ? 0 : 0.48) + tw + off;
    out[p] = Math.cos(ang) * rr + (srnd(i, 30) - 0.5) * 0.16;
    out[p + 1] = Math.sin(ang) * rr * 0.9 + 5.9 + (srnd(i, 31) - 0.5) * 0.16;
    out[p + 2] = (srnd(i, 32) * 2 - 1) * (0.3 + 0.7 * srnd(i, 33));
  } else if (name === 'text') {
    const pts = textSamples();
    const idx = Math.floor(srnd(i, 14) * (pts.length / 2)) * 2;
    out[p] = (pts[idx] - 550) / 1100 * 26 + (srnd(i, 15) - 0.5) * 0.2;
    out[p + 1] = (150 - pts[idx + 1]) / 300 * 7.3 + 5.2 + (srnd(i, 16) - 0.5) * 0.2;
    out[p + 2] = (srnd(i, 17) * 2 - 1) * 0.55;
  } else {
    const arm = i % 3;
    const tt = Math.pow(srnd(i, 1), 0.62);
    const rad = 3.2 + tt * 16.5;
    const ang = arm * Math.PI * 2 / 3 + tt * 4.6 + (srnd(i, 2) - 0.5);
    out[p] = Math.cos(ang) * rad;
    out[p + 1] = 6.1 + (srnd(i, 3) * 2 - 1) * (1.2 + (1 - tt) * 2.4);
    out[p + 2] = Math.sin(ang) * rad;
  }
}

function buildShapeInto(name, out) {
  const N = tree.meta.kind.length;
  for (let i = 0; i < N; i++) shapePoint(name, i, out, i * 3);
}

function paintShape(name) {
  const c = theme();
  const arr = tree.aColor, tmp = new THREE.Color(), white = new THREE.Color(0xffffff);
  const seed = tree.meta.seed, B = tree.aShapeB;
  const N = tree.meta.kind.length;
  for (let i = 0; i < N; i++) {
    const p = i * 3, s = seed[i], y = B[p + 1];
    let bright = 0.5;
    if (name === 'heart') {
      tmp.copy(c.orn[0]).lerp(c.band, s);
      bright = 0.42 + 0.34 * Math.min(1, Math.max(0, (y - 1.2) / 10));
    } else if (name === 'flake') {
      tmp.copy(c.star).lerp(c.foC, s * 0.85);
      bright = 0.46 + 0.18 * s;
    } else if (name === 'star') {
      tmp.copy(c.band).lerp(white, 0.35 * s);
      bright = 0.52 + 0.12 * s;
    } else if (name === 'wreath') {
      // 环带常青绿，顶部蝴蝶结艳红，掺金亮点 + 少量雪白
      const y = B[p + 1];
      if (y > 12.15) { tmp.copy(c.orn[0]); bright = 0.8 + 0.16 * s; }
      else if (s > 0.86) { tmp.copy(c.orn[0]); bright = 0.86; }
      else if (s > 0.78) { tmp.copy(c.band); bright = 0.74; }
      else if (s < 0.08) { tmp.copy(white); bright = 0.5; }
      else { tmp.copy(c.foB).lerp(c.foA, Math.min(1, s * 1.7)); bright = 0.34 + 0.24 * Math.abs(Math.sin(y * 1.9)); }
    } else if (name === 'text') {
      tmp.copy(c.foB).lerp(c.band, s);
      bright = 0.4 + 0.22 * s;
    } else {
      tmp.copy(c.orn[i % c.orn.length]).lerp(c.band, s * 0.6);
      bright = 0.36 + 0.16 * s;
    }
    arr[p] = tmp.r * bright; arr[p + 1] = tmp.g * bright; arr[p + 2] = tmp.b * bright;
  }
  tree.geo.attributes.aColor.needsUpdate = true;
}

function setShape(name, quiet) {
  if (!SHAPE_LABEL[name] || name === shapeNow) return;
  const A = tree.aShapeA, B = tree.aShapeB;
  const m = tree.uni.uMorph.value;
  if (m > 0.001) {
    for (let k = 0; k < A.length; k++) A[k] = A[k] * (1 - m) + B[k] * m;
    tree.geo.attributes.aShapeA.needsUpdate = true;
  }
  buildShapeInto(name, B);
  tree.geo.attributes.aShapeB.needsUpdate = true;
  tree.uni.uMorph.value = 0;
  shapeNow = name;
  S.morph = 0; S.morphing = true;
  paintShape(name);
  document.querySelectorAll('.shchip').forEach(b => b.classList.toggle('on', b.dataset.shape === name));
  if (S.spread < 0.2) S.spreadT = 1;
  S.galleryT = 0;
  if (!quiet) {
    sfxChime();
    fireworks.burst(0, 7.6, 0, theme().fw, 150, 3.4, 1);
    toast('形态 · ' + SHAPE_LABEL[name], 1600);
  }
}

function tickMorph(dt) {
  if (!S.morphing) return;
  S.morph = Math.min(1, S.morph + dt * 1.55);
  tree.uni.uMorph.value = S.morph;
  if (S.morph >= 1) {
    tree.aShapeA.set(tree.aShapeB);
    tree.geo.attributes.aShapeA.needsUpdate = true;
    tree.uni.uMorph.value = 0;
    S.morphing = false; S.morph = 0;
  }
}

document.querySelectorAll('.shchip').forEach(btn => {
  btn.addEventListener('click', () => setShape(btn.dataset.shape));
});
addEventListener('keydown', e => {
  if (e.key >= '1' && e.key <= '9') {
    const n = SHAPE_ORDER[+e.key - 1];
    if (n) setShape(n);
  }
});

/* ============================================================
   5. 星空 / 雪 / 极光 / 地面
   ============================================================ */
function buildSky() {
  const n = SKY_N;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  const siz = new Float32Array(n);
  const sed = new Float32Array(n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = rand(52, 105);
    const th = rand(0, Math.PI * 2);
    const ph = Math.acos(rand(-0.55, 1));
    pos[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    pos[i * 3 + 1] = Math.cos(ph) * r + 8;
    pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    const pick = Math.random();
    if (pick < 0.62) c.setHex(0xdceaff);
    else if (pick < 0.8) c.setHex(0xffe9c4);
    else if (pick < 0.92) c.setHex(0x9fd8ff);
    else c.setHex(0xffc2dd);
    const b = rand(0.18, 0.55);
    col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
    siz[i] = Math.random() < 0.008 ? rand(0.3, 0.5) : rand(0.08, 0.26);
    sed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(sed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U),
    vertexShader: `
      attribute vec3 aColor; attribute float aSize; attribute float aSeed;
      uniform float uTime, uPixel;
      varying vec3 vC; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uPixel * 0.55 / max(0.6, -mv.z) * 6.0, 1.0, 4.2);
        float tw = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * (0.4 + aSeed * 1.6) + aSeed * 80.0), 2.0);
        vC = aColor; vA = tw;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        if(d > 0.5) discard;
        float g = pow(max(0.0, 1.0 - d * 2.0), 2.2);
        gl_FragColor = vec4(vC * (0.12 + 0.88 * g), g * vA);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.name = 'sky';
  scene.add(pts);
}
buildSky();

function buildSnow() {
  const n = SNOW_N;
  const pos = new Float32Array(n * 3);
  const sz = new Float32Array(n);
  const sp = new Float32Array(n);
  const sd = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rand(-32, 32);
    pos[i * 3 + 1] = rand(-4, 28);
    pos[i * 3 + 2] = rand(-26, 26);
    sz[i] = rand(0.1, 0.32);
    sp[i] = rand(0.25, 1.1);
    sd[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(sp, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U),
    vertexShader: `
      attribute float aSize; attribute float aSpeed; attribute float aSeed;
      uniform float uTime, uPixel;
      varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(position.y - uTime * aSpeed * 0.55 - 4.0, 34.0) - 4.0;
        p.x += sin(uTime * 0.35 + aSeed * 22.0) * 0.9 + sin(uTime * 0.11 + aSeed * 4.0) * 1.7;
        p.z += cos(uTime * 0.31 + aSeed * 17.0) * 0.9;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uPixel / max(0.6, -mv.z), 0.7, 9.0);
        vA = 0.4 + 0.45 * sin(uTime * 1.2 + aSeed * 40.0);
      }`,
    fragmentShader: `
      varying float vA;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        if(d > 0.5) discard;
        float g = pow(max(0.0, 1.0 - d * 2.0), 2.0);
        gl_FragColor = vec4(vec3(0.8, 0.92, 1.0) * (0.24 + 0.62 * g), g * (0.26 + 0.46 * vA));
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.name = 'snow';
  scene.add(pts);
}
buildSnow();

function buildAurora() {
  const geo = new THREE.PlaneGeometry(190, 34);
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1,0)), u.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
      }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 3; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        float t = uTime * 0.055;
        float x = vUv.x;
        float f = fbm(vec2(x * 3.2, t * 1.4));
        float curtain = 0.0;
        for(int k = 0; k < 2; k++){
          float fk = float(k);
          float cx = 0.3 + fk * 0.34 + sin(t * 2.2 + fk * 2.4) * 0.07 + f * 0.1;
          float w = 0.032 + 0.018 * sin(t * 1.7 + fk);
          curtain += smoothstep(w, 0.0, abs(x - cx)) * (0.5 + 0.5 * sin(vUv.y * 12.0 + t * 6.0));
        }
        float y = vUv.y;
        float fade = smoothstep(0.0, 0.42, y) * smoothstep(1.0, 0.5, y);
        vec3 c1 = vec3(0.12, 0.85, 0.62);
        vec3 c2 = vec3(0.42, 0.34, 1.0);
        vec3 c3 = vec3(0.95, 0.5, 0.85);
        vec3 col = mix(c1, c2, x) + c3 * pow(fade, 3.0) * 0.12;
        gl_FragColor = vec4(col, curtain * fade * 0.05);
      }`
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'aurora';
  mesh.position.set(0, 21, -74);
  mesh.frustumCulled = false;
  scene.add(mesh);

  // 银河雾
  const neb = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: new THREE.Color(0x1b2c56), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55, depthTest: false
  }));
  neb.position.set(-14, 22, -80);
  neb.name = 'neb';
  neb.scale.set(74, 46, 1);
  neb.material.opacity = 0.025;
  scene.add(neb);
  const neb2 = neb.clone();
  neb2.name = 'neb2';
  neb2.material = neb.material.clone();
  neb2.material.color = new THREE.Color(0x14364a);
  neb2.position.set(20, 12, -85);
  neb2.scale.set(62, 40, 1);
  scene.add(neb2);
}
buildAurora();

function buildGround() {
  const geo = new THREE.CircleGeometry(75, 64);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      void main(){
        vec2 c = vUv * 2.0 - 1.0;
        float d = length(c);
        if(d > 1.0) discard;
        float glow = pow(max(0.0, 1.0 - d), 3.4);
        float ripple = sin(d * 26.0 - uTime * 0.8) * 0.5 + 0.5;
        vec3 col = mix(vec3(0.02, 0.06, 0.12), vec3(0.35, 0.62, 0.85), glow * 0.6);
        col += vec3(0.45, 0.62, 0.9) * ripple * glow * 0.1;
        gl_FragColor = vec4(col, glow * 0.055);
      }`
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'ground';
  mesh.position.y = -1.65;
  scene.add(mesh);

  // 暗色雪地，让树"落地"
  const discMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U),
    transparent: true, depthWrite: true,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      void main(){
        vec2 c = vUv * 2.0 - 1.0;
        float d = length(c);
        if(d > 1.0) discard;
        float edge = smoothstep(1.0, 0.3, d);
        float snow = sin(c.x * 16.0 + uTime * 0.1) * sin(c.y * 13.0 - uTime * 0.08);
        vec3 col = vec3(0.008, 0.017, 0.032) + snow * 0.006;
        gl_FragColor = vec4(col, edge * 0.9);
      }`
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(55, 72).rotateX(-Math.PI / 2), discMat);
  disc.name = 'groundDisc';
  disc.position.y = -1.72;
  disc.renderOrder = -2;
  scene.add(disc);
}
buildGround();

/* ============================================================
   6. 烟花
   ============================================================ */
class Fireworks {
  constructor(max) {
    this.max = max;
    this.cursor = 0;
    this.parts = new Array(max);
    for (let i = 0; i < max; i++) {
      this.parts[i] = { x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0, r: 0, g: 0, b: 0, active: false };
    }
    const pos = new Float32Array(max * 3);
    const col = new Float32Array(max * 3);
    const alpha = new Float32Array(max);
    const size = new Float32Array(max);
    for (let i = 0; i < max; i++) pos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({}, U),
      vertexShader: `
        attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
        uniform float uPixel;
        varying vec3 vC; varying float vA;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uPixel / max(0.6, -mv.z), 1.0, 26.0);
          vC = aColor; vA = aAlpha;
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vA;
        void main(){
          vec2 q = gl_PointCoord - 0.5;
          float d = length(q);
          if(d > 0.5) discard;
          float g = pow(max(0.0, 1.0 - d * 2.0), 2.0);
          gl_FragColor = vec4(vC * (0.7 + 1.6 * g), g * vA);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = 'fw';
    this.points.renderOrder = 6;
    this.geo = geo;
    scene.add(this.points);
  }
  burst(x, y, z, palette, count = 220, power = 4.2, spread = 1) {
    const c = palette[Math.floor(Math.random() * palette.length)];
    for (let k = 0; k < count; k++) {
      const i = this.cursor = (this.cursor + 1) % this.max;
      const q = this.parts[i];
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      const v = power * (0.45 + 0.55 * Math.pow(Math.random(), 0.5));
      q.x = x + rand(-0.1, 0.1); q.y = y; q.z = z + rand(-0.1, 0.1);
      q.vx = Math.sin(ph) * Math.cos(th) * v * spread;
      q.vy = Math.cos(ph) * v * 0.82 + 0.6;
      q.vz = Math.sin(ph) * Math.sin(th) * v * spread;
      q.life = q.max = rand(1.1, 2.3);
      q.size = rand(0.1, 0.28);
      const pick = c[Math.floor(Math.random() * c.length)];
      q.r = pick.r; q.g = pick.g; q.b = pick.b;
      q.active = true;
    }
  }
  update(dt) {
    const pos = this.geo.attributes.position.array;
    const col = this.geo.attributes.aColor.array;
    const alp = this.geo.attributes.aAlpha.array;
    const siz = this.geo.attributes.aSize.array;
    let dirty = false;
    for (let i = 0; i < this.max; i++) {
      const q = this.parts[i];
      if (!q.active) continue;
      dirty = true;
      q.life -= dt;
      if (q.life <= 0) {
        q.active = false;
        alp[i] = 0;
        pos[i * 3 + 1] = -999;
        continue;
      }
      const drag = Math.exp(-dt * 1.15);
      q.vx *= drag; q.vz *= drag; q.vy = q.vy * drag - 1.6 * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      const k = q.life / q.max;
      const flick = 0.75 + 0.25 * Math.sin(q.life * 44 + i);
      pos[i * 3] = q.x; pos[i * 3 + 1] = q.y; pos[i * 3 + 2] = q.z;
      col[i * 3] = q.r; col[i * 3 + 1] = q.g; col[i * 3 + 2] = q.b;
      alp[i] = Math.pow(k, 1.35) * flick;
      siz[i] = q.size;
    }
    if (dirty) {
      this.geo.attributes.position.needsUpdate = true;
      this.geo.attributes.aColor.needsUpdate = true;
      this.geo.attributes.aAlpha.needsUpdate = true;
      this.geo.attributes.aSize.needsUpdate = true;
    }
  }
}
const fireworks = new Fireworks(FW_MAX);

/* ============================================================
   7. 照片
   ============================================================ */
const PHOTO_MAX = 10;
/* 球面均匀分布（Fibonacci 球）：照片像星云一样浮在树周围 */
const PHOTO_SLOTS = (() => {
  const out = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < PHOTO_MAX; i++) {
    const yy = 1 - (i / Math.max(1, PHOTO_MAX - 1)) * 2;      // -1 … 1
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy));
    const th = ga * i;
    out.push({
      x: Math.cos(th) * rr, y: yy, z: Math.sin(th) * rr,
      r: 7.4 + (i % 3) * 0.7,           // 半径轻微参差，像云不是壳
      s: 0.95 + (i % 4) * 0.055,
      ph: i * 0.83
    });
  }
  return out;
})();
const PHOTO_SPHERE = { cy: 5.4, ry: 0.64 };
const photoGroup = new THREE.Group();
photoGroup.renderOrder = 4;
tree.group.add(photoGroup);
const photos = [];
const photoSources = [];

function makePhotoTexture(img) {
  const S = 512, cx = S / 2;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  // 1. 圆形裁切 + cover 填满
  const disc = S * 0.5 - 6;
  g.save();
  g.beginPath(); g.arc(cx, cx, disc, 0, Math.PI * 2); g.clip();
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const scale = Math.max((disc * 2) / iw, (disc * 2) / ih);
  const dw = iw * scale, dh = ih * scale;
  g.drawImage(img, cx - dw / 2, cx - dh / 2, dw, dh);
  // 圆形内侧压暗，贴住粒子世界的色调
  const vg = g.createRadialGradient(cx, cx, disc * 0.55, cx, cx, disc);
  vg.addColorStop(0, 'rgba(6,12,22,0)');
  vg.addColorStop(1, 'rgba(6,12,22,.34)');
  g.fillStyle = vg;
  g.fillRect(0, 0, S, S);
  g.restore();
  // 2. 边缘羽化 → 和粒子融为一体（destination-in 保留中间、透明边缘）
  const mask = g.createRadialGradient(cx, cx, disc * 0.58, cx, cx, disc * 1.02);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.72, 'rgba(0,0,0,.88)');
  mask.addColorStop(0.92, 'rgba(0,0,0,.35)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalCompositeOperation = 'destination-in';
  g.fillStyle = mask;
  g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
  // 3. 一圈暖金细边 + 外发光，像被粒子托住的记忆球
  g.strokeStyle = 'rgba(255,226,170,.55)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cx, disc * 0.9, 0, Math.PI * 2); g.stroke();
  const halo = g.createRadialGradient(cx, cx, disc * 0.84, cx, cx, disc * 1.06);
  halo.addColorStop(0, 'rgba(255,214,150,0)');
  halo.addColorStop(0.5, 'rgba(255,214,150,.22)');
  halo.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, S, S);
  // 4. 外圈一圈小粒子：让它看起来是「由星尘托住的照片星球」
  const dots = 52;
  for (let i = 0; i < dots; i++) {
    const a = (i / dots) * Math.PI * 2 + Math.random() * 0.12;
    const rr = disc * (0.965 + Math.random() * 0.11);
    const x = cx + Math.cos(a) * rr, y = cx + Math.sin(a) * rr;
    const rad = 2.0 + Math.random() * 2.6;
    const dg = g.createRadialGradient(x, y, 0, x, y, rad * 2.6);
    dg.addColorStop(0, 'rgba(255,244,214,' + (0.5 + Math.random() * 0.4).toFixed(2) + ')');
    dg.addColorStop(0.45, 'rgba(255,222,160,.34)');
    dg.addColorStop(1, 'rgba(255,210,140,0)');
    g.fillStyle = dg;
    g.beginPath(); g.arc(x, y, rad * 2.6, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function freeSlot() {
  const used = new Set(photos.map(p => p.userData.slot));
  for (let i = 0; i < PHOTO_SLOTS.length; i++) if (!used.has(i)) return i;
  return -1;
}

function slotPos(slot, out) {
  const r = slot.r;
  out.set(slot.x * r, PHOTO_SPHERE.cy + slot.y * r * PHOTO_SPHERE.ry, slot.z * r);
  return out;
}

function addPhoto(img, src) {
  if (photos.length >= PHOTO_MAX) {
    toast('最多 ' + PHOTO_MAX + ' 张，先删一张再添加吧', 2200);
    return false;
  }
  const si = freeSlot();
  if (si < 0) return false;
  const slot = PHOTO_SLOTS[si];
  const tex = makePhotoTexture(img);
  const mat = new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: false,
    color: 0xffffff, toneMapped: true, opacity: TUNE.photoOpacity
  });
  const sp = new THREE.Sprite(mat);
  sp.userData.slot = si;
  sp.userData.tree = slotPos(slot, new THREE.Vector3());
  sp.userData.size = slot.s;
  sp.userData.src = src;
  sp.userData.hidden = false;
  sp.position.copy(sp.userData.tree);
  sp.scale.set(slot.s * TUNE.photoSize, slot.s * TUNE.photoSize, 1);
  sp.renderOrder = 4;
  photoGroup.add(sp);
  photos.push(sp);
  renderPhotoPanel();
  return true;
}

function removePhoto(sp) {
  const i = photos.indexOf(sp);
  if (i < 0) return;
  photos.splice(i, 1);
  photoGroup.remove(sp);
  if (sp.material.map) sp.material.map.dispose();
  sp.material.dispose();
  const src = sp.userData.src;
  if (typeof src === 'string' && src.startsWith('blob:')) URL.revokeObjectURL(src);
  if (PHOTOGRAB.sp === sp) PHOTOGRAB.sp = null;
  const j = photoSources.findIndex(p => p.sp === sp);
  if (j >= 0) photoSources.splice(j, 1);
  renderPhotoPanel();
  toast('照片已移除 · 还剩 ' + photos.length + ' 张', 1600);
}

function renderPhotoPanel() {
  const grid = $('ppGrid');
  if (!grid) return;
  grid.innerHTML = '';
  photos.forEach(sp => {
    const item = document.createElement('div');
    item.className = 'ppItem';
    const img = document.createElement('img');
    img.src = sp.userData.src;
    img.alt = '照片';
    item.appendChild(img);
    const del = document.createElement('button');
    del.className = 'ppDel';
    del.textContent = '×';
    del.title = '删除这张';
    del.onclick = e => { e.stopPropagation(); removePhoto(sp); };
    item.appendChild(del);
    const eye = document.createElement('button');
    eye.className = 'ppHide';
    eye.textContent = sp.userData.hidden ? '◌' : '◉';
    eye.title = sp.userData.hidden ? '显示这张' : '隐藏这张';
    eye.onclick = e => { e.stopPropagation(); togglePhotoHidden(sp); };
    item.appendChild(eye);
    if (sp.userData.hidden) item.classList.add('off');
    item.onclick = () => { if (typeof openPhoto === 'function') openPhoto(sp.userData.src); };
    grid.appendChild(item);
    if (!photoSources.some(p => p.sp === sp)) photoSources.push({ sp, src: sp.userData.src });
  });
  const cnt = $('ppCount');
  if (cnt) cnt.textContent = String(photos.length);
  const tip = $('ppTip');
  if (tip) {
    const hid = photos.filter(p => p.userData.hidden).length;
    tip.textContent = hid
      ? '已隐藏 ' + hid + ' 张 · 点 ◌ 可恢复显示'
      : '🤏 照片浮成星云球，捏合可抓住任意一颗；👁 隐藏 / × 删除 / 点缩略图看大图。';
  }
}

function togglePhotoHidden(sp) {
  const h = !sp.userData.hidden;
  sp.userData.hidden = h;
  sp.visible = !h;
  if (h && PHOTOGRAB.sp === sp) { PHOTOGRAB.sp = null; }
  renderPhotoPanel();
  toast(h ? '已隐藏这张 · 粒子区域更干净了' : '照片已恢复显示', 1500);
}

/* ============================================================
   8. 全局交互状态
   ============================================================ */
const S = {
  spread: 0, spreadT: 0,
  rot: 0, rotVel: 0,
  dist: 27, distT: 27,
  gallery: 0, galleryT: 0,
  dawn: 0,
  label: 'none', conf: 0,
  handOn: false, handReady: false,
  lastBurst: 0, lastWish: 0,
  muted: true, clean: false,
  morph: 0, morphing: false,
  autoBurstAt: 4
};

/* ============================================================
   8.5 粒子参数（数量 / 速度 / 亮度 / 对比度 / 大小 / 泛光）
   ============================================================ */
const TUNE_DEFAULT = { count: TREE_N, speed: 1, bright: 1, contrast: 1, size: 1, glow: 0.55, photoSize: 1, photoOpacity: 0.92 };
const TUNE = Object.assign({}, TUNE_DEFAULT);
try {
  const saved = JSON.parse(localStorage.getItem('xmas-tune') || 'null');
  if (saved && typeof saved === 'object') {
    for (const k in TUNE_DEFAULT) if (typeof saved[k] === 'number') TUNE[k] = saved[k];
  }
} catch (e) {}
function saveTune() {
  try { localStorage.setItem('xmas-tune', JSON.stringify(TUNE)); } catch (e) {}
}

let rebuildTimer = 0;
function rebuildTree(n) {
  const N = Math.max(3000, Math.round(n));
  if (tree.meta.kind.length === N) return;
  const spreadNow = S.spread;
  const old = tree;
  old.group.remove(photoGroup);
  old.group.remove(INK.points);
  scene.remove(old.group);
  old.geo.dispose();
  old.mat.dispose();
  TREE_N = N;
  tree = buildTree(N);
  tree.group.name = 'treeGroup';
  scene.add(tree.group);
  tree.group.add(photoGroup);
  tree.group.add(INK.points);
  // 笔画与树的粒子共用 spread / scale，换树后要重新绑定 uniform
  INK.points.material.uniforms.uSpread = tree.uni.uSpread;
  INK.points.material.uniforms.uScale = tree.uni.uScale;
  if (spreadNow > 0.2) {
    buildShapeInto(shapeNow, tree.aShapeB);
    tree.aShapeA.set(tree.aShapeB);
    tree.geo.attributes.aShapeA.needsUpdate = true;
    tree.geo.attributes.aShapeB.needsUpdate = true;
    paintShape(shapeNow);
  } else {
    paintTree();
  }
  tree.uni.uSpread.value = spreadNow;
  tree.group.rotation.y = S.rot;

  // 粒子数变了，WebGPU 的缓冲也要重建（count 固定写在 buffer 尺寸里）
  if (GPU.compute && GPU.compute.count !== tree.meta.kind.length) {
    const wasActive = GPU.active;
    GPU.compute.dispose();
    GPU.compute = null;
    GPU.ready = false;
    GPU.active = false;
    if (wasActive) setTimeout(() => initGpuCompute(), 0);
  }
}
function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => rebuildTree(TUNE.count), 260);
}

/* ============================================================
   9. 手势识别（MediaPipe HandLandmarker）
   ============================================================ */
const WASM_BASE = 'https://fastly.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const CONN = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

const HANDS = {
  video: null, canvas: null, ctx: null,
  stream: null, model: null, ready: false, running: false, loading: false,
  last: 0, hands: [], label: 'none', pending: 'none', stable: 0, info: null,
  labelSince: 0, prevLabel: 'none', lastPoint: 0, lastWish: 0, aspect: 1.333
};

function camStat(msg, warn) {
  const el = $('camStat');
  if (!el || el.textContent === msg) return;
  el.textContent = msg;
  el.classList.toggle('warn', !!warn);
}

function camPanel(on) {
  $('camPanel').classList.toggle('show', on);
  if (on) $('camPanel').style.display = 'block';
  else setTimeout(() => { if (!HANDS.running) $('camPanel').style.display = 'none'; }, 520);
}

async function enableHands() {
  if (HANDS.running) return true;
  if (HANDS.loading) return false;
  if (!window.isSecureContext) {
    camStat('file:// 直接打开时浏览器禁止摄像头。请用 http://localhost 打开本页', true);
    toast('手势需要安全上下文：在文件夹里运行 python -m http.server 8765，再访问 http://localhost:8765/圣诞树.html', 6000);
    return false;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('这个浏览器/环境不支持摄像头');
    return false;
  }
  HANDS.loading = true;
  $('btnCam').classList.remove('pulse');
  HANDS.video = $('camVideo');
  HANDS.canvas = $('camCanvas');
  HANDS.ctx = HANDS.canvas.getContext('2d');
  camStat('正在请求摄像头权限…');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      audio: false
    });
    HANDS.stream = stream;
    HANDS.video.srcObject = stream;
    await HANDS.video.play().catch(() => {});
    HANDS.running = true;
    S.handOn = true;
    camPanel(true);
    $('btnCam').classList.add('on');
    camStat('摄像头已开 · 正在加载手势模型（首次约 10–30 秒）');
    toast('摄像头已开 · 正在加载手势模型…');

    if (!HANDS.model) {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
      const fs = await FilesetResolver.forVisionTasks(WASM_BASE);
      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO', numHands: 2,
        minHandDetectionConfidence: 0.4, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.35
      });
      try {
        HANDS.model = await HandLandmarker.createFromOptions(fs, opts('GPU'));
      } catch (e) {
        HANDS.model = await HandLandmarker.createFromOptions(fs, opts('CPU'));
      }
    }
    HANDS.ready = true;
    S.handReady = true;
    camStat('模型就绪 · 正在等待画面…');
    toast('手势模型就绪，把手抬到镜头前');
    setTimeout(() => {
      if (HANDS.running && HANDS.video && HANDS.video.readyState < 2) {
        camStat('模型就绪，但摄像头画面没出数据（可能被别的程序占用）', true);
      }
    }, 2600);
    return true;
  } catch (err) {
    HANDS.loading = false;
    console.warn('[hands]', err);
    camPanel(false);
    $('btnCam').classList.remove('on');
    S.handOn = false;
    const msg = (err && err.name === 'NotAllowedError')
      ? '摄像头权限被拒绝，可以在浏览器地址栏重新允许'
      : (HANDS.stream ? '手势模型没加载出来，检查网络后重试' : '没能打开摄像头，先用鼠标/触摸玩吧');
    toast(msg);
    camStat(msg, true);
    if (HANDS.stream) { HANDS.stream.getTracks().forEach(t => t.stop()); HANDS.stream = null; HANDS.running = false; }
    return false;
  } finally {
    HANDS.loading = false;
  }
}

function disableHands() {
  if (HANDS.stream) HANDS.stream.getTracks().forEach(t => t.stop());
  HANDS.stream = null;
  HANDS.running = false;
  HANDS.ready = false;
  S.handOn = false;
  S.handReady = false;
  if (HANDS.video) HANDS.video.srcObject = null;
  camPanel(false);
  $('btnCam').classList.remove('on');
  HANDS.hands = [];
  HANDS.label = 'none';
  S.label = 'none';
}

function analyze(lm, aspect, world) {
  const P = i => lm[i];
  const aw = aspect || 1.333;
  const d = (a, b) => Math.hypot((a.x - b.x) * aw, a.y - b.y);
  const wrist = P(0);
  const palm = Math.max(0.0001, d(P(5), P(17)));
  const sc = palm;

  // 指节夹角（2D，旋转不变）：伸直 ≈ -1，蜷起 ≈ +0.3
  const cosAt = (a, b, c) => {
    const ax = (a.x - b.x) * aw, ay = a.y - b.y;
    const cx = (c.x - b.x) * aw, cy = c.y - b.y;
    const l = Math.max(1e-6, Math.hypot(ax, ay) * Math.hypot(cx, cy));
    return (ax * cx + ay * cy) / l;
  };
  // 两条向量夹角（度）
  const angAt = (a, b, c, dd) => {
    const ax = (a.x - b.x) * aw, ay = a.y - b.y;
    const cx = (c.x - dd.x) * aw, cy = c.y - dd.y;
    const l = Math.max(1e-6, Math.hypot(ax, ay) * Math.hypot(cx, cy));
    const co = Math.min(1, Math.max(-1, (ax * cx + ay * cy) / l));
    return Math.acos(co) * 180 / Math.PI;
  };

  // 3D 世界坐标（米）：手怎么转都不影响距离与夹角，五个指头最难判的部分靠它
  const Wm = (world && world.length >= 21) ? world : null;
  const d3 = (i, j) => {
    const a = Wm[i], b = Wm[j];
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  };
  const cos3 = (i, j, k) => {
    const ax = Wm[i].x - Wm[j].x, ay = Wm[i].y - Wm[j].y, az = Wm[i].z - Wm[j].z;
    const cx = Wm[k].x - Wm[j].x, cy = Wm[k].y - Wm[j].y, cz = Wm[k].z - Wm[j].z;
    const l = Math.max(1e-6, Math.hypot(ax, ay, az) * Math.hypot(cx, cy, cz));
    return (ax * cx + ay * cy + az * cz) / l;
  };
  const ang3 = (i, j, k, l) => {
    const ax = Wm[i].x - Wm[j].x, ay = Wm[i].y - Wm[j].y, az = Wm[i].z - Wm[j].z;
    const cx = Wm[k].x - Wm[l].x, cy = Wm[k].y - Wm[l].y, cz = Wm[k].z - Wm[l].z;
    const l2 = Math.max(1e-6, Math.hypot(ax, ay, az) * Math.hypot(cx, cy, cz));
    const co = Math.min(1, Math.max(-1, (ax * cx + ay * cy + az * cz) / l2));
    return Math.acos(co) * 180 / Math.PI;
  };

  // 四指伸展：腕距比（主判据）+ 指节夹角（兜底），小指放宽一点
  // 实测握拳 0.6~0.8，张开 1.3+；夹角法能救回「手掌侧对镜头」时塌掉的比值
  const F = [[5, 6, 8, 1.15], [9, 10, 12, 1.15], [13, 14, 16, 1.15], [17, 18, 20, 1.10]];
  const ext = F.map(([m, p, t, thr]) => {
    const r = d(P(t), wrist) / Math.max(0.0001, d(P(p), wrist));
    const straight = cosAt(P(m), P(p), P(t)) < -0.55;
    let ok = r > thr || (straight && r > 1.02);
    if (Wm) {
      const r3 = d3(t, 0) / Math.max(0.0001, d3(p, 0));
      ok = ok || (cos3(m, p, t) < -0.55 && r3 > 1.02);
    }
    return ok;
  });

  const pinchD = d(P(4), P(8)) / sc;
  const thumbAway = d(P(4), P(17)) / sc;
  const thumbStraight = d(P(4), wrist) / Math.max(0.0001, d(P(3), wrist)) > 1.26;

  // —— 拇指「张开」三判据：IP 关节基本伸直 + 与掌轴夹角够大 + 指尖离开掌心 ——
  // 握拳时拇指横压在掌心 → 夹角小、指尖贴掌，两条都不满足
  const thumbIpStraight2 = cosAt(P(2), P(3), P(4)) < -0.30;
  const thumbAng2 = angAt(P(2), P(4), P(0), P(9));               // 拇指走向 vs 腕→中指根
  const thumbFar2 = d(P(4), P(9)) / sc > 0.70 || d(P(4), P(5)) / sc > 0.55;
  let thumbAng = thumbAng2;
  let thumbOpen = thumbIpStraight2 && thumbAng2 > 30 && thumbFar2;
  if (Wm) {
    const a3 = ang3(2, 4, 0, 9);
    const far3 = d3(4, 9) / Math.max(0.0001, d3(9, 0)) > 0.60;
    const straight3 = cos3(2, 3, 4) < -0.25;
    thumbAng = Math.max(a3, thumbAng2);
    thumbOpen = thumbOpen || (a3 > 26 && far3 && straight3);
  }
  // 「五指张开」兜底：四指全开 + 拇指明显远离掌心 + 拇指尖比指根更靠外
  const thumbSpread = thumbOpen || (thumbStraight && thumbAng > 22 && d(P(4), P(9)) / sc > 0.9);

  // 捏合：指尖贴合 + 拇指没有缩进掌心 + 食指指尖离开手腕（排除握拳）
  const pinching = pinchD < 0.68 && d(P(4), wrist) / sc > 0.9 && d(P(8), wrist) / sc > 1.05;
  const thumbUp = thumbSpread && !pinching;
  const cnt = ext.filter(Boolean).length;
  let label = 'none';
  if (pinching && ext[1] && ext[2] && ext[3]) label = 'ok';
  else if (pinching) label = 'pinch';
  // 数字手势：1 食指 / 2 比耶 / 3 三指 / 4 四指 / 5 五指张开 / 6 拇指+小指
  else if (thumbUp && ext[3] && !ext[0] && !ext[1] && !ext[2]) label = 'six';
  else if (cnt === 1 && ext[0]) label = 'point';
  else if (cnt === 2) label = 'two';
  else if (cnt === 3) label = 'three';
  else if (cnt === 4 && thumbUp) label = 'five';
  else if (cnt === 4) label = 'four';
  else if (cnt === 0 && !thumbUp) label = 'fist';
  const center = P(9);
  let conf = 0.62;
  if (label === 'fist') conf = 0.55 + 0.45 * (1 - cnt / 4);
  else if (label === 'none') conf = 0.35;
  else if (label === 'pinch') conf = 0.78;
  else if (label === 'ok') conf = 0.86;
  else if (label !== 'ok' && label !== 'pinch') conf = 0.8;
  return {
    label, cnt, ext, thumbUp, thumbStraight, thumbOpen, thumbSpread, thumbAng,
    pinching, thumbAway, pinchD, palm, cx: center.x, cy: center.y, tip: P(8), conf,
    world: !!Wm
  };
}

function tickHands(now) {
  if (!HANDS.ready || !HANDS.running || !HANDS.model) return;
  const v = HANDS.video;
  if (!v || v.readyState < 2) return;
  if (now - HANDS.last < 55) return;
  HANDS.last = now;
  let res = null;
  try { res = HANDS.model.detectForVideo(v, now); HANDS.err = null; }
  catch (e) { HANDS.err = (e && e.message) || 'detect error'; camStat('识别出错：' + HANDS.err, true); return; }
  HANDS.hands = (res && res.landmarks) ? res.landmarks : [];
  HANDS.aspect = (v.videoWidth && v.videoHeight) ? v.videoWidth / v.videoHeight : 1.333;

  if (!HANDS.hands.length) {
    HANDS.info = null;
    if (HANDS.label !== 'none') { HANDS.pending = 'none'; HANDS.stable = 0; HANDS.labelSince = now; }
    HANDS.label = 'none';
    S.label = 'none';
    S.conf = 0;
    S.rotVel = 0;
    camStat('模型就绪 · 未检测到手（把手抬进画面，离镜头 40–80cm）');
    updateHud();
    drawSkeleton();
    return;
  }

  const info = analyze(HANDS.hands[0], HANDS.aspect, res.worldLandmarks && res.worldLandmarks[0]);
  HANDS.info = info;

  if (info.label !== HANDS.pending) { HANDS.pending = info.label; HANDS.stable = 0; }
  else HANDS.stable++;
  // 手势刚出现要多看几帧（4 帧 ≈ 220ms）才敢定，避免手指过渡帧误判
  const need = info.label === 'none' ? 2 : 4;
  if (HANDS.stable >= need && HANDS.label !== info.label) {
    HANDS.label = info.label;
    HANDS.labelSince = now;
  }
  S.label = HANDS.label;
  S.conf = HANDS.label === 'none' ? 0 : info.conf;
  camStat('检测到 ' + HANDS.hands.length + ' 只手 · 指 ' + info.ext.map(x => x ? '1' : '0').join('') +
    ' · 拇指 ' + Math.round(info.thumbAng) + '°' + (info.thumbUp ? '开' : '收') +
    ' · ' + info.label + (HANDS.hands.length > 1 ? '（双手缩放）' : ''));

  applyHands(info);
  updateHud();
  drawSkeleton();
}

const FINGER_SHAPE = {
  point: 'heart', two: 'star', three: 'flake', four: 'wreath', five: 'galaxy', six: 'text'
};

function handShapeTickCore(label, now, holdMs) {
  const sh = FINGER_SHAPE[label];
  if (!sh) return false;
  // 画笔模式下手指优先落笔，只有五指张开才允许换形态
  if (INK.on && label !== 'five') return false;
  if (shapeNow === sh && S.spreadT > 0.25) return false;
  if (now - (HANDS.labelSince || now) < (holdMs || 750)) return false;
  if (now - (S.lastShapeAt || 0) < 1500) return false;
  S.lastShapeAt = now;
  S.spreadT = 1; S.galleryT = 0;
  setShape(sh);
  return true;
}

/* V2 手势状态机：IDLE → CANDIDATE（保持计时）→ ACTIVE（发命令）→ COOLDOWN（防重复触发）
   优先级仲裁：双手缩放 > 照片抓取 > 3D 绘制 > 场景旋转 > 形态切换
   形态切换是最低优先级，抢不过上面任何一条，避免“想画画结果树开了花”。 */
const FSM = { state: 'IDLE', cmd: '待手势', since: 0, count: 0 };
function fsmSet(state, cmd) {
  if (FSM.state === state && FSM.cmd === cmd) return;
  FSM.state = state; FSM.cmd = cmd; FSM.since = performance.now();
  if (state === 'ACTIVE' && cmd.startsWith('形态')) FSM.count++;
  const st = document.getElementById('fsmState'), cm = document.getElementById('fsmCmd');
  if (st) { st.textContent = state; st.classList.toggle('hot', state === 'ACTIVE'); }
  if (cm) cm.textContent = cmd;
}

function handShapeTick(label, now, holdMs) {
  const sh = FINGER_SHAPE[label];
  if (!sh) { fsmSet('IDLE', '待手势'); return false; }
  if (INK.on && label !== 'five') { fsmSet('ACTIVE', '画笔占用 · 形态锁定'); return false; }
  if (HANDS.hands.length >= 2) { fsmSet('ACTIVE', '双手缩放优先'); return false; }
  if (PHOTOGRAB.sp) { fsmSet('ACTIVE', '照片抓取优先'); return false; }
  if (shapeNow === sh && S.spreadT > 0.25) { fsmSet('ACTIVE', '已是 ' + (SHAPE_LABEL[sh] || sh)); return false; }
  if (now - (S.lastShapeAt || 0) < 1500) { fsmSet('COOLDOWN', '冷却中 ' + (1.5 - (now - S.lastShapeAt) / 1000).toFixed(1) + 's'); return false; }
  const need = holdMs || 750;
  const held = now - (HANDS.labelSince || now);
  if (held < need) { fsmSet('CANDIDATE', label + ' · 保持 ' + ((need - held) / 1000).toFixed(2) + 's'); return false; }
  const ok = handShapeTickCore(label, now, need);
  if (ok) fsmSet('ACTIVE', '形态 → ' + (SHAPE_LABEL[sh] || sh));
  return ok;
}

function applyHands(info) {
  const label = HANDS.label;
  const now = performance.now();
  if (label !== 'pinch') HANDS.pinchS = undefined;

  // 双手：距离决定镜头远近
  if (HANDS.hands.length >= 2) {
    const b = analyze(HANDS.hands[1], HANDS.aspect);
    const dd = Math.hypot((info.cx - b.cx) * HANDS.aspect, info.cy - b.cy);
    S.distT = clamp(27 + (dd - 0.34) * 82, 17, 46);
    S.spreadT = Math.max(S.spreadT, clamp((dd - 0.16) * 3.4, 0, 1));
  }

  switch (label) {
    case 'fist':
      if (!INK.on) { S.spreadT = 0; S.galleryT = 0; }   // 画笔模式下握拳=抬笔，不收回树
      S.rotVel = damp(S.rotVel, 0, 4, 0.016);
      break;
    case 'two':
    case 'three':
    case 'four':
    case 'six':
      handShapeTick(label, now, 750);
      break;
    case 'five':
    case 'open':
      S.spreadT = 1; S.galleryT = 0;
      S.rotVel = Math.abs(info.cx - 0.5) < 0.07 ? 0 : (info.cx - 0.5) * -3.4;
      handShapeTick('five', now, 750);
      break;
    case 'point': {
      if (INK.on) break;              // 画笔模式下由主循环落笔
      if (now - HANDS.lastPoint > 900) {
        HANDS.lastPoint = now;
        const tip = info.tip;
        burstAtHand(tip.x, tip.y, 6);
      }
      handShapeTick('point', now, 1150);   // 食指多举一会儿 → 爱心
      break;
    }
    case 'pinch': {
      if (PHOTOGRAB.sp) break;         // 正在抓照片时不缩放镜头
      // 平滑捏合距离，避免单帧抖动导致画面忽远忽近
      HANDS.pinchS = (HANDS.pinchS === undefined) ? info.pinchD : HANDS.pinchS * 0.78 + info.pinchD * 0.22;
      S.distT = clamp(27 + (HANDS.pinchS - 0.42) * 75, 15, 44);
      break;
    }
    case 'ok': {
      if (INK.on) {                       // 画笔模式：OK = 收工，保留作品
        if (now - HANDS.lastWish > 1200) { HANDS.lastWish = now; setBrush(false); }
        break;
      }
      if (now - HANDS.lastWish > 3200) {
        HANDS.lastWish = now;
        makeWish();
      }
      break;
    }
    default: {
      if (HANDS.hands.length < 2) S.rotVel = damp(S.rotVel, 0, 2.5, 0.016);
    }
  }
}

const gestureName = {
  none: '等待手势',
  fist: '✊ 握拳 · 收成树',
  point: '☝ 1 指 · 烟花 / 爱心',
  two: '✌ 2 指 · 五角星',
  three: '🖖 3 指 · 雪花',
  four: '4 指 · 花环',
  five: '🖐 5 指 · 星云',
  six: '🤘 6 指 · MERRY',
  ok: '👌 OK · 许愿 / 收工',
  pinch: '🤏 捏合 · 缩放 / 抓照片'
};
function updateHud() {
  const g = HANDS.label;
  $('gestName').textContent = HANDS.hands.length > 1 ? '🙌 双手 · 缩放' : (gestureName[g] || '等待手势');
  $('gestConf').textContent = S.conf > 0 ? Math.round(S.conf * 100) + '%' : '—';
  $('gestBar').style.width = (S.conf * 100).toFixed(0) + '%';
  document.querySelectorAll('.gchip').forEach(c => {
    const k = c.dataset.g;
    const on = (k === 'both' && HANDS.hands.length > 1) ||
      (k !== 'both' && k !== 'move' && k === g);
    c.classList.toggle('on', on);
  });
}

function drawSkeleton() {
  const c = HANDS.canvas, ctx = HANDS.ctx;
  if (!c || !ctx) return;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  const dpr = 2;
  if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!HANDS.hands.length) return;
  ctx.save();
  ctx.translate(w, 0); ctx.scale(-1, 1);
  for (const lm of HANDS.hands) {
    ctx.strokeStyle = 'rgba(255,212,138,.5)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const [a, b] of CONN) {
      ctx.moveTo(lm[a].x * w, lm[a].y * h);
      ctx.lineTo(lm[b].x * w, lm[b].y * h);
    }
    ctx.stroke();
    for (let i = 0; i < 21; i++) {
      const tip = (i === 4 || i === 8 || i === 12 || i === 16 || i === 20);
      ctx.fillStyle = tip ? 'rgba(255,238,196,.95)' : 'rgba(159,232,255,.55)';
      ctx.beginPath();
      ctx.arc(lm[i].x * w, lm[i].y * h, tip ? 2.3 : 1.3, 0, 6.2832);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ============================================================
   10. 合成音效（Web Audio，不依赖任何音频文件）
   ============================================================ */
const AUDIO = {
  ctx: null, master: null, on: false, noiseBuf: null,
  nextNote: 0, idx: 0, timer: null
};

const NOTES = { C3: 130.81, E3: 164.81, G3: 196.0, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99 };
// 铃儿响叮当（简化旋律，每 0.34 秒一拍）
const MELODY = [
  ['E4', 1], ['E4', 1], ['E4', 2], ['E4', 1], ['E4', 1], ['E4', 2],
  ['E4', 1], ['G4', 1], ['C4', 1], ['D4', 1], ['E4', 4],
  ['F4', 1], ['F4', 1], ['F4', 2], ['F4', 1], ['E4', 1], ['E4', 2],
  ['E4', 1], ['D4', 1], ['D4', 1], ['E4', 1], ['D4', 2], ['G4', 2],
  ['E4', 1], ['E4', 1], ['E4', 2], ['E4', 1], ['E4', 1], ['E4', 2],
  ['E4', 1], ['G4', 1], ['C4', 1], ['D4', 1], ['E4', 4],
  ['F4', 1], ['F4', 1], ['F4', 2], ['F4', 1], ['E4', 1], ['E4', 2],
  ['G4', 1], ['G4', 1], ['F4', 1], ['D4', 1], ['C4', 4]
];

function audioInit() {
  if (AUDIO.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  AUDIO.ctx = ctx;
  AUDIO.master = master;
  // 噪声源（烟花用）
  const len = Math.floor(ctx.sampleRate * 1.4);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
  AUDIO.noiseBuf = buf;
}

function bell(freq, at, dur, gain, type) {
  const ctx = AUDIO.ctx;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(AUDIO.master);
  const partials = type === 'soft' ? [[1, 1], [2.02, 0.4]] : [[1, 1], [2.01, 0.52], [3.02, 0.26], [4.72, 0.1]];
  partials.forEach(([m, a]) => {
    const o = ctx.createOscillator();
    o.type = m === 1 ? 'sine' : 'triangle';
    o.frequency.value = freq * m * (1 + rand(-0.004, 0.004));
    const og = ctx.createGain();
    og.gain.value = a;
    o.connect(og); og.connect(g);
    o.start(at); o.stop(at + dur + 0.06);
  });
}

function playMelody() {
  if (!AUDIO.ctx || !AUDIO.on) return;
  const ctx = AUDIO.ctx;
  const t = ctx.currentTime;
  if (AUDIO.nextNote < t) AUDIO.nextNote = t + 0.1;
  const beat = 0.36;
  while (AUDIO.nextNote < t + 0.7) {
    const [name, len] = MELODY[AUDIO.idx % MELODY.length];
    bell(NOTES[name], AUDIO.nextNote, Math.max(0.5, len * beat * 1.4), 0.5, 'bell');
    if (AUDIO.idx % 8 === 0) bell(NOTES.C3, AUDIO.nextNote, 1.6, 0.1, 'soft');
    AUDIO.nextNote += len * beat;
    AUDIO.idx++;
  }
}

function musicToggle(on) {
  audioInit();
  if (AUDIO.ctx.state === 'suspended') AUDIO.ctx.resume();
  AUDIO.on = on;
  const t = AUDIO.ctx.currentTime;
  AUDIO.master.gain.cancelScheduledValues(t);
  AUDIO.master.gain.linearRampToValueAtTime(on ? 0.32 : 0, t + 0.6);
  $('btnMusic').classList.toggle('on', on);
  if (on) {
    AUDIO.nextNote = t + 0.12;
    if (!AUDIO.timer) AUDIO.timer = setInterval(playMelody, 120);
    playMelody();
  }
}

function sfxBoom(power = 1) {
  if (!AUDIO.on || !AUDIO.ctx) return;
  const ctx = AUDIO.ctx;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = AUDIO.noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'lowpass';
  bp.frequency.setValueAtTime(900 * power, t);
  bp.frequency.exponentialRampToValueAtTime(120, t + 0.7);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5 * power, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
  src.connect(bp); bp.connect(g); g.connect(AUDIO.master);
  src.start(t);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(34, t + 0.4);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.35, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  o.connect(og); og.connect(AUDIO.master);
  o.start(t); o.stop(t + 0.55);
}

function sfxChime() {
  if (!AUDIO.on || !AUDIO.ctx) return;
  const t = AUDIO.ctx.currentTime;
  bell(NOTES.E5, t, 0.9, 0.16, 'soft');
  bell(NOTES.G5, t + 0.08, 1.1, 0.12, 'soft');
}

/* ============================================================
   11. 便携函数
   ============================================================ */
let toastTimer = 0;
function toast(msg, ms = 2400) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

const raycaster = new THREE.Raycaster();
const _v = new THREE.Vector3();
function screenToWorld(ndcX, ndcY, planeZ = 0) {
  _v.set(ndcX, ndcY, 0.5).unproject(camera);
  const dir = _v.sub(camera.position).normalize();
  const t = (planeZ - camera.position.z) / dir.z;
  return camera.position.clone().add(dir.multiplyScalar(t));
}

function burstAtScreen(cx, cy, power = 4.2, count = 210) {
  const ndcX = (cx / innerWidth) * 2 - 1;
  const ndcY = -(cy / innerHeight) * 2 + 1;
  const p = screenToWorld(ndcX, ndcY);
  fireworks.burst(p.x, clamp(p.y, 1.2, 14), 1.2, theme().fw, count, power, 1);
  sfxBoom(clamp(power / 4.4, 0.5, 1.2));
}
function burstAtHand(nx, ny, power = 4.2) {
  const ndcX = (1 - nx) * 2 - 1;
  const ndcY = 1 - ny * 2;
  const p = screenToWorld(ndcX, ndcY);
  fireworks.burst(clamp(p.x, -14, 14), clamp(p.y, 1.5, 14), 1.2, theme().fw, 200, power, 1);
  sfxBoom(0.9);
}

const WISHES = [
  '愿今年所有的等待，都有着落。',
  '雪落在肩上，光落在心里。圣诞快乐。',
  '愿你被这世界温柔以待，也温柔地待自己。',
  '这一年的辛苦，今晚都交给星光。',
  '想见的人，会在下一场雪里出现。',
  '愿你抬头有光，低头有暖，转身有人在。',
  '把心愿说给这棵树听，它会替你记住。'
];
let toastIdx = -1;
function makeWish() {
  for (let k = 0; k < 3; k++) {
    setTimeout(() => {
      fireworks.burst(rand(-5, 5), rand(9, 14), rand(-2, 3), theme().fw, 180, 4.2, 1);
    }, k * 170);
  }
  sfxChime(); sfxBoom(1);
  let i = Math.floor(Math.random() * WISHES.length);
  if (i === toastIdx) i = (i + 1) % WISHES.length;
  toastIdx = i;
  toast(WISHES[i], 3600);
}

/* ============================================================
   11.5 粒子签名：指尖作笔，笔迹是立体粒子
   ============================================================ */
const INK_MAX = (innerWidth < 900 || navigator.maxTouchPoints > 1) ? 56000 : 92000;
const INK = {
  pts: null, col: null, alp: null, siz: null, sed: null,
  n: 0, geo: null, points: null,
  color: 'rainbow', on: false, mdown: false,
  sm: null, sx: 0, sy: 0,
  depth: 0, depthDir: 1, autoDepth: true, guide: null,
  strokes: [], last: null, lastT: 0, strokeLen: 0,
  dirty0: -1, dirty1: -1
};

function buildInk() {
  const pos = new Float32Array(INK_MAX * 3).fill(9999);
  const col = new Float32Array(INK_MAX * 3);
  const alp = new Float32Array(INK_MAX);
  const siz = new Float32Array(INK_MAX);
  const sed = new Float32Array(INK_MAX);
  INK.pts = pos; INK.col = col; INK.alp = alp; INK.siz = siz; INK.sed = sed;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(siz, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(sed, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);

  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, U, { uSpread: tree.uni.uSpread, uScale: tree.uni.uScale }),
    vertexShader: `
      attribute vec3 aColor; attribute float aAlpha; attribute float aSize; attribute float aSeed;
      uniform float uTime, uPixel, uSpread, uScale;
      varying vec3 vC; varying float vA;
      void main(){
        vec3 p = position;
        // 与树同步：散开时只做整体轻微扩散 + 同频漂移，保住笔迹形状
        p *= 1.0 + uSpread * 0.12;
        float amp = 0.03 + uSpread * 0.18;
        p.x += sin(uTime * 0.9 + aSeed * 31.0) * amp;
        p.y += cos(uTime * 0.75 + aSeed * 23.0) * amp * 1.1;
        p.z += sin(uTime * 0.6 + aSeed * 17.0) * amp * 0.9;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aSize * uScale * uPixel * 165.0 / max(0.8, -mv.z), 1.0, 13.0);
        vC = aColor;
        vA = aAlpha * (0.78 + 0.22 * sin(uTime * 1.1 + aSeed * 47.0));
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main(){
        vec2 q = gl_PointCoord - 0.5;
        float d2 = dot(q, q) * 4.0;
        if (d2 > 1.0) discard;
        float halo = pow(max(0.0, 1.0 - d2), 2.4);   // 柔和外晕
        float core = pow(max(0.0, 1.0 - d2), 10.0);  // 细小硬核
        float a = (halo * 0.62 + core * 0.5) * vA;
        gl_FragColor = vec4(vC * (0.5 + 0.7 * core), a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
  });
  INK.geo = geo;
  INK.points = new THREE.Points(geo, mat);
  INK.points.frustumCulled = false;
  INK.points.renderOrder = 4;
  INK.points.name = 'ink';
  tree.group.add(INK.points);
}
buildInk();

/* 当前落笔层的参考环：告诉你在三维空间的哪一层画（跟画面对齐，不跟树转） */
(function buildInkGuide() {
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const a = i / 96 * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 9.2, Math.sin(a) * 9.2, 0));
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({ color: 0xffe6bf, transparent: true, opacity: 0, depthWrite: false });
  const line = new THREE.Line(g, m);
  line.position.set(0, 4.9, 0);
  line.renderOrder = 3;
  line.name = 'inkguide';
  scene.add(line);
  INK.guide = line;
})();

const _inkCol = new THREE.Color();
function inkColor(hue) {
  if (INK.color === 'rainbow') return _inkCol.setHSL((0.01 + hue * 0.009) % 1, 0.92, 0.6);
  return _inkCol.set(INK.color);
}

function flushRange(attr, start, count) {
  if (!attr || count <= 0) return;
  if (attr.addUpdateRange) attr.addUpdateRange(start, count);
  else { attr.updateRange.offset = start; attr.updateRange.count = count; }
  attr.needsUpdate = true;
}

function inkStamp(x, y, z, hue) {
  if (INK.n >= INK_MAX - 3) return;
  // 一点变一簇：主点 + 随机方向的稀疏伴点，笔迹因此有体积而不是一张纸
  const cluster = Math.random() < 0.5 ? 3 : 2;
  const c0 = inkColor(hue);
  for (let k = 0; k < cluster; k++) {
    if (INK.n >= INK_MAX) return;
    const i = INK.n++;
    const th = Math.random() * Math.PI * 2, ph = Math.acos(rand(-1, 1)), r = rand(0.06, k ? 0.26 : 0.13);
    INK.pts[i * 3] = x + Math.sin(ph) * Math.cos(th) * r;
    INK.pts[i * 3 + 1] = y + Math.cos(ph) * r;
    INK.pts[i * 3 + 2] = z + Math.sin(ph) * Math.sin(th) * r * 1.4;
    const b = rand(0.86, 1.18);
    INK.col[i * 3] = c0.r * b; INK.col[i * 3 + 1] = c0.g * b; INK.col[i * 3 + 2] = c0.b * b;
    INK.alp[i] = (k ? rand(0.14, 0.3) : rand(0.26, 0.62));
    INK.siz[i] = k ? rand(0.05, 0.12)
      : (Math.random() < 0.16 ? rand(0.24, 0.36) : rand(0.085, 0.2));
    INK.sed[i] = Math.random();
    if (INK.dirty0 < 0) INK.dirty0 = i;
    INK.dirty1 = i + 1;
  }
}

function flushInk() {
  INK.geo.setDrawRange(0, INK.n);
  if (INK.dirty0 < 0) return;
  const a = INK.dirty0, len = INK.dirty1 - a;
  flushRange(INK.geo.attributes.position, a * 3, len * 3);
  flushRange(INK.geo.attributes.aColor, a * 3, len * 3);
  flushRange(INK.geo.attributes.aAlpha, a, len);
  flushRange(INK.geo.attributes.aSize, a, len);
  flushRange(INK.geo.attributes.aSeed, a, len);
  INK.dirty0 = -1; INK.dirty1 = -1;
}

const _inkW = new THREE.Vector3();
function inkScreenPoint(nx, ny, palm) {
  // 落笔平面跟"当前视角"对齐（世界 z 分层），所以转了多少度都能在眼前这一层继续画
  const depth = clamp(INK.depth + (palm - 0.3) * 5.0, -7.5, 7.5);
  const world = screenToWorld(nx * 2 - 1, 1 - ny * 2, depth);
  const local = tree.group.worldToLocal(world.clone());
  return { x: local.x, y: local.y, z: local.z };
}

function inkBegin(nx, ny, palm) {
  const p = inkScreenPoint(nx, ny, palm);
  INK.strokes.push(INK.n);
  INK.strokeLen = 0;
  INK.last = { x: p.x, y: p.y, z: p.z };
  inkStamp(p.x, p.y, p.z, 0);
  flushInk();
}

function inkMove(nx, ny, palm) {
  const p = inkScreenPoint(nx, ny, palm);
  if (!INK.last) { inkBegin(nx, ny, palm); return; }
  const dx = p.x - INK.last.x, dy = p.y - INK.last.y, dz = p.z - (INK.last.z ?? p.z);
  const steps = clamp(Math.ceil(Math.hypot(dx, dy) / 0.032), 1, 60);
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    inkStamp(INK.last.x + dx * t, INK.last.y + dy * t, (INK.last.z ?? p.z) + dz * t, INK.strokeLen + k);
  }
  INK.strokeLen += steps;
  INK.last.x = p.x; INK.last.y = p.y; INK.last.z = p.z;
  flushInk();
}

function inkEnd() {
  INK.last = null;
  // 抬笔后自动换一层：继续画就自然叠成多层立体结构
  if (INK.autoDepth) {
    INK.depth += 0.85 * INK.depthDir;
    if (Math.abs(INK.depth) > 4.2) INK.depthDir *= -1;
    syncDepthUI();
  }
}

function setDepth(v, manual) {
  INK.depth = clamp(v, -6.5, 6.5);
  INK.depthDir = INK.depth >= 0 ? 1 : -1;
  if (manual) INK.autoDepth = false;
  syncDepthUI();
}

function syncDepthUI() {
  const el = document.getElementById('depthVal');
  if (el) el.textContent = (INK.depth >= 0 ? '+' : '') + INK.depth.toFixed(1);
  const bar = document.getElementById('brushBar');
  if (bar) bar.classList.toggle('manual', !INK.autoDepth);
}

function inkUndo() {
  if (!INK.strokes.length) { toast('还没有笔画可以撤销', 1400); return; }
  const start = INK.strokes.pop();
  INK.n = start;
  INK.last = null;
  INK.geo.setDrawRange(0, INK.n);
  toast('已撤回一笔', 1300);
}

function inkClear() {
  INK.n = 0; INK.strokes.length = 0; INK.last = null; INK.sm = null;
  INK.geo.setDrawRange(0, 0);
  toast('签名已清空', 1400);
}

function cycleInkColor() {
  const btns = Array.from(document.querySelectorAll('.bcolor'));
  if (!btns.length) return;
  const cur = btns.findIndex(b => b.classList.contains('on'));
  btns[(cur + 1) % btns.length].click();
}

function setBrush(on) {
  INK.on = on;
  $('brushBar').classList.toggle('show', on);
  $('btnBrush').classList.toggle('on', on);
  if (on) {
    setTunePanel(false);                    // 画笔与调节面板互斥，避免右侧挤在一起
    if (demoMode) toggleDemo();
    if (!S.spreadLocked) { S.spreadT = 1; S.spread = 1; }
    S.galleryT = 0; S.rot = 0;
    INK.depth = 0; INK.depthDir = 1; INK.autoDepth = true; syncDepthUI();
    toast('画笔已开 · ☝食指落笔，✊握拳抬笔；每笔自动换一层，滚轮/↑↓ 手动换层', 4400);
  } else {
    inkEnd();
    toast('收工 · 作品留在三维里，转动视角去看它的前后层次', 2600);
  }
}

/* 示例签名（?ink=1 或按 I），两笔不同颜色 + 立体粒子 */
function demoInk() {
  const stroke = (pts, color, depth, rot) => {
    INK.color = color;
    INK.depth = depth;
    if (rot !== undefined) { tree.group.rotation.y = rot; tree.group.updateMatrixWorld(true); }
    pts.forEach(([x, y], i) => { if (i) inkMove(x, y, 0.28); else inkBegin(x, y, 0.28); });
    inkEnd();
    if (rot !== undefined) { tree.group.rotation.y = S.rot; tree.group.updateMatrixWorld(true); }
  };
  const wave = [], heart = [], ring = [];
  for (let i = 0; i <= 80; i++) {
    const u = i / 80;
    wave.push([0.28 + u * 0.44, 0.42 + Math.sin(u * Math.PI * 2.4) * 0.05]);
  }
  for (let i = 0; i <= 100; i++) {
    const th = i / 100 * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(th), 3);
    const hy = 13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th);
    heart.push([0.50 + hx / 16 * 0.095, 0.60 - hy / 17 * 0.085]);
  }
  // 第三笔在另一维度：先让树转 65°，再落笔，于是这圈和前面两笔是交叉的两个平面
  for (let i = 0; i <= 96; i++) {
    const a = i / 96 * Math.PI * 2;
    ring.push([0.50 + Math.cos(a) * 0.16, 0.30 + Math.sin(a) * 0.16]);
  }
  stroke(wave, '#ff5b6e', 1.6);
  stroke(heart, '#6ff5c9', -1.2);
  INK.depth = 0.4; S.rot = 1.15; tree.group.rotation.y = 1.15;
  stroke(ring, '#ffcf7a', 0.4, 1.15);
  S.rot = 0; tree.group.rotation.y = 0;
  INK.depth = 0; INK.autoDepth = true; syncDepthUI();
  INK.color = 'rainbow';
  document.querySelectorAll('.bcolor').forEach(x => x.classList.toggle('on', x.dataset.c === 'rainbow'));
  toast('示例 · 三笔落在三个不同层与角度，转起来看是立体的', 3200);
}

/* ============================================================
   12. 照片
   ============================================================ */
const galleryV = new THREE.Vector3();
const photoTmpV = new THREE.Vector3();
function updatePhotos(t) {
  const gal = softstep(0.16, 0.94, Math.max(S.gallery, S.spread * 0.55));
  const ps = TUNE.photoSize, po = TUNE.photoOpacity;
  for (let i = 0; i < photos.length; i++) {
    const sp = photos[i];
    if (PHOTOGRAB.sp === sp) {
      const sc = sp.userData.size * ps * 1.32;
      sp.scale.set(sc, sc, 1);
      sp.material.opacity = Math.min(1, po + 0.12);
      continue;                              // 被抓着的照片由 tickPhotoGrab 控制位置
    }
    const slot = PHOTO_SLOTS[sp.userData.slot] || PHOTO_SLOTS[0];
    // 球面上的缓慢公转 + 上下呼吸，像一片悬浮的星云
    const spin = t * 0.055 + slot.ph * 0.16;
    const cs = Math.cos(spin), sn = Math.sin(spin);
    const rr = slot.r * (1 + 0.06 * gal) * (1 + Math.sin(t * 0.6 + slot.ph) * 0.03);
    photoTmpV.set(
      (slot.x * cs - slot.z * sn) * rr,
      PHOTO_SPHERE.cy + slot.y * rr * PHOTO_SPHERE.ry + Math.sin(t * 0.85 + slot.ph) * 0.22,
      (slot.x * sn + slot.z * cs) * rr
    );
    sp.position.lerp(photoTmpV, 1 - Math.exp(-2.4 * 0.016));
    const sc = sp.userData.size * ps * (1 + 0.07 * gal);
    sp.scale.set(sc, sc, 1);
    sp.material.opacity = po;
    sp.visible = !sp.userData.hidden;
  }
}

/* 手势抓取照片：捏合靠近任意一张即可抓住拖动，松手飞回原位 */
const PHOTOGRAB = { sp: null, home: new THREE.Vector3(), hitD: 4.2 };
function handTipLocal(info) {
  if (!info || !info.tip) return null;
  const nx = info.tip.x, ny = info.tip.y;
  const w = screenToWorld(nx * 2 - 1, 1 - ny * 2, 0);
  return tree.group.worldToLocal(w.clone());
}
function resetPhotoGrab() {
  if (!PHOTOGRAB.sp) return;
  PHOTOGRAB.sp.position.copy(PHOTOGRAB.home);
  PHOTOGRAB.sp = null;
}
function photoScreenDist(sp, tip) {
  const v = sp.position.clone();
  sp.parent.localToWorld(v);
  v.project(camera);
  const sx = (v.x + 1) * 0.5, sy = 1 - (v.y + 1) * 0.5;
  return Math.hypot(sx - tip.x, sy - tip.y);
}
function tickPhotoGrab(dt) {
  const on = HANDS.running && HANDS.info;
  const pinching = on && (HANDS.label === 'pinch' || HANDS.label === 'ok');
  if (!PHOTOGRAB.sp) {
    if (!pinching) return;
    const tip = HANDS.info.tip;
    let best = null, bestD = 0.13;
    for (const sp of photos) {
      if (sp.userData.hidden) continue;
      const d = photoScreenDist(sp, tip);
      if (d < bestD) { bestD = d; best = sp; }
    }
    if (best) {
      PHOTOGRAB.sp = best;
      PHOTOGRAB.home.copy(best.position);
      toast('抓住一颗照片星球 · 移动手掌带着走，松手归位', 2000);
      sfxChime(0.9);
    }
    return;
  }
  const sp = PHOTOGRAB.sp;
  if (pinching) {
    const p = handTipLocal(HANDS.info);
    if (p) sp.position.lerp(p, 1 - Math.exp(-10 * dt));
  } else {
    sp.position.lerp(PHOTOGRAB.home, 1 - Math.exp(-6.5 * dt));
    if (sp.position.distanceTo(PHOTOGRAB.home) < 0.05) {
      sp.position.copy(PHOTOGRAB.home);
      PHOTOGRAB.sp = null;
    }
  }
}

function handleFiles(files) {
  const room = PHOTO_MAX - photos.length;
  const list = Array.from(files).filter(f => f && f.type && f.type.startsWith('image/')).slice(0, Math.max(0, room));
  if (!list.length) { toast(room <= 0 ? '挂位已满（最多 ' + PHOTO_MAX + ' 张），先在照片面板删掉一张' : '没有读到图片'); return; }
  list.forEach(f => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      if (addPhoto(img, url)) {
        toast('照片已挂上树 🎄 共 ' + photos.length + ' 张');
        S.galleryT = 0;
      } else {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => toast('这张图片读不了');
    img.src = url;
  });
}

function openPhoto(sp) {
  const src = typeof sp === 'string' ? sp : (sp && sp.userData ? sp.userData.src : '');
  if (!src) return;
  $('photoBig').src = src;
  $('photoModal').classList.add('show');
}
$('photoModal').addEventListener('click', () => {
  $('photoModal').classList.remove('show');
});

/* ============================================================
   13. 主题 / 净屏 / 分享
   ============================================================ */
function setTheme(k) {
  themeKey = k;
  document.body.dataset.theme = k;
  paintTree();
  if (S.spread > 0.2) paintShape(shapeNow);
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s.dataset.theme === k));
  document.querySelectorAll('#sThemes .sChip').forEach(x => x.classList.toggle('on', x.dataset.th === k));
  applyThemeMood(k);
  sfxChime();
}
document.querySelectorAll('.swatch').forEach(s => {
  s.addEventListener('click', () => setTheme(s.dataset.theme));
});

function setClean(on) {
  S.clean = on;
  document.body.classList.toggle('clean', on);
  if (on) toast('净屏观赏中 · 右侧可退出', 2000);
}
function resetView() {
  S.rot = 0; S.rotVel = 0; S.spreadT = 0; S.galleryT = 0; S.distT = 27;
}

function shareLink() {
  const name = ($('toName').innerText || '').trim().slice(0, 40);
  const base = location.href.split('#')[0].split('?')[0];
  const url = base + '?to=' + encodeURIComponent(name);
  const done = () => toast('链接已复制，发给那个人吧 🔗');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done).catch(() => toast('复制失败，可手动复制地址栏'));
  } else {
    toast('复制失败，可手动复制地址栏');
  }
}

/* ============================================================
   14. 界面绑定
   ============================================================ */
let introGone = false;
function dismissIntro() {
  if (introGone) return;
  introGone = true;
  $('intro').classList.add('hide');
  setTimeout(() => { $('intro').style.display = 'none'; }, 900);
  $('wishCard').classList.add('show');
  $('gestureBar').classList.add('show');
  $('shapeBar').classList.add('show');
}

$('btnStartCam').addEventListener('click', async () => {
  dismissIntro();
  $('btnStartCam').textContent = '正在唤醒摄像头…';
  const ok = await enableHands();
  $('btnStartCam').textContent = ok ? '手势已开启' : '开启失败 · 可重试';
});
$('btnStartMouse').addEventListener('click', () => {
  dismissIntro();
  toast('拖拽旋转 · 滚轮缩放 · 点击放烟花 · 空格切换聚散', 3600);
});

$('btnCam').addEventListener('click', async () => {
  if (HANDS.running) { disableHands(); toast('手势已关闭'); }
  else {
    const ok = await enableHands();
    if (!ok) toast('摄像头没打开，可以用鼠标交互');
  }
});
$('btnPhoto').addEventListener('click', () => {
  setPhotoPanel(true);
  $('photoInput').click();
});
$('photoInput').addEventListener('change', e => {
  handleFiles(e.target.files);
  e.target.value = '';
});
$('btnMusic').addEventListener('click', () => {
  S.muted = !S.muted;
  musicToggle(!S.muted);
  toast(S.muted ? '音乐已关闭' : '圣诞铃声 · on', 1600);
});
$('btnFull').addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => toast('全屏被浏览器拦下了'));
  else document.exitFullscreen?.();
});
$('btnClean').addEventListener('click', () => setClean(true));
$('exitClean').addEventListener('click', () => setClean(false));
$('btnShare').addEventListener('click', shareLink);

/* 保存当前画面为 PNG */
let snapRequest = 0;
function saveSnapshot() {
  snapRequest = 1;
  toast('正在生成图片…', 1200);
}
$('btnShot').addEventListener('click', saveSnapshot);

/* 演示模式：环绕运镜 + 形态自动轮播 */
let demoMode = false, demoSwitchAt = 0;
function toggleDemo() {
  demoMode = !demoMode;
  $('btnDemo').classList.toggle('on', demoMode);
  if (demoMode) {
    S.spreadT = 1;
    demoSwitchAt = performance.now() + 8000;
    toast('演示模式 · 镜头环绕 · 每 8 秒换一种形态', 3000);
  } else {
    S.spreadT = 0;
    toast('演示模式已关闭', 1600);
  }
}
$('btnDemo').addEventListener('click', toggleDemo);

/* 画笔：色板 / 撤销 / 清空 / 开关 */
$('btnBrush').addEventListener('click', () => setBrush(!INK.on));
document.querySelectorAll('.bcolor').forEach(b => b.addEventListener('click', () => {
  INK.color = b.dataset.c;
  document.querySelectorAll('.bcolor').forEach(x => x.classList.toggle('on', x === b));
  const label = b.dataset.c === 'rainbow' ? '渐变彩笔 · 一笔多色'
    : ('笔色 ' + ({'#ff5b6e':'圣诞红','#ffcf7a':'暖金','#6ff5c9':'薄荷青','#7cc4ff':'极光蓝','#bda1ff':'梦紫','#ffffff':'雪白'}[b.dataset.c] || ''));
  toast(label + ' · 下一笔生效', 1800);
}));
$('btnUndo').addEventListener('click', inkUndo);
$('btnClear').addEventListener('click', inkClear);
$('btnShallow').addEventListener('click', () => setDepth(INK.depth - 0.8, true));
$('btnDeep').addEventListener('click', () => setDepth(INK.depth + 0.8, true));

/* ---------- 面板：粒子调节 / 照片管理 ---------- */
function setTunePanel(on) {
  const p = $('tunePanel');
  if (!p) return;
  p.classList.toggle('show', on);
  const b = $('btnTune');
  if (b) b.classList.toggle('on', on);
  if (on) {
    if (INK.on) setBrush(false);
    syncTuneUI();
  }
}
function setPhotoPanel(on) {
  const p = $('photoPanel');
  if (!p) return;
  p.classList.toggle('show', on);
  if (on) renderPhotoPanel();
}

const TUNE_UI = [
  { id: 'rngCount', out: 'vCount', key: 'count', fmt: v => String(Math.round(v)) },
  { id: 'rngSpeed', out: 'vSpeed', key: 'speed', fmt: v => v.toFixed(2) + '×' },
  { id: 'rngBright', out: 'vBright', key: 'bright', fmt: v => v.toFixed(2) },
  { id: 'rngContrast', out: 'vContrast', key: 'contrast', fmt: v => v.toFixed(2) },
  { id: 'rngSize', out: 'vSize', key: 'size', fmt: v => v.toFixed(2) },
  { id: 'rngGlow', out: 'vGlow', key: 'glow', fmt: v => v.toFixed(2) },
  { id: 'rngPhotoSize', out: 'vPhotoSize', key: 'photoSize', fmt: v => v.toFixed(2) },
  { id: 'rngPhotoOpacity', out: 'vPhotoOpacity', key: 'photoOpacity', fmt: v => v.toFixed(2) }
];
function syncTuneUI() {
  TUNE_UI.forEach(it => {
    const el = $(it.id);
    if (!el) return;
    const mn = parseFloat(el.min), mx = parseFloat(el.max);
    TUNE[it.key] = clamp(TUNE[it.key], mn, mx);
    el.value = String(TUNE[it.key]);
    const o = $(it.out);
    if (o) o.textContent = it.fmt(TUNE[it.key]);
  });
  if (bloomPass) bloomPass.strength = glowNow();
}
TUNE_UI.forEach(it => {
  const el = $(it.id);
  if (!el) return;
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    TUNE[it.key] = v;
    const o = $(it.out);
    if (o) o.textContent = it.fmt(v);
    if (it.key === 'count') scheduleRebuild();
    else if (it.key === 'glow' && bloomPass) bloomPass.strength = v;
    saveTune();
  });
});

$('btnTune').addEventListener('click', () => setTunePanel(!$('tunePanel').classList.contains('show')));
$('tpClose').addEventListener('click', () => setTunePanel(false));
$('tpReset').addEventListener('click', () => {
  Object.assign(TUNE, TUNE_DEFAULT);
  syncTuneUI();
  rebuildTree(TUNE_DEFAULT.count);
  saveTune();
  toast('粒子参数已恢复默认', 1800);
});
$('ppAdd').addEventListener('click', () => $('photoInput').click());

// 文字编辑
const nameEl = $('toName'), msgEl = $('toMsg');
function saveWords() {
  try {
    localStorage.setItem('xmas-name', nameEl.innerText.trim());
    localStorage.setItem('xmas-msg', msgEl.innerText.trim());
  } catch (e) {}
}
nameEl.addEventListener('input', saveWords);
msgEl.addEventListener('input', saveWords);
nameEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); msgEl.focus(); } });
msgEl.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); msgEl.blur(); } });

/* ============================================================
   15. 指针 / 触摸
   ============================================================ */
const pointers = new Map();
let dragging = false, dragMoved = 0, lastX = 0, lastY = 0, pinchPrev = 0;
const mouse = { x: 0, y: 0 };

canvas.addEventListener('pointerdown', e => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  if (INK.on && pointers.size === 1) {
    INK.mdown = true; dragging = false;
    inkBegin(e.clientX / innerWidth, e.clientY / innerHeight, 0.28);
    return;
  }
  if (pointers.size === 1) { dragging = true; dragMoved = 0; lastX = e.clientX; lastY = e.clientY; }
  if (pointers.size === 2) {
    const p = [...pointers.values()];
    pinchPrev = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }
}, { passive: true });

canvas.addEventListener('pointermove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = (e.clientY / innerHeight) * 2 - 1;
  const prev = pointers.get(e.pointerId);
  if (INK.mdown) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    inkMove(e.clientX / innerWidth, e.clientY / innerHeight, 0.28);
    return;
  }
  if (!prev) return;
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 1 && dragging) {
    dragMoved += Math.abs(dx) + Math.abs(dy);
    S.rot += dx * 0.0072;
    S.rotVel = 0;
    lastX = e.clientX; lastY = e.clientY;
  } else if (pointers.size === 2) {
    const p = [...pointers.values()];
    const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    if (pinchPrev > 0) S.distT = clamp(S.distT + (pinchPrev - d) * 0.055, 17, 46);
    pinchPrev = d;
    dragMoved += Math.abs(dx) + Math.abs(dy);
  }
}, { passive: true });

canvas.addEventListener('pointerup', e => {
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchPrev = 0;
  if (INK.mdown) {
    INK.mdown = false;
    inkEnd();
    if (pointers.size === 0) dragging = false;
    return;
  }
  if (wasSingle && dragMoved < 14) {
    const spot = hitPhoto(e.clientX, e.clientY);
    if (spot) openPhoto(spot);
    else burstAtScreen(e.clientX, e.clientY);
  }
  if (pointers.size === 0) dragging = false;
}, { passive: true });
canvas.addEventListener('pointercancel', e => {
  pointers.delete(e.pointerId);
  if (INK.mdown) { INK.mdown = false; inkEnd(); }
  if (pointers.size === 0) dragging = false;
  pinchPrev = 0;
}, { passive: true });

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (INK.on) {                       // 画笔模式：滚轮换一层，走到不同维度画
    setDepth(INK.depth - e.deltaY * 0.0035, true);
    return;
  }
  S.distT = clamp(S.distT + e.deltaY * 0.02, 17, 46);
}, { passive: false });

function hitPhoto(cx, cy) {
  const nx = (cx / innerWidth) * 2 - 1;
  const ny = -(cy / innerHeight) * 2 + 1;
  raycaster.setFromCamera({ x: nx, y: ny }, camera);
  const hits = raycaster.intersectObjects(photos, false);
  return hits.length ? hits[0].object : null;
}

// 拖拽 / 粘贴照片
['dragover', 'drop'].forEach(ev => window.addEventListener(ev, e => {
  e.preventDefault();
  if (ev === 'drop' && e.dataTransfer) handleFiles(e.dataTransfer.files);
}));
document.addEventListener('paste', e => {
  const items = e.clipboardData && e.clipboardData.files;
  if (items && items.length) handleFiles(items);
});

// 键盘
addEventListener('keydown', e => {
  if (e.target && e.target.isContentEditable) return;
  const k = e.key.toLowerCase();
  if (k === ' ') { e.preventDefault(); S.spreadT = S.spreadT > 0.5 ? 0 : 1; S.galleryT = 0; sfxChime(); }
  else if (k === 'f') burstAtScreen(innerWidth * rand(0.3, 0.7), innerHeight * rand(0.15, 0.45), 4.6, 240);
  else if (k === 'c') { if (HANDS.running) disableHands(); else enableHands(); }
  else if (k === 'm') { S.muted = !S.muted; musicToggle(!S.muted); $('btnMusic').classList.toggle('on', !S.muted); }
  else if (k === 'h') setClean(!S.clean);
  else if (k === 'g') { S.galleryT = S.galleryT > 0.5 ? 0 : 1; S.spreadT = S.galleryT ? 0.78 : 0; }
  else if (k === 'r') resetView();
  else if (k >= '1' && k <= '5') { setShape(SHAPE_ORDER[Number(k) - 1]); }
  else if (k === 'd') toggleDemo();
  else if (k === 'e') saveSnapshot();
  else if (k === 'p') setBrush(!INK.on);
  else if (k === 'z') inkUndo();
  else if (k === 'i') demoInk();
  else if (k === 'arrowup') { e.preventDefault(); setDepth(INK.depth - 0.8, true); }
  else if (k === 'arrowdown') { e.preventDefault(); setDepth(INK.depth + 0.8, true); }
  else if (k === 'l') { INK.autoDepth = !INK.autoDepth; syncDepthUI(); toast(INK.autoDepth ? '自动换层：已开' : '自动换层：已锁', 1600); }
});

/* ============================================================
   16. 主循环
   ============================================================ */
const clock = new THREE.Clock();
let frames = 0;

/* 帧率自适应：卡顿时自动降采样 / 关泛光，优先保住流畅 */
let perfAcc = 0, perfN = 0, perfTier = LOW ? 1 : 2, perfCheckAt = 7, perfLowN = 0, perfLastMs = performance.now();
function applyPerfTier(tier) {
  const dpr = Math.min(devicePixelRatio || 1, tier >= 2 ? 1.5 : tier === 1 ? 1.15 : 1);
  renderer.setPixelRatio(dpr);
  composer.setPixelRatio(dpr);
  composer.setSize(innerWidth, innerHeight);
  bloomPass.setSize(innerWidth * 0.62, innerHeight * 0.62);
  bloomPass.enabled = tier > 0;
  bloomPass.strength = tier >= 2 ? TUNE.glow : TUNE.glow * 0.72;
  syncPixel();
  if (tier === 0) toast('已关闭泛光以保证流畅', 2200);
  else if (tier === 1) toast('已降低渲染精度以保证流畅', 2200);
}

function frame() {
  requestAnimationFrame(frame);
  try {
  const nowMs = performance.now();
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  // 粒子飘动速度独立于真实时间，供滑杆调节
  U.uTime.value += dt * TUNE.speed;
  U.uBright.value = TUNE.bright;
  U.uContrast.value = TUNE.contrast;
  U.uSizeK.value = TUNE.size;

  if (HANDS.running) tickHands(performance.now());

  // 状态阻尼
  S.spread = damp(S.spread, S.spreadT, 3.8, dt);
  S.gallery = damp(S.gallery, S.galleryT, 3.2, dt);
  S.dist = damp(S.dist, S.distT, 3.4, dt);
  S.dawn = damp(S.dawn, INK.on ? 0.4 : 1, 1.5, dt);

  // 旋转（限制在正面视野，松手回中）
  // 旋转（演示模式自动环绕；否则限制在正面视野，松手回中）
  if (demoMode) {
    S.rot = Math.sin(t * 0.32) * 0.95;
  } else {
    S.rot += S.rotVel * dt;                  // 角度持续累积，可转整圈
    if (!HANDS.hands.length || S.label === 'none') S.rotVel = damp(S.rotVel, 0, 3.0, dt);
  }

  tree.group.rotation.y = S.rot;
  tree.uni.uSpread.value = S.spread;
  tree.uni.uDawn.value = S.dawn;
  tree.uni.uScale.value = 1 + S.spread * 0.06;

  const pulse = 1 + Math.sin(t * 2.1) * 0.06;
  const starFade = Math.max(0, 1 - S.spread * 1.06);
  tree.halo.scale.set(3.0 * pulse, 3.0 * pulse, 1);
  tree.halo.material.opacity = (0.11 + 0.05 * Math.sin(t * 1.6)) * S.dawn * starFade;
  tree.starSprite.scale.set(2.9 * pulse, 2.9 * pulse, 1);
  tree.starSprite.material.opacity = (0.32 + 0.08 * Math.sin(t * 1.4)) * S.dawn * starFade;
  tree.core.material.opacity = 0.14 * (1 - S.spread * 0.7) * S.dawn;

  // 相机
  camera.position.z = S.dist;
  camera.position.x = damp(camera.position.x, mouse.x * 1.3, 2.2, dt);
  camera.position.y = damp(camera.position.y, 5.2 + S.spread * 1.2 - mouse.y * 0.8, 2.4, dt);
  camera.lookAt(0, 4.7 + S.spread * 0.8, 0);

  tickMorph(dt);

  // 落笔层参考环：跟着当前深度走，画笔关闭后淡出
  if (INK.guide) {
    INK.guide.position.z = INK.depth;
    const target = INK.on ? 0.14 : 0;
    INK.guide.material.opacity += (target - INK.guide.material.opacity) * Math.min(1, dt * 2.2);
    if (INK.on) INK.guide.material.color.copy(inkColor(INK.color === 'rainbow' ? 0 : 1));
  }

  // 指尖作笔：食指移动即落笔，离开手势 0.2s 后自动抬笔
  if (INK.on) {
    const nt = performance.now();
    if (HANDS.running && HANDS.info && HANDS.label === 'point') {
      const tip = HANDS.info.tip;
      const palm = clamp(HANDS.info.palm, 0.06, 0.62);
      const fx = 1 - tip.x;                 // 摄像头是镜像的
      // 指尖低通滤波：压掉关键点抖动，笔迹才顺
      if (!INK.sm) INK.sm = { x: fx, y: tip.y };
      const k = nt - INK.lastT > 90 ? 1 : 0.38;   // 断笔后重新落笔时直接贴合
      INK.sm.x += (fx - INK.sm.x) * k;
      INK.sm.y += (tip.y - INK.sm.y) * k;
      const sx = INK.sm.x, sy = INK.sm.y;
      if (!INK.last) {
        inkBegin(sx, sy, palm); INK.sx = sx; INK.sy = sy; INK.lastT = nt;
      } else if (nt - INK.lastT >= 16) {
        const moved = Math.hypot(sx - INK.sx, sy - INK.sy);
        if (moved > 0.0016) {
          inkMove(sx, sy, palm); INK.lastT = nt;
          INK.sx = sx; INK.sy = sy;
        }
      }
    } else if (INK.last && nt - INK.lastT > 200) {
      inkEnd();
    }
  }

  // 演示模式：每 8 秒轮换形态
  if (demoMode && performance.now() > demoSwitchAt) {
    demoSwitchAt = performance.now() + 8000;
    const idx = (SHAPE_ORDER.indexOf(shapeNow) + 1) % SHAPE_ORDER.length;
    setShape(SHAPE_ORDER[idx], true);
  }

  // 指尖 / 鼠标牵引：靠近指端的粒子被推开
  const tipActive = HANDS.running && HANDS.info &&
    (HANDS.label === 'point' || HANDS.label === 'open' || HANDS.label === 'five' || HANDS.label === 'pinch');
  if (tipActive) {
    const tip = HANDS.info.tip;
    tree.uni.uPointer.value.copy(screenToWorld(tip.x * 2 - 1, (1 - tip.y) * 2 - 1));
    tree.uni.uPointerOn.value = damp(tree.uni.uPointerOn.value, 1, 5, dt);
  } else {
    tree.uni.uPointer.value.copy(screenToWorld(mouse.x, mouse.y));
    tree.uni.uPointerOn.value = damp(tree.uni.uPointerOn.value, 0.6, 4, dt);
  }

  // V2：手掌力场（排斥 / 吸引 / 涡旋 / 脉冲）+ 性能 HUD
  updateField(dt);

  updatePhotos(t);
  tickPhotoGrab(dt);
  fireworks.update(dt);

  // 自动氛围烟花（不发声）
  if (t > S.autoBurstAt && !S.clean) {
    S.autoBurstAt = t + rand(9, 18);
    fireworks.burst(rand(-9, 9), rand(4, 12), rand(-4, 4), theme().fw, 150, 4.2, 1);
  }

  composer.render();

  if (snapRequest) {
    snapRequest = 0;
    try {
      const url = renderer.domElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url; a.download = 'xmas-' + Date.now() + '.png';
      a.click();
      toast('已保存到下载文件夹', 2000);
    } catch (e) {
      toast('浏览器不允许导出，可以用系统截图', 2400);
    }
  }

  // 帧率采样 → 自动降级
  perfAcc += Math.min(0.5, Math.max(0, (nowMs - perfLastMs) / 1000));
  perfLastMs = nowMs;
  perfN++;
  if (clock.elapsedTime > perfCheckAt) {
    const fps = perfN / Math.max(0.001, perfAcc);
    if (fps < 42 && perfTier > 0) {
      perfLowN++;
      if (perfLowN >= 2) { perfTier -= 1; applyPerfTier(perfTier); perfLowN = 0; }
    } else perfLowN = 0;
    perfAcc = 0; perfN = 0; perfCheckAt = clock.elapsedTime + 3.5;
  }

  frames++;
  if (frames === 3) {
    $('loadBar').style.width = '100%';
    setTimeout(() => {
      const l = $('loader');
      if (!l) return;
      l.classList.add('hide');
      setTimeout(() => { l.style.display = 'none'; }, 900);
    }, 350);
  }
  } catch (err) {
    if (!document.getElementById('__frameErr')) {
      const box = document.createElement('div');
      box.id = '__frameErr';
      box.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99;max-width:70vw;padding:10px 12px;background:rgba(20,40,90,.95);color:#ffd;font:12px/1.5 ui-monospace,monospace;border-radius:8px;white-space:pre-wrap';
      box.textContent = 'frame#' + frames + ' ' + (err && err.stack || err);
      document.body.appendChild(box);
    }
  }
}

/* ============================================================
   17. 启动
   ============================================================ */
function demoPhotos() {
  const sets = [
    ['初雪', ['#0a2450', '#3d7bd8', '#bfe9ff']],
    ['烛光', ['#37101c', '#c2554a', '#ffd9a0']],
    ['圣诞夜', ['#08281f', '#2f9c74', '#ffe7b0']]
  ];
  sets.forEach(([label, cs]) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const g = cv.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 512, 512);
    lg.addColorStop(0, cs[0]); lg.addColorStop(0.58, cs[1]); lg.addColorStop(1, cs[2]);
    g.fillStyle = lg; g.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 140; k++) {
      g.fillStyle = 'rgba(255,255,255,' + rand(0.15, 0.8) + ')';
      g.beginPath();
      g.arc(Math.random() * 512, Math.random() * 400, rand(0.6, 2.2), 0, 6.283);
      g.fill();
    }
    g.beginPath();
    g.moveTo(0, 430);
    g.quadraticCurveTo(150, 320, 280, 400);
    g.quadraticCurveTo(400, 470, 512, 350);
    g.lineTo(512, 512); g.lineTo(0, 512); g.closePath();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.fill();
    g.fillStyle = 'rgba(255,255,255,.88)';
    g.font = '600 34px "Noto Serif SC", serif';
    g.fillText(label, 42, 468);
    const img = new Image();
    img.onload = () => addPhoto(img, cv.toDataURL());
    img.src = cv.toDataURL();
  });
}

/* ============================================================
   18. V2 STUDIO · 力场 / 主题氛围 / 预设 / 录制 / HUD
   ============================================================ */
const FIELD = { mode: 0, power: 1, pulse: false, pulseT: -999 };
const FIELD_NAME = ['关', '排斥', '吸引', '涡旋'];
// 演示/截图用：?field=1|2|3&fieldSim=1 时，用一条虚拟手掌轨迹驱动力场（无摄像头也能看效果）
const V2_PARAMS = new URLSearchParams(location.search);
let FIELD_SIM = parseFloat(V2_PARAMS.get('fieldSim') || '0') || 0;
if (V2_PARAMS.get('field')) FIELD.mode = Math.max(0, Math.min(3, parseInt(V2_PARAMS.get('field'), 10) || 0));
const THEME_GAIN = { classic: 1, ice: 1.02, rose: 1, aurora: 1.12, cyber: 1.2 };
function glowNow() { return TUNE.glow * (THEME_GAIN[themeKey] || 1); }
function applyThemeMood(k) { if (bloomPass) bloomPass.strength = TUNE.glow * (THEME_GAIN[k] || 1); }

const V2HUD = { frames: 0, last: performance.now(), fps: 0, gpu: '' };

/* ---- WebGPU ping-pong compute：可选后端，物理积分在 GPU 上跑 ---- */
const GPU = {
  mode: 'auto' as 'auto' | 'webgl' | 'webgpu',
  compute: null as PingPongParticles | null,
  active: false,
  ready: false,
  error: '',
  base: null as Float32Array | null
};

function buildGpuBase(): Float32Array {
  const n = tree.meta.kind.length;
  if (!GPU.base || GPU.base.length !== n * 4) GPU.base = new Float32Array(n * 4);
  const b = GPU.base;
  const T = tree.aTree, A = tree.aShapeA, B = tree.aShapeB, SE = tree.geo.attributes.aSeed.array as Float32Array;
  const m = tree.uni.uMorph.value, sp = tree.uni.uSpread.value;
  for (let i = 0, k = 0, j = 0; i < n; i++, k += 4, j += 3) {
    const ax = A[j] + (B[j] - A[j]) * m;
    const ay = A[j + 1] + (B[j + 1] - A[j + 1]) * m;
    const az = A[j + 2] + (B[j + 2] - A[j + 2]) * m;
    b[k] = T[j] + (ax - T[j]) * sp;
    b[k + 1] = T[j + 1] + (ay - T[j + 1]) * sp;
    b[k + 2] = T[j + 2] + (az - T[j + 2]) * sp;
    b[k + 3] = SE[i];
  }
  return b;
}

function syncGpuHud() {
  const g = $('hudGpu');
  if (!g) return;
  if (GPU.active) g.textContent = 'WebGPU · ping-pong';
  else if (GPU.error) g.textContent = 'WebGL2 · ' + GPU.error;
  else g.textContent = renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1';
}

async function initGpuCompute() {
  if (GPU.compute) return;
  if (!('gpu' in navigator) || !navigator.gpu) { GPU.error = '浏览器无 WebGPU'; syncGpuHud(); return; }

  let stage = 'create';
  try {
    const g = await PingPongParticles.create(tree.meta.kind.length);
    if (!g) { GPU.error = 'WebGPU 设备不可用'; syncGpuHud(); return; }
    stage = 'base';
    const base = buildGpuBase();
    stage = 'setBase';
    g.setBase(base as Float32Array<ArrayBuffer>);
    stage = 'reset';
    g.reset(base as Float32Array<ArrayBuffer>);
    stage = 'bind';
    GPU.compute = g;
    GPU.ready = true;
    GPU.error = '';
    const decision = resolveBackend(GPU.mode, {
      hasWebGPU: true,
      isMobile: LOW,
      webgl2: renderer.capabilities.isWebGL2
    });
    GPU.active = decision.active;
    syncGpuHud();
    toast('WebGPU 已启用 · 粒子物理走 ping-pong compute', 2600);
  } catch (e: any) {
    GPU.error = 'WebGPU 初始化失败';
    console.warn('[webgpu] init failed at', stage, e);
    syncGpuHud();
  }
}

function setGpuBackend(kind: string) {
  GPU.mode = (kind === 'webgl' || kind === 'webgpu') ? kind : 'auto';
  if (GPU.mode === 'webgl') {
    GPU.active = false;
    syncGpuHud();
    return;
  }
  if (GPU.compute) { GPU.active = true; syncGpuHud(); return; }
  initGpuCompute();
}

function tickHud() {
  V2HUD.frames++;
  const now = performance.now();
  if (now - V2HUD.last > 600) {
    V2HUD.fps = Math.round(V2HUD.frames * 1000 / (now - V2HUD.last));
    V2HUD.frames = 0; V2HUD.last = now;
    const f = hudFps, pc = hudPart, ff = fsmField;
    if (f) f.textContent = V2HUD.fps + ' fps';
    if (pc) pc.textContent = (tree.meta.kind.length / 1000).toFixed(1) + 'k 粒子';
    if (ff) ff.textContent = '力场 ' + FIELD_NAME[FIELD.mode] + ' · 强度 ' + FIELD.power.toFixed(2);
    syncGpuHud();
  }
  V2HUD.gpu = GPU.active ? 'WebGPU · ping-pong' : (renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1');
}

/* 每帧更新力场：手掌位置 → uniform，力场开关做阻尼淡入淡出，CPU 只写 uniform 不回读粒子 */
// 无摄像头时的「鼠标当手」：nx/ny 是归一化视口坐标，grabbing = 按住左键捏合
const POINTER = { on: false, nx: 0, ny: 0, grabbing: false };
function updateField(dt) {
  const u = tree && tree.uni;
  if (!u) return;
  let handOn = (HANDS.running && HANDS.info && HANDS.label && HANDS.label !== 'none') ? 1 : 0;
  if (handOn) {
    const tip = HANDS.info.tip;
    const p = screenToWorld((1 - tip.x) * 2 - 1, (1 - tip.y) * 2 - 1);
    u.uHandPos.value.lerp(p, 0.22);
  }
  if (POINTER.on && !handOn) {
    const p = screenToWorld(POINTER.nx, POINTER.ny);
    u.uHandPos.value.lerp(p, 0.24);
    handOn = 1;
  }
  let effOn = handOn;
  if (FIELD_SIM && FIELD.mode) {
    const t = performance.now() / 1000;
    const p = screenToWorld(Math.sin(t * 0.7) * 0.5, Math.sin(t * 1.05 + 1) * 0.28 + 0.06);
    u.uHandPos.value.lerp(p, 0.3);
    effOn = 1;
  }

  /* WebGPU 路径：位置积分交给 compute，shader 里的力场块全部失效 */
  const gpu = GPU.compute;
  if (gpu && GPU.active) {
    if (FIELD.pulse) { FIELD.pulse = false; u.uPulseOrg.value.copy(u.uHandPos.value); FIELD.pulseT = U.uTime.value; }
    const powered = FIELD.power * (FIELD.mode === 3 ? 1.3 : 1) * (POINTER.on && POINTER.grabbing && !HANDS.running ? 1.45 : 1);
    gpu.setBase(buildGpuBase());
    gpu.step({
      dt,
      time: U.uTime.value,
      hand: [u.uHandPos.value.x, u.uHandPos.value.y, u.uHandPos.value.z],
      handOn: FIELD.mode === 0 ? 0 : effOn,
      mode: FIELD.mode,
      power: powered,
      curl: FIELD.mode === 3 ? 1 : 0.22,
      pulseT: FIELD.pulseT,
      pulseOrg: [u.uPulseOrg.value.x, u.uPulseOrg.value.y, u.uPulseOrg.value.z]
    });
    const attr = tree.geo.attributes.aPhys;
    if (gpu.readInto(attr.array as Float32Array)) attr.needsUpdate = true;
    u.uGpu.value = 1;
    u.uHandOn.value = 0;
    u.uPulseT.value = -999;
    tickHud();
    return;
  }
  u.uGpu.value = 0;
  u.uHandOn.value = damp(u.uHandOn.value, FIELD.mode === 0 ? 0 : effOn, 4.5, dt);
  u.uHandMode.value = FIELD.mode === 2 ? 2 : 1;
  u.uHandPow.value = FIELD.power * (FIELD.mode === 3 ? 1.3 : 1) * (POINTER.on && POINTER.grabbing && !HANDS.running ? 1.45 : 1);
  u.uCurl.value = damp(u.uCurl.value, FIELD.mode === 3 ? 1 : (FIELD.mode ? 0.22 : 0), 3, dt);
  if (FIELD.pulse) { FIELD.pulse = false; u.uPulseOrg.value.copy(u.uHandPos.value); FIELD.pulseT = U.uTime.value; }
  u.uPulseT.value = FIELD.pulseT;

  tickHud();
}

/* 工作室面板 */
const studioEl = $('studioPanel');
function setStudio(on) {
  if (!studioEl) return;
  studioEl.classList.toggle('show', on);
  const b = $('btnStudio');
  if (b) b.classList.toggle('on', on);
  if (on) {
    setTunePanel(false); if (INK.on) setBrush(false);
    document.querySelectorAll('#sField .sChip').forEach(x => x.classList.toggle('on', Number(x.dataset.f) === FIELD.mode));
    rngField.value = String(FIELD.power); vField.textContent = FIELD.power.toFixed(2);
  }
}
$('btnStudio').addEventListener('click', () => setStudio(!studioEl.classList.contains('show')));
$('studioClose').addEventListener('click', () => setStudio(false));

document.querySelectorAll('#sThemes .sChip').forEach(b => {
  b.dataset.th = b.dataset.th || '';
  b.addEventListener('click', () => setTheme(b.dataset.th));
});

document.querySelectorAll('#sField .sChip').forEach(b => {
  b.addEventListener('click', () => {
    FIELD.mode = Number(b.dataset.f) || 0;
    document.querySelectorAll('#sField .sChip').forEach(x => x.classList.toggle('on', x === b));
    if (FIELD.mode) toast('力场：' + FIELD_NAME[FIELD.mode] + ' · 手掌靠近树，粒子会跟着你动', 2200);
  });
});
$('rngField').addEventListener('input', e => {
  FIELD.power = Number(e.target.value);
  $('vField').textContent = FIELD.power.toFixed(2);
});
$('btnPulse').addEventListener('click', () => {
  FIELD.pulse = true;
  toast('脉冲冲击波 · 从掌心向外扩散', 1600);
});
$('btnFieldHelp').addEventListener('click', () => {
  toast('力场：排斥=粒子逃离手掌，吸引=涌向掌心，涡旋=绕手掌旋转；脉冲=一圈向外扩散的冲击波', 4200);
});

/* 场景预设：主题 / 形态 / 调参 / 力场 打包成一份 JSON */
function gatherPreset() {
  const p = { v: 2, theme: themeKey, shape: shapeNow, field: { mode: FIELD.mode, power: FIELD.power }, tune: {} };
  for (const k in TUNE_DEFAULT) p.tune[k] = TUNE[k];
  return p;
}
function savePreset() {
  try {
    localStorage.setItem('aurora-v2-preset', JSON.stringify(gatherPreset()));
    toast('预设已保存到本机（下次打开可载入）', 2200);
  } catch (e) { toast('保存失败：' + e.message, 2400); }
}
function loadPreset() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem('aurora-v2-preset') || 'null'); } catch (e) {}
  if (!p) return toast('还没有保存过预设，先点「保存当前」', 2400);
  if (p.theme) setTheme(p.theme);
  if (p.field) {
    FIELD.mode = Number(p.field.mode) || 0;
    FIELD.power = Number(p.field.power) || 1;
    document.querySelectorAll('#sField .sChip').forEach(x => x.classList.toggle('on', Number(x.dataset.f) === FIELD.mode));
    $('rngField').value = String(FIELD.power);
    $('vField').textContent = FIELD.power.toFixed(2);
  }
  if (p.tune) {
    for (const k in TUNE_DEFAULT) if (typeof p.tune[k] === 'number') TUNE[k] = p.tune[k];
    syncTuneUI();
    if (Math.abs(TUNE.count - tree.meta.kind.length) > 400) rebuildTree(Math.round(TUNE.count));
  }
  if (p.shape && SHAPE_LABEL[p.shape]) { setShape(p.shape); }
  toast('预设已载入', 2000);
}
function downloadBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
$('btnSavePreset').addEventListener('click', savePreset);
$('btnLoadPreset').addEventListener('click', loadPreset);
$('btnExportCfg').addEventListener('click', () => {
  downloadBlob('aurora-v2-scene.json', new Blob([JSON.stringify(gatherPreset(), null, 2)], { type: 'application/json' }));
  toast('配置已导出 JSON', 2000);
});

/* 作品导出：录 8 秒 WebM（canvas.captureStream + MediaRecorder，本地完成，不上传） */
let REC = null, recTimer = 0;
function recBtnLabel(t) { const b = $('btnRec'); if (b) b.textContent = t; }
function toggleRec() {
  if (REC) { try { REC.stop(); } catch (e) {} return; }
  if (!window.MediaRecorder) { toast('这个浏览器不支持录制，用系统录屏吧', 2600); return; }
  try {
    const stream = renderer.domElement.captureStream(30);
    const mt = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => window.MediaRecorder.isTypeSupported(t));
    REC = new window.MediaRecorder(stream, { mimeType: mt, videoBitsPerSecond: 8e6 });
    const chunks = [];
    REC.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    REC.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      downloadBlob('aurora-tree-' + Date.now() + '.webm', blob);
      toast('已导出 webm · ' + (blob.size / 1048576).toFixed(1) + ' MB', 2400);
      REC = null;
      clearTimeout(recTimer);
      recBtnLabel('录制 8 秒');
      $('btnRec').classList.add('rec');
    };
    REC.start();
    recBtnLabel('● 录制中 · 点此停止');
    $('btnRec').classList.remove('rec');
    recTimer = setTimeout(() => { if (REC) REC.stop(); }, 8000);
    toast('录制 8 秒：试试比耶开花 + 手掌推粒子', 2600);
  } catch (e) {
    REC = null;
    toast('录制失败：' + (e && e.message), 2600);
  }
}
$('btnRec').addEventListener('click', toggleRec);

/* 对外 API：编辑器 / 自动化测试 / 共创者都从这里进，不直接改 Three.js */
const LAYERS = () => ({
  sky: scene.getObjectByName('sky'),
  snow: scene.getObjectByName('snow'),
  aurora: scene.getObjectByName('aurora'),
  nebula: scene.getObjectByName('neb'),
  ground: scene.getObjectByName('ground'),
  groundDisc: scene.getObjectByName('groundDisc'),
  tree: tree.group,
  photos: photoGroup,
  star: scene.getObjectByName('treeStar'),
  halo: scene.getObjectByName('treeHalo'),
  ink: INK.points,
  fireworks: scene.getObjectByName('fw')
});

function addPhotoFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { const ok = addPhoto(img, url); resolve(!!ok); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
    img.src = url;
  });
}

const api = {
  version: '2.1.0',
  // 主题 / 形态
  get theme() { return themeKey; },
  setTheme, themes: Object.keys(THEMES), themeLabels: Object.fromEntries(Object.keys(THEMES).map(k => [k, THEMES[k].label || k])),
  get shape() { return shapeNow; },
  shapes: SHAPE_ORDER, shapeLabels: SHAPE_LABEL, setShape,
  // 粒子调参
  tune: TUNE, tuneDefaults: TUNE_DEFAULT, rebuild: rebuildTree, syncTune: syncTuneUI,
  // 力场
  field: FIELD, fieldNames: FIELD_NAME, pulse: () => { FIELD.pulse = true; },
  setFieldSim: (v) => { FIELD_SIM = v ? 1 : 0; },
  setField: (mode, power) => {
    FIELD.mode = Math.max(0, Math.min(3, Number(mode) || 0));
    if (typeof power === 'number') FIELD.power = Math.max(0, Math.min(2, power));
    document.querySelectorAll('#sField .sChip').forEach(x => x.classList.toggle('on', Number(x.dataset.f) === FIELD.mode));
    if ($('rngField')) $('rngField').value = String(FIELD.power);
  },
  // 鼠标当手
  pointer: POINTER,
  // 渲染后端（WebGPU ping-pong compute / WebGL）
  backend: () => ({ mode: GPU.mode, active: GPU.active, ready: GPU.ready, error: GPU.error }),
  setBackend: setGpuBackend,
  // 照片
  photos: () => photos,
  addPhotoFile: addPhotoFromFile,
  removePhotoAt: (i) => { const sp = photos[i]; if (sp) removePhoto(sp); },
  togglePhotoAt: (i) => {
    const sp = photos[i]; if (!sp) return;
    sp.userData.hidden = !sp.userData.hidden;
    sp.visible = !sp.userData.hidden;
    renderPhotoPanel();
  },
  // 层级可见性
  layers: LAYERS,
  // 预设
  preset: gatherPreset,
  applyPreset: (p) => {
    if (!p) return false;
    if (p.theme) setTheme(p.theme);
    if (p.field) { FIELD.mode = Number(p.field.mode) || 0; FIELD.power = Number(p.field.power) || 1; }
    if (p.tune) {
      for (const k in TUNE_DEFAULT) if (typeof p.tune[k] === 'number') TUNE[k] = p.tune[k];
      syncTuneUI();
      if (Math.abs(TUNE.count - tree.meta.kind.length) > 400) rebuildTree(Math.round(TUNE.count));
    }
    if (p.shape && SHAPE_LABEL[p.shape]) setShape(p.shape);
    return true;
  },
  savePresetLocal: savePreset, loadPresetLocal: loadPreset,
  // 导出
  snapshot: saveSnapshot,
  record: toggleRec,
  isRecording: () => !!REC,
  // 状态
  stats: () => ({
    fps: V2HUD.fps,
    count: tree.meta.kind.length,
    gpu: GPU.active ? 'WebGPU · ping-pong' : (renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1'),
    backend: GPU.mode,
    backendReady: GPU.ready,
    backendError: GPU.error
  }),
  camera: HANDS,
  // 调试用内部句柄
  debug: { S, TUNE, tree: () => tree, INK, PHOTOGRAB, FSM, analyze, applyHands, handShapeTick, tickPhotoGrab, screenToWorld, scene, renderer, camera }
};
window.__aurora = api;

/* 旧调试入口保留（?debug=1） */
if (/[?&]debug=1/.test(location.search)) {
  window.__xmas = {
    analyze, applyHands, handShapeTick, HANDS, S, TUNE, tree: () => tree, INK,
    setShape, rebuildTree, PHOTOGRAB, SHAPE_ORDER, FINGER_SHAPE,
    tickPhotoGrab, handTipLocal, photos: () => photos, camera,
    V2: { FIELD, FSM, gatherPreset, setStudio, updateField, glowNow }
  };
}

$('loadBar').style.width = '45%';

(function boot() {
  const params = new URLSearchParams(location.search);

  // 渲染后端：默认自动探测 WebGPU，?gpu=0 强制走 WebGL 着色器
  if (params.get('gpu') === '0') setGpuBackend('webgl');
  else if (GPU.mode !== 'webgl') setTimeout(() => { void initGpuCompute(); }, 900);

  // 套用上次保存的粒子参数（数量变了就重建一次）
  syncTuneUI();
  if (Math.abs(TUNE.count - tree.meta.kind.length) > 400) rebuildTree(TUNE.count);
  U.uTime.value = Math.random() * 40;
  const nameParam = params.get('to');
  let storedName = '', storedMsg = '';
  try {
    storedName = localStorage.getItem('xmas-name') || '';
    storedMsg = localStorage.getItem('xmas-msg') || '';
  } catch (e) {}
  if (nameParam) nameEl.textContent = nameParam.slice(0, 40);
  else if (storedName) nameEl.textContent = storedName;
  if (storedMsg) msgEl.textContent = storedMsg;

  const d = new Date();
  $('dateLabel').textContent = d.getFullYear() + ' · 12 · 25';

  // 可分享/可调试的状态预设
  const raw = params.get('spread');
  if (raw !== null) {
    const sp = clamp(parseFloat(raw) || 0, 0, 1);
    S.spread = S.spreadT = sp;
    S.spreadLocked = true;
    if (sp > 0.45) { S.gallery = S.galleryT = 1; }
  }
  if (params.get('demo') === '1') setTimeout(demoPhotos, 600);
  if (params.get('perf') === '0') perfCheckAt = 1e9;
  const rotParam = parseFloat(params.get('rot'));
  if (!isNaN(rotParam)) S.rot = rotParam;
  if (params.get('ink') === '1') setTimeout(() => { dismissIntro(); setBrush(true); setTimeout(demoInk, 500); }, 1200);
  const hideList = (params.get('hide') || '').split(',').filter(Boolean);
  if (hideList.length) scene.traverse(o => { if (hideList.includes(o.name)) o.visible = false; });

  // ?shape=heart|flake|star|text|galaxy 直接呈现某个形态（用于演示/截图）
  const shp = params.get('shape');
  if (shp && SHAPE_LABEL[shp]) {
    dismissIntro();
    buildShapeInto(shp, tree.aShapeB);
    tree.aShapeA.set(tree.aShapeB);
    tree.geo.attributes.aShapeA.needsUpdate = true;
    tree.geo.attributes.aShapeB.needsUpdate = true;
    shapeNow = shp;
    paintShape(shp);
    S.spread = S.spreadT = 1;
    tree.uni.uMorph.value = 0;
    document.querySelectorAll('.shchip').forEach(b => b.classList.toggle('on', b.dataset.shape === shp));
  }
  if (params.get('fire') === '1') {
    setTimeout(() => {
      fireworks.burst(rand(-6, 6), rand(8, 13), rand(-2, 3), theme().fw, 260, 4.6, 1);
      fireworks.burst(rand(-9, 9), rand(5, 9), rand(-3, 3), theme().fw, 200, 3.8, 1);
    }, 1500);
  }

  // 首屏自动亮起，引导卡浮在上面
  setTimeout(() => {
    $('wishCard').classList.add('show');
    $('gestureBar').classList.add('show');
    $('shapeBar').classList.add('show');
  }, 900);

  // 三次无操作也提示一次
  setTimeout(() => { if (!introGone) toast('抬起手掌，这棵树会回应你', 2600); }, 2200);

  // 引导关闭后仍未开摄像头 → 轻脉冲提示入口按钮（不弹窗打扰）
  const pulseTimer = setInterval(() => {
    if (HANDS.running) { $('btnCam').classList.remove('pulse'); clearInterval(pulseTimer); return; }
    if (introGone) $('btnCam').classList.add('pulse');
  }, 1500);

  // 手机端自动进入（无摄像头授权弹窗打扰）
  if (LOW) {
    setTimeout(() => { if (!introGone) dismissIntro(); }, 6000);
  }
  // 分享链接 / 展示模式：直接进树
  if (nameParam || params.get('show') === '1') {
    setTimeout(() => { if (!introGone) dismissIntro(); }, 900);
  }
})();

frame();

