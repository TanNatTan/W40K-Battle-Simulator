# Living world: single-region scenario

The **Single region · living world** scenario replaces "a battle on a texture" with a persistent
region that keeps what happens to it. Everything is canvas 2D and plain ES modules, runs on the
fixed simulation step, and has no hidden randomness: a seed fully determines the starting world.

## Layout

| Module | Role |
| --- | --- |
| `src/terrain/HeightField.js` | Chunked height lattice (16-unit spacing, 16 × 16 chunks). Hills, slopes, directional slope, brush edits. |
| `src/world/WorldLayers.js` | Sparse per-cell layers: fertility, moisture, vegetation + kind, scorch, fire, trample, deposits (+ remaining amount), cover, integrity, owner, surface, earthwork, crop stage, standing water. RLE save format. |
| `src/world/RegionGenerator.js` | Seeded region: ridges, thermal erosion, meandering rivers (kept clear of bases), lakes, woodland, buried ore / promethium / stone, and ranked settlement sites. |
| `src/world/Deformation.js` | Craters, trenches (with parapets), excavation, levelling, scarring. All edit the height field *and* the layers. |
| `src/world/Ecosystem.js` | Weather (clear → overcast → rain → storm), seasons, fire spread, regrowth, flooding, crop growth and harvest. |
| `src/world/GroundEffects.js` | What the ground does to a unit class (civilian, infantry, power armour, vehicle, dreadnought, beast): speed, cover, detection, hazard. |
| `src/world/TerrainPathfinder.js` | Terrain-aware A\* for citizens (water, trenches, forest, mud, fire, ruins). |
| `src/settlements/*` | Citizens (`CitizenBrain`), settlement planner (`SettlementPlanner`), conquest aftermath (`Aftermath`) and the orchestrating `LivingSettlements`. |
| `src/region/RegionRuntime.js` | The bridge to the battle simulator: generation, host callbacks, ground effects, explosions, rendering, save/load. |
| `src/region/RegionUI.js` | Setup form and the live Region overview panel. |
| `src/persistence/WorldStore.js` | IndexedDB persistence for whole worlds (separate database, never touches battle-history schema). |

## What is simulated

* **Terrain with consequences.** Elevation feeds slope speed and line of sight in the battle code. Rivers
  deeper than a unit class can wade are `deepwater` to the navigation planner; shallow fords slow movement.
  Mud, woodland, trenches, rubble and fire are folded into the same `terrainAt` record the movement,
  cover and visibility code already reads (`applyRegionGround`).
* **Deformation that sticks.** Explosions (`applyExplosion`) call `LivingSettlements.damageArea`, which
  damages people and buildings, digs a crater, scorches the ground and may ignite it. Citizens dig
  real trenches; miners lower the ground, and a deep mine can flood or collapse.
* **Economy of real things.** Fields are planted per cell, grow through crop stages with the seasons and
  are harvested by farmers into a granary. Mines draw down a finite deposit. Stores can be seized only
  if the granary stands and workers are left to carry them; a wrecked road net cuts the take.
  A settlement may also hide a stash that conquest cannot find.
* **Three AI layers.** Individual citizens run utility AI (hunger, fear, fatigue, assigned role). The
  settlement plans roles, fields, building, trenches, towers, storage, evacuation and tribute. The
  factions are the existing battle AI. `SettlementPlanner.learnFromAttack` rewrites a settlement's
  doctrine after an attack (militia share, reserve days, walls vs. trenches, scouting radius, stash,
  evacuation bias); lessons are listed in the overview panel.
* **Survivors and prisoners.** A fallen settlement yields captives, refugees and sometimes a hidden
  resistance. Fates depend on the conqueror (Imperial tithes and conscription, Ork looting and
  enslavement, Tau persuasion...). Refugees walk to other settlements or found a camp, and a large
  enough group founds a new independent settlement. Rebellion is a *roll* driven by grievance, garrison
  strength and food, never automatic.
* **Simulation LOD.** Settlements near the camera are simulated per person; distant ones run an abstract
  production/consumption step.

## Playing it

1. Menu → **Single region · living world**. Choose a seed, biome, mountains, rivers, lakes, woodland,
   deposit counts and any number (1–8) of settlements, each with population, farmland, militia share,
   culture, ruler (independent or one of the two armies) and whether it has a mine.
2. Two armies (Space Marines and Orks by default) deploy on flattened ground in opposite corners.
3. The toolbar **Region** button opens the overview: season, weather, fires, every settlement's
   roles, food days, doctrine and lessons, plus a chronicle. From there you can **found a settlement**
   at the camera centre, **remove** one, or **save** the world.
4. The world autosaves to IndexedDB every 45 s of play; **Continue saved region** on the menu restores
   terrain, deformation, crops, people and doctrines (armies start fresh).

## Hooks and diagnostics

`document.querySelector("#autonomous-war-theater")` exposes:

* `awtRegion` – the runtime (`overview()`, `chronicle()`, `environment()`, `addSettlementAt()`, `serialize()`).
* `awtWorld` – `save(slot)`, `load(slot)` and the raw store.
* `awtDebugTools.advance(seconds)` – headless fast-forward; `deployArmy(faction, x, y)` – instant invasion.

## Tests

`test/world-dynamics.test.js`, `test/living-settlements.test.js` and `test/region-runtime.test.js` cover
terrain deformation, ecology, a peaceful year, repelled and successful invasions, conquest aftermath,
doctrine adaptation, save/load, and the app-facing runtime (settlement count configuration, ground effects,
founding/removing settlements, IndexedDB round trip).
