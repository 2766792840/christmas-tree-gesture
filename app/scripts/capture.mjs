/**
 * 生成 README 用的截图与演示动图。
 * 用法：先 `npm run build && npx vite preview --port 8783`，再 `node scripts/capture.mjs`
 * 输出：../docs/screenshots/*.png 与 ../docs/screenshots/demo.webm（GIF 由 ffmpeg 转）
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8783';
const OUT = path.resolve(import.meta.dirname, '../../docs/screenshots');
fs.mkdirSync(OUT, { recursive: true });

async function ready(page) {
  await page.waitForFunction(() => {
    const a = window.__aurora;
    return !!a && a.stats().backendReady === true;
  }, undefined, { timeout: 30_000 });
  await page.evaluate(() => document.getElementById('btnStartMouse')?.click());
  await page.waitForFunction(() => {
    const i = document.getElementById('intro');
    return !i || getComputedStyle(i).pointerEvents === 'none' || Number(getComputedStyle(i).opacity) < 0.15;
  }, undefined, { timeout: 15_000 });
  // 截图用：彻底移除引导层残留（真实页面由用户手动关闭）
  await page.evaluate(() => {
    const i = document.getElementById('intro');
    if (i) i.style.display = 'none';
  });
}

const shots = [
  { name: 'hero', url: '/?demo=1&field=0', wait: 5200 },
  { name: 'field', url: '/?demo=1&field=3', wait: 2600, drag: { from: { x: 640, y: 520 }, to: { x: 1060, y: 250 } } },
  { name: 'shape-heart', url: '/?shape=heart&field=0', wait: 3200 },
  { name: 'shape-star', url: '/?shape=star&field=1', wait: 3200 },
  { name: 'shape-merry', url: '/?shape=merry&field=3', wait: 3200 },
  { name: 'editor', url: '/?field=1', wait: 2000, editor: true },
  { name: 'ui-en', url: '/?lang=en&demo=1&field=0', wait: 5200 },
  { name: 'gpu-webgl', url: '/?gpu=0&field=1', wait: 3200 }
];

const browser = await chromium.launch({ channel: 'chrome', args: ['--force-device-scale-factor=1'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

for (const s of shots) {
  await page.goto(BASE + s.url);
  await ready(page);
  if (s.editor) {
    await page.evaluate(() => document.getElementById('btnStudio')?.click());
    await page.waitForTimeout(600);
  }
  if (s.mouse) {
    await page.mouse.move(s.mouse.x, s.mouse.y);
    await page.mouse.move(s.mouse.x + 4, s.mouse.y + 2, { steps: 6 });
  }
  if (s.drag) {
    await page.mouse.move(s.drag.from.x, s.drag.from.y);
    await page.mouse.down();
    await page.mouse.move(s.drag.to.x, s.drag.to.y, { steps: 30 });
    await page.waitForTimeout(s.wait);
    await page.screenshot({ path: path.join(OUT, `${s.name}.png`) });
    await page.mouse.up();
    console.log('shot', s.name);
    continue;
  }
  await page.waitForTimeout(s.wait);
  await page.screenshot({ path: path.join(OUT, `${s.name}.png`) });
  console.log('shot', s.name);
}

// 手机版
const mob = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true
});
const mpage = await mob.newPage();
await mpage.goto(BASE + '/?field=1');
await ready(mpage);
await mpage.waitForTimeout(5200);
await mpage.screenshot({ path: path.join(OUT, 'mobile.png') });
console.log('shot mobile');
await mob.close();

// 录一段动图素材（webm，稍后用 ffmpeg 转 gif）
const vid = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: path.join(OUT, '..', 'tmp-video'), size: { width: 1280, height: 800 } }
});
const vpage = await vid.newPage();
await vpage.goto(BASE + '/?field=2&demo=1');
await ready(vpage);
await vpage.waitForTimeout(800);
// 鼠标画一圈，制造力场扰动
await vpage.mouse.move(300, 500);
for (let i = 0; i <= 40; i++) {
  const t = (i / 40) * Math.PI * 2;
  await vpage.mouse.move(640 + Math.cos(t) * 260, 360 + Math.sin(t) * 190, { steps: 3 });
  await vpage.waitForTimeout(70);
}
await vpage.waitForTimeout(1200);
const videoPath = await vpage.video().path();
await vid.close();
fs.copyFileSync(videoPath, path.join(OUT, 'demo.webm'));
console.log('video', videoPath);

await browser.close();
