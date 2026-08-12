import assert from "node:assert/strict";
import test from "node:test";

import factionConfig from "../js/modules/faction-config.js";
import {
  SUBFACTION_PRODUCTION_PLANS,
  planConstructionRoles,
  subfactionProductionPlanFor,
  validateProductionPlanData
} from "../src/ai/SubfactionProductionPlans.js";
import { buildingPrerequisitesSatisfied, chooseSubfactionBuildProject } from "../src/ai/SubfactionBuildPlanner.js";
import { analyzeProductionDemand } from "../src/ai/ProductionDemandAnalyzer.js";
import { chooseMilitaryProduction } from "../src/ai/MilitaryProductionPlanner.js";
import {
  builderHomeStatus,
  builderWorkforceDemand,
  builderWorkforceProfileFor,
  caretakerRequirementForStructure,
  reconcileBuilderHomes
} from "../src/construction/BuilderWorkforceSystem.js";

test("the supplied authored plan covers all 68 subfactions and preserves exact branches", () => {
  const validation = validateProductionPlanData();
  assert.equal(validation.valid, true, validation.issues.join("\n"));
  assert.equal(Object.keys(SUBFACTION_PRODUCTION_PLANS).length, 68);
  assert.deepEqual(planConstructionRoles("Blood Angels"), [
    "HQ", "Power", "Muster", "Logistics", "Deployment", "Doctrine", "War Forge", "Sustainment", "Intel", "Industry", "Fortification", "Emplacement", "Signature"
  ]);
  assert.deepEqual(subfactionProductionPlanFor("Iron Warriors").buildingPlan.primaryBranch, ["War Forge", "Fortification", "Emplacement"]);
  assert.match(subfactionProductionPlanFor("White Scars").productionStyle, /mobility/i);
});

test("the universal DAG supports alternative prerequisites and gates signature projects", () => {
  assert.equal(buildingPrerequisitesSatisfied("Doctrine", new Set(["HQ", "Power", "Muster"])), true);
  assert.equal(buildingPrerequisitesSatisfied("Doctrine", new Set(["HQ", "Power"])), false);
  assert.equal(buildingPrerequisitesSatisfied("War Forge", new Set(["HQ", "Power", "Logistics"])), true);
  const player = { id: "a", subfaction: "Blood Angels" };
  const structures = [{ faction: "a", type: "outpost", progress: 1, alive: true }];
  const chosen = chooseSubfactionBuildProject({ player, structures, demand: { constructionNeeds: {} }, forceState: {} });
  assert.equal(chosen.buildingType, "generator");
  assert.equal(chosen.stage, "opening");
});

test("military selection reacts to enemy armour instead of a production modulo", () => {
  const player = { id: "a", subfaction: "Ultramarines", base: { x: 0, y: 0 } };
  const ownUnits = [{ alive: true, faction: "a", role: "trooper", name: "Tactical Marine", hp: 100, maxHp: 100 }];
  const enemyUnits = Array.from({ length: 8 }, (_, index) => ({ alive: true, faction: "b", role: "vehicle", name: `Tank ${index}`, hp: 100, maxHp: 100, armorProtection: 18 }));
  const demand = analyzeProductionDemand({ player, ownUnits, enemyUnits, economy: { shortages: [] }, objectiveSignals: { attack: 0.5 } });
  const selected = chooseMilitaryProduction({ player, roster: factionConfig.astartes.roster, demand, ownUnits, availableProducerTypes: ["barracks", "workshop"] });
  assert.ok(["Hellblaster", "Predator", "Dreadnought", "Land Raider"].includes(selected.name), selected.name);
  assert.ok(selected.scoreBreakdown.battlefield > 40);
});

test("every completed Marine building receives one caretaker plus floating reserves", () => {
  const player = { id: "a", race: "Imperium", faction: "Space Marines", subfaction: "Salamanders" };
  const structures = Array.from({ length: 11 }, (_, index) => ({ id: `s${index}`, faction: "a", type: index === 2 ? "workshop" : "barracks", progress: 1, alive: true, hp: 100, maxHp: 100, x: index * 10, y: 0 }));
  const demand = builderWorkforceDemand({ player, structures });
  assert.equal(demand.caretakerRequirement, 11);
  assert.equal(demand.desired, 16);
  const builders = Array.from({ length: demand.desired }, (_, index) => ({ id: `b${index}`, faction: "a", role: "builder", alive: true, x: index * 4, y: 2 }));
  const assignment = reconcileBuilderHomes({ player, structures, builders });
  assert.equal(assignment.assigned, 11);
  assert.equal(assignment.floating, 5);
  assert.ok(structures.every(structure => builders.filter(builder => builder.homeStructureId === structure.id).length === 1));
  structures[0].hp = 60;
  assert.equal(builderHomeStatus(builders.find(builder => builder.homeStructureId === structures[0].id), structures).needsRepair, true);
});

test("Orks, Necrons, and Repair Cohort receive dense per-building workforces", () => {
  const ork = { id: "o", race: "Orks", faction: "Orks", subfaction: "Speed Freeks" };
  const necron = { id: "n", race: "Necrons", faction: "Dynastic Host", subfaction: "Repair Cohort" };
  const orkWorkshop = { faction: "o", type: "workshop", progress: 1, alive: true };
  const necronOutpost = { faction: "n", type: "outpost", progress: 1, alive: true };
  assert.equal(caretakerRequirementForStructure(ork, orkWorkshop), 3);
  assert.equal(caretakerRequirementForStructure(necron, necronOutpost), 4);
  assert.equal(builderWorkforceProfileFor(necron).repairReserve, 7);
});
