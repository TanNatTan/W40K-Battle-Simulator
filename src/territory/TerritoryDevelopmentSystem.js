export function territoryDevelopmentOrderForCapture({ playerId = "", cellKey = "", captureCount = 0, now = 0, decision = null } = {}) {
  if (!playerId || !cellKey || !decision?.buildingType || decision.category === "none") return null;
  return Object.freeze({
    id: `territory-development:${playerId}:${captureCount}:${cellKey}:${decision.buildingType}`,
    playerId,
    cellKey,
    buildingType: decision.buildingType,
    category: decision.category,
    reason: decision.reason,
    priority: decision.priority || 70,
    captureCount,
    status: "planned",
    createdAt: Number(now) || 0,
    structureId: null,
    completedAt: null
  });
}

export function recordTerritoryDevelopment(player = {}, cellKey = "", now = 0, decision = null) {
  player.territoryCaptureCount = Math.max(0, Math.floor(Number(player.territoryCaptureCount) || 0)) + 1;
  player.territoryDevelopmentOrders ||= [];
  player.territoryDevelopmentHistory ||= [];
  const opportunity = Object.freeze({
    cellKey,
    captureCount: player.territoryCaptureCount,
    category: decision?.category || "none",
    buildingType: decision?.buildingType || null,
    reason: decision?.reason || "No development requested",
    scores: decision?.scores ? { ...decision.scores } : {},
    evaluatedAt: Number(now) || 0
  });
  player.territoryDevelopmentHistory.push(opportunity);
  if (player.territoryDevelopmentHistory.length > 96) player.territoryDevelopmentHistory.splice(0, player.territoryDevelopmentHistory.length - 96);
  const order = territoryDevelopmentOrderForCapture({
    playerId: player.id,
    cellKey,
    captureCount: player.territoryCaptureCount,
    now,
    decision
  });
  if (order && !player.territoryDevelopmentOrders.some(existing => existing.id === order.id)) player.territoryDevelopmentOrders.push({ ...order });
  return Object.freeze({ captureCount: player.territoryCaptureCount, opportunity, order });
}

export function pendingTerritoryDevelopmentOrder(player = {}, structures = []) {
  for (const order of player.territoryDevelopmentOrders || []) {
    if (order.status === "complete" || order.status === "abandoned") continue;
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
