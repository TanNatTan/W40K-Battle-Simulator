// The living-settlement simulation: owns every settlement, citizen, refugee
// and camp in a region, steps them against the shared terrain/ecosystem, and
// exposes the hooks a battle simulator needs (threats in, damage in, goods and
// recruits out). It has no DOM or game dependency so it runs headless.

import { crater } from "../world/Deformation.js";
import { VEGETATION, SURFACE, EARTHWORK } from "../world/WorldLayers.js";
import { TerrainPathfinder } from "../world/TerrainPathfinder.js";
import { levelSite } from "../world/Deformation.js";
import { plantCrop } from "../world/Ecosystem.js";
import { personName, placeName } from "./Names.js";
import { stepCitizen, walk } from "./CitizenBrain.js";
import {
  allocateRoles, assessThreat, chooseMine, considerTribute, freeSite, manageStores, planConstruction, planFields, updatePosture, learnFromAttack, foodStatus, compass
} from "./SettlementPlanner.js";
import {
  DEFAULT_POLICY, captureSettlement, collectTribute, refugeeArrivedAt, resolveCaptives, rollResistance, stepCamps, stepRefugee, updateRebellion
} from "./Aftermath.js";
import {
  ADULT_AGE, BUILDING_TYPES, DAY, FOOD_PER_DAY, bedCapacity, clamp, createSettlement, distance, isAdult, operationalBuildings
} from "./Settlement.js";

const SUBSTEP = 0.1;
const THINK = 2;
const clone = value => JSON.parse(JSON.stringify(value));

export class LivingSettlements {
  constructor({ field, layers, eco, random = Math.random, host = {}, width, height, limits = {} } = {}) {
    this.field = field;
    this.layers = layers;
    this.eco = eco;
    this.random = random;
    this.host = host;
    this.width = width || field.width;
    this.height = height || field.height;
    this.limits = { maxSettlements: 12, ...limits };
    this.pathfinder = new TerrainPathfinder({ field, layers, width: this.width, height: this.height, weather: () => this.eco?.weather || {} });
    this.settlements = new Map();
    this.agents = new Map();
    this.refugees = [];
    this.chronicle = [];
    this.time = 0;
    this.counter = 0;
    this.acc = 0;
    this.thinkInterval = THINK;
    this.pathBudget = 0;
    this.raidTimers = new Map();
    this.listeners = new Set();
    this._units = [];
    this._focus = null;
    this._logGate = new Map();
    this.terrainRev = 0;
    this.deathStats = {};
  }

