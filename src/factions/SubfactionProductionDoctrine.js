import { producerTypesForProduction, scoreProductionCandidate } from "../ai/MilitaryProductionPlanner.js";
import {
  BUILDING_ROLE_TO_TYPE,
  PRODUCTION_FACILITIES,
  SHARED_BUILDING_DEPENDENCIES,
  SUBFACTION_PRODUCTION_PLANS,
  planConstructionRoles,
  subfactionProductionPlanFor,
  validateProductionPlanData
} from "../ai/SubfactionProductionPlans.js";

const freezeList = values => Object.freeze([...(values || [])]);
const normalize = value => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "").toLowerCase();
const SUPPORT_ROLES = Object.freeze(["builder", "supply"]);
const MILITARY_ROLES = Object.freeze(["trooper", "scout", "medic", "engineer", "commander", "standard", "vehicle"]);

// Compatibility exports now point at the authored data instead of ten synthetic archetypes.
export const SUBFACTION_BRANCH_ARCHETYPES = Object.freeze(Object.fromEntries(
  Object.entries(SUBFACTION_PRODUCTION_PLANS).map(([name, plan]) => [name, plan.productionStyle])
));
export const SUBFACTION_PRODUCTION_ARCHETYPES = Object.freeze({
  sharedDependencies: SHARED_BUILDING_DEPENDENCIES,
  facilities: PRODUCTION_FACILITIES
});

function rosterEntries(roster = {}, roles = MILITARY_ROLES) {
  return roles.flatMap(role => (roster[role] || []).map(name => Object.freeze({ role, name })));
}

function authoredMilitaryOrder(plan, roster) {
  return rosterEntries(roster).map(member => ({ member, scored: scoreProductionCandidate(member, { plan, demand: {}, ownUnits: [] }) }))
    .sort((a, b) => b.scored.score - a.scored.score || String(a.member.name).localeCompare(String(b.member.name)))
    .map(entry => entry.member);
}

export function subfactionArchetypeFor(playerOrSubfaction = {}) {
  return subfactionProductionPlanFor(playerOrSubfaction)?.productionStyle || "adaptive combined arms";
}

export function productionProducerTypesFor(member = {}) {
  return producerTypesForProduction(member);
}

export function productionBranchFor(player = {}, roster = {}) {
  const plan = subfactionProductionPlanFor(player);
  const subfaction = plan?.name || player.subfaction || "Default";
  const constructionRoles = plan ? planConstructionRoles(plan) : Object.keys(BUILDING_ROLE_TO_TYPE);
  const constructionOrder = constructionRoles.map(role => BUILDING_ROLE_TO_TYPE[role]).filter(Boolean);
  const productionSchedule = authoredMilitaryOrder(plan, roster);
  const supportOrder = rosterEntries(roster, SUPPORT_ROLES);
  const unitOrder = productionSchedule.filter(member => member.role !== "vehicle");
  const vehicleOrder = productionSchedule.filter(member => member.role === "vehicle");
  return Object.freeze({
    id: `${normalize(subfaction) || "default"}:authored-v1`,
    subfaction,
    archetype: plan?.productionStyle || "adaptive",
    constructionRoles: freezeList(constructionRoles),
    constructionOrder: freezeList(constructionOrder),
    unitPriority: freezeList(plan?.unitPriority),
    vehiclePriority: freezeList(plan?.vehiclePriority),
    unitOrder: freezeList(unitOrder),
    vehicleOrder: freezeList(vehicleOrder),
    supportOrder: freezeList(supportOrder),
    productionSchedule: freezeList(productionSchedule),
    completeRosterOrder: freezeList([...supportOrder, ...productionSchedule]),
    notes: plan?.notes || ""
  });
}

// Compatibility only. Runtime production uses MilitaryProductionPlanner and live demand,
// so this sequence is never the reason a unit is selected in battle.
export function nextProductionDirectiveFor(player = {}, roster = {}, sequence = 0) {
  const branch = productionBranchFor(player, roster);
  if (!branch.productionSchedule.length) return null;
  const directive = branch.productionSchedule[Math.max(0, Math.floor(Number(sequence) || 0)) % branch.productionSchedule.length];
  return Object.freeze({ ...directive, producerTypes: productionProducerTypesFor(directive), branchId: branch.id, archetype: branch.archetype });
}

export function constructionOrderFor(player = {}) {
  return productionBranchFor(typeof player === "string" ? { subfaction: player } : player).constructionOrder;
}

export function validateSubfactionProductionBranches(rosterFor, expectedProfiles = 68) {
  const dataValidation = validateProductionPlanData(expectedProfiles);
  const issues = [...dataValidation.issues];
  for (const subfaction of Object.keys(SUBFACTION_PRODUCTION_PLANS)) {
    const roster = typeof rosterFor === "function" ? rosterFor(subfaction) : rosterFor?.[subfaction] || rosterFor || {};
    const branch = productionBranchFor({ subfaction }, roster);
    if (branch.constructionOrder.length !== 13 || new Set(branch.constructionOrder).size !== 13) issues.push(`${subfaction} does not map to thirteen unique runtime buildings.`);
    const expectedRoster = [...SUPPORT_ROLES, ...MILITARY_ROLES].flatMap(role => (roster[role] || []).map(name => `${role}:${name}`));
    const actualRoster = branch.completeRosterOrder.map(entry => `${entry.role}:${entry.name}`);
    for (const entry of expectedRoster) if (!actualRoster.includes(entry)) issues.push(`${subfaction} production branch omits ${entry}.`);
  }
  return Object.freeze({ valid: issues.length === 0, count: dataValidation.count, issues: freezeList(issues) });
}

