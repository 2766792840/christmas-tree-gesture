/**
 * WebGPU 粒子力场：ping-pong compute。
 *
 * - base：每帧由 CPU 写入的「目标位置」（含形态插值 / 散开插值），storage buffer
 * - posA / posB、velA / velB：两套状态缓冲逐帧交替读写，即 ping-pong
 * - 计算完把 posOut 拷到 staging buffer 异步 map，读回后喂给 WebGL 的 aPhys 属性
 *
 * 渲染仍是 three.js WebGL；WebGPU 只承担物理积分。这样既能真跑 compute，
 * 又不用把整棵树的材质重写成 TSL 节点。
 */

export interface FieldStep {
  dt: number;
  time: number;
  hand: [number, number, number];
  handOn: number;
  mode: number;   // 1 排斥 2 吸引 3 涡旋
  power: number;
  curl: number;
  pulseT: number;
  pulseOrg: [number, number, number];
}

const WGSL = /* wgsl */ `
struct U {
  dt: f32,
  time: f32,
  count: f32,
  mode: f32,
  power: f32,
  curl: f32,
  handOn: f32,
  pulseT: f32,
  hand: vec4f,
  pulse: vec4f,
};

@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> base: array<vec4f>;
@group(0) @binding(2) var<storage, read> posIn: array<vec4f>;
@group(0) @binding(3) var<storage, read> velIn: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> posOut: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> velOut: array<vec4f>;

fn falloff(dist: f32, reach: f32) -> f32 {
  return 1.0 - smoothstep(0.0, reach, dist);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= u32(u.count)) { return; }

  var p = posIn[i].xyz;
  var v = velIn[i].xyz;
  let b = base[i].xyz;
  let seed = base[i].w;

  // 回家的弹簧：形态切换后粒子会自己落回目标位置
  v += (b - p) * 1.55 * u.dt;

  // 手掌力场
  if (u.handOn > 0.001 && u.mode > 0.5) {
    let d = p - u.hand.xyz;
    let dist = length(d);
    let reach = 7.4 + seed * 1.8;
    let fall = falloff(dist, reach);
    var dir = 1.0;
    if (u.mode > 1.5 && u.mode < 2.5) { dir = -1.0; }
    var shell = 1.0;
    if (dir < 0.0) { shell = smoothstep(0.4, 2.4, dist); }
    v += normalize(d + vec3f(0.0001, 0.0001, 0.0001)) * fall * shell * u.handOn * u.power * dir * 7.0 * u.dt;

    if (u.mode > 2.5) {
      let rel = vec3f(d.x, 0.0, d.z);
      let ang = fall * u.curl * u.handOn * 3.2 * u.dt;
      let cs = cos(ang);
      let sn = sin(ang);
      let rot = vec3f(rel.x * cs - rel.z * sn, 0.0, rel.x * sn + rel.z * cs);
      v += (rot - rel) * 6.0 * u.dt;
    }
  }

  // 脉冲冲击波
  let age = u.time - u.pulseT;
  if (age > 0.0 && age < 2.6) {
    let d = p - u.pulse.xyz;
    let dd = length(d);
    let r = age * 7.5;
    let band = 1.0 - smoothstep(0.0, 1.7, abs(dd - r));
    v += normalize(d + vec3f(0.0001, 0.0001, 0.0001)) * band * (1.0 - age / 2.6) * 10.0 * u.dt;
  }

  v *= exp(-2.4 * u.dt);
  p += v * u.dt;

  posOut[i] = vec4f(p, 1.0);
  velOut[i] = vec4f(v, 0.0);
}
`;

interface FrameBuffers {
  pos: GPUBuffer;
  vel: GPUBuffer;
  staging: GPUBuffer;
  mapped: boolean;
}

export class PingPongParticles {
  readonly backend = 'webgpu' as const;
  readonly count: number;
  private device: GPUDevice;
  private pipeline: GPUComputePipeline;
  private bindA: GPUBindGroup;
  private bindB: GPUBindGroup;
  private uniforms: GPUBuffer;
  private baseBuffer: GPUBuffer;
  private frames: [FrameBuffers, FrameBuffers];
  private flip = 0;
  private disposed = false;
  private queue: GPUQueue;

