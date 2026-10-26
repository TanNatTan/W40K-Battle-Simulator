// Authoring model for hand-made regions: the same ground (height field + ecology layers),
// settlements and army bases the "Single region" scenario plays on, plus the brushes and
// checks needed to build one by hand or to start from a generated region and reshape it.
//
// Nothing here touches the DOM. The view and panels call into it, and tests drive it
// directly. Every edit is undoable (see WorkshopHistory).

import { HeightField, SAMPLE_SPACING, CHUNK_SPAN } from "../terrain/HeightField.js";
import { WorldLayers, DEPOSIT, EARTHWORK, NO_WATER, SURFACE, VEGETATION, BYTE_LAYERS as LAYER_NAMES } from "../world/WorldLayers.js";
import { generateRegion, pickSettlementSites } from "../world/RegionGenerator.js";
import { levelSite } from "../world/Deformation.js";
import { DEFAULT_REGION_CONFIG, MAX_REGION_SETTLEMENTS, REGION_CULTURES, REGION_WORLD, REGION_WORLD_LIMITS, normalizeRegionConfig, sanitizeRegionWorld } from "../region/RegionRuntime.js";
import { WorkshopHistory } from "./WorkshopHistory.js";

export const WATER_LEVEL = -2;
export const MAX_SETTLEMENTS = MAX_REGION_SETTLEMENTS;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const PLAYER_IDS = Object.freeze(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"]);
export const WORLD_PRESETS = Object.freeze([
  { id: "small", label: "Small · 1920 × 1080", width: 1920, height: 1080 },
  { id: "standard", label: "Standard · 2560 × 1440", width: 2560, height: 1440 },
  { id: "large", label: "Large · 3840 × 2160", width: 3840, height: 2160 },
  { id: "huge", label: "Huge · 5120 × 2880", width: 5120, height: 2880 }
]);
export { REGION_WORLD_LIMITS };
export const BASE_RADIUS = 150;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smooth = t => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };

function cellHash(i, j, k = 0) {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k + 7, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Same ring formula the battle uses for army bases (two armies: top and bottom of the map).
export function defaultBases(world = REGION_WORLD, count = 2) {
  return Array.from({ length: count }, (_, index) => baseOnRing(world, index, count));
}

export function baseOnRing(world, index, count) {
  const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, count);
  const radiusX = Math.max(120, Math.min(world.width * 0.32, world.width / 2 - 180));
  const radiusY = Math.max(120, Math.min(world.height * 0.32, world.height / 2 - 180));
  return {
    x: Math.round(clamp(world.width / 2 + Math.cos(angle) * radiusX, 160, world.width - 160)),
    y: Math.round(clamp(world.height / 2 + Math.sin(angle) * radiusY, 160, world.height - 160))
  };
}

// ---- tool catalogue (data-driven so the panel and the tests agree) ---------------------------
export const TOOL_GROUPS = Object.freeze([
  { id: "terrain", label: "Sculpt", tools: [
    { id: "raise", label: "Raise", hint: "Build hills and ridges. Hold the stroke to pile height up." },
    { id: "lower", label: "Lower", hint: "Cut valleys and hollows." },
    { id: "smooth", label: "Smooth", hint: "Soften rough ground and cliffs." },
    { id: "flatten", label: "Flatten", hint: "Level the ground to the height where the stroke began." },
    { id: "plateau", label: "Plateau", hint: "Make a flat-topped shelf with a sloped edge." },
    { id: "ridge", label: "Ridge", hint: "Raise a sharp crest along the centre of the stroke." },
    { id: "roughen", label: "Roughen", hint: "Add natural lumps to over-smooth ground." },
    { id: "terrace", label: "Terrace", hint: "Cut stepped ledges into a slope." }
  ] },
  { id: "water", label: "Water", tools: [
    { id: "dig", label: "Dig water", hint: "Carve a lake, river or moat below the waterline." },
    { id: "dry", label: "Dry land", hint: "Fill water back in and raise the bank." }
  ] },
  { id: "cover", label: "Land cover", tools: [
    { id: "forest", label: "Forest", hint: "Paint woodland. Units get cover; woodcutters have timber." },
    { id: "shrub", label: "Scrub", hint: "Thin bushes and thickets." },
    { id: "grass", label: "Meadow", hint: "Open grass." },
    { id: "crops", label: "Fields", hint: "Farmland that settlements plant, tend and harvest." },
    { id: "clear", label: "Clear", hint: "Bare ground: remove plants and fields." }
  ] },
  { id: "ground", label: "Ground", tools: [
    { id: "soil-fertile", label: "Rich soil", hint: "Dark fertile earth; plants and crops grow well." },
    { id: "soil-dry", label: "Dry earth", hint: "Pale parched ground." },
    { id: "soil-mud", label: "Mud", hint: "Boggy ground that slows everything." },
    { id: "soil-bare", label: "Dirt track", hint: "Trodden bare earth." },
    { id: "soil-burnt", label: "Scorched", hint: "Blackened ground." },
    { id: "soil-rock", label: "Rock", hint: "Barren stone." }
  ] },
  { id: "resources", label: "Resources", tools: [
    { id: "iron", label: "Iron ore", hint: "Buried ore that miners dig for materials." },
    { id: "promethium", label: "Promethium", hint: "Fuel seep for vehicles." },
    { id: "stone", label: "Stone", hint: "Quarry stone for walls." },
    { id: "unseed", label: "Remove", hint: "Clear a deposit." }
  ] },
  { id: "places", label: "Places", tools: [
    { id: "settlement", label: "Settlement", hint: "Click open ground to found a settlement. Drag one to move it." },
    { id: "base", label: "Army base", hint: "Drag an army's deployment zone." },
    { id: "inspect", label: "Inspect", hint: "Click a settlement or base to edit it." }
  ] }
]);

