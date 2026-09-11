# Local rendering profile, 2026-09-10

## Method

Local headless Edge, 1440x1000 CSS pixels, DPR 1, 5-second warmup and
12-second sample. The same read-only save snapshot was used in all three runs.
The benchmark locks the viewed island/face to the saved home view, seeds random
numbers, and keeps the simulation running. API requests are intercepted: no
game progress is saved. CPU profiles use CDP; GPU elapsed time uses
EXT_disjoint_timer_query_webgl2 with disjoint results discarded.

Baseline source revision: d60a38184c366cb63ded449a6026c04ebd194ab0.
Only character-rig.js and i18n.js are substituted for the baseline.

## Results

| Metric | Baseline | Optimized | Diagnostic DPR 0.5 |
| --- | ---: | ---: | ---: |
| Mean FPS | 27.72 | 43.23 | 60.02 |
| Mean frame interval, ms | 36.07 | 23.13 | 16.66 |
| Frame interval p95, ms | 46.40 | 30.20 | 17.40 |
| CPU render call wall time, ms | 33.10 | 21.34 | 9.96 |
| GPU elapsed mean, ms | 25.07 | 18.55 | 10.46 |
| Bounding sphere CPU samples, inclusive | 63.34% | 0% | 0% |
| UI refresh CPU samples, inclusive | 4.59% | 0.78% | 0.46% |
| Garbage collection CPU samples | 0.31% | 0.39% | 0.36% |

Every final frame has the same 2,656 draw calls, 1,242,271 triangles,
793 geometries and 21 textures, counting all render passes. GPU and CPU times
overlap; do not add them. CPU render-call time can include driver backpressure.

The original dominant cost is CPU reskinning 20,482 vertices per resident per
frame only to calculate a bounding sphere. The replacement caches bone-local
envelopes and transforms 39 bone bounds, rebuilding envelopes when morph
influences change. Translation results now use bounded per-language caches.

After those changes, reducing only pixel dimensions by half reaches 60 FPS
and reduces GPU elapsed time from 18.55 to 10.46 ms. This implicates remaining
pixel-dependent rendering/GPU work, not simulation logic. That resolution
change is ONLY in the diagnostic browser, not in production code.

JS used heap was 45.8 to 47.8 MiB in baseline and 91.2 to 78.3 MiB optimized.
These are short, non-GC-normalized samples, not a retained-heap/leak test.
No dominant GC cost was observed. The Mac has 24 GiB RAM; system swap was
about 5.8 GiB, which is system-wide and cannot be attributed to this game.

## Verification

- Full unit suite at time of implementation: 447 passed; build passed.
- Final focused character/i18n suite: 21 passed.
- Four controlled before/after render comparisons (home front, spore front,
  spore back, mobile): zero changed pixel channels; nonblank canvases.
- Browser checks: phone dossier and language switching passed. Three older
  checks did not pass: appearance-edit button lookup timed out, reverse-face
  text expectation omitted the island name, fixed-coordinate NPC click missed.
  These failures are not counted as successful interaction coverage.

## Reproduce

Use a frozen copy of the save for comparable runs. Run these sequentially, not
concurrently; GPU contention would distort the measurements.

```sh
node tools/profile-local.mjs baseline /tmp/myalienlife-profile-20260910.json 1 d60a38184c366cb63ded449a6026c04ebd194ab0
node tools/profile-local.mjs after /tmp/myalienlife-profile-20260910.json
node tools/profile-local.mjs half-resolution /tmp/myalienlife-profile-20260910.json 0.5
node tools/verify-performance.mjs
```

JSON summaries and raw .cpuprofile files are beside this report. Performance
depends on viewport, device pixel ratio, scene and other running applications;
these numbers are controlled local measurements, not a guaranteed live FPS.
