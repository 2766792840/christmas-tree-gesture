# Aurora V3 Benchmark Kit

This kit is intended to close the real P0 evidence gap in the V2.2 baseline at `56c5c21`.

It contains two measurement layers:

1. `scripts/benchmark.mjs` measures frame cadence, Long Tasks, environment, backend HUD, build artifact size, page errors, and optional app-side diagnostics.
2. `src/dev/bench.ts` is an opt-in instrumentation bridge for compute submission, staging readback, `mapAsync`, CPU conversion, and `buildGpuBase()` / `setBase()` timing.
3. `scripts/merge-benchmarks.mjs` combines per-backend summaries into a single `benchmark.json` while retaining every raw run.

No results are fabricated or prefilled. Run on the target machine to produce the evidence files.

## 1. Install into the repository

Copy these files into the project:

```text
Aurora_V3_Benchmark_Kit/scripts/benchmark.mjs       -> app/scripts/benchmark.mjs
Aurora_V3_Benchmark_Kit/scripts/merge-benchmarks.mjs -> app/scripts/merge-benchmarks.mjs
Aurora_V3_Benchmark_Kit/src/dev/bench.ts            -> app/src/dev/bench.ts
```

The sampler expects to be run from `app/`, because it reads `app/package.json` and `app/dist/assets/` relative to the current working directory.

## 2. Build and start the preview server

Terminal A:

```bash
cd app
npm ci
npm run build
npm run preview -- --host 127.0.0.1 --port 8783 --strictPort
```

Terminal B, still in `app/`, use headed Chromium on the actual target computer. The default is headed; do not add `--headless` for hardware performance conclusions.

```bash
node scripts/benchmark.mjs --url=http://127.0.0.1:8783/ --backend=auto --duration=30000 --warmup=5000 --runs=3 --output=benchmark-results/benchmark-auto.json
node scripts/benchmark.mjs --url=http://127.0.0.1:8783/ --backend=webgl --duration=30000 --warmup=5000 --runs=3 --output=benchmark-results/benchmark-webgl.json
node scripts/merge-benchmarks.mjs benchmark-results/benchmark-auto.json benchmark-results/benchmark-webgl.json --output=benchmark-results/benchmark.json
```

`auto` uses the application's normal backend selection. `webgl` appends `?gpu=0`, forcing the existing WebGL2 Lite path. Both append `fieldSim=1` so the force field is exercised without requesting camera permission. Each run first warms up for 5 seconds, then samples for 30 seconds. The sampler creates a raw JSON file per run plus one median-of-runs summary per backend. The merge script creates the combined `benchmark.json`.

The sampler also records the JS/CSS bundle sizes from `dist/assets/`, including raw and gzip byte counts. It stores per-minute frame-time percentiles and optional heap snapshots during longer runs, so a 30-minute run has a time series rather than one pooled percentile. This turns the review's reported `688 KB / 186 KB gzip` into a value that can be repeated from the exact commit.

## 3. Add readback diagnostics

In `app/src/webgpu/compute.ts`, add:

```ts
import { benchRecord, benchCount } from '../dev/bench';
```

In `step()`, time CPU-side command encoding/submission and count whether a readback copy was queued or skipped:

```ts
const submitStart = performance.now();
// existing command encoder / compute pass / optional copy / queue.submit
this.queue.submit([enc.finish()]);
benchRecord('gpu.submitCpuMs', performance.now() - submitStart);
if (canCopy) benchCount('gpu.readbackQueued');
else benchCount('gpu.readbackSkipped');
```

In `requestReadback()`, split queue completion wait from map wait:

```ts
const queueWaitStart = performance.now();
this.queue.onSubmittedWorkDone()
  .then(() => {
    benchRecord('gpu.queueWaitMs', performance.now() - queueWaitStart);
    const mapStart = performance.now();
    return frame.staging.mapAsync(GPUMapMode.READ).then(() => {
      benchRecord('gpu.mapWaitMs', performance.now() - mapStart);
      frame.ready = true;
    });
  })
  .catch(() => { frame.mapped = false; });
```

In `readInto()`, record CPU conversion time and successful readback interval. Keep the last successful timestamp in the class:

```ts
private lastReadbackAt = 0;
// At the start of the ready-frame conversion branch:
const copyStart = performance.now();
// existing getMappedRange() and vec4 -> vec3 loop
benchRecord('gpu.readbackCopyMs', performance.now() - copyStart);
const now = performance.now();
if (this.lastReadbackAt > 0) benchRecord('gpu.readbackIntervalMs', now - this.lastReadbackAt);
this.lastReadbackAt = now;
benchCount('gpu.readbackSamples');
```