export const BRUSH_TOOLS = new Set(TOOL_GROUPS.flatMap(group => group.tools.map(tool => tool.id)).filter(id => !["settlement", "base", "inspect"].includes(id)));

const SOIL_TARGETS = {
  "soil-fertile": { fertility: 215, moisture: 140, trample: 0, scorch: 0 },
  "soil-dry": { fertility: 70, moisture: 22, trample: 20, scorch: 0 },
  "soil-mud": { fertility: 90, moisture: 235, trample: 150, scorch: 0 },
  "soil-bare": { fertility: 55, moisture: 70, trample: 225, scorch: 0 },
  "soil-burnt": { scorch: 235, fertility: 40 },
  "soil-rock": { fertility: 8, moisture: 30, trample: 120, scorch: 0 }
};

const DEPOSIT_KINDS = {
  iron: { kind: DEPOSIT.IRON, amount: 900 },
  promethium: { kind: DEPOSIT.PROMETHIUM, amount: 1400 },
  stone: { kind: DEPOSIT.STONE, amount: 1100 }
};

export const DEFAULT_BRUSH = Object.freeze({ radius: 70, strength: 0.5 });

export class RegionWorkshop {
  constructor({ world = REGION_WORLD, armyFactory = null } = {}) {
    this.world = { ...world };
    this.armyFactory = armyFactory || (index => ({ name: `Player ${index + 1}` }));
    this.field = new HeightField({ width: world.width, height: world.height });
    this.layers = new WorldLayers({ width: world.width, height: world.height });
    this.history = new WorkshopHistory({ field: this.field, layers: this.layers });
    this.name = "Untitled region";
    this.palette = "temperate";
    this.config = normalizeRegionConfig({ ...DEFAULT_REGION_CONFIG, settlements: [] });
    this.settlements = [];
    this.bases = defaultBases(world);
    this.armies = this.bases.map((_, index) => this.armyFactory(index));
    this.nextSettlementId = 1;
    this.stroke = null;
    this.revision = 0;
    this.listeners = new Set();
  }

