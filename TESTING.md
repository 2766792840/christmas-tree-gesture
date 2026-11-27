# 测试报告 · Christmas Tree 手势粒子圣诞树

本文记录本项目的自测范围、方法、结果与已知限制。所有用例均可复现，命令与截图路径见文末。

## 1. 测试环境

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-27（v1.0） / 2026-11-27 晚（v1.2 升级） |
| 宿主机 | Windows 11（本地 PC） |
| 渲染/截图（v1.0） | Chrome headless（`--headless=new` + SwiftShader 软件渲染） |
| 渲染/截图（v1.2） | Microsoft Edge（`--remote-debugging-port=9222`）+ CDP 驱动（`Page.captureScreenshot`，1280×720） |
| 静态服务 | `http://127.0.0.1:8765`（`tools/serve.ps1`） / 8781（测试用 Node 静态服务） |
| 语法校验 | Node.js `node --check`（抽取 `<script type="module">` 全文） |
| 手势样本（v1.0） | 17 张真实手部照片（张开 5 / 握拳 3 / 比耶 3 / OK 5，另 1 张异常角度） |
| 手势样本（v1.2） | 9 组合成 21 点关键点（1~6 指 / 握拳 / 捏合 / OK），经 `?debug=1` 暴露的 `analyze()` 直接喂入 |
| 真实手势 | 需人工站在摄像头前完成，见「需人工复测项」 |

> 说明：headless 与 CDP 环境都没有真实摄像头，涉及摄像头的用例只验证「链路是否可用 + 识别阈值回归」，手感类项目留给人工复测。v1.2 的数字手势与抓照片用**合成关键点**做判据回归（可确定性地重复，不依赖照片样本）。

## 2. 自动化校验

| ID | 用例 | 方法 | 预期 | 结果 |
| --- | --- | --- | --- | --- |
| A-01 | ES Module 语法 | 抽取主脚本 → `node --check` | 退出码 0，无解析错误 | ✅ 通过（exit=0） |
| A-02 | 页面可达 | `Invoke-WebRequest` 取 `index.html` | HTTP 200，长度 ≈ 114 KB | ✅ 通过（200 / 113 297 B） |
| A-03 | 无引导弹层渲染 | `?show=1&spread=0&perf=0` 截图 | 树形完整、HUD 不被遮挡 | ✅ 通过（`assets/screenshots/01-tree.png`） |
| A-04 | 爱心形态 | `?shape=heart&perf=0` 截图 | 心形轮廓闭合、配色为暖橙→红 | ✅ 通过（`02-heart.png`） |
| A-05 | 画笔示例（正面） | `?ink=1&perf=0` 截图 | 红波浪 + 青心形两笔不同色，笔迹连续 | ✅ 通过（`03-ink-front.png`） |
| A-06 | 画笔立体性 | `?ink=1&rot=1.2` 截图 | 签名随视角侧转，出现纵深、非平面贴图 | ✅ 通过（`04-ink-3d.png`） |
| A-07 | 聚拢态共存 | `?ink=1&spread=0` 截图 | 树与签名同时存在、笔迹形状不被破坏 | ✅ 通过 |
| A-08 | 三笔分层立体 | `?ink=1&spread=1` 截图 | 三笔落在三个不同深度 / 不同角度的平面，互相穿插 | ✅ 通过（`03-ink-front.png`） |
| A-09 | 转视角后笔迹仍在正确位置 | 同一画面 `?rot=1.15` 截图 | 金环侧转成椭圆、波浪缩短、心形变窄，三平面关系成立 | ✅ 通过（`04-ink-3d.png`） |
| A-10 | 落笔层参考环 | 画笔模式截图 | 画面中可见淡色圆环，随深度前后移动 | ✅ 通过 |

## 3. 本轮修复的回归项（针对用户反馈）

