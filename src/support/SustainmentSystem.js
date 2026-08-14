const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const distanceBetween = (a = {}, b = {}) => Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0));

export const SUSTAINMENT_SERVICES = Object.freeze({
  MEDICAL: "medical",
  FIELD_REPAIR: "field-repair",
  HEAVY_REPAIR: "heavy-repair",
  ROUTE_REPAIR: "route-repair"
});

export const REPAIR_BALANCE = Object.freeze({
  builderResponseRadius: 480,
  engineerResponseRadius: 360,
  interactionPadding: 8,
  minimumBuildingHealthPerSecond: 60,
  buildingHealthFractionPerSecond: 0.12,
  unsupportedRateMultiplier: 0.7
});

const PROFILES = Object.freeze({
  "Space Marines": Object.freeze({ medicalRate: 1.45, repairRate: 1.35, buildingRate: 1.2, fieldLimit: 0.7, medicalEfficiency: 1.3, repairEfficiency: 1.2, risk: 0 }),
  "Imperial Guard": Object.freeze({ medicalRate: 1, repairRate: 1, buildingRate: 1, fieldLimit: 0.56, medicalEfficiency: 0.95, repairEfficiency: 0.92, risk: 0 }),
  "Adeptus Mechanicus": Object.freeze({ medicalRate: 0.92, repairRate: 1.7, buildingRate: 1.55, fieldLimit: 0.82, medicalEfficiency: 0.85, repairEfficiency: 1.55, risk: 0 }),
  Chaos: Object.freeze({ medicalRate: 1.12, repairRate: 1.28, buildingRate: 1.2, fieldLimit: 0.68, medicalEfficiency: 0.9, repairEfficiency: 1.05, risk: 0.03 }),
  Orks: Object.freeze({ medicalRate: 1.55, repairRate: 1.5, buildingRate: 1.38, fieldLimit: 0.7, medicalEfficiency: 0.72, repairEfficiency: 0.72, risk: 0.08 }),
  Necrons: Object.freeze({ medicalRate: 1.2, repairRate: 1.6, buildingRate: 1.42, fieldLimit: 0.86, medicalEfficiency: 1.45, repairEfficiency: 1.4, risk: 0 }),
  Tau: Object.freeze({ medicalRate: 1.28, repairRate: 1.48, buildingRate: 1.22, fieldLimit: 0.76, medicalEfficiency: 1.2, repairEfficiency: 1.32, risk: 0 }),
  Tyranids: Object.freeze({ medicalRate: 1.35, repairRate: 1.25, buildingRate: 1.3, fieldLimit: 0.78, medicalEfficiency: 1.38, repairEfficiency: 1.2, risk: 0 })
});

function branchFor(player = {}) {
  const race = String(player.race || "").toLowerCase();
  const faction = String(player.faction || "").toLowerCase();
  if (race.includes("chaos")) return "Chaos";
  if (faction.includes("space marine")) return "Space Marines";
  if (faction.includes("imperial guard")) return "Imperial Guard";
  if (faction.includes("mechanicus") || faction.includes("machine cult")) return "Adeptus Mechanicus";
  if (race.includes("ork")) return "Orks";
  if (race.includes("necron")) return "Necrons";
  if (race.includes("tau")) return "Tau";
  if (race.includes("tyranid")) return "Tyranids";
  return "Imperial Guard";
}

export function sustainmentProfileFor(player = {}) {
  return PROFILES[branchFor(player)] || PROFILES["Imperial Guard"];
}

function buildingImportance(target = {}) {
  if (target.headquarters || target.type === "outpost") return 1;
  if (["forwardoutpost", "mine", "refinery", "farm", "generator", "warehouse", "fueldepot", "ammodepot"].includes(target.type)) return 0.88;
  if (["barracks", "workshop", "dropbay", "researchcenter", "signature"].includes(target.type)) return 0.82;
  if (["bunker", "turret", "observationtower"].includes(target.type)) return 0.62;
  return 0.5;
}

