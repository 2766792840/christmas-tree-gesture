/**
 * WebGL2 FBO GPGPU 粒子力场（GPU-resident 方案的 WebGL 侧实现）。
 *
 * 与 webgpu/compute.ts 的区别：位置/速度始终留在 GPU 的 RGBA32F 纹理里，
 * 每一帧只是「纹理 → 纹理」的全屏计算，不再 copyBufferToBuffer + mapAsync 读回 CPU，
 * 渲染阶段直接在顶点着色器里 texture2D 取位置。
 *
 * 代价是每帧仍要把 base（目标位置）从 CPU 传到 GPU，但那是 ~416 KB 的上传，
 * 不涉及同步等待，也不会有回读停顿。
 */

import * as THREE from 'three';

export interface FboFieldStep {
  dt: number;
  time: number;
  hand: [number, number, number];
  handOn: number;
  mode: number;
  power: number;
  curl: number;
  pulseT: number;
  pulseOrg: [number, number, number];
}

const TEX_W = 512;

const FRAG = /* glsl */ `
precision highp float;
precision highp int;

uniform sampler2D uBase;
uniform sampler2D uPos;
uniform sampler2D uVel;
uniform float uDt, uTime, uCount, uMode, uPower, uCurl, uHandOn, uPulseT, uWrite;
uniform vec3 uHand, uPulse;
uniform int uW;

void main() {
  ivec2 c = ivec2(int(gl_FragCoord.x), int(gl_FragCoord.y));
  float idx = float(c.y * uW + c.x);
  vec4 base = texelFetch(uBase, c, 0);

  // 填充格：保持零，避免污染统计
  if (idx >= uCount) { gl_FragColor = vec4(0.0); return; }

  vec3 p = texelFetch(uPos, c, 0).xyz;
  vec3 v = texelFetch(uVel, c, 0).xyz;
  vec3 b = base.xyz;
  float seed = base.w;

  // 回家的弹簧
  v += (b - p) * 1.55 * uDt;

  // 手掌力场
  if (uHandOn > 0.001 && uMode > 0.5) {
    vec3 d = p - uHand;
    float dist = length(d);
    float reach = 7.4 + seed * 1.8;
    float fall = 1.0 - smoothstep(0.0, reach, dist);
    float dir = 1.0;
    if (uMode > 1.5 && uMode < 2.5) { dir = -1.0; }
    float shell = 1.0;
    if (dir < 0.0) { shell = smoothstep(0.4, 2.4, dist); }
    v += normalize(d + vec3(0.0001, 0.0001, 0.0001)) * fall * shell * uHandOn * uPower * dir * 7.0 * uDt;

    if (uMode > 2.5) {
      vec3 rel = vec3(d.x, 0.0, d.z);
      float ang = fall * uCurl * uHandOn * 3.2 * uDt;
      float cs = cos(ang);
      float sn = sin(ang);
      vec3 rot = vec3(rel.x * cs - rel.z * sn, 0.0, rel.x * sn + rel.z * cs);
      v += (rot - rel) * 6.0 * uDt;
    }
  }

  // 脉冲冲击波
  float age = uTime - uPulseT;
  if (age > 0.0 && age < 2.6) {
    vec3 d = p - uPulse;
    float dd = length(d);
    float r = age * 7.5;
    float band = 1.0 - smoothstep(0.0, 1.7, abs(dd - r));
    v += normalize(d + vec3(0.0001, 0.0001, 0.0001)) * band * (1.0 - age / 2.6) * 10.0 * uDt;
  }

  v *= exp(-2.4 * uDt);
  p += v * uDt;

  gl_FragColor = uWrite < 0.5 ? vec4(p, 1.0) : vec4(v, 0.0);
}
`;