  // ---- plumbing ------------------------------------------------------------
  on(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(event) { for (const listener of this.listeners) listener(event); }
  nextId(prefix) { this.counter += 1; return `${prefix}${this.counter}`; }
  rand(min, max) { return min + this.random() * (max - min); }
  nameOf(faction) { return faction ? (this.host.nameOf?.(faction) || String(faction)) : "no one"; }
  policyOf(faction) { return { ...DEFAULT_POLICY, ...(faction ? this.host.policyOf?.(faction) : null) }; }
  agentsOf(s) { const out = []; for (const id of s.agentIds) { const a = this.agents.get(id); if (a && a.alive) out.push(a); } return out; }
  settlementById(id) { return this.settlements.get(id) || null; }

  log(s, text, level = "info", kind = "event") {
    const gateKey = `${s?.id}:${kind}:${text.slice(0, 24)}`;
    if (kind === "refugee" || kind === "death") { const gate = this._logGate.get(gateKey) || -99; if (this.time - gate < 12) return; this._logGate.set(gateKey, this.time); }
    const entry = { t: Math.round(this.time), settlementId: s?.id || null, text, level, kind };
    this.chronicle.push(entry);
    if (this.chronicle.length > 500) this.chronicle.shift();
    this.host.incident?.(text, s?.nodeId || s?.id || null, level === "alert" ? "alert" : level === "warning" ? "warning" : "info");
    this.emit({ type: "log", entry });
  }

  noteTerrainChange(x, y, radius) { this.pathfinder.invalidateAround(x, y, radius); this.terrainRev += 1; }

  cellHasBuilding(x, y, pad) {
    for (const s of this.settlements.values()) {
      if (Math.abs(s.x - x) > s.radius + 60 || Math.abs(s.y - y) > s.radius + 60) continue;
      for (const b of s.buildings) if (b.hp > 0 && Math.abs(b.x - x) < b.size + pad && Math.abs(b.y - y) < b.size + pad) return true;
    }
    return false;
  }

  capacityOf(s) { return bedCapacity(s) + 14; }

  // ---- creation -------------------------------------------------------------
  spawnCitizen(s, { age = null, role = null, x = null, y = null, home = null } = {}) {
    const a = age ?? Math.round(this.rand(5, 58));
    const adult = a >= ADULT_AGE;
    const spot = home || this.pickHome(s);
    const citizen = {
      id: this.nextId("c"), name: personName(this.random), settlementId: s.id, civilian: true,
      role: role || (a < ADULT_AGE ? "child" : a > 62 ? "elder" : "farmer"),
      age: a, hp: adult ? 100 : 60, maxHp: adult ? 100 : 60, alive: true,
      x: x ?? spot.x + this.rand(-12, 12), y: y ?? spot.y + this.rand(-12, 12), home: { x: spot.x, y: spot.y },
      speed: this.rand(13, 17) * (a < ADULT_AGE ? 0.75 : a > 62 ? 0.7 : 1),
      skills: { farming: this.rand(0.3, 0.75), mining: this.rand(0.2, 0.6), building: this.rand(0.25, 0.65), fighting: this.rand(0.15, 0.45) },
      traits: { courage: this.rand(0.2, 0.9), charisma: this.rand(0.15, 0.9), diligence: this.rand(0.3, 0.9) },
      needs: { hunger: this.rand(0.05, 0.35), fatigue: this.rand(0, 0.3), fear: 0 },
      loyalty: { settlement: this.rand(0.4, 0.85) },
      carrying: { food: 0, materials: 0 }, task: null, activity: "idle", roleSince: -1000, facing: this.random() * 6.28,
      history: []
    };
    this.agents.set(citizen.id, citizen);
    s.agentIds.push(citizen.id);
    return citizen;
  }

  pickHome(s) {
    const houses = s.buildings.filter(b => b.type === "house" && b.hp > 0);
    if (houses.length) return houses[Math.floor(this.random() * houses.length)];
    return { x: s.x, y: s.y };
  }

  addCompletedBuilding(s, type, spot) {
    const spec = BUILDING_TYPES[type];
    const site = spot || freeSite(this, s, spec.size);
    if (!site) return null;
    levelSite(this.field, this.layers, site.x, site.y, spec.size * 0.7);
    const b = { id: this.nextId("b"), type, x: site.x, y: site.y, hp: spec.hp, maxHp: spec.hp, progress: 1, operational: true, size: spec.size, built: this.time };
    s.buildings.push(b);
    return b;
  }

  /** Create a settlement and populate it. */
  addSettlement({ name = null, x, y, population = 35, owner = null, culture = "frontier", radius = 120, nodeId = null, foodDays = 14, farmland = 1, mine = true, militiaShare = null, buildings = true, empty = false } = {}) {
    if (this.settlements.size >= this.limits.maxSettlements) return null;
    const id = this.nextId("s");
    const s = createSettlement({ id, name: name || placeName(this.random, [...this.settlements.values()].map(item => item.name)), x, y, owner, culture, radius, nodeId });
    s.founded = this.time;
    if (militiaShare != null) s.doctrine.militiaShare = militiaShare;
    s._claims = new Map(); s._threats = []; s._militiaAlive = 0; s._agents = [];
    this.settlements.set(id, s);
    // Clear the ground around the centre and mark territory.
    const L = this.layers;
    L.forEachInCircle(x, y, 34, (i, j) => { L.set("vegetation", i, j, 0); L.set("vegKind", i, j, VEGETATION.NONE); L.set("trample", i, j, 120); });
    levelSite(this.field, L, x, y, 26);
    if (buildings) {
      this.addCompletedBuilding(s, "hall", { x, y });
      const houses = Math.max(2, Math.ceil(population / 6));
      for (let n = 0; n < houses; n += 1) this.addCompletedBuilding(s, "house");
      this.addCompletedBuilding(s, "granary");
      if (population >= 30) this.addCompletedBuilding(s, "watchtower", freeSite(this, s, 11, { ring: radius * 0.7 }));
    }
    if (mine) s.mine = chooseMine(this, s);
    if (!empty) {
      const adultsN = Math.round(population * 0.74);
      for (let n = 0; n < population; n += 1) {
        const age = n < adultsN ? Math.round(this.rand(17, 60)) : n < adultsN + Math.round(population * 0.18) ? Math.round(this.rand(4, 15)) : Math.round(this.rand(63, 80));
        this.spawnCitizen(s, { age });
      }
      s._startPopulation = population;
      s.storage.food = population * FOOD_PER_DAY * foodDays;
      s.storage.seed = 12; s.storage.materials = 36;
      // Fields, half of them already growing.
      s._agents = this.agentsOf(s);
      planFields(this, s, population * farmland);
      for (const [i, j] of s.fields) {
        if (this.random() < 0.55) { plantCrop(this.layers, i, j); this.layers.set("cropStage", i, j, this.rand(60, 220)); }
        else { this.layers.set("earthwork", i, j, EARTHWORK.FIELD); }
      }
    }
    this.pathfinder.invalidateAround(x, y, radius * 2);
    this.log(s, `${s.name} is settled by ${population} people.`, "info", "founded");
    this.host.onSettlementAdded?.(s);
    this.emit({ type: "added", settlement: s });
    return s;
  }

  removeSettlement(id) {
    const s = this.settlements.get(id);
    if (!s) return false;
    for (const agentId of s.agentIds) this.agents.delete(agentId);
    this.settlements.delete(id);
    this.emit({ type: "removed", id });
    return true;
  }

  foundSettlement(cluster) {
    const members = cluster.members.filter(m => m.alive);
    const origin = this.settlements.get(members[0]?.originId);
    const s = this.addSettlement({ x: cluster.x, y: cluster.y, population: 0, empty: true, culture: "free", radius: 100, nodeId: null, mine: true, buildings: false });
    if (!s) return null;
    this.addCompletedBuilding(s, "hall", { x: cluster.x, y: cluster.y });
    this.addCompletedBuilding(s, "house");
    s.doctrine.militiaShare = 0.13; s.doctrine.stashShare = 0.2; s.doctrine.reserveDays = 18; s.doctrine.scoutRadius = 300;
    s.memory.lessons.push({ time: Math.round(this.time), text: `Founded by refugees from ${origin?.name || "a lost settlement"}.` });
    for (const m of members) { this.joinSettlement(s, m); }
    s.storage.materials = 14; s.storage.seed = 6;
    s._startPopulation = s.agentIds.length;
    this.log(s, `${members.length} refugees found a new settlement, ${s.name}, free of any ruler.`, "alert", "founded");
    this.host.onFounded?.(s, origin);
    return s;
  }

  // ---- refugees ------------------------------------------------------------------
  becomeRefugee(s, a, reason = "") {
    if (!a.alive || a.role === "refugee") return;
    s.agentIds = s.agentIds.filter(id => id !== a.id);
    a.role = "refugee"; a.settlementId = null; a.originId = s.id; a.originName = s.name; a.fledFrom = s.memory.lastAttack?.by || s.occupation?.by || null;
    a.state = "moving"; a.destination = null; a.task = null; a.activity = "flee"; a.returnOk = s.posture === "evacuate" || /fled the fighting/.test(reason);
    const pack = Math.min(s.storage.food, 3);
    s.storage.food -= pack; a.carrying.food += pack;
    a.fledAt = this.time; a.history.push(reason || "became a refugee");
    this.refugees.push(a);
    s.stats.refugees = (s.stats.refugees || 0) + 1;
    this.log(s, `Survivors flee ${s.name}${reason ? ` (${reason})` : ""}.`, "warning", "refugee");
    this.host.onRefugee?.(a, s);
  }

  pickRefugeeDestination(a) {
    let best = null; let bestScore = -Infinity;
    for (const s of this.settlements.values()) {
      if (s.status === "ruined" || s.id === a.originId && !a.returnOk) continue;
      if (s.id === a.originId && (s.posture !== "calm" || this.time - (a.fledAt ?? 0) < DAY * 1.2)) continue;
      if (a.refusedBy?.includes(s.id)) continue;
      const hostileRuler = s.owner && a.fledFrom && (s.owner === a.fledFrom || this.host.hostile?.(a.fledFrom, s.owner) === false && s.owner === a.fledFrom);
      if (hostileRuler) continue;
      const d = Math.hypot(s.x - a.x, s.y - a.y);
      const score = -d * 0.01 + Math.min(4, foodStatus(this, s, s.agentIds.length).days * 0.1) + (s.status === "independent" ? 0.5 : 0) - (s.posture === "siege" ? 3 : 0);
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return best ? { id: best.id, x: best.x, y: best.y } : null;
  }

  walkRefugee(a, dt) {
    if (walk(this, a, dt, 0.9)) {
      const dest = this.settlements.get(a.destination?.id);
      refugeeArrivedAt(this, a, dest);
    }
  }

  joinSettlement(dest, a) {
    this.refugees = this.refugees.filter(r => r.id !== a.id);
    a.settlementId = dest.id; a.state = null; a.destination = null; a.task = null; a.camp = null;
    a.role = a.age < ADULT_AGE ? "child" : a.age > 62 ? "elder" : "farmer"; a.roleSince = this.time;
    a.home = this.pickHome(dest); a.loyalty = { settlement: 0.7 }; a.needs.fear = Math.max(0, a.needs.fear - 0.3);
    dest.agentIds.push(a.id);
    dest.storage.food += a.carrying.food; a.carrying.food = 0;
    // Refugees carry the news with them.
    if (a.fledFrom && !dest.memory.lessons.some(l => l.from === a.originId)) {
      dest.memory.lessons.push({ time: Math.round(this.time), from: a.originId, text: `Refugees from ${a.originName} warn of ${this.nameOf(a.fledFrom)}.` });
      dest.doctrine.scoutRadius = clamp(dest.doctrine.scoutRadius + 15, 220, 520);
      dest.doctrine.militiaShare = clamp(dest.doctrine.militiaShare + 0.01, 0.04, 0.34);
    }
    return true;
  }

  removeAgent(a) {
    a.alive = false;
    const s = this.settlements.get(a.settlementId);
    if (s) s.agentIds = s.agentIds.filter(id => id !== a.id);
    this.refugees = this.refugees.filter(r => r.id !== a.id);
    this.agents.delete(a.id);
  }

  killAgent(a, cause = "killed") {
    if (!a.alive) return;
    const s = this.settlements.get(a.settlementId) || this.settlements.get(a.originId);
    a.alive = false; a.cause = cause;
    const category = /starv/.test(cause) ? "starved" : /executed/.test(cause) ? "executed" : /old age/.test(cause) ? "old age" : /collapse/.test(cause) ? "mine collapse" : /killed|crossfire|blast/.test(cause) ? "violence" : "other";
    this.deathStats[category] = (this.deathStats[category] || 0) + 1;
    if (s) {
      s.stats.died += 1;
      s.memory.lost += 1;
      if (/killed|shot|crossfire|blast|burn/.test(cause)) s.stats.killedByEnemy += 1;
      s.agentIds = s.agentIds.filter(id => id !== a.id);
      // Neighbours are shaken by what they see.
      for (const other of this.agentsOf(s)) if (Math.hypot(other.x - a.x, other.y - a.y) < 45) other.needs.fear = Math.min(1, other.needs.fear + 0.45);
      if (s.leaderId === a.id) { s.leaderId = null; this.log(s, `${a.name}, who led ${s.name}, is dead.`, "warning", "death"); }
      this.log(s, `${a.name} ${cause} at ${s.name}.`, "info", "death");
    }
    this.refugees = this.refugees.filter(r => r.id !== a.id);
    this.agents.delete(a.id);
    this.emit({ type: "death", agent: a, cause });
  }

  hit(s, agent, threat, damage) {
    this.host.attack?.(threat.id, damage, agent.id, s);
  }

  // ---- projects & structures ----------------------------------------------------------
  completeProject(s, project) {
    project.done = true;
    s.stats.built += 1;
    if (project.kind === "building") {
      const b = s.buildings.find(item => item.id === project.buildingId);
      if (b) { b.operational = true; b.progress = 1; }
      this.log(s, `${s.name} finishes a ${BUILDING_TYPES[project.type]?.label.toLowerCase() || project.type}.`, "info", "construction");
    } else if (project.kind === "trench") {
      this.log(s, `${s.name} completes a trench line facing the ${compass(project.bearing)}.`, "info", "construction");
    }
    for (const id of project.workers) { const w = this.agents.get(id); if (w) w.task = null; }
    this.noteTerrainChange(project.x, project.y, 60);
  }

  destroyBuilding(s, b, by = "enemy fire") {
    s.buildings = s.buildings.filter(item => item !== b);
    s.projects = s.projects.filter(p => p.buildingId !== b.id);
    const L = this.layers;
    L.forEachInCircle(b.x, b.y, b.size * 0.8, (i, j) => { L.set("integrity", i, j, Math.min(L.get("integrity", i, j), 70)); L.set("vegetation", i, j, 0); L.set("vegKind", i, j, VEGETATION.NONE); L.set("scorch", i, j, Math.max(L.get("scorch", i, j), 90)); });
    s.memory.burned += 1;
    if (b.type === "granary") {
      const lost = Math.max(0, s.storage.food - 120);
      s.storage.food -= lost;
      this.log(s, `The granary of ${s.name} is destroyed; ${Math.round(lost)} food lost.`, "alert", "destroyed");
    } else this.log(s, `A ${BUILDING_TYPES[b.type]?.label.toLowerCase() || b.type} at ${s.name} is destroyed by ${by}.`, "warning", "destroyed");
    this.noteTerrainChange(b.x, b.y, b.size * 2);
    this.emit({ type: "destroyed", settlement: s, building: b });
  }

  damageBuilding(s, b, amount, by) {
    if (!b || b.hp <= 0) return false;
    b.hp -= amount;
    if (b.hp <= 0) { this.destroyBuilding(s, b, by); return true; }
    return false;
  }

  /** Explosion / fire attack on the world: hurts people and structures, scars the ground. */
  damageArea(x, y, radius, damage, { faction = null, incendiary = false, crater: makeCrater = damage >= 28 } = {}) {
    const result = { killed: 0, wounded: 0, structures: 0 };
    for (const s of this.settlements.values()) {
      if (Math.hypot(s.x - x, s.y - y) > s.radius + radius + 40) continue;
      for (const a of this.agentsOf(s)) {
        const d = Math.hypot(a.x - x, a.y - y);
        if (d > radius) continue;
        const falloff = 1 - d / radius * 0.8;
        const info = this.layers.surfaceInfo(a.x, a.y);
        const shelter = info.earthwork === EARTHWORK.TRENCH ? 0.45 : 1;
        const dealt = damage * falloff * shelter * this.rand(0.7, 1.2);
        a.hp -= dealt; a.needs.fear = 1; a.activity = a.activity === "idle" ? "idle" : a.activity;
        if (a.hp <= 0) { this.killAgent(a, faction ? `killed in the crossfire of ${this.nameOf(faction)}` : "killed in a blast"); result.killed += 1; } else result.wounded += 1;
      }
      for (const b of [...s.buildings]) {
        const d = Math.hypot(b.x - x, b.y - y);
        if (d > radius + b.size) continue;
        result.structures += 1;
        this.damageBuilding(s, b, damage * (1 - d / (radius + b.size) * 0.7) * 1.5, "shelling");
      }
      s.alert = Math.max(s.alert, 0.7);
      if (faction) this.noteAggressor(s, faction, 1);
    }
    if (makeCrater) { crater(this.field, this.layers, x, y, clamp(radius * 0.45, 6, 26), clamp(damage / 18, 0.8, 3.6)); this.noteTerrainChange(x, y, radius * 2); }
    if (incendiary || damage >= 40) this.eco?.ignite(x, y, incendiary ? 1.8 : 1.2);
    return result;
  }

  noteAggressor(s, faction, weight) { s.relations[faction] = { ...(s.relations[faction] || {}), hostility: (s.relations[faction]?.hostility || 0) + weight }; }

  // ---- relations to the rest of the world -----------------------------------------------
  hostileTo(s, faction) {
    if (!faction) return false;
    if (s.rebellion && faction === s.occupation?.by) return true;
    if (s.owner && faction === s.owner) return false;
    if ((s.pacts[faction] || 0) > this.time) return false;
    if (s.owner) { const r = this.host.hostile?.(s.owner, faction); return r === undefined ? true : !!r; }
    const r = this.host.hostileToIndependent?.(faction, s);
    return r === undefined ? true : !!r;
  }

  presence(s, faction) {
    if (!faction) return 0;
    let count = 0;
    for (const u of this._units) if (u.faction === faction && Math.hypot(u.x - s.x, u.y - s.y) <= s.radius * 0.8) count += 1;
    return count;
  }

  routeOpen(s, faction) { return this.routeIntegrityFor(s, faction) > 0.35; }

  routeIntegrityFor(s, faction) {
    const base = this.host.baseOf?.(faction);
    if (!base) return 1;
    const length = Math.hypot(base.x - s.x, base.y - s.y);
    const steps = Math.max(2, Math.ceil(length / 48));
    let bad = 0;
    for (let k = 1; k < steps; k += 1) {
      const px = s.x + (base.x - s.x) * k / steps; const py = s.y + (base.y - s.y) * k / steps;
      const info = this.layers.surfaceInfo(px, py);
      if (info.integrity < 0.35 || info.earthwork === EARTHWORK.PIT || info.waterSurface > -1e8) bad += 1;
      if (this.pathfinder.blockedAt(px, py, "civilian")) bad += 0.5;
    }
    return clamp(1 - 0.9 * bad / Math.max(1, steps - 1), 0.05, 1);
  }

  // ---- main step ------------------------------------------------------------------------------
  /** @param ctx { units: [{id,x,y,faction,strength,range,damage,brutality}], focus: {x,y,radius} } */
  step(dt, ctx = {}) {
    this.acc += Math.min(dt, 4);
    this._units = ctx.units || [];
    this._focus = ctx.focus || null;
    let guard = 0;
    while (this.acc >= SUBSTEP && guard < 40) {
      this.acc -= SUBSTEP; guard += 1;
      this.substep(SUBSTEP);
    }
  }

  substep(dt) {
    this.time += dt;
    this.pathBudget = 3;
    for (const s of this.settlements.values()) {
      s.lod = this._focus && Math.hypot(s.x - this._focus.x, s.y - this._focus.y) > (this._focus.radius || 600) + s.radius ? "abstract" : "full";
      s._agents = this.agentsOf(s);
      s._militiaAlive = 0;
      for (const a of s._agents) if (a.role === "militia") s._militiaAlive += 1;
      // Threat list is cheap to refresh on a short cadence.
      if (this.time >= (s._threatAt || 0)) { this.computeThreats(s); s._threatAt = this.time + 0.4; }
      if (s.lod === "full") {
        for (const a of s._agents) stepCitizen(this, s, a, dt, this.time);
        this.resolveRaids(s, dt);
      }
      if (this.time >= s.nextThinkAt) { s.nextThinkAt = this.time + THINK + this.random() * 0.4; this.think(s, THINK); }
    }
    for (const a of [...this.refugees]) stepRefugee(this, a, dt, this.time);
    if (this.time >= (this._campAt || 0)) { this._campAt = this.time + 6; stepCamps(this, this.time); }
  }

  computeThreats(s) {
    const reach = s.doctrine.scoutRadius + s.radius;
    const list = [];
    for (const u of this._units) {
      if (u.alive === false) continue;
      const d = Math.hypot(u.x - s.x, u.y - s.y);
      if (d > reach) continue;
      if (!this.hostileTo(s, u.faction)) continue;
      list.push(u);
    }
    list.sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y));
    s._threats = list;
  }

