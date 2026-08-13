const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const DECISION_WORKFLOW_STAGES = Object.freeze([
  "assess-economy", "assess-territory", "assess-military", "assess-enemy", "determine-needs", "prioritize", "execute"
]);

export function evaluateDecisionWorkflow({ now = 0, player = {}, economy = {}, territory = {}, military = {}, enemy = {}, construction = {} } = {}) {
  const assessment = Object.freeze({
    economyHealth: clamp01(economy.health),
    resourceShortage: clamp01(economy.shortage),
    territoryOpportunity: clamp01(territory.opportunity),
    territoryPressure: clamp01(territory.pressure),
    armyReadiness: clamp01(military.readiness),
    vehicleDeficit: clamp01(military.vehicleDeficit),
    builderDeficit: clamp01(economy.builderDeficit),
    enemyPressure: clamp01(enemy.pressure),
    constructionDiversityNeed: clamp01(construction.diversityNeed)
  });
  const candidates = [
    { id: "stabilize-economy", lane: "economy", score: assessment.resourceShortage * 100 + (1 - assessment.economyHealth) * 45 },
    { id: "replace-builders", lane: "economy", score: assessment.builderDeficit * 115 },
    { id: "build-unique-facility", lane: "construction", score: assessment.constructionDiversityNeed * 92 },
    { id: "capture-opportunity", lane: "expansion", score: assessment.territoryOpportunity * 82 - assessment.enemyPressure * 18 },
    { id: "secure-territory", lane: "expansion", score: assessment.territoryPressure * 88 + assessment.enemyPressure * 35 },
    { id: "produce-vehicles", lane: "military", score: assessment.vehicleDeficit * 108 + assessment.armyReadiness * 12 },
    { id: "reinforce-army", lane: "military", score: (1 - assessment.armyReadiness) * 90 + assessment.enemyPressure * 42 }
  ].filter(candidate => candidate.score >= 8)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .map((candidate, index) => Object.freeze({ ...candidate, priority: index + 1 }));
  return Object.freeze({
    id: `workflow:${player.id || "player"}`,
    evaluatedAt: Number(now) || 0,
    stage: "execute",
    stages: DECISION_WORKFLOW_STAGES,
    assessment,
    queue: Object.freeze(candidates),
    current: candidates[0] || Object.freeze({ id: "hold-readiness", lane: "military", score: 0, priority: 1 })
  });
}
