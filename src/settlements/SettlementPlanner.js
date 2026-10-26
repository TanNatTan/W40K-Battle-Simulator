// Settlement-level AI. Every few seconds it reads the settlement's situation
// (food, people, threats, memory of past attacks) and decides: how many people
// do which work, what to build and dig, where fields go, how to stand against
// danger, and how to change doctrine after being hurt.

import { VEGETATION, SURFACE, EARTHWORK } from "../world/WorldLayers.js";
import { plantCrop } from "../world/Ecosystem.js";
import { BUILDING_TYPES, DAY, FOOD_PER_DAY, ADULT_AGE, bearing, bedCapacity, canAfford, clamp, distance, isAdult, operationalBuildings, spend, storageCapacity } from "./Settlement.js";

const FIELD_CELLS_PER_PERSON = 0.95;

export function foodStatus(world, s, pop) {
  const daily = Math.max(1, pop * FOOD_PER_DAY);
  const days = (s.storage.food + s.hidden.food) / daily;
  return { daily, days, reserve: s.doctrine.reserveDays };
}

// ---- threat assessment --------------------------------------------------
export function assessThreat(world, s) {
  const threats = s._threats;
  const doctrine = s.doctrine;
  let nearest = Infinity;
  let strength = 0;
  let cx = 0; let cy = 0;
  for (const t of threats) {
    const d = Math.hypot(t.x - s.x, t.y - s.y);
    nearest = Math.min(nearest, d);
    strength += t.strength ?? 1;
    cx += t.x; cy += t.y;
  }
  s._threatCenter = threats.length ? { x: cx / threats.length, y: cy / threats.length } : null;
  const militia = s._militiaAlive || 0;
  const towers = operationalBuildings(s, "watchtower").length;
  const defense = militia * 1.0 + towers * 1.5 + (s.targets.militia ? 0 : 0);
  return {
    count: threats.length, nearest, strength, defense,
    center: threats.length ? { x: cx / threats.length, y: cy / threats.length } : null,
    bearing: threats.length ? bearing(s, { x: cx / threats.length, y: cy / threats.length }) : null,
    ratio: strength / Math.max(0.5, defense)
  };
}

export function updatePosture(world, s, threat, now) {
  const previous = s.posture;
  const near = threat.nearest <= s.radius * 1.15;
  if (!threat.count) {
    s.alert = Math.max(0, s.alert - 0.02 * (world.thinkInterval || 2));
    if (s.posture !== "calm" && now - (s.postureSince || 0) > DAY * 0.35 && s.alert < 0.1) s.posture = "calm";
  } else {
    s.alert = clamp(Math.max(s.alert, 1 - threat.nearest / (s.doctrine.scoutRadius + s.radius)), 0.15, 1);
    if (near && threat.ratio > 1.3) s.posture = "siege";
    else s.posture = s.posture === "siege" && near ? "siege" : "alert";
    if (s.posture === "siege" && threat.ratio > 3.2 && s._militiaAlive >= 0 && previous !== "evacuate") {
      // Hopeless odds: the more the settlement has been hurt before, the sooner it runs.
      if (world.random() < clamp(s.doctrine.evacuateBias + s.memory.attacks * 0.05, 0, 0.9)) s.posture = "evacuate";
    }
  }
  if (previous === "evacuate" && s.posture !== "calm" && threat.count) s.posture = "evacuate";
  if (s.posture !== previous) { s.postureSince = now; world.log(s, `${s.name} is now ${s.posture === "calm" ? "at ease" : s.posture === "alert" ? "on alert" : s.posture === "siege" ? "under siege" : "evacuating"}.`, s.posture === "calm" ? "info" : "warning", "posture"); }
}