  // Attackers kill militia first, then (depending on how they behave) civilians and buildings.
  resolveRaids(s, dt) {
    if (!s._threats.length) return;
    const agents = s._agents;
    for (const u of s._threats) {
      const reach = u.range ?? 90;
      if (Math.hypot(u.x - s.x, u.y - s.y) > s.radius + reach) continue;
      const key = `${s.id}:${u.id}`;
      if (this.time < (this.raidTimers.get(key) || 0)) continue;
      this.raidTimers.set(key, this.time + (1.5 + this.random() * 0.7) / (u.rate || 1));
      const dmg = (u.damage ?? 12) * this.rand(0.7, 1.25);
      const policy = this.policyOf(u.faction);
      const brutality = u.brutality ?? policy.brutality;
      const liberator = s.memory.formerOwner && s.memory.formerOwner === u.faction && s.owner !== u.faction;
      // Armed defenders first. Whether anyone else is shot is one decision per attack, set by the attacker's temperament.
      let target = null; let best = reach;
      for (const a of agents) {
        if (!a.alive || a.role !== "militia") continue;
        const d = Math.hypot(a.x - u.x, a.y - u.y);
        if (d < best) { best = d; target = a; }
      }
      if (!target && !liberator && this.random() < clamp(0.03 + brutality * 0.5, 0, 0.6)) {
        best = reach;
        for (const a of agents) {
          if (!a.alive || a.role === "captive") continue;
          const d = Math.hypot(a.x - u.x, a.y - u.y);
          if (d < best) { best = d; target = a; }
        }
      }
      if (target) {
        const info = this.layers.surfaceInfo(target.x, target.y);
        const cover = info.earthwork === EARTHWORK.TRENCH ? 0.5 : 0;
        const running = target.activity === "flee" ? 0.18 : 0;
        const hit = clamp(0.5 - cover * 0.5 - running - (target.role === "militia" ? 0.06 : 0), 0.1, 0.9);
        if (this.random() < hit) {
          target.hp -= dmg; target.needs.fear = 1;
          this.noteAggressor(s, u.faction, 0.2);
          if (target.hp <= 0) this.killAgent(target, `killed by ${this.nameOf(u.faction)}`);
        }
        continue;
      }
      // No living target in reach: break something.
      if (liberator) continue;
      let building = null; let bd = reach + 10;
      for (const b of s.buildings) { if (b.hp <= 0) continue; const d = Math.hypot(b.x - u.x, b.y - u.y) - b.size * 0.5; if (d < bd) { bd = d; building = b; } }
      if (building && this.random() < 0.35 + brutality * 0.5) {
        this.damageBuilding(s, building, dmg * 1.8, this.nameOf(u.faction));
        if ((u.incendiary || policy.branch === "orks") && this.random() < 0.1) this.eco?.ignite(building.x, building.y, 1.8);
      }
    }
  }

