# Autonomous War Theater — local edition

A browser-based top-view battle and map simulator with a four-layer economy, physical logistics, AI construction, building hitboxes and HP, territory capture, editable spawn areas, fog, an independent pan/zoom camera, chunked terrain painting, random maps, a minimap, and optional lighting.

## Run it

From this folder, either open `index.html` directly or start a local server:

```powershell
.\scripts\start.ps1
```

Then visit `http://localhost:8080`.

## Project layout

```text
assets/
  buildings/             Faction economy sprites
  terrain/               Terrain and object atlas
css/
  tokens.css             Theme variables and full-screen shell
  components.css         Reusable controls and panels
  simulator.css          Map, editor, logistics, and responsive layout
js/
  modules/
    faction-config.js    Faction buildings, builders, units, and deployment identities
    environment-config.js Collision layers and shapes for trees, rocks, ruins, and debris
    economy-config.js    Resource list, starting stockpiles, capacities
    trade-routes.js      Establishment rules; routes begin unlinked
    ai-config.js         Relationships, formations, route orders, and Guard squad templates
    storage-adapter.js   Local scenario save/load helper
  app.js                 Simulation, rendering, AI, editor, and input
sql/
  migrations/            Core, economy/logistics, and indexes
  seeds/                 Resource, building, and starting-stock data
  views/                 Economy, trade, and AI queue queries
scripts/
  start.ps1              Local web server helper
```

## Economy rules in this build

- Every player starts with the larger stockpile defined in both `economy-config.js` and `003_starting_stockpiles.sql`.
- A trade partner can exist on the map without a route.
- The AI must first complete a headquarters and warehouse, then spend 40 Influence and 25 Materials to establish its route.
- No trade road or trade convoy is created before that establishment succeeds.
- Production, storage, transportation, and consumption are modeled separately. Warehouse loss, convoy jobs, rerouting, shortage priorities, and logistics officers are part of the runtime simulation.
- Builders continuously choose economy, research, army, gathering, storage, and defense projects while funding and valid collision-free sites remain.
- Faction-specific research centers consume physically delivered energy, materials, influence, and parts; completed research levels improve newly deployed units.
- Buildings reserve collision boxes from the foundation stage, block movement and projectiles, retain HP and armor, and can be selected as combat targets.
- Combat uses traveled projectiles, hit probability, penetration, body zones, bleeding, suppression, fire discipline, vehicle subsystem damage, and a deterministic battle seed.
- The simulation advances at a fixed 20 Hz timestep and uses a spatial combat index plus slower economy and strategic update rates.

## Four-level AI and route warfare

The AI resolves decisions through a hierarchy: army goal → commander order → squad order and formation → individual choice. Emergency retreat and immediate survival remain individual overrides.

- Individuals keep sparse, directed relationships from -100 to 100. Fighting together, protection, battlefield rescue, repairs, shared supplies, successful orders, abandonment, ignored escort requests, exposure, rivalry, and kills can move another unit through strong bond, friendly, familiar, neutral, not close, disliked, and hated-but-tolerated bands.
- Builders can join allied construction, repair allied assets and roads, share field supplies, and request squad protection when local danger exceeds their personal risk tolerance. Escort selection uses trust as a bounded preference, while dislike can slow cooperation without overriding military orders.
- Combatants cache a kill-confidence assessment built from readiness, nearby support, target vulnerability, morale, aggression, weapon advantage, threat, distance, ammunition, fatigue, and isolation. Their intent becomes eliminate, force retreat, suppress, or ignore, with a bounded pursuit leash.
- Squads own their target, objective, route order, formation, heading, cohesion, and reinforcement state. Supported formations are line, column, wedge, triangle, circle, staggered, flanking, and escort; collision and terrain checks let them deform rather than lock units into exact slots.
- Imperial Guard barracks deploy complete named squads in a single atomic wave. Standard infantry, heavy weapons, command, veteran, and conscript templates include leaders, weapons, specialists, and attachments. Damaged Guard squads can receive a locked replacement manifest, rendezvous with its physical detachment, use an acting officer, return to base, merge, reconstitute after annihilation, or disband and redistribute compatible survivors.
- Generated roads now retain stable IDs and segment-level type, condition, width, capacity, traffic, control, visibility, cover, supply importance, ambush risk, and operational flags across network rebuilds. Convoys use these routes and inherit their condition, congestion, damage, and threat costs.
- Commanders can hold, block, patrol, observe, escort, keep open, delay on, demolish if overrun, or ambush routes. Orders pin a tactical segment and advance through distinct phases; patrols follow road waypoints, checkpoints and observation posts persist, roadblocks can be overrun, Guard mine ambushes strike convoys, and demolition guards collapse a bridge or crater a segment once before regrouping.

## Territory, faction ecology, and environmental collision

