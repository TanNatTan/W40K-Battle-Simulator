const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const IDEAL_BUILDERS = Object.freeze({
  turret: 1,
  observationtower: 1,
  warehouse: 1,
  farm: 1,
  generator: 1,
  fueldepot: 1,
  ammodepot: 1,
  bunker: 2,
  barracks: 2,
  mine: 2,
  refinery: 2,
  workshop: 2,
  researchcenter: 2,
  fieldhospital: 2,
  signature: 2,
  dropbay: 3,
  outpost: 4
});

export function desiredBuildersFor(type = "", spec = {}) {
  if (IDEAL_BUILDERS[type]) return IDEAL_BUILDERS[type];
  const size = Math.max(Number(spec.hitbox?.w) || 0, Number(spec.hitbox?.h) || 0);
  return size >= 44 ? 3 : size >= 32 ? 2 : 1;
}

export function createConstructionState({ committedResources = {}, now = 0 } = {}) {
  return {
    state: "active",
    committedResources: { ...committedResources },
    cancellationReason: null,
    lastProgressAt: Number(now) || 0,
    stalledFor: 0,
    failedApproaches: 0
  };
}

export function constructionSiteKey(structure = {}, cellSize = 32) {
  const size = Math.max(1, Number(cellSize) || 32);
  return `${structure.type || "building"}:${Math.round((Number(structure.x) || 0) / size)},${Math.round((Number(structure.y) || 0) / size)}`;
}

export function constructionRefund(committedResources = {}, progress = 0, reclamation = 1) {
  const factor = (1 - clamp01(progress)) * 0.8 * Math.max(0, Number(reclamation) || 0);
  return Object.fromEntries(Object.entries(committedResources).map(([resource, amount]) => [resource, Math.max(0, Number(amount) || 0) * factor]).filter(([, amount]) => amount > 0));
}

export function evaluateConstructionCancellation(structure = {}, context = {}) {
  if (structure.progress >= 1 || structure.alive === false || structure.construction?.state === "cancelled") return { cancel: false, reason: null };
  const progress = clamp01(structure.progress);
  const stalledFor = Math.max(0, Number(structure.construction?.stalledFor) || 0);
  const failedApproaches = Math.max(0, Number(structure.construction?.failedApproaches) || 0);
  if (context.placementConflict) return { cancel: true, reason: "reserved footprint conflict" };
  if (context.territoryLost && progress < 0.7) return { cancel: true, reason: "construction territory lost" };
  if (context.parentMissing && progress < 0.65) return { cancel: true, reason: "required parent structure lost" };
  // A commander-approved foundation may legitimately wait while its producer
  // raises the requested workforce. Do not treat that planned wait as builder
  // abandonment; placement, territory, and dependency failures still cancel it.
  if (structure.construction?.state === "planned" && context.activeBuilders === 0 && stalledFor <= 75) return { cancel: false, reason: null };
  if (progress < 0.35 && stalledFor > 8 && failedApproaches >= 3) return { cancel: true, reason: "site unreachable" };
  if (progress < 0.2 && stalledFor > 12 && context.activeBuilders === 0) return { cancel: true, reason: "abandoned stalled foundation" };
  if (progress < 0.22 && context.duplicateLowPriority) return { cancel: true, reason: "duplicate low-priority project" };
  if (progress < 0.18 && context.economyEmergency && context.lowPriority) return { cancel: true, reason: "economy emergency reprioritization" };
  if (progress < 0.25 && context.indefensible && stalledFor > 6) return { cancel: true, reason: "site became indefensible" };
  return { cancel: false, reason: null };
}
