import { desiredBuildersFor } from "./ConstructionSystem.js";

const accelerationTypes = new Set([
  "barracks",
  "workshop",
  "warehouse",
  "generator",
  "refinery",
  "dropbay",
  "researchcenter"
]);

const factionSurgeBonus = player => ["Orks", "Necrons"].includes(player?.race) ? 1 : 0;

/**
 * Determines how many foundations a faction may fund at once. Builder count is
 * deliberately absent: commanders create demand; the workforce answers it.
 */
export function constructionQueueCapacity({ player = {}, structures = [], claimedTerritoryCells = 0, strategicLimit = null } = {}) {
  const completed = structures.filter(structure => structure?.faction === player.id
    && structure.alive !== false && Number(structure.progress) >= 1);
  const hasHeadquarters = completed.some(structure => structure.type === "outpost");
  const accelerators = completed.filter(structure => accelerationTypes.has(structure.type)).length;
  const establishedGrowth = Math.floor(Math.max(0, completed.length - 1) / 4);
  const infrastructureGrowth = Math.floor(accelerators / 3);
  const territoryGrowth = Math.floor(Math.max(0, Number(claimedTerritoryCells) - 8) / 6);
  const surge = completed.length >= 3 ? factionSurgeBonus(player) : 0;
  const unconstrainedCapacity = Math.max(1, (hasHeadquarters ? 3 : 1) + establishedGrowth + infrastructureGrowth + territoryGrowth + surge);
  // Parallelism may keep growing, but only when the faction controls enough land
  // to support dispersed work sites. This prevents a mature starting fixture from
  // reserving dozens of foundations in one burst while preserving long-term growth.
  const territorySupportedCapacity = Number(claimedTerritoryCells) > 0
    ? Math.max(hasHeadquarters ? 3 : 1, Math.ceil(Number(claimedTerritoryCells) / 5))
    : unconstrainedCapacity;
  const hasStrategicLimit = strategicLimit !== null && strategicLimit !== undefined && strategicLimit !== ""
    && Number.isFinite(Number(strategicLimit));
  const directorLimit = hasStrategicLimit ? Math.max(1, Math.floor(Number(strategicLimit))) : Infinity;
  const capacity = Math.min(unconstrainedCapacity, territorySupportedCapacity, directorLimit);
  return Object.freeze({
    capacity,
    completedBuildings: completed.length,
    accelerators,
    establishedGrowth,
    infrastructureGrowth,
    territoryGrowth,
    territorySupportedCapacity,
    factionSurge: surge,
    strategicLimit: Number.isFinite(directorLimit) ? directorLimit : null
  });
}

export function activeConstructionProjects(player = {}, structures = []) {
  return structures.filter(structure => structure?.faction === player.id && structure.alive !== false
    && Number(structure.progress) < 1 && structure.construction?.state !== "cancelled");
}

export function constructionLaborDemand(projects = [], specFor = () => ({})) {
  return projects.reduce((total, project) => total + Math.max(1,
    Number(project.desiredBuilders) || desiredBuildersFor(project.type, specFor(project.type))), 0);
}

export function constructionQueueSnapshot({ player = {}, structures = [], claimedTerritoryCells = 0, strategicLimit = null, specFor = () => ({}) } = {}) {
  const projects = activeConstructionProjects(player, structures);
  const capacity = constructionQueueCapacity({ player, structures, claimedTerritoryCells, strategicLimit });
  const planned = projects.filter(project => project.construction?.state === "planned").length;
  const active = projects.length - planned;
  return Object.freeze({
    ...capacity,
    projects,
    planned,
    active,
    occupied: projects.length,
    available: Math.max(0, capacity.capacity - projects.length),
    laborDemand: constructionLaborDemand(projects, specFor)
  });
}
