#!/usr/bin/env node
/**
 * Aurora Tree Studio browser benchmark.
 * Measures browser frame cadence and Long Tasks for a reproducible 30s window.
 * Optional app-side hooks expose WebGPU compute/readback timings at
 * window.__auroraBench.snapshot().
 *
 * Run from app/ after `npm ci && npm run build && npm run preview`.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((v) => v.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}
function hasFlag(name) { return process.argv.includes(`--${name}`); }
function percentile(values, q) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function stats(values) {
  return {
    count: values.length,
    p50: percentile(values, 0.50),
    p95: percentile(values, 0.95),
    p99: percentile(values, 0.99),
    max: values.length ? Math.max(...values) : null,
  };
}
function safeGitSha() {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); }
  catch { return null; }
}
async function readPackage() {
  try { return JSON.parse(await fs.readFile(path.resolve('package.json'), 'utf8')); }
  catch { return null; }
}
async function readPackageLockHash() {
  try {
    const bytes = await fs.readFile(path.resolve('package-lock.json'));
    return createHash('sha256').update(bytes).digest('hex');
  } catch { return null; }
}
async function readBuildArtifacts() {
  const assetsDir = path.resolve('dist/assets');
  try {
    const names = await fs.readdir(assetsDir);
    const rows = [];
    for (const name of names) {
      if (!/\.(js|css)$/i.test(name)) continue;
      const bytes = await fs.readFile(path.join(assetsDir, name));
      rows.push({
        file: name,
        type: name.toLowerCase().endsWith('.js') ? 'js' : 'css',
        rawBytes: bytes.byteLength,
        gzipBytes: gzipSync(bytes).byteLength,
      });
    }
    const sum = (type, key) => rows.filter((r) => r.type === type).reduce((n, r) => n + r[key], 0);
    return {
      source: 'dist/assets after npm run build',
      jsRawBytes: sum('js', 'rawBytes'),
      jsGzipBytes: sum('js', 'gzipBytes'),
      cssRawBytes: sum('css', 'rawBytes'),
      cssGzipBytes: sum('css', 'gzipBytes'),
      files: rows,
    };
  } catch {
    return null;
  }
}
function median(values) { return percentile(values.filter(Number.isFinite), 0.5); }

const baseUrl = arg('url', 'http://127.0.0.1:8783/');
const backend = arg('backend', 'auto');
const readbackHz = arg('readbackHz', '');
const durationMs = Number(arg('duration', '30000'));
const warmupMs = Number(arg('warmup', '5000'));
const runs = Number(arg('runs', '3'));
const headless = hasFlag('headless');
const channelArg = arg('channel', 'chrome');
const requestedOutput = arg('output', '');
if (!['auto', 'webgl', 'fbo'].includes(backend)) throw new Error('--backend must be auto, webgl or fbo');
if (!Number.isFinite(durationMs) || durationMs < 5000) throw new Error('--duration must be at least 5000 ms');
if (!Number.isInteger(runs) || runs < 1 || runs > 20) throw new Error('--runs must be an integer from 1 to 20');

const target = new URL(baseUrl);
if (backend === 'webgl') { target.searchParams.set('gpu', '0'); target.searchParams.delete('backend'); }
else if (backend === 'fbo') { target.searchParams.delete('gpu'); target.searchParams.set('backend', 'fbo'); }
else { target.searchParams.delete('gpu'); target.searchParams.delete('backend'); }
target.searchParams.set('fieldSim', '1');
target.searchParams.set('debug', '1');
target.searchParams.set('bench', '1');
if (readbackHz) target.searchParams.set('readbackHz', readbackHz);

const pkg = await readPackage();
const packageLockSha256 = await readPackageLockHash();
const buildArtifacts = await readBuildArtifacts();
const outputDir = path.resolve('benchmark-results');
await fs.mkdir(outputDir, { recursive: true });
// 默认用本机安装的 Chrome（WebGPU 在 Playwright 自带 Chromium 上常被禁用），装不上再退回自带内核
// 关掉后台/遮挡节流：否则窗口一旦被别的窗口盖住，rAF 会掉到 1 Hz，p99 会凭空多出 1000 ms 的假停顿
const launchArgs = [
  '--enable-unsafe-webgpu',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  // Windows 的原生遮挡检测会把被盖住的窗口降到 1 Hz，量帧时间前必须关掉
  '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling'
];
let browser;
try {
  browser = await chromium.launch({ headless, channel: channelArg, args: launchArgs });
} catch (err) {
  console.warn(`[benchmark] channel=${channelArg} 启动失败，改用 Playwright 自带 Chromium：${String(err).slice(0, 80)}`);
  browser = await chromium.launch({ headless, args: launchArgs });
}
const reports = [];

try {
  for (let run = 1; run <= runs; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await page.addInitScript(() => {
      const state = {
        active: false, last: null, frames: [], frameOffsets: [], heapSamples: [], longTasks: [], start: 0, end: 0, lastHeapSample: 0,
        longTaskSupported: false,
      };
      function tick(ts) {
        if (state.active) {
          if (state.last !== null) {
            state.frames.push(ts - state.last);
            state.frameOffsets.push(ts - state.start);
          }
          if (ts - state.lastHeapSample >= 60000) {
            state.heapSamples.push({ offsetMs: ts - state.start, usedHeapBytes: performance.memory?.usedJSHeapSize ?? null });
            state.lastHeapSample = ts;
          }
          state.last = ts;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      try {
        const observer = new PerformanceObserver((list) => {
          if (!state.active) return;
          for (const entry of list.getEntries()) {
            state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
          }
        });
        observer.observe({ type: 'longtask', buffered: false });
        state.longTaskSupported = true;
      } catch { /* Long Task API is optional. */ }
      window.__auroraFrameProbe = {
        begin() {
          state.frames = []; state.frameOffsets = []; state.heapSamples = []; state.longTasks = []; state.last = null;
          state.start = performance.now(); state.end = 0; state.lastHeapSample = state.start; state.active = true;
          window.__auroraBench?.reset?.();
        },
        finish() {
          state.end = performance.now(); state.active = false;
          return {
            elapsedMs: state.end - state.start,
            frameMs: [...state.frames],
            frameOffsetsMs: [...state.frameOffsets],
            heapSamples: [...state.heapSamples],
            longTasks: [...state.longTasks],
            longTaskSupported: state.longTaskSupported,
            appDiagnostics: window.__auroraBench?.snapshot?.() ?? null,
            appUi: {
              backend: document.querySelector('#hudGpu')?.textContent?.trim() ?? null,
              particles: document.querySelector('#hudPart')?.textContent?.trim() ?? null,
              fpsHud: document.querySelector('#hudFps')?.textContent?.trim() ?? null,
            },
            environment: {
              userAgent: navigator.userAgent,
              platform: navigator.platform,
              language: navigator.language,
              screen: { width: screen.width, height: screen.height },
              viewport: { width: innerWidth, height: innerHeight },
              dpr: devicePixelRatio,
              webgpuAvailable: !!navigator.gpu,
              webglRenderer: (() => {
                try {
                  const gl = document.querySelector('#scene')?.getContext('webgl2');
                  if (!gl) return null;
                  const ext = gl.getExtension('WEBGL_debug_renderer_info');
                  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
                } catch { return null; }
              })(),
              heapUsedBytes: performance.memory?.usedJSHeapSize ?? null,
            }
          };
        }
      };
    });

    const navStart = Date.now();
    await page.goto(target.toString(), { waitUntil: 'load', timeout: 60000 });
    // 非 headless 时把窗口提到前台，否则被遮挡的窗口会掉到 1 Hz
    if (!headless) await page.bringToFront().catch(() => {});
    await page.locator('#scene').waitFor({ state: 'attached', timeout: 20000 }).catch(() => {});
    // 等应用自检说后端就绪，再开始预热；否则会把加载期的掉帧算进采样
    await page.waitForFunction(() => {
      const s = window.__aurora?.stats?.();
      return !!s && (s.backendReady === true || s.count > 0);
    }, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(warmupMs);
    await page.evaluate(() => window.__auroraFrameProbe.begin());
    await page.waitForTimeout(durationMs);
    const raw = await page.evaluate(() => window.__auroraFrameProbe.finish());

    const frame = stats(raw.frameMs);
    const minuteMap = new Map();
    raw.frameMs.forEach((value, index) => {
      const minute = Math.floor((raw.frameOffsetsMs[index] ?? 0) / 60000);
      if (!minuteMap.has(minute)) minuteMap.set(minute, []);
      minuteMap.get(minute).push(value);
    });
    const frameTimeByMinute = [...minuteMap.entries()].sort((a, b) => a[0] - b[0]).map(([minute, values]) => ({ minute, ...stats(values) }));
    const fpsMean = raw.elapsedMs > 0 ? raw.frameMs.length * 1000 / raw.elapsedMs : null;
    const longDurations = raw.longTasks.map((x) => x.duration);
    const report = {
      schemaVersion: '1.1.0',
      benchmark: {
        startedAt: new Date(navStart).toISOString(),
        backendRequested: backend,
        readbackHzRequested: readbackHz || null,
        backendReported: raw.appUi.backend,
        runIndex: run,
        warmupMs,
        sampleDurationMs: durationMs,
        measuredDurationMs: raw.elapsedMs,
        mode: 'fieldSim=1; no camera requested; foreground headed browser recommended',
        headless,
      },
      revision: {
        gitSha: safeGitSha(),
        packageName: pkg?.name ?? null,
        packageVersion: pkg?.version ?? null,
        packageLockSha256,
        dependencies: {
          three: pkg?.dependencies?.three ?? null,
          mediapipe: pkg?.dependencies?.['@mediapipe/tasks-vision'] ?? null,
          vite: pkg?.devDependencies?.vite ?? null,
          typescript: pkg?.devDependencies?.typescript ?? null,
        },
      },
      buildArtifacts,
      environment: raw.environment,
      scene: { particlesHud: raw.appUi.particles, fpsHud: raw.appUi.fpsHud },
      frameTimeMs: frame,
      frameTimeByMinute,
      heapSamplesByMinute: raw.heapSamples,
      fps: {
        mean: fpsMean,
        derivedFromFrameP50: frame.p50 ? 1000 / frame.p50 : null,
        derivedFromFrameP95: frame.p95 ? 1000 / frame.p95 : null,
        derivedFromFrameP99: frame.p99 ? 1000 / frame.p99 : null,
        over20msPct: raw.frameMs.length ? raw.frameMs.filter((v) => v > 20).length / raw.frameMs.length * 100 : null,
        over33_3msPct: raw.frameMs.length ? raw.frameMs.filter((v) => v > 33.3).length / raw.frameMs.length * 100 : null,
      },
      longTasks: {
        supported: raw.longTaskSupported,
        count: longDurations.length,
        totalMs: longDurations.reduce((a, b) => a + b, 0),
        durationMs: stats(longDurations),
      },
      appDiagnostics: raw.appDiagnostics,
      errors: { pageErrors, consoleErrors },
    };
    reports.push(report);

    const stamp = new Date().toISOString().replaceAll(':', '').replaceAll('.', '-');
    const out = path.join(outputDir, `${stamp}-${backend}-run${run}.json`);
    await fs.writeFile(out, JSON.stringify(report, null, 2) + '\n');
    console.log(`\n[benchmark] ${backend} run ${run}/${runs}`);
    console.log(`  backend: ${raw.appUi.backend ?? 'unknown'} | particles: ${raw.appUi.particles ?? 'unknown'}`);
    console.log(`  frame ms: p50=${frame.p50?.toFixed(2) ?? 'n/a'} p95=${frame.p95?.toFixed(2) ?? 'n/a'} p99=${frame.p99?.toFixed(2) ?? 'n/a'} | mean FPS=${fpsMean?.toFixed(1) ?? 'n/a'}`);
    console.log(`  long tasks: ${longDurations.length} | page errors: ${pageErrors.length} | console errors: ${consoleErrors.length}`);
    console.log(`  raw output: ${out}`);
    await context.close();
  }
} finally {
  await browser.close();
}

