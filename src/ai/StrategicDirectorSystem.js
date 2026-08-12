import {
  operationalRoleForBuildingType,
  planConstructionRoles,
  subfactionProductionPlanFor
} from "./SubfactionProductionPlans.js";

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

const ROLE_GATES = Object.freeze({
  HQ: 0,
  Power: 0.04,
  Logistics: 0.05,
  Muster: 0.06,
  Industry: 0.12,
  Sustainment: 0.14,
  Intel: 0.12,
  Doctrine: 0.23,
  "War Forge": 0.28,
  Fortification: 0.12,
  Emplacement: 0.18,
  Deployment: 0.4,
  Signature: 0.52
});

const RACE_PROFILES = Object.freeze({
  "Space Marines": Object.freeze({ concurrency: 2, expansionConcurrency: 3, agents: 3, weights: { Muster: 1.18, Intel: 1.16, "War Forge": 1.14, Deployment: 1.12, Sustainment: 1.08 } }),
  "Imperial Guard": Object.freeze({ concurrency: 3, expansionConcurrency: 4, agents: 3, weights: { Logistics: 1.18, Muster: 1.16, Industry: 1.12, Fortification: 1.16, Emplacement: 1.12 } }),
  "Adeptus Mechanicus": Object.freeze({ concurrency: 3, expansionConcurrency: 4, agents: 3, weights: { Power: 1.2, Industry: 1.18, Doctrine: 1.18, "War Forge": 1.2 } }),
  Chaos: Object.freeze({ concurrency: 2, expansionConcurrency: 3, agents: 3, weights: { Muster: 1.18, Doctrine: 1.14, "War Forge": 1.2, Deployment: 1.12, Signature: 1.24 } }),
  Orks: Object.freeze({ concurrency: 4, expansionConcurrency: 6, agents: 4, weights: { Muster: 1.28, Industry: 1.2, "War Forge": 1.24, Fortification: 1.08, Signature: 1.16 } }),
  Necrons: Object.freeze({ concurrency: 3, expansionConcurrency: 5, agents: 4, weights: { Power: 1.18, Doctrine: 1.16, "War Forge": 1.18, Deployment: 1.2, Signature: 1.12 } }),
  Tau: Object.freeze({ concurrency: 2, expansionConcurrency: 3, agents: 4, weights: { Logistics: 1.14, Intel: 1.24, Doctrine: 1.16, "War Forge": 1.18, Emplacement: 1.12 } }),
  Tyranids: Object.freeze({ concurrency: 4, expansionConcurrency: 7, agents: 5, weights: { Muster: 1.24, Industry: 1.18, Sustainment: 1.16, Deployment: 1.18, Signature: 1.22 } })
});

const PHASE_ROLE_WEIGHTS = Object.freeze({
  assess: Object.freeze({ Intel: 1.28, Logistics: 1.16, Doctrine: 1.08, Muster: 0.92 }),
  shape: Object.freeze({ Logistics: 1.18, Industry: 1.15, Intel: 1.12, Muster: 1.08 }),
  commit: Object.freeze({ Muster: 1.26, "War Forge": 1.23, Deployment: 1.16, Doctrine: 0.72 }),
  exploit: Object.freeze({ Muster: 1.18, "War Forge": 1.18, Logistics: 1.15, Industry: 1.12, Deployment: 1.2 }),
  consolidate: Object.freeze({ Logistics: 1.2, Sustainment: 1.18, Fortification: 1.22, Emplacement: 1.18 }),
  recover: Object.freeze({ Logistics: 1.3, Sustainment: 1.28, Power: 1.16, Fortification: 1.12, Deployment: 0.72 }),
  endgame: Object.freeze({ Muster: 1.28, "War Forge": 1.3, Deployment: 1.24, Doctrine: 0.55, Signature: 1.12 })
});

const PLAN_STAGE_WEIGHTS = Object.freeze({ opening: 1.18, primaryBranch: 1.13, secondaryBranch: 1.07, lateBranch: 1.02 });

function roleWeightsFor(player = {}, plan = null, phase = "assess") {
  const raceProfile = RACE_PROFILES[player.faction] || RACE_PROFILES[player.race] || RACE_PROFILES["Space Marines"];
  const weights = { ...raceProfile.weights };
  const authoredPlan = plan || subfactionProductionPlanFor(player);
  if (authoredPlan?.buildingPlan) {
    for (const [stage, multiplier] of Object.entries(PLAN_STAGE_WEIGHTS)) {
      for (const role of authoredPlan.buildingPlan[stage] || []) weights[role] = (weights[role] || 1) * multiplier;
    }
    // The full authored order acts as a gentle identity fingerprint, not a queue.
    const order = planConstructionRoles(authoredPlan);
    order.forEach((role, index) => {
      weights[role] = (weights[role] || 1) * (1 + Math.max(0, order.length - index) * 0.003);
    });
  }
  for (const [role, multiplier] of Object.entries(PHASE_ROLE_WEIGHTS[phase] || PHASE_ROLE_WEIGHTS.assess)) {
    weights[role] = (weights[role] || 1) * multiplier;
  }
  return weights;
}