const VERT = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export class FboParticles {
  readonly backend = 'fbo' as const;
  readonly count: number;
  readonly texW = TEX_W;
  readonly texH: number;
  texture: THREE.Texture;

  private renderer: THREE.WebGLRenderer;
  private baseTex: THREE.DataTexture;
  private baseData: Float32Array;
  private targets: { posA: THREE.WebGLRenderTarget; posB: THREE.WebGLRenderTarget; velA: THREE.WebGLRenderTarget; velB: THREE.WebGLRenderTarget };
  private a = true; // 当前可读的一侧：true = A
  private mat: THREE.ShaderMaterial;
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private disposed = false;

  static supported(renderer: THREE.WebGLRenderer): boolean {
    if (!renderer.capabilities.isWebGL2) return false;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    return !!gl.getExtension('EXT_color_buffer_float');
  }

  constructor(renderer: THREE.WebGLRenderer, count: number) {
    this.renderer = renderer;
    this.count = count;
    this.texH = Math.ceil(count / TEX_W);
    const w = this.texW, h = this.texH;

    const rtOpts: THREE.RenderTargetOptions = {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      colorSpace: THREE.NoColorSpace
    };
    const mkTarget = () => {
      const t = new THREE.WebGLRenderTarget(w, h, rtOpts);
      t.texture.colorSpace = THREE.NoColorSpace;
      return t;
    };
    this.targets = { posA: mkTarget(), posB: mkTarget(), velA: mkTarget(), velB: mkTarget() };

    this.baseData = new Float32Array(w * h * 4);
    this.baseTex = new THREE.DataTexture(this.baseData, w, h, THREE.RGBAFormat, THREE.FloatType);
    this.baseTex.minFilter = THREE.NearestFilter;
    this.baseTex.magFilter = THREE.NearestFilter;
    this.baseTex.needsUpdate = true;

    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uBase: { value: this.baseTex },
        uPos: { value: null },
        uVel: { value: null },
        uDt: { value: 0 },
        uTime: { value: 0 },
        uCount: { value: count },
        uMode: { value: 1 },
        uPower: { value: 1 },
        uCurl: { value: 0 },
        uHandOn: { value: 0 },
        uPulseT: { value: -999 },
        uWrite: { value: 0 },
        uHand: { value: new THREE.Vector3() },
        uPulse: { value: new THREE.Vector3() },
        uW: { value: w }
      }
    });

    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.texture = this.targets.posA.texture;
  }

  /** 把目标位置写进 base 纹理（vec4: xyz + 种子） */
  setBase(base: Float32Array): void {
    if (this.disposed) return;
    const n = Math.min(this.count, base.length / 4);
    for (let i = 0; i < n; i++) {
      const s = i * 4;
      this.baseData[s] = base[s];
      this.baseData[s + 1] = base[s + 1];
      this.baseData[s + 2] = base[s + 2];
      this.baseData[s + 3] = base[s + 3];
    }
    this.baseTex.needsUpdate = true;
  }

  /** 用 base 位置初始化两套状态：粒子从目标处开始，不会从原点炸开 */
  reset(base: Float32Array): void {
    this.setBase(base);
    // 初始时就地写入 pos = base、vel = 0：直接上传到 4 张纹理
    const w = this.texW, h = this.texH;
    const pos = new Float32Array(w * h * 4);
    const vel = new Float32Array(w * h * 4);
    for (let i = 0; i < this.count; i++) {
      pos[i * 4] = this.baseData[i * 4];
      pos[i * 4 + 1] = this.baseData[i * 4 + 1];
      pos[i * 4 + 2] = this.baseData[i * 4 + 2];
      pos[i * 4 + 3] = 1;
    }
    this.addInit('posA', pos);
    this.addInit('posB', pos);
    this.addInit('velA', vel);
    this.addInit('velB', vel);
    this.a = true;
    this.texture = this.targets.posA.texture;
  }

  private addInit(target: 'posA' | 'posB' | 'velA' | 'velB', data: Float32Array): void {
    const tex = new THREE.DataTexture(data, this.texW, this.texH, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: `uniform sampler2D uSrc;
        void main(){ gl_FragColor = texelFetch(uSrc, ivec2(int(gl_FragCoord.x), int(gl_FragCoord.y)), 0); }`,
      depthTest: false,
      depthWrite: false,
      uniforms: { uSrc: { value: tex } }
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    this.renderer.setRenderTarget(this.targets[target]);
    this.renderer.render(quad, this.cam);
    this.renderer.setRenderTarget(null);
    quad.geometry.dispose();
    mat.dispose();
    tex.dispose();
  }

  /** 每帧跑一次位置 + 速度更新，结果留在 GPU 纹理里 */
  step(f: FboFieldStep): void {
    if (this.disposed) return;
    this.mat.uniforms.uDt.value = f.dt;
    this.mat.uniforms.uTime.value = f.time;
    this.mat.uniforms.uMode.value = f.mode;
    this.mat.uniforms.uPower.value = f.power;
    this.mat.uniforms.uCurl.value = f.curl;
    this.mat.uniforms.uHandOn.value = f.handOn;
    this.mat.uniforms.uPulseT.value = f.pulseT;
    this.mat.uniforms.uHand.value.set(f.hand[0], f.hand[1], f.hand[2]);
    this.mat.uniforms.uPulse.value.set(f.pulseOrg[0], f.pulseOrg[1], f.pulseOrg[2]);

    const src = this.a
      ? { pos: this.targets.posA.texture, vel: this.targets.velA.texture }
      : { pos: this.targets.posB.texture, vel: this.targets.velB.texture };
    this.mat.uniforms.uPos.value = src.pos;
    this.mat.uniforms.uVel.value = src.vel;

    // pos → 另一侧
    this.mat.uniforms.uWrite.value = 0;
    this.renderer.setRenderTarget(this.a ? this.targets.posB : this.targets.posA);
    this.renderer.render(this.scene, this.cam);

    // vel → 另一侧（仍然读旧的一侧，保证同一帧内自洽）
    this.mat.uniforms.uWrite.value = 1;
    this.renderer.setRenderTarget(this.a ? this.targets.velB : this.targets.velA);
    this.renderer.render(this.scene, this.cam);
    this.renderer.setRenderTarget(null);

    this.a = !this.a;
    this.texture = this.a ? this.targets.posA.texture : this.targets.posB.texture;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    Object.values(this.targets).forEach(t => t.dispose());
    this.baseTex.dispose();
    this.mat.dispose();
  }
}
