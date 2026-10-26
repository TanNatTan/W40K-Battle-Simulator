# Map workshop

**Menu → Map workshop · build a region** opens a full-screen editor for the same ground the
*Single region · living world* scenario plays on. Whatever you build there is deployed as the battle:
the terrain, forests, fields, water, ore, settlements and both armies' starting positions are used exactly as authored.
(The older tile editor is still on the menu as **Classic tile editor**.)

## Making a map

The workshop opens on a generated region. From there you can reshape it, or press **Blank meadow** under
*Generate or reset terrain* to start from flat grass. *Generate region* rebuilds a whole region from a seed, biome,
relief, rivers, lakes, woodland, ore counts and settlement count; the armies' bases stay level and dry.

| Group | Tools | Notes |
| --- | --- | --- |
| Sculpt | Raise, Lower, Smooth, Flatten, Plateau, Ridge, Roughen, Terrace | Brush size and strength in the side panel. Flatten and Plateau level to the height where the stroke started. |
| Water | Dig water, Dry land | Anything below the waterline floods. Digging drowns trees and fields there; Dry land raises the bank and drains it. |
| Land cover | Forest, Scrub, Meadow, Fields, Clear | Fields only go on gentle slopes and are what settlements farm. Nothing is painted under water. |
| Ground | Rich soil, Dry earth, Mud, Dirt track, Scorched, Rock | Changes fertility, moisture and wear, which the battle's ground-effects code reads (mud slows, rock is barren). |
| Resources | Iron ore, Promethium, Stone, Remove | Deposits are mined by settlements that have a mine. Toggle *Resources* to see them. |
| Places | Settlement, Army base, Inspect | Click open ground to found a settlement; drag to move. Drag each army's banner. Select to edit name, population, farmland, militia, culture, ruler and mine. |

Controls: drag with the tool; right mouse button, middle button, Space-drag or the Pan tool to move the view;
scroll to zoom; `[` and `]` change brush size; `Ctrl+Z` / `Ctrl+Shift+Z` undo and redo (80 steps); `G` grid; `F` fit; `Delete` removes the selected
settlement; number keys 1–9 pick common tools.

The **Checks** panel lists problems: a base underwater or on uneven ground (with a *Fix* button that levels it),
armies starting too close, settlements underwater, with no flat farmland, or with a mine and no ore nearby.
Errors block *Play this map*; warnings do not.

## Saving

*Save* keeps the map in the browser (IndexedDB, same store as saved worlds, slots prefixed `map:`), *Open…* lists them, and the workshop
keeps an autosaved draft. *Export* downloads a `.region.json` file and *Import* loads one.

## How it fits together

| Module | Role |
| --- | --- |
| `src/workshop/RegionWorkshop.js` | The model: height field and layers, tools, settlements, bases, checks, payloads. No DOM, fully tested. |
| `src/workshop/WorkshopHistory.js` | Undo/redo. Strokes store only the chunks they touched; generation and loading store snapshots. |
| `src/workshop/WorkshopView.js` | Canvas view using the battle's terrain shader and vegetation baker (worker pool when available). |
| `src/workshop/WorkshopUI.js`, `css/workshop.css` | The screen: palette, panel, status bar, save/open dialog. |
| `src/region/RegionRuntime.js` | `begin(config, bases, saved, authored)` adopts an authored ground; settlements carrying `x`/`y` are placed exactly there. |
