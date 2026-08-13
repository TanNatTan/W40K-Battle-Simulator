import policyData from "../../data/ai/building-diversity-policy.json" with { type: "json" };

export const BUILDING_DIVERSITY_POLICY = Object.freeze({
  ...policyData,
  duplicatePenaltyAt: Object.freeze({ ...policyData.duplicatePenaltyAt })
});

export function buildingTypeCounts(structures = [], playerId = null) {
  const counts = {};
  for (const structure of structures) {
    if (!structure || structure.alive === false || structure.construction?.state === "cancelled") continue;
    if (playerId != null && structure.faction !== playerId) continue;
    counts[structure.type] = (counts[structure.type] || 0) + 1;
  }
  return Object.freeze(counts);
}

export function evaluateBuildingDiversity({ type, counts = {}, eligibleTypes = [], policy = BUILDING_DIVERSITY_POLICY } = {}) {
  const eligible = [...new Set(eligibleTypes.filter(Boolean))];
  const copies = Math.max(0, Number(counts[type]) || 0);
  const missingTypes = eligible.filter(candidate => (Number(counts[candidate]) || 0) === 0);
  const allEligibleRepresented = missingTypes.length === 0;
  const softLimit = Math.max(1, Number(policy.duplicateSoftLimit) || 3);
  const blocked = Boolean(policy.requireUniqueAfterSoftLimit && !allEligibleRepresented && copies >= softLimit);
  const adjustment = blocked ? -Infinity
    : copies === 0 ? Number(policy.missingUniqueBonus) || 0
      : Number(policy.duplicatePenaltyAt?.[String(copies)]) || 0;
  return Object.freeze({ type, copies, missingTypes: Object.freeze(missingTypes), allEligibleRepresented, blocked, adjustment,
    reason: blocked ? `${type} reached the ${softLimit}-copy soft limit while eligible unique facilities remain`
      : allEligibleRepresented ? "all eligible building types are represented" : copies === 0 ? "missing unique building receives diversity priority" : "duplicate diversity penalty" });
}

export function applyBuildingDiversity(candidates = [], structures = [], playerId = null, policy = BUILDING_DIVERSITY_POLICY) {
  const eligibleTypes = candidates.filter(candidate => candidate.prerequisitesSatisfied !== false && candidate.dependenciesCanEverBeSatisfied !== false)
    .map(candidate => candidate.buildingType);
  const counts = buildingTypeCounts(structures, playerId);
  return candidates.map(candidate => {
    const diversity = evaluateBuildingDiversity({ type: candidate.buildingType, counts, eligibleTypes, policy });
    return Object.freeze({ ...candidate, diversity, utility: diversity.blocked ? -Infinity : (Number(candidate.utility) || 0) + diversity.adjustment });
  }).filter(candidate => Number.isFinite(candidate.utility));
}
