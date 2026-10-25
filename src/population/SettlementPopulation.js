// Headcount model for NPC settlements.
//
// Civilians are simulated as numbers, not individual entities. Real units only
// appear on events: recruited levies, an uprising's militia. That keeps a
// 3,000-person hive city as cheap as a hamlet while still letting a battle
// change who lives, who is enslaved and who takes up arms.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const UNREST_STATES = Object.freeze(["calm", "restless", "insurgent", "independent"]);

const POPULATION_BY_TYPE = Object.freeze({
  "civilian-settlement": [70, 190],
  "hive-city": [520, 980],
  "agri-complex": [90, 220],
  "mining-colony": [120, 260],
  "space-port": [180, 380],
  "manufactorum": [160, 340],
  "fuel-refinery": [70, 160],
  "mechanicus-enclave": [60, 140],
  "orbital-elevator": [150, 300]
});

export function isSettlementNode(node) {
  if (!node || node.active === false) return false;
  return Object.hasOwn(POPULATION_BY_TYPE, node.type) || (node.tags || []).includes("population-center") || (node.tags || []).includes("civilian");
}

export function createPopulation(node, random = Math.random) {
  const [low, high] = POPULATION_BY_TYPE[node?.type] || [60, 160];
  const count = Math.round(low + (high - low) * random());
  return {
    count,
    max: Math.round(count * 1.35),
    enslaved: 0,
    levy: 0,
    militia: 0,
    militiaIds: [],
    fear: 0,
    grievance: 8 + random() * 10,
    loyalty: {},
    unrest: "calm",
    unrestSince: 0,
    independentId: null,
    protectorId: null,
    killed: 0,
    recruited: 0,
    enslavedTotal: 0,
    released: 0,
    casualtyCarry: 0,
    holdSeconds: 0,
    nextMilitiaAt: 0,
    nextLevyAt: 0,
    history: []
  };
}

// Captive policy: weights over {recruit, enslave, kill, release}. These are
// the doctrinal defaults per faction branch; brutality shifts weight from
// release/recruit toward kill/enslave.
export const CAPTIVE_POLICIES = Object.freeze({
  space_marines: { recruit: 0.30, enslave: 0.00, kill: 0.04, release: 0.66, brutality: 0.05 },
  imperial_guard: { recruit: 0.46, enslave: 0.04, kill: 0.06, release: 0.44, brutality: 0.2 },
  adeptus_mechanicus: { recruit: 0.18, enslave: 0.52, kill: 0.08, release: 0.22, brutality: 0.45 },
  chaos: { recruit: 0.28, enslave: 0.30, kill: 0.38, release: 0.04, brutality: 0.9 },
  orks: { recruit: 0.50, enslave: 0.28, kill: 0.20, release: 0.02, brutality: 0.7 },
  necrons: { recruit: 0.08, enslave: 0.47, kill: 0.38, release: 0.07, brutality: 0.8 },
  tau: { recruit: 0.34, enslave: 0.00, kill: 0.04, release: 0.62, brutality: 0.05 },
  tyranids: { recruit: 0.00, enslave: 0.00, kill: 0.96, release: 0.04, brutality: 1 }
});

const normalize = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function populationBranchFor(player = {}) {
  const race = normalize(player.race);
  const faction = normalize(player.faction);
  if (faction.includes("space_marines")) return "space_marines";
  if (faction.includes("machine_cult") || faction.includes("mechanicus")) return "adeptus_mechanicus";
  if (faction.includes("imperial_guard")) return "imperial_guard";
  if (race.includes("chaos")) return "chaos";
  if (race.includes("ork")) return "orks";
  if (race.includes("necron")) return "necrons";
  if (race.includes("tau") || race.includes("t_au")) return "tau";
  if (race.includes("tyranid")) return "tyranids";
  return "imperial_guard";
}

export function captivePolicyFor(player = {}) {
  return CAPTIVE_POLICIES[populationBranchFor(player)] || CAPTIVE_POLICIES.imperial_guard;
}

