// The "single region" scenario runtime: one persistent map with hills, rivers,
// woodland, mineral deposits, destructible settlements and two armies. It owns
// the ecosystem and the living settlements and is the only bridge between them
// and the battle simulator, which hands in a small `api` of callbacks so this
// module has no dependency on the 20k-line app closure.

import { WorldLayers, SURFACE, VEGETATION, EARTHWORK, NO_WATER } from "../world/WorldLayers.js";
import { generateRegion, pickSettlementSites } from "../world/RegionGenerator.js";
import { EcosystemSimulator } from "../world/Ecosystem.js";
import { LivingSettlements } from "../settlements/LivingSettlements.js";
import { groundEffects, unitClassFor, weatherEffects } from "../world/GroundEffects.js";
import { CHUNK_SPAN } from "../terrain/HeightField.js";
import { BUILDING_TYPES, DAY } from "../settlements/Settlement.js";

export const REGION_WORLD = Object.freeze({ width: 2560, height: 1440 });
export const REGION_WORLD_LIMITS = Object.freeze({ minWidth: 960, minHeight: 540, maxWidth: 8192, maxHeight: 4608, step: 8 });

/** A usable region size: a multiple of 8, inside the supported range. */
export function sanitizeRegionWorld(input) {
  const { minWidth, minHeight, maxWidth, maxHeight, step } = REGION_WORLD_LIMITS;
  const snap = (value, min, max, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n / step) * step)) : fallback;
  };
  return { width: snap(input?.width, minWidth, maxWidth, REGION_WORLD.width), height: snap(input?.height, minHeight, maxHeight, REGION_WORLD.height) };
}

export const REGION_CULTURES = Object.freeze(["frontier", "devout", "mining", "martial", "free"]);

export const DEFAULT_REGION_CONFIG = Object.freeze({
  seed: "REGION-1",
  biome: "temperate",
  mountains: null,
  riverCount: 2,
  lakeCount: 1,
  forestDensity: null,
  deposits: Object.freeze({ iron: 3, promethium: 1, stone: 2 }),
  settlements: Object.freeze([
    Object.freeze({ population: 36, farmland: 1, mine: true, militiaShare: 0.12, culture: "frontier", owner: "" }),
    Object.freeze({ population: 32, farmland: 1, mine: true, militiaShare: 0.1, culture: "devout", owner: "" }),
    Object.freeze({ population: 28, farmland: 1.1, mine: false, militiaShare: 0.08, culture: "free", owner: "" })
  ])
});

export const MAX_REGION_SETTLEMENTS = 16;

export function normalizeRegionConfig(input = {}) {
  const base = DEFAULT_REGION_CONFIG;
  const num = (value, fallback, min, max) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const settlements = (Array.isArray(input.settlements) ? input.settlements : base.settlements).slice(0, MAX_REGION_SETTLEMENTS).map(entry => ({
    population: Math.round(num(entry?.population, 32, 8, 120)),
    farmland: num(entry?.farmland, 1, 0.3, 2),
    mine: entry?.mine !== false,
    militiaShare: num(entry?.militiaShare, 0.1, 0, 0.5),
    culture: REGION_CULTURES.includes(entry?.culture) ? entry.culture : "frontier",
    owner: typeof entry?.owner === "string" ? entry.owner : "",
    // Hand-placed settlements (from the map workshop) carry an exact position and name.
    ...(Number.isFinite(entry?.x) && Number.isFinite(entry?.y) ? { x: entry.x, y: entry.y } : {}),
    ...(typeof entry?.name === "string" && entry.name ? { name: entry.name.slice(0, 28) } : {})
  }));
  return {
    ...(input.world ? { world: sanitizeRegionWorld(input.world) } : {}),
    seed: String(input.seed || base.seed).slice(0, 40),
    biome: ["temperate", "forest", "desert", "frozen", "volcanic", "wetland"].includes(input.biome) ? input.biome : base.biome,
    mountains: input.mountains == null || input.mountains === "" ? null : num(input.mountains, 0.5, 0, 1),
    riverCount: Math.round(num(input.riverCount, base.riverCount, 0, 5)),
    lakeCount: Math.round(num(input.lakeCount, base.lakeCount, 0, 4)),
    forestDensity: input.forestDensity == null || input.forestDensity === "" ? null : num(input.forestDensity, 0.5, 0, 1),
    deposits: {
      iron: Math.round(num(input.deposits?.iron, base.deposits.iron, 0, 8)),
      promethium: Math.round(num(input.deposits?.promethium, base.deposits.promethium, 0, 5)),
      stone: Math.round(num(input.deposits?.stone, base.deposits.stone, 0, 8))
    },
    settlements
  };
}

