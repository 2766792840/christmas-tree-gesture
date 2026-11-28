import { describe, expect, it } from 'vitest';
import { resolveBackend } from './backend';

const deskGpu = { hasWebGPU: true, isMobile: false, webgl2: true };
const deskNoGpu = { hasWebGPU: false, isMobile: false, webgl2: true };
const mobileGpu = { hasWebGPU: true, isMobile: true, webgl2: true };

describe('resolveBackend', () => {
  it('手动 WebGL 永远不启用 compute', () => {
    expect(resolveBackend('webgl', deskGpu).active).toBe(false);
    expect(resolveBackend('webgl', mobileGpu).active).toBe(false);
  });

  it('手动 WebGPU 在支持时启用，不支持时给原因', () => {
    expect(resolveBackend('webgpu', deskGpu).active).toBe(true);
    const noGpu = resolveBackend('webgpu', deskNoGpu);
    expect(noGpu.active).toBe(false);
    expect(noGpu.reason).toContain('WebGPU');
  });

  it('auto：桌面 + WebGPU 启用', () => {
    expect(resolveBackend('auto', deskGpu).active).toBe(true);
  });

  it('auto：无 WebGPU 或移动端回落 WebGL', () => {
    expect(resolveBackend('auto', deskNoGpu).active).toBe(false);
    expect(resolveBackend('auto', mobileGpu).active).toBe(false);
    expect(resolveBackend('auto', mobileGpu).reason).toContain('移动端');
  });
});
