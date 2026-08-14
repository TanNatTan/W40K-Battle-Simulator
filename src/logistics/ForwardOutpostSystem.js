const distance = (a = {}, b = {}) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));

export const FORWARD_OUTPOST_TYPE = "forwardoutpost";
export const FORWARD_OUTPOST_LIMIT = 4;
export const FORWARD_OUTPOST_MINIMUM_SPACING = 220;
export const FORWARD_OUTPOST_INTEL_CONFIDENCE = 0.55;
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

export function predictForwardOutpostPosition({ base = {}, enemy = {}, existingOutposts = [], bounds = null } = {}) {
  const dx = (Number(enemy.x) || 0) - (Number(base.x) || 0);
  const dy = (Number(enemy.y) || 0) - (Number(base.y) || 0);
  const length = Math.hypot(dx, dy) || 1;
  const progress = Math.min(0.72, Math.max(0.34, 0.42 + existingOutposts.length * 0.08));
  const point = { x: (Number(base.x) || 0) + dx * progress, y: (Number(base.y) || 0) + dy * progress };
  if (bounds) {
    point.x = Math.max(bounds.left ?? 0, Math.min(bounds.right ?? point.x, point.x));
    point.y = Math.max(bounds.top ?? 0, Math.min(bounds.bottom ?? point.y, point.y));
  }
  const nearest = existingOutposts.reduce((best, outpost) => Math.min(best, distance(point, outpost)), Infinity);
  if (nearest < FORWARD_OUTPOST_MINIMUM_SPACING) {
    const offset = FORWARD_OUTPOST_MINIMUM_SPACING - nearest + 24;
    point.x += -dy / length * offset * (existingOutposts.length % 2 ? -1 : 1);
    point.y += dx / length * offset * (existingOutposts.length % 2 ? -1 : 1);
  }
  return Object.freeze(point);
}

export function shouldBuildForwardOutpost({ frontlineDistance = 0, nearestOutpostDistance = Infinity, threat = 0, territorySafe = true,
  enemyBaseConfidence = 1, outpostCount = 0 } = {}) {
  return Boolean(territorySafe && Number(outpostCount) < FORWARD_OUTPOST_LIMIT
    && Number(enemyBaseConfidence) >= FORWARD_OUTPOST_INTEL_CONFIDENCE
    && Number(frontlineDistance) >= 300 && Number(nearestOutpostDistance) >= FORWARD_OUTPOST_MINIMUM_SPACING && Number(threat) <= 0.72);
}
