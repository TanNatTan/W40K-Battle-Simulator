# Autonomous War Theater — local edition

A browser-based top-view battle and map simulator with a map-authored economy, physical logistics, AI construction, building hitboxes and HP, territory capture, editable spawn areas, fog, an independent pan/zoom camera, chunked terrain painting, random terrain, a minimap, and a lightweight global day/night cycle.

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
    *.js                 Exportable compatibility modules being migrated into src/
  app.js                 Legacy compatibility runtime; systems leave this file incrementally
src/
  main.js                ES-module application entry point
  config/                Application constants and explicit runtime configuration exports
  economy/               Authored polygon zones and economic landmarks
  territory/             Fixed irregular cell pool, objectives, combat, and victory
  logistics/             Road graph, temporary supply routes, convoys, Route AI, and audit history
  diagnostics/           Throttled runtime telemetry and opt-in system profiling
  replay/                Replay analysis and bounded snapshot storage
  simulation/            Fixed-step budgeting and simulation lifecycle modules
  utilities/             Shared math, formatting, and deterministic random helpers
test/
  foundation.test.js     Module-boundary and utility regression checks
sql/
  migrations/            Core, economy/logistics, and indexes
  seeds/                 Resource, building, and starting-stock data
  views/                 Economy, trade, and AI queue queries
scripts/
  start.ps1              Local web server helper
  check.mjs              JavaScript syntax and foundation test runner