export function calculateBaseMaturity({ completedBuildings = 0, resourceReadiness = 0, armyReadiness = 0, territoryCells = 0, supplyCondition = 0, intelligenceConfidence = 0 } = {}) {
  return clamp01(
    clamp01(completedBuildings / 13) * 0.3
    + clamp01(resourceReadiness) * 0.18
    + clamp01(armyReadiness) * 0.18
    + clamp01(territoryCells / 18) * 0.16
    + clamp01(supplyCondition) * 0.11
    + clamp01(intelligenceConfidence) * 0.07
  );
}

export function evaluateStrategicDirector({
  now = 0,
  player = {},
  operationalPhase = "assess",
  completedBuildings = 0,
  resourceReadiness = 0,
  armyReadiness = 0,
  territoryCells = 0,
  supplyCondition = 0,
  intelligenceConfidence = 0,
  threat = 0,
  productionPlan = null
} = {}) {
  const phase = PHASE_ROLE_WEIGHTS[operationalPhase] ? operationalPhase : "assess";
  const raceProfile = RACE_PROFILES[player.faction] || RACE_PROFILES[player.race] || RACE_PROFILES["Space Marines"];
  const maturity = calculateBaseMaturity({ completedBuildings, resourceReadiness, armyReadiness, territoryCells, supplyCondition, intelligenceConfidence });
  const expansionPhase = ["shape", "exploit", "consolidate"].includes(phase);
  const emergencyReduction = threat >= 0.82 && phase !== "commit" ? 1 : 0;
  const constructionConcurrency = Math.max(1, (expansionPhase ? raceProfile.expansionConcurrency : raceProfile.concurrency) - emergencyReduction);
  const territoryAgents = Math.max(2, Math.min(6, raceProfile.agents + (phase === "exploit" ? 1 : 0) - (phase === "recover" || phase === "commit" ? 1 : 0)));
  return Object.freeze({
    evaluatedAt: now,
    phase,
    maturity,
    constructionConcurrency,
    territoryAgents,
    roleWeights: Object.freeze(roleWeightsFor(player, productionPlan, phase)),
    reason: `${phase} phase at ${Math.round(maturity * 100)}% base maturity`
  });
}

export function scoreConstructionCandidate(candidate = {}, director = {}) {
  const role = candidate.operationalRole || operationalRoleForBuildingType(candidate.buildingType);
  const gate = ROLE_GATES[role] ?? 0.1;
  const maturity = clamp01(director.maturity);
  const liveNeed = clamp01((Number(candidate.liveNeed) || 0) / 100);
  const emergency = clamp01(candidate.emergency);
  const gateDeficit = Math.max(0, gate - maturity);
  const gatePenalty = gateDeficit > 0 && liveNeed < 0.76 && emergency < 0.65 ? gateDeficit * 280 : 0;
  const identityWeight = Number(director.roleWeights?.[role]) || 1;
  const duplicatePenalty = Math.max(0, Number(candidate.committedCount) || 0) * Math.max(4, 18 - liveNeed * 14);
  const backlogPenalty = Math.max(0, Number(candidate.activeCount) || 0) * 22;
  return (Number(candidate.utility) || 0) + (identityWeight - 1) * 62 + liveNeed * 24
    - gatePenalty - duplicatePenalty - backlogPenalty;
}

export function selectConstructionIntent({ candidates = [], director = {}, currentIntent = null, now = 0 } = {}) {
  const ranked = candidates
    .filter(candidate => candidate && candidate.prerequisitesSatisfied !== false && candidate.dependenciesCanEverBeSatisfied !== false)
    .map(candidate => ({ ...candidate, strategicScore: scoreConstructionCandidate(candidate, director) }))
    .filter(candidate => Number.isFinite(candidate.strategicScore))
    .sort((a, b) => b.strategicScore - a.strategicScore || String(a.buildingType).localeCompare(String(b.buildingType)));
  if (!ranked.length) return null;
  const incumbent = currentIntent && currentIntent.expiresAt > now
    ? ranked.find(candidate => candidate.buildingType === currentIntent.buildingType)
    : null;
  const sticky = incumbent && now < currentIntent.stickyUntil;
  const chosen = sticky || (incumbent && incumbent.strategicScore + 16 >= ranked[0].strategicScore) ? incumbent : ranked[0];
  if (!chosen) return null;
  if (currentIntent?.buildingType === chosen.buildingType) {
    return Object.freeze({ ...currentIntent, score: chosen.strategicScore, reason: chosen.reason, lastValidatedAt: now, candidate: chosen });
  }
  return Object.freeze({
    id: `construction-intent:${String(chosen.buildingType)}:${Math.round(now * 10)}`,
    buildingType: chosen.buildingType,
    operationalRole: chosen.operationalRole || operationalRoleForBuildingType(chosen.buildingType),
    reason: chosen.reason || director.reason || "live strategic demand",
    priority: Math.max(1, Math.min(100, Math.round(50 + chosen.strategicScore * 0.2))),
    score: chosen.strategicScore,
    createdAt: now,
    stickyUntil: now + 8,
    expiresAt: now + 24,
    lastValidatedAt: now,
    candidate: chosen
  });
}

export const STRATEGIC_DIRECTOR_RACE_PROFILES = RACE_PROFILES;
export const STRATEGIC_DIRECTOR_ROLE_GATES = ROLE_GATES;
