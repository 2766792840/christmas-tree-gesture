# Aurora Tree Studio V2.2 · Gesture-driven Particle Christmas Tree

[中文](README.md) | **English**

A browser-based 3D particle Christmas tree studio: gesture- or mouse-driven particle force fields, photo memory orbs, 3D ink strokes, a full scene editor and artwork export. Built from the *Aurora Tree Studio V2 technical upgrade plan* — it is the version **migrated from a single-file demo to a Vite + TypeScript project skeleton**.

The site itself is bilingual: the `EN / 中文` button in the toolbar switches language instantly, `?lang=en` / `?lang=zh` forces a language, and the choice is remembered in localStorage.

## Repository layout

```
index.html          # the live page (already built; GitHub Pages reads this)
assets/             # built js / css
app/                # the Vite + TypeScript project; develop and build here
legacy/v1/          # archived single-file V1 (old page, screenshots, docs, local preview scripts)
```

Live site: <https://2766792840.github.io/christmas-tree-gesture/> (if Pages is not pointed at the repository root, see the note at the end).

## Running

```bash
cd app
npm install
npm run dev        # http://127.0.0.1:8782
npm run typecheck  # tsc --noEmit
npm run test       # vitest, 17 test cases
npm run build      # output in app/dist/
npm run preview    # preview the build
npm run ci         # typecheck + test + build — exactly what CI runs
```

After changing sources, copy `app/dist/index.html` and `app/dist/assets/` over the repository root to publish.

The build output needs no import map and can be dropped into any static host (GitHub Pages included).

## Layout

```
app/index.html              # DOM / styles only, no more 3000 lines of inline script
app/src/main.ts             # boot: mount editor → attach pointer hand → probe camera
app/src/app/engine.ts       # render core (three.js scene, particles, shaders, gesture FSM, export)
app/src/webgpu/compute.ts   # WebGPU ping-pong particle physics (WGSL kernel)
app/src/types/aurora.ts     # public engine API contract (window.__aurora)
app/src/core/presets.ts     # preset normalize / parse / serialize (pure, unit-tested)
app/src/core/pointer.ts     # NDC mapping, force-field intensity stepping (pure, unit-tested)
app/src/core/backend.ts     # backend arbitration: auto / webgl / webgpu
app/src/core/pointerHand.ts # "mouse as a hand" when there is no camera
app/src/ui/editor.ts        # full scene editor (mutates the scene only via window.__aurora)
app/src/ui/i18n.ts          # zh/en dictionary + phrase rules + language detection
app/src/ui/langDom.ts       # DOM text-node translation, language toggle, dynamic-content observer
app/src/dev/errorScreen.ts  # runtime errors rendered on screen instead of a frozen loader
.github/workflows/ci.yml    # typecheck, tests, build and dist artifact on every push / PR
```

## Layering

- **Engine** (`engine.ts`) owns Three.js exclusively: scene, particle attributes, force-field uniforms, gesture state machine, photo planets, ink strokes, recording.
- **Editor** (`editor.ts`) never touches Three.js; it calls the semantic `window.__aurora` API only: `setTheme` / `setShape` / `tune` / `setField` / `photos` / `layers` / `preset` / `snapshot` / `record`.
- **Input** (`pointerHand.ts`) only writes `__aurora.pointer` (normalized coordinates + pinch state); world-space conversion stays in the engine's `screenToWorld`.

## WebGPU and ping-pong compute

Rendering still goes through three.js WebGL; WebGPU only integrates particle physics, so the tree materials never had to be rewritten as TSL nodes.

- `PingPongParticles` in `src/webgpu/compute.ts` holds three storage buffer groups — `base` (target position + seed, vec4), `posA/posB`, `velA/velB` — with two bind groups pointing at each other and alternating every frame: that is the ping-pong.
- The WGSL kernel runs per frame: spring return to the target shape (so particles fall back after a shape switch), palm repulsion / attraction (per-seed reach, attraction keeps a spherical shell), vortex, pulse shock wave, exponential damping.
- Results are `copyBufferToBuffer`-ed into a staging buffer, read back asynchronously via `mapAsync`, packed into vec3 and fed to the `aPhys` vertex attribute; when `uGpu > 0.5` the shader uses `aPhys` as the position and bypasses the built-in force-field block.
- Backend arbitration lives in `src/core/backend.ts`: desktop + WebGPU available means auto-on; mobile, no WebGPU, or `?gpu=0` falls back to the WebGL2 shader force field. The editor's "GPU backend" group switches manually, and the HUD shows the live backend.
- Measured on an Intel Gen-12lp iGPU with 26k particles: ~45–47 fps on WebGPU, ~46 fps on WebGL2 — no visible drop when switching.

