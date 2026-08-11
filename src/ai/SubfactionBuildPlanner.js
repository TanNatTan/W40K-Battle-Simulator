import {
  buildingRequirementsFor,
  buildingTypeForOperationalRole,
  operationalRoleForBuildingType,
  subfactionProductionPlanFor
} from "./SubfactionProductionPlans.js";

const stageWeight = Object.freeze({ opening: 120, primaryBranch: 94, secondaryBranch: 68, lateBranch: 38 });

function completedRoles(structures = [], playerId) {
  return new Set(structures.filter(item => item?.faction === playerId && item.alive !== false && Number(item.progress) >= 1)
    .map(item => operationalRoleForBuildingType(item.type)).filter(Boolean));
}

export function buildingPrerequisitesSatisfied(role, completed = new Set()) {
  const requirements = buildingRequirementsFor(role);
  return requirements.requiresAll.every(dependency => completed.has(dependency))
    && (!requirements.requiresAny.length || requirements.requiresAny.some(dependency => completed.has(dependency)));
}

export function signatureGateSatisfied({ forceState = {}, strategicNeed = 0, resourceSurplus = 0 } = {}) {
  return Boolean(forceState.allIn || Number(forceState.commitment || forceState.level) >= 3 || strategicNeed >= 65 || resourceSurplus >= 0.72);
}

export function constructionCandidatesFor({ player = {}, structures = [], demand = {}, forceState = {}, resourceSurplus = 0 } = {}) {
  const plan = subfactionProductionPlanFor(player);
  if (!plan) return [];
  const completed = completedRoles(structures, player.id);
  const existing = new Set(structures.filter(item => item?.faction === player.id && item.alive !== false).map(item => operationalRoleForBuildingType(item.type)).filter(Boolean));
  const candidates = [];
  for (const stage of ["opening", "primaryBranch", "secondaryBranch", "lateBranch"]) {
    const roles = plan.buildingPlan[stage];
    for (let index = 0; index < roles.length; index += 1) {
      const role = roles[index];
      const buildingType = buildingTypeForOperationalRole(role);
      if (!buildingType || existing.has(role)) continue;
      const prerequisitesSatisfied = buildingPrerequisitesSatisfied(role, completed);
      const need = Number(demand.constructionNeeds?.[role]) || 0;
      const mandatory = stage === "opening" || stage === "primaryBranch" && completed.size < 6;
      const signatureReady = role !== "Signature" || signatureGateSatisfied({ forceState, strategicNeed: need, resourceSurplus });
      const utility = stageWeight[stage] - index * 5 + need + (mandatory ? 35 : 0) - (prerequisitesSatisfied ? 0 : 180) - (signatureReady ? 0 : 220);
      candidates.push(Object.freeze({ role, buildingType, stage, index, utility, mandatory, prerequisitesSatisfied, signatureReady,
        reason: `${plan.name} ${stage.replace(/([A-Z])/g, " $1").toLowerCase()} · ${role}${need ? ` · live need ${Math.round(need)}` : ""}` }));
    }
  }
  return candidates.sort((a, b) => b.utility - a.utility || a.index - b.index);
}

export function chooseSubfactionBuildProject(context = {}) {
  return constructionCandidatesFor(context).find(candidate => candidate.prerequisitesSatisfied && candidate.signatureReady
    && (candidate.mandatory || candidate.utility >= 72)) || null;
}

