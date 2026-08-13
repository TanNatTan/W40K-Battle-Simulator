import workforcePolicyData from "../../data/ai/builder-workforce-policy.json" with { type: "json" };
import { desiredBuildersFor } from "./ConstructionSystem.js";

const freezeList = values => Object.freeze([...(values || [])]);
const normalize = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const distanceSquared = (a = {}, b = {}) => (Number(a.x) - Number(b.x)) ** 2 + (Number(a.y) - Number(b.y)) ** 2;

export function builderWorkforceBranchFor(player = {}) {
  const race = normalize(player.race);
  const faction = normalize(player.faction);
  if (faction.includes("space_marines")) return "space_marines";
  if (faction.includes("machine_cult") || faction.includes("mechanicus")) return "adeptus_mechanicus";
  if (faction.includes("imperial_guard")) return "imperial_guard";
  if (race.includes("chaos")) return "chaos";
  if (race.includes("ork")) return "orks";
  if (race.includes("necron")) return "necrons";
  if (race.includes("tau") || race.includes("t_au")) return "tau";
  if (race.includes("tyranid")) return "tyranids";
  return "imperial_guard";
}

function numeric(profile, key) {
  return Math.max(0, Math.floor(Number(profile?.[key]) || 0));
}

export function builderWorkforceProfileFor(player = {}) {
  const branch = builderWorkforceBranchFor(player);
  const base = workforcePolicyData.profiles?.[branch] || workforcePolicyData.profiles.imperial_guard;
  const override = workforcePolicyData.subfactionOverrides?.[player.subfaction] || {};
  return Object.freeze({
    id: branch,
    builder: base.builder,
    startingMin: Math.max(1, numeric(base, "startingMin")),
    startingMax: Math.max(1, numeric(base, "startingMax")),
    growthMultiplier: Math.max(1, numeric(base, "growthMultiplier")),
    hardCap: Math.max(1, numeric(base, "hardCap")),
    replaceDead: base.replaceDead !== false,
    perBuilding: 0,
    heavyBonus: numeric(base, "heavyBonus") + numeric(override, "heavyBonusAdd"),
    heavyTypes: freezeList(base.heavyTypes),
    reserveBase: numeric(base, "reserveBase") + numeric(override, "reserveBaseBonus"),
    reserveEvery: Math.max(1, numeric(base, "reserveEvery")),
    repairReserve: numeric(base, "repairReserve") + numeric(override, "repairReserveBonus"),
    gatherReserve: numeric(base, "gatherReserve") + numeric(override, "gatherReserveBonus"),
    constructionReserve: numeric(base, "constructionReserve") + numeric(override, "constructionReserveBonus")
  });
}

export function caretakerRequirementForStructure(player = {}, structure = {}) {
  if (!structure || structure.alive === false || Number(structure.progress) < 1) return 0;
  return 0;
}

export function builderWorkforceDemand({ player = {}, structures = [], configuredTarget = 0, damagedStructures = null,
  activeProjects = null, harvestSourceCount = 0, emergency = false } = {}) {
  const profile = builderWorkforceProfileFor(player);
  const completed = structures.filter(structure => structure?.faction === player.id && structure.alive !== false && Number(structure.progress) >= 1);
  const projects = activeProjects ?? structures.filter(structure => structure?.faction === player.id && structure.alive !== false && Number(structure.progress) < 1);
  const damaged = damagedStructures ?? completed.filter(structure => Number(structure.hp) < Number(structure.maxHp) * 0.98).length;
  const caretakerRequirement = 0;
  const growthReserve = 0;
  const baselineReserve = Math.max(profile.startingMin, Math.min(profile.startingMax, Number(configuredTarget) || profile.startingMin));
  const repairDemand = damaged > 0 ? Math.min(profile.repairReserve, Math.max(1, damaged)) : 0;
  const gatherDemand = harvestSourceCount > 0 ? Math.min(profile.gatherReserve, Math.max(1, Math.ceil(harvestSourceCount / 2))) : 0;
  const rawConstructionDemand = Array.isArray(projects)
    ? projects.reduce((total, project) => total + Math.max(1,
      Number(project.desiredBuilders) || desiredBuildersFor(project.type, project.spec)), 0)
    : Math.max(0, Number(projects) || 0);
  const constructionDemand = Math.min(profile.constructionReserve, Math.ceil(rawConstructionDemand / 2));
  const emergencyDemand = emergency ? Math.max(1, Math.min(profile.repairReserve, 2)) : 0;
  const workloadReserve = constructionDemand + repairDemand + gatherDemand + emergencyDemand;
  const rememberedTarget = Math.max(baselineReserve, Number(configuredTarget) || 0);
  const desired = Math.min(profile.hardCap, Math.max(rememberedTarget, baselineReserve + workloadReserve));
  return Object.freeze({ desired, caretakerRequirement, completedBuildings: completed.length, baselineReserve, growthReserve,
    workloadReserve, repairDemand, gatherDemand, constructionDemand, rawConstructionDemand, emergencyDemand,
    hardCap: profile.hardCap, replaceDead: profile.replaceDead, profile });
}

