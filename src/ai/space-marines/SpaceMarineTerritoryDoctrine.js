import { isSpaceMarinePlayer, spaceMarineChapterDoctrineFor } from "./SpaceMarineChapterDoctrine.js";

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const bestEntry = scores => Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

const RESOURCE_BUILDINGS = Object.freeze({
  materials: "mine",
  scrap: "mine",
  fuel: "refinery",
  energy: "generator",
  food: "farm",
  biomass: "farm"
});

function selectDevelopmentBuilding(category, context) {
  const existing = new Set(context.existingBuildingTypes || []);
  if (category === "defensive") {
    const choices = context.enemyThreat >= 0.68 ? ["bunker", "turret", "observationtower"]
      : context.chokePointValue >= 0.58 ? ["bunker", "observationtower", "turret"]
        : ["observationtower", "bunker", "turret"];
    return choices.find(type => !existing.has(type)) || choices[0];
  }
  if (category === "production") {
    const needs = context.productionNeeds || {};
    const choices = [
      ["barracks", Number(needs.Muster) || 0],
      ["workshop", Number(needs["War Forge"]) || 0],
      ["dropbay", Number(needs.Deployment) || 0],
      ["fieldhospital", Number(needs.Sustainment) || 0],
      ["warehouse", Number(needs.Logistics) || 0]
    ].sort((a, b) => b[1] - a[1]);
    return choices.find(([type]) => !existing.has(type))?.[0] || choices[0][0];
  }
  if (category === "resource") {
    const extractor = RESOURCE_BUILDINGS[context.resourceType];
    if (extractor && !existing.has(extractor)) return extractor;
    return !existing.has("warehouse") ? "warehouse" : extractor || "generator";
  }
  return null;
}

export function evaluateSpaceMarineTerritoryDevelopment({ player = {}, context = {} } = {}) {
  if (!isSpaceMarinePlayer(player)) return Object.freeze({ category: "none", buildingType: null, reason: "non-Marine territory uses its existing faction economy", scores: {} });
  const chapter = spaceMarineChapterDoctrineFor(player);
  const enemyThreat = clamp01(context.enemyThreat);
  const frontierExposure = clamp01(context.frontierExposure);
  const objectiveValue = clamp01(context.objectiveValue);
  const chokePointValue = clamp01(context.chokePointValue);
  const consolidateBias = clamp01(context.consolidateBias);
  const reinforcementDistance = clamp01(context.reinforcementDistance);
  const productionDeficit = clamp01(context.militaryProductionDeficit);
  const offensivePressure = clamp01(context.offensivePressure);
  const forwardBaseValue = clamp01(context.forwardBaseValue);
  const localResourceValue = clamp01(context.localResourceValue);
  const resourceDeficit = clamp01(context.resourceDeficit);
  const supplyConnectivity = clamp01(context.supplyConnectivity);
  const economicExpansionNeed = clamp01(context.economicExpansionNeed);
  const overextension = clamp01(context.overextension);
  const lowStrategicValue = clamp01(context.lowStrategicValue);
  const poorSupply = clamp01(context.poorSupply);
  const constructionBacklog = clamp01(context.constructionBacklog);
  const scores = {
    defensive: (enemyThreat * 55 + frontierExposure * 30 + objectiveValue * 22 + chokePointValue * 18 + consolidateBias * 20) * chapter.defense,
    production: (reinforcementDistance * 32 + productionDeficit * 38 + offensivePressure * 24 + forwardBaseValue * 28 - enemyThreat * 10) * chapter.production,
    resource: (localResourceValue * 55 + resourceDeficit * 42 + supplyConnectivity * 18 + economicExpansionNeed * 24 - enemyThreat * 18) * chapter.resources,
    none: overextension * 38 + lowStrategicValue * 28 + poorSupply * 24 + constructionBacklog * 30 + 20
  };
  const [category, score] = bestEntry(scores);
  const buildingType = selectDevelopmentBuilding(category, context);
  return Object.freeze({
    category,
    buildingType,
    priority: category === "defensive" ? 88 : category === "production" ? 90 : category === "resource" ? 74 : 0,
    score,
    scores: Object.freeze({ ...scores }),
    reason: category === "none" ? "Captured land has insufficient strategic value for new infrastructure"
      : `${player.subfaction || "Chapter"} selected ${category} development from local threat, distance, supply, and resources`
  });
}
