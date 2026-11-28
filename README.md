# Aurora Tree Studio V2.2 · 手势粒子圣诞树（工程版）

**中文** | [English](README.en.md)

浏览器端的 3D 粒子圣诞树工作台：手势 / 鼠标驱动粒子力场、照片记忆球、3D 笔迹、场景编辑器与作品导出。按《Aurora_Tree_Studio_V2 技术升级改造方案》落地，是**从单文件 demo 迁到 Vite + TypeScript 工程骨架**的版本。

网页本身也是双语的：工具栏的 `EN / 中文` 按钮一键切换，`?lang=en` / `?lang=zh` 可强制语言，选择会记在 localStorage。

## V3 进展

线上跑的仍是 V2.2 的默认路径，V3 的能力已经并进主干，逐个开关验证：

| 能力 | 状态 | 开关 |
| --- | --- | --- |
| 性能基准工具链 + 诊断 hooks | 已完成 | `?bench=1` |
| GPU 回读诊断（submit / queue / map / copy） | 已完成 | 同上 |
| 顶点插值（两次快照间平滑） | 已完成 | `?interp=0` 关闭 |
| GPU-resident 粒子（WebGL2 FBO GPGPU，零回读） | PoC 已跑通 | `?backend=fbo` |
| One Euro 滤波 + 统一手势 FSM | 已实现，真机轨迹待校准 | `?oe=0` 关闭 / `?oeBeta` 调参 |
| Engine 模块拆分 / 移除 `@ts-nocheck` | 进行中（手势链路已拆出） | — |

实测（Intel UHD 核显、1440×900、DPR 1、26k 粒子、3×30 s）：

| 路径 | p50 | p95 | p99 |
| --- | --- | --- | --- |
| WebGPU + 串行回读 + 插值（默认） | 22.1 | 30.9 | 44.4 |
| WebGL2 着色器力场（无回读） | 22.1 | 22.4 | 33.2 |
| WebGL2 FBO GPGPU（`?backend=fbo`） | 22.1 | 22.3 | 22.5 |

细节与全部变体（含被否决的 staging 环方案）见 [`docs/BENCHMARK.md`](docs/BENCHMARK.md)。

## 运行

```bash
npm install
npm run dev        # http://127.0.0.1:8782
npm run typecheck  # tsc --noEmit
npm run test       # vitest，17 个用例
npm run build      # 产物在 dist/
npm run preview    # 预览构建产物
npm run ci         # typecheck + test + build，CI 里跑的就是这条
```

构建产物不依赖 importmap，可直接放进任意静态站点（GitHub Pages 也能用）。

## 目录

```
index.html                  # 只留 DOM / 样式，不再内联 3000 行脚本
src/main.ts                 # 启动：挂编辑器 → 挂鼠标手势 → 探测摄像头
src/app/engine.ts           # 渲染内核（three.js 场景、粒子、着色器、手势 FSM、导出）
src/webgpu/compute.ts       # WebGPU ping-pong 粒子物理（WGSL kernel）
src/types/aurora.ts         # 引擎对外 API 的类型契约（window.__aurora）
src/core/presets.ts         # 预设归一化 / 解析 / 序列化（纯函数，可单测）
src/core/pointer.ts         # NDC 换算、力场强度步进（纯函数，可单测）
src/core/backend.ts         # 渲染后端仲裁：auto / webgl / webgpu
src/core/pointerHand.ts     # 无摄像头时「鼠标当手」
src/ui/editor.ts            # 完整场景编辑器（只通过 window.__aurora 改场景）
src/ui/i18n.ts              # 中英文案字典 + 拼接句规则 + 语言探测
src/ui/langDom.ts            # DOM 文本节点翻译、语言开关、动态内容兜底
src/dev/errorScreen.ts      # 运行时报错落屏，加载卡住时不至于只看到星标
.github/workflows/ci.yml    # push / PR 自动跑类型检查、单测、构建并上传 dist
```

## 分层约定

- **引擎**（`engine.ts`）独占 Three.js：场景、粒子属性、力场 uniform、手势状态机、照片星球、笔迹、录制。
- **编辑器**（`editor.ts`）不碰 Three.js，只调用 `window.__aurora` 的语义 API：`setTheme` / `setShape` / `tune` / `setField` / `photos` / `layers` / `preset` / `snapshot` / `record`。
- **输入**（`pointerHand.ts`）只写 `__aurora.pointer`（归一化坐标 + 捏合状态），世界坐标换算留给引擎的 `screenToWorld`。

## WebGPU 与 Ping-Pong compute

渲染仍走 three.js WebGL，WebGPU 只负责粒子物理积分，避免把整棵树的材质重写成 TSL 节点。

