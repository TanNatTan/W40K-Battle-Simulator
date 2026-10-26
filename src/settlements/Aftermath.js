// What happens to people and property when a settlement changes hands:
// conditional seizure of stores, captives and their uncertain fates, refugees
// and the camps and new settlements they found, tithes and conscription,
// looting, and the chance -- never the certainty -- of resistance and
// independence.

import { allocateCaptives } from "../population/SettlementPopulation.js";
import { DAY, FOOD_PER_DAY, clamp, distance, isAdult, operationalBuildings } from "./Settlement.js";
import { learnFromAttack, foodStatus } from "./SettlementPlanner.js";

export const DEFAULT_POLICY = Object.freeze({ branch: "imperial_guard", recruit: 0.46, enslave: 0.04, kill: 0.06, release: 0.44, brutality: 0.2 });

// How each kind of ruler treats a settlement it holds.
export const RULE_BY_BRANCH = Object.freeze({
  imperial_guard: { food: 0.16, materials: 0.1, conscript: 0.045, days: 10, label: "Imperial tithe" },
  space_marines: { food: 0.08, materials: 0.04, conscript: 0.02, days: 14, label: "Chapter levy" },
  adeptus_mechanicus: { food: 0.1, materials: 0.24, conscript: 0.03, days: 9, label: "Mechanicus requisition" },
  orks: { food: 0.38, materials: 0.3, conscript: 0.03, days: 5, label: "Ork looting" },
  chaos: { food: 0.3, materials: 0.2, conscript: 0.06, days: 6, label: "Chaos sacrifice" },
  necrons: { food: 0.05, materials: 0.25, conscript: 0.0, days: 9, label: "Necron tribute" },
  tau: { food: 0.1, materials: 0.1, conscript: 0.01, days: 12, label: "Greater Good levy" },
  tyranids: { food: 0.6, materials: 0.0, conscript: 0.0, days: 6, label: "Hive consumption" }
});

export function ruleFor(policy) { return RULE_BY_BRANCH[policy.branch] || RULE_BY_BRANCH.imperial_guard; }

function shuffle(list, random) { const out = list.slice(); for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }

// ---- capture ------------------------------------------------------------------------
export function captureSettlement(world, s, newOwner, cause = "conquest") {
  const now = world.time;
  const previous = s.owner;
  if (previous === newOwner) return null;
  const agents = world.agentsOf(s);
  const policy = world.policyOf(newOwner);
  const population = agents.length;
  const militiaAlive = agents.filter(a => a.role === "militia").length;
  const militiaStart = Math.max(militiaAlive, s._initialMilitia || 1);

  s.memory.formerOwner = previous;
  s.owner = newOwner;
  s.occupation = { by: newOwner, since: now, hold: 0, garrisonLostAt: null };
  s.rebellion = null;
  s.status = "occupied";
  s.memory.occupiedBy.push({ faction: newOwner, time: Math.round(now) });
  s.nextTitheAt = now + DAY * 1.5;

  // 1. Stores change hands only if the granary stands and people are left to carry them.
  const granary = operationalBuildings(s, "granary").length > 0;
  const workers = agents.filter(a => ["farmer", "builder", "miner", "enslaved"].includes(a.role)).length;
  let fraction = granary ? 0.85 : 0.3;
  if (workers < 3) fraction *= 0.3;
  if (!world.routeOpen(s, newOwner)) fraction *= 0.6; // can't be carried home through a wrecked road net
  const seized = {};
  const lost = {};
  // Only a ruthless conqueror strips a population to nothing; others leave rations to keep the workers alive.
  const rationDays = 8 * (1 - clamp(policy.brutality, 0, 1));
  for (const resource of ["food", "materials", "fuel", "tools"]) {
    const have = s.storage[resource] || 0;
    const ration = resource === "food" ? population * FOOD_PER_DAY * rationDays : 0;
    const taken = Math.max(0, Math.min(have * fraction, have - ration));
    const spoiled = (have - taken) * 0.5;
    seized[resource] = taken;
    lost[resource] = spoiled;
    s.storage[resource] = have - taken - spoiled;
  }
  world.host.grant?.(newOwner, seized, `stores taken at ${s.name}`);
  s.stats.seizedFood += seized.food;
  s.memory.seized += seized.food + seized.materials;

  // 2. Captives: some people are rounded up, and a few slip away at once.
  const resistance = clamp(militiaAlive / militiaStart, 0, 1);
  const captiveShare = clamp(0.26 + resistance * 0.3, 0.2, 0.6);
  const adults = shuffle(agents.filter(a => isAdult(a) && a.role !== "refugee"), world.random);
  const captiveCount = Math.min(adults.length, Math.round(population * captiveShare));
  const captives = adults.slice(0, captiveCount);
  for (const person of captives) {
    person.prevRole = person.role === "militia" ? "farmer" : person.role;
    person.role = "captive"; person.task = null; person.captor = newOwner; person.captiveUntil = now + DAY * 0.8;
    person.needs.fear = 1;
  }
  const fleeing = [];
  const rest = agents.filter(a => !captives.includes(a));
  for (const person of rest) {
    const p = clamp(0.04 + person.needs.fear * 0.1 + (1 - person.traits.courage) * 0.16 + policy.brutality * 0.32, 0, 0.7);
    if (world.random() < p) fleeing.push(person);
  }
  for (const person of fleeing) world.becomeRefugee(s, person, `fled when ${world.nameOf(newOwner)} took ${s.name}`);

  // 3. Loyalty and memory.
  for (const person of world.agentsOf(s)) {
    person.loyalty[newOwner] = (person.loyalty[newOwner] ?? 0) - 0.15 - policy.brutality * 0.3;
    person.needs.fear = Math.min(1, person.needs.fear + 0.35);
  }
  s._attackStart = null; s._peakThreat = 0;
  const learning = learnFromAttack(world, s, {
    by: newOwner, bearing: s.memory.lastAttack?.bearing ?? 0, strength: s._peakThreat || 1, casualties: s.memory.lost,
    population: Math.max(population, 10), outcome: "occupied", looted: seized.food + seized.materials > 5
  });
  world.log(s, `${world.nameOf(newOwner)} takes ${s.name}. ${captives.length} held captive, ${fleeing.length} flee; ${Math.round(seized.food)} food and ${Math.round(seized.materials)} materials ${fraction > 0.5 ? "seized" : "recovered in part"}${granary ? "" : " (the granary had been destroyed)"}.`, "alert", "capture");
  world.host.onCapture?.(s, previous, newOwner, { seized, captives: captives.length, fleeing: fleeing.length, cause });
  return { seized, lost, captives: captives.length, fleeing: fleeing.length, learning, fraction };
}

