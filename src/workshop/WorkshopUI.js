// The region workshop screen: a full-screen editor with a tool palette, the map, a context panel
// (brush, generator, inspector, checks) and a status bar. Pure DOM; the model is RegionWorkshop
// and the renderer is WorkshopView.

import { RegionWorkshop, TOOL_GROUPS, BRUSH_TOOLS, MAX_SETTLEMENTS, MIN_PLAYERS, MAX_PLAYERS, PLAYER_IDS, WORLD_PRESETS, REGION_WORLD_LIMITS } from "./RegionWorkshop.js";
import { WorkshopView } from "./WorkshopView.js";
import { REGION_CULTURES, DEFAULT_REGION_CONFIG } from "../region/RegionRuntime.js";

const esc = value => String(value ?? "").replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const GROUP_COLORS = { terrain: "#c9a46a", water: "#5aa7e0", cover: "#6fb36f", ground: "#a98466", resources: "#d6c35a", places: "#e0786a" };
const TOOL_KEYS = { raise: "1", lower: "2", smooth: "3", flatten: "4", forest: "5", crops: "6", dig: "7", settlement: "8", base: "9" };
const BIOMES = [["temperate", "Temperate"], ["forest", "Woodland"], ["desert", "Desert"], ["frozen", "Frozen"], ["volcanic", "Volcanic"], ["wetland", "Wetland"]];
const SLIDER_OPTIONS = {
  mountains: [["", "Automatic"], ["0.12", "Rolling plains"], ["0.5", "Hills"], ["0.9", "Mountains"]],
  forestDensity: [["", "Automatic"], ["0.12", "Sparse"], ["0.5", "Wooded"], ["0.9", "Dense forest"]]
};
const DRAFT_SLOT = "map:__draft__";

/**
 * `armyKit` lets the host describe armies without the workshop knowing the game's catalogue:
 *   factory(index) -> army config, races(), factions(race), subfactions(race, faction),
 *   objectives(army) -> [{ id, label }], visualDefaults(army) -> colours/pattern or null.
 */
