/**
 * E2E 视觉回归（Playwright）
 *
 * 不追求像素级基线：WebGPU / WebGL / SwiftShader 在不同机器上像素必然不同，
 * 强锁基线只会制造红叉。这里换成三条跨机器稳定的断言：
 *   1. 场景不是黑屏（亮度方差 + 亮像素占比）
 *   2. 换形态后画面确实变了（像素差异比例）
 *   3. 后端自检、无控制台报错、无 WebGPU map 警告
 * 另加三条功能回归：WebGL 回落、语言切换与持久化、WebGPU 可用性探测（不可用则 skip）。
 */
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { PNG } from 'pngjs';

type Bitmap = { w: number; h: number; data: Buffer };

function decode(buf: Buffer): Bitmap {
  const png = PNG.sync.read(buf);
  return { w: png.width, h: png.height, data: png.data };
}

function lumaStats(b: Bitmap) {
  const n = b.w * b.h;
  let sum = 0;
  let sumSq = 0;
  let bright = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const l = 0.2126 * b.data[o] + 0.7152 * b.data[o + 1] + 0.0722 * b.data[o + 2];
    sum += l;
    sumSq += l * l;
    if (l > 40) bright++;
  }
  const mean = sum / n;
  return { mean, std: Math.sqrt(Math.max(0, sumSq / n - mean * mean)), brightRatio: bright / n };
}

/** 两帧之间「明显不同」的像素占比 */
function diffRatio(a: Bitmap, b: Bitmap): number {
  const n = Math.min(a.w * a.h, b.w * b.h);
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const d =
      Math.abs(a.data[o] - b.data[o]) +
      Math.abs(a.data[o + 1] - b.data[o + 1]) +
      Math.abs(a.data[o + 2] - b.data[o + 2]);
    if (d > 24) changed++;
  }
  return changed / n;
}

async function shot(page: Page, info: TestInfo, name: string): Promise<Bitmap> {
  const buf = await page.screenshot({ animations: 'disabled' });
  await info.attach(name, { body: buf, contentType: 'image/png' });
  return decode(buf);
}

async function waitReady(page: Page) {
  await page.waitForFunction(() => {
    const a = (window as any).__aurora;
    return !!a && typeof a.stats === 'function' && a.stats().backendReady === true;
  }, undefined, { timeout: 30_000 });
}

/** intro 的「鼠标当手」按钮出现才点，等遮罩真的让开再继续 */
async function dismissIntro(page: Page) {
  await page.evaluate(() => {
    const b = document.getElementById('btnStartMouse') as HTMLButtonElement | null;
    if (b && document.body.contains(b)) b.click();
  });
  await page.waitForFunction(() => {
    const i = document.getElementById('intro');
    if (!i) return true;
    const s = getComputedStyle(i);
    return s.pointerEvents === 'none' || Number(s.opacity) < 0.15;
  }, undefined, { timeout: 15_000 });
}

test.describe('aurora tree studio', () => {
  test('启动后后端就绪、粒子数正确、无报错', async ({ page }, info) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
      if (m.type() === 'warning') warnings.push(m.text());
    });

    await page.goto('/?debug=1');
    await waitReady(page);
    await dismissIntro(page);

    const stats = await page.evaluate(() => (window as any).__aurora.stats());
    expect(stats.count).toBe(26000);
    expect(String(stats.gpu)).toMatch(/WebGPU|WebGL/);
    expect(stats.backendError ?? '').toBe('');

    await shot(page, info, 'boot');

    expect(errors, `console errors:\n${errors.join('\n')}`).toHaveLength(0);
    // 回读节流修好后，WebGPU 不应再刷 "used in submit while mapped"
    expect(
      warnings.filter((w) => /used in submit while mapped/i.test(w)),
      'webgpu map warnings'
    ).toHaveLength(0);
  });

  test('画面不是黑屏', async ({ page }, info) => {
    await page.goto('/?debug=1&field=2');
    await waitReady(page);
    await dismissIntro(page);
    await page.waitForTimeout(1200);

    const b = await shot(page, info, 'frame-idle');
    const s = lumaStats(b);
    // 深色背景 + 星尘：均值偏低但必须有亮像素分布
    expect(s.std, 'luminance stddev').toBeGreaterThan(6);
    expect(s.brightRatio, 'ratio of bright pixels').toBeGreaterThan(0.003);
  });

  test('切换形态后画面明显变化', async ({ page }, info) => {
    await page.goto('/?debug=1&shape=heart&field=0');
    await waitReady(page);
    await dismissIntro(page);
    await page.waitForTimeout(1500);
    const a = await shot(page, info, 'shape-heart');

    await page.evaluate(() => (window as any).__aurora.setShape('star'));
    await page.waitForTimeout(1800);
    const b = await shot(page, info, 'shape-star');

    expect(diffRatio(a, b), 'changed pixel ratio').toBeGreaterThan(0.02);
  });

  test('?gpu=0 回落 WebGL2', async ({ page }) => {
    await page.goto('/?gpu=0&debug=1');
    await waitReady(page);
    await dismissIntro(page);
    const stats = await page.evaluate(() => (window as any).__aurora.stats());
    expect(stats.backend).toBe('webgl');
    await expect(page.locator('#hudGpu')).toContainText(/WebGL/i);
  });

  test('语言切换与持久化', async ({ page }) => {
    await page.goto('/?lang=zh');
    await waitReady(page);
    await dismissIntro(page);

    await page.evaluate(() => (document.getElementById('btnLang') as HTMLButtonElement).click());
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle(/Gesture-driven Particle Tree/);
    await expect(page.locator('h1')).toContainText(/scattered light/i);

    // 不带 ?lang 参数重载：应当从 localStorage 记住英文
    await page.goto('/');
    await waitReady(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle(/Gesture-driven Particle Tree/);

    await dismissIntro(page);
    await page.evaluate(() => (document.getElementById('btnLang') as HTMLButtonElement).click());
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.locator('h1')).toContainText('让散落的光');
  });

  test('WebGPU 可用时走 ping-pong 后端', async ({ page }) => {
    await page.goto('/?debug=1');
    const hasAdapter = await page.evaluate(async () => {
      const gpu = (navigator as any).gpu;
      if (!gpu) return false;
      try {
        return !!(await gpu.requestAdapter());
      } catch {
        return false;
      }
    });
    test.skip(!hasAdapter, '当前浏览器/CI 没有 WebGPU adapter，已由 WebGL 回落用例覆盖');

    await waitReady(page);
    const stats = await page.evaluate(() => (window as any).__aurora.stats());
    expect(String(stats.gpu)).toMatch(/WebGPU/);
    expect(stats.backendError ?? '').toBe('');
  });
});
