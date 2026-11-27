---
name: christmas-tree-gesture
version: 1.2.0
description: 手势驱动的单文件 WebGL 粒子圣诞树（26k 粒子可调 / 六形态 / 数字手势 1–6 / 360° 旋转 / 照片管理可手势抓取 / 指尖 3D 粒子签名）。想要生成一棵可交互的圣诞树页面、或把「手势控制粒子」「指尖绘画」能力复用到别的网页时使用。
entry: index.html
tech: Three.js r160 + MediaPipe HandLandmarker + 自定义 ShaderMaterial
license: MIT
---

# Christmas Tree Gesture · 技能包

## 这个技能做什么

给定一句「做一棵能用手势玩的圣诞树」，输出一个**单文件、不依赖任何图片素材**的交互页面：

- 26,000 粒子（6,000–42,000 实时可调）的树 / 爱心 / 五角星 / 雪花 / 花环 / 星云 / 文字 六种形态互转；
- 摄像头手势控制：伸 1~6 根手指切换六个形态，握拳聚树，捏合缩放，食指放烟花，OK 许愿；手掌平移 360° 转；
- 照片管理：最多 10 张，缩略图面板增删，照片挂在树上并在散开时绕成环形；**捏合可以抓住任意一张照片拖着走，松手归位**；
- 粒子调节面板：数量 / 飘动速度 / 亮度 / 对比度 / 粒子大小 / 泛光六条滑杆，参数存 localStorage；
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
| 聚散 | 握拳 / 五指张开 / `空格` / `?spread=` | shader 内 `uSpread` 插值 |
| 换形态 | 1~6 根手指 / 数字键 `1`–`6` / `?shape=` | 两套 buffer `mix`，0.65 s；1 爱心 2 星 3 雪花 4 花环 5 星云 6 MERRY |
| 360° 旋转 | 手掌平移 / 鼠标拖拽 / `?rot=` | 角度无限累积，无回弹 |
| 缩放 | 捏合 / 滚轮 | 相机 dist 15–46；抓照片期间不缩放 |
| 照片 | 顶栏「照片」/ `?demo=1` / 拖文件进窗口 | 面板增删（最多 10 张），捏合可抓起拖动 |
| 调参 | 顶栏「调节」 | 6 条滑杆，`TUNE` + localStorage(`xmas-tune`) |
| 烟花 | 食指 / 点击 / `f` | 粒子爆裂 |
| 画笔 | `p` / 顶栏「画笔」/ `?ink=1` | 食指落笔、握拳抬笔、OK 收工 |
| 存图 | `e` / 顶栏「存图」 | `toDataURL` 导出 PNG |
| 演示 | `d` / 顶栏「演示」 | 自动环绕 + 8 s 换形态 |
| 调试 | `?debug=1` | `window.__xmas`：`analyze / TUNE / PHOTOGRAB / setShape / rebuildTree / tickPhotoGrab` |

## 二次开发接口

- **配色**：`theme()` 返回当前主题色板（`orn / band / foA / foB / foC / star / fw`），改这里即换整棵树的配色。
- **形态**：`shapePoint(name, i, out, p)` 是形态采样函数，加一个 `else if (name === 'xxx')` 分支并在 `SHAPE_ORDER / SHAPE_LABEL / FINGER_SHAPE` 三处注册即可（键盘与手指映射都跟着走）。
- **粒子参数**：`TUNE_DEFAULT`（默认值）/ `TUNE`（当前值），改量走 `applyTune` 语义的那段监听；数量变化由 `rebuildTree(n)` 重建（会迁移照片组、笔画组并重绑 `uSpread/uScale`）。
- **照片**：`PHOTO_MAX` + `PHOTO_SLOTS`（程序化 10 个挂位，`{a 角度, h 高度, s 尺寸}`）、`addPhoto(img, src)` / `removePhoto(sp)` / `renderPhotoPanel()`；抓取状态在 `PHOTOGRAB`（屏幕空间命中阈值 `0.13`，跟随阻尼 `1-e^{-10dt}`，放大 1.42×）。
- **手势阈值**：`analyze()` 内 `ext > 1.16`、`pinchD < 0.68`、`thumbStraight > 1.26`、拇指/食指离腕 `>0.9 / >1.05` 掌宽；数字手势保持时长在 `handShapeTick(label, now, holdMs=750)`，换形态冷却 1500 ms。重新标定的方法见 TESTING.md 第 4 节。
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
- 涉及摄像头手感的改动，按 TESTING.md 第 6 节人工复测 12 项；
- 保持单文件、外部依赖只允许 CDN（Three.js / MediaPipe / 字体），不引入图片素材。