export function createWorkshopUI({ root, store = null, armyKit = null, createWorker = null, onPlay = () => {}, onClose = () => {} }) {
  const shop = new RegionWorkshop({ armyFactory: armyKit?.factory });
  const el = document.createElement("section");
  el.className = "ws-root";
  el.hidden = true;
  el.setAttribute("aria-label", "Region workshop");
  el.innerHTML = `
    <header class="ws-header">
      <button type="button" class="ws-btn" data-act="close" title="Back to the menu">&larr; Menu</button>
      <input class="ws-name" type="text" maxlength="40" aria-label="Map name" spellcheck="false">
      <div class="ws-group">
        <button type="button" class="ws-btn" data-act="undo" title="Undo (Ctrl+Z)">Undo</button>
        <button type="button" class="ws-btn" data-act="redo" title="Redo (Ctrl+Shift+Z)">Redo</button>
      </div>
      <div class="ws-group">
        <button type="button" class="ws-btn" data-act="save">Save</button>
        <button type="button" class="ws-btn" data-act="open">Open&hellip;</button>
        <button type="button" class="ws-btn" data-act="export" title="Download as a file">Export</button>
        <button type="button" class="ws-btn" data-act="import" title="Load a map file">Import</button>
        <input type="file" accept="application/json,.json" hidden data-role="file">
      </div>
      <span class="ws-spacer"></span>
      <button type="button" class="ws-btn ws-play" data-act="play">Play this map &rarr;</button>
    </header>
    <nav class="ws-tools" aria-label="Tools"></nav>
    <div class="ws-stage">
      <canvas class="ws-canvas" tabindex="0" aria-label="Map editor. Drag with the selected tool; hold space or the right mouse button to pan; scroll to zoom."></canvas>
      <div class="ws-zoom">
        <button type="button" class="ws-btn" data-act="zoom-in" aria-label="Zoom in">+</button>
        <button type="button" class="ws-btn" data-act="zoom-out" aria-label="Zoom out">&minus;</button>
        <button type="button" class="ws-btn" data-act="fit" aria-label="Fit map" title="Fit map (F)">Fit</button>
      </div>
      <canvas class="ws-minimap" width="220" height="124" aria-label="Minimap. Click to move the view."></canvas>
      <div class="ws-toast" role="status" aria-live="polite" hidden></div>
    </div>
    <aside class="ws-side" aria-label="Options"></aside>
    <footer class="ws-status"><span data-role="hint"></span><span data-role="probe"></span></footer>
    <div class="ws-modal" hidden></div>`;
  root.appendChild(el);

  const $ = selector => el.querySelector(selector);
  const canvas = $(".ws-canvas");
  const view = new WorkshopView({ canvas, shop, createWorker });
  view.attachMinimap($(".ws-minimap"));
  const state = { openArmy: -1, sizeOpen: false, tool: "raise", radius: 70, strength: 0.5, depth: 4, selection: null, spaceDown: false, drag: null, open: false, toastTimer: 0, draftTimer: 0, genOpen: false };

  // ---- tool palette ---------------------------------------------------------------------------
  const toolbar = $(".ws-tools");
  const toolButton = (id, label, hint, color) => `<button type="button" class="ws-tool" data-tool="${id}" title="${esc(label)} — ${esc(hint)}${TOOL_KEYS[id] ? ` (${TOOL_KEYS[id]})` : ""}" style="--tool:${color}"><i></i><span>${esc(label)}</span></button>`;
  toolbar.innerHTML = `<div class="ws-tool-group">${toolButton("pan", "Pan", "Drag to move the view. You can also hold Space or use the right mouse button.", "#9aa8a0")}</div>` +
    TOOL_GROUPS.map(group => `<div class="ws-tool-group"><h3>${esc(group.label)}</h3>${group.tools.map(tool => toolButton(tool.id, tool.label, tool.hint, GROUP_COLORS[group.id])).join("")}</div>`).join("");
  const toolInfo = Object.fromEntries(TOOL_GROUPS.flatMap(group => group.tools.map(tool => [tool.id, { ...tool, group: group.id }])));
  toolInfo.pan = { id: "pan", label: "Pan", hint: "Drag to move the view.", group: "view" };

  function setTool(id) {
    if (!toolInfo[id]) return;
    state.tool = id;
    for (const button of toolbar.querySelectorAll(".ws-tool")) button.classList.toggle("is-active", button.dataset.tool === id);
    $("[data-role=hint]").textContent = `${toolInfo[id].label}: ${toolInfo[id].hint}`;
    canvas.style.cursor = id === "pan" ? "grab" : BRUSH_TOOLS.has(id) ? "none" : id === "settlement" || id === "base" ? "crosshair" : "default";
    view.cursor = null;
    renderSide();
    view.invalidate();
  }
  toolbar.addEventListener("click", event => {
    const button = event.target.closest(".ws-tool");
    if (button) setTool(button.dataset.tool);
  });

  // ---- side panel -----------------------------------------------------------------------------
  const side = $(".ws-side");
  const playerOptions = selected => [`<option value="">Independent</option>`, ...shop.armies.map((army, index) => `<option value="${PLAYER_IDS[index]}"${selected === PLAYER_IDS[index] ? " selected" : ""}>${esc(shop.armyLabel(index))}</option>`)].join("");
  const selectedSettlement = () => state.selection?.type === "settlement" ? shop.settlements.find(item => item.id === state.selection.id) : null;
  const slider = (name, label, min, max, step, value, suffix = "") => `<label class="ws-field"><span>${label}<output data-out="${name}">${value}${suffix}</output></span><input type="range" data-opt="${name}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  const selectField = (name, label, options, current) => `<label class="ws-field"><span>${label}</span><select data-gen="${name}">${options.map(([value, text]) => `<option value="${value}"${String(current ?? "") === value ? " selected" : ""}>${text}</option>`).join("")}</select></label>`;

  function renderSide() {
    const config = shop.config;
    const tool = toolInfo[state.tool];
    const brush = BRUSH_TOOLS.has(state.tool);
    const item = selectedSettlement();
    const base = state.selection?.type === "base" ? state.selection.index : null;
    const notes = shop.diagnose();
    view.notes = notes;
    const stats = shop.stats();
    side.innerHTML = `
      <section class="ws-card">
        <h2>${esc(tool.label)}</h2>
        <p class="ws-help">${esc(tool.hint)}</p>
        ${brush ? `
          ${slider("radius", "Brush size", 16, 400, 2, state.radius)}
          ${slider("strength", "Strength", 5, 100, 1, Math.round(state.strength * 100), "%")}
          ${state.tool === "dig" ? slider("depth", "Depth", 1, 12, 1, state.depth) : ""}
          <p class="ws-help ws-keys"><kbd>[</kbd> <kbd>]</kbd> change size</p>` : ""}
      </section>
      ${item ? settlementCard(item) : ""}
      ${base !== null ? baseCard(base) : ""}
      ${armiesCard()}
      ${sizeCard()}
      <details class="ws-card ws-gen"${state.genOpen ? " open" : ""}>
        <summary>Generate or reset terrain</summary>
        <p class="ws-help">Builds a whole region the way the <em>Single region</em> scenario does. Your armies' bases stay level and dry. It replaces the map, but you can undo it.</p>
        <label class="ws-field"><span>Seed</span><span class="ws-row"><input type="text" data-gen="seed" value="${esc(config.seed)}" maxlength="40"><button type="button" class="ws-btn" data-act="dice" title="Random seed">Roll</button></span></label>
        ${selectField("biome", "Biome", BIOMES.map(([v, t]) => [v, t]), config.biome)}
        ${selectField("mountains", "Relief", SLIDER_OPTIONS.mountains, config.mountains == null ? "" : String(config.mountains))}
        ${selectField("forestDensity", "Woodland", SLIDER_OPTIONS.forestDensity, config.forestDensity == null ? "" : String(config.forestDensity))}
        <div class="ws-grid3">
          <label class="ws-field"><span>Rivers</span><input type="number" data-gen="riverCount" min="0" max="5" value="${config.riverCount}"></label>
          <label class="ws-field"><span>Lakes</span><input type="number" data-gen="lakeCount" min="0" max="4" value="${config.lakeCount}"></label>
          <label class="ws-field"><span>Settlements</span><input type="number" data-gen="settlementCount" min="0" max="${MAX_SETTLEMENTS}" value="${Math.min(MAX_SETTLEMENTS, shop.settlements.length || config.settlements.length || DEFAULT_REGION_CONFIG.settlements.length)}"></label>
        </div>
        <div class="ws-grid3">
          <label class="ws-field"><span>Iron</span><input type="number" data-gen="iron" min="0" max="8" value="${config.deposits.iron}"></label>
          <label class="ws-field"><span>Promethium</span><input type="number" data-gen="promethium" min="0" max="5" value="${config.deposits.promethium}"></label>
          <label class="ws-field"><span>Stone</span><input type="number" data-gen="stone" min="0" max="8" value="${config.deposits.stone}"></label>
        </div>
        <div class="ws-row">
          <button type="button" class="ws-btn ws-primary" data-act="generate">Generate region</button>
          <button type="button" class="ws-btn" data-act="blank">Blank meadow</button>
        </div>
      </details>
      <section class="ws-card">
        <h2>Checks</h2>
        ${notes.length ? `<ul class="ws-notes">${notes.map((note, index) => `<li class="${note.level}"><button type="button" data-note="${index}">${esc(note.text)}</button>${note.fix ? `<button type="button" class="ws-btn ws-mini" data-fix="${note.fix}">Fix</button>` : ""}</li>`).join("")}</ul>` : `<p class="ws-help ws-good">Nothing to fix. Both armies have good ground.</p>`}
      </section>
      <section class="ws-card">
        <h2>Map</h2>
        <dl class="ws-stats">
          <dt>Settlements</dt><dd>${stats.settlements}</dd>
          <dt>Forest</dt><dd>${Math.round(stats.forest * 100)}%</dd>
          <dt>Water</dt><dd>${Math.round(stats.water * 100)}%</dd>
          <dt>Fields</dt><dd>${(stats.fields * 100).toFixed(1)}%</dd>
          <dt>Iron / Fuel / Stone</dt><dd>${stats.deposits.iron} / ${stats.deposits.promethium} / ${stats.deposits.stone}</dd>
          <dt>Height range</dt><dd>${stats.lowest.toFixed(0)} to ${stats.highest.toFixed(0)}</dd>
        </dl>
        <div class="ws-toggles">
          ${["grid:Grid (G)", "resources:Resources", "radius:Settlement areas", "checks:Check markers"].map(entry => { const [key, text] = entry.split(":"); return `<label><input type="checkbox" data-overlay="${key}"${view.overlays[key] ? " checked" : ""}> ${text}</label>`; }).join("")}
        </div>
      </section>`;
    syncHeader();
  }


  const SWATCH_FIELDS = [["color", "Primary"], ["secondaryColor", "Secondary"], ["tertiaryColor", "Detail"], ["bodyColor", "Armour"]];
  const PATTERNS = [["solid", "Solid"], ["vertical", "Vertical stripe"], ["diagonal", "Diagonal stripe"], ["split", "Split"], ["checker", "Checker"], ["border", "Border trim"], ["quartered", "Quartered"]];
  const options = (list, current) => list.map(entry => { const [value, label] = Array.isArray(entry) ? entry : [entry, entry]; return `<option value="${esc(value)}"${value === current ? " selected" : ""}>${esc(label)}</option>`; }).join("");

  function armyRow(army, index) {
    const open = state.openArmy === index;
    const selected = state.selection?.type === "base" && state.selection.index === index;
    const head = `<button type="button" class="ws-army-head${selected ? " is-selected" : ""}" data-army-toggle="${index}" aria-expanded="${open}"><i style="background:${esc(army.color || "#888")}"></i><span><strong>${esc(shop.armyLabel(index))}</strong><small>${esc([army.race, army.subfaction].filter(Boolean).join(" · ") || "Army")}</small></span></button>`;
    if (!open) return `<div class="ws-army">${head}</div>`;
    const kit = armyKit;
    const factions = kit ? kit.factions(army.race) : [];
    const subfactions = kit ? kit.subfactions(army.race, army.faction) : [];
    const objectives = kit ? kit.objectives(army) : [];
    return `<div class="ws-army is-open">${head}<div class="ws-army-body">
      <label class="ws-field"><span>Name</span><input type="text" maxlength="20" data-af="name" data-army="${index}" value="${esc(army.name)}"></label>
      ${kit ? `
      <label class="ws-field"><span>Race</span><select data-af="race" data-army="${index}">${options(kit.races(), army.race)}</select></label>
      <label class="ws-field"><span>Army / faction</span><select data-af="faction" data-army="${index}">${options(factions, army.faction)}</select></label>
      <label class="ws-field"><span>Subfaction</span><select data-af="subfaction" data-army="${index}">${options(subfactions, army.subfaction)}</select></label>
      <label class="ws-field"><span>Team</span><select data-af="team" data-army="${index}">${options([["1", "Team 1"], ["2", "Team 2"], ["3", "Team 3"], ["4", "Team 4"]], String(army.team))}</select></label>
      <label class="ws-field"><span>Battle objective</span><select data-af="battleObjective" data-army="${index}">${options(objectives.map(entry => [entry.id, entry.label]), army.battleObjective)}</select></label>` : ""}
      <div class="ws-swatches">${SWATCH_FIELDS.map(([key, label]) => `<label><span>${label}</span><input type="color" data-af="${key}" data-army="${index}" value="${esc(army[key] || army.color || "#888888")}"></label>`).join("")}</div>
      <label class="ws-field"><span>Pattern</span><select data-af="pattern" data-army="${index}">${options(PATTERNS, army.pattern || "solid")}</select></label>
      <div class="ws-row"><button type="button" class="ws-btn" data-act="centre-army" data-army="${index}">Show base</button><button type="button" class="ws-btn" data-act="level-army" data-army="${index}">Level base</button></div>
    </div></div>`;
  }

  function armiesCard() {
    return `<section class="ws-card ws-armies">
      <h2>Armies</h2>
      <label class="ws-field"><span>Players<output>${shop.armies.length}</output></span><input type="range" min="${MIN_PLAYERS}" max="${MAX_PLAYERS}" step="1" value="${shop.armies.length}" data-players></label>
      ${shop.armies.map(armyRow).join("")}
    </section>`;
  }

  function sizeCard() {
    const world = shop.world;
    const preset = WORLD_PRESETS.find(entry => entry.width === world.width && entry.height === world.height);
    return `<details class="ws-card ws-size"${state.sizeOpen ? " open" : ""}>
      <summary>Map size · ${world.width} × ${world.height}</summary>
      <label class="ws-field"><span>Preset</span><select data-size="preset">${WORLD_PRESETS.map(entry => `<option value="${entry.id}"${preset?.id === entry.id ? " selected" : ""}>${entry.label}</option>`).join("")}<option value="custom"${preset ? "" : " selected"}>Custom</option></select></label>
      <div class="ws-grid3">
        <label class="ws-field"><span>Width</span><input type="number" data-size="width" min="${REGION_WORLD_LIMITS.minWidth}" max="${REGION_WORLD_LIMITS.maxWidth}" step="${REGION_WORLD_LIMITS.step}" value="${world.width}"></label>
        <label class="ws-field"><span>Height</span><input type="number" data-size="height" min="${REGION_WORLD_LIMITS.minHeight}" max="${REGION_WORLD_LIMITS.maxHeight}" step="${REGION_WORLD_LIMITS.step}" value="${world.height}"></label>
        <label class="ws-field"><span>&nbsp;</span><button type="button" class="ws-btn ws-primary" data-act="apply-size">Apply</button></label>
      </div>
      <p class="ws-help">Resizing keeps the middle of the map; new ground is meadow and anything outside is clipped (undo restores it). Bigger maps cost more on slow PCs: ${world.width * world.height > 3840 * 2160 ? "<strong>this size may run slowly.</strong>" : "this size is fine."}</p>
    </details>`;
  }

  function settlementCard(item) {
    return `<section class="ws-card ws-inspector">
      <h2>Settlement</h2>
      <label class="ws-field"><span>Name</span><input type="text" data-set="name" value="${esc(item.name)}" maxlength="28" placeholder="Random name"></label>
      <label class="ws-field"><span>Population<output>${item.population}</output></span><input type="range" data-set="population" min="8" max="120" step="1" value="${item.population}"></label>
      <label class="ws-field"><span>Farmland<output>${item.farmland.toFixed(1)}×</output></span><input type="range" data-set="farmland" min="0.3" max="2" step="0.1" value="${item.farmland}"></label>
      <label class="ws-field"><span>Militia<output>${Math.round(item.militiaShare * 100)}%</output></span><input type="range" data-set="militiaShare" min="0" max="50" step="1" value="${Math.round(item.militiaShare * 100)}"></label>
      <label class="ws-field"><span>Culture</span><select data-set="culture">${REGION_CULTURES.map(culture => `<option value="${culture}"${item.culture === culture ? " selected" : ""}>${culture[0].toUpperCase()}${culture.slice(1)}</option>`).join("")}</select></label>
      <label class="ws-field"><span>Ruler</span><select data-set="owner">${playerOptions(item.owner)}</select></label>
      <label class="ws-check"><input type="checkbox" data-set="mine"${item.mine ? " checked" : ""}> Has a mine</label>
      <div class="ws-row"><button type="button" class="ws-btn" data-act="centre-selection">Centre view</button><button type="button" class="ws-btn ws-danger" data-act="remove-selection">Remove</button></div>
    </section>`;
  }

  function baseCard(index) {
    return `<section class="ws-card ws-inspector">
      <h2>${esc(shop.armyLabel(index))} · base</h2>
      <p class="ws-help">Drag the banner with the Army base tool. Troops muster inside the dashed ring.</p>
      <div class="ws-row"><button type="button" class="ws-btn" data-act="level-base">Level ground</button><button type="button" class="ws-btn" data-act="centre-selection">Centre view</button></div>
    </section>`;
  }

  side.addEventListener("input", event => {
    const target = event.target;
    if (target.dataset.opt) {
      const value = Number(target.value);
      if (target.dataset.opt === "radius") state.radius = value;
      if (target.dataset.opt === "strength") state.strength = value / 100;
      if (target.dataset.opt === "depth") state.depth = value;
      const out = side.querySelector(`[data-out="${target.dataset.opt}"]`);
      if (out) out.textContent = target.dataset.opt === "strength" ? `${value}%` : value;
    } else if (target.dataset.set) {
      const item = selectedSettlement();
      if (!item) return;
      const key = target.dataset.set;
      let value = target.type === "checkbox" ? target.checked : target.value;
      if (key === "militiaShare") value = Number(value) / 100;
      else if (["population", "farmland"].includes(key)) value = Number(value);
      shop.updateSettlement(item.id, { [key]: value });
      const out = target.closest("label")?.querySelector("output");
      if (out) out.textContent = key === "farmland" ? `${Number(target.value).toFixed(1)}×` : key === "militiaShare" ? `${target.value}%` : target.value;
    } else if (target.dataset.overlay) {
      view.overlays[target.dataset.overlay] = target.checked;
      view.invalidate();
    }
  });
  side.addEventListener("change", event => {
    const target = event.target;
    if (target.dataset.set && target.tagName !== "INPUT") renderSide();
    if (target.dataset.gen) readGenerator();
    if (target.dataset.players !== undefined) { shop.setPlayerCount(Number(target.value)); renderSide(); return; }
    if (target.dataset.af !== undefined) { editArmy(Number(target.dataset.army), target.dataset.af, target.value); return; }
    if (target.dataset.size === "preset") {
      const preset = WORLD_PRESETS.find(entry => entry.id === target.value);
      if (preset) { const result = shop.resize(preset.width, preset.height); afterResize(result); }
      else { state.sizeOpen = true; }
    }
  });
  side.addEventListener("input", event => {
    if (event.target.dataset.players !== undefined) {
      const out = event.target.closest("label")?.querySelector("output");
      if (out) out.textContent = event.target.value;
    }
  });

  function afterResize(changed) {
    if (!changed) return;
    view.resetBakes();
    view.fit();
    toast(`Map is now ${shop.world.width} × ${shop.world.height}.`);
  }

  // Changing race, faction or subfaction cascades to the dependent choices, the way the setup screen did.
  function editArmy(index, field, value) {
    const army = shop.armies[index];
    if (!army) return;
    const patch = { [field]: value };
    if (armyKit && field === "race") {
      patch.faction = armyKit.factions(value)[0];
      patch.subfaction = armyKit.subfactions(value, patch.faction)[0];
    } else if (armyKit && field === "faction") {
      patch.subfaction = armyKit.subfactions(army.race, value)[0];
    }
    if (armyKit && ["race", "faction", "subfaction"].includes(field)) {
      const next = { ...army, ...patch };
      const defaults = armyKit.visualDefaults?.(next);
      if (defaults) Object.assign(patch, { color: defaults.primary, secondaryColor: defaults.secondary, tertiaryColor: defaults.accent || defaults.secondary, bodyColor: defaults.body || defaults.primary, pattern: defaults.pattern });
      const allowed = armyKit.objectives(next).map(entry => entry.id);
      if (!allowed.includes(army.battleObjective)) patch.battleObjective = allowed[0];
    }
    if (field === "name") patch.name = String(value).trim().slice(0, 20) || `Player ${index + 1}`;
    shop.updateArmy(index, patch);
    renderSide();
  }
  side.addEventListener("toggle", event => { if (event.target.classList?.contains("ws-gen")) state.genOpen = event.target.open; if (event.target.classList?.contains("ws-size")) state.sizeOpen = event.target.open; }, true);
  side.addEventListener("click", event => {
    const note = event.target.closest("[data-note]");
    if (note) {
      const at = view.notes[Number(note.dataset.note)]?.at;
      if (at) { view.camera.x = at.x; view.camera.y = at.y; view.invalidate(); }
      return;
    }
    const fix = event.target.closest("[data-fix]");
    if (fix) {
      const [kind, index] = fix.dataset.fix.split(":");
      if (kind === "level") shop.levelBase(Number(index));
      return;
    }
    const toggle = event.target.closest("[data-army-toggle]");
    if (toggle) {
      const index = Number(toggle.dataset.armyToggle);
      state.openArmy = state.openArmy === index ? -1 : index;
      select({ type: "base", index });
      return;
    }
    const act = event.target.closest("[data-act]")?.dataset.act;
    if (act) action(act, event.target);
  });

  let genDraft = null;
  function readGenerator() {
    const get = name => side.querySelector(`[data-gen="${name}"]`);
    const num = (name, fallback) => { const value = Number(get(name)?.value); return Number.isFinite(value) ? value : fallback; };
    genDraft = {
      seed: get("seed")?.value || shop.config.seed,
      biome: get("biome")?.value || shop.config.biome,
      mountains: get("mountains")?.value === "" ? null : num("mountains", null),
      forestDensity: get("forestDensity")?.value === "" ? null : num("forestDensity", null),
      riverCount: num("riverCount", 2), lakeCount: num("lakeCount", 1), settlementCount: num("settlementCount", 3),
      deposits: { iron: num("iron", 3), promethium: num("promethium", 2), stone: num("stone", 3) }
    };
    return genDraft;
  }

  // ---- header and actions ---------------------------------------------------------------------
  function syncHeader() {
    $("[data-act=undo]").disabled = !shop.canUndo;
    $("[data-act=redo]").disabled = !shop.canRedo;
    const nameInput = $(".ws-name");
    if (document.activeElement !== nameInput) nameInput.value = shop.name;
  }

  function toast(text, kind = "info", ms = 3200) {
    const node = $(".ws-toast");
    node.textContent = text;
    node.dataset.kind = kind;
    node.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => { node.hidden = true; }, ms);
  }

  async function action(act, source = null) {
    switch (act) {
      case "close": close(); break;
      case "undo": { const label = shop.undo(); if (label) toast(`Undid: ${label}`); break; }
      case "redo": { const label = shop.redo(); if (label) toast(`Redid: ${label}`); break; }
      case "zoom-in": view.zoomAt(view.width / 2, view.height / 2, 1.3); break;
      case "zoom-out": view.zoomAt(view.width / 2, view.height / 2, 1 / 1.3); break;
      case "fit": view.fit(); break;
      case "dice": { const input = side.querySelector('[data-gen="seed"]'); if (input) input.value = `R-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; readGenerator(); break; }
      case "generate": {
        const result = shop.generate(readGenerator());
        view.resetBakes();
        toast(`Generated: ${result.settlements} settlements, ${result.rivers} rivers, ${result.lakes} lakes.`);
        break;
      }
      case "apply-size": {
        const width = Number(side.querySelector('[data-size="width"]')?.value);
        const height = Number(side.querySelector('[data-size="height"]')?.value);
        afterResize(shop.resize(width, height));
        break;
      }
      case "centre-army": case "level-army": {
        const index = Number(source?.closest("[data-army]")?.dataset.army);
        if (act === "level-army") shop.levelBase(index);
        else { view.camera.x = shop.bases[index].x; view.camera.y = shop.bases[index].y; view.invalidate(); }
        select({ type: "base", index });
        break;
      }
      case "blank": shop.blank({ biome: readGenerator().biome }); view.resetBakes(); toast("Blank meadow. Sculpt, paint and place."); break;
      case "centre-selection": {
        const at = selectedSettlement() || (state.selection?.type === "base" ? shop.bases[state.selection.index] : null);
        if (at) { view.camera.x = at.x; view.camera.y = at.y; view.invalidate(); }
        break;
      }
      case "remove-selection": { const item = selectedSettlement(); if (item) { shop.removeSettlement(item.id); state.selection = null; view.selection = null; } break; }
      case "level-base": if (state.selection?.type === "base") shop.levelBase(state.selection.index); break;
      case "save": await saveMap(); break;
      case "open": await openDialog(); break;
      case "export": exportMap(); break;
      case "import": $("[data-role=file]").click(); break;
      case "play": play(); break;
      default: break;
    }
  }
  el.querySelector(".ws-header").addEventListener("click", event => { const act = event.target.closest("[data-act]")?.dataset.act; if (act) action(act); });
  el.querySelector(".ws-zoom").addEventListener("click", event => { const act = event.target.closest("[data-act]")?.dataset.act; if (act) action(act); });
  $(".ws-name").addEventListener("input", event => { shop.name = event.target.value.slice(0, 40); });

  // ---- save / open / export / import ---------------------------------------------------------
  const slotFor = name => `map:${name.trim() || "Untitled region"}`;
  async function saveMap() {
    if (!store) { toast("Saving is not available in this browser. Use Export.", "warn"); return; }
    const ok = await store.save(slotFor(shop.name), shop.toPayload(), { name: shop.name, summary: shop.summary() });
    toast(ok ? `Saved “${shop.name}”.` : "Could not save. Use Export instead.", ok ? "info" : "warn");
  }

  function scheduleDraft() {
    if (!store) return;
    clearTimeout(state.draftTimer);
    state.draftTimer = setTimeout(() => { void store.save(DRAFT_SLOT, shop.toPayload(), { name: `Draft · ${shop.name}`, summary: shop.summary() }); }, 2500);
  }

  function exportMap() {
    const blob = new Blob([JSON.stringify(shop.toPayload())], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(shop.name || "region").replace(/[^\w.-]+/g, "_")}.region.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  $("[data-role=file]").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (shop.loadPayload(payload)) { view.resetBakes(); view.fit(); toast(`Imported “${shop.name}”.`); } else toast("That file is not a region map.", "warn");
    } catch { toast("Could not read that file.", "warn"); }
  });

  async function openDialog() {
    const modal = $(".ws-modal");
    const records = store ? (await store.list()).filter(item => item.id.startsWith("map:")).sort((a, b) => b.savedAt - a.savedAt) : [];
    const draw = () => {
      modal.innerHTML = `<div class="ws-dialog" role="dialog" aria-label="Open a map">
        <h2>Open a map</h2>
        ${records.length ? `<ul class="ws-saves">${records.map(record => `<li><button type="button" data-load="${esc(record.id)}"><strong>${esc(record.id === DRAFT_SLOT ? "Autosaved draft" : record.id.slice(4))}</strong><small>${esc(record.summary || "")} · ${new Date(record.savedAt).toLocaleString()}</small></button>${record.id === DRAFT_SLOT ? "" : `<button type="button" class="ws-btn ws-mini ws-danger" data-del="${esc(record.id)}">Delete</button>`}</li>`).join("")}</ul>` : `<p class="ws-help">No saved maps yet. Use Save to keep one here, or Export to download a file.</p>`}
        <div class="ws-row"><button type="button" class="ws-btn" data-close>Close</button></div></div>`;
    };
    draw();
    modal.hidden = false;
    modal.onclick = async event => {
      if (event.target === modal || event.target.closest("[data-close]")) { modal.hidden = true; return; }
      const load = event.target.closest("[data-load]")?.dataset.load;
      const del = event.target.closest("[data-del]")?.dataset.del;
      if (load) {
        const record = await store.load(load);
        if (record?.payload && shop.loadPayload(record.payload)) { view.resetBakes(); view.fit(); state.selection = null; view.selection = null; toast(`Opened “${shop.name}”.`); } else toast("That save could not be read.", "warn");
        modal.hidden = true;
      } else if (del) {
        await store.remove(del);
        records.splice(records.findIndex(record => record.id === del), 1);
        draw();
      }
    };
  }

  function play() {
    const errors = shop.diagnose().filter(note => note.level === "error");
    if (errors.length) { toast(errors[0].text + " Fix it first.", "warn", 4500); return; }
    close(true);
    onPlay(shop.toDeploy());
  }

  // ---- pointer and keyboard -------------------------------------------------------------------
  const local = event => { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };

  canvas.addEventListener("pointerdown", event => {
    canvas.focus({ preventScroll: true });
    const point = local(event);
    const world = view.toWorld(point.x, point.y);
    canvas.setPointerCapture(event.pointerId);
    const panning = event.button === 1 || event.button === 2 || state.spaceDown || state.tool === "pan";
    if (panning) { state.drag = { kind: "pan", x: point.x, y: point.y }; canvas.style.cursor = "grabbing"; return; }
    if (event.button !== 0) return;
    if (BRUSH_TOOLS.has(state.tool)) {
      if (shop.beginStroke(state.tool, { radius: state.radius, strength: state.strength, depth: state.depth })) {
        view.painting = true;
        state.drag = { kind: "paint" };
        shop.strokeTo(world.x, world.y);
      }
      return;
    }
    const hit = shop.hit(world.x, world.y, view.camera.zoom);
    if (state.tool === "settlement") {
      if (hit?.type === "settlement") { select(hit); state.drag = { kind: "move-settlement", id: hit.id, at: world, moved: false }; return; }
      const result = shop.addSettlement(world.x, world.y);
      if (result.ok) select({ type: "settlement", id: result.settlement.id }); else toast(result.reason, "warn");
      return;
    }
    if (state.tool === "base") {
      const index = hit?.type === "base" ? hit.index : shop.bases.reduce((best, base, i) => Math.hypot(base.x - world.x, base.y - world.y) < Math.hypot(shop.bases[best].x - world.x, shop.bases[best].y - world.y) ? i : best, 0);
      select({ type: "base", index });
      state.drag = { kind: "move-base", index, at: world, moved: false };
      return;
    }
    select(hit);
  });

  canvas.addEventListener("pointermove", event => {
    const point = local(event);
    const world = view.toWorld(point.x, point.y);
    const drag = state.drag;
    if (drag?.kind === "pan") { view.pan(point.x - drag.x, point.y - drag.y); drag.x = point.x; drag.y = point.y; }
    else if (drag?.kind === "paint") { shop.strokeTo(world.x, world.y); }
    else if (drag?.kind === "move-settlement") { drag.at = world; drag.moved = true; ghost(world, shop.settlementProblem(world.x, world.y, drag.id)); }
    else if (drag?.kind === "move-base") { drag.at = world; drag.moved = true; ghost(world, null); }
    view.cursor = BRUSH_TOOLS.has(state.tool) && !state.spaceDown ? { x: world.x, y: world.y, radius: state.radius } : null;
    view.hover = world;
    const probe = shop.probe(Math.min(Math.max(world.x, 0), shop.world.width), Math.min(Math.max(world.y, 0), shop.world.height));
    $("[data-role=probe]").textContent = `x ${probe.x}  y ${probe.y}  ·  height ${probe.height.toFixed(1)}${probe.water ? `  ·  water ${probe.water.toFixed(1)} deep` : ""}  ·  ${probe.vegetation}${probe.deposit ? "  ·  ore here" : ""}`;
    view.invalidate();
  });

  function ghost(world, problem) {
    view.cursor = { x: world.x, y: world.y, radius: 28 };
    if (problem) $("[data-role=hint]").textContent = problem;
  }

  const endDrag = event => {
    const drag = state.drag;
    state.drag = null;
    if (!drag) return;
    try { canvas.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    if (drag.kind === "paint") { shop.endStroke(); view.painting = false; }
    else if (drag.kind === "move-settlement" && drag.moved) { const result = shop.moveSettlement(drag.id, drag.at.x, drag.at.y); if (!result.ok) toast(result.reason, "warn"); }
    else if (drag.kind === "move-base" && drag.moved) { const result = shop.moveBase(drag.index, drag.at.x, drag.at.y); if (!result.ok) toast(result.reason, "warn"); }
    setTool(state.tool);
    renderSide();
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => { if (!state.drag) { view.cursor = null; view.invalidate(); } });
  canvas.addEventListener("contextmenu", event => event.preventDefault());
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    const point = local(event);
    view.zoomAt(point.x, point.y, Math.exp(-event.deltaY * 0.0013));
  }, { passive: false });
  canvas.addEventListener("dblclick", () => { if (state.tool === "pan") view.fit(); });

  const miniMove = event => {
    if (!(event.buttons & 1)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = view.minimapToWorld((event.clientX - rect.left) * event.currentTarget.width / rect.width, (event.clientY - rect.top) * event.currentTarget.height / rect.height);
    if (point) { view.camera.x = point.x; view.camera.y = point.y; view.invalidate(); }
  };
  $(".ws-minimap").addEventListener("pointerdown", event => { event.currentTarget.setPointerCapture(event.pointerId); miniMove(event); });
  $(".ws-minimap").addEventListener("pointermove", miniMove);

  function select(hit) {
    state.selection = hit ? { ...hit } : null;
    view.selection = state.selection;
    renderSide();
    view.invalidate();
  }

  el.addEventListener("keydown", event => {
    if (!state.open) return;
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) && event.target.type !== "range" && event.target.type !== "checkbox";
    if (event.key === " " && !typing) { state.spaceDown = true; canvas.style.cursor = "grab"; event.preventDefault(); return; }
    if (typing) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "z") { event.preventDefault(); action(event.shiftKey ? "redo" : "undo"); return; }
    if (mod && event.key.toLowerCase() === "y") { event.preventDefault(); action("redo"); return; }
    if (mod && event.key.toLowerCase() === "s") { event.preventDefault(); action("save"); return; }
    if (event.key === "[" || event.key === "]") {
      state.radius = Math.min(400, Math.max(16, Math.round(state.radius * (event.key === "]" ? 1.15 : 1 / 1.15))));
      const input = side.querySelector('[data-opt="radius"]');
      if (input) { input.value = state.radius; side.querySelector('[data-out="radius"]').textContent = state.radius; }
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") { if (selectedSettlement()) action("remove-selection"); return; }
    if (event.key === "Escape") { select(null); return; }
    if (event.key.toLowerCase() === "g") { view.overlays.grid = !view.overlays.grid; renderSide(); view.invalidate(); return; }
    if (event.key.toLowerCase() === "f") { view.fit(); return; }
    const tool = Object.entries(TOOL_KEYS).find(([, key]) => key === event.key)?.[0];
    if (tool) setTool(tool);
  });
  el.addEventListener("keyup", event => { if (event.key === " ") { state.spaceDown = false; setTool(state.tool); } });

  // ---- lifecycle ------------------------------------------------------------------------------
  shop.on(event => {
    if (["stroke", "history"].includes(event.type)) { view.invalidate(); return; }
    if (["edit", "settlement", "base", "army", "resize", "generate", "blank", "load", "undo", "redo"].includes(event.type)) {
      if (state.selection?.type === "settlement" && !selectedSettlement()) { state.selection = null; view.selection = null; }
      renderSide();
      scheduleDraft();
    }
    view.invalidate();
  });

  let raf = 0;
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (view.dirty) view.draw();
  };
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => { if (state.open) { view.resize(); if (!state.fitted) { view.fit(); state.fitted = true; } } }) : null;
  resizeObserver?.observe(canvas);

  function open({ fresh = false } = {}) {
    state.open = true;
    el.hidden = false;
    root.classList.add("is-workshop");
    if (fresh || (!shop.history.canUndo && !shop.settlements.length && !state.started)) {
      state.started = true;
      shop.name = "Untitled region";
      shop.generate({ seed: "Workshop", settlementCount: 3 });
      view.resetBakes();
    }
    view.resize();
    view.fit();
    state.fitted = true;
    setTool(state.tool);
    cancelAnimationFrame(raf);
    loop();
    canvas.focus({ preventScroll: true });
  }

  function close(playing = false) {
    state.open = false;
    el.hidden = true;
    root.classList.remove("is-workshop");
    cancelAnimationFrame(raf);
    if (!playing) onClose();
  }

  return { open, close, shop, view, element: el, isOpen: () => state.open, setTool, select, toast };
}
