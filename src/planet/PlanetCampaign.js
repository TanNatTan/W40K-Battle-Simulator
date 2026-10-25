// Planet-scale strategic layer.
//
// A planet is a sphere of regions. Each region carries aggregate strength,
// supply, population and unrest instead of individual soldiers, so a whole
// world can be fought over cheaply. Battles are resolved here by a
// Lanchester-style exchange; any region can instead be opened as a full
// tactical battle (see tacticalSetupFor / applyTacticalResult), which is the
// only place individual units exist.

import { captivePolicyFor, populationBranchFor } from "../population/SettlementPopulation.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;

export function planetRandom(seed) {
  let a = (typeof seed === "string" ? [...seed].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) : Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Great-circle angular distance in radians between two (lat, lon) points.
export function angularDistance(a, b) {
  const sinLat = Math.sin((a.lat - b.lat) / 2);
  const sinLon = Math.sin((a.lon - b.lon) / 2);
  const h = sinLat * sinLat + Math.cos(a.lat) * Math.cos(b.lat) * sinLon * sinLon;
  return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const BIOMES = Object.freeze({
  frozen: { defense: 0.22, mobility: 0.7, food: 0.1, minerals: 0.5, label: "Frozen waste" },
  balanced: { defense: 0.05, mobility: 1, food: 1, minerals: 0.5, label: "Temperate plains" },
  forest: { defense: 0.3, mobility: 0.72, food: 0.9, minerals: 0.35, label: "Dense forest" },
  desert: { defense: 0.04, mobility: 0.9, food: 0.15, minerals: 0.9, label: "Arid desert" },
  volcanic: { defense: 0.2, mobility: 0.6, food: 0, minerals: 1.2, label: "Volcanic badlands" },
  archipelago: { defense: 0.12, mobility: 0.55, food: 0.7, minerals: 0.3, label: "Island chain" },
  urban: { defense: 0.35, mobility: 0.85, food: 0.2, minerals: 0.8, label: "Hive sprawl" }
});

export const PLANET_BIOME_IDS = Object.freeze(Object.keys(BIOMES));

const REGION_NAMES = ["Argent", "Vael", "Kharon", "Saint Idra", "Tessal", "Orrin", "Maldek", "Ashen", "Corvane", "Hadrus", "Pell", "Nox", "Varro", "Eisen", "Lorn", "Dross", "Meridian", "Calix", "Brask", "Ulm", "Zephyr", "Karst", "Odran", "Sable", "Thule", "Ymir", "Oberon", "Quill", "Rend", "Storm", "Teth", "Umber"];
const SUFFIXES = ["Reach", "Basin", "Heights", "Marches", "Verge", "Hollow", "Expanse", "Spine", "Fields", "Gulf", "Crown", "Rift"];

function fibonacciPoint(index, count, random) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (index + 0.5) / count * 2;
  const lat = Math.asin(clamp(y + (random() - 0.5) * (2 / count) * 0.7, -1, 1));
  const lon = ((index * golden + (random() - 0.5) * 0.35) % TAU + TAU) % TAU - Math.PI;
  return { lat, lon };
}

export function generatePlanet({ seed = "PLANET", regionCount = 64, factions = [], turnSeconds = 2 } = {}) {
  const random = planetRandom(seed);
  const count = clamp(Math.round(regionCount), 12, 400);
  const regions = [];
  for (let n = 0; n < count; n += 1) {
    const point = fibonacciPoint(n, count, random);
    regions.push({
      id: `r${n}`,
      index: n,
      name: `${REGION_NAMES[Math.floor(random() * REGION_NAMES.length)]} ${SUFFIXES[Math.floor(random() * SUFFIXES.length)]}`,
      lat: point.lat,
      lon: point.lon,
      x: (point.lon + Math.PI) / TAU,
      y: 0.5 - point.lat / Math.PI,
      neighbors: [],
      owner: "",
      forces: {},
      population: 0,
      maxPopulation: 0,
      fortification: 0,
      unrest: 0,
      supply: {},
      spaceport: false,
      capitalOf: null,
      biome: "balanced",
      resources: {},
      lastBattleAt: -999
    });
  }

  // Neighbours: k nearest on the sphere, made symmetric.
  const k = count < 30 ? 4 : 5;
  const links = regions.map(() => new Set());
  for (const region of regions) {
    const nearest = regions.filter(other => other !== region)
      .map(other => ({ other, d: angularDistance(region, other) }))
      .sort((a, b) => a.d - b.d).slice(0, k);
    for (const { other } of nearest) { links[region.index].add(other.index); links[other.index].add(region.index); }
  }
  regions.forEach(region => { region.neighbors = [...links[region.index]].sort((a, b) => a - b).map(index => regions[index].id); });
  // Guarantee a connected world.
  connectComponents(regions);

  // Biome by latitude, with noise; oceans/islands in the mid latitudes.
  for (const region of regions) {
    const polar = Math.abs(region.lat) / (Math.PI / 2);
    const roll = random();
    region.biome = polar > 0.78 ? "frozen"
      : polar < 0.22 ? (roll < 0.45 ? "desert" : roll < 0.7 ? "volcanic" : roll < 0.85 ? "archipelago" : "balanced")
        : roll < 0.28 ? "forest" : roll < 0.4 ? "archipelago" : roll < 0.5 ? "urban" : roll < 0.6 ? "volcanic" : roll < 0.7 ? "desert" : "balanced";
    const biome = BIOMES[region.biome];
    region.maxPopulation = Math.round((40 + random() * 120) * (region.biome === "urban" ? 4 : 1) * (0.4 + biome.food * 0.8));
    region.population = Math.round(region.maxPopulation * (0.5 + random() * 0.4));
    region.fortification = Math.round(random() * 3) / 10 + (region.biome === "urban" ? 0.2 : 0);
    region.resources = {
      food: Math.round(biome.food * (3 + random() * 5)),
      materials: Math.round(biome.minerals * (2 + random() * 5)),
      ...(random() < 0.18 ? { fuel: Math.round(2 + random() * 5) } : {}),
      ...(random() < 0.15 ? { scrap: Math.round(2 + random() * 5) } : {}),
      ...(random() < 0.1 ? { biomass: Math.round(3 + random() * 5) } : {})
    };
    region.spaceport = random() < 0.1 || (region.biome === "urban" && random() < 0.5);
  }

  const planet = {
    seed: String(seed),
    time: 0,
    turn: 0,
    turnSeconds,
    regions,
    byId: new Map(regions.map(region => [region.id, region])),
    factions: {},
    log: [],
    moves: [],
    winner: null,
    random,
    nextEventAt: 0
  };
  placeFactions(planet, factions, random);
  return planet;
}

function connectComponents(regions) {
  const byId = new Map(regions.map(region => [region.id, region]));
  const component = new Map();
  let label = 0;
  for (const region of regions) {
    if (component.has(region.id)) continue;
    const stack = [region.id];
    component.set(region.id, label);
    while (stack.length) {
      const current = byId.get(stack.pop());
      for (const id of current.neighbors) if (!component.has(id)) { component.set(id, label); stack.push(id); }
    }
    label += 1;
  }
  for (let c = 1; c < label; c += 1) {
    const inside = regions.filter(region => component.get(region.id) === c);
    const outside = regions.filter(region => component.get(region.id) < c);
    let best = null;
    for (const a of inside) for (const b of outside) {
      const d = angularDistance(a, b);
      if (!best || d < best.d) best = { a, b, d };
    }
    best.a.neighbors.push(best.b.id);
    best.b.neighbors.push(best.a.id);
    for (const region of inside) component.set(region.id, 0);
  }
}

function placeFactions(planet, factions, random) {
  const { regions } = planet;
  const capitals = [];
  const candidates = regions.filter(region => region.biome !== "frozen");
  const first = candidates[Math.floor(random() * candidates.length)];
  capitals.push(first);
  while (capitals.length < factions.length) {
    let best = null;
    for (const region of candidates) {
      if (capitals.includes(region)) continue;
      const d = Math.min(...capitals.map(capital => angularDistance(capital, region)));
      if (!best || d > best.d) best = { region, d };
    }
    capitals.push(best.region);
  }
  factions.forEach((faction, index) => {
    const capital = capitals[index];
    planet.factions[faction.id] = {
      id: faction.id,
      name: faction.name || faction.id,
      race: faction.race || "Imperium",
      faction: faction.faction || "",
      subfaction: faction.subfaction || "",
      color: faction.color || "#888",
      aggression: clamp(Number(faction.aggression ?? 0.5), 0.1, 1),
      treasury: 60,
      income: 0,
      fleet: 40 + random() * 20,
      capitalId: capital.id,
      eliminated: false,
      conquests: 0,
      losses: 0
    };
    capital.owner = faction.id;
    capital.capitalOf = faction.id;
    capital.spaceport = true;
    capital.fortification = Math.max(capital.fortification, 0.5);
    capital.population = Math.max(capital.population, 120);
    capital.maxPopulation = Math.max(capital.maxPopulation, 180);
    capital.forces[faction.id] = 140;
    // Two adjacent regions come with the capital.
    for (const id of capital.neighbors.slice(0, 2)) {
      const region = planet.byId.get(id);
      if (region && !region.owner) { region.owner = faction.id; region.forces[faction.id] = 45; }
    }
  });
  updateSupply(planet);
}

// ---- Queries ---------------------------------------------------------------

export const regionStrength = (region, factionId) => Math.max(0, region.forces[factionId] || 0);
export const totalForces = region => Object.values(region.forces).reduce((sum, value) => sum + Math.max(0, value), 0);

export function regionValue(region) {
  const resources = Object.values(region.resources).reduce((sum, value) => sum + value, 0);
  return 8 + region.population * 0.25 + resources * 2 + (region.spaceport ? 30 : 0) + (region.capitalOf ? 80 : 0) + region.fortification * 20;
}

export function ownedRegions(planet, factionId) {
  return planet.regions.filter(region => region.owner === factionId);
}

export function factionStrength(planet, factionId) {
  return planet.regions.reduce((sum, region) => sum + regionStrength(region, factionId), 0);
}

// BFS supply: regions connected to the capital through owned/allied ground
// are fully supplied; isolated ones fall to a trickle.
export function updateSupply(planet) {
  for (const region of planet.regions) region.supply = {};
  for (const faction of Object.values(planet.factions)) {
    if (faction.eliminated) continue;
    const capital = planet.byId.get(faction.capitalId);
    const reachable = new Map();
    if (capital && capital.owner === faction.id) {
      const queue = [[capital, 0]];
      reachable.set(capital.id, 0);
      while (queue.length) {
        const [current, depth] = queue.shift();
        for (const id of current.neighbors) {
          const next = planet.byId.get(id);
          if (next.owner === faction.id && !reachable.has(id)) { reachable.set(id, depth + 1); queue.push([next, depth + 1]); }
        }
      }
    }
    for (const region of planet.regions) {
      if (region.owner !== faction.id && regionStrength(region, faction.id) <= 0) continue;
      const depth = reachable.get(region.id);
      region.supply[faction.id] = depth == null ? 0.25 : clamp(1 - depth * 0.04, 0.5, 1);
    }
  }
}

// ---- Combat ----------------------------------------------------------------

function defenseMultiplier(region) {
  return 1 + (BIOMES[region.biome]?.defense || 0) + region.fortification * 0.9;
}

// Deterministic-ish Lanchester square exchange. Returns the survivors.
export function resolveBattle(attackers, defenders, random = Math.random, rounds = 6) {
  let a = Math.max(0, attackers.strength);
  let d = Math.max(0, defenders.strength);
  const aPower = attackers.multiplier;
  const dPower = defenders.multiplier;
  for (let round = 0; round < rounds && a > 0.5 && d > 0.5; round += 1) {
    const noiseA = 0.88 + random() * 0.24;
    const noiseD = 0.88 + random() * 0.24;
    const hitOnDefenders = 0.16 * a * aPower * noiseA;
    const hitOnAttackers = 0.16 * d * dPower * noiseD;
    d = Math.max(0, d - hitOnDefenders);
    a = Math.max(0, a - hitOnAttackers);
  }
  return { attackers: a < 0.5 ? 0 : a, defenders: d < 0.5 ? 0 : d };
}

function log(planet, text, kind = "info", regionId = null) {
  planet.log.push({ at: Math.round(planet.time), turn: planet.turn, text, kind, regionId });
  if (planet.log.length > 60) planet.log.shift();
}

function moraleOf(faction, supply) {
  return clamp(0.75 + supply * 0.35, 0.6, 1.1) * (faction.eliminated ? 0 : 1);
}

// Attack from `from` into `target` with a share of the forces.
export function launchAttack(planet, factionId, from, target, share = 0.6) {
  const faction = planet.factions[factionId];
  const available = regionStrength(from, factionId);
  const sent = Math.floor(available * clamp(share, 0.1, 0.9));
  if (sent < 6) return null;
  from.forces[factionId] = available - sent;
  const supply = from.supply[factionId] ?? 0.5;
  const defenderId = target.owner;
  const defendingForces = Object.entries(target.forces).filter(([id, strength]) => id !== factionId && strength > 0);
  const defenderStrength = defendingForces.reduce((sum, [, strength]) => sum + strength, 0);
  const attackerPower = moraleOf(faction, supply) * (1 + faction.fleet / 400)
    * (BIOMES[target.biome]?.mobility ?? 1) ** 0.4;
  const defenderPower = defenseMultiplier(target) * (defenderId ? 0.9 + clamp(1 - target.unrest, 0.4, 1) * 0.2 : 0.85);
  const result = resolveBattle({ strength: sent, multiplier: attackerPower }, { strength: defenderStrength, multiplier: defenderPower }, planet.random);
  const attackerLosses = sent - result.attackers;
  const defenderLosses = defenderStrength - result.defenders;
  faction.losses += attackerLosses;
  target.lastBattleAt = planet.time;
  // Scale surviving defenders back across factions present.
  if (defenderStrength > 0) {
    const keep = result.defenders / defenderStrength;
    for (const [id] of defendingForces) target.forces[id] = Math.max(0, (target.forces[id] || 0) * keep);
  }
  // Civilians suffer in contested regions.
  target.population = Math.max(0, target.population - Math.round((attackerLosses + defenderLosses) * 0.25));
  target.unrest = clamp(target.unrest + 0.05 + (attackerLosses + defenderLosses) / Math.max(40, target.maxPopulation) * 0.2, 0, 1);
  planet.moves.push({ at: planet.time, from: from.id, to: target.id, factionId });
  if (planet.moves.length > 40) planet.moves.shift();
  if (result.attackers > 0 && result.defenders <= 0) {
    conquer(planet, factionId, target, result.attackers, defenderId);
    log(planet, `${faction.name} took ${target.name}${defenderId ? ` from ${planet.factions[defenderId]?.name || "rebels"}` : ""} (${Math.round(attackerLosses)} lost).`, "conquest", target.id);
    return { outcome: "conquest", attackerLosses, defenderLosses };
  }
  if (result.attackers > 0) {
    // Stalemate: survivors dig in beside the defenders.
    target.forces[factionId] = (target.forces[factionId] || 0) + result.attackers;
    log(planet, `${faction.name}'s assault on ${target.name} stalled (${Math.round(attackerLosses)} lost, ${Math.round(defenderLosses)} inflicted).`, "battle", target.id);
    return { outcome: "stalemate", attackerLosses, defenderLosses };
  }
  log(planet, `${faction.name}'s assault on ${target.name} was thrown back (${Math.round(attackerLosses)} lost).`, "battle", target.id);
  return { outcome: "repulsed", attackerLosses, defenderLosses };
}

// Ownership change plus the civilian fallout from the conqueror's doctrine.
export function conquer(planet, factionId, region, garrison, previousOwner) {
  const faction = planet.factions[factionId];
  region.owner = factionId;
  region.forces = { [factionId]: garrison };
  region.fortification = Math.max(0, region.fortification * 0.6);
  faction.conquests += 1;
  const policy = captivePolicyFor(faction);
  const harsh = previousOwner || policy.brutality > 0.6;
  if (harsh && region.population > 0) {
    const killed = Math.round(region.population * policy.kill * 0.3);
    region.population = Math.max(0, region.population - killed);
    region.unrest = clamp(region.unrest + policy.kill * 0.5 + policy.enslave * 0.25 - policy.release * 0.15, 0, 1);
    region.enslaved = Math.round(region.population * policy.enslave * 0.3);
    if (killed > 20) log(planet, `${faction.name} put ${killed} to the sword in ${region.name}.`, "atrocity", region.id);
  } else region.unrest = clamp(region.unrest - 0.1, 0, 1);
  region.supply = {};
}

// ---- Turn processing -------------------------------------------------------

function factionIncome(planet, factionId) {
  const faction = planet.factions[factionId];
  let income = 0;
  for (const region of ownedRegions(planet, factionId)) {
    const supply = region.supply[factionId] ?? 0.25;
    const resources = Object.values(region.resources).reduce((sum, value) => sum + value, 0);
    const labor = 1 + (region.enslaved || 0) / Math.max(30, region.population) * 0.5;
    income += (region.population * 0.04 + resources * 0.35) * (1 - region.unrest * 0.7) * supply * labor;
  }
  faction.income = income;
  return income;
}

function reinforce(planet, factionId) {
  const faction = planet.factions[factionId];
  const income = factionIncome(planet, factionId);
  faction.treasury += income * 0.4;
  const spend = Math.min(faction.treasury, 80);
  if (spend < 12) return;
  // New troops arrive at the capital and any spaceport; border regions get priority.
  const owned = ownedRegions(planet, factionId);
  const ports = owned.filter(region => region.spaceport || region.capitalOf === factionId);
  if (!ports.length) return;
  const share = spend / ports.length;
  for (const port of ports) port.forces[factionId] = regionStrength(port, factionId) + share * 0.9;
  faction.treasury -= spend;
  faction.fleet = clamp(faction.fleet + income * 0.01 - 0.15, 10, 200);
  // Rally: border regions pull reserves forward from rear regions.
  const isBorder = region => region.neighbors.some(id => planet.byId.get(id).owner !== factionId);
  const rear = owned.filter(region => !isBorder(region) && regionStrength(region, factionId) > 60);
  const border = owned.filter(isBorder);
  if (!border.length) return;
  for (const region of rear) {
    const surplus = Math.floor(regionStrength(region, factionId) * 0.35);
    const to = border.sort((a, b) => regionStrength(a, factionId) - regionStrength(b, factionId))[0];
    if (surplus >= 10) { region.forces[factionId] -= surplus; to.forces[factionId] = regionStrength(to, factionId) + surplus; }
  }
}

function decideAttacks(planet, factionId) {
  const faction = planet.factions[factionId];
  const owned = ownedRegions(planet, factionId).filter(region => regionStrength(region, factionId) >= 30);
  let launched = 0;
  const maxAttacks = 1 + Math.floor(faction.aggression * 2);
  const options = [];
  for (const from of owned) {
    const strength = regionStrength(from, factionId);
    for (const id of from.neighbors) {
      const target = planet.byId.get(id);
      if (target.owner === factionId) continue;
      const enemyForces = Object.entries(target.forces).filter(([f]) => f !== factionId).reduce((sum, [, v]) => sum + v, 0);
      const defense = enemyForces * defenseMultiplier(target) + 8;
      const ratio = strength * 0.6 * (from.supply[factionId] ?? 0.5) / defense;
      const need = faction.aggression < 0.45 ? 1.5 : faction.aggression < 0.75 ? 1.2 : 0.95;
      if (ratio < need) continue;
      options.push({ from, target, score: regionValue(target) * Math.min(3, ratio) + (target.capitalOf ? 120 : 0) - (target.owner && planet.factions[target.owner]?.eliminated ? 50 : 0) });
    }
  }
  options.sort((a, b) => b.score - a.score);
  const used = new Set();
  for (const option of options) {
    if (launched >= maxAttacks) break;
    if (used.has(option.from.id) || used.has(option.target.id)) continue;
    const share = clamp(0.5 + faction.aggression * 0.35, 0.5, 0.85);
    if (launchAttack(planet, factionId, option.from, option.target, share)) {
      used.add(option.from.id); used.add(option.target.id);
      launched += 1;
    }
  }
  return launched;
}

// An orbital landing: strike a region the faction does not border, at the
// cost of treasury and scatter losses. Needs a spaceport and fleet superiority.
function orbitalLanding(planet, factionId) {
  const faction = planet.factions[factionId];
  if (faction.treasury < 55 || faction.fleet < 55 || planet.random() > 0.2 * faction.aggression + 0.04) return false;
  const ports = ownedRegions(planet, factionId).filter(region => region.spaceport);
  if (!ports.length) return false;
  const borders = new Set(ownedRegions(planet, factionId).flatMap(region => region.neighbors));
  const targets = planet.regions.filter(region => region.owner !== factionId && !borders.has(region.id) && totalForces(region) < 70 && region.owner !== "");
  if (!targets.length) return false;
  const target = targets.sort((a, b) => regionValue(b) - regionValue(a))[0];
  const airDefense = ownedRegions(planet, target.owner).filter(region => region.spaceport).length * 0.1;
  const landed = Math.floor((40 + faction.treasury * 0.4) * clamp(1 - airDefense, 0.5, 1));
  faction.treasury -= 55;
  const source = ports[0];
  const result = launchAttackFromOrbit(planet, factionId, target, landed);
  log(planet, `${faction.name} dropped ${landed} troops from orbit onto ${target.name}${result ? ` — ${result.outcome}` : ""}.`, "landing", target.id);
  planet.moves.push({ at: planet.time, from: source.id, to: target.id, factionId, orbital: true });
  return true;
}

function launchAttackFromOrbit(planet, factionId, target, strength) {
  const faction = planet.factions[factionId];
  const enemy = Object.entries(target.forces).filter(([id, value]) => id !== factionId && value > 0);
  const defenderStrength = enemy.reduce((sum, [, value]) => sum + value, 0);
  const result = resolveBattle({ strength, multiplier: 0.8 * (1 + faction.fleet / 400) }, { strength: defenderStrength, multiplier: defenseMultiplier(target) }, planet.random);
  const keep = defenderStrength > 0 ? result.defenders / defenderStrength : 0;
  for (const [id] of enemy) target.forces[id] = Math.max(0, (target.forces[id] || 0) * keep);
  const previousOwner = target.owner;
  if (result.attackers > 0 && result.defenders <= 0) { conquer(planet, factionId, target, result.attackers, previousOwner); return { outcome: "conquest" }; }
  if (result.attackers > 0) { target.forces[factionId] = (target.forces[factionId] || 0) + result.attackers; return { outcome: "foothold" }; }
  return { outcome: "destroyed" };
}

// Rebels: a region with high unrest and a thin garrison rises up.
function processUnrest(planet) {
  for (const region of planet.regions) {
    const owner = region.owner;
    if (!owner || owner.startsWith("rebels:")) {
      region.unrest = clamp(region.unrest - 0.01, 0, 1);
      continue;
    }
    const garrison = regionStrength(region, owner);
    region.unrest = clamp(region.unrest + (garrison < region.population * 0.12 ? 0.012 : -0.015) + ((region.supply[owner] ?? 0.25) < 0.4 ? 0.01 : 0), 0, 1);
    if (region.unrest > 0.82 && garrison < region.population * 0.2 && !region.capitalOf) {
      const militia = Math.floor(region.population * 0.35);
      region.forces = { ["rebels:" + region.id]: militia };
      const former = planet.factions[owner];
      region.owner = "rebels:" + region.id;
      region.unrest = 0.4;
      region.population = Math.round(region.population * 0.9);
      log(planet, `${region.name} rose against ${former?.name || "its rulers"} and declared independence.`, "uprising", region.id);
    }
  }
}

function checkEliminationAndVictory(planet) {
  const totalPopulation = planet.regions.reduce((sum, region) => sum + region.population, 0) || 1;
  for (const faction of Object.values(planet.factions)) {
    if (faction.eliminated) continue;
    const regionsOwned = ownedRegions(planet, faction.id).length;
    const troops = factionStrength(planet, faction.id);
    if (regionsOwned === 0 && troops < 1) {
      faction.eliminated = true;
      log(planet, `${faction.name} has been eliminated from the planet.`, "elimination");
    }
  }
  const alive = Object.values(planet.factions).filter(faction => !faction.eliminated);
  if (alive.length <= 1 && Object.keys(planet.factions).length > 1) {
    planet.winner = alive[0]?.id || null;
    return;
  }
  for (const faction of alive) {
    const share = ownedRegions(planet, faction.id).reduce((sum, region) => sum + region.population, 0) / totalPopulation;
    if (share >= 0.66) { planet.winner = faction.id; log(planet, `${faction.name} dominates the planet.`, "victory"); return; }
  }
}

export function advancePlanet(planet, seconds = 2) {
  if (planet.winner) return planet;
  planet.time += seconds;
  planet.nextEventAt ??= 0;
  let turns = 0;
  while (planet.time >= planet.nextEventAt && turns < 12) {
    planet.nextEventAt += planet.turnSeconds;
    planet.turn += 1;
    turns += 1;
    updateSupply(planet);
    for (const faction of Object.values(planet.factions)) {
      if (faction.eliminated) continue;
      reinforce(planet, faction.id);
      decideAttacks(planet, faction.id);
      orbitalLanding(planet, faction.id);
    }
    // Population recovers slowly where it is safe.
    for (const region of planet.regions) {
      if (planet.time - region.lastBattleAt > 20) region.population = Math.min(region.maxPopulation, region.population + region.maxPopulation * 0.004);
      // Stalled forces left over from different factions keep fighting.
      const present = Object.entries(region.forces).filter(([, value]) => value > 1);
      if (present.length > 1) {
        const [first, second] = present.sort((a, b) => b[1] - a[1]);
        const result = resolveBattle({ strength: first[1], multiplier: 1 }, { strength: second[1], multiplier: defenseMultiplier(region) * (region.owner === second[0] ? 1 : 0.9) }, planet.random, 3);
        region.forces[first[0]] = result.attackers;
        region.forces[second[0]] = result.defenders;
        if (result.defenders <= 0 && region.owner !== first[0]) conquer(planet, first[0], region, result.attackers, region.owner);
      }
      for (const id of Object.keys(region.forces)) if (region.forces[id] < 0.5) delete region.forces[id];
    }
    processUnrest(planet);
    checkEliminationAndVictory(planet);
    if (planet.winner) break;
  }
  return planet;
}

// ---- Tactical bridge -------------------------------------------------------

// Everything the tactical layer needs to open a region as a battle.
export function tacticalSetupFor(planet, regionId, { maxSides = 4 } = {}) {
  const region = planet.byId.get(regionId);
  if (!region) return null;
  const sides = Object.entries(region.forces).filter(([id, value]) => value > 1 && planet.factions[id]).sort((a, b) => b[1] - a[1]).slice(0, maxSides);
  // Nothing garrisoned: the owner's militia defends against the nearest attacker.
  if (sides.length < 2) {
    const owner = region.owner;
    const neighbours = region.neighbors.map(id => planet.byId.get(id)).filter(neighbour => neighbour.owner && neighbour.owner !== owner && planet.factions[neighbour.owner]);
    const attacker = neighbours.sort((a, b) => regionStrength(b, b.owner) - regionStrength(a, a.owner))[0];
    const entries = new Map(sides);
    if (owner && planet.factions[owner] && !entries.has(owner)) entries.set(owner, Math.max(20, region.population * 0.2));
    if (attacker && !entries.has(attacker.owner)) entries.set(attacker.owner, Math.max(30, regionStrength(attacker, attacker.owner) * 0.5));
    sides.length = 0;
    sides.push(...entries.entries());
  }
  return {
    regionId,
    regionName: region.name,
    biome: region.biome,
    seedText: `${planet.seed}:${region.id}`,
    defender: region.owner,
    sides: sides.map(([factionId, strength]) => ({ factionId, strength, faction: planet.factions[factionId] }))
  };
}

// Apply a tactical outcome. `survivors` maps factionId -> fraction (0..1) of
// the committed force still standing.
export function applyTacticalResult(planet, regionId, { winnerId = null, survivors = {} } = {}) {
  const region = planet.byId.get(regionId);
  if (!region) return;
  for (const [factionId, fraction] of Object.entries(survivors)) {
    if (region.forces[factionId] != null) region.forces[factionId] = Math.max(0, region.forces[factionId] * clamp(fraction, 0, 1.2));
  }
  region.lastBattleAt = planet.time;
  if (winnerId && planet.factions[winnerId] && region.owner !== winnerId) {
    const previous = region.owner;
    for (const id of Object.keys(region.forces)) if (id !== winnerId) delete region.forces[id];
    region.forces[winnerId] = Math.max(8, region.forces[winnerId] || 0);
    conquer(planet, winnerId, region, region.forces[winnerId], previous);
    log(planet, `${planet.factions[winnerId].name} won the tactical battle for ${region.name}.`, "conquest", regionId);
  } else if (winnerId) log(planet, `${planet.factions[winnerId].name} held ${region.name} in the field.`, "battle", regionId);
  updateSupply(planet);
  checkEliminationAndVictory(planet);
}

export function planetSummary(planet) {
  const totalPop = planet.regions.reduce((sum, region) => sum + region.population, 0) || 1;
  return Object.values(planet.factions).map(faction => ({
    id: faction.id,
    name: faction.name,
    color: faction.color,
    regions: ownedRegions(planet, faction.id).length,
    troops: Math.round(factionStrength(planet, faction.id)),
    population: Math.round(ownedRegions(planet, faction.id).reduce((sum, region) => sum + region.population, 0)),
    populationShare: ownedRegions(planet, faction.id).reduce((sum, region) => sum + region.population, 0) / totalPop,
    treasury: Math.round(faction.treasury),
    income: Math.round(faction.income),
    fleet: Math.round(faction.fleet),
    eliminated: faction.eliminated,
    branch: populationBranchFor(faction)
  }));
}

// Equirectangular raster of the nearest region per pixel, used for drawing
// the planet map without per-frame geometry work.
export function buildRegionRaster(planet, width = 320, height = 160) {
  const raster = new Uint16Array(width * height);
  const points = planet.regions.map(region => ({ lat: region.lat, lon: region.lon, sinLat: Math.sin(region.lat), cosLat: Math.cos(region.lat) }));
  for (let py = 0; py < height; py += 1) {
    const lat = (0.5 - (py + 0.5) / height) * Math.PI;
    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    for (let px = 0; px < width; px += 1) {
      const lon = ((px + 0.5) / width) * TAU - Math.PI;
      let best = 0;
      let bestDot = -2;
      for (let n = 0; n < points.length; n += 1) {
        const point = points[n];
        const dot = sinLat * point.sinLat + cosLat * point.cosLat * Math.cos(lon - point.lon);
        if (dot > bestDot) { bestDot = dot; best = n; }
      }
      raster[py * width + px] = best;
    }
  }
  return raster;
}

export const PLANET_BIOME_INFO = BIOMES;
export { DEG };