// ---- captive fates ---------------------------------------------------------------------
export function resolveCaptives(world, s, now) {
  const due = world.agentsOf(s).filter(a => a.role === "captive" && now >= a.captiveUntil);
  if (!due.length) return null;
  const byCaptor = new Map();
  for (const person of due) { if (!byCaptor.has(person.captor)) byCaptor.set(person.captor, []); byCaptor.get(person.captor).push(person); }
  const report = { rescued: 0, killed: 0, enslaved: 0, recruited: 0, released: 0 };
  for (const [captor, group] of byCaptor) {
    if (s.owner !== captor) {
      // The captors lost the place before deciding: the prisoners are free.
      for (const person of group) { person.role = person.prevRole || "farmer"; person.captor = null; person.loyalty[s.owner || "settlement"] = (person.loyalty[s.owner || "settlement"] ?? 0) + 0.4; report.rescued += 1; }
      continue;
    }
    const policy = world.policyOf(captor);
    const stress = world.host.stressOf?.(captor) ?? 0;
    const fates = allocateCaptives(group.length, policy, { stress, random: world.random });
    const order = shuffle(group, world.random);
    let n = 0;
    const take = count => { const slice = order.slice(n, n + count); n += count; return slice; };
    for (const person of take(fates.kill)) { world.killAgent(person, `executed by ${world.nameOf(captor)}`); report.killed += 1; }
    for (const person of take(fates.recruit)) { world.removeAgent(person); world.host.recruit?.(captor, 1, s); report.recruited += 1; }
    for (const person of take(fates.enslave)) { person.role = "enslaved"; person.workRole = person.prevRole === "militia" ? "farmer" : (person.prevRole || "farmer"); person.captor = null; person.loyalty[captor] = -0.6; report.enslaved += 1; }
    for (const person of take(fates.release)) {
      person.captor = null; person.role = person.prevRole || "farmer"; person.loyalty[captor] = (person.loyalty[captor] ?? 0) - 0.1;
      // Released does not mean home safe: many leave for good.
      if (world.random() < 0.4) world.becomeRefugee(s, person, "released but driven from home"); else report.released += 1;
    }
  }
  world.log(s, `Captives at ${s.name} decided: ${report.killed} executed, ${report.enslaved} enslaved, ${report.recruited} pressed into service, ${report.released} released${report.rescued ? `, ${report.rescued} freed when the garrison fell` : ""}.`, "warning", "captives");
  return report;
}

