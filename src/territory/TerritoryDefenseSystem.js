export const TERRITORY_DEFENSE_INTERVAL = 5;

export function defensePackageForMilestone(milestone = 1) {
  const packageTypes = ["bunker", "turret"];
  if (milestone % 2 === 0) packageTypes.unshift("observationtower");
  return Object.freeze(packageTypes);
}

export function territoryDefenseOrdersForCapture({ playerId = "", cellKey = "", captureCount = 0, now = 0 } = {}) {
  const count = Math.max(0, Math.floor(Number(captureCount) || 0));
  if (!playerId || !cellKey || count === 0 || count % TERRITORY_DEFENSE_INTERVAL !== 0) return [];
  const milestone = count / TERRITORY_DEFENSE_INTERVAL;
  return defensePackageForMilestone(milestone).map((buildingType, index) => Object.freeze({
    id: `territory-defense:${playerId}:${count}:${index}:${buildingType}`,
    playerId,
    cellKey,
    buildingType,
    captureCount: count,
    milestone,
    status: "planned",
    createdAt: Number(now) || 0,
    structureId: null,
    completedAt: null
  }));
}

export function recordTerritoryCapture(player = {}, cellKey = "", now = 0) {
  player.territoryCaptureCount = Math.max(0, Math.floor(Number(player.territoryCaptureCount) || 0)) + 1;
  player.territoryDefenseOrders ||= [];
  const orders = territoryDefenseOrdersForCapture({
    playerId: player.id,
    cellKey,
    captureCount: player.territoryCaptureCount,
    now
  });
  const existing = new Set(player.territoryDefenseOrders.map(order => order.id));
  for (const order of orders) if (!existing.has(order.id)) player.territoryDefenseOrders.push({ ...order });
  return Object.freeze({ captureCount: player.territoryCaptureCount, orders });
}

export function pendingTerritoryDefenseOrder(player = {}, structures = []) {
  for (const order of player.territoryDefenseOrders || []) {
    if (order.status === "complete") continue;
    const structure = order.structureId ? structures.find(candidate => candidate.id === order.structureId && candidate.alive !== false) : null;
    if (structure?.progress >= 1) {
      order.status = "complete";
      order.completedAt = structure.completedAt ?? null;
      continue;
    }
    if (structure) {
      order.status = "construction";
      continue;
    }
    order.structureId = null;
    order.status = "planned";
    return order;
  }
  return null;
}
