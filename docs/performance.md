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

## Low-end PCs: quality profiles

The toolbar has a **Quality** selector (Low / Balanced / High). The first run picks one from the machine
(`navigator.hardwareConcurrency`, `deviceMemory`, data-saver, or a software WebGL renderer means Low); the choice is remembered in
`localStorage`, and `?quality=low|balanced|high` overrides it for a session. The profiles live in `src/performance/QualityProfile.js`:

| | Low | Balanced | High |
| --- | --- | --- | --- |
| Canvas back-buffer | 50% (960 × 540) | 75% | 100% (1920 × 1080) |
| Draw cap | 20 fps | 30 fps | 60 fps |
| Vegetation bake detail | up to 0.75 px/unit | up to 1.0 | up to 1.5 |
| Simulation slice per frame | 5 ms | 8 ms | 10 ms |
| Part rigs appear at zoom | 1.6 | 1.1 | 0.9 |

Two further savings apply to every profile: vegetation chunks are baked at a resolution that follows the zoom (0.5 / 0.75 / 1 / 1.5 px per world unit,
rebaked a few per frame when the zoom bucket changes), and when the camera rests the visible chunks are merged into one screen-sized canvas so
vegetation is a single blit per frame.

Measured in headless Chromium with software rendering (the worst case; a real GPU is faster), five players, workshop map, camera at rest:
`render.region` 31.8 ms to 2.8 ms per frame and about 10.7 to 22.6 loop frames per second at High; Balanced 25 fps; Low 39 loop frames per second with the draw cap at 20.
With the camera panning (the composite cache cannot help) High ran at 14.8 and Low at 33.4 loop frames per second. With the CPU throttled 4x, High ran at 6 and Low at 9.6.
Simulation stays on the main thread (only distant-unit hints use a worker), so a very large army still costs simulation time on a slow CPU; that is what the per-frame slice and the scale presets bound.

## Part rigs

At close zoom units, vehicles, aircraft and buildings are drawn from named parts (`src/rendering/PartRigs.js`) instead of a flat shape.
Humanoids are built in head heights (about 7.5 heads tall; legs about half of that; arms reaching mid-thigh) and have a head, neck,
shoulders, torso (body), back, upper arms, elbows, forearms, hands, groin, thighs, knees, calves and feet, each in a near and a far side. Body builds
(average, heavy marine, brute ork, lean) change widths and lengths but keep the same parts. The humanoid part list applies to humanoids only; vehicles have tracks,
road wheels, hull, skirt, turret, mantlet, barrel, hatch, exhaust and antenna; aircraft a fuselage, cockpit, wings, tailfin, tailplane and engine; buildings a foundation, walls, roof, door, windows
and so on per type, rising in construction stages and losing roofs when wrecked. `RigAnimator` derives the walk cycle from movement. Open the **Sprite lab** and pick *Part rigs* to see every rig and its part list.
The ork sprite set and the old pixel "Unit sprites" style are unchanged; rigs replace only the simple shape markers.
