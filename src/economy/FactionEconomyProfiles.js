export const EXTRACTABLE_RESOURCES = Object.freeze(["materials", "fuel", "energy", "food", "scrap", "biomass"]);
export const STRATEGIC_RESOURCES = Object.freeze(["requisition", "influence"]);
export const OPERATIONAL_STOCKS = Object.freeze(["ammunition", "medical", "parts"]);

const profile = (id, activeResources, zoneResources, startingStockpile, resourcePriorities = {}) => Object.freeze({
  id,
  activeResources: Object.freeze(activeResources),
  zoneResources: Object.freeze(zoneResources),
  startingStockpile: Object.freeze(startingStockpile),
  resourcePriorities: Object.freeze(Object.fromEntries(activeResources.map(resource => [resource, Math.max(0.1, Number(resourcePriorities[resource]) || 1)]))),
  baseCapacity: Object.freeze(Object.fromEntries(Object.entries(startingStockpile).map(([key, value]) => [key, Math.ceil(value * 1.45)])))
});

export const FACTION_ECONOMY_PROFILES = Object.freeze({
  "Space Marines": profile("space-marines", ["requisition", "materials", "fuel", "energy", "influence", "parts", "ammunition", "medical", "food"], ["materials", "fuel", "energy", "food"], { requisition: 1100, materials: 750, fuel: 520, energy: 580, influence: 320, parts: 420, ammunition: 900, medical: 280, food: 260 }, { food: 1.3, fuel: 1.15, materials: 1.1 }),
  "Imperial Guard": profile("imperial-guard", ["requisition", "materials", "fuel", "energy", "food", "parts", "ammunition", "medical"], ["materials", "fuel", "energy", "food"], { requisition: 1600, materials: 1100, fuel: 1000, energy: 700, food: 1300, parts: 650, ammunition: 1900, medical: 700 }, { food: 1.45, fuel: 1.3, ammunition: 1.2 }),
  Orks: profile("orks", ["scrap", "fuel", "food", "ammunition"], ["scrap", "fuel", "food"], { scrap: 1600, fuel: 850, food: 750, ammunition: 1200 }, { scrap: 2, food: 1.35, fuel: 1.15 }),
  Tyranids: profile("tyranids", ["biomass", "food"], ["biomass", "food"], { biomass: 2400, food: 420 }, { biomass: 2.1, food: 1.25 }),
  Necrons: profile("necrons", ["energy", "materials", "food"], ["energy", "materials", "food"], { energy: 1800, materials: 900, food: 260 }, { energy: 1.8, materials: 1.25, food: 1.1 }),
  "T'au": profile("tau", ["requisition", "materials", "fuel", "energy", "influence", "parts", "ammunition", "medical", "food"], ["materials", "fuel", "energy", "food"], { requisition: 1300, materials: 1000, fuel: 750, energy: 1200, influence: 350, parts: 800, ammunition: 1300, medical: 380, food: 520 }, { food: 1.3, energy: 1.2, fuel: 1.15 }),
  Chaos: profile("chaos", ["requisition", "materials", "fuel", "energy", "parts", "ammunition", "food"], ["materials", "fuel", "energy", "food"], { requisition: 1100, materials: 800, fuel: 600, energy: 700, parts: 450, ammunition: 1100, food: 420 }, { food: 1.3, fuel: 1.2, materials: 1.1 })
});

export function economyProfileKey(player = {}) {
  if (player.faction === "Space Marines") return "Space Marines";
  if (player.faction === "Imperial Guard") return "Imperial Guard";
  if (player.race === "T'au" || player.race === "Tau") return "T'au";
  if (FACTION_ECONOMY_PROFILES[player.race]) return player.race;
  if (FACTION_ECONOMY_PROFILES[player.faction]) return player.faction;
  return "Space Marines";
}

export function economyProfileFor(player) {
  return FACTION_ECONOMY_PROFILES[economyProfileKey(player)];
}

export function formationCostFor(player, manifest = []) {
  const members = manifest.length;
  const vehicles = manifest.filter(unit => unit.role === "vehicle").length;
  const elites = manifest.filter(unit => ["standard", "commander"].includes(unit.role)).length;
  const key = economyProfileKey(player);
  if (key === "Tyranids") return { biomass: members * 7 + elites * 12 + vehicles * 35 };
  if (key === "Orks") return { scrap: members * 4 + vehicles * 30, ...(vehicles ? { fuel: vehicles * 14 } : {}) };
  if (key === "Space Marines") return { requisition: members * 12, materials: members * 4 + vehicles * 24, influence: elites * 10, ...(vehicles ? { parts: vehicles * 18 } : {}) };
  if (key === "Imperial Guard") return { requisition: members * 5, food: members * 2, ...(vehicles ? { materials: vehicles * 20, fuel: vehicles * 15 } : {}) };
  if (key === "Necrons") return { energy: members * 8 + vehicles * 30, materials: elites * 8 + vehicles * 15 };
  if (key === "T'au") return { requisition: members * 7, materials: members * 3 + vehicles * 20, energy: elites * 6 + vehicles * 15, ...(vehicles ? { parts: vehicles * 12 } : {}) };
  return { requisition: members * 7, materials: members * 3 };
}

export function constructionCostFor(player, baseCost = 0) {
  const cost = Math.max(1, Math.ceil(Number(baseCost) || 0));
  const key = economyProfileKey(player);
  if (key === "Tyranids") return { biomass: Math.ceil(cost * 1.35) };
  if (key === "Orks") return { scrap: cost, ...(cost >= 45 ? { fuel: Math.ceil(cost * 0.18) } : {}) };
  if (key === "Necrons") return { energy: cost, materials: Math.ceil(cost * 0.45) };
  return { requisition: cost, materials: Math.ceil(cost * 0.55) };
}

export function canAfford(inventory = {}, cost = {}) {
  return Object.entries(cost).every(([resource, amount]) => (inventory[resource] || 0) >= amount);
}
