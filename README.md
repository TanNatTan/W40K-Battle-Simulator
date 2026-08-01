# Autonomous War Theater — local edition

A browser-based top-view battle and map simulator with a four-layer economy, physical logistics, AI construction, building hitboxes and HP, territory capture, editable spawn areas, fog, zoom, right-drag camera movement, terrain painting, random maps, and optional lighting.

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
    economy-config.js    Resource list, starting stockpiles, capacities
    trade-routes.js      Establishment rules; routes begin unlinked
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