  on(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(type) { this.revision += 1; for (const listener of this.listeners) listener({ type, revision: this.revision }); }

  // ---- whole-world operations -------------------------------------------------------------
  /** Generate a region exactly the way the Single region scenario does, then adopt it for editing. */
  generate(partial = {}) {
    const before = this.snapshot();
    let entries = partial.settlements ?? (this.settlements.length ? this.settlementConfigs() : DEFAULT_REGION_CONFIG.settlements.map(entry => ({ ...entry })));
    if (partial.settlementCount != null) {
      const count = clamp(Math.round(Number(partial.settlementCount) || 0), 0, MAX_SETTLEMENTS);
      entries = Array.from({ length: count }, (_, index) => ({ ...(entries[index] || entries[entries.length - 1] || {}) }));
    }
    const config = normalizeRegionConfig({ ...this.config, ...partial, world: this.world, settlements: entries });
    this.config = config;
    const info = generateRegion({
      field: this.field, layers: this.layers, seed: config.seed, width: this.world.width, height: this.world.height,
      biome: config.biome, mountains: config.mountains, riverCount: config.riverCount, lakeCount: config.lakeCount,
      forestDensity: config.forestDensity, deposits: config.deposits,
      flatZones: this.bases.map(base => ({ x: base.x, y: base.y, radius: BASE_RADIUS, level: 4 }))
    });
    this.palette = info.palette;
    this.settlements = [];
    this.nextSettlementId = 1;
    const avoid = this.bases.map(base => ({ x: base.x, y: base.y, radius: 190 }));
    let sites = [];
    for (const separation of [470, 380, 300, 230]) {
      sites = pickSettlementSites(info.sites, config.settlements.length, separation, avoid);
      if (sites.length >= config.settlements.length) break;
    }
    config.settlements.forEach((entry, index) => {
      const site = sites[index];
      if (site) this.settlements.push(this.makeSettlement(site.x, site.y, entry));
    });
    this.history.recordSnapshot("Generate region", before, this.snapshot());
    this.emit("generate");
    return { settlements: this.settlements.length, rivers: info.rivers.length, lakes: info.lakes.length };
  }

  /** A flat meadow to build on from nothing. */
  blank({ biome = this.config.biome, height = 4 } = {}) {
    const before = this.snapshot();
    this.field.clear();
    this.layers.clear();
    this.field.baseHeight = height;
    this.field.waterLevel = WATER_LEVEL;
    this.field.seed = 1;
    this.palette = ({ forest: "forest", desert: "desert", frozen: "frozen", volcanic: "volcanic" })[biome] || "temperate";
    this.config = normalizeRegionConfig({ ...this.config, biome, settlements: [] });
    const cols = Math.ceil(this.world.width / SAMPLE_SPACING) + 1;
    const rows = Math.ceil(this.world.height / SAMPLE_SPACING) + 1;
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        this.layers.set("fertility", i, j, 150 + cellHash(i, j, 3) * 40);
        this.layers.set("moisture", i, j, 90);
        this.layers.set("vegKind", i, j, VEGETATION.GRASS);
        this.layers.set("vegetation", i, j, 120 + cellHash(i, j, 5) * 60);
        this.layers.set("integrity", i, j, 255);
      }
    }
    this.field.version += 1;
    this.field.bulk += 1;
    this.layers.bulk += 1;
    this.settlements = [];
    this.nextSettlementId = 1;
    this.bases = defaultBases(this.world, this.bases.length);
    this.history.recordSnapshot("New blank region", before, this.snapshot());
    this.emit("blank");
  }

  settlementConfigs() {
    return this.settlements.length ? this.settlements.map(item => this.specToConfig(item)) : this.config.settlements;
  }

  specToConfig(item) {
    return { population: item.population, farmland: item.farmland, mine: item.mine, militiaShare: item.militiaShare, culture: item.culture, owner: item.owner || "" };
  }

  makeSettlement(x, y, entry = {}) {
    const defaults = normalizeRegionConfig({ settlements: [entry] }).settlements[0];
    return { id: `s${this.nextSettlementId++}`, ...defaults, x: Math.round(x), y: Math.round(y), name: entry.name || "" };
  }

  // ---- snapshots (whole-world undo) ---------------------------------------------------------
  snapshot() {
    return {
      name: this.name, palette: this.palette, config: structuredClone(this.config), world: { ...this.world }, armies: structuredClone(this.armies),
      field: this.field.serialize(), layers: this.layers.serialize(),
      settlements: structuredClone(this.settlements), bases: structuredClone(this.bases), nextSettlementId: this.nextSettlementId
    };
  }

  restoreSnapshot(snap) {
    this.name = snap.name ?? this.name;
    this.palette = snap.palette || "temperate";
    this.config = normalizeRegionConfig(snap.config);
    this.world = sanitizeRegionWorld(snap.world || this.world);
    const field = HeightField.deserialize(snap.field, this.world);
    this.field.adopt(field);
    this.field.resize(this.world.width, this.world.height);
    this.layers.chunks = WorldLayers.deserialize(snap.layers, this.world).chunks;
    this.layers.width = this.world.width;
    this.layers.height = this.world.height;
    this.layers.bulk += 1;
    if (Array.isArray(snap.armies) && snap.armies.length) this.armies = structuredClone(snap.armies);
    this.settlements = structuredClone(snap.settlements || []);
    this.bases = structuredClone(snap.bases || defaultBases(this.world));
    while (this.armies.length < this.bases.length) this.armies.push(this.armyFactory(this.armies.length));
    this.armies.length = this.bases.length;
    this.nextSettlementId = snap.nextSettlementId || this.settlements.length + 1;
  }

  applyHistory(step) {
    if (!step) return;
    if (step.type === "snapshot") this.restoreSnapshot(step.snapshot);
    else if (step.type === "meta") { this.settlements = structuredClone(step.meta.settlements); this.bases = structuredClone(step.meta.bases); if (step.meta.armies) this.armies = structuredClone(step.meta.armies); }
    this.emit("history");
  }

  undo() { const label = this.history.undo(step => this.applyHistory(step)); if (label) this.emit("undo"); return label; }
  redo() { const label = this.history.redo(step => this.applyHistory(step)); if (label) this.emit("redo"); return label; }
  get canUndo() { return this.history.canUndo; }
  get canRedo() { return this.history.canRedo; }

  metaState() { return { settlements: structuredClone(this.settlements), bases: structuredClone(this.bases), armies: structuredClone(this.armies) }; }

  // ---- brush strokes ------------------------------------------------------------------------
  beginStroke(tool, params = {}) {
    if (!BRUSH_TOOLS.has(tool)) return false;
    this.endStroke();
    const radius = clamp(Number(params.radius) || DEFAULT_BRUSH.radius, 16, 400);
    const strength = clamp(Number(params.strength) || DEFAULT_BRUSH.strength, 0.05, 1);
    this.stroke = { tool, radius, strength, last: null, target: null, dabs: 0, depth: clamp(Number(params.depth) || 4, 1, 12) };
    this.history.begin(TOOL_GROUPS.flatMap(group => group.tools).find(item => item.id === tool)?.label || tool);
    return true;
  }

  strokeTo(x, y) {
    const stroke = this.stroke;
    if (!stroke) return 0;
    const px = clamp(x, 0, this.world.width);
    const py = clamp(y, 0, this.world.height);
    if (stroke.target === null && stroke.tool === "flatten") stroke.target = this.field.heightAt(px, py);
    const spacing = Math.max(8, stroke.radius * 0.28);
    let dabs = 0;
    if (!stroke.last) {
      this.dab(px, py);
      dabs += 1;
    } else {
      const dx = px - stroke.last.x;
      const dy = py - stroke.last.y;
      const length = Math.hypot(dx, dy);
      const steps = Math.floor(length / spacing);
      for (let step = 1; step <= steps; step += 1) {
        this.dab(stroke.last.x + dx * step / steps * (steps * spacing / length), stroke.last.y + dy * step / steps * (steps * spacing / length));
        dabs += 1;
      }
      if (!steps) return 0; // not far enough from the last dab yet; keep `last` where it was
    }
    // Remember the last dab centre, not the pointer, so spacing stays even.
    stroke.last = dabs && stroke.last ? this.lastDab : { x: px, y: py };
    stroke.dabs += dabs;
    if (dabs) this.emit("stroke");
    return dabs;
  }

  endStroke() {
    if (!this.stroke) return false;
    this.stroke = null;
    const changed = this.history.end();
    if (changed) this.emit("edit");
    return changed;
  }

  dab(x, y) {
    const stroke = this.stroke;
    this.lastDab = { x, y };
    this.history.touch(x, y, stroke.radius);
    const { tool, radius, strength } = stroke;
    switch (tool) {
      case "raise": case "lower": case "smooth": case "ridge":
        this.field.applyBrush(x, y, radius, strength * 2.4, tool);
        break;
      case "flatten":
        this.field.applyBrush(x, y, radius, strength * 2, "flatten", { target: stroke.target });
        break;
      case "plateau":
        this.field.applyBrush(x, y, radius, strength, "plateau", { target: stroke.target ?? this.field.heightAt(x, y) });
        stroke.target ??= this.field.heightAt(x, y);
        break;
      case "roughen":
        this.field.applyBrush(x, y, radius, strength * 1.6, "noise");
        break;
      case "terrace":
        this.field.applyBrush(x, y, radius, strength * 6, "terrace");
        break;
      case "dig": this.digWater(x, y, radius, strength, stroke.depth); break;
      case "dry": this.dryLand(x, y, radius, strength); break;
      case "forest": case "shrub": case "grass": case "crops": case "clear": this.paintCover(tool, x, y, radius, strength); break;
      case "iron": case "promethium": case "stone": this.seedDeposit(tool, x, y, radius, strength); break;
      case "unseed": this.removeDeposit(x, y, radius); break;
      default:
        if (tool.startsWith("soil-")) this.paintSoil(tool, x, y, radius, strength);
    }
    if (["raise", "lower", "smooth", "flatten", "plateau", "ridge", "roughen", "terrace", "dig", "dry"].includes(tool)) this.settleEcology(x, y, radius + SAMPLE_SPACING);
  }

  digWater(x, y, radius, strength, depth) {
    const floor = WATER_LEVEL - depth;
    const i0 = Math.floor((x - radius) / SAMPLE_SPACING);
    const i1 = Math.ceil((x + radius) / SAMPLE_SPACING);
    const j0 = Math.floor((y - radius) / SAMPLE_SPACING);
    const j1 = Math.ceil((y + radius) / SAMPLE_SPACING);
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        if (i < 0 || j < 0) continue;
        const distance = Math.hypot(i * SAMPLE_SPACING - x, j * SAMPLE_SPACING - y);
        if (distance > radius) continue;
        const current = this.field.sample(i, j);
        if (current <= floor) continue;
        const falloff = smooth(1 - distance / radius);
        const next = current + (floor - current) * clamp(falloff * strength * 1.3, 0, 1);
        this.field.setSculptSample(i, j, this.field.getSculptSample(i, j) + (next - current));
      }
    }
    this.field.version += 1;
  }

  dryLand(x, y, radius, strength) {
    const shore = WATER_LEVEL + 1.4;
    const i0 = Math.floor((x - radius) / SAMPLE_SPACING);
    const i1 = Math.ceil((x + radius) / SAMPLE_SPACING);
    const j0 = Math.floor((y - radius) / SAMPLE_SPACING);
    const j1 = Math.ceil((y + radius) / SAMPLE_SPACING);
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        if (i < 0 || j < 0) continue;
        const distance = Math.hypot(i * SAMPLE_SPACING - x, j * SAMPLE_SPACING - y);
        if (distance > radius) continue;
        const falloff = smooth(1 - distance / radius);
        if (falloff > 0.25 && this.layers.get("waterSurface", i, j) > NO_WATER) this.layers.set("waterSurface", i, j, NO_WATER);
        const current = this.field.sample(i, j);
        if (current >= shore) continue;
        const next = current + (shore - current) * clamp(falloff * strength * 1.4, 0, 1);
        this.field.setSculptSample(i, j, this.field.getSculptSample(i, j) + (next - current));
      }
    }
    this.field.version += 1;
  }

  // After terrain edits: nothing grows under water, and sunken farmland is lost.
  settleEcology(x, y, radius) {
    this.layers.forEachInCircle(x, y, radius, (i, j) => {
      const wet = this.field.sample(i, j) < WATER_LEVEL + 0.1 || this.layers.get("waterSurface", i, j) > NO_WATER;
      if (!wet) return;
      if (this.layers.get("vegKind", i, j) !== VEGETATION.NONE) {
        this.layers.set("vegKind", i, j, VEGETATION.NONE);
        this.layers.set("vegetation", i, j, 0);
        this.layers.set("cropStage", i, j, 0);
        if (this.layers.get("earthwork", i, j) === EARTHWORK.FIELD) this.layers.set("earthwork", i, j, EARTHWORK.NONE);
      }
    });
  }

  isUnderwater(i, j) {
    return this.field.sample(i, j) < WATER_LEVEL + 0.1 || this.layers.get("waterSurface", i, j) > NO_WATER;
  }

  paintCover(tool, x, y, radius, strength) {
    this.layers.forEachInCircle(x, y, radius, (i, j, distance) => {
      if (this.isUnderwater(i, j)) return;
      const edge = 1 - distance / radius;
      if (cellHash(i, j, tool.length * 13 + 1) > clamp(edge * 2.2 + 0.1 + strength * 0.5, 0, 1) && tool !== "clear") return;
      const fertility = this.layers.get("fertility", i, j) / 255;
      if (tool === "forest") {
        this.layers.set("vegKind", i, j, VEGETATION.FOREST);
        this.layers.set("vegetation", i, j, 150 + cellHash(i, j, 9) * 105);
        this.clearField(i, j);
      } else if (tool === "shrub") {
        this.layers.set("vegKind", i, j, VEGETATION.SHRUB);
        this.layers.set("vegetation", i, j, 90 + cellHash(i, j, 11) * 110);
        this.clearField(i, j);
      } else if (tool === "grass") {
        this.layers.set("vegKind", i, j, VEGETATION.GRASS);
        this.layers.set("vegetation", i, j, 100 + fertility * 120);
        this.clearField(i, j);
      } else if (tool === "crops") {
        if (this.field.slopeAt(i * SAMPLE_SPACING, j * SAMPLE_SPACING) > 0.3) return;
        this.layers.set("vegKind", i, j, VEGETATION.CROP);
        this.layers.set("vegetation", i, j, 200);
        this.layers.set("cropStage", i, j, 110 + cellHash(i, j, 15) * 110);
        this.layers.set("earthwork", i, j, EARTHWORK.FIELD);
        this.layers.set("fertility", i, j, Math.max(this.layers.get("fertility", i, j), 170));
      } else if (tool === "clear") {
        if (edge < 0.08) return;
        this.layers.set("vegKind", i, j, VEGETATION.NONE);
        this.layers.set("vegetation", i, j, 0);
        this.layers.set("cropStage", i, j, 0);
        this.clearField(i, j);
      }
    });
  }

  clearField(i, j) {
    if (this.layers.get("earthwork", i, j) === EARTHWORK.FIELD) this.layers.set("earthwork", i, j, EARTHWORK.NONE);
    if (this.layers.get("cropStage", i, j)) this.layers.set("cropStage", i, j, 0);
  }

  paintSoil(tool, x, y, radius, strength) {
    const target = SOIL_TARGETS[tool];
    if (!target) return;
    this.layers.forEachInCircle(x, y, radius, (i, j, distance) => {
      const weight = clamp(smooth(1 - distance / radius) * (0.35 + strength * 0.85), 0, 1);
      for (const [name, value] of Object.entries(target)) {
        const current = this.layers.get(name, i, j);
        this.layers.set(name, i, j, current + (value - current) * weight);
      }
      if (tool === "soil-rock" && weight > 0.5) this.layers.set("surface", i, j, SURFACE.STONE);
      else if (tool !== "soil-rock" && weight > 0.5 && this.layers.get("surface", i, j) === SURFACE.STONE) this.layers.set("surface", i, j, SURFACE.SOIL);
      if ((tool === "soil-bare" || tool === "soil-rock") && weight > 0.5 && this.layers.get("vegKind", i, j) !== VEGETATION.NONE) {
        this.layers.set("vegKind", i, j, VEGETATION.NONE);
        this.layers.set("vegetation", i, j, 0);
        this.clearField(i, j);
      }
    });
  }

  seedDeposit(tool, x, y, radius, strength) {
    const spec = DEPOSIT_KINDS[tool];
    this.layers.forEachInCircle(x, y, radius, (i, j, distance) => {
      if (this.isUnderwater(i, j)) return;
      const falloff = 1 - distance / radius;
      if (cellHash(i, j, 21) > 0.3 + falloff * 0.8 * (0.5 + strength)) return;
      this.layers.set("deposit", i, j, spec.kind);
      this.layers.set("depositAmount", i, j, Math.round(spec.amount * (0.5 + falloff * 0.9)));
      this.layers.set("cover", i, j, Math.round((3 + cellHash(i, j, 23) * 10) * 4));
    });
  }

  removeDeposit(x, y, radius) {
    this.layers.forEachInCircle(x, y, radius, (i, j) => {
      if (!this.layers.get("deposit", i, j)) return;
      this.layers.set("deposit", i, j, DEPOSIT.NONE);
      this.layers.set("depositAmount", i, j, 0);
      this.layers.set("cover", i, j, 0);
    });
  }

  // ---- discrete placements ------------------------------------------------------------------
  /** Why a settlement cannot stand at (x, y), or null when it can. `ignoreId` allows moving one. */
  settlementProblem(x, y, ignoreId = null) {
    if (x < 150 || y < 150 || x > this.world.width - 150 || y > this.world.height - 150) return "Too close to the map edge.";
    if (this.isUnderwater(Math.round(x / SAMPLE_SPACING), Math.round(y / SAMPLE_SPACING))) return "That ground is underwater.";
    if (this.field.slopeAt(x, y) > 0.2) return "Too steep. Flatten the ground first.";
    if (this.settlements.some(other => other.id !== ignoreId && Math.hypot(other.x - x, other.y - y) < 220)) return "Too close to another settlement.";
    if (this.bases.some(base => Math.hypot(base.x - x, base.y - y) < 190)) return "Too close to an army base.";
    return null;
  }

  addSettlement(x, y, entry = {}) {
    if (this.settlements.length >= MAX_SETTLEMENTS) return { ok: false, reason: `At most ${MAX_SETTLEMENTS} settlements.` };
    const problem = this.settlementProblem(x, y);
    if (problem) return { ok: false, reason: problem };
    const before = this.metaState();
    const item = this.makeSettlement(x, y, { ...this.lastSettlementDefaults, ...entry });
    this.settlements.push(item);
    this.history.recordMeta("Found settlement", before, this.metaState());
    this.emit("settlement");
    return { ok: true, settlement: item };
  }

  moveSettlement(id, x, y) {
    const item = this.settlements.find(candidate => candidate.id === id);
    if (!item) return { ok: false, reason: "No such settlement." };
    const problem = this.settlementProblem(x, y, id);
    if (problem) return { ok: false, reason: problem };
    const before = this.metaState();
    item.x = Math.round(x);
    item.y = Math.round(y);
    this.history.recordMeta("Move settlement", before, this.metaState());
    this.emit("settlement");
    return { ok: true, settlement: item };
  }

  updateSettlement(id, patch) {
    const item = this.settlements.find(candidate => candidate.id === id);
    if (!item) return null;
    const before = this.metaState();
    const clean = normalizeRegionConfig({ settlements: [{ ...this.specToConfig(item), ...patch }] }).settlements[0];
    Object.assign(item, clean);
    if (typeof patch.name === "string") item.name = patch.name.slice(0, 28);
    this.lastSettlementDefaults = this.specToConfig(item);
    this.history.recordMeta("Edit settlement", before, this.metaState());
    this.emit("settlement");
    return item;
  }

  removeSettlement(id) {
    const index = this.settlements.findIndex(candidate => candidate.id === id);
    if (index < 0) return false;
    const before = this.metaState();
    this.settlements.splice(index, 1);
    this.history.recordMeta("Remove settlement", before, this.metaState());
    this.emit("settlement");
    return true;
  }

  moveBase(index, x, y) {
    if (!this.bases[index]) return { ok: false, reason: "No such army." };
    const nx = clamp(x, 160, this.world.width - 160);
    const ny = clamp(y, 160, this.world.height - 160);
    if (this.isUnderwater(Math.round(nx / SAMPLE_SPACING), Math.round(ny / SAMPLE_SPACING))) return { ok: false, reason: "That ground is underwater." };
    const before = this.metaState();
    this.bases[index] = { x: Math.round(nx), y: Math.round(ny) };
    this.history.recordMeta("Move army base", before, this.metaState());
    this.emit("base");
    return { ok: true };
  }

  /** Flatten the ground under a base to the usual deployment level. */
  levelBase(index) {
    const base = this.bases[index];
    if (!base) return false;
    this.history.begin("Level base");
    this.history.touch(base.x, base.y, BASE_RADIUS * 2.2);
    levelSite(this.field, this.layers, base.x, base.y, BASE_RADIUS, 4);
    this.settleEcology(base.x, base.y, BASE_RADIUS * 1.8);
    const changed = this.history.end();
    if (changed) this.emit("edit");
    return changed;
  }

  /** Pick a settlement or base under a world point (for dragging and inspecting). */
  hit(x, y, zoom = 1) {
    const slack = 14 / Math.max(0.2, zoom);
    for (let index = this.bases.length - 1; index >= 0; index -= 1) {
      if (Math.hypot(this.bases[index].x - x, this.bases[index].y - y) <= 34 + slack) return { type: "base", index };
    }
    for (let index = this.settlements.length - 1; index >= 0; index -= 1) {
      const item = this.settlements[index];
      if (Math.hypot(item.x - x, item.y - y) <= 30 + slack) return { type: "settlement", id: item.id };
    }
    return null;
  }

  // ---- reading the map ----------------------------------------------------------------------
  probe(x, y) {
    const i = Math.round(x / SAMPLE_SPACING);
    const j = Math.round(y / SAMPLE_SPACING);
    const ground = this.field.heightAt(x, y);
    const info = this.layers.surfaceInfo(x, y);
    const wet = ground < WATER_LEVEL || info.waterSurface > NO_WATER;
    return {
      x: Math.round(x), y: Math.round(y), height: ground, slope: this.field.slopeAt(x, y),
      water: wet ? Math.max(0, (info.waterSurface > NO_WATER ? info.waterSurface : WATER_LEVEL) - ground) : 0,
      vegetation: wet ? "water" : ["bare ground", "grass", "scrub", "forest", "farmland"][info.vegKind] || "bare ground",
      fertility: info.fertility, moisture: info.moisture, deposit: info.deposit, cell: { i, j }
    };
  }

  stats() {
    let forest = 0;
    let water = 0;
    let fields = 0;
    let total = 0;
    const deposits = { iron: 0, promethium: 0, stone: 0 };
    const cols = Math.ceil(this.world.width / SAMPLE_SPACING);
    const rows = Math.ceil(this.world.height / SAMPLE_SPACING);
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        total += 1;
        if (this.isUnderwater(i, j)) { water += 1; continue; }
        const kind = this.layers.get("vegKind", i, j);
        if (kind === VEGETATION.FOREST) forest += 1;
        else if (kind === VEGETATION.CROP) fields += 1;
        const deposit = this.layers.get("deposit", i, j);
        if (deposit === DEPOSIT.IRON) deposits.iron += 1;
        else if (deposit === DEPOSIT.PROMETHIUM) deposits.promethium += 1;
        else if (deposit === DEPOSIT.STONE) deposits.stone += 1;
      }
    }
    const extent = this.field.extent();
    return {
      forest: forest / total, water: water / total, fields: fields / total, deposits,
      lowest: this.field.chunks.size ? extent.min : this.field.baseHeight, highest: this.field.chunks.size ? extent.max : this.field.baseHeight, settlements: this.settlements.length
    };
  }

  /** Playability checks shown beside the map. */
  diagnose() {
    const notes = [];
    const unevenness = (x, y, radius) => {
      let min = Infinity;
      let max = -Infinity;
      for (let a = 0; a < 16; a += 1) {
        const h = this.field.heightAt(x + Math.cos(a / 16 * Math.PI * 2) * radius, y + Math.sin(a / 16 * Math.PI * 2) * radius);
        min = Math.min(min, h); max = Math.max(max, h);
      }
      return max - min;
    };
    this.bases.forEach((base, index) => {
      const label = this.armyLabel(index);
      if (this.isUnderwater(Math.round(base.x / SAMPLE_SPACING), Math.round(base.y / SAMPLE_SPACING))) notes.push({ level: "error", text: `${label}'s base is underwater.`, at: base });
      else if (unevenness(base.x, base.y, 110) > 7) notes.push({ level: "warn", text: `${label}'s base is on uneven ground. Use "Level base".`, at: base, fix: `level:${index}` });
    });
    let closest = null;
    for (let a = 0; a < this.bases.length; a += 1) {
      for (let b = a + 1; b < this.bases.length; b += 1) {
        const gap = Math.hypot(this.bases[a].x - this.bases[b].x, this.bases[a].y - this.bases[b].y);
        if (gap < Math.min(700, Math.min(this.world.width, this.world.height) * 0.35) && (!closest || gap < closest.gap)) closest = { a, b, gap };
      }
    }
    if (closest) notes.push({ level: "warn", text: `${this.armyLabel(closest.a)} and ${this.armyLabel(closest.b)} start very close together.`, at: this.bases[closest.a] });
    for (const item of this.settlements) {
      const label = item.name || item.id.toUpperCase();
      if (this.isUnderwater(Math.round(item.x / SAMPLE_SPACING), Math.round(item.y / SAMPLE_SPACING))) { notes.push({ level: "error", text: `${label} is underwater.`, at: { x: item.x, y: item.y } }); continue; }
      if (item.mine) {
        let deposit = 0;
        this.layers.forEachInCircle(item.x, item.y, 300, (i, j) => { if (this.layers.get("deposit", i, j)) deposit += 1; });
        if (!deposit) notes.push({ level: "info", text: `${label} has a mine but no ore within reach; its miners will have nothing to dig.`, at: { x: item.x, y: item.y } });
      }
      let open = 0;
      let cells = 0;
      this.layers.forEachInCircle(item.x, item.y, 160, (i, j) => {
        if ((i + j) % 2) return;
        cells += 1;
        if (!this.isUnderwater(i, j) && this.layers.get("vegKind", i, j) !== VEGETATION.FOREST && this.field.slopeAt(i * SAMPLE_SPACING, j * SAMPLE_SPACING) < 0.15) open += 1;
      });
      if (cells && open / cells < 0.25) notes.push({ level: "warn", text: `${label} has little open, flat land to farm.`, at: { x: item.x, y: item.y } });
    }
    if (!this.settlements.length) notes.push({ level: "info", text: `No settlements: the battle will be ${this.bases.length} armies on empty ground.` });
    return notes;
  }

  // ---- armies (players) -----------------------------------------------------------------------
  armyLabel(index) { return this.armies[index]?.name || `Army ${String.fromCharCode(65 + index)}`; }
  playerId(index) { return PLAYER_IDS[index]; }

  /** Change how many armies take part. New bases go on the usual ring; the rest keep their places. */
  setPlayerCount(count) {
    const next = clamp(Math.round(Number(count) || MIN_PLAYERS), MIN_PLAYERS, MAX_PLAYERS);
    if (next === this.bases.length) return false;
    const before = this.metaState();
    const beforeLength = this.bases.length;
    if (next > beforeLength) {
      const spare = defaultBases(this.world, next);
      for (let index = beforeLength; index < next; index += 1) {
        // Prefer the ring spot that is not under water and not already close to another base.
        let spot = spare[index];
        if (this.bases.some(base => Math.hypot(base.x - spot.x, base.y - spot.y) < 260) || this.isUnderwater(Math.round(spot.x / SAMPLE_SPACING), Math.round(spot.y / SAMPLE_SPACING))) {
          spot = this.findOpenGround(spot) || spot;
        }
        this.bases.push(spot);
        this.armies.push(this.armyFactory(index));
      }
    } else {
      this.bases.length = next;
      this.armies.length = next;
      const valid = new Set(PLAYER_IDS.slice(0, next));
      for (const item of this.settlements) if (item.owner && !valid.has(item.owner)) item.owner = "";
    }
    this.history.recordMeta(next > beforeLength ? "Add army" : "Remove army", before, this.metaState());
    this.emit("base");
    return true;
  }

  findOpenGround(near) {
    for (let ring = 1; ring < 30; ring += 1) {
      for (let k = 0; k < 12; k += 1) {
        const angle = k / 12 * Math.PI * 2 + ring;
        const x = clamp(near.x + Math.cos(angle) * ring * 90, 200, this.world.width - 200);
        const y = clamp(near.y + Math.sin(angle) * ring * 90, 200, this.world.height - 200);
        if (this.isUnderwater(Math.round(x / SAMPLE_SPACING), Math.round(y / SAMPLE_SPACING))) continue;
        if (this.bases.some(base => Math.hypot(base.x - x, base.y - y) < 320)) continue;
        if (this.settlements.some(item => Math.hypot(item.x - x, item.y - y) < 220)) continue;
        return { x: Math.round(x), y: Math.round(y) };
      }
    }
    return null;
  }

  updateArmy(index, patch) {
    if (!this.armies[index]) return null;
    const before = this.metaState();
    Object.assign(this.armies[index], patch);
    this.history.recordMeta("Edit army", before, this.metaState());
    this.emit("army");
    return this.armies[index];
  }

  // ---- canvas (world) size ----------------------------------------------------------------------
  /**
   * Resize the map around its centre. Ground, cover and everything on it keep their places;
   * new ground is meadow, and anything that would fall outside is clipped.
   */
  resize(width, height) {
    const next = sanitizeRegionWorld({ width, height });
    if (next.width === this.world.width && next.height === this.world.height) return false;
    const before = this.snapshot();
    const di = Math.round((next.width - this.world.width) / 2 / SAMPLE_SPACING);
    const dj = Math.round((next.height - this.world.height) / 2 / SAMPLE_SPACING);
    const shiftX = di * SAMPLE_SPACING;
    const shiftY = dj * SAMPLE_SPACING;
    const oldCols = Math.ceil(this.world.width / SAMPLE_SPACING) + 1;
    const oldRows = Math.ceil(this.world.height / SAMPLE_SPACING) + 1;
    const cols = Math.ceil(next.width / SAMPLE_SPACING) + 1;
    const rows = Math.ceil(next.height / SAMPLE_SPACING) + 1;

    const field = new HeightField({ width: next.width, height: next.height, baseHeight: this.field.baseHeight });
    field.seed = this.field.seed;
    field.waterLevel = this.field.waterLevel;
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const oi = i - di;
        const oj = j - dj;
        if (oi < 0 || oj < 0 || oi >= oldCols || oj >= oldRows) continue;
        const value = this.field.getSculptSample(oi, oj);
        if (Math.abs(value) > 0.005) field.setSculptSample(i, j, value);
      }
    }
    const layers = new WorldLayers({ width: next.width, height: next.height, defaults: this.layers.defaults });
    const names = [...LAYER_NAMES, "depositAmount", "waterSurface"];
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const oi = i - di;
        const oj = j - dj;
        const inside = oi >= 0 && oj >= 0 && oi < oldCols && oj < oldRows;
        if (!inside) {
          layers.set("vegKind", i, j, VEGETATION.GRASS);
          layers.set("vegetation", i, j, 110 + cellHash(i, j, 5) * 60);
          layers.set("fertility", i, j, 150 + cellHash(i, j, 3) * 40);
          layers.set("moisture", i, j, 90);
          continue;
        }
        for (const name of names) {
          const value = this.layers.get(name, oi, oj);
          if (value !== (name === "waterSurface" ? NO_WATER : this.layers.defaults[name] || 0)) layers.set(name, i, j, value);
        }
      }
    }
    this.field.adopt(field);
    this.field.resize(next.width, next.height);
    this.layers.chunks = layers.chunks;
    this.layers.width = next.width;
    this.layers.height = next.height;
    this.layers.bulk += 1;
    this.world = next;
    const keep = point => ({ x: clamp(Math.round(point.x + shiftX), 160, next.width - 160), y: clamp(Math.round(point.y + shiftY), 160, next.height - 160) });
    this.bases = this.bases.map(keep);
    this.settlements = this.settlements
      .map(item => ({ ...item, x: item.x + shiftX, y: item.y + shiftY }))
      .filter(item => item.x >= 150 && item.y >= 150 && item.x <= next.width - 150 && item.y <= next.height - 150);
    this.config = normalizeRegionConfig({ ...this.config, world: next, settlements: this.config.settlements });
    this.history.recordSnapshot("Resize map", before, this.snapshot());
    this.emit("resize");
    return true;
  }

  // ---- persistence --------------------------------------------------------------------------
  toPayload() {
    return {
      version: 1,
      kind: "region-map",
      name: this.name,
      palette: this.palette,
      config: { ...this.config, settlements: this.settlements.map(item => ({ ...this.specToConfig(item), x: item.x, y: item.y, name: item.name || "" })) },
      world: { ...this.world },
      field: this.field.serialize(),
      layers: this.layers.serialize(),
      bases: structuredClone(this.bases),
      armies: structuredClone(this.armies),
      savedAt: Date.now()
    };
  }

  loadPayload(payload) {
    if (!payload || payload.kind !== "region-map" || !payload.field || !payload.layers) return false;
    const before = this.snapshot();
    this.restoreSnapshot({
      name: payload.name || "Imported region", palette: payload.palette, config: payload.config,
      world: payload.world || payload.config?.world, armies: payload.armies,
      field: payload.field, layers: payload.layers, bases: payload.bases,
      settlements: (payload.config?.settlements || []).filter(item => Number.isFinite(item.x) && Number.isFinite(item.y)).map((item, index) => ({ id: `s${index + 1}`, x: item.x, y: item.y, name: item.name || "", ...normalizeRegionConfig({ settlements: [item] }).settlements[0] })),
      nextSettlementId: (payload.config?.settlements?.length || 0) + 1
    });
    this.history.recordSnapshot("Load region", before, this.snapshot());
    this.emit("load");
    return true;
  }

  /** The authored world in the shape RegionRuntime.begin() deploys. */
  toDeploy() {
    const payload = this.toPayload();
    return { ...payload, authored: true };
  }

  summary() {
    const stats = this.stats();
    return `${this.settlements.length} settlements · ${Math.round(stats.forest * 100)}% forest · ${Math.round(stats.water * 100)}% water`;
  }
}

export { REGION_CULTURES, CHUNK_SPAN };
