// DOM for the single-region scenario: the setup form (seed, terrain, how many
// settlements and how each one is configured) and the live overview panel
// (season and weather, every settlement's state, and the chronicle of what
// has happened). Built with plain DOM so index.html needs only two hooks.

import { DEFAULT_REGION_CONFIG, REGION_CULTURES, normalizeRegionConfig } from "./RegionRuntime.js";

const STYLE = `
.awt-region-form{display:grid;gap:10px;max-height:62vh;overflow:auto;padding-right:4px}
.awt-region-form .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.awt-region-form label{display:grid;gap:3px;font-size:12px}
.awt-region-form .row{display:flex;gap:6px;align-items:end}
.awt-region-settlements{display:grid;gap:8px}
.awt-region-settlement{display:grid;grid-template-columns:repeat(6,minmax(0,1fr)) auto;gap:6px;align-items:end;padding:8px;border:1px solid var(--border,rgba(255,255,255,.14));border-radius:8px}
.awt-region-settlement label{font-size:11px}
.awt-region-settlement .name{grid-column:1/-1;font-weight:600;font-size:12px}
.awt-region-overview{position:absolute;right:12px;top:64px;width:min(380px,calc(100% - 24px));max-height:min(560px,calc(100% - 300px));overflow:auto;z-index:6;padding:12px;display:grid;gap:10px;background:var(--surface,rgba(18,20,24,.94));border:1px solid var(--border,rgba(255,255,255,.14));border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.awt-region-overview[hidden]{display:none}
.awt-region-overview h3{margin:0;font-size:13px;letter-spacing:.04em;text-transform:uppercase;opacity:.8}
.awt-region-env{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:12px}
.awt-region-card{border:1px solid var(--border,rgba(255,255,255,.14));border-radius:8px;padding:8px;display:grid;gap:4px;font-size:12px}
.awt-region-card header{display:flex;justify-content:space-between;gap:8px;font-weight:600}
.awt-region-card .pill{padding:1px 7px;border-radius:99px;font-size:11px;background:rgba(255,255,255,.1)}
.awt-region-card .pill.siege,.awt-region-card .pill.uprising,.awt-region-card .pill.ruined{background:#7a2b25}
.awt-region-card .pill.alert,.awt-region-card .pill.occupied,.awt-region-card .pill.struggling{background:#7a5a1f}
.awt-region-card .pill.thriving,.awt-region-card .pill.independent{background:#285a35}
.awt-region-card .roles{display:flex;flex-wrap:wrap;gap:2px 10px;opacity:.85}
.awt-region-card .lesson{opacity:.75;font-style:italic}
.awt-region-chronicle{display:grid;gap:3px;font-size:12px;list-style:none;margin:0;padding:0}
.awt-region-chronicle li{padding:3px 6px;border-left:3px solid rgba(255,255,255,.25)}
.awt-region-chronicle li.alert,.awt-region-chronicle li.warning{border-color:#e0883a}
.awt-region-chronicle li.critical{border-color:#d64545}
`;

