/** 中英文案字典 + 运行时翻译。中文是源码语言，英文是展示语言。 */

export type Lang = 'zh' | 'en';

type Dict = Record<string, string>;

/** 静态 UI（index.html）+ 编辑器面板 + 引擎提示语 */
const EN: Dict = {
  'Aurora Tree Studio V2 · 手势粒子圣诞树': 'Aurora Tree Studio V2 · Gesture-driven Particle Tree',
  '用摄像头手势点亮一棵由 26000 颗星尘聚成的圣诞树':
    'Light up a Christmas tree made of 26,000 stardust particles with camera gestures',
  // ---------- 顶栏 ----------
  '手势': 'Gestures',
  '照片': 'Photos',
  '音乐': 'Music',
  '全屏': 'Fullscreen',
  '净屏': 'Clean',
  '分享': 'Share',
  '存图': 'Snapshot',
  '演示': 'Demo',
  '画笔': 'Brush',
  '调节': 'Tune',
  '工作室': 'Studio',
  '挂上一张照片': 'Hang a photo',
  '净屏观赏': 'Clean view',
  '复制分享链接': 'Copy share link',
  '保存为图片': 'Save as image',
  '演示模式：环绕运镜 + 形态轮播': 'Demo: orbiting camera + shape carousel',
  '粒子签名：食指作笔，握拳抬笔': 'Particle ink: index draws, fist lifts',
  '粒子调节：数量 / 速度 / 亮度 / 对比度': 'Tune particles: count / speed / brightness / contrast',
  'V2 工作室：主题 / 力场 / 预设 / 录制': 'V2 Studio: theme / field / presets / record',
  '切换语言 / Switch language': 'Switch language / 切换语言',

  // ---------- 主题 ----------
  '暖金圣诞': 'Warm Gold',
  '极光幻想': 'Aurora Dream',
  '赛博全息': 'Cyber Holo',
  '冰蓝雪夜': 'Ice Blue',
  '玫瑰微光': 'Rose Glow',

  // ---------- 首屏卡 ----------
  '亲爱的你': 'Dear You',
  '让散落的光，': 'Let the scattered light,',
  '为你聚成一棵树': 'gather into a tree for you',
  '一颗颗星尘从银河里醒来，落在你面前。抬起手，它会回应你。':
    'Stardust wakes from the galaxy and lands before you. Raise a hand — it answers.',
  '食指': 'Index',
  '爱心': 'Heart',
  '· 爱心（举 1 秒生效）': '· Heart (hold 1s)',
  '两指比耶': 'Two-finger V',
  '· 五角星': '· Star',
  '三指': 'Three fingers',
  '· 雪花': '· Snowflake',
  '四指': 'Four fingers',
  '· 花环': '· Wreath',
  '五指张开': 'Five fingers spread',
  '· 星云（拇指要翘出来，别贴着手掌）': '· Nebula (thumb out, away from the palm)',
  '拇指+小指（沙卡）': 'Thumb + pinky (shaka)',
  '· MERRY 文字': '· MERRY text',
  '捏合': 'Pinch',
  '· 推拉镜头 / 抓住照片星球拖动': '· Push/pull zoom / drag a photo orb',
  '握拳': 'Fist',
  '· 星尘收拢成树': '· Stardust gathers into a tree',
  '摄像头小窗会实时显示「指 11111 · 拇指 62°开」，识别不对时看一眼这串数字就知道是哪根手指的问题。':
    'The preview shows a live finger readout (11111 · thumb 62° open) — that number tells you which finger was misread.',
  '开启摄像头 · 手势互动': 'Enable camera · gesture play',
  '仅用鼠标 / 触摸': 'Mouse / touch only',
  '摄像头画面只在你的浏览器里实时运算，不上传、不保存。没有摄像头也能玩：拖拽旋转、滚轮缩放、点击放烟花、空格切换聚散。':
    'Video is processed locally in your browser — never uploaded or stored. No camera? Drag to rotate, scroll to zoom, click for fireworks, space to gather/scatter.',
  '没有摄像头也能玩：拖拽旋转、滚轮缩放、点击放烟花、空格切换聚散。':
    'No camera needed: drag to rotate, scroll to zoom, click for fireworks, space to gather/scatter.',
  '愿这棵树上的每一束光，都替我说一句：圣诞快乐。':
    'May every beam on this tree say it for me: Merry Christmas.',
  '点击任意处收起': 'Tap anywhere to close',

  // ---------- 手势 / 形态条 ----------
  '✊ 握拳': '✊ Fist',
  '😉 1 指': '☝ 1 finger',
  '☝ 1 指': '☝ 1 finger',
  '✌ 2 指': '✌ 2 fingers',
  '🖖 3 指': '🖖 3 fingers',
  '🖕 4 指': '🖕 4 fingers',
  '🖐 5 指': '🖐 5 fingers',
  '🤘 6 指': '🤘 6 fingers',
  '🤏 捏合': '🤏 Pinch',
  '🙌 双手': '🙌 Both hands',
  '🤏 照片浮成星云球，捏合可抓住任意一颗；👁 隐藏 / × 删除 / 点缩略图看大图。':
    '🤏 Photos float as orbs — pinch to grab any of them; 👁 hide / × delete / tap a thumbnail to enlarge.',
  '♥ 爱心': '♥ Heart',
  '★ 五角星': '★ Star',
  '❄ 雪花': '❄ Snowflake',
  '❂ 花环': '❂ Wreath',
  '✦ 星云': '✦ Nebula',
  '五角星': 'Star',
  '雪花': 'Snowflake',
  '花环': 'Wreath',
  '星云': 'Nebula',
  '聚成树': 'To tree',
  '缩放 / 抓照片': 'Zoom / grab photos',
  '缩放满屏': 'Zoom to full',
  '双手缩放': 'Two-hand zoom',
  '待手势': 'Waiting',
  '等待手势': 'Waiting for hands',
  '拖动视角': 'Drag to look around',
  '拖拽旋转 · 滚轮缩放 · 点击放烟花 · 空格切换聚散':
    'Drag to rotate · scroll to zoom · click for fireworks · space to gather/scatter',

  // ---------- 调节 / 力场 ----------
  '粒子数量': 'Particles',
  '飘动速度': 'Drift speed',
  '亮度': 'Brightness',
  '对比度': 'Contrast',
  '粒子大小': 'Particle size',
  '泛光强度': 'Bloom',
  '辉光强度': 'Bloom',
  '照片大小': 'Photo size',
  '照片尺寸': 'Photo size',
  '照片透明度': 'Photo opacity',
  '恢复默认': 'Reset',
  '力场 / FIELD': 'FIELD',
  '力场 关 · 强度 1.0': 'Field off · power 1.0',
  '关': 'Off',
  '排斥': 'Repel',
  '吸引': 'Attract',
  '涡旋': 'Vortex',
  '强度': 'Power',
  '力场说明': 'Field guide',
  '脉冲冲击波': 'Pulse',
  '力场：排斥=粒子逃离手掌，吸引=涌向掌心，涡旋=绕手掌旋转；脉冲=一圈向外扩散的冲击波':
    'Field: repel pushes particles away, attract pulls them into a glowing shell, vortex spins them around your palm; pulse is an outward shockwave.',
  '脉冲冲击波 · 从掌心向外扩散': 'Pulse · shockwave from your palm',
  '力场 · 吸引 · 强度 1.00': 'Field · attract · power 1.00',

  // ---------- 预设 / 录制 ----------
  '场景预设 / PRESET': 'PRESET',
  '保存当前': 'Save scene',
  '载入预设': 'Load scene',
  '导出配置': 'Export config',
  '录制 8 秒': 'Record 8s',
  '录制 8 秒：试试比耶开花 + 手掌推粒子': 'Record 8s: try a peace-sign bloom + palm push',
  '配置已导出': 'Config exported',
  '配置已导出 JSON': 'Config exported as JSON',
  '预设已保存到本机（下次打开可载入）': 'Scene saved locally (loadable next time)',
  '预设已载入': 'Scene loaded',
  '还没有保存过预设，先点「保存当前」': 'No saved scene yet — hit “Save scene” first',
  '录制会抓取画布实时画面，8 秒自动停止并下载。':
    'Recording captures the canvas live; it stops and downloads after 8 seconds.',

  // ---------- 编辑器 ----------
  '场景编辑器 · V2.2': 'Scene editor · V2.2',
  '场景编辑器 · V2.1': 'Scene editor · V2.2',
  '场景编辑器': 'Scene editor',
  '输入源': 'Input',
  '鼠标': 'Mouse',
  '鼠标 / 触屏': 'Mouse / touch',
  '摄像头手势': 'Camera gestures',
  '摄像头已开启 · 手势控制中': 'Camera on · gesture control',
  '未开摄像头 · 鼠标当手（自动生效）': 'No camera · mouse acts as your hand (auto)',
  '已切到鼠标手势：移动鼠标就是手掌': 'Switch to mouse hand: moving the mouse is your palm',
  '没有摄像头时，鼠标就是你的手：移动=手掌位置，按住左键=握紧加力，Shift+滚轮=力场强度。':
    'Without a camera the mouse is your hand: move = palm position, hold left = grip harder, Shift + wheel = field power.',
  '渲染后端': 'GPU backend',
  '自动': 'Auto',
  'WebGL 着色器': 'WebGL shaders',
  'WebGPU ping-pong': 'WebGPU ping-pong',
  '运行中 · WebGPU ping-pong compute': 'Running · WebGPU ping-pong compute',
  '未初始化（桌面端自动尝试）': 'Not ready (auto on desktop)',
  '已就绪但当前走 WebGL 着色器路径': 'Ready, currently rendering through WebGL shaders',
  '不可用：': 'Unavailable: ',
  'WebGPU 模式：粒子位置由 compute shader 双缓冲积分，算完异步读回给 WebGL 渲染；不支持时自动回落。':
    'WebGPU mode: particle positions are integrated in a compute shader with double buffering, then read back asynchronously for WebGL rendering. Falls back automatically.',
  '主题': 'Theme',
  '形态': 'Shape',
  '手势 1–6 指也能切同样的形态；握拳回到圣诞树。':
    'Finger counts 1–6 trigger the same shapes; a fist brings the tree back.',
  '粒子参数': 'Particles',
  '流动速度': 'Drift speed',
  '力场': 'Force field',
  '演示动效：虚拟手掌绕着树推粒子': 'Demo motion: a virtual palm pushes particles around the tree',
  '演示动效已关': 'Demo motion off',
  '照片星球': 'Photo orbs',
  '每张照片是一颗记忆球：可隐藏、可删除；伸手能把它抓出来。':
    'Each photo is a memory orb: hide it, delete it, or reach out and grab it.',
  '还没有照片。加几张，它们会绕着树浮成星球。':
    'No photos yet. Add a few and they will float around the tree as orbs.',
  '层级可见性': 'Layer visibility',
  '粒子树': 'Particle tree',
  '树顶星': 'Topper star',
  '树顶光晕': 'Halo',
  '3D 笔迹': '3D ink',
  '星空': 'Stars',
  '飘雪': 'Snowfall',
  '极光': 'Aurora',
  '银河雾': 'Galaxy haze',
  '雪地底盘': 'Snow ground',
  '地面微光': 'Ground glow',
  '烟花': 'Fireworks',
  '显示': 'Show',
  '隐藏': 'Hide',
  '关闭': 'Close',
  '导出': 'Export',
  '应用': 'Apply',
  '当前场景配置会显示在这里，也可以粘一份 JSON 进来点「应用」':
    'The current scene JSON shows here — paste a config and hit Apply.',
  '文件解析失败': 'File could not be parsed',
  'JSON 解析失败': 'Invalid JSON',
  '已应用 JSON 配置': 'JSON config applied',
  '已导入场景配置': 'Scene config imported',
  '这张图读不出来': 'This image cannot be read',
  '这张图片读不了': 'This image cannot be read',
  '照片已恢复显示': 'Photo restored',

  // ---------- 引擎运行时 ----------
  '抬起手掌，这棵树会回应你': 'Raise your palm — the tree will answer',
  '手势模型就绪，把手抬到镜头前': 'Hand model ready — raise your hand to the camera',
  '摄像头已开 · 正在加载手势模型…': 'Camera on · loading hand model…',
  '摄像头已开 · 正在加载手势模型（首次约 10–30 秒）':
    'Camera on · loading hand model (10–30s on first run)',
  '正在请求摄像头权限…': 'Requesting camera permission…',
  '正在唤醒摄像头…': 'Waking up the camera…',
  '模型就绪 · 正在等待画面…': 'Model ready · waiting for frames…',
  '模型就绪 · 未检测到手（把手抬进画面，离镜头 40–80cm）':
    'Model ready · no hand detected (keep your hand in frame, 40–80cm away)',
  '模型就绪，但摄像头画面没出数据（可能被别的程序占用）':
    'Model ready, but the camera returns no frames (another app may hold it)',
  '手势模型没加载出来，检查网络后重试': 'Hand model failed to load — check network and retry',
  '摄像头权限被拒绝，可以在浏览器地址栏重新允许':
    'Camera permission denied — re-allow it from the address bar',
  '没能打开摄像头，先用鼠标/触摸玩吧': 'Camera unavailable — play with mouse/touch instead',
  '摄像头没打开，可以用鼠标交互': 'Camera off — mouse interaction still works',
  '这个浏览器/环境不支持摄像头': 'Camera is not supported in this browser',
  '检测到': 'Detected',
  '只手 · 指': 'hands · fingers',
  '双手缩放优先': 'Two-hand zoom takes priority',
  '照片抓取优先': 'Photo grab takes priority',
  '手势已开启': 'Gestures on',
  '手势已关闭': 'Gestures off',
  '开启失败 · 可重试': 'Failed to start · retry available',
  '冷却中': 'Cooling down',
  '画笔已开 · ☝食指落笔，✊握拳抬笔；每笔自动换一层，滚轮/↑↓ 手动换层':
    'Brush on · ☝ index draws, ✊ fist lifts; each stroke moves up a layer, wheel/↑↓ to change layer',
  '画笔占用 · 形态锁定': 'Brush active · shape locked',
  '自动换层：已开': 'Auto layer: on',
  '自动换层：已锁': 'Auto layer: locked',
  '签名已清空': 'Ink cleared',
  '已撤回一笔': 'Last stroke undone',
  '还没有笔画可以撤销': 'No strokes to undo',
  '下一笔生效': 'Applies to the next stroke',
  '渐变彩笔 · 一笔多色': 'Rainbow brush · multicolor stroke',
  '笔色': 'Brush color',
  '示例 · 三笔落在三个不同层与角度，转起来看是立体的':
    'Sample · three strokes on three layers and angles — rotate to see depth',
  '收工 · 作品留在三维里，转动视角去看它的前后层次':
    'Done · the piece stays in 3D; rotate to see its depth',
  '抓住一颗照片星球 · 移动手掌带着走，松手归位':
    'Grab a photo orb · carry it with your palm, it returns when you let go',
  '已隐藏这张 · 粒子区域更干净了': 'Photo hidden · cleaner particle field',
  '删除这张': 'Delete this',
  '隐藏这张': 'Hide this',
  '显示这张': 'Show this',
  '照片已挂上树 🎄 共': 'Photos on the tree 🎄 total',
  '照片已移除 · 还剩': 'Photo removed · remaining',
  '挂位已满（最多': 'Slots full (max',
  '张，先删一张再添加吧': '— delete one before adding)',
  '张），先在照片面板删掉一张': '— remove one in the photo panel first)',
  '张 · 点 ◌ 可恢复显示': '— tap ◌ to show again',
  '没有读到图片': 'Image could not be read',
  '图片读取失败': 'Image load failed',
  '已保存到下载文件夹': 'Saved to your Downloads folder',
  '已导出 webm · ': 'WebM exported · ',
  '这个浏览器不支持录制，用系统录屏吧': 'Recording is unsupported here — use system capture',
  '浏览器不允许导出，可以用系统截图': 'Export blocked by the browser — take a screenshot instead',
  '录制失败：': 'Recording failed: ',
  '正在生成图片…': 'Generating image…',
  '链接已复制，发给那个人吧 🔗': 'Link copied — send it to that person 🔗',
  '复制失败，可手动复制地址栏': 'Copy failed — copy the address bar manually',
  '全屏被浏览器拦下了': 'Fullscreen was blocked by the browser',
  '净屏观赏中 · 右侧可退出': 'Clean view · exit on the right',
  '演示模式 · 镜头环绕 · 每 8 秒换一种形态': 'Demo · orbiting camera · new shape every 8s',
  '演示模式已关闭': 'Demo off',
  '粒子参数已恢复默认': 'Particles reset to defaults',
  '已降低渲染精度以保证流畅': 'Render quality lowered to stay smooth',
  '已关闭泛光以保证流畅': 'Bloom disabled to stay smooth',
  'WebGPU 已启用 · 粒子物理走 ping-pong compute': 'WebGPU on · physics runs in ping-pong compute',
  'WebGPU 初始化失败': 'WebGPU init failed',
  'WebGPU 设备不可用': 'WebGPU device unavailable',
  '浏览器无 WebGPU': 'Browser has no WebGPU',
  'k 粒子': 'k particles',
  '● 录制中 · 点此停止': '● Recording · tap to stop',
  '☝ 1 指 · 烟花 / 爱心': '☝ 1 finger · fireworks / heart',
  '✊ 握拳 · 收成树': '✊ Fist · back to the tree',
  '✌ 2 指 · 五角星': '✌ 2 fingers · star',
  '🖖 3 指 · 雪花': '🖖 3 fingers · snowflake',
  '4 指 · 花环': '4 fingers · wreath',
  '🖐 5 指 · 星云': '🖐 5 fingers · nebula',
  '🤘 6 指 · MERRY': '🤘 6 fingers · MERRY',
  '🙌 双手 · 缩放': '🙌 Both hands · zoom',
  '🤏 捏合 · 缩放 / 抓照片': '🤏 Pinch · zoom / grab photos',
  '👌 OK · 许愿 / 收工': '👌 OK · wish / finish',
  '圣诞铃声 · on': 'Jingle bells · on',
  '音乐已关闭': 'Music off',
  '想见的人，会在下一场雪里出现。': 'The one you miss will appear in the next snowfall.',
  '雪落在肩上，光落在心里。圣诞快乐。': 'Snow on your shoulders, light in your heart. Merry Christmas.',
  '愿今年所有的等待，都有着落。': 'May every wait this year find its answer.',
  '愿你被这世界温柔以待，也温柔地待自己。': 'May the world be gentle with you — and you with yourself.',
  '愿你抬头有光，低头有暖，转身有人在。': 'Light above, warmth below, someone beside you.',
  '这一年的辛苦，今晚都交给星光。': 'Hand this year’s tiredness to the starlight tonight.',
  '把心愿说给这棵树听，它会替你记住。': 'Whisper a wish to the tree — it remembers for you.',
  '当前视角': 'View preset',
  '薄荷青': 'Mint',
  '极光蓝': 'Aurora blue',
  '梦紫': 'Dream purple',
  '暖金': 'Warm gold',
  '圣诞红': 'Christmas red',
  '雪白': 'Snow white',
  '初雪': 'First snow',
  '烛光': 'Candlelight',
  '圣诞夜': 'Christmas Eve',
  '落地': 'Ground',
  '准备中…': 'Preparing…',
  'EXIT · 退出净屏': 'EXIT · leave clean view',

  // ---------- 补充（2026-11-28 覆盖率巡检） ----------
  '主题 / THEME': 'THEME',
  '摄像头画面只在你的浏览器里实时运算，不上传、不保存。':
    'Video is processed locally in your browser — never uploaded, never stored.',
  '恢复默认粒子参数': 'Reset particle settings',
  '力场强度': 'Field power',
  '演示动效': 'Demo motion',
  '排斥=粒子逃离掌心；吸引=涌成发光球壳；涡旋=绕手掌旋转。':
    'Repel pushes particles off your palm; attract draws them into a glowing shell; vortex spins them around your hand.',
  '添加照片': 'Add photo',
  '从相册面板添加': 'Add from the panel',
  '场景预设': 'Scene preset',
  '导出 JSON': 'Export JSON',
  '导入 JSON': 'Import JSON',
  '应用这段 JSON': 'Apply this JSON',
  '存图 PNG': 'Save PNG',
  '录制 8 秒 WebM': 'Record 8s WebM',
  '渐变彩笔': 'Rainbow brush',
  '撤销上一笔': 'Undo last stroke',
  '清空签名': 'Clear ink',
  '落笔层深度：滚轮 / ↑↓ / 上下按钮调整': 'Layer depth: wheel / ↑↓ / buttons',
  '远一层（更深）': 'Deeper layer',
  '近一层（更浅）': 'Shallower layer',
  '收起': 'Collapse',
};