// ---- role allocation -----------------------------------------------------------
export function allocateRoles(world, s, agents, threat, now) {
  const adults = agents.filter(a => isAdult(a) && ["farmer", "miner", "builder", "militia"].includes(a.role));
  const n = adults.length;
  if (!n) return;
  const food = foodStatus(world, s, agents.length);
  const hungry = food.days < Math.min(6, food.reserve * 0.5);
  const alert = s.posture === "siege" || s.posture === "alert";
  let militia = Math.round(n * s.doctrine.militiaShare * (alert ? 2.0 : 1));
  if (s.occupation?.by) militia = 0;                // cowed by the occupiers
  const needMaterials = s.storage.materials < 24 || s.projects.some(p => !p.done);
  let miners = s.mine && !s.mine.flooded && needMaterials ? Math.round(n * (s.storage.materials < 8 ? 0.22 : 0.12)) : 0;
  let builders = Math.round(n * (0.1 + (alert ? 0.16 : 0) + (s.projects.length ? 0.1 : 0) + (!s.mine ? 0.06 : 0)));
  if (hungry) { builders = Math.round(builders * 0.5); miners = Math.round(miners * 0.5); }
  militia = clamp(militia, 0, Math.floor(n * 0.45));
  const farmers = Math.max(1, n - militia - miners - builders);
  s.targets = { farmer: farmers, miner: miners, builder: builders, militia };

  const counts = { farmer: 0, miner: 0, builder: 0, militia: 0 };
  for (const a of adults) counts[a.role] += 1;
  const surplus = role => adults.filter(a => a.role === role && now - (a.roleSince || 0) > DAY * 0.3 && a.hp > a.maxHp * 0.5).sort((x, y) => (y.skills[roleSkill(role)] - x.skills[roleSkill(role)]));
  const order = ["militia", "builder", "miner", "farmer"];
  for (const role of order) {
    let need = s.targets[role] - counts[role];
    if (need <= 0) continue;
    // Take from the roles that are over target; best-suited people first.
    for (const donor of ["farmer", "builder", "miner", "militia"]) {
      if (donor === role || need <= 0) continue;
      const excess = counts[donor] - s.targets[donor];
      if (excess <= 0) continue;
      const pool = surplus(donor).sort((x, y) => (y.skills[roleSkill(role)] + (role === "militia" ? y.traits.courage : 0)) - (x.skills[roleSkill(role)] + (role === "militia" ? x.traits.courage : 0)));
      for (const person of pool) {
        if (need <= 0 || counts[donor] - 1 < s.targets[donor] - (donor === "militia" ? 0 : 0)) break;
        person.role = role; person.roleSince = now; person.task = null;
        counts[donor] -= 1; counts[role] += 1; need -= 1;
        if (counts[donor] <= s.targets[donor]) break;
      }
    }
  }
}

function roleSkill(role) { return role === "miner" ? "mining" : role === "builder" ? "building" : role === "militia" ? "fighting" : "farming"; }