```

## JavaScript foundation

The browser now starts from `src/main.js` as a native ES module. Existing configuration files expose named exports while retaining a temporary `AWTModules` bridge for compatibility with the current runtime. New systems should import dependencies explicitly and live under `src/`; do not add new simulation responsibilities to `js/app.js`.

Run the foundation checks with:

```powershell
node scripts/check.mjs
```

Run the headless browser and interactive-minimap smoke test with:

```powershell
npm.cmd run smoke
```

The migration is intentionally incremental: `js/app.js` remains operational while engine, simulation, rendering, AI, and UI systems are extracted behind stable module APIs.

## Performance controls

- Canvas drawing no longer performs the expensive diagnostic world scans. Runtime telemetry is collected outside rendering once per second and updates DOM dataset values only when they change.
- Fixed 30 Hz simulation catch-up is limited to three updates and an 8 ms work budget per animation frame. Precision projectile combat can use two substeps, while doctrine-specific perception, squad, commander, and strategy decisions use accumulator cadence gates. Excess backlog is capped so a slow frame degrades into controlled slow motion instead of a self-reinforcing freeze.
- Uncached A* searches consume a scale-aware per-step budget and use smaller expansion limits in Major and Total Battlefield modes. Cached routes remain available without consuming that budget, while excess requests are staggered across later ticks.
- A module worker builds coarse distant-unit neighbor lists and faction pressure summaries. Offscreen AI reuses those hints, idle and engaged distant forces run at separate cadences, and nearby combat remains fully responsive.
- Projectile collision and suppression query the shared spatial grid instead of scanning every unit and structure. Projectile arrays are compacted in place and high-churn projectile objects are recycled.
- Unit separation reuses the shared moving-object grid rather than allocating another grid every separation pass; target and proximity sensing start at deterministic offsets to avoid synchronized LOS spikes.
- Replay snapshots use a fixed-capacity buffer, compact structure records, and territory revisions/counts instead of retaining another full territory-cell copy every snapshot.
- Add `?profile` to the simulator URL to enable timing for simulation, rendering, and UI work. Inspect `awtProfiler.report()` in the browser console and call `awtProfiler.reset()` between measurements.
- Day/night rendering uses one viewport tint and one faction-aware visibility multiplier. Dynamic shadows, radial artificial-light gradients, searchlights, per-location light sampling, and decorative light vision sources are not part of the live render or detection paths.

## Force commitment and faction economies

- The roster is available from the beginning; there are no technology unlock tiers. Contact, Engagement, Major Battle, Decisive Commitment, and All-In describe how much of the finite force the AI is willing to deploy.
- Headquarters danger, objective importance, enemy pressure, casualties, territory pressure, time, and proximity to victory recalculate commitment. All-In spends reserves, prioritizes military construction, and suspends nonessential research.
- Battle-scale capacity is distributed by faction density, so elite Space Marines field fewer bodies while Guard, Orks, and Tyranids receive progressively larger shares of the same simulation budget.
- Command presence follows faction hierarchy. Chapter Masters require an exceptional scenario signal; ordinary Space Marine battles use Sergeants, Lieutenants, and Captains. Ork Warboss succession remains emergent.
- Natural resource polygons are limited to materials, fuel, energy, food, scrap, and biomass. Requisition and influence are strategic; ammunition, medical supplies, and parts are operational stocks; faith is not a universal currency.
- Each faction creates only its relevant inventory and shortages. Recruitment and construction costs use that profile—for example, Tyranids spend biomass, Orks spend scrap/fuel, and Necrons spend energy/materials.
- Final storage capacity is doubled after buildings and landmarks contribute their bonuses, and each army begins with its base capacity full. Unit batches, support carriers, equipment, and special deployments are priced through the shared data-driven cost ledger.

The current Phase 0-19 implementation matrix is maintained in [`docs/phase-audit.md`](docs/phase-audit.md).

## Map-authored economy rules

- Every player starts with the larger stockpile defined in both `economy-config.js` and `003_starting_stockpiles.sql`.
- The map designer places all resource polygons, economic landmarks, and trade routes. Terrain randomization never creates or moves economic assets.
- Resource zones remain separate from terrain and define type, finite or infinite capacity, gather rate, regeneration, owner, building requirement, and collector roles.
- Economic landmarks use schema-v3 resource-flow rows: resource, produce/consume direction, rate, and enabled state. A second structured row editor defines one-time capture stock; landmark modifiers cover storage, routes, reinforcement, production, repair, research, sensors, fortification, and extraction. Existing schema-v2 and legacy import/export maps migrate automatically.
- Landmark defaults are purpose-specific. Fuel Refineries and Agri Complexes specialize heavily, while Hive Cities, Supply Depots, orbital infrastructure, fortresses, and manufactoria expose broader high-capacity economies.
- Trade routes connect authored landmarks with map-authored waypoints. Supported types are road, rail, sea, river, air, orbital, underground, and warp.
- The AI cannot create trade routes. It may use, defend, sabotage, abandon, or reroute along the links the designer supplied.
- AI logistics may create temporary supply routes for a specific delivery. These expire and never become permanent map trade routes.
- Production, storage, transportation, and consumption are modeled separately. Warehouse loss, convoy jobs, rerouting, shortage priorities, and logistics officers are part of the runtime simulation.
- Builders continuously choose economy, research, army, gathering, storage, and defense projects while funding and valid collision-free sites remain.
- Faction-specific research centers consume physically delivered energy, materials, influence, and parts; completed research levels improve newly deployed units.
- Buildings reserve collision boxes from the foundation stage, block movement and projectiles, retain HP and armor, and can be selected as combat targets.
- Combat is data-driven through `data/weapons.json`: magazines, reloads, heat, target restrictions, traveled projectiles, misses, cover interception, splash damage, tracer trails, projectile pooling, armor facing, ricochets, critical subsystem damage, and distinct melee wind-up/recovery/block/parry/cleave/charge behavior all run in the live simulation.
- The simulation advances at a fixed 30 Hz timestep and uses a spatial combat index plus doctrine-specific multi-rate AI, slower economy and strategic work, and activity-level cadence reduction for large battles.

## Four-level AI and route warfare

The AI resolves decisions through a hierarchy: army goal → commander order → squad order and formation → individual choice. Emergency retreat and immediate survival remain individual overrides.

- Player setup selects a universal Battle Objective. AI doctrine, behavior presets, and temperament sliders are intentionally absent: race and subfaction identity determine the method, while casualties, morale, supply, resources, territory, time, observed enemy behavior, and battlefield pressure continuously recalculate aggression, caution, expansion, and economy tendencies.
- Eighteen data-driven objectives cover annihilation, headquarters destruction, territory, strategic points, resources, breakthrough, stronghold assault/defense, convoy escort/interdiction, extraction, survival, delay, assassination, sabotage, relic recovery, evacuation, and last stand. Each race presents its own name and interpretation without changing the shared victory rule.
- Subfaction objective signals influence strategic attack/defend/expand/research/logistics/regroup scoring, target selection, construction, repairs, formations, deployments, route behavior, and territory pressure. The objective determines victory; the subfaction determines how the army attempts it.
- The theater clock runs independently from battle pause at 1×, 4×, 12×, or 24×. A lightweight global day/night tint and visibility multiplier replace per-light dynamic shadows; saved snapshots retain clock state.
- Built-in scenarios and the local test-map save/load slot use an exact 1920 × 1080 world for repeatable testing. Larger custom worlds can still be authored, and saving scales them into the 1920 × 1080 test slot.

- Individuals keep sparse, directed relationships from -100 to 100. Fighting together, protection, battlefield rescue, repairs, shared supplies, successful orders, abandonment, ignored escort requests, exposure, rivalry, and kills can move another unit through strong bond, friendly, familiar, neutral, not close, disliked, and hated-but-tolerated bands.
- Builders can join allied construction, repair allied assets and roads, share field supplies, and request squad protection when local danger exceeds their personal risk tolerance. Escort selection uses trust as a bounded preference, while dislike can slow cooperation without overriding military orders.
- Combatants cache a kill-confidence assessment built from readiness, nearby support, target vulnerability, morale, aggression, weapon advantage, threat, distance, ammunition, fatigue, and isolation. Their intent becomes eliminate, force retreat, suppress, or ignore, with a bounded pursuit leash.
- Squads own their target, objective, route order, formation, heading, cohesion, and reinforcement state. Supported formations are line, column, wedge, triangle, circle, staggered, flanking, and escort; collision and terrain checks let them deform rather than lock units into exact slots.
- The army allocator assigns P1 offense before specialist duties: normally at least 62% of ready squads attack, capture detachments receive 15–20%, and defense, reinforcement, reconnaissance, route security, escort, and reserve roles have strict caps. A severe base emergency may borrow defenders without reducing offense to zero.
- Imperial Guard barracks deploy complete named squads in a single atomic wave. Standard infantry, heavy weapons, command, veteran, and conscript templates include leaders, weapons, specialists, and attachments. Damaged Guard squads can receive a locked replacement manifest, rendezvous with its physical detachment, use an acting officer, return to base, merge, reconstitute after annihilation, or disband and redistribute compatible survivors.
- Local service roads and map-authored trade routes retain stable IDs and segment-level type, condition, width, capacity, traffic, control, visibility, cover, supply importance, ambush risk, and operational flags across network rebuilds. Convoys use these routes and inherit their condition, congestion, damage, and threat costs.
- Commanders can hold, block, patrol, observe, escort, keep open, delay on, demolish if overrun, or ambush routes. Orders pin a tactical segment and advance through distinct phases; patrols follow road waypoints, checkpoints and observation posts persist, roadblocks can be overrun, Guard mine ambushes strike convoys, and demolition guards collapse a bridge or crater a segment once before regrouping.

## Chaos operational AI and runtime optimization

- Chaos uses a persistent Assess → Shape → Commit → Exploit → Consolidate/Recover → Endgame planner layered between Battle Objectives and the shared strategic AI. Emergency transitions can interrupt a plan, while commitment windows prevent utility-score oscillation.
- Black Legion, Iron Warriors, Word Bearers, Night Lords, Alpha Legion, Emperor's Children, World Eaters, Death Guard, Thousand Sons, and the four daemon hosts each resolve distinct strategic weights, thresholds, target policy, construction bias, reserve policy, and objective-specific methods.
- Battle Objectives remain authoritative. Aggressive branches use objective leashes for escort, evacuation, and defense; stealth/deception branches score only observed targets and never gain hidden-state information.
- All factions now move through Assess, Shape, Commit, Exploit, Consolidate, Recover, and Endgame phases. A universal objective leash keeps at least one objective-relevant strategic choice above a minimum utility floor, so personality changes the method rather than the victory condition.
- Chaos differences are capability-based as well as weight-based. Every legion and daemon host has at least three available battlefield actions, while persistent corruption, god favor, glory, ritual charge, Warp instability, sacrifice value, daemon reserve power, and enemy fear determine which actions are currently legal.
- Territory expansion rebuilds one strategic spatial index per strategic tick, then queries local unit, structure, resource, and landmark buckets instead of scanning whole battlefield arrays for every candidate cell.
- Resource-zone polygon centroid, bounds, and area are revision-cached. Extraction and regeneration update stock only and do not recalculate unchanged geometry.
- Route validation and scoring use stable landmark-ID maps and allocation-free best-choice scans. Target selection and strategic choice selection also avoid hot-path sorting.
- Major and Total Battlefield worker updates pack distant-unit numeric state into transferable typed arrays, use numeric spatial keys, and return fixed-size typed neighbor buffers. This removes per-unit structured cloning from the main-thread/worker boundary.
- Add `?profile` to the URL to collect named simulation, AI, economy, territory, render, and minimap spans with p50/p90/p95/p99, maximum, over-budget count, and calls per second.

## Territory, faction ecology, and environmental collision

- Each army competes over a fixed pool of irregular Voronoi-style polygon cells. Claiming, losing, reclaiming, contesting, and abandoning mutate that pool; expansion never allocates a replacement territory object.
- Strategic point, critical location, trade station, bridge, relay, spaceport, high ground, and resource hub objectives alter control value, road access, supply, resources, or defense.
- Territory contests consume faction garrisons, record casualties, and raise the stakes around objectives and bases. Their aggression follows the armies' live objective-derived behavior; the territory layer no longer declares victory independently from the selected battle objective.
- Ork armies begin with Gretchin builders. Their camps use Ork names, mobs become more confident around fights, deaths seed Orkoid spore patches, and the strongest surviving contender can take over as Warboss.
- Tyranid forces arrive through Mycetic Spores, Tyrannocytes, Brood Nests, and infestation organisms. Lesser organisms coordinate under synapse, fall back to instinctive behavior when isolated, and reclaim battlefield biomass.
- Space Marine Drop Pods are optional strategic transport. The AI scores candidate landing zones across friendly, allied, neutral, and hostile ground for terrain, collision clearance, anti-air risk, local danger, objectives, cover, and escape routes.
- Trees, rocks, ruins, wreckage, crates, barricades, and fallen logs have movement and projectile hitboxes separate from their art. Canopies can block sight without using the whole crown as a movement collider; multi-trunk clusters use several circles; logs use capsules; debris uses rotated boxes.
- Units slide around obstructions and repath when stuck. Heavy vehicles can crush weak cover, builders can clear removable debris, projectiles can destroy obstacles, and fallen trees or wreckage can dynamically obstruct roads.

## Casualties, army depth, and faction formations

- Personnel move through Healthy, Injured, Gravely Injured, Knocked Down, Incapacitated, and Dead states. Force-level triage creates casualty collection points; medics stop bleeding, stabilize, drag under fire, carry after danger, and restore limited duty. Apothecary, Imperial medic, Painboy, Tau drone, Necron reanimation, Tyranid regeneration, and Chaos ritual policies remain faction-specific.
- Dead troops leave faction-aware battlefield value: recoverable equipment, Space Marine gene-seed, Ork loot and spores, or Tyranid biomass.
- Extractors now depend on visible or map-authored resource zones. The editor supports polygon pen/add/delete/move/bend/close tools plus type, capacity, gather rate, regeneration, owner, building requirement, and allowed collectors. AI territory and capture-squad scoring combines current shortages with faction priorities: Orks strongly seek scrap, Tyranids strongly seek biomass, and every army tracks food. Depleting deposits still force outward expansion.
- Completed headquarters replace lost builders and produce dedicated faction-named supply carriers. Builders and carriers physically enter captured zones, gather cargo, return it to the nearest warehouse or headquarters, and can flee when hostile proximity makes a haul unsafe. Carrier assignments persist through pickup, loading, delivery, unloading, and return cycles; source count, distance, and output determine workforce demand.
- Nearby detected enemies drive per-unit Calm, Wary, Tense, Afraid, or Aggressive states. The state changes combat commitment, aim, firing cadence, movement, retreat behavior, inspector text, and an on-map alert ring; spatially throttled sensing keeps the reaction affordable in large battles.
- Army food, fuel, ammunition, morale, and logistics pressure scale above the support capacity of controlled territory and completed infrastructure. The logistics panel reports operational forces, production, reinforcement routes, and territory pressure.
- Barracks deploy atomic faction formations: five-member Space Marine combat squads, three- to six-member Chaos warbands led by an Aspiring Champion, Ork mobs, Tyranid broods, Necron phalanxes, Tau Fire Warrior teams, and the existing detailed Imperial Guard squad manifests. Ten-Marine formations now come from reinforcement/merging rather than routine production. Space Marine chapters select diverse, counter-aware wargear from data without exceeding specialist/heavy limits.
- Victory follows the selected Battle Objective. The evaluator tracks authored territory, strategic/resource nodes, headquarters, breakthrough distance, convoy outcomes, commanders, infrastructure, extraction/relic locations, evacuation, and timed holds; military capability still determines defeat, withdrawal, surrender, or a last stand during that pursuit.
- `unit-sprite-forge.js` adapts the supplied Aegis, Iron Legion, and Ork forge silhouettes into live recolorable Space Marine, Imperial Guard, and Ork infantry, character, walker, vehicle, and aircraft sprites.

## Initialize a SQLite database

If `sqlite3` is installed:

```powershell
sqlite3 awt.db ".read sql/migrations/001_core.sql"
sqlite3 awt.db ".read sql/migrations/002_economy_logistics.sql"
sqlite3 awt.db ".read sql/migrations/003_indexes.sql"
sqlite3 awt.db ".read sql/migrations/004_construction_combat.sql"
sqlite3 awt.db ".read sql/migrations/005_ai_relationship_learning.sql"
sqlite3 awt.db ".read sql/migrations/006_authored_economic_map.sql"
sqlite3 awt.db ".read sql/migrations/007_route_and_territory_history.sql"
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