| ID | 反馈 | 处理 | 验证 |
| --- | --- | --- | --- |
| R-01 | 画笔不好用、不够顺 | 指尖坐标一阶低通（k=0.38，断笔后 k=1 直接贴合）；落笔节流 28 ms → 16 ms；位移 < 0.0016（归一化）视为抖动丢弃 | 采样点密度提升、无锯齿跳点；需人工确认手感 |
| R-02 | 粒子粗糙（串珠感） | 插值步长 0.045 → 0.022；抖动 ±0.11 → ±0.045；尺寸改为「主体 0.085–0.2 + 14 % 光晕点 0.24–0.36」；片元改为「柔和外晕 + 细小硬核」两段幂函数；点数上限 46k → 92k（移动端 56k） | 形状可辨、边缘柔和（`03-ink-front.png`） |
| R-03 | 画完后散开/缩放不与粒子同步 | 画笔材质共享树的 `uSpread` / `uScale`：散开时整体扩散 1.12 倍 + 同频漂移（幅度 0.03→0.21），聚回时还原；点尺寸随 `uScale` 与视距变化，与树一致 | `03`（散开态）与 `04`（旋转态）均正常 |
| R-04 | 撤销/清空会卡一下 | 去掉撤销与清空时的全量缓冲上传（`INK_MAX*3` 个 float），仅改 `drawRange` | 静态审查确认不再有大块 upload |
| R-05 | 调试截图不可信（morph/damp 不推进） | 新增 `?spread=`（含 0）锁定、`?rot=` 初始角；`?shape=` 直接烘焙 buffer 不做过渡 | 截图可按参数稳定复现 |
| R-06 | 只有平面绘画，转了画不了、缺少维度 | 落笔改为「屏幕射线 × 视角前方深度平面」求交（世界坐标）后再转局部，任意旋转角都能在眼前这一层落笔；新增 `INK.depth` 分层（抬笔自动 ±0.85 往返，滚轮 / ↑↓ / 按钮手动）、落笔层参考环、每采样点扩成 2–3 粒粒子簇（体积感）；画笔模式下比耶改为换笔色 | A-08 / A-09 / A-10 通过；真实手感待人工复测 |

## 4. 手势判据回归（v1.2 数字手势）

判据实现（`analyze()` 内）：

```
ext[i]        = d(P(tip_i), P(0)) / d(P(pip_i), P(0)) > 1.16          // 各指伸展
pinchD        = d(P(4), P(8)) / palm                                  // 拇指-食指指尖
palm          = d(P(5), P(17))                                        // 掌宽
thumbStraight = d(P(4), P(0)) / d(P(3), P(0)) > 1.26                  // 拇指是否伸直
thumbSide     = (P5.y - P4.y) > 0.015 || |P4.x - P5.x| > 0.75 * palm  // 指尖高于食指根 / 明显外撇
pinching      = pinchD < 0.68 && d(P4,P0)/palm > 0.9 && d(P8,P0)/palm > 1.05
thumbUp       = thumbStraight && thumbSide && !pinching
```

判定顺序（`cnt` = 四指伸出根数）：

```
ok        = pinching && 中指/无名指/小指都伸
pinch     = pinching
six       = thumbUp && 仅小指伸
point     = cnt==1 && 食指
two       = cnt==2
three     = cnt==3
four      = cnt==4 && !thumbUp
five      = cnt==4 && thumbUp
fist      = cnt==0 && !thumbUp
```

<details>
<summary>为什么 v1.0 的 thumbAway &gt; 1.55 被替换（v1.2 实测记录）</summary>

v1.0 用 `thumbAway = d(拇指尖, 小指根)/掌宽 > 1.55` 作为「拇指外伸」。补做数字手势时发现它的两个问题：

1. **四指伸出会被误判成五指**：四指伸直时小指根（P17）相对拇指尖的归一化距离就超过 1.55，`thumbUp` 直接为真 → 4 指被识别成 5 指（合成样本实测：4 指 ext=4/4 时 thumbUp=1，判成 five）。
2. **OK 手势被判成三指**：OK 的拇指指尖是弯向食指的，`thumbStraight` 明显为假，而 `pinchD` 极小（0.08），只看 `thumbAway>1.4` 会漏掉真实的 OK（合成样本实测：mask=中指+无名指+小指、pinchD=0.08 时仍判 three）。

改成「三条一起判」后：捏合不再依赖拇指"外伸度"，而是「指尖贴合 + 拇指没缩进掌心 + 食指没缩回掌心」，握拳的 `d(拇指尖,手腕)/掌宽 ≈ 0.45` 天然被排除。回归结果见下表（9/9 通过，替换前为 7/9）。

</details>

| 合成样本 | 期望标签 | 实测 | 关键量 |
| --- | --- | --- | --- |
| 1 指（拇指收） | point | ✅ point | ext=1/4, thumbUp=0 |
| 2 指 | two | ✅ two | ext=2/4 |
| 3 指 | three | ✅ three | ext=3/4 |
| 4 指（拇指收） | four | ✅ four | ext=4/4, thumbUp=0 |
| 5 指（拇指伸） | five | ✅ five | ext=4/4, thumbUp=1 |
| 6 指（拇指+小指） | six | ✅ six | ext=1/4, thumbUp=1 |
| 握拳 | fist | ✅ fist | ext=0/4, conf=1.00 |
| 捏合 | pinch | ✅ pinch | pinchD=0.08 |
| OK（拇指抵食指、另三指伸） | ok | ✅ ok | pinchD=0.08, conf=0.86 |

### 4.1 手势 → 形态联动（模拟「保持 2 秒」）