// Splits `count` captives into integer fates using largest-remainder so the
// total always matches. `stress` (0..1, e.g. a starving or embattled
// conqueror) pushes mercy toward violence.
export function allocateCaptives(count, policy, { stress = 0, random = Math.random } = {}) {
  const total = Math.max(0, Math.floor(count));
  const weights = { ...policy };
  const shift = clamp(stress, 0, 1) * (policy.brutality ?? 0.3) * 0.4;
  const mercy = Math.min(weights.release, shift);
  weights.release -= mercy;
  weights.kill += mercy * 0.6;
  weights.enslave += mercy * 0.4;
  const keys = ["recruit", "enslave", "kill", "release"];
  const sum = keys.reduce((acc, key) => acc + Math.max(0, weights[key] || 0), 0) || 1;
  const raw = keys.map(key => (Math.max(0, weights[key] || 0) / sum) * total);
  const result = Object.fromEntries(keys.map((key, index) => [key, Math.floor(raw[index])]));
  let remaining = total - keys.reduce((acc, key) => acc + result[key], 0);
  const order = keys.map((key, index) => ({ key, frac: raw[index] - Math.floor(raw[index]) + random() * 1e-6 })).sort((a, b) => b.frac - a.frac);
  for (let n = 0; remaining > 0; n = (n + 1) % order.length) { result[order[n].key] += 1; remaining -= 1; }
  return result;
}

// What happens to the civilians when a faction takes the settlement. A share
// of the population ends up captive; the rest keeps living under the new
// owner. Returns the fate allocation and the grievance/fear shock.
export function resolveCapture(population, conquerorPolicy, { random = Math.random, stress = 0, resistance = 0 } = {}) {
  const captiveShare = clamp(0.28 + resistance * 0.35, 0.2, 0.7);
  const captives = Math.min(population.count, Math.max(0, Math.round(population.count * captiveShare)));
  const fates = allocateCaptives(captives, conquerorPolicy, { stress, random });
  const total = Math.max(1, population.count);
  const killedShare = fates.kill / total;
  const enslavedShare = fates.enslave / total;
  population.count = Math.max(0, population.count - fates.kill - fates.recruit);
  population.enslaved = Math.min(population.count, population.enslaved + fates.enslave);
  population.levy += fates.recruit;
  population.killed += fates.kill;
  population.recruited += fates.recruit;
  population.enslavedTotal += fates.enslave;
  population.released += fates.release;
  const brutality = conquerorPolicy.brutality ?? 0.3;
  population.fear = clamp(population.fear + killedShare * 160 + enslavedShare * 70 + brutality * 20, 0, 100);
  population.grievance = clamp(population.grievance + killedShare * 120 + enslavedShare * 55 + fates.recruit / total * 10 - fates.release / total * 18, 0, 100);
  return { fates, captives, killedShare, enslavedShare };
}

// Grievance contributed by civilians caught in a firefight.
export function applyCollateral(population, intensity, dt, random = Math.random) {
  if (intensity <= 0 || population.count <= 0) return 0;
  population.casualtyCarry += population.count * clamp(intensity, 0, 1) * 0.006 * dt;
  let dead = Math.floor(population.casualtyCarry);
  population.casualtyCarry -= dead;
  if (dead > 0 && random() < 0.35) dead += 1;
  dead = Math.min(dead, population.count);
  if (dead > 0) {
    population.count -= dead;
    population.killed += dead;
    population.grievance = clamp(population.grievance + dead / Math.max(10, population.count + dead) * 45, 0, 100);
    population.fear = clamp(population.fear + dead / Math.max(10, population.count + dead) * 25, 0, 100);
  }
  return dead;
}