const ROLE_COLORS = {
  farmer: "#9bd36a", miner: "#b9a58a", builder: "#f0a04b", militia: "#6aa8ff", child: "#f3e6b8",
  elder: "#cfcfcf", refugee: "#ffe14d", captive: "#ffffff", enslaved: "#c0563f"
};
const BUILDING_COLORS = {
  house: ["#a9824f", "#6e4f2c"], granary: ["#c9a85c", "#7a5f2a"], watchtower: ["#8a7a64", "#4c4033"],
  barricade: ["#6b5238", "#3a2c1d"], palisade: ["#7b5b3a", "#3f2d1b"], mineworks: ["#8d8f93", "#4d5055"], hall: ["#d9cba3", "#8b7a4f"]
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createRegionRuntime(api) {
  const rt = {
    active: false,
    world: { ...REGION_WORLD },
    config: null,
    info: null,
    layers: null,
    eco: null,
    living: null,
    bindings: new Map(), // settlement id -> economic node id
    unitFeedAt: -1,
    unitFeed: [],
    effectCache: new Map(),
    effectCacheAt: 0,
    vegetation: new Map(),
    feed: [],
    listeners: new Set()
  };

  const state = () => api.state();
  const emit = event => { for (const listener of rt.listeners) listener(event); };
  rt.on = listener => { rt.listeners.add(listener); return () => rt.listeners.delete(listener); };

  // ---- creating the region ------------------------------------------------------------------
  rt.begin = (rawConfig, bases = [], saved = null, authored = null) => {
    const s = state();
    rt.world = sanitizeRegionWorld(authored?.world || saved?.world || rawConfig?.world || REGION_WORLD);
    if (authored?.field && authored?.layers) {
      // A map made in the workshop: adopt its ground as it is instead of generating one.
      rt.restored = false;
      rt.authored = true;
      rt.config = normalizeRegionConfig(rawConfig);
      s.heightField.adopt(api.deserializeField(authored.field));
      rt.layers = WorldLayers.deserialize(authored.layers, rt.world);
      s.worldLayers = rt.layers;
      rt.info = { seed: rt.config.seed, palette: authored.palette || "temperate", sites: [], rivers: [], lakes: [], authored: true };
      s.terrainPalette = rt.info.palette;
      rt.eco = new EcosystemSimulator({ layers: rt.layers, field: s.heightField, random: api.random, startSeason: 0 });
      rt.eco.setWeather("clear");
      rt.living = null;
      rt.bindings.clear();
      rt.vegetation.clear();
      rt.effectCache.clear();
      rt.feed = [];
      rt.unitFeedAt = -1;
      rt.bases = bases.map(base => ({ ...base }));
      rt.active = true;
      s.region = rt;
      return rt.info;
    }
    rt.authored = false;
    if (saved) {
      rt.bases = bases.map(base => ({ ...base }));
      if (rt.deserialize(saved, s.heightField)) {
        rt.info = { seed: rt.config.seed, palette: saved.palette || "temperate", sites: [], rivers: [], lakes: [] };
        s.terrainPalette = rt.info.palette;
        rt.restored = true;
        return rt.info;
      }
    }
    rt.restored = false;
    const config = normalizeRegionConfig(rawConfig);
    const { width, height } = rt.world;
    rt.config = config;
    rt.layers = new WorldLayers({ width, height });
    rt.info = generateRegion({
      field: s.heightField, layers: rt.layers, seed: config.seed, width, height,
      biome: config.biome, mountains: config.mountains, riverCount: config.riverCount, lakeCount: config.lakeCount,
      forestDensity: config.forestDensity, deposits: config.deposits,
      flatZones: bases.map(base => ({ x: base.x, y: base.y, radius: 150, level: 4 }))
    });
    s.worldLayers = rt.layers;
    s.terrainPalette = rt.info.palette;
    rt.eco = new EcosystemSimulator({ layers: rt.layers, field: s.heightField, random: api.random, startSeason: 0 });
    rt.eco.setWeather("clear");
    rt.living = null;
    rt.bindings.clear();
    rt.vegetation.clear();
    rt.effectCache.clear();
    rt.feed = [];
    rt.unitFeedAt = -1;
    rt.bases = bases.map(base => ({ ...base }));
    rt.active = true;
    s.region = rt;
    return rt.info;
  };

  /** Create the settlements (after the battle reset has cleared the economic nodes). */
  rt.populate = () => {
    if (!rt.active) return [];
    const s = state();
    const config = rt.config;
    if (rt.restored && rt.living) {
      // A loaded world keeps its people; only the economic nodes (rebuilt each battle reset) need binding again.
      rt.bindings.clear();
      for (const settlement of rt.living.settlements.values()) if (settlement.status !== "ruined" || settlement.agentIds.length) bindNode(settlement);
      return [...rt.living.settlements.values()];
    }
    rt.living = new LivingSettlements({
      field: s.heightField, layers: rt.layers, eco: rt.eco, random: api.random,
      width: rt.world.width, height: rt.world.height,
      limits: { maxSettlements: 24 },
      host: buildHost()
    });
    const avoid = rt.bases.map(base => ({ x: base.x, y: base.y, radius: 190 }));
    let sites = [];
    const unplaced = config.settlements.filter(entry => !Number.isFinite(entry.x));
    for (const separation of [470, 380, 300, 230]) {
      sites = pickSettlementSites(rt.info.sites, unplaced.length, separation, avoid);
      if (sites.length >= unplaced.length) break;
    }
    const created = [];
    let nextSite = 0;
    config.settlements.forEach(entry => {
      const site = Number.isFinite(entry.x) ? { x: entry.x, y: entry.y } : sites[nextSite++];
      if (!site) return;
      const settlement = rt.living.addSettlement({
        x: site.x, y: site.y, name: entry.name || null, population: entry.population, culture: entry.culture, farmland: entry.farmland,
        mine: entry.mine, militiaShare: entry.militiaShare, owner: entry.owner || null
      });
      if (!settlement) return;
      created.push(settlement);
      bindNode(settlement);
    });
    return created;
  };

  function bindNode(settlement) {
    const s = state();
    const node = api.createNode({ x: settlement.x, y: settlement.y }, {
      name: settlement.name, owner: settlement.owner || "", startingOwner: settlement.owner || ""
    });
    node.livingId = settlement.id;
    settlement.nodeId = node.id;
    rt.bindings.set(settlement.id, node.id);
    s.economicNodes.push(node);
    return node;
  }

  /** Found a new settlement at (or near) a point -- used by the overview panel and by tests. */
  rt.addSettlementAt = ({ x, y, population = 28, culture = "frontier", farmland = 1, mine = true, militiaShare = 0.1, owner = null, name = null } = {}) => {
    if (!rt.active || !rt.living) return null;
    const s = state();
    let spot = null;
    for (let ring = 0; ring < 12 && !spot; ring += 1) {
      for (let k = 0; k < (ring ? 10 : 1) && !spot; k += 1) {
        const angle = k / 10 * Math.PI * 2 + ring;
        const px = clamp(x + Math.cos(angle) * ring * 40, 150, rt.world.width - 150);
        const py = clamp(y + Math.sin(angle) * ring * 40, 150, rt.world.height - 150);
        const ground = rt.groundFor({ x: px, y: py });
        const tooClose = [...rt.living.settlements.values()].some(other => Math.hypot(other.x - px, other.y - py) < 220);
        if (ground.depth < 0.15 && s.heightField.slopeAt(px, py) < 0.2 && !tooClose) spot = { x: px, y: py };
      }
    }
    if (!spot) return null;
    const settlement = rt.living.addSettlement({ ...spot, population, culture, farmland, mine, militiaShare, owner, name });
    if (settlement) { bindNode(settlement); emit({ type: "added", settlement }); }
    return settlement;
  };

  rt.removeSettlementById = id => {
    if (!rt.living) return false;
    const nodeId = rt.bindings.get(id);
    const s = state();
    if (nodeId) s.economicNodes = s.economicNodes.filter(node => node.id !== nodeId);
    rt.bindings.delete(id);
    return rt.living.removeSettlement(id);
  };

  function nodeFor(settlement) {
    const id = rt.bindings.get(settlement.id);
    return id ? state().economicNodes.find(node => node.id === id) : null;
  }

  // ---- host bridge --------------------------------------------------------------------------
  function buildHost() {
    return {
      hostile: (a, b) => !api.areAllies(a, b),
      nameOf: faction => api.nameOf(faction),
      policyOf: faction => api.policyOf(faction),
      stressOf: faction => api.stressOf(faction),
      baseOf: faction => api.baseOf(faction),
      grant: (faction, resources, reason) => api.grant(faction, resources, reason),
      recruit: (faction, count, settlement) => api.recruit(faction, count, nodeFor(settlement) || settlement),
      attack: (threatId, damage, agentId, settlement) => api.attack(threatId, damage, settlement),
      incident: (text, id, level) => {
        rt.feed.push({ time: rt.living?.time ?? 0, text, level });
        if (rt.feed.length > 80) rt.feed.splice(0, rt.feed.length - 80);
        api.incident(text, id, level);
      },
      onCapture: (settlement, previous, owner) => {
        const node = nodeFor(settlement);
        if (node) { node.owner = owner || ""; api.onNodeOwner?.(node, previous, owner); }
        emit({ type: "capture", settlement, previous, owner });
      },
      onIndependence: settlement => {
        const node = nodeFor(settlement);
        if (node) node.owner = "";
        emit({ type: "independence", settlement });
      },
      onFounded: settlement => { bindNode(settlement); emit({ type: "founded", settlement }); },
      onRuined: settlement => emit({ type: "ruined", settlement })
    };
  }

  // ---- stepping ------------------------------------------------------------------------------
  function extractUnits(now) {
    const s = state();
    const list = [];
    for (const unit of s.units) {
      if (!unit.alive || unit.incapacitated) continue;
      if (unit.role === "builder" || unit.role === "supply" || unit.role === "aircraft") continue;
      const policy = api.policyOf(unit.faction);
      list.push({
        id: unit.id, x: unit.x, y: unit.y, faction: unit.faction, alive: true,
        strength: unit.role === "vehicle" ? 4 : 1,
        range: clamp(unit.range || 90, 40, 120),
        damage: clamp((unit.damage || 12) * (unit.role === "vehicle" ? 1.4 : 1), 6, 60),
        rate: 1,
        brutality: policy.brutality,
        incendiary: Boolean(unit.incendiary)
      });
    }
    rt.unitFeed = list;
    rt.unitFeedAt = now;
  }

  rt.step = dt => {
    if (!rt.active || !rt.living) return;
    const s = state();
    if (rt.unitFeedAt < 0 || s.time - rt.unitFeedAt >= 0.4) extractUnits(s.time);
    rt.eco.step(dt);
    const sky = rt.eco.weather.rain >= 0.5 ? "rain" : "clear";
    if (s.dayNight.weather !== sky && (s.dayNight.weather === "rain" || s.dayNight.weather === "clear")) s.dayNight.weather = sky;
    rt.living.step(dt, {
      units: rt.unitFeed,
      focus: { x: s.camera.x, y: s.camera.y, radius: Math.max(520, 1100 / Math.max(0.12, s.camera.zoom)) }
    });
    syncNodes();
    if (s.time >= (rt.nextHazardAt || 0)) { rt.nextHazardAt = s.time + 1; burnUnits(s); }
  };

  // Fire is real ground state: anyone standing in a burning cell catches light.
  function burnUnits(s) {
    if (!rt.eco.fires.size) return;
    for (const unit of s.units) {
      if (!unit.alive) continue;
      const fire = rt.layers.surfaceInfo(unit.x, unit.y).fire;
      if (fire <= 0.25) continue;
      unit.burningRemaining = Math.max(unit.burningRemaining || 0, 2.5);
      unit.burningDamagePerSecond = Math.max(unit.burningDamagePerSecond || 0, 1.5 + fire * 4);
    }
  }

  function syncNodes() {
    for (const settlement of rt.living.settlements.values()) {
      const node = nodeFor(settlement);
      if (!node) continue;
      const owner = settlement.owner || "";
      if (node.owner !== owner) node.owner = owner;
      const agents = settlement.agentIds.length;
      node.livePopulation = agents;
      node.active = settlement.status !== "ruined";
    }
  }

  // ---- explosions and ground -------------------------------------------------------------------
  rt.onExplosion = (x, y, radius, damage, { faction = null, incendiary = false } = {}) => {
    if (!rt.active || !rt.living) return;
    rt.living.damageArea(x, y, radius, damage, { faction, incendiary, crater: damage >= 20 });
  };

  /** Ground effects for a unit standing at `point`; cached per 8-unit cell. */
  rt.groundFor = (point, unit = null) => {
    if (!rt.active) return null;
    const s = state();
    const stamp = Math.floor(s.time);
    if (stamp !== rt.effectCacheAt || rt.effectCache.size > 6000) { rt.effectCache.clear(); rt.effectCacheAt = stamp; }
    const kind = unit ? unitClassFor({ ...unit, factionName: api.factionName(unit.faction) }) : "infantry";
    const key = `${Math.round(point.x / 8)},${Math.round(point.y / 8)},${kind}`;
    let entry = rt.effectCache.get(key);
    if (!entry) {
      const info = rt.layers.surfaceInfo(point.x, point.y);
      const ground = s.heightField.heightAt(point.x, point.y);
      const effect = groundEffects(info, ground, kind, rt.eco?.weather);
      const depth = info.waterSurface > NO_WATER ? info.waterSurface - ground : 0;
      entry = { effect, depth };
      rt.effectCache.set(key, entry);
    }
    return entry;
  };

  // ---- queries for the UI ---------------------------------------------------------------------
  rt.nameOf = faction => api.nameOf(faction);
  rt.overview = () => (rt.living ? rt.living.overview() : []);
  rt.chronicle = (limit = 24) => (rt.living ? rt.living.chronicle.slice(-limit) : []);
  rt.environment = () => {
    if (!rt.eco) return null;
    const season = rt.eco.season;
    return { season: season.name, year: season.year + 1, weather: rt.eco.weather.state, rain: rt.eco.weather.rain, fires: rt.eco.fires.size, burned: rt.eco.stats.burnedCells, harvests: rt.eco.stats.harvests, visibility: weatherEffects(rt.eco.weather).visibility };
  };
  rt.counts = () => {
    if (!rt.living) return { people: 0, refugees: 0, settlements: 0 };
    return { people: rt.living.agents.size, refugees: rt.living.refugees.length, settlements: rt.living.settlements.size };
  };

  // ---- rendering ---------------------------------------------------------------------------------
  function vegetationEntry(cx, cy) {
    const key = `${cx},${cy}`;
    const rev = state().heightField.revisionAround(cx, cy) + rt.layers.revisionAround(cx, cy) * 7;
    let entry = rt.vegetation.get(key);
    if (entry && entry.rev === rev) return entry;
    return { stale: true, entry, key, rev };
  }

  let bakeCounter = 0;
  rt.drawVegetation = (ctx, bounds, bakeLimit = 3, drawTile = null) => {
    if (!rt.active) return;
    const s = state();
    const span = CHUNK_SPAN;
    const minX = Math.max(0, Math.floor(bounds.left / span));
    const maxX = Math.min(Math.ceil(rt.world.width / span) - 1, Math.floor(bounds.right / span));
    const minY = Math.max(0, Math.floor(bounds.top / span));
    const maxY = Math.min(Math.ceil(rt.world.height / span) - 1, Math.floor(bounds.bottom / span));
    if ((maxX - minX + 1) * (maxY - minY + 1) > 400) return;
    let baked = 0;
    let pending = false;
    for (let cy = minY; cy <= maxY; cy += 1) {
      for (let cx = minX; cx <= maxX; cx += 1) {
        const probe = vegetationEntry(cx, cy);
        let entry = probe.stale ? probe.entry : probe;
        if (probe.stale) {
          if (baked < bakeLimit) {
            const canvas = probe.entry?.canvas || null;
            const made = api.bakeVegetation(rt.layers, s.heightField, cx, cy, canvas);
            entry = { canvas: made, rev: probe.rev, uid: (bakeCounter += 1) };
            rt.vegetation.set(probe.key, entry);
            baked += 1;
          } else pending = true;
        }
        if (entry?.canvas) {
          if (drawTile) drawTile(`${cx},${cy}`, entry.canvas, entry.uid, cx * span, cy * span, span + 0.5, span + 0.5);
          else ctx.drawImage(entry.canvas, cx * span, cy * span, span, span);
        }
      }
    }
    return pending;
  };

  const farEnough = (zoom, minZoom) => zoom >= minZoom;

  // ---- citizens: picking and a plain-data stat report --------------------------------------
  /** The living citizen (or refugee) nearest a world point, within `reach`. Ignores the dead. */
  rt.citizenAt = (x, y, reach = 8) => {
    if (!rt.active || !rt.living) return null;
    let best = null; let bestD = reach;
    const consider = agent => {
      if (!agent?.alive) return;
      const d = Math.hypot(agent.x - x, agent.y - y);
      if (d < bestD) { bestD = d; best = agent; }
    };
    for (const settlement of rt.living.settlements.values()) {
      if (Math.abs(settlement.x - x) > settlement.radius * 1.3 + reach || Math.abs(settlement.y - y) > settlement.radius * 1.3 + reach) continue;
      for (const id of settlement.agentIds) consider(rt.living.agents.get(id));
    }
    for (const agent of rt.living.refugees) consider(agent);
    return best;
  };

  rt.roleColor = role => ROLE_COLORS[role] || "#dddddd";

  rt.citizenById = id => {
    const agent = id && rt.living ? rt.living.agents.get(id) : null;
    return agent && agent.alive ? agent : null;
  };

  const ACTIVITY_LABELS = { idle: "Idle", sow: "Sowing a field", tend: "Tending crops", harvest: "Harvesting", mine: "Mining ore", build: "Building", dig: "Digging a trench", repair: "Repairing", chop: "Felling trees", eat: "Eating", rest: "Resting", wander: "Wandering", flee: "Fleeing danger", patrol: "On patrol", guard: "Standing guard", fire: "Fighting a fire", advance: "Advancing on the enemy", deliver: "Carrying goods", travel: "Travelling", held: "Held captive", settling: "Heading to a new settlement" };
  const level = (value, words) => words[Math.min(words.length - 1, Math.max(0, Math.floor((value ?? 0) * words.length)))];

  /** Everything the stat card shows about one person, as plain values. */
  rt.citizenReport = agent => {
    if (!agent) return null;
    const home = agent.settlementId ? rt.living.settlements.get(agent.settlementId) : rt.living.settlements.get(agent.originId) || null;
    const clampUnit = value => Math.min(1, Math.max(0, Number(value) || 0));
    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      workRole: agent.workRole || null,
      age: Math.round(agent.age),
      rebel: Boolean(agent.rebel),
      hp: agent.hp, maxHp: agent.maxHp,
      hunger: clampUnit(agent.needs?.hunger), fatigue: clampUnit(agent.needs?.fatigue), fear: clampUnit(agent.needs?.fear),
      morale: agent.morale != null ? clampUnit(agent.morale) : null,
      skills: Object.fromEntries(Object.entries(agent.skills || {}).map(([key, value]) => [key, clampUnit(value)])),
      traits: Object.fromEntries(Object.entries(agent.traits || {}).map(([key, value]) => [key, clampUnit(value)])),
      loyalty: Math.round((agent.loyalty?.settlement ?? 0) * 100) / 100,
      activity: agent.task?.settling ? ACTIVITY_LABELS.settling : ACTIVITY_LABELS[agent.task?.type] || ACTIVITY_LABELS[agent.activity] || "Idle",
      carrying: { food: Math.round((agent.carrying?.food || 0) * 10) / 10, materials: Math.round((agent.carrying?.materials || 0) * 10) / 10 },
      temperament: `${level(agent.traits?.courage, ["timid", "wary", "steady", "bold"])}, ${level(agent.traits?.diligence, ["idle", "casual", "hardworking", "tireless"])}`,
      settlement: home ? { id: home.id, name: home.name, owner: home.owner || null, status: home.status, population: home.agentIds.length, radius: Math.round(home.radius), posture: home.posture } : null,
      refugeeFrom: agent.role === "refugee" ? agent.originName || null : null,
      history: (agent.history || []).slice(-5)
    };
  };


  rt.drawSettlements = (ctx, bounds, zoom, now = 0) => {
    if (!rt.active || !rt.living) return;
    const s = state();
    const inView = (x, y, pad) => x > bounds.left - pad && x < bounds.right + pad && y > bounds.top - pad && y < bounds.bottom + pad;
    for (const settlement of rt.living.settlements.values()) {
      if (!inView(settlement.x, settlement.y, settlement.radius * 1.3)) continue;
      const ownerPlayer = settlement.owner ? api.colorOf(settlement.owner) : "#d8c9a0";
      // Territory ring: ownership and posture at a glance.
      ctx.save();
      ctx.lineWidth = Math.max(1.2, 2 / zoom);
      ctx.strokeStyle = settlement.posture === "siege" ? "#ff5a4a" : settlement.posture === "alert" ? "#ffb347" : ownerPlayer;
      ctx.globalAlpha = settlement.status === "ruined" ? 0.25 : 0.7;
      ctx.setLineDash(settlement.posture === "calm" ? [8, 10] : [14, 6]);
      ctx.beginPath();
      ctx.arc(settlement.x, settlement.y, settlement.radius * 0.95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      if (farEnough(zoom, 0.16)) drawBuildings(ctx, settlement, zoom, now);
      if (farEnough(zoom, 0.3)) drawMine(ctx, settlement, zoom);
      if (farEnough(zoom, 0.42)) drawPeople(ctx, settlement, zoom);
      drawLabel(ctx, settlement, zoom, ownerPlayer);
    }
    if (farEnough(zoom, 0.3)) drawRefugees(ctx, bounds, zoom);
  };

  function drawBuildings(ctx, settlement, zoom, now) {
    for (const building of settlement.buildings) {
      const spec = BUILDING_TYPES[building.type];
      const size = building.size || spec?.size || 12;
      const [fill, edge] = BUILDING_COLORS[building.type] || ["#999", "#555"];
      const alive = building.hp > 0;
      const complete = building.operational !== false && building.progress >= 1;
      ctx.save();
      ctx.translate(building.x, building.y);
      if (!alive) {
        ctx.fillStyle = "rgba(30,24,20,0.7)";
        ctx.beginPath(); ctx.ellipse(0, 0, size * 0.62, size * 0.46, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(90,78,66,0.8)";
        for (let n = 0; n < 4; n += 1) ctx.fillRect(Math.cos(n * 1.9) * size * 0.3 - 1.5, Math.sin(n * 2.3) * size * 0.25 - 1, 3, 2);
        ctx.restore();
        continue;
      }
      ctx.globalAlpha = complete ? 1 : 0.55;
      const damaged = clamp(1 - building.hp / building.maxHp, 0, 1);
      if (building.type === "barricade" || building.type === "palisade") {
        ctx.rotate(building.angle || 0);
        ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 1;
        ctx.fillRect(-size * 0.7, -size * 0.14, size * 1.4, size * 0.28);
        ctx.strokeRect(-size * 0.7, -size * 0.14, size * 1.4, size * 0.28);
      } else if (building.type === "watchtower") {
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(2, 3, size * 0.55, size * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(0, 0, size * 0.18, 0, Math.PI * 2); ctx.fill();
      } else {
        const w = size; const h = size * (building.type === "granary" ? 0.8 : 0.72);
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
        ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 1.2;
        ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = edge; ctx.globalAlpha *= 0.55;
        ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(0, -h / 2 - h * 0.22); ctx.lineTo(w / 2, -h / 2); ctx.closePath(); ctx.fill();
      }
      if (damaged > 0.05) {
        ctx.globalAlpha = 0.25 + damaged * 0.5; ctx.fillStyle = "#1a1210";
        ctx.fillRect(-size / 2, -size / 2, size * damaged, size * 0.5);
      }
      ctx.restore();
      if (!complete && building.progress != null) {
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(building.x - size / 2, building.y + size * 0.55, size, 2.5);
        ctx.fillStyle = "#f0a04b"; ctx.fillRect(building.x - size / 2, building.y + size * 0.55, size * clamp(building.progress, 0, 1), 2.5);
      }
      // Burning buildings show flame.
      const ground = rt.layers.surfaceInfo(building.x, building.y);
      if (ground.fire > 0.15) drawFlame(ctx, building.x, building.y, size, now);
    }
    for (const project of settlement.projects) {
      if (project.done || project.kind !== "trench") continue;
      ctx.save();
      ctx.strokeStyle = "rgba(240,160,75,0.8)"; ctx.setLineDash([5, 4]); ctx.lineWidth = Math.max(1, 1.4 / zoom);
      ctx.beginPath(); ctx.arc(project.x, project.y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  function drawFlame(ctx, x, y, size, now) {
    const flicker = 0.75 + 0.25 * Math.sin(now * 14 + x);
    ctx.save();
    const gradient = ctx.createRadialGradient(x, y - size * 0.1, 0, x, y - size * 0.1, size * 0.9);
    gradient.addColorStop(0, `rgba(255,220,120,${0.85 * flicker})`);
    gradient.addColorStop(0.5, `rgba(255,110,30,${0.55 * flicker})`);
    gradient.addColorStop(1, "rgba(255,60,10,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.arc(x, y - size * 0.1, size * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawMine(ctx, settlement, zoom) {
    const mine = settlement.mine;
    if (!mine) return;
    ctx.save();
    ctx.translate(mine.x, mine.y);
    ctx.fillStyle = mine.flooded ? "rgba(60,110,160,0.75)" : "rgba(26,20,16,0.7)";
    ctx.strokeStyle = mine.collapsedUntil > rt.living.time ? "#ff7a5a" : "#6d5d4b";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 9 + Math.min(10, (mine.depth || 0) * 0.8), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawPeople(ctx, settlement, zoom) {
    const radius = clamp(1.5 / Math.sqrt(zoom) * 0.9, 1.5, 4);
    for (const agentId of settlement.agentIds) {
      const agent = rt.living.agents.get(agentId);
      if (!agent || !agent.alive) continue;
      ctx.fillStyle = ROLE_COLORS[agent.role] || "#ddd";
      if (agent.role === "captive") ctx.fillRect(agent.x - radius, agent.y - radius, radius * 2, radius * 2);
      else { ctx.beginPath(); ctx.arc(agent.x, agent.y, radius, 0, Math.PI * 2); ctx.fill(); }
      if (agent.activity === "flee") { ctx.strokeStyle = "#ff4a3a"; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(agent.x, agent.y, radius + 1.2, 0, Math.PI * 2); ctx.stroke(); }
      else if (agent.carrying && (agent.carrying.food > 0 || agent.carrying.materials > 0)) { ctx.fillStyle = "#fff6c4"; ctx.fillRect(agent.x - 0.7, agent.y - radius - 2, 1.4, 1.4); }
    }
  }

  function drawRefugees(ctx, bounds, zoom) {
    const radius = clamp(1.6 / Math.sqrt(zoom), 1.6, 4);
    for (const agent of rt.living.refugees) {
      if (!agent.alive) continue;
      if (agent.x < bounds.left || agent.x > bounds.right || agent.y < bounds.top || agent.y > bounds.bottom) continue;
      ctx.fillStyle = agent.state === "camp" ? "#d9b84a" : ROLE_COLORS.refugee;
      ctx.beginPath(); ctx.arc(agent.x, agent.y, radius, 0, Math.PI * 2); ctx.fill();
      if (agent.state === "camp") {
        ctx.strokeStyle = "rgba(60,40,10,0.8)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(agent.x - 3, agent.y + 2); ctx.lineTo(agent.x, agent.y - 3.5); ctx.lineTo(agent.x + 3, agent.y + 2); ctx.closePath(); ctx.stroke();
      }
    }
  }

  function drawLabel(ctx, settlement, zoom, color) {
    if (zoom < 0.12) {
      ctx.save();
      ctx.fillStyle = color; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 3 / zoom;
      ctx.beginPath(); ctx.arc(settlement.x, settlement.y, 7 / zoom, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
      ctx.restore();
      return;
    }
    const size = clamp(13 / zoom, 10, 54);
    const population = settlement.agentIds.length;
    const status = settlement.status === "thriving" ? "" : ` · ${settlement.status}`;
    const text = `${settlement.name} · ${population}${status}`;
    ctx.save();
    ctx.font = `600 ${size}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    const y = settlement.y - settlement.radius * 0.95 - 4 / zoom;
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = "rgba(10,12,14,0.85)"; ctx.strokeText(text, settlement.x, y);
    ctx.fillStyle = settlement.owner ? color : "#f1e9cf";
    ctx.fillText(text, settlement.x, y);
    if (settlement.posture !== "calm" || settlement.rebellion) {
      ctx.font = `700 ${size * 0.8}px system-ui, sans-serif`;
      ctx.fillStyle = settlement.posture === "siege" ? "#ff6a58" : "#ffb347";
      ctx.strokeText(settlement.rebellion ? "UPRISING" : settlement.posture.toUpperCase(), settlement.x, y - size * 1.05);
      ctx.fillText(settlement.rebellion ? "UPRISING" : settlement.posture.toUpperCase(), settlement.x, y - size * 1.05);
    }
    ctx.restore();
  }

  // ---- persistence ------------------------------------------------------------------------------
  rt.serialize = () => {
    if (!rt.active || !rt.living) return null;
    return {
      version: 1,
      world: { ...rt.world },
      palette: rt.info?.palette || "temperate",
      config: rt.config,
      layers: rt.layers.serialize(),
      field: state().heightField.serialize(),
      living: rt.living.serialize(),
      eco: { time: rt.eco.time, weather: rt.eco.weather, stats: rt.eco.stats },
      bindings: [...rt.bindings.entries()],
      savedAt: Date.now()
    };
  };

  rt.deserialize = (payload, field) => {
    if (!payload?.layers) return false;
    const s = state();
    rt.config = normalizeRegionConfig(payload.config);
    if (payload.field) field.adopt(api.deserializeField(payload.field));
    rt.layers = WorldLayers.deserialize(payload.layers, rt.world);
    s.worldLayers = rt.layers;
    rt.eco = new EcosystemSimulator({ layers: rt.layers, field, random: api.random });
    if (payload.eco) { rt.eco.time = payload.eco.time || 0; Object.assign(rt.eco.weather, payload.eco.weather || {}); Object.assign(rt.eco.stats, payload.eco.stats || {}); }
    rt.living = LivingSettlements.deserialize(payload.living, {
      field, layers: rt.layers, eco: rt.eco, random: api.random, width: rt.world.width, height: rt.world.height, host: buildHost(), limits: { maxSettlements: 24 }
    });
    rt.bindings = new Map();
    rt.vegetation.clear();
    rt.effectCache.clear();
    rt.active = true;
    s.region = rt;
    return true;
  };

  rt.summary = () => {
    const counts = rt.counts();
    const env = rt.environment();
    return { name: `${rt.config?.seed || "Region"} · ${env ? `${env.season}, year ${env.year}` : ""}`, summary: `${counts.settlements} settlements · ${counts.people} people` };
  };

  rt.dispose = () => {
    rt.active = false;
    rt.living = null;
    rt.eco = null;
    rt.layers = null;
    rt.vegetation.clear();
    rt.effectCache.clear();
    rt.bindings.clear();
    const s = state();
    if (s.region === rt) s.region = null;
  };

  return rt;
}

export { SURFACE, VEGETATION, EARTHWORK, DAY };