  // ---- settlement thinking ------------------------------------------------------------------------
  think(s, dt) {
    const now = this.time;
    const agents = s._agents = this.agentsOf(s);
    const pop = agents.length;
    s.projects = s.projects.filter(p => !p.done || now - (p.doneAt ??= now) < 4);
    // An emptied settlement is abandoned, not erased: its stores and buildings can still be seized or reclaimed.
    if (pop === 0) {
      if (s.status !== "abandoned") {
        s.status = "abandoned";
        this.log(s, `${s.name} lies empty.`, "alert", "ruined");
        this.host.onRuined?.(s);
      }
      this.computeThreats(s);
      this.updateSiege(s, assessThreat(this, s), dt);
      return;
    }
    if (s.status === "abandoned") { s.status = "struggling"; this.log(s, `People return to ${s.name}.`, "info", "returned"); }
    const threat = assessThreat(this, s);
    s._peakThreat = Math.max(s._peakThreat || 0, threat.strength);
    if (threat.count) {
      if (threat.bearing != null) s.memory.lastBearing = threat.bearing;
      if (!s.memory.lastAttack || now - s.memory.lastAttack.time > DAY * 0.6) {
        if (threat.nearest <= s.radius * 1.2) {
          // First blood of a new attack: the settlement takes note.
          s.memory.lastAttack = { ...(s.memory.lastAttack || {}), time: now, bearing: threat.bearing, strength: threat.strength, by: s._threats[0]?.faction, outcome: "ongoing" };
          s._attackStart = { pop, militia: s._militiaAlive, lost: s.memory.lost };
        }
      }
    }
    updatePosture(this, s, threat, now);
    // The attack ends when the enemy is gone: draw the lessons.
    if (!threat.count && s._attackStart && now - (s.memory.lastAttack?.time || 0) > 8 && s.posture !== "siege") {
      const lost = s.memory.lost - s._attackStart.lost;
      const info = { by: s.memory.lastAttack?.by, bearing: s.memory.lastAttack?.bearing ?? 0, strength: s._peakThreat, casualties: lost, population: s._attackStart.pop, outcome: s.owner && s.occupation?.by ? "occupied" : lost > 4 ? "defeated" : "repelled", looted: false };
      learnFromAttack(this, s, info);
      s._attackStart = null; s._peakThreat = 0;
    }
    const wasPlanned = s.status;
    this.updateSiege(s, threat, dt);
    allocateRoles(this, s, agents, threat, now);
    if (s.lod === "abstract") this.abstractProduce(s, agents, dt);
    if (!(s._fieldTick = ((s._fieldTick || 0) + 1) % 5)) planFields(this, s, pop);
    planConstruction(this, s, agents, threat, now);
    manageStores(this, s, pop);
    considerTribute(this, s, threat, now);
    this.mineHazards(s, dt);
    this.fireOnBuildings(s, dt);
    this.population(s, agents, dt);
    resolveCaptives(this, s, now);
    collectTribute(this, s, agents, now);
    rollResistance(this, s, agents, now);
    updateRebellion(this, s, agents, now, dt);
    if (this.time >= (s._routeAt || 0)) {
      s._routeAt = now + 15;
      if (s.owner) s.routeIntegrity = this.routeIntegrityFor(s, s.owner);
    }
    if (!s.leaderId) { const leader = agents.filter(isAdult).sort((a, b) => b.traits.charisma - a.traits.charisma)[0]; if (leader) s.leaderId = leader.id; }
    s.status = this.statusOf(s, agents);
    void wasPlanned;
  }