In `app/src/app/engine.ts`, measure `buildGpuBase()` separately from `setBase()`:

```ts
import { benchRecord } from '../dev/bench';
const baseStart = performance.now();
const base = buildGpuBase();
benchRecord('cpu.buildGpuBaseMs', performance.now() - baseStart);
const uploadStart = performance.now();
gpu.setBase(base as Float32Array<ArrayBuffer>);
benchRecord('cpu.setBaseCallMs', performance.now() - uploadStart);
```

`setBaseCallMs` measures only the CPU call duration, not when GPU work completes. `queueWaitMs` is a queue completion proxy and includes preceding submitted work; it is not a pure GPU timestamp. If `timestamp-query` is later supported and validated, add it separately rather than relabelling queue wait as GPU execution time.

## 4. Readback-rate A/B experiment

After adding a `readbackHz` feature flag in the application scheduling path, run:

```bash
node scripts/benchmark.mjs --url=http://127.0.0.1:8783/ --backend=auto --readbackHz=60 --duration=30000 --warmup=5000 --runs=3 --output=benchmark-results/readback-60hz.json
node scripts/benchmark.mjs --url=http://127.0.0.1:8783/ --backend=auto --readbackHz=20 --duration=30000 --warmup=5000 --runs=3 --output=benchmark-results/readback-20hz.json
node scripts/benchmark.mjs --url=http://127.0.0.1:8783/ --backend=auto --readbackHz=15 --duration=30000 --warmup=5000 --runs=3 --output=benchmark-results/readback-15hz.json
```

The flag is only passed through by the sampler; it does not implement throttling in the application. The application change must keep Compute dispatch at its existing cadence and rate-limit only `copyBufferToBuffer` + map/readback when the interval gate is reached and a staging buffer is available.

Important: throttled readback means the WebGL render path displays the last received `aPhys` snapshot between updates. It may visibly step during fast motion. Test fast vortex, repel, pulse and shape morph cases. If quality is unacceptable, prototype two-snapshot interpolation in the WebGL vertex shader or reject the throttle optimization. Do not replace continuous updates with “read only on morph events”; continuous force fields would visually freeze between those events.

## 5. 30-minute stability and device matrix

The browser sampler can also be used for a long run. For a 30-minute run, use one run and preserve the raw result:

```bash
node scripts/benchmark.mjs --url=http://127.0.0.1:8783/ --backend=auto --duration=1800000 --warmup=30000 --runs=1 --output=benchmark-results/stability-30m-auto.json
```

Repeat on representative desktop discrete GPU, desktop integrated GPU, and mobile devices. Manual device matrix rows should include model, OS, browser, GPU, thermal state, DPR, resolution, particle count, backend, camera state, heap snapshots, errors, and whether camera stop/restart or device loss occurred. A 30-second run is for performance comparison; it does not replace the 30-minute stability run.

## 6. Output semantics

- `frameTimeMs`: P50/P95/P99/max of requestAnimationFrame intervals, not a GPU timer.
- `frameTimeByMinute`: per-minute frame interval distribution, useful for long-run degradation / thermal throttling review.
- `heapSamplesByMinute`: optional `performance.memory` snapshots; null when the browser does not expose this API.
- `fps.mean`: observed rAF count divided by elapsed sample duration.
- `longTasks`: main-thread Long Task API entries, if supported by the browser.
- `buildArtifacts`: raw and gzip bytes of generated JS/CSS files.
- `appDiagnostics`: optional samples from `window.__auroraBench`; `null` if hooks are not integrated.
- `queueWaitMs`: queue completion wait proxy, not pure compute GPU time.
- `mapWaitMs`: mapAsync wait duration.
- `readbackCopyMs`: CPU TypedArray conversion loop duration.
- `buildGpuBaseMs`: CPU target-position generation time.
- `setBaseCallMs`: CPU duration of `queue.writeBuffer` call only.

Missing diagnostic fields remain absent or `null`; the harness must not invent zero values for metrics that were not instrumented.

## 7. Benchmark discipline

- Run at least three independent samples per backend for 30-second comparisons.
- Use the same commit, browser build, resolution, DPR, particle count, visual theme, quality settings, and camera condition.
- Keep separate datasets for no-camera `fieldSim=1` and real-camera hand tracking.
- Keep the browser tab in the foreground; do not run DevTools, screen recording, or window switching during sampling.
- Record raw JSON files and the combined `benchmark.json`; summary metrics are medians across runs, not pooled frame samples.
- 30-second performance comparison does not replace 30-minute stability testing.
