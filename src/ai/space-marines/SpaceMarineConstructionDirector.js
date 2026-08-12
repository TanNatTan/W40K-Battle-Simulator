import { operationalRoleForBuildingType } from "../SubfactionProductionPlans.js";
import { isSpaceMarinePlayer } from "./SpaceMarineChapterDoctrine.js";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

const BASE_PRIORITIES = Object.freeze({
  outpost: 100,
  generator: 74,
  barracks: 82,
  workshop: 78,
  dropbay: 76,
  bunker: 60,
  turret: 60,
  observationtower: 65,
  mine: 74,
  refinery: 74,
  farm: 74,
  warehouse: 70,
  fieldhospital: 68,
  ammodepot: 70,
  fueldepot: 70,
  researchcenter: 40,
  signature: 30
});

export function spaceMarineConstructionPriority(candidate = {}, strategy = {}) {
  const type = candidate.buildingType;
  const role = candidate.operationalRole || operationalRoleForBuildingType(type);
  const liveNeed = clamp(candidate.liveNeed, 0, 100);
  let priority = BASE_PRIORITIES[type] || 58;
  if (candidate.headquartersReplacement || type === "outpost") priority = 100;
  else if (candidate.criticalResourceFailure && ["generator", "mine", "refinery", "farm", "warehouse"].includes(type)) priority = 95;
  else if (strategy.posture === "EXPLOIT" && ["barracks", "workshop", "dropbay", "fieldhospital", "warehouse"].includes(type)) priority = Math.max(priority, 90);
  else if (candidate.emergency >= 0.7 && ["bunker", "turret", "observationtower"].includes(type)) priority = Math.max(priority, 88);
  priority += Math.max(0, liveNeed - 50) * 0.16;
  priority += ((strategy.roleWeights?.[role] || 1) - 1) * 24;
  priority -= Math.max(0, Number(candidate.activeCount) || 0) * 7;
  priority -= Math.max(0, Number(candidate.committedCount) - 1 || 0) * 4;
  return clamp(priority, 1, 100);
}

export function scoreSpaceMarineConstructionCandidate(candidate = {}, strategy = {}) {
  const priority = spaceMarineConstructionPriority(candidate, strategy);
  const affordability = candidate.affordableNow === false ? -8 : 4;
  const dependency = candidate.prerequisitesSatisfied === false ? -Infinity : 0;
  return dependency + priority * 1.25 + clamp(candidate.liveNeed, 0, 100) * 0.3
    + clamp(candidate.utility, -200, 300) * 0.12 + affordability;
}

export function selectSpaceMarineConstructionIntent({ player = {}, candidates = [], strategy = {}, currentIntent = null, now = 0 } = {}) {
  if (!isSpaceMarinePlayer(player)) return null;
  const ranked = candidates
    .filter(candidate => candidate?.dependenciesCanEverBeSatisfied !== false && candidate?.prerequisitesSatisfied !== false)
    .map(candidate => ({
      ...candidate,
      marinePriority: spaceMarineConstructionPriority(candidate, strategy),
      strategicScore: scoreSpaceMarineConstructionCandidate(candidate, strategy)
    }))
    .filter(candidate => Number.isFinite(candidate.strategicScore))
    .sort((a, b) => b.strategicScore - a.strategicScore || String(a.buildingType).localeCompare(String(b.buildingType)));
  if (!ranked.length) return null;
  const incumbent = currentIntent?.expiresAt > now
    ? ranked.find(candidate => candidate.buildingType === currentIntent.buildingType) : null;
  const chosen = incumbent && (now < currentIntent.stickyUntil || incumbent.strategicScore + 18 >= ranked[0].strategicScore)
    ? incumbent : ranked[0];
  if (currentIntent?.buildingType === chosen.buildingType) return Object.freeze({
    ...currentIntent,
    priority: Math.round(chosen.marinePriority),
    score: chosen.strategicScore,
    candidate: chosen,
    lastValidatedAt: now
  });
  return Object.freeze({
    id: `space-marine-construction:${player.id || "chapter"}:${chosen.buildingType}:${Math.round(now * 10)}`,
    buildingType: chosen.buildingType,
    operationalRole: chosen.operationalRole || operationalRoleForBuildingType(chosen.buildingType),
    reason: `${strategy.posture || "SECURE"} - ${chosen.reason || "chapter operational requirement"}`,
    priority: Math.round(chosen.marinePriority),
    score: chosen.strategicScore,
    createdAt: now,
    stickyUntil: now + 24,
    expiresAt: now + 36,
    candidate: chosen
  });
}

export const SPACE_MARINE_CONSTRUCTION_PRIORITIES = BASE_PRIORITIES;
