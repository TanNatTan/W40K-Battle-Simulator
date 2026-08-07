const DEFAULT_PRODUCTION_TYPES = Object.freeze([
  "barracks", "workshop", "dropbay", "factory", "vehiclebay", "airfield"
]);

const alive = entity => entity?.alive !== false && entity?.destroyed !== true;
const operational = entity => alive(entity) && (entity.progress ?? 1) >= 1 && (entity.condition ?? 1) > 0.2;

export const ENDGAME_ACTIONS = Object.freeze([
  "hunt-survivors",
  "search-fog",
  "destroy-production",
  "block-extraction",
  "secure-routes",
  "resolve-incapacitated-threats"
]);

export const INCAPACITATED_POLICIES = Object.freeze({
  "Space Marines": "secure-and-recover-gene-seed",
  "Imperial Guard": "disarm-and-detain",
  Chaos: "sacrifice-or-finish",
  Orks: "finish-dangerous-rivals",
  Necrons: "phase-capture-or-disintegrate",
  Tau: "capture-and-disarm",
  Tyranids: "consume-biomass"
});

export function assessFactionCapability({
  factionId,
  units = [],
  structures = [],
  reinforcementAccess = [],
  productionTypes = DEFAULT_PRODUCTION_TYPES,
  isAllied = () => false
} = {}) {
  const ownUnits = units.filter(unit => unit.faction === factionId && alive(unit));
  const combatForces = ownUnits.filter(unit => !unit.incapacitated
    && unit.combatCapable !== false
    && (unit.damage > 0 || unit.role === "vehicle" || unit.role === "commander")
    && (unit.ammo > 0 || unit.meleeCapable || unit.role === "vehicle"));
  const builders = ownUnits.filter(unit => !unit.incapacitated && unit.role === "builder" && unit.canBuild !== false);
  const production = structures.filter(structure => structure.faction === factionId
    && productionTypes.includes(structure.type) && operational(structure));
  const reinforcements = reinforcementAccess.filter(access => access.faction === factionId
    && access.active !== false && access.blocked !== true && (access.condition ?? 1) > 0.2);
  const alliedRescue = units.filter(unit => unit.faction !== factionId && alive(unit) && !unit.incapacitated
    && isAllied(unit.faction, factionId) && unit.combatCapable !== false && (unit.damage > 0 || unit.role === "vehicle"));
  const recoveryPossible = builders.length > 0 && (structures.some(structure => structure.faction === factionId && operational(structure))
    || ownUnits.some(unit => unit.carriesBuildingMaterials || unit.buildResources > 0));
  const conditions = Object.freeze({
    noCombatCapableForces: combatForces.length === 0,
    noOperationalProduction: production.length === 0,
    noReinforcementAccess: reinforcements.length === 0,
    noBuildersCapableOfRecovery: builders.length === 0 || !recoveryPossible,
    noAlliedRescueForce: alliedRescue.length === 0
  });
  return {
    factionId,
    defeated: Object.values(conditions).every(Boolean),
    conditions,
    counts: {
      combatForces: combatForces.length,
      production: production.length,
      reinforcementAccess: reinforcements.length,
      recoveryBuilders: recoveryPossible ? builders.length : 0,
      alliedRescue: alliedRescue.length
    }
  };
}

export function chooseEndgameDirective({
  race = "Space Marines",
  visibleSurvivors = [],
  knownProduction = [],
  extractionAccess = [],
  threatenedRoutes = [],
  fogSearchPoints = [],
  incapacitatedThreats = []
} = {}) {
  let action = "secure-routes";
  let target = threatenedRoutes[0] || null;
  if (visibleSurvivors.length) {
    action = "hunt-survivors";
    target = visibleSurvivors[0];
  } else if (knownProduction.length) {
    action = "destroy-production";
    target = knownProduction[0];
  } else if (extractionAccess.length) {
    action = "block-extraction";
    target = extractionAccess[0];
  } else if (fogSearchPoints.length) {
    action = "search-fog";
    target = fogSearchPoints[0];
  } else if (incapacitatedThreats.length) {
    action = "resolve-incapacitated-threats";
    target = incapacitatedThreats[0];
  }
  return {
    action,
    target,
    targetId: target?.id ?? null,
    policy: INCAPACITATED_POLICIES[race] || "disarm-and-detain",
    goal: {
      "hunt-survivors": "Hunt remaining combat-capable enemies",
      "search-fog": "Search fogged sectors for surviving forces",
      "destroy-production": "Destroy remaining enemy production",
      "block-extraction": "Block enemy extraction and reinforcement access",
      "secure-routes": "Secure routes and deny recovery",
      "resolve-incapacitated-threats": "Resolve incapacitated military threats by faction policy"
    }[action]
  };
}