- `src/webgpu/compute.ts` 里 `PingPongParticles` 持有 `base`（目标位置 + 种子，vec4）、`posA/posB`、`velA/velB` 三组 storage buffer，两个 bind group 互指，逐帧交替读写，就是 ping-pong。
- WGSL kernel 每帧做：弹簧回位（形态切换后粒子自己落回去）、手掌排斥 / 吸引（按种子给不同 reach，吸引留球壳）、涡旋、脉冲冲击波、指数阻尼。
- 算完 `copyBufferToBuffer` 到 staging，异步 `mapAsync` 读回，压成 vec3 喂给 `aPhys` 顶点属性；shader 里 `uGpu > 0.5` 时直接用 `aPhys` 当位置，同时关掉着色器内建的力场块。
- 后端仲裁在 `src/core/backend.ts`：桌面 + 有 WebGPU 才 auto 启用；移动端、无 WebGPU、`?gpu=0` 都回落 WebGL2 着色器力场。编辑器「渲染后端」分组可手动切换，HUD 右下角实时显示当前后端。
- 实测（Intel Gen-12lp 核显 / 26k 粒子）：WebGPU 约 45–47 fps，WebGL2 约 46 fps，切换后无明显掉帧。

## 类型收紧的边界

- 全局 `strict: true`、`noImplicitAny`、`noUnusedLocals`，`tsc --noEmit` 通过。
- `src/types/aurora.ts` 定义 `AuroraApi`（主题 / 形态 / 力场 / 调参 / 照片 / 层级 / 预设 / 导出 / 后端 / 统计），编辑器、鼠标输入、`main.ts` 全部按这个契约调，不再 `any`。
- `engine.ts` 是 3.1k 行的迁移体，内部仍是 `// @ts-nocheck`——这是 knowingly 的临时边界：对外签名被 `AuroraApi` 卡死，对内等后续按模块拆（渲染 / 手势 / 照片 / 笔迹）再逐步补类型。README 里写明，不算“做完了”。

## 测试与 CI

`src/core/*.test.ts` 共 17 个用例，覆盖三块最容易静默出错的纯逻辑：

- `backend.test.ts`（4）：手动 / auto / 无 GPU / 移动端的仲裁结果与理由文案。
- `pointer.test.ts`（7）：NDC 换算（中心、四角、越界夹取、尺寸为 0 不产生 Infinity）、力场强度步进与 0–2 夹取。
- `presets.test.ts`（6）：预设归一化、坏 JSON / 数组输入返回 null、序列化往返。

`.github/workflows/ci.yml`：push main、PR、手动触发；Node 22、`npm ci`、typecheck、test、build，最后把 `dist/` 作为 artifact 上传。

## 编辑器能力

| 分组 | 内容 |
| --- | --- |
| 输入源 | 鼠标 / 触屏 ↔ 摄像头手势，自动检测无摄像头并切鼠标模式 |
| 渲染后端 | 自动 / WebGL 着色器 / WebGPU ping-pong + 运行状态 |
| 主题 | 暖金圣诞 / 冰蓝雪夜 / 玫瑰微光 / 极光幻想 / 赛博全息 |
| 形态 | 爱心 / 五角星 / 雪花 / 花环 / 星云 / MERRY（手势 1–6 指同源） |
| 粒子 | 数量、流速、亮度、对比度、大小、辉光、照片尺寸、照片透明度 |
| 力场 | 关 / 排斥 / 吸引 / 涡旋 + 强度 + 脉冲冲击波 + 演示动效 |
| 照片 | 缩略图列表、单张隐藏/显示、删除、添加（多选） |
| 层级 | 粒子树、树顶星、光晕、照片、星空、飘雪、极光、银河雾、地面、雪地、笔迹、烟花 |
| 预设 | 保存本机、载入、导出 JSON、导入 JSON、粘贴 JSON 直接应用 |
| 导出 | 存图 PNG、录制 8 秒 WebM |

## 无摄像头的操作

- 移动指针 = 手掌位置（力场中心）
- 按住左键 = 握紧，力场强度 ×1.45
- `Shift` + 滚轮 = 力场强度（没开力场时自动切到吸引）
- `1`–`6` = 六种形态，`G` = 切力场，空格 = 脉冲冲击波，`E` = 开关编辑器

## URL 参数

`?field=1|2|3`（排斥/吸引/涡旋）、`?fieldSim=1`（力场自动巡演）、`?gpu=0`（强制 WebGL）、`?demo=1`（演示照片）、`?shape=heart|flake|...`、`?lang=en|zh`、`?debug=1`。

## 与技术方案的对应

已落地：三层语义（输入/感知 → 交互命令 → 渲染）、GPU 力场（排斥/吸引/涡旋/脉冲）、WebGPU ping-pong 粒子 compute、手势状态机 IDLE→CANDIDATE→ACTIVE→COOLDOWN 与优先级仲裁、多主题、场景预设、作品导出、工作室 HUD、类型契约、单测与 CI。

尚未落地（明确标注，不假装做了）：
- 以鼠标拖拽抓取照片星球（照片抓取仍依赖手部关键点）
- 纯 WebGPU 渲染管线（当前是 compute + 回读 + WebGL 渲染，材质没迁到 TSL）
- `engine.ts` 按模块拆分并补全内部类型（现在整体 `@ts-nocheck`）
- E2E 视觉回归（现在只有纯逻辑单测）
