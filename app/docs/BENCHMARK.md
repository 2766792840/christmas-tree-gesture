# Benchmark — V3 P0 基线（2026-11-28）

本机 1440×900、DPR 1、`fieldSim=1`、26 000 粒子、headed Chrome（`--enable-unsafe-webgpu`），
GPU：ANGLE (Intel, Intel(R) UHD Graphics, D3D11)。每组 3 轮 × 30 s，预热 5 s，取各轮中位数。

## 结论先写

1. **V2.2 的 WebGPU 通路自带约 10.8 Hz 的回读上限**：30 s 内 325 次回读成功、1189 帧因 staging 忙被跳过；
   `queueWait` 单次 60–105 ms、`mapWait` 40–80 ms，往返整体 130–220 ms。
2. **帧时间不是瓶颈**：auto / webgl 的 p50 都是 22.1 ms（约 45 fps 的帧节奏），两边一致。
   WebGPU 只在 p99 更差（44.4 ms vs 33.2 ms），差的正是回读造成的偶发双帧。
3. **“15–20 Hz 限频”这个前提不成立**：原生通路已经只有 10.8 Hz，限频根本触发不到；
   反过来把回读拉到 20 Hz / 45 Hz，p95 会从 22.5 ms 恶化到 33–44 ms。
   所以瓶颈不是“太频繁”，而是“一读就伤帧”。

## 变体实测

| 配置 | p50 | p95 | p99 | 有效回读 | 备注 |
|---|---|---|---|---|---|
| V2.2 串行回读（基线） | 22.1 | 22.5 | 44.4 | 10.8 Hz | 0 长任务 |
| staging 环 8 槽、每帧 copy+map | 22.1 | 44.2 | 44.5 | ~45 Hz | 3 次运行中 1 次驱动卡死 4.7 s，淘汰 |
| staging 环 + 3 个 map 在飞上限 | 22.1 | 44.3 | 44.5 | ~38 Hz | 稳定但每帧易撞双帧，淘汰 |
| 串行回读 + `?readbackHz=20` | 22.1 | 33.1 | 44.4 | 16.4 Hz（实际 61 ms/次） | 频率升了，p95 变差 |
| **串行回读 + 顶点插值（当前默认）** | 22.1 | 30.9 | 44.4 | 13.4 Hz | 视觉连续，p99 未变 |
| WebGL2（对照，无回读） | 22.1 | 22.4 | 33.2 | — | 说明 22.1 ms 是本机帧节奏上限 |

## 怎么读这份数据

- `p50` 相同说明两边都在同一帧节奏上跑，比较 p50 没有意义；
- WebGPU 的 p99 44.4 ms 与 WebGL 的 33.2 ms 之差，就是回读停顿；
- `gpu.readbackIntervalMs` 的 p50 在基线里是 80–100 ms，是“粒子位置每 0.1 s 才更新一次”的直接证据。

## 代码侧改动

- `src/dev/bench.ts`：`?bench=1` 挂 `window.__auroraBench`，无参数时零开销。
- `src/webgpu/compute.ts`：回读限频 `readbackHz` + 诊断打点（submit / queueWait / mapWait / copy / interval / 计数）。
- `src/app/engine.ts`：`aPhysPrev` + `uPhysMix` 顶点插值，把 10.8–13 Hz 的快照在两帧之间线性推进；
  `?interp=0` 可退回逐帧直出做 A/B。

## 下一步（按证据排序）

1. 回读要减，不是要加：优先做 GPU-resident（WebGPU 渲染或 WebGL2 FBO GPGPU），把 `p99` 的 11 ms 差抹掉。
2. 插值只在“必须有回读”时才是正解；真机上请用 `?interp=0` 对比一次，确认观感取舍。
3. 设备矩阵还没填，核显之外至少要补一台独显与一台手机（`docs/device-matrix-template.csv`）。
