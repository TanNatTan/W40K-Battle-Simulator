import { isSpaceMarinePlayer, spaceMarineChapterDoctrineFor } from "./SpaceMarineChapterDoctrine.js";

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const SPACE_MARINE_POSTURES = Object.freeze({
  SECURE: Object.freeze({ territoryAgents: 2, constructionConcurrency: 2, capture: 0.8, offense: 0.55, roleWeights: { Power: 1.25, Logistics: 1.22, Muster: 1.2, Intel: 1.12 } }),
  EXPAND: Object.freeze({ territoryAgents: 4, constructionConcurrency: 3, capture: 1.35, offense: 0.72, roleWeights: { Intel: 1.3, Logistics: 1.25, Industry: 1.22, Muster: 1.08 } }),
  STRIKE: Object.freeze({ territoryAgents: 2, constructionConcurrency: 2, capture: 0.58, offense: 1.4, roleWeights: { Muster: 1.32, "War Forge": 1.32, Deployment: 1.28, Sustainment: 1.08 } }),
  EXPLOIT: Object.freeze({ territoryAgents: 5, constructionConcurrency: 3, capture: 1.65, offense: 1.2, roleWeights: { Muster: 1.2, "War Forge": 1.25, Deployment: 1.34, Logistics: 1.22, Industry: 1.18 } }),
  FORTIFY: Object.freeze({ territoryAgents: 2, constructionConcurrency: 3, capture: 0.68, offense: 0.62, roleWeights: { Fortification: 1.48, Emplacement: 1.42, Intel: 1.25, Logistics: 1.18 } }),
  RECOVER: Object.freeze({ territoryAgents: 1, constructionConcurrency: 2, capture: 0.42, offense: 0.4, roleWeights: { Sustainment: 1.5, Logistics: 1.38, Power: 1.22, Muster: 1.1 } })
});

function postureFor(operationalPhase, assessment) {
  if (assessment.headquartersCritical || assessment.enemyPressure >= 0.82
    || assessment.armyCondition < 0.42 || assessment.resourceHealth < 0.28) return "RECOVER";
  if (assessment.enemyPressure >= 0.58 && assessment.territoryValue >= 0.55) return "FORTIFY";
  if (operationalPhase === "exploit" || assessment.enemyWeakness >= 0.72) return "EXPLOIT";
  if (["commit", "endgame"].includes(operationalPhase)) return "STRIKE";
  if (operationalPhase === "consolidate") return "FORTIFY";
  if (operationalPhase === "recover") return "RECOVER";
  if (operationalPhase === "shape" || assessment.resourceHealth < 0.62 || assessment.territoryOpportunity >= 0.55) return "EXPAND";
  return "SECURE";
}

export function assessSpaceMarineBattlefield(context = {}) {
  return Object.freeze({
    enemyPressure: clamp01(context.enemyPressure),
    enemyWeakness: clamp01(context.enemyWeakness),
    armyCondition: clamp01(context.armyCondition ?? 1 - (context.casualtyRatio || 0)),
    casualties: clamp01(context.casualtyRatio),
    territoryValue: clamp01(context.territoryValue ?? context.objectiveProgress),
    territoryOpportunity: clamp01(context.territoryOpportunity),
    resourceHealth: clamp01(context.resourceHealth ?? 1 - (context.resourceShortage || 0)),
    supplyCondition: clamp01(context.supplyCondition ?? 0.65),
    reinforcementDistance: clamp01(context.reinforcementDistance),
    headquartersCritical: Boolean(context.headquartersCritical)
  });
}

export function evaluateSpaceMarineAI({ now = 0, player = {}, operationalPhase = "assess", context = {} } = {}) {
  if (!isSpaceMarinePlayer(player)) return null;
  const assessment = assessSpaceMarineBattlefield(context);
  const posture = postureFor(operationalPhase, assessment);
  const definition = SPACE_MARINE_POSTURES[posture];
  const chapter = spaceMarineChapterDoctrineFor(player);
  const territoryAgents = Math.max(1, Math.min(5, Math.round(definition.territoryAgents * chapter.capture)));
  return Object.freeze({
    evaluatedAt: now,
    posture,
    phase: operationalPhase,
    assessment,
    chapter,
    territoryAgents,
    constructionConcurrency: definition.constructionConcurrency,
    captureBias: definition.capture * chapter.capture,
    offensivePressure: definition.offense,
    roleWeights: Object.freeze({ ...definition.roleWeights }),
    reason: `${posture.toLowerCase()} posture selected from live battlefield condition`
  });
}