// ---- tithes, loot, conscription --------------------------------------------------------------
export function collectTribute(world, s, agents, now) {
  if (!s.owner || now < s.nextTitheAt) return null;
  const policy = world.policyOf(s.owner);
  const rule = ruleFor(policy);
  s.nextTitheAt = now + DAY * rule.days;
  const food = foodStatus(world, s, agents.length);
  // A ruler who is not a complete brute leaves seed corn and a few days of bread.
  const floor = Math.max(0, food.daily * (policy.brutality > 0.6 ? 0 : 3));
  const foodTake = Math.max(0, Math.min(s.storage.food * rule.food, s.storage.food - floor));
  const matTake = s.storage.materials * rule.materials;
  s.storage.food -= foodTake; s.storage.materials -= matTake;
  const integrity = s.routeIntegrity ?? 1;
  const delivered = { food: foodTake * integrity, materials: matTake * integrity };
  const rotted = foodTake - delivered.food;
  world.host.grant?.(s.owner, delivered, `${rule.label} from ${s.name}`);
  s.stats.taxed += foodTake + matTake;
  const adults = agents.filter(a => isAdult(a) && ["farmer", "builder", "miner"].includes(a.role));
  const conscripts = Math.min(Math.floor(adults.length * 0.4), Math.round(adults.length * rule.conscript + world.random()));
  const chosen = shuffle(adults, world.random).slice(0, conscripts);
  for (const person of chosen) { world.removeAgent(person); world.host.recruit?.(s.owner, 1, s); }
  // Burden breeds grievance.
  for (const person of agents) person.loyalty[s.owner] = (person.loyalty[s.owner] ?? 0) - (0.05 + rule.food * 0.25 + (food.days < 5 ? 0.12 : 0));
  world.log(s, `${rule.label}: ${s.name} yields ${Math.round(delivered.food)} food and ${Math.round(delivered.materials)} materials${chosen.length ? ` and ${chosen.length} conscripts` : ""}${rotted > 1 ? `; ${Math.round(rotted)} food lost on a wrecked road` : ""}.`, "info", "tithe");
  return { delivered, conscripts: chosen.length };
}

// ---- resistance and independence -------------------------------------------------------------------
export function rollResistance(world, s, agents, now) {
  if (!s.occupation?.by || s.rebellion) return false;
  if (now < (s.nextResistanceRollAt || 0)) return false;
  s.nextResistanceRollAt = now + DAY * 0.5;
  const pop = Math.max(1, agents.length);
  const owner = s.owner;
  const loyalty = agents.reduce((sum, a) => sum + (a.loyalty[owner] ?? 0), 0) / pop;
  const enslavedShare = agents.filter(a => a.role === "enslaved").length / pop;
  const food = foodStatus(world, s, pop);
  const policy = world.policyOf(owner);
  // Pressure: how bad living under this ruler is; capability: whether anyone could act on it.
  const pressure = clamp(-loyalty * 0.9 + enslavedShare * 0.8 + (food.days < 4 ? 0.35 : 0) + policy.brutality * 0.25 + (s.memory.lost / Math.max(20, pop + s.memory.lost)) * 0.8, 0, 1.5);
  const leader = agents.some(a => a.traits.charisma > 0.72 && a.traits.courage > 0.5 && isAdult(a));
  const armsStash = s.hidden.materials + s.storage.materials * 0.2;
  const garrison = world.presence(s, owner);
  const cultureBonus = s.culture === "free" ? 0.12 : s.culture === "devout" && policy.branch === "imperial_guard" ? -0.18 : 0;
  const capability = clamp((leader ? 0.3 : 0.05) + Math.min(0.35, armsStash / 60) + s.doctrine.stashShare * 0.4 + cultureBonus + world.random() * 0.1, 0, 1);
  const repression = clamp(garrison * 0.12, 0, 0.8);
  const chance = clamp(pressure * capability * (1 - repression) * 0.6, 0, 0.45);
  s.resistanceOdds = chance;
  if (world.random() >= chance) return false;
  // Rise up: some adults take up whatever arms were hidden.
  const candidates = agents.filter(a => isAdult(a) && a.role !== "captive" && a.hp > a.maxHp * 0.5 && (a.traits.courage > 0.35));
  const rebels = shuffle(candidates, world.random).slice(0, Math.max(3, Math.round(pop * (0.1 + pressure * 0.1))));
  for (const person of rebels) { person.role = "militia"; person.rebel = true; person.roleSince = now; person.task = null; person.skills.fighting = Math.max(person.skills.fighting, 0.4); }
  s.rebellion = { since: now, held: 0, leaderId: rebels[0]?.id || null };
  s.status = "uprising";
  s.hidden.materials = Math.max(0, s.hidden.materials - rebels.length * 0.5);
  world.log(s, `${s.name} rises against ${world.nameOf(owner)}: ${rebels.length} take up arms.`, "alert", "uprising");
  return true;
}