export function sustainmentRequestFor(target = {}, { now = 0, underFire = false, dependencies = 0 } = {}) {
  if (!target?.id || target.alive === false || target.destroyed === true) return null;
  const maximumHealth = Math.max(1, Number(target.maxHp) || Number(target.hp) || 1);
  const healthRatio = clamp01((Number(target.hp) || 0) / maximumHealth);
  const isBuilding = Boolean(target.type && !target.role);
  const isVehicle = target.role === "vehicle";
  const damagedSystems = Object.entries(target.vehicleSystems || {}).filter(([, value]) => Number(value) < 0.75).map(([system]) => system);
  const bleeding = clamp01(target.bleeding);
  const needsMedical = !isBuilding && !isVehicle && (target.incapacitated || bleeding > 0.01 || healthRatio < 0.92);
  const needsRepair = isBuilding
    ? healthRatio < 1
    : isVehicle && (healthRatio < 0.96 || damagedSystems.length);
  if (!needsMedical && !needsRepair) return null;
  const targetType = isBuilding ? "building" : isVehicle ? "vehicle" : "infantry";
  const severity = clamp01((1 - healthRatio) * 0.78 + (target.incapacitated ? 0.3 : 0) + bleeding * 0.18 + (damagedSystems.length ? 0.18 : 0));
  const strategicValue = isBuilding ? buildingImportance(target)
    : target.role === "commander" ? 1 : target.role === "medic" || target.role === "engineer" ? 0.82 : isVehicle ? 0.8 : 0.55;
  const service = needsMedical ? SUSTAINMENT_SERVICES.MEDICAL
    : isVehicle && (healthRatio < 0.35 || damagedSystems.length >= 2) ? SUSTAINMENT_SERVICES.HEAVY_REPAIR
      : SUSTAINMENT_SERVICES.FIELD_REPAIR;
  const productionValue = isBuilding && ["mine", "refinery", "farm", "generator", "barracks", "workshop", "dropbay", "signature"].includes(target.type) ? 1 : 0;
  const priority = severity * 35 + strategicValue * 30 + productionValue * 25 + (underFire ? 20 : 0)
    + clamp01(dependencies / 4) * 20;
  const resourcesNeeded = service === SUSTAINMENT_SERVICES.MEDICAL
    ? { medical: Math.max(0.1, severity * 2) }
    : targetType === "building" ? { parts: Math.max(0.1, severity * 1.5), materials: Math.max(0.1, severity) }
      : { parts: Math.max(0.1, severity * 1.4), materials: Math.max(0.05, severity * 0.45) };
  return Object.freeze({
    id: `service:${target.id}`,
    targetId: target.id,
    faction: target.faction,
    targetType,
    service,
    severity,
    strategicValue,
    priority,
    mobility: target.incapacitated || isVehicle && damagedSystems.some(system => ["tracks", "engine", "fuel"].includes(system)) ? "immobilized" : "mobile",
    underFire: Boolean(underFire),
    damagedSystems: Object.freeze(damagedSystems),
    resourcesNeeded: Object.freeze(resourcesNeeded),
    requestedAt: now
  });
}

export function buildSustainmentRequests({ units = [], structures = [], now = 0, targetedIds = new Set(), dependencyCount = () => 0 } = {}) {
  const requests = [];
  for (const target of [...units, ...structures]) {
    const request = sustainmentRequestFor(target, {
      now,
      underFire: targetedIds.has(target.id),
      dependencies: target.type ? dependencyCount(target) : 0
    });
    if (request) requests.push(request);
  }
  return requests.sort((a, b) => b.priority - a.priority || a.requestedAt - b.requestedAt);
}

export function providerCanService(provider = {}, request = {}) {
  const identity = `${provider.role || ""} ${provider.name || ""} ${provider.specialty || ""}`.toLowerCase();
  if (request.service === SUSTAINMENT_SERVICES.MEDICAL) return provider.role === "medic" || /medic|apothecary|painboy|medical|reanim|regener/.test(identity);
  if (request.targetType === "building") return ["engineer", "builder"].includes(provider.role) || /mek|techmarine|warpsmith|cryptek|repair/.test(identity);
  return provider.role === "engineer" || /mek|techmarine|warpsmith|cryptek|repair/.test(identity);
}

