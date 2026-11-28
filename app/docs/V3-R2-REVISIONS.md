# V3 方案（R2）修订记录 — 基于 P0 实测

修订日期：2026-11-28　对应文档：`Aurora_Tree_Studio_V3_技术升级与优化方案.pdf`（18 页 R2）
实测环境：本机 iGPU（Intel UHD / D3D11），1440×900，26 000 粒子，3×30 s 取中位数。

## 一、事实性错误

1. **TypeScript 版本**：R2 写 `^5.3.2`，仓库实际 `^5.9.2`（`app/package.json`）。
2. **Benchmark Kit 未随文档交付**：已补齐，现位于 `app/scripts/benchmark.mjs`、`app/scripts/merge-benchmarks.mjs`、
   `app/src/dev/bench.ts`、`app/docs/{benchmark.schema.json,device-matrix-template.csv,INTEGRATION.md}`。
3. **PoC 粒子数**：R2 写 10k，实际瓶颈发生在 26k 固定场景，PoC 已改为 26k。

## 二、需要改写的判断（实测推翻原假设）

### 1. “15–20 Hz 限频”不是重点

实测：V2.2 原生回读只有 **10.8 Hz**（30 s / 325 次，1189 帧被跳过），
`queueWait` 60–105 ms + `mapWait` 40–80 ms，往返 130–220 ms。
限频阈值 15/20 Hz 根本触发不到；而把回读提到 20 Hz，p95 从 22.5 ms 恶化到 33.1 ms，
提到 ~45 Hz（8 槽 staging 环）时 p95/p99 双双到 44 ms，还出现一次 4.7 s 驱动卡死。

**改写为**：回读是“一读就伤帧”的成本项，方向应从“限频”改为“减量/消除”——
GPU-resident 渲染（或 WebGL2 FBO GPGPU）应提前到 P1，而不是 P2 决策项。

### 2. 验收门槛“无明显抖动”不可验收

**改写为**（可量化）：
- `gpu.readbackIntervalMs` p50 ≤ 35 ms（即 ≥ 28 Hz）或该通路被移除；
- 帧时间 p95 ≤ 24 ms、p99 ≤ 34 ms（对齐同机 WebGL2 对照）；
- `long task` 0 次；`gpu.readbackSkipped / readbackQueued` ≥ 0.6 视为通路未达标。
- 视觉侧：以 `?interp=0` 与默认两版同场景录屏比对，粒子位置逐帧位移差的 P95 ≤ 3 px。

### 3. P0.3 30 分钟长稳不应挡住 P1

**改写为**：长稳跑在后台独立进行，与 P1（One Euro + FSM、模块拆分）并行；出口条件是“无崩溃 + 无内存单向上涨”，
不阻塞代码合并。

## 三、P0 出口（已达成部分）

- 双后端基线可复现：`app/benchmark-results/benchmark.json`（auto / webgl 各 3 轮）。
- 诊断 hooks 落地：submit / queueWait / mapWait / copy / interval / counters 全部进 `appDiagnostics`。
- 首个可视化改进：顶点插值把 10.8–13 Hz 的快照抹成连续运动（`?interp=0` 可关）。

## 四、任务清单调整

| 编号 | 原定 | 调整后 |
|---|---|---|
| V3-003 | 15/20 Hz A/B | 改为“回读成本 A/B”：串行 / 环 / 限频三档，已产出数据，结论见 `docs/BENCHMARK.md` |
| V3-008 | WebGPU GPU-resident PoC（26k） | 提到 P1，与 V3-005 并行；FBO 方案作为 WebGL 侧备选同步评估 |
| V3-009 | 30 分钟长稳与设备矩阵 | 后台并行，补独显 + 手机两档 |
| V3-010 | WebGL2 FBO 决策 | 决策条件改为：WebGPU 覆盖率 < 80% 或 p99 无法降到 34 ms 以内即转 FBO |