export function updateRebellion(world, s, agents, now, dt) {
  const rebellion = s.rebellion;
  if (!rebellion) return;
  const rebels = agents.filter(a => a.rebel && a.role === "militia");
  if (!rebels.length) {
    s.rebellion = null; s.status = "occupied";
    for (const person of agents) person.loyalty[s.owner] = (person.loyalty[s.owner] ?? 0) - 0.25;
    world.log(s, `The uprising in ${s.name} is crushed.`, "warning", "uprising");
    return;
  }
  const garrison = world.presence(s, s.occupation.by);
  rebellion.held = garrison === 0 ? rebellion.held + dt : Math.max(0, rebellion.held - dt * 2);
  if (rebellion.held >= 18 && rebels.length >= 3) {
    const oppressor = s.owner;
    s.owner = null; s.occupation = { by: null, since: now, hold: 0 };
    s.rebellion = null; s.status = "independent"; s.independentSince = now; s.culture = "free";
    for (const person of agents) { person.rebel = false; person.loyalty.settlement = 0.8; }
    s.doctrine.militiaShare = clamp(Math.max(s.doctrine.militiaShare, 0.14), 0, 0.34);
    s.doctrine.tributeWillingness = 0.3;
    world.log(s, `${s.name} throws out ${world.nameOf(oppressor)} and declares itself independent.`, "alert", "independence");
    world.host.onIndependence?.(s, oppressor);
  }
}

// ---- refugees --------------------------------------------------------------------------------------
export function stepRefugee(world, a, dt, now) {
  a.needs.hunger += dt / (DAY * 1.8);
  if (a.needs.hunger > 0.6 && a.carrying.food > 0.3) { a.carrying.food -= 0.3; a.needs.hunger = Math.max(0, a.needs.hunger - 0.4); }
  if (a.needs.hunger > 1.2) { a.hp -= dt * 0.7; if (a.hp <= 0) { world.killAgent(a, "starved on the road"); return; } }
  if (a.state === "camp") {
    // Camps keep an eye out for a place that will take them in.
    if (now >= (a.nextPickAt || 0)) {
      a.nextPickAt = now + DAY * 1.5;
      a.refusedBy = [];
      const dest = world.pickRefugeeDestination(a);
      if (dest) { a.state = "moving"; a.destination = dest; a.task = null; }
    }
    return;
  }
  if (!a.destination) {
    if (now < (a.nextPickAt || 0)) return;
    a.nextPickAt = now + 8;
    a.destination = world.pickRefugeeDestination(a);
    a.task = null;
    if (!a.destination) {
      if (now - (a.fledAt ?? now) > DAY * 2.5) { a.state = "camp"; a.campSince = now; a.nextPickAt = now + DAY * 1.5; }
      return;
    }
  }
  if (!a.task) a.task = { type: "travel", x: a.destination.x, y: a.destination.y, t: 0, path: null, pi: 0 };
  world.walkRefugee(a, dt);
}

export function refugeeArrivedAt(world, a, dest) {
  if (!dest) { a.state = "camp"; a.campSince = world.time; return; }
  const agents = world.agentsOf(dest);
  const food = foodStatus(world, dest, agents.length);
  const spare = food.days > 3.5 && agents.length < world.capacityOf(dest);
  const hostileRuler = dest.owner && a.fledFrom && world.host.hostile?.(a.fledFrom, dest.owner);
  if (spare && !hostileRuler && dest.status !== "ruined") {
    world.joinSettlement(dest, a);
    world.log(dest, `${dest.name} takes in a refugee from ${a.originName || "elsewhere"}.`, "info", "refugee");
  } else {
    a.refusedBy = a.refusedBy || [];
    a.refusedBy.push(dest.id);
    a.destination = null;
    a.task = null;
    if (a.refusedBy.length >= 2) { a.state = "camp"; a.campSince = world.time; }
  }
}

export function stepCamps(world, now) {
  const camped = world.refugees.filter(a => a.alive && a.state === "camp");
  if (camped.length < 8) return;
  const clusters = [];
  for (const person of camped) {
    let cluster = clusters.find(c => Math.hypot(c.x - person.x, c.y - person.y) < 70);
    if (!cluster) { cluster = { x: person.x, y: person.y, members: [] }; clusters.push(cluster); }
    cluster.members.push(person);
  }
  for (const cluster of clusters) {
    if (cluster.members.length < 8) continue;
    const age = cluster.members.reduce((m, p) => Math.max(m, now - (p.campSince ?? now)), 0);
    if (age < DAY * 1.2) continue;
    if (world.settlements.size >= (world.limits?.maxSettlements ?? 12)) continue;
    const info = world.layers.surfaceInfo(cluster.x, cluster.y);
    if (info.waterSurface > -1e8) continue;
    world.foundSettlement(cluster);
  }
}
