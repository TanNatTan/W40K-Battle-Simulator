import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { applyBuildingDiversity, evaluateBuildingDiversity } from "../src/construction/BuildingDiversitySystem.js";
import { builderWorkforceDemand, builderWorkforceProfileFor, startingBuilderCountFor } from "../src/construction/BuilderWorkforceSystem.js";
import { vehicleCompositionFor } from "../src/ai/ArmyCompositionSystem.js";
import { analyzeProductionDemand } from "../src/ai/ProductionDemandAnalyzer.js";
import { COMMITMENT_STAGES } from "../src/ai/ForceCommitmentSystem.js";
import { evaluateDecisionWorkflow } from "../src/ai/DecisionWorkflowSystem.js";
import { combinedArmsSupportDistance, vehicleBattlefieldPurpose } from "../src/formations/FormationSystem.js";
import { SIMULATION_DATABASE_STORES, factionAnalyticsRecord } from "../src/persistence/SimulationDatabase.js";

const marine = { id: "a", race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines", base: { x: 0, y: 0 } };

test("building diversity blocks a fourth duplicate until every currently eligible facility is represented", () => {
  const candidates = ["barracks", "generator", "workshop"].map((buildingType, index) => ({
    buildingType, utility: 100 - index * 10, prerequisitesSatisfied: true, dependenciesCanEverBeSatisfied: true
  }));
  const threeBarracks = Array.from({ length: 3 }, (_, index) => ({ id: `b${index}`, faction: "a", type: "barracks", alive: true, progress: 1 }));
  const diversified = applyBuildingDiversity(candidates, threeBarracks, "a");
  assert.equal(diversified.some(candidate => candidate.buildingType === "barracks"), false);
  assert.ok(diversified.every(candidate => candidate.diversity.copies === 0));
  const completeRoster = [...threeBarracks,
    { id: "g", faction: "a", type: "generator", alive: true },
    { id: "w", faction: "a", type: "workshop", alive: true }];
  assert.equal(evaluateBuildingDiversity({ type: "barracks", counts: { barracks: 3, generator: 1, workshop: 1 },
    eligibleTypes: ["barracks", "generator", "workshop"] }).blocked, false);
  assert.equal(applyBuildingDiversity(candidates, completeRoster, "a").some(candidate => candidate.buildingType === "barracks"), true);
});

test("faction builder policy starts in authored ranges, scales only to workload, and never exceeds twice its maximum start", () => {
  const guard = { id: "g", race: "Imperium", faction: "Imperial Guard" };
  const ork = { id: "o", race: "Orks", faction: "Orks" };
  assert.equal(startingBuilderCountFor(marine, () => 0), 2);
  assert.equal(startingBuilderCountFor(marine, () => 0.999), 4);
  assert.equal(startingBuilderCountFor(guard, () => 0), 1);
  assert.equal(startingBuilderCountFor(guard, () => 0.999), 2);
  assert.equal(startingBuilderCountFor(ork, () => 0), 6);
  assert.equal(startingBuilderCountFor(ork, () => 0.999), 8);
  assert.equal(builderWorkforceProfileFor(marine).hardCap, 8);
  assert.equal(builderWorkforceProfileFor(guard).hardCap, 4);
  assert.equal(builderWorkforceProfileFor(ork).hardCap, 16);
  const overloaded = builderWorkforceDemand({ player: marine, configuredTarget: 7, activeProjects: 30,
    damagedStructures: 12, harvestSourceCount: 20, emergency: true });
  assert.equal(overloaded.desired, 8);
  assert.equal(overloaded.replaceDead, true);
});

test("vehicle composition and corrected commitment create meaningful armor production pressure", () => {
  const infantry = Array.from({ length: 30 }, (_, index) => ({ id: index, faction: "a", role: "trooper", alive: true, hp: 100, maxHp: 100 }));
  const composition = vehicleCompositionFor(marine, infantry);
  assert.equal(composition.expectedVehicles, 7);
  assert.equal(composition.vehicleDeficit, 1);
  const demand = analyzeProductionDemand({ player: marine, ownUnits: infantry, forceState: { commitment: 0.88 }, economy: { shortages: [] } });
  assert.equal(demand.signals.commitment, 0.88);
  assert.equal(demand.signals.vehicleDeficit, 1);
  assert.ok(demand.tokenScores.vehicle > demand.tokenScores.battleline);
  assert.ok(demand.constructionNeeds["War Forge"] >= 95);
  assert.deepEqual(Object.values(COMMITMENT_STAGES).map(stage => stage.commitment), [0.55, 0.72, 0.88, 0.97, 1]);
});

test("vehicles receive battlefield purposes and transports close to embarkation range", () => {
  const rhino = { name: "Rhino", role: "vehicle", vehicleState: { type: "transport", passengerCapacity: 10 } };
  const predator = { name: "Predator", role: "vehicle", vehicleState: { type: "tank", passengerCapacity: 0 } };
  const whirlwind = { name: "Whirlwind", role: "vehicle", vehicleState: { type: "artillery", passengerCapacity: 0 } };
  assert.match(vehicleBattlefieldPurpose(rhino), /transport/);
  assert.match(vehicleBattlefieldPurpose(predator), /armored fire support/);
  assert.match(vehicleBattlefieldPurpose(whirlwind), /standoff/);
  assert.equal(combinedArmsSupportDistance(rhino), 38);
  assert.equal(combinedArmsSupportDistance(whirlwind), 145);
});

test("the shared workflow prioritizes current needs and analytics has durable IndexedDB stores", () => {
  const workflow = evaluateDecisionWorkflow({ player: marine, economy: { health: 0.8, shortage: 0.1, builderDeficit: 0.3 },
    territory: { opportunity: 0.6, pressure: 0.2 }, military: { readiness: 0.7, vehicleDeficit: 1 }, enemy: { pressure: 0.2 },
    construction: { diversityNeed: 1 } });
  assert.equal(workflow.current.id, "produce-vehicles");
  assert.ok(workflow.queue.some(item => item.id === "build-unique-facility"));
  assert.deepEqual(SIMULATION_DATABASE_STORES, ["battleSnapshots", "factionAnalytics", "maps", "replays", "settings"]);
  const analytics = factionAnalyticsRecord({ battleId: "battle", at: 12, player: { ...marine, decisionWorkflow: workflow },
    units: [{ faction: "a", role: "vehicle", alive: true }, { faction: "a", role: "builder", alive: true }],
    structures: [{ faction: "a", alive: true }], territoryCells: 4, casualties: 2 });
  assert.equal(analytics.vehicles, 1);
  assert.equal(analytics.builders, 1);
  assert.equal(analytics.workflow, "produce-vehicles");
});

test("runtime relocates the existing headquarters, persists workflow analytics, and applies per-player scale budgets", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  const moveSpawn = source.slice(source.indexOf("function moveSpawn"), source.indexOf("function addCustomZonePoint"));
  assert.match(moveSpawn, /structure\.id === player\.headquartersId/);
  assert.match(moveSpawn, /randomPointInsideSpawnZone\(player, headquarters\.hitbox, battleRandom\)/);
  assert.match(moveSpawn, /headquarters\.x = headquartersPoint\.x/);
  assert.doesNotMatch(moveSpawn, /state\.structures\.push/);
  assert.match(source, /state\.battleScale\.targetUnits \* state\.players\.length/);
  assert.match(source, /player\.builderTarget = Math\.min\(demand\.hardCap/);
  assert.match(source, /evaluateDecisionWorkflow\(\{/);
  assert.match(source, /simulationDatabase\.saveFactionAnalytics/);
  assert.match(source, /transportDeploymentPoint/);
});