| 手势 | 期望形态 | 实测 | 结果 |
| --- | --- | --- | --- |
| 1 指 | heart | heart | ✅ |
| 2 指 | star | star | ✅ |
| 3 指 | flake | flake | ✅ |
| 4 指 | wreath（本轮新增） | wreath | ✅ |
| 5 指 | galaxy | galaxy | ✅ |
| 6 指 | text | text | ✅ |

> 联动测试同时验证了节流：`labelSince` 满 2 s 且 `S.lastShapeAt=0` 时才换形态；实测 6 组全部按预期切换，且没有出现「1→5 指过渡时连切 5 次」的抖动。

## 5. 升级项自测（v1.2：照片管理 / 粒子滑杆 / 花环 / 抓照片）

方法：Edge + CDP 驱动真实页面（1280×720、dpr=1），用 `Runtime.evaluate` 直接派发 `input` 事件与点击，读 `?debug=1` 暴露的内部状态；截图逐张人眼复核。

| ID | 用例 | 方法 | 预期 | 结果 |
| --- | --- | --- | --- | --- |
| U-01 | 面板与控件挂载 | 读 DOM：`#tunePanel / #photoPanel / #btnTune` | 三者都存在，6 个形态 chip、6 个滑杆、9 个手势 chip | ✅ 6 chips / 6 sliders / 9 gchips |
| U-02 | 调节面板开合 | 点「调节」→ 读 `.show` | 面板展开；再点收起；开画笔时自动收面板 | ✅ 开合正常 |
| U-03 | 粒子数量重建 | 拖 `rngCount` 到 42,000 → 等 1.4 s | 标签同步 42000，geometry 重建，无异常、无黑屏 | ✅ 无异常（runtime exceptions=0），画面正常 |
| U-04 | 重建后形态保持 | 重建时处于星云态 | 形态、照片、笔迹都还在，`uSpread` 不跳变 | ✅ 照片仍挂树上，形态未丢 |
| U-05 | 亮度/对比度/速度/大小/泛光 | 5 条滑杆同时拉高 | 标签即时更新（1.70 / 1.45 / 1.85× / 1.41 / 1.10），画面变亮变锐 | ✅ 见 `_v2_tuned.png` |
| U-06 | 恢复默认 | 点「恢复默认」 | 数量回 26000，其余回 1.00 / 0.55，重建一次 | ✅ vCount=26000 |
| U-07 | 照片增删 | `?demo=1` 自动挂 3 张 → 点缩略图右上 × | 计数 3/10 → 2/10，缩略图网格同步，贴图与 objectURL 释放 | ✅ 3→2，无异常 |
| U-08 | 新形态花环 | `?shape=wreath` 截图 | 环带中心留空、常青绿 + 红浆果 + 金亮点、顶部红蝴蝶结 | ✅ 见 `_shape_wreath.png`（两版迭代后定稿） |
| U-09 | 键盘 1–6 | 依次派发 keydown `1..6` | 依次 heart / star / flake / wreath / galaxy / text | ✅ 6/6 |
| U-10 | 照片手势抓取 | 投影第 1 张照片到屏幕 → 喂捏合指尖 → 调用 `tickPhotoGrab` | 抓住该张（`PHOTOGRAB.sp === sp`） | ✅ grabIndex=0 |
| U-11 | 抓取跟随 | 移动指尖 30 帧 | 照片跟随移动（位移 4.19 世界单位）、放大 1.42× | ✅ moved=4.19 |
| U-12 | 松手归位 | 手势切到 none 跑 120 帧 | `PHOTOGRAB.sp=null`，位置回到挂点（误差 0.000） | ✅ distToHome=0.000 |
| U-13 | 抓照片时不抢镜头缩放 | 抓取中喂 pinch | `S.distT` 保持 27 不变 | ✅ distT=27.0 |
| U-14 | 帧率（改后回归） | 1280×720 dpr=1 采样 1.6 s | ≥ 50 fps（合成负载下） | ✅ 74 fps |
| U-15 | 语法 | `node --check` 抽取模块脚本 | exit=0 | ✅ exit=0 |
| U-16 | 全页异常 | 整个测试流程监听 `Runtime.exceptionThrown` / `Log.error` | 0 条 | ✅ 仅 `favicon.ico` 404（非功能性） |

> 说明：U-03 的 42,000 粒子是桌面步进上限；`rebuildTree()` 会先摘掉照片组与笔画组、重建 geometry、再把两者挂回新树并重绑 `uSpread/uScale`，这也是 U-04 能通过的原因。

## 6. 需人工复测项（摄像头相关）

以下项目 headless 无法覆盖，请在真实浏览器（建议 `https://` 或 `http://127.0.0.1`）逐条确认：

