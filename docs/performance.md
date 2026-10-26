# Performance notes

Open the simulator with `?profile` (for example `index.html?profile`) and read `awtProfiler.report()` in the console.
Every simulation system and render phase is a named mark; `awtProfiler.reset()` starts a fresh window.

## What runs where

* The simulation (units, AI, economy, region) runs on the main thread, in fixed 1/30 s steps. It is tightly coupled to
  the DOM-facing application state, so moving all of it into a worker would mean rewriting most of `js/app.js`. It was not done.
* **Terrain baking runs in a worker pool** (`src/terrain/TerrainBakeClient.js`, `terrain-bake-worker.js`). The main thread gathers a
  chunk's height lattice and layer grids into typed arrays (`gatherTerrainChunkInput`), a worker shades them
  (`shadeTerrainChunkFromInput`) and transfers the pixels back. Chunks nearest the camera are baked first; stale chunks keep
  drawing until the new one lands. With no worker support it falls back to baking on the main thread within a per-frame budget.
* The distant-unit worker that already existed is unchanged.
* **Ground compositing uses WebGL2** (`src/rendering/GLGroundLayer.js`) on machines with a real GPU: terrain and vegetation
  tiles are drawn as textured quads on a canvas under the 2D canvas. Software rasterisers (SwiftShader, llvmpipe) are detected and
  keep the 2D path because they are slower than Canvas 2D. `?gl` forces WebGL, `?nogl` disables it.
* Units stay on Canvas 2D. With 400 units they cost about 0.3 ms per frame in the profiler, so WebGL would add complexity for no gain.

## Stalls found with the profiler, and the fixes

| Mark | Cause | Fix |
| --- | --- | --- |
| `render.terrain` (up to ~400 ms first view) | Shading chunks on the main thread | Worker pool, nearest first |
| `ai.social` | Whole-army relationship pass in one tick | Sliced across ticks (`socialCursor`) |
| `ai.requisition`, `ai.victoryEvaluation`, `ai.strategic` | Repeated all-pairs proximity scans and string-keyed cell maps | Single-pass neighbour query, numeric cell keys, early-exit counts |
| `simulation.units` | `Math.hypot` in hot loops, repeated collision-layer lookups | `hypot2`, cached separation class |
| fog of war | Re-testing already visible cells, trig for full circles | Skip visible cells, trig-free full arcs |
| `assignCombinedArmsSupport` | Brute-force nearest search | Grid ring search (`nearestIndexed`) |

Measured in headless Chromium with ~1200 units: p99 frame time ~104 → ~31 ms and worst frame ~115 → ~60 ms; at ~400 units p99 ~19.5 → ~15.3 ms.
Headless software rendering cannot show the WebGL gain; the main-thread cost of drawing terrain fell from ~25 ms to ~0.5 ms of JavaScript per frame.

## Unit markers

Units are drawn as simple role shapes (`src/rendering/UnitGlyphs.js`): circle infantry, dart scout, hexagon squad leader, square standard bearer,
cross medic, diamond engineer/builder, crate supply carrier, hull-and-barrel vehicle. The **Unit shapes** toolbar button switches back to the detailed sprites.
Hover a unit for a tooltip and click it to pin a stat card (health, morale, fatigue, weapon, armour, squad, current action); *Full report* opens the long inspector.
