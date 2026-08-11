export const TERRITORY_BUILD_CAPS = Object.freeze({
  "military-production": 5,
  production: 8,
  defense: Infinity,
  hq: Infinity
});

export const BUILDING_CAPACITY_CLASSES = Object.freeze([
  "hq",
  "military-production",
  "production",
  "defense"
]);

export function buildingCapacityClass(type = "", spec = {}) {
  const capacityClass = spec.capacityClass;
  if (BUILDING_CAPACITY_CLASSES.includes(capacityClass)) return capacityClass;
  throw new Error(`Building ${type || "unknown"} is missing an explicit capacityClass.`);
}

export function countBuildingsByCapacityClass({ structures = [], faction, cellKey, cellKeyFor, specFor } = {}) {
  const counts = Object.fromEntries(BUILDING_CAPACITY_CLASSES.map(category => [category, 0]));
  for (const structure of structures) {
    if (structure.alive === false || structure.faction !== faction || cellKeyFor(structure) !== cellKey) continue;
    counts[buildingCapacityClass(structure.type, specFor(structure.type))] += 1;
  }
  return counts;
}

export function territoryCapacityAvailable({ category, counts = {}, caps = TERRITORY_BUILD_CAPS } = {}) {
  const cap = caps[category];
  return !Number.isFinite(cap) || (Number(counts[category]) || 0) < cap;
}

export function constructionCapacityForCell({ type, spec, structures, faction, cellKey, cellKeyFor, specFor } = {}) {
  const category = buildingCapacityClass(type, spec);
  const counts = countBuildingsByCapacityClass({ structures, faction, cellKey, cellKeyFor, specFor });
  return Object.freeze({
    category,
    cap: TERRITORY_BUILD_CAPS[category],
    count: counts[category],
    counts: Object.freeze(counts),
    available: territoryCapacityAvailable({ category, counts })
  });
}