  static async create(count: number): Promise<PingPongParticles | null> {
    if (!('gpu' in navigator) || !navigator.gpu) return null;
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      return new PingPongParticles(device, count);
    } catch {
      return null;
    }
  }

  private constructor(device: GPUDevice, count: number) {
    this.device = device;
    this.count = count;
    this.queue = device.queue;
    const bytes = count * 16;
    const storage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;

    this.baseBuffer = device.createBuffer({ size: bytes, usage: storage });
    const mk = () => device.createBuffer({ size: bytes, usage: storage | GPUBufferUsage.COPY_SRC });

    this.frames = [
      {
        pos: mk(), vel: mk(),
        staging: device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }),
        mapped: false
      },
      {
        pos: mk(), vel: mk(),
        staging: device.createBuffer({ size: bytes, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }),
        mapped: false
      }
    ];

    this.uniforms = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    const module = device.createShaderModule({ code: WGSL });
    this.pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });

    const layout = this.pipeline.getBindGroupLayout(0);
    const bound = (pos: GPUBuffer, vel: GPUBuffer, outPos: GPUBuffer, outVel: GPUBuffer) =>
      device.createBindGroup({
        layout,
        entries: [
          { binding: 0, resource: { buffer: this.uniforms } },
          { binding: 1, resource: { buffer: this.baseBuffer } },
          { binding: 2, resource: { buffer: pos } },
          { binding: 3, resource: { buffer: vel } },
          { binding: 4, resource: { buffer: outPos } },
          { binding: 5, resource: { buffer: outVel } }
        ]
      });
    // A → B, B → A 两个 bind group 交替使用 = ping-pong
    this.bindA = bound(this.frames[0].pos, this.frames[0].vel, this.frames[1].pos, this.frames[1].vel);
    this.bindB = bound(this.frames[1].pos, this.frames[1].vel, this.frames[0].pos, this.frames[0].vel);
  }

  /** 每帧上传目标位置（vec4：xyz 位置 + w 粒子随机种子） */
  setBase(base: Float32Array<ArrayBuffer>): void {
    if (this.disposed) return;
    this.queue.writeBuffer(this.baseBuffer, 0, base);
  }

  /** 把当前目标位置同时写进两套状态缓冲，粒子从目标处开始，不会从原点炸开 */
  reset(base: Float32Array<ArrayBuffer>): void {
    if (this.disposed) return;
    const pos = new Float32Array(this.count * 4);
    for (let i = 0; i < this.count; i++) {
      pos[i * 4] = base[i * 4];
      pos[i * 4 + 1] = base[i * 4 + 1];
      pos[i * 4 + 2] = base[i * 4 + 2];
      pos[i * 4 + 3] = 1;
    }
    const vel = new Float32Array(this.count * 4);
    this.queue.writeBuffer(this.frames[0].pos, 0, pos);
    this.queue.writeBuffer(this.frames[1].pos, 0, pos);
    this.queue.writeBuffer(this.frames[0].vel, 0, vel);
    this.queue.writeBuffer(this.frames[1].vel, 0, vel);
  }

  step(f: FieldStep): void {
    if (this.disposed) return;
    const u = new Float32Array(24);
    u[0] = f.dt; u[1] = f.time; u[2] = this.count; u[3] = f.mode;
    u[4] = f.power; u[5] = f.curl; u[6] = f.handOn; u[7] = f.pulseT;
    u[8] = f.hand[0]; u[9] = f.hand[1]; u[10] = f.hand[2];
    u[16] = f.pulseOrg[0]; u[17] = f.pulseOrg[1]; u[18] = f.pulseOrg[2];
    this.queue.writeBuffer(this.uniforms, 0, u);

    const srcIdx = this.flip;
    const bind = srcIdx === 0 ? this.bindA : this.bindB;
    const dst = this.frames[1 - srcIdx];

    const enc = this.device.createCommandEncoder();
    const pass = enc.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bind);
    pass.dispatchWorkgroups(Math.ceil(this.count / 64));
    pass.end();
    enc.copyBufferToBuffer(dst.pos, 0, dst.staging, 0, this.count * 16);
    this.queue.submit([enc.finish()]);

    this.flip = 1 - this.flip;
    this.requestReadback(dst);
  }

  private requestReadback(frame: FrameBuffers): void {
    if (frame.mapped) return;
    frame.mapped = true;
    frame.staging.mapAsync(GPUMapMode.READ)
      .then(() => {
        // 交给 readPositions() 消费
        (frame as any).__ready = true;
      })
      .catch(() => { frame.mapped = false; });
  }

  /** 取回一帧位置到 out（vec3 交错），返回是否拿到了新数据 */
  readInto(out: Float32Array): boolean {
    for (const f of this.frames) {
      if (!(f as any).__ready) continue;
      const src = f.staging.getMappedRange();
      const v = new Float32Array(src);
      for (let i = 0, j = 0; i < this.count; i++, j += 4) {
        out[i * 3] = v[j];
        out[i * 3 + 1] = v[j + 1];
        out[i * 3 + 2] = v[j + 2];
      }
      f.staging.unmap();
      (f as any).__ready = false;
      f.mapped = false;
      return true;
    }
    return false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.baseBuffer.destroy();
    this.uniforms.destroy();
    this.frames.forEach(f => { f.pos.destroy(); f.vel.destroy(); f.staging.destroy(); });
  }
}
