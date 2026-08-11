import productionPlanData from "../../data/ai/subfaction-production-plans.json" with { type: "json" };

const freezeList = values => Object.freeze([...(values || [])]);
const normalize = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "").toLowerCase();

export const BUILDING_ROLE_TO_TYPE = Object.freeze({
  HQ: "outpost",
  Power: "generator",
  Logistics: "warehouse",
  Muster: "barracks",
  Industry: "refinery",
  Doctrine: "researchcenter",
  "War Forge": "workshop",
  Sustainment: "fieldhospital",
  Intel: "observationtower",
  Deployment: "dropbay",
  Fortification: "bunker",
  Emplacement: "turret",
  Signature: "signature"
});

export const BUILDING_TYPE_TO_ROLE = Object.freeze(Object.fromEntries(
  Object.entries(BUILDING_ROLE_TO_TYPE).map(([role, type]) => [type, role])
));

function freezeRequirements(requirements = {}) {
  return Object.freeze({
    requiresAll: freezeList(requirements.requiresAll),
    requiresAny: freezeList(requirements.requiresAny),
    priorityGate: requirements.priorityGate || null
  });
}

export const SHARED_BUILDING_DEPENDENCIES = Object.freeze(Object.fromEntries(
  Object.entries(productionPlanData.sharedBuildingDependencies || {}).map(([role, requirements]) => [role, freezeRequirements(requirements)])
));

function freezeBuildingPlan(buildingPlan = {}) {
  return Object.freeze({
    opening: freezeList(buildingPlan.opening),
    primaryBranch: freezeList(buildingPlan.primaryBranch),
    secondaryBranch: freezeList(buildingPlan.secondaryBranch),
    lateBranch: freezeList(buildingPlan.lateBranch),
    fallbackFullOrder: freezeList(buildingPlan.fallbackFullOrder)
  });
}

export const SUBFACTION_PRODUCTION_PLANS = Object.freeze(Object.fromEntries(
  Object.entries(productionPlanData.subfactions || {}).map(([name, plan]) => [name, Object.freeze({
    name,
    race: plan.race,
    buildingPlan: freezeBuildingPlan(plan.buildingPlan),
    unitPriority: freezeList(plan.unitPriority),
    vehiclePriority: freezeList(plan.vehiclePriority),
    productionStyle: plan.productionStyle || "adaptive combined arms",
    notes: plan.notes || ""
  })])
));

const NORMALIZED_PLANS = new Map(Object.entries(SUBFACTION_PRODUCTION_PLANS).map(([name, plan]) => [normalize(name), plan]));

export const PRODUCTION_FACILITIES = Object.freeze(Object.fromEntries(
  Object.entries(productionPlanData.productionFacilities || {}).map(([role, responsibilities]) => [role, freezeList(responsibilities)])
));

export function subfactionProductionPlanFor(playerOrSubfaction = {}) {
  const subfaction = typeof playerOrSubfaction === "string" ? playerOrSubfaction : playerOrSubfaction?.subfaction;
  return NORMALIZED_PLANS.get(normalize(subfaction)) || null;
}

export function buildingTypeForOperationalRole(role) {
  return BUILDING_ROLE_TO_TYPE[role] || null;
}

export function operationalRoleForBuildingType(type) {
  return BUILDING_TYPE_TO_ROLE[type] || null;
}

export function buildingRequirementsFor(roleOrType) {
  const role = BUILDING_TYPE_TO_ROLE[roleOrType] || roleOrType;
  return SHARED_BUILDING_DEPENDENCIES[role] || freezeRequirements();
}

export function planConstructionRoles(planOrPlayer = {}) {
  const plan = planOrPlayer?.buildingPlan ? planOrPlayer : subfactionProductionPlanFor(planOrPlayer);
  if (!plan) return freezeList([]);
  return freezeList(["HQ", ...plan.buildingPlan.opening, ...plan.buildingPlan.primaryBranch,
    ...plan.buildingPlan.secondaryBranch, ...plan.buildingPlan.lateBranch]
    .filter((role, index, roles) => roles.indexOf(role) === index));
}

export function validateProductionPlanData(expectedCount = 68) {
  const issues = [];
  const plans = Object.values(SUBFACTION_PRODUCTION_PLANS);
  const allRoles = Object.keys(BUILDING_ROLE_TO_TYPE);
  if (plans.length !== expectedCount) issues.push(`Expected ${expectedCount} production plans, found ${plans.length}.`);
  for (const plan of plans) {
    const fullOrder = plan.buildingPlan.fallbackFullOrder;
    if (fullOrder.length !== allRoles.length || allRoles.some(role => !fullOrder.includes(role))) issues.push(`${plan.name} does not define all ${allRoles.length} building roles.`);
    for (const role of fullOrder) if (!BUILDING_ROLE_TO_TYPE[role]) issues.push(`${plan.name} references unknown building role ${role}.`);
    if (!plan.unitPriority.length) issues.push(`${plan.name} has no unit priorities.`);
    if (!plan.vehiclePriority.length) issues.push(`${plan.name} has no vehicle priorities.`);
  }
  for (const [role, requirements] of Object.entries(SHARED_BUILDING_DEPENDENCIES)) {
    for (const dependency of [...requirements.requiresAll, ...requirements.requiresAny]) if (!BUILDING_ROLE_TO_TYPE[dependency]) issues.push(`${role} depends on unknown role ${dependency}.`);
  }
  return Object.freeze({ valid: issues.length === 0, count: plans.length, issues: freezeList(issues) });
}

export const SUBFACTION_PRODUCTION_PLAN_DATA_VERSION = productionPlanData.version;