  statusOf(s, agents) {
    if (s.rebellion) return "uprising";
    if (s.occupation?.by) return "occupied";
    if (s.posture === "siege") return "besieged";
    if (!s.owner && s.independentSince != null) return "independent";
    const food = foodStatus(this, s, agents.length);
    return food.days < 4 ? "struggling" : "thriving";
  }

  /** If armed enemies hold the settlement and nobody defends it, it falls. */
  updateSiege(s, threat, dt) {
    const attackers = new Map();
    for (const u of s._threats) {
      if (Math.hypot(u.x - s.x, u.y - s.y) > s.radius * 0.6) continue;
      if (s.rebellion && u.faction === s.occupation?.by) continue; // garrison, not conquerors
      attackers.set(u.faction, (attackers.get(u.faction) || 0) + 1);
    }
    let candidate = null; let count = 0;
    for (const [faction, n] of attackers) if (n > count) { count = n; candidate = faction; }
    let defenders = s._agents.filter(a => a.role === "militia" && Math.hypot(a.x - s.x, a.y - s.y) <= s.radius * 0.8 && a.activity !== "flee").length;
    if (s.owner) defenders += this.presence(s, s.owner);
    if (!candidate || count < 2 || defenders > 0) { s.siege = s.siege ? { ...s.siege, hold: Math.max(0, s.siege.hold - dt * 2) } : null; return; }
    if (!s.siege || s.siege.faction !== candidate) s.siege = { faction: candidate, hold: 0 };
    s.siege.hold += dt;
    if (s.siege.hold >= 8) {
      s.siege = null;
      captureSettlement(this, s, candidate);
    }
  }

