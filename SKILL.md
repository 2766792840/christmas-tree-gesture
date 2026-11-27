---
name: christmas-tree-gesture
version: 1.0.0
description: 手势驱动的单文件 WebGL 粒子圣诞树（26k 粒子 / 五形态 / 360° 旋转 / 指尖 3D 粒子签名）。想要生成一棵可交互的圣诞树页面、或把「手势控制粒子」「指尖绘画」能力复用到别的网页时使用。
entry: index.html
tech: Three.js r160 + MediaPipe HandLandmarker + 自定义 ShaderMaterial
license: MIT
---

# Christmas Tree Gesture · 技能包

## 这个技能做什么

给定一句「做一棵能用手势玩的圣诞树」，输出一个**单文件、不依赖任何图片素材**的交互页面：

- 26,000 粒子的树 / 星云 / 爱心 / 雪花 / 五角星 / 文字 五种形态互转；
- 摄像头手势控制：握拳聚树、张开散开、手掌平移 360° 转、捏合缩放、食指放烟花、比耶换形态、OK 许愿；
- 食指当作笔，在 3D 空间里画出带纵深的发光签名，支持 7 色 + 彩虹渐变、逐笔换色混画、撤销/清空；
- 泛光、极光、飘雪、烟花、WebAudio 合成音乐、可编辑祝福卡、一键存图。

## 什么时候用

- 用户要「圣诞树网页 / 节日氛围页面 / 手势交互演示」；
- 用户想把「摄像头手势识别 → 3D 粒子反馈」搬到别的项目里；
- 用户想复刻「指尖作画」的交互（画画、签名、涂鸦墙）。

## 快速使用

```
index.html            # 直接用浏览器打开（需 https 或本地服务，否则摄像头被禁用）
```

- 在线：GitHub Pages 部署即为 https，摄像头可用；
- 本地：`python -m http.server 8765`，Windows 可双击 `tools/打开本地预览.cmd`。

## 能力清单（供调用方判断是否满足需求）

| 能力 | 入口 | 备注 |
| --- | --- | --- |
| 聚散 | 握拳 / 张开 / `空格` / `?spread=` | shader 内 `uSpread` 插值 |
| 换形态 | 比耶 / 数字键 `1`–`5` / `?shape=` | 两套 buffer `mix`，0.65 s |
| 360° 旋转 | 手掌平移 / 鼠标拖拽 / `?rot=` | 角度无限累积，无回弹 |
| 缩放 | 捏合 / 滚轮 | 相机 dist 15–46 |
| 烟花 | 食指 / 点击 / `f` | 粒子爆裂 |
| 画笔 | `p` / 顶栏「画笔」/ `?ink=1` | 食指落笔、握拳抬笔、OK 收工 |
| 存图 | `e` / 顶栏「存图」 | `toDataURL` 导出 PNG |
| 演示 | `d` / 顶栏「演示」 | 自动环绕 + 8 s 换形态 |

## 二次开发接口

- **配色**：`theme()` 返回当前主题色板（`orn / band / foA / foB / foC / star / fw`），改这里即换整棵树的配色。
- **形态**：`shapePoint(name, i, out, p)` 是形态采样函数，加一个 `else if (name === 'xxx')` 分支并在 `SHAPE_ORDER` 注册即可。
- **画笔**：`inkBegin(nx, ny, palm)` / `inkMove(...)` / `inkEnd()` / `inkUndo()` / `inkClear()`，坐标为屏幕归一化（0–1）。落笔层由 `INK.depth` 决定（世界 z 方向深度，−6.5…+6.5），`palm` 只做 ±2.5 的微调；`inkEnd()` 会在 `INK.autoDepth` 开启时自动 ±0.85 换层。`setDepth(v, true)` 手动换层并锁定自动换层；`INK.color` 支持 `'rainbow'` 或 `#rrggbb`，`cycleInkColor()` 用于手势换色。
- **手势阈值**：`analyze()` 内 `ext > 1.18`、`pinchD < 0.68`、`thumbAway > 1.55`；换手型/换摄像头可按 TESTING.md 第 4 节方法重新标定。
- **性能**：`perfTier` 三档；`?perf=0` 关闭自动降档。

## 嵌入其它页面的建议

单文件且无外部素材依赖，最省事的方式是 `iframe`：

```html
<iframe src="./christmas-tree-gesture/index.html?show=1&to=朋友"
        style="width:100%;height:100vh;border:0" allow="camera"></iframe>
```

注意 `allow="camera"` 必须带上，否则 iframe 内无法获取摄像头；跨域 iframe 需要目标站点允许 `camera` 权限策略。

## 质量约定

- 交付前必过 `node --check`；
- 涉及摄像头手感的改动，按 TESTING.md 第 5 节人工复测 7 项；
- 保持单文件、外部依赖只允许 CDN（Three.js / MediaPipe / 字体），不引入图片素材。