function structurePriority(player, structure) {
  const condition = Number(structure.hp) / Math.max(1, Number(structure.maxHp) || 1);
  return (structure.type === "outpost" ? 120 : 0) + caretakerRequirementForStructure(player, structure) * 18 + (1 - condition) * 90;
}

export function reconcileBuilderHomes({ player = {}, structures = [], builders = [] } = {}) {
  const completed = structures.filter(structure => structure?.faction === player.id && structure.alive !== false && Number(structure.progress) >= 1);
  const byId = new Map(completed.map(structure => [structure.id, structure]));
  const livingBuilders = builders.filter(builder => builder?.alive !== false && !builder.incapacitated && builder.faction === player.id && builder.role === "builder");
  for (const builder of livingBuilders) if (!byId.has(builder.homeStructureId)) builder.homeStructureId = null;
  const assigned = new Map(completed.map(structure => [structure.id, []]));
  for (const builder of livingBuilders) if (builder.homeStructureId) assigned.get(builder.homeStructureId)?.push(builder);
  const unassigned = livingBuilders.filter(builder => !builder.homeStructureId);
  const targets = completed.flatMap(structure => Array.from({ length: Math.max(0,
    caretakerRequirementForStructure(player, structure) - (assigned.get(structure.id)?.length || 0)) }, () => structure))
    .sort((a, b) => structurePriority(player, b) - structurePriority(player, a));
  let filled = 0;
  for (const structure of targets) {
    if (!unassigned.length) break;
    let nearestIndex = 0;
    for (let index = 1; index < unassigned.length; index += 1) if (distanceSquared(unassigned[index], structure) < distanceSquared(unassigned[nearestIndex], structure)) nearestIndex = index;
    const [builder] = unassigned.splice(nearestIndex, 1);
    builder.homeStructureId = structure.id;
    builder.homeAssignedAt ??= 0;
    assigned.get(structure.id).push(builder);
    filled += 1;
  }
  // A home is a response anchor, not a permanent staffing requirement. Spread
  // floating workers across the live base without increasing workforce demand.
  const homePool = [...completed].sort((a, b) => structurePriority(player, b) - structurePriority(player, a));
  for (let index = 0; index < unassigned.length && homePool.length; index += 1) {
    const builder = unassigned[index];
    const home = homePool[index % homePool.length];
    builder.homeStructureId = home.id;
    builder.homeAssignedAt ??= 0;
    assigned.get(home.id).push(builder);
  }
  if (homePool.length) unassigned.length = 0;
  return Object.freeze({ assigned: livingBuilders.length - unassigned.length, floating: unassigned.length,
    required: completed.reduce((sum, structure) => sum + caretakerRequirementForStructure(player, structure), 0), unfilled: Math.max(0, targets.length - filled) });
}

export function builderHomeStatus(builder = {}, structures = []) {
  const home = structures.find(structure => structure.id === builder.homeStructureId && structure.alive !== false && Number(structure.progress) >= 1) || null;
  if (!home) return Object.freeze({ home: null, needsRepair: false, healthy: false });
  const condition = Number(home.hp) / Math.max(1, Number(home.maxHp) || 1);
  return Object.freeze({ home, condition, needsRepair: condition < 0.985, critical: condition < 0.55, healthy: condition >= 0.985 });
}

export const BUILDER_WORKFORCE_PRIORITY = Object.freeze([...workforcePolicyData.priorityOrder]);
export const BUILDER_WORKFORCE_POLICY_VERSION = workforcePolicyData.version;

export function startingBuilderCountFor(player = {}, random = Math.random) {
  const profile = builderWorkforceProfileFor(player);
  const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
  return profile.startingMin + Math.floor(roll * (profile.startingMax - profile.startingMin + 1));
}