  population(s, agents, dt) {
    const food = foodStatus(this, s, agents.length);
    // Births in peaceful, fed, housed settlements.
    if (s.posture === "calm" && food.days > 6 && agents.length < bedCapacity(s) + 4 && s.status !== "occupied") {
      const adults = agents.filter(a => isAdult(a) && a.age < 45).length;
      if (this.random() < adults * 0.005 * (dt / DAY) * 6) {
        this.spawnCitizen(s, { age: 0 });
        s.stats.born += 1;
      }
    }
    // Famine memory.
    if (food.days < 1.5 && !s._famine) { s._famine = true; s.memory.famines += 1; this.log(s, `Famine strikes ${s.name}.`, "alert", "famine"); }
    if (food.days > 4) s._famine = false;
    // Elders and the very hurt may die of age/illness over time.
    for (const a of agents) if (a.age > 66 && this.random() < 0.00015 * dt) this.killAgent(a, "died of old age");
  }

  abstractProduce(s, agents, dt) {
    const farmers = agents.filter(a => a.role === "farmer").length;
    const miners = agents.filter(a => a.role === "miner").length;
    const growth = this.eco.season.growth;
    s.storage.food += farmers * 0.014 * growth * dt * Math.min(1, s.fields.length / Math.max(1, farmers * 1.2));
    s.storage.food -= agents.length * FOOD_PER_DAY / DAY * dt;
    if (s.storage.food < 0) s.storage.food = 0;
    s.storage.materials += miners * 0.03 * dt;
  }

