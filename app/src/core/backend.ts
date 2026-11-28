import type { BackendMode } from '../types/aurora';

export interface DeviceCaps {
  hasWebGPU: boolean;
  isMobile: boolean;
  webgl2: boolean;
}

export interface BackendDecision {
  active: boolean;
  reason: string;
}

/** 后端仲裁：显式选择优先，auto 只在桌面 + 有 WebGPU 时才启用 compute */
export function resolveBackend(mode: BackendMode | string, caps: DeviceCaps): BackendDecision {
  if (mode === 'webgl') return { active: false, reason: '手动选择 WebGL' };
  if (mode === 'webgpu') {
    if (!caps.hasWebGPU) return { active: false, reason: '浏览器无 WebGPU' };
    return { active: true, reason: '手动选择 WebGPU' };
  }
  if (!caps.hasWebGPU) return { active: false, reason: '浏览器无 WebGPU' };
  if (caps.isMobile) return { active: false, reason: '移动端默认走 WebGL 省电' };
  return { active: true, reason: '桌面端自动启用 WebGPU' };
}
