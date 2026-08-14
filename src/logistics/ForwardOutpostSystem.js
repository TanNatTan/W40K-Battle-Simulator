const distance = (a = {}, b = {}) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));

export const FORWARD_OUTPOST_TYPE = "forwardoutpost";
export const FORWARD_OUTPOST_STOCK_TARGETS = Object.freeze({ ammunition: 80, medical: 30, parts: 40, fuel: 55, food: 45 });

export function forwardOutpostStockRatio(outpost = {}) {
  const inventory = outpost.inventory || {};
  const ratios = Object.entries(FORWARD_OUTPOST_STOCK_TARGETS).map(([resource, target]) => Math.min(1, (Number(inventory[resource]) || 0) / target));
  return ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
}

export function selectForwardResupplyPoint({ unit = {}, structures = [], headquarters = null, areAllies = (a, b) => a === b, isSafe = () => true } = {}) {
  const candidates = structures.filter(structure => structure.type === FORWARD_OUTPOST_TYPE && structure.progress >= 1 && structure.alive !== false
    && areAllies(structure.faction, unit.faction) && isSafe(structure) && forwardOutpostStockRatio(structure) >= 0.08)
    .map(structure => ({ structure, distance: distance(unit, structure), stock: forwardOutpostStockRatio(structure) }))
    .sort((a, b) => a.distance - b.distance || b.stock - a.stock);
  const selected = candidates[0]?.structure || headquarters;
  if (!selected) return null;
  if (headquarters && selected !== headquarters && distance(unit, selected) >= distance(unit, headquarters) * 0.92) return headquarters;
  return selected;
}

export function forwardOutpostRestockManifest(outpost = {}) {
  const inventory = outpost.inventory || {};
  return Object.freeze(Object.fromEntries(Object.entries(FORWARD_OUTPOST_STOCK_TARGETS)
    .map(([resource, target]) => [resource, Math.max(0, target - (Number(inventory[resource]) || 0))])
    .filter(([, amount]) => amount >= 4)));
}

export function shouldBuildForwardOutpost({ frontlineDistance = 0, nearestOutpostDistance = Infinity, threat = 0, territorySafe = true } = {}) {
  return Boolean(territorySafe && Number(frontlineDistance) >= 300 && Number(nearestOutpostDistance) >= 240 && Number(threat) <= 0.72);
}

