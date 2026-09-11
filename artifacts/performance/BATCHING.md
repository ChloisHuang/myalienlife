# Static Rendering Optimization

Measured locally on 2026-09-10, after the earlier skin-bounds CPU fix.
Same saved home scene (50 objects), Edge headless, 1440 x 1000, DPR 1;
5-second warm-up and 12-second sequential samples. The save API was mocked,
so profiling did not modify the player's save.

| Metric | Before | After |
| --- | ---: | ---: |
| Average FPS | 51.38 | 57.05 |
| Average frame interval | 19.46 ms | 17.53 ms |
| P95 frame interval | 23.00 ms | 21.10 ms |
| CPU render call wall time | 18.37 ms | 15.71 ms |
| GPU timer query | 20.10 ms | 17.57 ms |
| Draw calls | 2649 | 2133 |
| Rendered triangles | 1236517 | 1236517 |
| Rendered points | 1564 | 1564 |
| Rendered lines | 5312 | 5312 |
| Resident geometry objects | 772 | 563 |

Raw measurements: `batch-before.json`, `batch-after.json` (batching only),
and `batch-final.json`, with corresponding CPU profiles and screenshots.
These are single-run samples, not a guarantee of 60 FPS on every view/device.
CPU render wall time and GPU elapsed time overlap and must not be added.
Geometry object counts are not GPU memory byte measurements; heap snapshots
straddle garbage collection and do not establish a memory reduction.

## Changes

- Batch explicitly static opaque meshes by material and render state. Repeated
  shared geometry uses instancing; other compatible pieces use merged geometry.
- Keep wind/reveal roots, animated objects, transparent effects, custom terrain
  shaders, skinning, object identity and picking boundaries separate.
- Reuse sphere geometry and identical imported prop materials.
- Remove redundant canvas MSAA on the fullscreen postprocessing output, while
  retaining the existing 4x multisampled scene targets. Resolution, bloom,
  shadows, particles and model tessellation are unchanged.
- Build previews retain independently sorted transparent pieces. Disposal
  releases only newly owned batch buffers, not shared source geometry.

## Verification

- `npm test`: 456 passed.
- `npm run build`: passed (existing large-chunk warning).
- Four focused Playwright tests passed: render context, phone dossier,
  catalog placement, and building/selling.
- Deterministic before/after visual comparisons are recorded in
  `batch-visual-verification.json`; each pair uses identical random seeds,
  simulation state and animation steps. Desktop/mobile, both island themes,
  front/back, night and rain are covered. Screenshots use `batch-before-*`
  and `batch-after-*` names.
- All seven visual pairs passed. Three were pixel-identical; the maximum mean
  RGB difference among the others was 0.000141 on the 0-255 scale. No pixel
  exceeded a 16-level channel difference. Inspected desktop, night and mobile
  output remained nonblank and visually intact.

Profiling: `node tools/profile-local.mjs LABEL SAVE_PATH`.
Comparison: `node tools/verify-performance.mjs SNAPSHOT_DIR`, where the snapshot
directory contains pre-change `world.js`, `props.js`, `fairytale.js`, and
`save.json`. This run used `/tmp/myalienlife-render-before`.