  mineHazards(s, dt) {
    const m = s.mine;
    if (!m) return;
    const L = this.layers; const F = this.field;
    m.depth = Math.max(0, m.baseline - F.heightAt(m.x, m.y));
    const supports = operationalBuildings(s, "mineworks").length ? 0.4 : 0;
    const rain = this.eco?.weather.rain || 0;
    m.instability = clamp(m.depth / 7 + rain * 0.2 + L.surfaceInfo(m.x, m.y).moisture * 0.15 - supports, 0, 1.3);
    const water = L.getAt("waterSurface", m.x, m.y);
    const ground = F.heightAt(m.x, m.y);
    const wasFlooded = m.flooded;
    m.flooded = water > -1e8 && water - ground > 0.35;
    if (m.flooded && !wasFlooded) this.log(s, `The mine at ${s.name} floods.`, "warning", "mine");
    if (!m.flooded && wasFlooded) this.log(s, `The mine at ${s.name} has drained and can be worked again.`, "info", "mine");
    if ((m.collapsedUntil || 0) <= this.time && m.instability > 0.78 && this.random() < 0.035 * (m.instability - 0.7) * (dt / THINK)) {
      m.collapsedUntil = this.time + DAY * 0.8;
      let dead = 0;
      for (const a of this.agentsOf(s)) if (a.task?.type === "mine" && Math.hypot(a.x - m.x, a.y - m.y) < m.radius && this.random() < 0.55) { this.killAgent(a, "buried in a mine collapse"); dead += 1; }
      this.log(s, `The mine at ${s.name} collapses${dead ? `, killing ${dead}` : ""}.`, "alert", "mine");
    }
    if (this.time >= (m.recountAt || 0)) {
      m.recountAt = this.time + 30;
      let left = 0;
      L.forEachInCircle(m.x, m.y, m.radius + 20, (i, j) => { if (L.get("deposit", i, j)) left += L.get("depositAmount", i, j); });
      m.remaining = left;
    }
  }