/** 拼接式文案：正则 → 英文模板（$1 等保留原文变量） */
const RULES: Array<[RegExp, string]> = [
  [/^力场 关 · 强度 ([\d.]+)$/, 'Field off · power $1'],
  [/^力场 排斥 · 强度 ([\d.]+)$/, 'Field · repel · power $1'],
  [/^力场 吸引 · 强度 ([\d.]+)$/, 'Field · attract · power $1'],
  [/^力场 涡旋 · 强度 ([\d.]+)$/, 'Field · vortex · power $1'],
  [/^力场\s*(\S+)\s*·\s*强度\s*([\d.]+)$/, 'Field · $1 · power $2'],
  [/^(\d+)\s*粒子$/, '$1 particles'],
  [/^(\d+(?:\.\d+)?)k\s*粒子$/, '$1k particles'],
  [/^照片已挂上树 🎄 共\s*(\d+)\s*张$/, 'Photos on the tree 🎄 $1 total'],
  [/^照片已移除 · 还剩\s*(\d+)\s*张$/, 'Photo removed · $1 left'],
  [/^已隐藏\s*(.+)$/, 'Hidden: $1'],
  [/^已隐藏这张 · 粒子区域更干净了$/, 'Photo hidden · cleaner particle field'],
  [/^冷却中\s*([\d.]+)s?$/, 'Cooling down $1s'],
  [/^形态 · (.+)$/, 'Shape · $1'],
  [/^形态 → (.+)$/, 'Shape → $1'],
  [/^(\d+)\s*只手 · 指\s*(.+)$/, '$1 hands · fingers $2'],
  [/^检测到\s*(\d+)\s*只手$/, 'Detected $1 hand(s)'],
  [/^已是\s*(.+)$/, 'Already $1'],
  [/^挂位已满（最多\s*(\d+)\s*张），先在照片面板删掉一张$/, 'Slots full (max $1) — remove one in the photo panel'],
  [/^挂位已满（最多\s*(\d+)\s*张），先删一张再添加吧$/, 'Slots full (max $1) — delete one first'],
  [/^已导出 webm · (.+)$/, 'WebM exported · $1'],
  [/^录制失败：(.+)$/, 'Recording failed: $1'],
  [/^保存失败：(.+)$/, 'Save failed: $1'],
  [/^识别出错：(.+)$/, 'Recognition error: $1'],
  [/^不可用：(.+)$/, 'Unavailable: $1'],
];

let lang: Lang = 'zh';

export function currentLang(): Lang {
  return lang;
}

export function setLangValue(next: Lang): void {
  lang = next;
  document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
  document.body.dataset.lang = next;
}

/** 解析语言：?lang=en/zh > localStorage > 浏览器语言 */
export function detectLang(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'en' || q === 'zh') return q;
  try {
    const saved = localStorage.getItem('aurora-lang');
    if (saved === 'en' || saved === 'zh') return saved;
  } catch { /* ignore */ }
  return navigator.language && !navigator.language.toLowerCase().startsWith('zh') ? 'en' : 'zh';
}

/** 精确词条 → 规则 → 原样返回 */
export function tr(text: string): string {
  if (lang !== 'en') return text;
  const key = text.trim();
  if (!key) return text;
  const hit = EN[key];
  if (hit) return text.replace(key, hit);
  for (const [re, repl] of RULES) {
    if (re.test(key)) {
      const out = key.replace(re, repl);
      return text.replace(key, out);
    }
  }
  return text;
}

/** 是否有对应英文（用于调试/覆盖率检查） */
export function hasEn(text: string): boolean {
  const key = text.trim();
  return !!EN[key] || RULES.some(([re]) => re.test(key));
}

export const EN_DICT = EN;
