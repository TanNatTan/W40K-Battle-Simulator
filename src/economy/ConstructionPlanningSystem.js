const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

export function normalizeConstructionProject(candidate = {}) {
  return Object.freeze({
    buildingType: candidate.buildingType || candidate.type,
    site: candidate.site ? Object.freeze({ ...candidate.site }) : null,
    utility: Number(candidate.utility ?? candidate.score) || 0,
    reason: candidate.reason || "combined economy, military, objective, and risk utility",
    prerequisitesSatisfied: candidate.prerequisitesSatisfied !== false,
    dependenciesCanEverBeSatisfied: candidate.dependenciesCanEverBeSatisfied !== false,
    affordableNow: Boolean(candidate.affordableNow),
    expectedNetworkComponent: candidate.expectedNetworkComponent || null,
    intendedOutputs: Object.freeze([...(candidate.intendedOutputs || [])]),
    blockedReason: candidate.blockedReason || null
  });
}

/** Selects among the strongest feasible projects without forcing identical base layouts. */
export function selectConstructionProject(candidates = [], { random = Math.random, temperature = 11, top = 3 } = {}) {
  const projects = candidates.map(normalizeConstructionProject)
    .filter(project => project.buildingType && project.dependenciesCanEverBeSatisfied)
    .map(project => ({
      ...project,
      utility: project.utility
        + (project.prerequisitesSatisfied ? 0 : -1000)
        + (project.affordableNow ? 12 : -8)
    }))
    .sort((a, b) => b.utility - a.utility || a.buildingType.localeCompare(b.buildingType));
  const strongest = projects.slice(0, Math.max(1, Math.floor(top)));
  if (!strongest.length) return null;
  const heat = Math.max(0.1, Number(temperature) || 11);
  const maxUtility = strongest[0].utility;
  const weights = strongest.map(project => Math.exp(clamp((project.utility - maxUtility) / heat, -60, 0)));
  let roll = clamp(random(), 0, 0.999999999) * weights.reduce((sum, value) => sum + value, 0);
  for (let index = 0; index < strongest.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) return Object.freeze(strongest[index]);
  }
  return Object.freeze(strongest[0]);
}
