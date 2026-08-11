export const ECONOMY_SECURITY_TUNING = Object.freeze({
  baseThreatLimit: 0.2,
  defenseRatio: 1.25,
  guardCoverage: 0.7,
  normalReserve: 0.35,
  aggressiveReserve: 0.2,
  safeStableSeconds: 8,
  unsafeRecallSeconds: 3
});

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export function assessEconomySecurity(snapshot = {}, tuning = ECONOMY_SECURITY_TUNING) {
  const baseThreat = clamp01(snapshot.baseThreat);
  const defenseRatio = Math.max(0, Number(snapshot.defenseRatio) || 0);
  const guardCoverage = clamp01(snapshot.guardCoverage);
  const routeRisk = clamp01(snapshot.routeRisk);
  const hqEmergency = Boolean(snapshot.hqEmergency || snapshot.recentCriticalLoss);
  const safe = !hqEmergency
    && baseThreat <= tuning.baseThreatLimit
    && defenseRatio >= tuning.defenseRatio
    && guardCoverage >= tuning.guardCoverage;
  return Object.freeze({
    ...snapshot,
    baseThreat,
    defenseRatio,
    guardCoverage,
    routeRisk,
    hqEmergency,
    safe,
    score: clamp01((1 - baseThreat) * 0.35 + Math.min(1, defenseRatio / tuning.defenseRatio) * 0.3 + guardCoverage * 0.25 + (1 - routeRisk) * 0.1)
  });
}

export function updateEconomySecurityMemory(memory = {}, assessment, dt, tuning = ECONOMY_SECURITY_TUNING) {
  memory.safeFor = assessment.safe ? (memory.safeFor || 0) + dt : 0;
  memory.unsafeFor = assessment.safe ? 0 : (memory.unsafeFor || 0) + dt;
  if (memory.safeFor >= tuning.safeStableSeconds) memory.stableSafe = true;
  if (memory.unsafeFor >= tuning.unsafeRecallSeconds) memory.stableSafe = false;
  memory.lastAssessment = assessment;
  return memory;
}

export function canDispatchEconomicExpedition({ assessment, aggression = 50, reserveRatio = 0, defenderCount = 0 } = {}, tuning = ECONOMY_SECURITY_TUNING) {
  if (assessment?.safe) return true;
  if (Number(aggression) < 70) return false;
  return !assessment?.hqEmergency && Number(reserveRatio) >= tuning.aggressiveReserve && Number(defenderCount) >= 1;
}

export function criticalProducerClusters(structures = [], playerId, definitionFor) {
  const producers = structures.filter(item => item.faction === playerId && item.alive !== false && item.progress >= 1)
    .map(item => ({ structure: item, definition: definitionFor(item) }))
    .filter(item => item.definition && item.definition.criticality >= 0.75);
  return producers.map(({ structure, definition }) => ({
    id: `producer-cluster:${structure.id}`,
    structureId: structure.id,
    x: structure.x,
    y: structure.y,
    radius: 110,
    criticality: definition.criticality,
    outputs: Object.keys(definition.outputs),
    commitSeconds: 18
  }));
}