const escapeHtml = value => String(value).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function createRegionUI({ root, runtime, players, onBegin, onOpenOverview, onAdd, onSave, onRemove }) {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.append(style);

  // ---- setup form ---------------------------------------------------------
  const panel = document.createElement("div");
  panel.id = "awt-region-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="awt-panel-title">Single region · living world</div>
    <p class="awt-panel-copy text-small">One persistent map: hills, rivers, woodland, ore, autonomous settlements and two armies. Every shell, trench and harvest stays in the ground.</p>
    <div class="awt-region-form">
      <div class="row">
        <label style="flex:1">Seed<input class="form-control" id="awt-region-seed" maxlength="40"></label>
        <button type="button" class="btn" id="awt-region-reroll">Re-roll</button>
      </div>
      <div class="grid2">
        <label>Biome<select class="form-select" id="awt-region-biome"><option value="temperate">Temperate</option><option value="forest">Forest</option><option value="desert">Desert</option><option value="frozen">Frozen</option><option value="volcanic">Volcanic</option></select></label>
        <label>Mountains <span class="text-muted" id="awt-region-mountains-value">auto</span><input type="range" class="form-range" id="awt-region-mountains" min="0" max="100" value="-1"></label>
        <label>Rivers<input class="form-control" type="number" id="awt-region-rivers" min="0" max="5" value="2"></label>
        <label>Lakes<input class="form-control" type="number" id="awt-region-lakes" min="0" max="4" value="1"></label>
        <label>Woodland <span class="text-muted" id="awt-region-forest-value">auto</span><input type="range" class="form-range" id="awt-region-forest" min="0" max="100" value="-1"></label>
        <label>Ore · fuel · stone deposits
          <span class="row"><input class="form-control" type="number" id="awt-region-iron" min="0" max="8" value="3" title="Iron ore"><input class="form-control" type="number" id="awt-region-promethium" min="0" max="5" value="1" title="Promethium"><input class="form-control" type="number" id="awt-region-stone" min="0" max="8" value="2" title="Stone"></span>
        </label>
      </div>
      <div class="awt-panel-title" style="margin-top:4px">Settlements <span class="text-muted text-small" id="awt-region-count"></span></div>
      <div class="awt-region-settlements" id="awt-region-settlements"></div>
      <button type="button" class="btn btn-block" id="awt-region-add">Add settlement</button>
    </div>
    <button type="button" class="btn btn-primary btn-block" id="awt-region-begin">Generate region and begin</button>
    <button type="button" class="btn btn-ghost btn-block" id="awt-region-back">Back</button>`;

  const q = selector => panel.querySelector(selector);
  const rows = [];

  function ownerOptions() {
    const options = ['<option value="">Independent</option>'];
    for (const player of players()) options.push(`<option value="${escapeHtml(player.id)}">${escapeHtml(player.name || player.faction)} (${escapeHtml(player.subfaction || player.faction)})</option>`);
    return options.join("");
  }

  function addRow(entry = {}) {
    const wrapper = document.createElement("div");
    wrapper.className = "awt-region-settlement";
    wrapper.innerHTML = `
      <div class="name"></div>
      <label>People<input class="form-control" type="number" data-k="population" min="8" max="120" value="${entry.population ?? 32}"></label>
      <label>Farmland<input class="form-control" type="number" data-k="farmland" min="0.3" max="2" step="0.1" value="${entry.farmland ?? 1}"></label>
      <label>Militia %<input class="form-control" type="number" data-k="militia" min="0" max="50" value="${Math.round((entry.militiaShare ?? 0.1) * 100)}"></label>
      <label>Culture<select class="form-select" data-k="culture">${REGION_CULTURES.map(culture => `<option value="${culture}">${culture}</option>`).join("")}</select></label>
      <label>Ruler<select class="form-select" data-k="owner">${ownerOptions()}</select></label>
      <label>Mine<select class="form-select" data-k="mine"><option value="1">yes</option><option value="0">no</option></select></label>
      <button type="button" class="btn btn-ghost" data-k="remove" aria-label="Remove settlement">✕</button>`;
    wrapper.querySelector('[data-k="culture"]').value = entry.culture || "frontier";
    wrapper.querySelector('[data-k="owner"]').value = entry.owner || "";
    wrapper.querySelector('[data-k="mine"]').value = entry.mine === false ? "0" : "1";
    wrapper.querySelector('[data-k="remove"]').addEventListener("click", () => {
      if (rows.length <= 1) return;
      rows.splice(rows.indexOf(wrapper), 1);
      wrapper.remove();
      renumber();
    });
    rows.push(wrapper);
    q("#awt-region-settlements").append(wrapper);
    renumber();
  }

  function renumber() {
    rows.forEach((row, index) => { row.querySelector(".name").textContent = `Settlement ${index + 1}`; });
    q("#awt-region-count").textContent = `· ${rows.length}`;
    q("#awt-region-add").disabled = rows.length >= 8;
  }

  function readConfig() {
    const mountains = Number(q("#awt-region-mountains").value);
    const forest = Number(q("#awt-region-forest").value);
    return normalizeRegionConfig({
      seed: q("#awt-region-seed").value.trim() || DEFAULT_REGION_CONFIG.seed,
      biome: q("#awt-region-biome").value,
      mountains: mountains < 0 ? null : mountains / 100,
      forestDensity: forest < 0 ? null : forest / 100,
      riverCount: q("#awt-region-rivers").value,
      lakeCount: q("#awt-region-lakes").value,
      deposits: { iron: q("#awt-region-iron").value, promethium: q("#awt-region-promethium").value, stone: q("#awt-region-stone").value },
      settlements: rows.map(row => ({
        population: row.querySelector('[data-k="population"]').value,
        farmland: row.querySelector('[data-k="farmland"]').value,
        militiaShare: Number(row.querySelector('[data-k="militia"]').value) / 100,
        culture: row.querySelector('[data-k="culture"]').value,
        owner: row.querySelector('[data-k="owner"]').value,
        mine: row.querySelector('[data-k="mine"]').value === "1"
      }))
    });
  }

  function writeConfig(config) {
    q("#awt-region-seed").value = config.seed;
    q("#awt-region-biome").value = config.biome;
    q("#awt-region-mountains").value = config.mountains == null ? -1 : Math.round(config.mountains * 100);
    q("#awt-region-forest").value = config.forestDensity == null ? -1 : Math.round(config.forestDensity * 100);
    q("#awt-region-rivers").value = config.riverCount;
    q("#awt-region-lakes").value = config.lakeCount;
    q("#awt-region-iron").value = config.deposits.iron;
    q("#awt-region-promethium").value = config.deposits.promethium;
    q("#awt-region-stone").value = config.deposits.stone;
    for (const row of rows.splice(0)) row.remove();
    for (const entry of config.settlements) addRow(entry);
    syncSliders();
  }

  function syncSliders() {
    const m = Number(q("#awt-region-mountains").value);
    const f = Number(q("#awt-region-forest").value);
    q("#awt-region-mountains-value").textContent = m < 0 ? "auto" : `${m}%`;
    q("#awt-region-forest-value").textContent = f < 0 ? "auto" : `${f}%`;
  }

  q("#awt-region-mountains").addEventListener("input", syncSliders);
  q("#awt-region-forest").addEventListener("input", syncSliders);
  q("#awt-region-add").addEventListener("click", () => { if (rows.length < 8) addRow({ population: 30, culture: "frontier" }); });
  q("#awt-region-reroll").addEventListener("click", () => {
    const words = ["ASHFORD", "BRAVO", "CINDER", "DELTA", "EMBER", "FALCON", "GRANITE", "HOLLOW", "IRONWOOD", "JUNIPER"];
    q("#awt-region-seed").value = `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(Math.random() * 900 + 100)}`;
  });
  q("#awt-region-begin").addEventListener("click", () => onBegin(readConfig()));

  const mount = () => {
    const anchor = root.querySelector("#awt-load-panel");
    if (anchor && !panel.isConnected) anchor.parentElement.insertBefore(panel, anchor);
  };
  mount();
  writeConfig(normalizeRegionConfig(DEFAULT_REGION_CONFIG));

  // ---- overview -----------------------------------------------------------------
  const overview = document.createElement("section");
  overview.className = "awt-region-overview";
  overview.id = "awt-region-overview";
  overview.hidden = true;
  overview.setAttribute("aria-label", "Region overview");
  overview.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3>Region</h3><span style="display:flex;gap:6px"><button type="button" class="btn" id="awt-region-add-here" title="Found a new settlement at the camera centre">+ Settlement</button><button type="button" class="btn" id="awt-region-save" title="Save the world to this browser">Save</button><button type="button" class="btn btn-ghost" id="awt-region-close" aria-label="Close region overview">✕</button></span></div>
    <div class="text-small text-muted" id="awt-region-status" role="status"></div>
    <div class="awt-region-env" id="awt-region-env"></div>
    <div id="awt-region-cards" style="display:grid;gap:8px"></div>
    <h3>Chronicle</h3>
    <ul class="awt-region-chronicle" id="awt-region-chronicle"></ul>`;
  const host = root.querySelector(".awt-field") || root;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  host.append(overview);
  overview.querySelector("#awt-region-close").addEventListener("click", () => setOverview(false));
  const status = text => { overview.querySelector("#awt-region-status").textContent = text; };
  overview.querySelector("#awt-region-add-here").addEventListener("click", () => {
    const made = onAdd?.();
    status(made ? `${made.name} founded.` : "No suitable ground near the camera centre.");
    refresh(true);
  });
  overview.querySelector("#awt-region-save").addEventListener("click", async () => {
    status("Saving…");
    status((await onSave?.()) ? "World saved to this browser." : "Saving is unavailable here.");
  });
  overview.querySelector("#awt-region-cards").addEventListener("click", event => {
    const button = event.target.closest("[data-remove-settlement]");
    if (!button) return;
    onRemove?.(button.dataset.removeSettlement);
    refresh(true);
  });

  let open = false;
  let lastPaint = 0;
  function setOverview(value) {
    open = Boolean(value);
    overview.hidden = !open;
    onOpenOverview?.(open);
    if (open) refresh(true);
  }

  function refresh(force = false) {
    if (!open || !runtime.active) return;
    const nowStamp = performance.now();
    if (!force && nowStamp - lastPaint < 900) return;
    lastPaint = nowStamp;
    const env = runtime.environment();
    const counts = runtime.counts();
    if (env) {
      overview.querySelector("#awt-region-env").innerHTML = `
        <span><b>${escapeHtml(env.season)}</b>, year ${env.year}</span>
        <span>weather: <b>${escapeHtml(env.weather)}</b></span>
        <span>fires: <b>${env.fires}</b></span>
        <span>people: <b>${counts.people}</b>${counts.refugees ? ` (${counts.refugees} refugees)` : ""}</span>
        <span>harvests: <b>${env.harvests}</b></span>`;
    }
    overview.querySelector("#awt-region-cards").innerHTML = runtime.overview().map(item => {
      const roles = Object.entries(item.roles).map(([role, n]) => `${n} ${role}`).join(" · ");
      const ruler = item.owner ? escapeHtml(runtime.nameOf?.(item.owner) || item.owner) : "independent";
      const doctrine = item.doctrine;
      const lessons = item.lessons.map(lesson => `<div class="lesson">“${escapeHtml(lesson.text || lesson)}”</div>`).join("");
      const mine = item.mine ? `mine depth ${item.mine.depth.toFixed(1)}${item.mine.flooded ? " (flooded)" : ""}, ${Math.round(item.mine.remaining)} ore left` : "no mine";
      return `<article class="awt-region-card">
        <header><span>${escapeHtml(item.name)}</span><span><span class="pill ${escapeHtml(item.status)}">${escapeHtml(item.status)}</span> <button type="button" class="btn btn-ghost" style="padding:0 6px;min-height:20px" data-remove-settlement="${escapeHtml(item.id)}" title="Remove this settlement" aria-label="Remove ${escapeHtml(item.name)}">✕</button></span></header>
        <div>${item.population} people · ${ruler} · posture <b>${escapeHtml(item.posture)}</b></div>
        <div>food ${Math.round(item.food)} (${item.foodDays.toFixed(1)} days${item.hiddenFood > 1 ? ", stash hidden" : ""}) · materials ${Math.round(item.materials)} · ${item.fields} field cells</div>
        <div>${item.buildings} buildings standing · ${mine}</div>
        <div class="roles">${roles}</div>
        <div>doctrine: militia ${Math.round(doctrine.militiaShare * 100)}% · reserve ${Math.round(doctrine.reserveDays)}d · walls ${doctrine.wallPriority.toFixed(2)} · trenches ${doctrine.trenchPriority.toFixed(2)} · towers ${doctrine.towerTarget} · scouts ${Math.round(doctrine.scoutRadius)} · evacuate ${doctrine.evacuateBias.toFixed(2)}</div>
        <div>attacks survived: ${item.attacks} · losses: ${item.lost}</div>
        ${lessons}
      </article>`;
    }).join("") || '<div class="text-small text-muted">No settlements.</div>';
    overview.querySelector("#awt-region-chronicle").innerHTML = runtime.chronicle(30).reverse().map(entry =>
      `<li class="${escapeHtml(entry.level || "info")}"><span class="text-muted">${clock(entry.t || 0)}</span> ${escapeHtml(entry.text)}</li>`).join("");
  }

  return {
    panel,
    showSetup(config) { mount(); if (config) writeConfig(config); panel.hidden = false; },
    hideSetup() { panel.hidden = true; },
    setOverview,
    toggleOverview: () => setOverview(!open),
    isOpen: () => open,
    refresh,
    readConfig,
    writeConfig
  };
}