const agg = {
  schemaVersion: '1.1.0',
  summary: {
    backendRequested: backend,
    readbackHzRequested: readbackHz || null,
    runs: reports.length,
    warmupMs,
    sampleDurationMs: durationMs,
    headless,
    gitSha: safeGitSha(),
    packageVersion: pkg?.version ?? null,
    packageLockSha256,
    buildArtifacts,
    note: 'Per-run raw records are retained alongside this summary. Aggregates are medians across runs, not pooled frame samples.',
  },
  medianAcrossRuns: {
    frameTimeMsP50: median(reports.map((r) => r.frameTimeMs.p50)),
    frameTimeMsP95: median(reports.map((r) => r.frameTimeMs.p95)),
    frameTimeMsP99: median(reports.map((r) => r.frameTimeMs.p99)),
    meanFps: median(reports.map((r) => r.fps.mean)),
    over20msPct: median(reports.map((r) => r.fps.over20msPct)),
    over33_3msPct: median(reports.map((r) => r.fps.over33_3msPct)),
    longTaskCount: median(reports.map((r) => r.longTasks.count)),
  },
  runs: reports,
};
const summaryPath = requestedOutput ? path.resolve(requestedOutput) : path.join(outputDir, `benchmark-${backend}.json`);
await fs.mkdir(path.dirname(summaryPath), { recursive: true });
await fs.writeFile(summaryPath, JSON.stringify(agg, null, 2) + '\n');
console.log(`\n[benchmark] aggregate summary: ${summaryPath}`);