  fireOnBuildings(s, dt) {
    const L = this.layers;
    for (const b of [...s.buildings]) {
      const i = Math.round(b.x / 16); const j = Math.round(b.y / 16);
      let fire = 0;
      for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) fire = Math.max(fire, L.get("fire", i + di, j + dj));
      if (fire > 0) {
        const hurt = fire / 255 * 5 * dt;
        if (this.damageBuilding(s, b, hurt, "fire")) continue;
        if (this.random() < 0.04) this.eco?.ignite(b.x + this.rand(-14, 14), b.y + this.rand(-14, 14), 1.6);
      }
    }
  }

  // ---- queries ---------------------------------------------------------------------------------------
  overview() {
    return [...this.settlements.values()].map(s => {
      const agents = this.agentsOf(s);
      const roles = {};
      for (const a of agents) roles[a.role] = (roles[a.role] || 0) + 1;
      const food = foodStatus(this, s, agents.length);
      return {
        id: s.id, name: s.name, x: s.x, y: s.y, owner: s.owner, status: s.status, posture: s.posture, culture: s.culture,
        population: agents.length, roles, foodDays: food.days, food: s.storage.food, hiddenFood: s.hidden.food, materials: s.storage.materials,
        buildings: s.buildings.filter(b => b.hp > 0).length, fields: s.fields.length, doctrine: { ...s.doctrine }, attacks: s.memory.attacks,
        lessons: s.memory.lessons.slice(-3), lost: s.memory.lost, mine: s.mine ? { depth: s.mine.depth, flooded: s.mine.flooded, remaining: s.mine.remaining } : null
      };
    });
  }

  // ---- persistence --------------------------------------------------------------------------------------
  serialize() {
    const strip = (key, value) => (key.startsWith("_") || key === "path" ? undefined : value);
    return JSON.parse(JSON.stringify({
      version: 1, time: this.time, counter: this.counter,
      settlements: [...this.settlements.values()],
      agents: [...this.agents.values()],
      refugees: this.refugees.map(a => a.id),
      chronicle: this.chronicle.slice(-300),
      deathStats: this.deathStats
    }, strip));
  }

  static deserialize(payload, deps) {
    const world = new LivingSettlements(deps);
    if (!payload) return world;
    world.time = payload.time || 0;
    world.counter = payload.counter || 0;
    for (const s of payload.settlements || []) {
      s._claims = new Map(); s._threats = []; s._militiaAlive = 0; s._agents = [];
      world.settlements.set(s.id, s);
    }
    for (const a of payload.agents || []) { a.task = null; world.agents.set(a.id, a); }
    world.refugees = (payload.refugees || []).map(id => world.agents.get(id)).filter(Boolean);
    world.chronicle = payload.chronicle || [];
    world.deathStats = payload.deathStats || {};
    return world;
  }
}
