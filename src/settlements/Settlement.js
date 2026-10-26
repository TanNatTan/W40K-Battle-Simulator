// Data model and small helpers for autonomous settlements. Everything here is
// plain data (JSON-serialisable) plus pure helper functions; behaviour lives in
// CitizenBrain / SettlementPlanner / Aftermath.

export const DAY = 60; // simulated seconds in a settlement's day
export const ADULT_AGE = 16;
export const ELDER_AGE = 62;
export const FOOD_PER_DAY = 1; // food one citizen eats per day

export const ROLES = Object.freeze(["farmer", "miner", "builder", "militia", "child", "elder", "refugee", "captive", "enslaved"]);

export const BUILDING_TYPES = Object.freeze({
  house: { label: "House", cost: { materials: 10 }, work: 18, hp: 140, size: 15, beds: 6 },
  granary: { label: "Granary", cost: { materials: 16 }, work: 26, hp: 200, size: 19, capacity: 900 },
  watchtower: { label: "Watchtower", cost: { materials: 18 }, work: 30, hp: 220, size: 11, sight: 260 },
  barricade: { label: "Barricade", cost: { materials: 5 }, work: 8, hp: 170, size: 13, cover: 0.4 },
  palisade: { label: "Palisade", cost: { materials: 9 }, work: 14, hp: 260, size: 15, cover: 0.45 },
  mineworks: { label: "Mine works", cost: { materials: 14 }, work: 22, hp: 180, size: 13, supports: 0.5 },
  hall: { label: "Town hall", cost: { materials: 0 }, work: 1, hp: 320, size: 22, beds: 2 }
});

export const DEFAULT_DOCTRINE = Object.freeze({
  militiaShare: 0.08,   // fraction of adults under arms in peacetime
  reserveDays: 14,      // food reserve the planner tries to keep
  stashShare: 0.0,      // fraction of stores quietly hidden away
  wallPriority: 0.2,
  trenchPriority: 0.1,
  towerTarget: 1,
  scoutRadius: 220,
  tributeWillingness: 0.2,
  evacuateBias: 0.3
});

export function emptyStorage() { return { food: 0, seed: 0, materials: 0, fuel: 0, tools: 0 }; }

export function createSettlement({ id, name, x, y, owner = null, culture = "frontier", radius = 120, nodeId = null, ideology = "pragmatic" }) {
  return {
    id, name, x, y, radius, owner, culture, ideology, nodeId,
    status: "thriving",
    storage: emptyStorage(),
    hidden: emptyStorage(),
    buildings: [],
    fields: [],
    mine: null,
    projects: [],
    agentIds: [],
    doctrine: { ...DEFAULT_DOCTRINE },
    memory: { attacks: 0, raids: [], lost: 0, burned: 0, seized: 0, famines: 0, lastAttack: null, occupiedBy: [], lessons: [] },
    posture: "calm",
    alert: 0,
    targets: { farmer: 0, miner: 0, builder: 0, militia: 0 },
    relations: {},
    pacts: {},
    lod: "full",
    nextThinkAt: 0,
    nextTitheAt: 0,
    lastDelivery: 0,
    routeIntegrity: 1,
    leaderId: null,
    founded: 0,
    stats: { born: 0, died: 0, starved: 0, harvested: 0, mined: 0, built: 0, trenchMeters: 0, killedByEnemy: 0, enemyKilled: 0, seizedFood: 0, taxed: 0 },
    occupation: { by: null, since: 0, hold: 0 }
  };
}

export function storageCapacity(settlement) {
  let capacity = 120; // open-air stores
  for (const building of settlement.buildings) {
    if (building.operational && building.hp > 0 && building.type === "granary") capacity += BUILDING_TYPES.granary.capacity;
    if (building.operational && building.hp > 0 && building.type === "hall") capacity += 160;
  }
  return capacity;
}

export function bedCapacity(settlement) {
  let beds = 0;
  for (const building of settlement.buildings) {
    if (building.operational && building.hp > 0) beds += BUILDING_TYPES[building.type]?.beds || 0;
  }
  return beds;
}

export function operationalBuildings(settlement, type) {
  return settlement.buildings.filter(building => building.type === type && building.operational && building.hp > 0);
}

export function totalStored(settlement, resource) {
  return (settlement.storage[resource] || 0) + (settlement.hidden[resource] || 0);
}

export function canAfford(settlement, cost) {
  return Object.entries(cost).every(([resource, amount]) => (settlement.storage[resource] || 0) >= amount);
}

export function spend(settlement, cost) {
  for (const [resource, amount] of Object.entries(cost)) settlement.storage[resource] = Math.max(0, (settlement.storage[resource] || 0) - amount);
}

export function isAdult(agent) { return agent.age >= ADULT_AGE; }
export function isArmedRole(agent) { return agent.role === "militia"; }

export function bearing(from, to) { return Math.atan2(to.y - from.y, to.x - from.x); }
export function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