// ---- fields & mine ----------------------------------------------------------------
export function planFields(world, s, pop) {
  const days = foodStatus(world, s, pop).days;
  const wanted = Math.min(300, Math.ceil(pop * FIELD_CELLS_PER_PERSON * (days < s.doctrine.reserveDays ? 1.25 : 1)));
  if (s.fields.length >= wanted || s.occupation?.by && world.random() < 0.5) return 0;
  const L = world.layers; const F = world.field;
  const taken = new Set(s.fields.map(cell => cell[0] * 100003 + cell[1]));
  const cx = Math.round(s.x / 16); const cy = Math.round(s.y / 16);
  const reach = Math.ceil(s.radius * 1.5 / 16);
  const candidates = [];
  for (let j = cy - reach; j <= cy + reach; j += 1) {
    for (let i = cx - reach; i <= cx + reach; i += 1) {
      if (i < 1 || j < 1) continue;
      const d = Math.hypot(i - cx, j - cy) * 16;
      if (d < 26 || d > s.radius * 1.5) continue;
      if (taken.has(i * 100003 + j)) continue;
      if (L.get("waterSurface", i, j) > -1e8) continue;
      const info = L.surfaceInfo(i * 16, j * 16);
      if (info.surface === SURFACE.ROAD || info.surface === SURFACE.STONE || info.earthwork) continue;
      if (info.scorch > 0.5) continue;
      if (F.slopeAt(i * 16, j * 16) > 0.16) continue;
      if (world.cellHasBuilding(i * 16, j * 16, 14)) continue;
      let neighbours = 0; let near = 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (taken.has((i + di) * 100003 + j + dj)) neighbours += 1; }
      for (const [di, dj] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { if (L.get("waterSurface", i + di, j + dj) > -1e8) near = 1; }
      const score = info.fertility * 1.4 + info.moisture * 0.5 + near * 0.35 + neighbours * 0.28 - d / (s.radius * 2.2) - (info.vegKind === VEGETATION.FOREST ? 0.7 : 0);
      candidates.push({ i, j, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  let added = 0;
  const batch = Math.min(wanted - s.fields.length, 12);
  for (const c of candidates) {
    if (added >= batch) break;
    if (taken.has(c.i * 100003 + c.j)) continue;
    s.fields.push([c.i, c.j]); taken.add(c.i * 100003 + c.j); added += 1;
  }
  return added;
}

export function chooseMine(world, s) {
  const L = world.layers;
  let best = null; let bestScore = -Infinity;
  const counts = new Map();
  L.forEachInCircle(s.x, s.y, s.radius * 2.6, (i, j, d) => {
    const kind = L.get("deposit", i, j);
    if (!kind || L.get("depositAmount", i, j) <= 0 || kind === 2) return;
    const key = `${i >> 2},${j >> 2}`;
    const entry = counts.get(key) || { x: 0, y: 0, n: 0, amount: 0, d: 0 };
    entry.x += i * 16; entry.y += j * 16; entry.n += 1; entry.amount += L.get("depositAmount", i, j); entry.d = Math.min(entry.d || d, d);
    counts.set(key, entry);
  });
  for (const entry of counts.values()) {
    const x = entry.x / entry.n; const y = entry.y / entry.n;
    if (L.get("waterSurface", Math.round(x / 16), Math.round(y / 16)) > -1e8) continue;
    const score = entry.amount * 0.01 + entry.n * 3 - entry.d * 0.12;
    if (score > bestScore) { bestScore = score; best = { x, y, amount: entry.amount }; }
  }
  if (!best) return null;
  return { x: best.x, y: best.y, radius: 34, dug: 0, depth: 0, instability: 0, flooded: false, collapsedUntil: 0, floor: world.field.heightAt(best.x, best.y) - 7, baseline: world.field.heightAt(best.x, best.y), remaining: best.amount };
}

// ---- building ----------------------------------------------------------------------
export function freeSite(world, s, size, { bearing: preferred = null, ring = null } = {}) {
  let best = null; let bestScore = -Infinity;
  for (let attempt = 0; attempt < 36; attempt += 1) {
    let angle = world.random() * Math.PI * 2;
    if (preferred != null) angle = preferred + (world.random() - 0.5) * 1.6;
    const r = ring != null ? ring * (0.9 + world.random() * 0.2) : 24 + world.random() * s.radius * 0.7;
    const x = s.x + Math.cos(angle) * r; const y = s.y + Math.sin(angle) * r;
    if (x < 40 || y < 40 || x > world.width - 40 || y > world.height - 40) continue;
    const slope = world.field.slopeAt(x, y);
    if (slope > 0.18) continue;
    const info = world.layers.surfaceInfo(x, y);
    if (info.waterSurface > -1e8 || info.earthwork === 1 || info.earthwork === 4) continue;
    if (world.cellHasBuilding(x, y, size + 4)) continue;
    if (s.fields.some(cell => Math.abs(cell[0] * 16 - x) < size && Math.abs(cell[1] * 16 - y) < size)) continue;
    const score = -slope * 6 - r * (ring != null ? 0 : 0.012) + (info.vegKind === VEGETATION.FOREST ? -0.6 : 0) + world.random() * 0.25;
    if (score > bestScore) { bestScore = score; best = { x, y }; }
  }
  return best;
}

function startBuilding(world, s, type, spot) {
  const spec = BUILDING_TYPES[type];
  const site = spot || freeSite(world, s, spec.size);
  if (!site || !canAfford(s, spec.cost)) return null;
  spend(s, spec.cost);
  const building = { id: world.nextId("b"), type, x: site.x, y: site.y, hp: spec.hp, maxHp: spec.hp, progress: 0, operational: false, size: spec.size, built: world.time };
  s.buildings.push(building);
  const project = { id: world.nextId("p"), kind: "building", type, x: site.x, y: site.y, size: spec.size, buildingId: building.id, progress: 0, work: spec.work, workers: [], done: false };
  s.projects.push(project);
  return project;
}

function startTrench(world, s, centerBearing, offset = 0) {
  const r = s.radius * 0.88;
  const half = 44;
  // The ideal line may cross water or a cliff; slide the arc around until a line of ground is found.
  let line = null;
  for (const turn of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05]) {
    const angle = centerBearing + turn;
    const mx = s.x + Math.cos(angle) * r; const my = s.y + Math.sin(angle) * r;
    const px = -Math.sin(angle); const py = Math.cos(angle);
    const cx = mx + px * offset; const cy = my + py * offset;
    const a = { x: cx - px * half, y: cy - py * half }; const b = { x: cx + px * half, y: cy + py * half };
    if (world.pathfinder.blockedAt(cx, cy, "civilian") || !world.pathfinder.clearLine(a, b, "civilian")) continue;
    if (world.cellHasBuilding(cx, cy, 10)) continue;
    line = { a, b, cx, cy, angle };
    break;
  }
  if (!line) return null;
  const { a, b, cx, cy } = line;
  centerBearing = line.angle;
  const sliceCount = 3;
  const slices = [];
  for (let k = 0; k < sliceCount; k += 1) {
    const t0 = k / sliceCount; const t1 = (k + 1) / sliceCount;
    const ax = a.x + (b.x - a.x) * t0; const ay = a.y + (b.y - a.y) * t0;
    const bx = a.x + (b.x - a.x) * t1; const by = a.y + (b.y - a.y) * t1;
    slices.push({ index: k, ax, ay, bx, by, x: (ax + bx) / 2, y: (ay + by) / 2, done: false, owner: null });
  }
  const project = { id: world.nextId("p"), kind: "trench", type: "trench", x: cx, y: cy, size: 10, slices, width: 14, depth: 2.1, progress: 0, workers: [], done: false, bearing: centerBearing };
  s.projects.push(project);
  return project;
}

export function planConstruction(world, s, agents, threat, now) {
  const active = s.projects.filter(p => !p.done).length;
  const cap = s.posture === "calm" ? 2 : 3;
  if (active >= cap) return;
  if (s.occupation?.by) return; // no fortifying under occupation
  const pop = agents.length;
  const count = type => s.buildings.filter(b => b.type === type && b.hp > 0).length;
  const food = foodStatus(world, s, pop);
  if (food.days < 4) return;
  const threatBearing = threat.bearing ?? s.memory.lastAttack?.bearing ?? null;
  const defendedBy = s.memory.lastAttack ? 1 : 0;

  const wants = [];
  if (!operationalBuildings(s, "granary").length && count("granary") === 0) wants.push({ key: "granary", score: 100, build: () => startBuilding(world, s, "granary") });
  if (bedCapacity(s) + count("house") * 0 < pop + 2 && count("house") < 14) wants.push({ score: 70, build: () => startBuilding(world, s, "house") });
  if (s.mine && s.mine.dug > 22 && !count("mineworks")) wants.push({ score: 45, build: () => startBuilding(world, s, "mineworks") });
  const towerTarget = Math.min(4, Math.round(s.doctrine.towerTarget));
  if (count("watchtower") < towerTarget) {
    const preferred = threatBearing;
    wants.push({ score: 50 + s.memory.attacks * 15, build: () => startBuilding(world, s, "watchtower", freeSite(world, s, BUILDING_TYPES.watchtower.size, { bearing: preferred, ring: s.radius * 0.7 })) });
  }
  const trenches = s.projects.filter(p => p.kind === "trench").length;
  if (threatBearing != null && trenches < 1 + Math.round(s.doctrine.trenchPriority * 6)) {
    wants.push({ key: "trench", score: 30 + s.doctrine.trenchPriority * 120 + (s.alert > 0.3 ? 40 : 0), build: () => startTrench(world, s, threatBearing, (trenches - 1) * 70) });
  }
  const walls = count("barricade") + count("palisade");
  if (threatBearing != null && walls < 3 + Math.round(s.doctrine.wallPriority * 14)) {
    const type = s.doctrine.wallPriority > 0.5 ? "palisade" : "barricade";
    wants.push({ key: "wall", score: 25 + s.doctrine.wallPriority * 110 + (s.alert > 0.3 ? 35 : 0) + defendedBy * 10, build: () => startBuilding(world, s, type, freeSite(world, s, BUILDING_TYPES[type].size, { bearing: threatBearing, ring: s.radius * 0.82 })) });
  }
  wants.sort((a, b) => b.score - a.score);
  const activeKinds = new Set(s.projects.filter(p => !p.done).map(p => p.kind === "trench" ? "trench" : (p.type === "barricade" || p.type === "palisade") ? "wall" : p.type));
  for (const want of wants) {
    if (s.projects.filter(p => !p.done).length >= cap) break;
    if (want.key && activeKinds.has(want.key)) continue;
    if (want.build()) break;
  }
}

// ---- adaptation -----------------------------------------------------------------------
/** The settlement remembers being hurt and changes how it lives. */
export function learnFromAttack(world, s, info) {
  const d = s.doctrine;
  const mem = s.memory;
  const before = { ...d };
  mem.attacks += 1;
  const casualtyRate = clamp(info.casualties / Math.max(10, info.population), 0, 1);
  mem.lastAttack = { time: world.time, bearing: info.bearing, strength: info.strength, by: info.by, casualties: info.casualties, outcome: info.outcome };
  mem.raids.push({ time: Math.round(world.time), by: info.by, outcome: info.outcome, casualties: info.casualties });
  if (mem.raids.length > 12) mem.raids.shift();
  d.militiaShare = clamp(d.militiaShare + 0.035 + casualtyRate * 0.18, 0.04, 0.34);
  d.reserveDays = clamp(d.reserveDays + 3 + (info.looted ? 5 : 0), 8, 40);
  d.stashShare = clamp(d.stashShare + 0.1 + (info.looted ? 0.18 : 0), 0, 0.55);
  d.trenchPriority = clamp(d.trenchPriority + 0.12 + casualtyRate * 0.2, 0, 1);
  d.wallPriority = clamp(d.wallPriority + 0.1, 0, 1);
  d.towerTarget = clamp(d.towerTarget + 1, 1, 4);
  d.scoutRadius = clamp(d.scoutRadius + 40, 220, 520);
  d.evacuateBias = clamp(d.evacuateBias + (casualtyRate > 0.15 ? 0.15 : 0.05), 0, 0.9);
  if (info.outcome === "defeated" || info.outcome === "occupied") d.tributeWillingness = clamp(d.tributeWillingness + 0.25, 0, 1);
  const lesson = `Attacked by ${info.by} from the ${compass(info.bearing)} (${info.outcome}); militia ${pct(before.militiaShare)}→${pct(d.militiaShare)}, hidden stores ${pct(before.stashShare)}→${pct(d.stashShare)}.`;
  mem.lessons.push({ time: Math.round(world.time), text: lesson });
  if (mem.lessons.length > 10) mem.lessons.shift();
  world.log(s, `${s.name} learns from the attack: more militia, fortifications facing the ${compass(info.bearing)}, hidden stores.`, "warning", "adaptation");
  return { before, after: { ...d } };
}

function compass(rad) {
  if (rad == null) return "unknown";
  const names = ["east", "south-east", "south", "south-west", "west", "north-west", "north", "north-east"];
  return names[((Math.round(rad / (Math.PI / 4)) % 8) + 8) % 8];
}
const pct = v => `${Math.round(v * 100)}%`;
export { compass };

// ---- stores -------------------------------------------------------------------------------
export function manageStores(world, s, pop) {
  const cap = storageCapacity(s);
  // Spoilage and rot of whatever exceeds shelter.
  if (s.storage.food > cap) s.storage.food = cap + (s.storage.food - cap) * 0.7;
  s.storage.food *= 1 - 0.0004 * (world.thinkInterval || 2) * (world.eco.weather.rain > 0.3 ? 1.6 : 1);
  // Quietly set some aside once the settlement has learned to.
  const total = s.storage.food + s.hidden.food;
  const wantHidden = total * s.doctrine.stashShare;
  if (s.hidden.food < wantHidden && s.storage.food > 4) {
    const move = Math.min(s.storage.food * 0.2, wantHidden - s.hidden.food);
    s.storage.food -= move; s.hidden.food += move;
  }
  const totalMat = s.storage.materials + s.hidden.materials;
  const wantMat = totalMat * s.doctrine.stashShare * 0.7;
  if (s.hidden.materials < wantMat && s.storage.materials > 4) {
    const move = Math.min(s.storage.materials * 0.15, wantMat - s.hidden.materials);
    s.storage.materials -= move; s.hidden.materials += move;
  }
}

// ---- diplomacy ---------------------------------------------------------------------------------
/** A sovereign settlement under pressure can buy time with tribute. */
export function considerTribute(world, s, threat, now) {
  if (s.owner || s.occupation?.by || !threat.count) return;
  const factions = new Map();
  for (const t of s._threats) factions.set(t.faction, Math.max(factions.get(t.faction) || 0, t.strength ?? 1));
  for (const [faction] of factions) {
    if ((s.pacts[faction] || 0) > now) continue;
    if (threat.ratio < 1.6) continue;
    if (threat.nearest > s.radius * 2.0) continue;
    if (now < (s.relations[faction]?.nextOffer || 0)) continue;
    s.relations[faction] = { ...(s.relations[faction] || {}), nextOffer: now + DAY * 0.7 };
    const policy = world.policyOf(faction);
    if (world.random() > s.doctrine.tributeWillingness + 0.15) continue;
    const price = { food: Math.min(s.storage.food * 0.25, 120), materials: Math.min(s.storage.materials * 0.3, 40) };
    const acceptance = clamp(0.55 - policy.brutality * 0.55 + (price.food + price.materials) / 220, 0.03, 0.9);
    if (world.random() < acceptance) {
      s.storage.food -= price.food; s.storage.materials -= price.materials;
      s.pacts[faction] = now + DAY * 3;
      world.host.grant?.(faction, price, `tribute from ${s.name}`);
      world.log(s, `${s.name} buys a truce with ${world.nameOf(faction)} for ${Math.round(price.food)} food and ${Math.round(price.materials)} materials.`, "info", "diplomacy");
    } else {
      world.log(s, `${world.nameOf(faction)} rejects ${s.name}'s offer of tribute.`, "warning", "diplomacy");
    }
  }
}

// ---- expansion --------------------------------------------------------------------------
// A settlement that fills up does two things: its reach (the ring it farms, patrols and
// defends) widens, and once crowded it sends settlers to found a daughter settlement.
export const EXPANSION = Object.freeze({
  maxRadiusFactor: 2.1,    // reach never grows past this multiple of the founding radius
  crowdedPopulation: 55,   // people needed before settlers are sent out
  settlers: 9,
  colonyCooldown: DAY * 5, // simulated seconds between colonies from one settlement
  minSpacing: 230
});

export function baseRadiusOf(s) { return s.baseRadius ?? s.radius; }

/** Widen (or, after losses, narrow) the settlement's reach to match the people it supports. */
export function updateReach(world, s, agents, now) {
  const base = s.baseRadius ??= s.radius;
  const pop = agents.length;
  const fieldPull = Math.max(0, s.fields.length - 30) * 0.35;
  const target = clamp(base + Math.max(0, pop - 24) * 1.15 + fieldPull, base, base * EXPANSION.maxRadiusFactor);
  const before = s.radius;
  if (target > s.radius + 0.5) s.radius = Math.min(target, s.radius + 3);
  else if (target < s.radius - 12) s.radius = Math.max(target, s.radius - 1.5);
  const grewPast = Math.floor((s.radius - base) / (base * 0.25));
  if (grewPast > (s._reachStep ?? 0) && s.radius > before) {
    s._reachStep = grewPast;
    world.log(s, `${s.name} spreads out: farms and homesteads now reach ${Math.round(s.radius)} paces.`, "info", "expanded");
    world.pathfinder.invalidateAround(s.x, s.y, s.radius * 2);
  } else if (grewPast < (s._reachStep ?? 0)) s._reachStep = grewPast;
}

function siteScore(world, x, y) {
  const L = world.layers; const F = world.field;
  if (x < 80 || y < 80 || x > world.width - 80 || y > world.height - 80) return -Infinity;
  const i = Math.round(x / 16); const j = Math.round(y / 16);
  if (L.get("waterSurface", i, j) > -1e8) return -Infinity;
  if (F.slopeAt(x, y) > 0.13) return -Infinity;
  const info = L.surfaceInfo(x, y);
  if (info.surface === SURFACE.STONE || info.scorch > 0.5) return -Infinity;
  let water = 0;
  for (const [di, dj] of [[4, 0], [-4, 0], [0, 4], [0, -4], [7, 0], [-7, 0], [0, 7], [0, -7]]) if (L.get("waterSurface", i + di, j + dj) > -1e8) water = 1;
  let fertile = 0; let samples = 0;
  for (let dj = -4; dj <= 4; dj += 2) for (let di = -4; di <= 4; di += 2) { fertile += L.surfaceInfo((i + di) * 16, (j + dj) * 16).fertility; samples += 1; }
  return info.fertility * 1.2 + fertile / samples * 1.6 + info.moisture * 0.4 + water * 0.5 - (info.vegKind === VEGETATION.FOREST ? 0.9 : 0);
}

/** Best open ground within reach of a parent settlement for a daughter settlement, or null. */
export function findColonySite(world, s) {
  const base = baseRadiusOf(s);
  let best = null; let bestScore = -Infinity;
  for (let ring = 0; ring < 3; ring += 1) {
    const dist = s.radius * 1.5 + base * (0.5 + ring * 0.55);
    for (let step = 0; step < 18; step += 1) {
      const angle = (step / 18) * Math.PI * 2 + world.random() * 0.2;
      const x = s.x + Math.cos(angle) * dist; const y = s.y + Math.sin(angle) * dist;
      let blocked = false;
      for (const other of world.settlements.values()) {
        if (Math.hypot(other.x - x, other.y - y) < Math.max(EXPANSION.minSpacing, (other.radius + base * 0.6) * 1.1)) { blocked = true; break; }
      }
      if (blocked) continue;
      const score = siteScore(world, x, y) - dist / (base * 9);
      if (score > bestScore) { bestScore = score; best = { x, y, score }; }
    }
  }
  return best && best.score > 0.35 ? best : null;
}

/** Send settlers to found a daughter settlement when the home settlement is crowded, fed and calm. */
export function planColony(world, s, agents, threat, now) {
  if (s.posture !== "calm" || threat.count || s.occupation?.by || s.status === "occupied" || s.status === "abandoned") return null;
  if (now < (s.nextColonyAt ?? DAY * 3)) return null;
  const pop = agents.length;
  if (pop < EXPANSION.crowdedPopulation) return null;
  if (world.settlements.size >= world.limits.maxSettlements) return null;
  const food = foodStatus(world, s, pop);
  if (food.days < s.doctrine.reserveDays * 0.9) return null;
  const crowded = pop >= bedCapacity(s) - 2 || s.fields.length < Math.min(300, pop * FIELD_CELLS_PER_PERSON) * 0.8;
  if (!crowded) return null;
  s.nextColonyAt = now + EXPANSION.colonyCooldown;
  const site = findColonySite(world, s);
  if (!site) return null;
  const pool = agents.filter(a => isAdult(a) && a.role !== "militia" && a.role !== "captive" && a.role !== "enslaved" && a.id !== s.leaderId && a.hp > a.maxHp * 0.6);
  if (pool.length < EXPANSION.settlers + 8) return null;
  pool.sort((a, b) => (b.traits.diligence + b.skills.building + b.skills.farming) - (a.traits.diligence + a.skills.building + a.skills.farming));
  const settlers = pool.slice(0, EXPANSION.settlers);
  const colony = world.addSettlement({ x: site.x, y: site.y, population: 0, empty: true, owner: s.owner, culture: s.culture, radius: Math.max(90, Math.round(baseRadiusOf(s) * 0.8)), mine: true, buildings: false });
  if (!colony) return null;
  colony.parentId = s.id;
  colony.doctrine = { ...colony.doctrine, ...s.doctrine, towerTarget: 1 };
  colony.memory.lessons.push({ time: Math.round(now), text: `Founded from ${s.name}, which had grown too crowded.` });
  const hall = world.addCompletedBuilding(colony, "hall", { x: site.x, y: site.y });
  const house = world.addCompletedBuilding(colony, "house");
  for (const person of settlers) {
    s.agentIds = s.agentIds.filter(id => id !== person.id);
    person.settlementId = colony.id; person.task = null; person.activity = "wander"; person.roleSince = now;
    person.role = "farmer"; person.home = { x: (house || hall).x, y: (house || hall).y };
    person.loyalty = { settlement: 0.7 };
    person.history.push(`Left ${s.name} to found ${colony.name}`);
    if (person.history.length > 12) person.history.shift();
    person.task = { type: "wander", x: site.x + (world.random() - 0.5) * 30, y: site.y + (world.random() - 0.5) * 30, t: 0, path: null, pi: 0, settling: true };
    colony.agentIds.push(person.id);
  }
  // Settlers carry a fortnight of food and seed grain with them, and start with a few fields.
  const pack = Math.min(s.storage.food * 0.2, settlers.length * FOOD_PER_DAY * 14); s.storage.food -= pack; colony.storage.food += pack;
  const seed = Math.min(s.storage.seed, 6); s.storage.seed -= seed; colony.storage.seed += seed + 4;
  const wood = Math.min(s.storage.materials, 14); s.storage.materials -= wood; colony.storage.materials += wood + 10;
  colony._startPopulation = settlers.length;
  colony._agents = world.agentsOf(colony);
  planFields(world, colony, settlers.length * 1.6);
  for (const [i, j] of colony.fields) {
    if (world.random() < 0.5) { plantCrop(world.layers, i, j); world.layers.set("cropStage", i, j, 40 + world.random() * 80); }
    else world.layers.set("earthwork", i, j, EARTHWORK.FIELD);
  }
  s.stats.colonies = (s.stats.colonies || 0) + 1;
  world.log(s, `${settlers.length} settlers leave ${s.name} to found ${colony.name}.`, "info", "colony");
  world.host.onColony?.(colony, s);
  return colony;
}