## Where typing stops

- Global `strict: true`, `noImplicitAny`, `noUnusedLocals`; `tsc --noEmit` is clean.
- `src/types/aurora.ts` defines `AuroraApi` (theme / shape / field / tune / photos / layers / presets / export / backend / stats). Editor, pointer input and `main.ts` all go through that contract — no `any` at the seams.
- `engine.ts` is a 3.1k-line migration body and still carries `// @ts-nocheck` internally — a deliberate, temporary boundary: its outward surface is pinned by `AuroraApi`, while the inside awaits a module split (render / gesture / photos / ink) before types are filled in. Stated here on purpose; it is not "done".

## Tests and CI

17 cases in `src/core/*.test.ts`, covering the three pieces of pure logic most likely to fail silently:

- `backend.test.ts` (4): manual / auto / no-GPU / mobile arbitration results and their reason strings.
- `pointer.test.ts` (7): NDC mapping (center, corners, out-of-range clamping, zero-size never yields Infinity), intensity stepping and 0–2 clamping.
- `presets.test.ts` (6): preset normalization, bad JSON / array input returning null, serialize round-trip.

`.github/workflows/ci.yml`: on push to main, on PRs and on manual dispatch; Node 22, `npm ci`, typecheck, test, build, then uploads `dist/` as an artifact.

## Editor capabilities

| Group | Contents |
| --- | --- |
| Input | Mouse / touch ↔ camera gestures, auto-detects a missing camera and switches to mouse mode |
| GPU backend | Auto / WebGL shader / WebGPU ping-pong + live status |
| Theme | Warm gold / Ice blue / Rose glow / Aurora fantasy / Cyber hologram |
| Shape | Heart / Star / Snowflake / Wreath / Nebula / MERRY (same as 1–6 fingers) |
| Particles | Count, flow, brightness, contrast, size, glow, photo size, photo opacity |
| Force field | Off / repel / attract / vortex + intensity + pulse shock wave + demo animation |
| Photos | Thumbnail list, per-photo hide/show, delete, add (multi-select) |
| Layers | Tree, topper star, halo, photos, starfield, snow, aurora, galaxy haze, ground, snow ground, ink, fireworks |
| Presets | Save locally, load, export JSON, import JSON, paste JSON to apply |
| Export | PNG snapshot, 8-second WebM recording |

## Without a camera

- Move the pointer = palm position (the force-field center)
- Hold the left button = clench, force-field intensity ×1.45
- `Shift` + wheel = force-field intensity (auto-switches to attraction when the field is off)
- `1`–`6` = six shapes, `G` = cycle force field, space = pulse shock wave, `E` = toggle the editor

## URL parameters

`?field=1|2|3` (repel/attract/vortex), `?fieldSim=1` (auto-touring force field), `?gpu=0` (force WebGL), `?demo=1` (demo photos), `?shape=heart|flake|...`, `?lang=en|zh`, `?debug=1`.

## Against the technical plan

Done: three semantic layers (input/perception → interaction commands → rendering), GPU force fields (repel/attract/vortex/pulse), WebGPU ping-pong particle compute, gesture FSM IDLE→CANDIDATE→ACTIVE→COOLDOWN with priority arbitration, multiple themes, scene presets, artwork export, studio HUD, the type contract, unit tests and CI.

Not done (marked honestly rather than pretended):
- Grabbing photo orbs with a mouse drag (photo grabbing still needs hand keypoints)
- A pure WebGPU render pipeline (currently compute + readback + WebGL rendering; materials are not moved to TSL)
- Splitting `engine.ts` into modules and filling in its internal types (it is still `@ts-nocheck` as a whole)
- E2E visual regression (only pure-logic unit tests today)

## GitHub Pages

The live page is the repository root (`main` / root): `index.html` + `assets/`, no build step needed on the server.

If Pages was switched to "GitHub Actions", publish the root build output from the artifact instead; to use `/docs` instead, just move `index.html` and `assets/` into `docs/`.

The old single-file page is kept at `legacy/v1/index.html` and does not affect the live site.