export function selectSustainmentRequest(provider = {}, requests = [], { targetById = () => null, areAllies = (a, b) => a === b, maximumRange = Infinity } = {}) {
  return requests
    .filter(request => request.targetId !== provider.id && providerCanService(provider, request) && areAllies(provider.faction, request.faction))
    .map(request => {
      const target = targetById(request.targetId);
      const travelDistance = target ? distanceBetween(provider, target) : Infinity;
      return { request, target, travelDistance, score: request.priority - travelDistance * 0.1 - (request.underFire ? 8 : 0) };
    })
    .filter(candidate => candidate.target && candidate.travelDistance <= maximumRange)
    .sort((a, b) => b.score - a.score || a.travelDistance - b.travelDistance)[0] || null;
}

export function repairInteractionRange(provider = {}, target = {}) {
  const providerRadius = Math.max(2, Number(provider.collisionRadius) || 3);
  if (target.hitbox) {
    const halfWidth = Math.max(1, Number(target.hitbox.w) || 0) / 2 + providerRadius;
    const halfHeight = Math.max(1, Number(target.hitbox.h) || 0) / 2 + providerRadius;
    return Math.hypot(halfWidth, halfHeight) + REPAIR_BALANCE.interactionPadding;
  }
  return Math.max(13, providerRadius + Math.max(2, Number(target.collisionRadius) || 6) + REPAIR_BALANCE.interactionPadding);
}

export function buildingRepairRate(provider = {}, target = {}, profile = PROFILES["Imperial Guard"], supplied = true) {
  const maximumHealth = Math.max(1, Number(target.maxHp) || Number(target.hp) || 1);
  const baseRate = Math.max(
    REPAIR_BALANCE.minimumBuildingHealthPerSecond,
    maximumHealth * REPAIR_BALANCE.buildingHealthFractionPerSecond
  );
  const engineeringMultiplier = Math.max(0.85, Math.min(1.25, 0.85 + Math.max(0, Number(provider.engineering) || 0) * 0.4));
  return baseRate * Math.max(0.5, Number(profile.buildingRate) || 1) * engineeringMultiplier
    * (supplied ? 1 : REPAIR_BALANCE.unsupportedRateMultiplier);
}

export function sustainmentCostFor(request = {}, restoredHealth = 0, profile = PROFILES["Imperial Guard"]) {
  const amount = Math.max(0, Number(restoredHealth) || 0);
  if (!amount) return {};
  if (request.service === SUSTAINMENT_SERVICES.MEDICAL) return { medical: amount * 0.012 / Math.max(0.25, profile.medicalEfficiency) };
  return {
    parts: amount * 0.01 / Math.max(0.25, profile.repairEfficiency),
    materials: amount * (request.targetType === "building" ? 0.006 : 0.003) / Math.max(0.25, profile.repairEfficiency)
  };
}

export function factionSustainmentCost(player = {}, cost = {}) {
  const branch = branchFor(player);
  const total = Object.values(cost).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  if (!total) return {};
  if (branch === "Orks") return { scrap: total * 0.9, food: (cost.medical || 0) * 0.25 };
  if (branch === "Tyranids") return { biomass: total * 1.05 };
  if (branch === "Necrons") return { energy: total * 0.78, materials: total * 0.22 };
  if (branch === "Chaos" && cost.medical) return { energy: cost.medical * 0.55, food: cost.medical * 0.45 };
  return cost;
}

export function fieldServiceLimit(request = {}, profile = PROFILES["Imperial Guard"], fullServiceAvailable = false) {
  if (fullServiceAvailable) return 1;
  if (request.targetType === "building") return 1;
  return Math.max(0.35, Math.min(0.9, profile.fieldLimit));
}

export { PROFILES as SUSTAINMENT_PROFILES };