// Advances the social model by dt seconds. `context` carries what the
// battlefield says about this settlement right now. Returns a list of
// transition events for the caller to act on (spawn militia, declare
// independence, log incidents).
export function stepSettlement(population, node, context, dt, now = 0) {
  const events = [];
  const {
    ownerId = "", ownerPresence = 0, hostilePresence = 0, fed = 1, combatIntensity = 0, protectorId = null, protectorPresence = 0
  } = context;
  const enslavedShare = population.count > 0 ? population.enslaved / population.count : 0;
  const protectedNow = ownerPresence >= 2 && hostilePresence === 0;

  let grievanceRate = -0.045;
  if (protectedNow) grievanceRate -= 0.07;
  if (fed < 0.4) grievanceRate += 0.08;
  grievanceRate += enslavedShare * 0.14;
  if (ownerId && ownerPresence === 0) grievanceRate += 0.03;
  if (combatIntensity > 0) grievanceRate += combatIntensity * 0.12;
  population.grievance = clamp(population.grievance + grievanceRate * dt, 0, 100);
  population.fear = clamp(population.fear - (protectedNow ? 0.9 : 0.35) * dt, 0, 100);

  if (ownerId) {
    const target = clamp(48 - population.grievance * 0.95 + (protectedNow ? 18 : 0) - population.fear * 0.15, -100, 100);
    const current = population.loyalty[ownerId] ?? 20;
    population.loyalty[ownerId] = current + clamp(target - current, -0.7 * dt, 0.7 * dt);
  }
  if (protectorId) {
    const current = population.loyalty[protectorId] ?? 0;
    const target = clamp(30 + protectorPresence * 4 - population.fear * 0.1, -100, 100);
    population.loyalty[protectorId] = current + clamp(target - current, -0.6 * dt, 0.6 * dt);
  }

  // Growth when peaceful and fed, decline when starving.
  if (combatIntensity === 0 && population.count > 0) {
    const growth = (fed >= 0.5 ? 0.0006 : -0.0009) * population.max * dt;
    population.count = clamp(population.count + growth, 0, population.max);
  }

  const previous = population.unrest;
  let next = previous;
  if (previous === "calm" && population.grievance >= 38) next = "restless";
  else if (previous === "restless") {
    if (population.grievance < 28) next = "calm";
    else if (population.grievance >= 62 && population.fear < 55) next = "insurgent";
  } else if (previous === "insurgent") {
    if (population.grievance < 40 && population.militia <= 0) next = "restless";
    population.holdSeconds = ownerPresence <= 1 ? population.holdSeconds + dt : Math.max(0, population.holdSeconds - dt * 2);
    if (population.holdSeconds >= 22 && population.militia >= 3 && population.count >= 30) next = "independent";
  } else if (previous === "independent") {
    // Reconquest: sustained hostile presence with the militia broken.
    population.holdSeconds = hostilePresence >= 4 && population.militia <= 1 ? population.holdSeconds + dt : Math.max(0, population.holdSeconds - dt);
    if (population.holdSeconds >= 30) next = "restless";
  }
  if (next !== previous) {
    population.unrest = next;
    population.unrestSince = now;
    population.holdSeconds = 0;
    events.push({ type: "unrest", from: previous, to: next });
  }
  return events;
}

export function militiaCapFor(population) {
  return Math.max(0, Math.floor(population.count / 14));
}

// Production multiplier a settlement contributes to its owner.
export function unrestOutputMultiplier(population) {
  if (!population) return 1;
  if (population.unrest === "independent") return 0;
  if (population.unrest === "insurgent") return 0.25;
  if (population.unrest === "restless") return 0.65;
  return 1;
}

// Passive income of enslaved labour per second for a faction branch.
export function enslavedLaborIncome(population, branch) {
  const workers = population?.enslaved || 0;
  const rate = workers * 0.014;
  if (branch === "orks") return { scrap: rate };
  if (branch === "adeptus_mechanicus") return { parts: rate * 0.7, materials: rate * 0.4 };
  if (branch === "necrons") return { materials: rate * 1.1 };
  if (branch === "chaos") return { materials: rate * 0.8, influence: rate * 0.25 };
  return { materials: rate };
}

// Factions gain something from killing: tyranids digest, chaos sacrifices.
export function massacreSpoils(killed, branch) {
  if (branch === "tyranids") return { biomass: killed * 0.7 };
  if (branch === "chaos") return { influence: killed * 0.35 };
  if (branch === "orks") return { scrap: killed * 0.25 };
  return {};
}

// Which team an emergent faction allies with: the faction it trusts most,
// provided that trust is genuinely high. Otherwise it stands alone.
export function chooseAllianceTarget(population, minimum = 35) {
  let best = null;
  for (const [factionId, value] of Object.entries(population.loyalty)) {
    if (value >= minimum && (!best || value > best.value)) best = { factionId, value };
  }
  return best?.factionId || null;
}

export function recordHistory(population, now, text) {
  population.history.push({ at: Math.round(now), text });
  if (population.history.length > 8) population.history.shift();
}