- Each army owns one cell-backed primary territory. Strategic AI expands or contracts that shape by transferring 96 px cells; it does not create a new polygon object for every frontier step.
- Cells distinguish influence, supplied control, contested pressure, capture, and disconnected land. Unsupported disconnected cells can be abandoned, while outposts secure cells into the same primary shape.
- Ork armies begin with Gretchin builders. Their camps use Ork names, mobs become more confident around fights, deaths seed Orkoid spore patches, and the strongest surviving contender can take over as Warboss.
- Tyranid forces arrive through Mycetic Spores, Tyrannocytes, Brood Nests, and infestation organisms. Lesser organisms coordinate under synapse, fall back to instinctive behavior when isolated, and reclaim battlefield biomass.
- Space Marine Drop Pods are optional strategic transport. The AI scores candidate landing zones across friendly, allied, neutral, and hostile ground for terrain, collision clearance, anti-air risk, local danger, objectives, cover, and escape routes.
- Trees, rocks, ruins, wreckage, crates, barricades, and fallen logs have movement and projectile hitboxes separate from their art. Canopies can block sight without using the whole crown as a movement collider; multi-trunk clusters use several circles; logs use capsules; debris uses rotated boxes.
- Units slide around obstructions and repath when stuck. Heavy vehicles can crush weak cover, builders can clear removable debris, projectiles can destroy obstacles, and fallen trees or wreckage can dynamically obstruct roads.

## Casualties, army depth, and faction formations

- Personnel move through Healthy, Injured, Gravely Injured, Incapacitated, and Dead states. Wounds reduce accuracy and movement; incapacitated units stop fighting, may crawl, can be stabilized under safe conditions, and are carried to an aid station only after the local fight permits it.
- Dead troops leave faction-aware battlefield value: recoverable equipment, Space Marine gene-seed, Ork loot and spores, or Tyranid biomass.
- Extractors now depend on visible materials, fuel, food, or energy deposits. Deposits yield less at 75%, 45%, and 20% reserve, eventually empty, and reward armies willing to secure distant high-richness nodes.
- Army food, fuel, ammunition, morale, and logistics pressure scale above the support capacity of controlled territory and completed infrastructure. The logistics panel reports operational forces, production, reinforcement routes, and territory pressure.
- Barracks deploy atomic faction formations: five- or ten-member Space Marine combat squads, Ork mobs, Tyranid broods, Necron phalanxes, Tau Fire Warrior teams, and the existing detailed Imperial Guard squad manifests. Faction specialists still deploy individually.
- Victory follows military capability rather than painted map area. The evaluator checks combat-capable units, rebuilding production, reinforcement routes, commanders with forces, and allied rescue capacity; faction temperament determines withdrawal, surrender, or a last stand.
- `unit-sprite-forge.js` adapts the supplied Aegis, Iron Legion, and Ork forge silhouettes into live recolorable Space Marine, Imperial Guard, and Ork infantry, character, walker, vehicle, and aircraft sprites.

## Initialize a SQLite database

If `sqlite3` is installed:

```powershell
sqlite3 awt.db ".read sql/migrations/001_core.sql"
sqlite3 awt.db ".read sql/migrations/002_economy_logistics.sql"
sqlite3 awt.db ".read sql/migrations/003_indexes.sql"
sqlite3 awt.db ".read sql/migrations/004_construction_combat.sql"
sqlite3 awt.db ".read sql/seeds/001_resources.sql"
sqlite3 awt.db ".read sql/seeds/002_buildings.sql"
sqlite3 awt.db ".read sql/seeds/003_starting_stockpiles.sql"
sqlite3 awt.db ".read sql/seeds/004_factions.sql"
sqlite3 awt.db ".read sql/views/economy_status.sql"
sqlite3 awt.db ".read sql/views/construction_combat_status.sql"
```

The browser prototype does not require SQLite to run. The SQL schema is ready for a later local server or save-game layer.

## World and camera architecture

The battlefield is independent from the display surface:

- The main canvas is always a 1920 × 1080 backing viewport and scales to the browser window with CSS.
- Worlds can be Small (4096²), Medium (8192²), Large (16384²), Massive (32768²), or custom up to 65536².
- World-space units, buildings, roads, projectiles, territories, and simulation systems continue updating whether or not the camera can see them.
- Terrain is stored sparsely as 64 × 64 tiles grouped into 256 × 256 chunks. Empty chunks are never allocated.
- Terrain features are indexed into every chunk they touch. Render passes query only the camera rectangle plus a small buffer.
- Moving units update reusable spatial-index buckets instead of rebuilding separate combat and render maps; dead objects remain available for battlefield history without entering combat queries.
- Overview zooms use cached per-chunk terrain previews plus screen-cell unit/building clusters instead of drawing every object at full detail.
- The minimap caches terrain, throttles aggregated object markers, respects faction fog, and shows the current camera as a white rectangle. Click or drag it to recenter the camera.
- Fog exploration advances from all faction vision sources in the simulation tick, so panning the camera never discovers terrain and offscreen units still explore normally.
- Fog visibility rasterizes exact source ranges into reusable 64 px bit masks, so overlapping armies deduplicate coverage without per-source string sets.
- Dynamic lighting uses a viewport-sized offscreen layer; it never allocates a world-sized bitmap.

Camera controls:

- Middle mouse drag, right mouse drag, or Space + left drag: pan.
- Mouse wheel: zoom toward the pointer.
- Ctrl + mouse wheel: fine zoom toward the pointer.
- Zoom selector: Fit, 10%, 25%, 50%, 100%, 200%, or 400%.
- `−` / `+`: step through the standard zoom levels.

`Fit` is computed from the world and viewport aspect ratios. For example, a square 16384² world fits a 16:9 viewport at about 6.6%, so it is intentionally separate from the 10% preset.