1. 食指落笔：笔尖是否跟随指尖、无延迟拖影；
2. 握拳抬笔：笔画是否立即断开，不会连成一片；
3. OK 收工：退出画笔后作品是否保留、可继续旋转；
4. 换色续画：第一笔红色 → 切换青色 → 第二笔是否独立着色；
5. 手掌横移转圈：左右各转一整圈是否顺滑、是否出现回弹；
6. 捏合缩放：从最远到最近是否一次行程走完，无卡顿；
7. 双人/双手：双手张合缩放是否稳定，不误触发换形态；
8. **立体绘画**：画完第一笔（自动换层）再画第二笔，两笔是否在不同前后层；张开手掌转到侧面后继续画，新笔迹是否落在侧对视角的那一层，且与旧笔迹交叉；
9. **参考环**：滚轮 / ↑↓ / 面板按钮改深度时，圆环是否前后移动、笔迹是否跟着落在该层；
10. **数字手势 1–6**：连续从 1 伸到 5 再收回，是否只在停稳后切换一次（不应连续切 5 次）；
11. **照片抓取**：捏合对准照片（尤其背面/侧面那几张）是否能抓住、拖动是否跟手、松手是否飞回原位；抓取期间镜头不应忽远忽近；
12. **照片管理**：真实照片（非 demo 图）添加/删除后，树上的相框是否即时出现/消失，内存是否不会越用越多（DevTools Memory 面板看 DOM/纹理计数）。

## 7. 性能

| 项 | 设定 |
| --- | --- |
| 像素比 | `min(devicePixelRatio, 1.5)`，低端档 1.2 |
| bloom | strength 0.55 / radius 0.45 / threshold 0.46，分辨率 0.62× |
| 降档策略 | 连续 2 次采样 fps < 42 才降一档：1.5 → 1.15 → 1.0（最低档关 bloom） |
| 手势推理 | 每 55 ms 一次，与渲染解耦 |
| 画笔上传 | 仅脏区间 `addUpdateRange`，单次 ≤ 52 个采样点 |

headless + SwiftShader 下的帧率不代表真机，未做量化记录；建议在目标机器上开启 `?perf=0` 与默认模式各观察 30 s。

## 8. 已知限制

- **`file://` 无法使用摄像头**：浏览器安全策略，需本地服务或 https；页面已内置 `isSecureContext` 检测并提示。
- 首次加载依赖 CDN（Three.js / MediaPipe / 模型 / 字体），离线不可用；模型约 7.8 MB。
- 手部模型对逆光、极近贴脸、遮挡严重（戴厚手套）识别率下降，属上游模型限制。
- 单文件为刻意设计，未做代码分割；`index.html` 约 134 KB。
- 数字手势的阈值（`ext` 1.16 / `thumbStraight` 1.26 / `pinchD` 0.68）只用 9 组合成关键点回归过，**真实手型（尤其小屏、近距离、手掌侧对镜头）仍需人工校准**；如果你那边 4 指总被认成 5 指，优先调 `thumbStraight` 的 1.26。
- 照片挂位固定 10 个（`PHOTO_MAX`），超出提示先删；挂位是程序化环形分布，暂不支持手动摆放单张照片的位置。
- 粒子数量重建（拉到 42,000）会有约 0.2–0.5 s 的卡顿（重建 geometry + 全部 buffer 重算），目前没有做渐进式重建。
- 画笔点数有上限（桌面 92k / 移动 56k），超出后新笔迹不再记录（当前无提示，后续可加）。

## 9. 复现命令

```powershell
# 1) 起本地服务
powershell -NoProfile -ExecutionPolicy Bypass -File tools/serve.ps1

# 2) 语法校验
$html = Get-Content -Raw index.html
$open = '<script type="module">'; $s = $html.IndexOf($open); $e = $html.IndexOf('</script>', $s)
Set-Content -Path "$env:TEMP\chk.mjs" -Value $html.Substring($s + $open.Length, $e - $s - $open.Length) -Encoding UTF8
node --check "$env:TEMP\chk.mjs"

# 3) headless 截图（示例：画笔正面）
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --headless=new --no-first-run --no-sandbox --enable-unsafe-swiftshader `
  --user-data-dir="$env:TEMP\xmas_headless_profile" --hide-scrollbars `
  --window-size=1600,1000 --virtual-time-budget=15000 `
  --screenshot="$env:USERPROFILE\shot.png" `
  "http://127.0.0.1:8765/index.html?ink=1&perf=0&hide=fw"
```

## 10. 结论

v1.0 的核心链路（渲染、形态过渡、360° 旋转、立体画笔、散开同步）保持通过；v1.2 的四项升级（照片增删管理、粒子参数滑杆、1–6 指切换六个形态、捏合抓取照片）在 CDP 驱动下 16 条用例全绿，页面无运行时异常，1280×720/dpr1 合成负载 74 fps。与摄像头手感相关的项（第 6 节 12 条）仍需真人站在摄像头前确认，其中数字手势的阈值最可能需要按你的手型微调——发现问题请附「手势 + 现象 + 控制台报错」提交 Issue。

