import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { builderWorkforceProfileFor } from "../src/construction/BuilderWorkforceSystem.js";
import { UNIT_CONFIG } from "../src/territory/TerritorySystem.js";
import {
  pendingTerritoryDevelopmentOrder,
  recordTerritoryDevelopment
} from "../src/territory/TerritoryDevelopmentSystem.js";
import { evaluateSpaceMarineAI } from "../src/ai/space-marines/SpaceMarineAISystem.js";
import { spaceMarineChapterDoctrineFor } from "../src/ai/space-marines/SpaceMarineChapterDoctrine.js";
import { selectSpaceMarineConstructionIntent } from "../src/ai/space-marines/SpaceMarineConstructionDirector.js";
import { evaluateSpaceMarineTerritoryDevelopment } from "../src/ai/space-marines/SpaceMarineTerritoryDoctrine.js";

const marine = { id: "a", race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines" };

test("Space Marine command maps battlefield condition to six explicit postures", () => {
  assert.equal(evaluateSpaceMarineAI({ player: marine, operationalPhase: "assess", context: { resourceHealth: 0.9, armyCondition: 0.9 } }).posture, "SECURE");
  assert.equal(evaluateSpaceMarineAI({ player: marine, operationalPhase: "shape", context: { resourceHealth: 0.6, armyCondition: 0.9 } }).posture, "EXPAND");
  assert.equal(evaluateSpaceMarineAI({ player: marine, operationalPhase: "commit", context: { resourceHealth: 0.9, armyCondition: 0.9 } }).posture, "STRIKE");
  assert.equal(evaluateSpaceMarineAI({ player: marine, operationalPhase: "exploit", context: { resourceHealth: 0.9, armyCondition: 0.9 } }).posture, "EXPLOIT");
  assert.equal(evaluateSpaceMarineAI({ player: marine, operationalPhase: "consolidate", context: { resourceHealth: 0.9, armyCondition: 0.9 } }).posture, "FORTIFY");
  assert.equal(evaluateSpaceMarineAI({ player: marine, operationalPhase: "shape", context: { resourceHealth: 0.2, armyCondition: 0.9 } }).posture, "RECOVER");
});

test("chapter identity weights choices without forbidding them", () => {
  assert.ok(spaceMarineChapterDoctrineFor("Imperial Fists").defense > 1.5);
  assert.ok(spaceMarineChapterDoctrineFor("White Scars").capture > 1.4);
  assert.ok(spaceMarineChapterDoctrineFor("Iron Hands").production > 1.2);
  assert.ok(spaceMarineChapterDoctrineFor("Blood Angels").resources > 0);
});

test("Marine construction creates sticky command intents with operational priorities", () => {
  const strategy = evaluateSpaceMarineAI({ player: marine, operationalPhase: "exploit", context: { resourceHealth: 0.9, armyCondition: 0.9 } });
  const candidates = [
    { buildingType: "researchcenter", operationalRole: "Doctrine", utility: 120, liveNeed: 45, prerequisitesSatisfied: true },
    { buildingType: "barracks", operationalRole: "Muster", utility: 80, liveNeed: 70, prerequisitesSatisfied: true }
  ];
  const first = selectSpaceMarineConstructionIntent({ player: marine, candidates, strategy, now: 10 });
  assert.equal(first.buildingType, "barracks");
  assert.ok(first.priority >= 90);
  const sticky = selectSpaceMarineConstructionIntent({
    player: marine,
    candidates: candidates.map(candidate => candidate.buildingType === "researchcenter" ? { ...candidate, utility: 300 } : candidate),
    strategy,
    currentIntent: first,
    now: 20
  });
  assert.equal(sticky.buildingType, "barracks");
  assert.ok(sticky.stickyUntil - sticky.createdAt >= 24);
});

test("captured Marine territory can become defensive, production, resource, or empty", () => {
  const decide = (subfaction, context) => evaluateSpaceMarineTerritoryDevelopment({ player: { ...marine, subfaction }, context });
  assert.equal(decide("Imperial Fists", { enemyThreat: 1, frontierExposure: 1, objectiveValue: 0.8, chokePointValue: 1, supplyConnectivity: 1 }).category, "defensive");
  assert.equal(decide("White Scars", { reinforcementDistance: 1, militaryProductionDeficit: 1, offensivePressure: 1, forwardBaseValue: 1, supplyConnectivity: 1 }).category, "production");
  const resource = decide("Iron Hands", { localResourceValue: 1, resourceDeficit: 1, supplyConnectivity: 1, economicExpansionNeed: 1, resourceType: "fuel" });
  assert.equal(resource.category, "resource");
  assert.equal(resource.buildingType, "refinery");
  assert.equal(decide("Ultramarines", { overextension: 1, lowStrategicValue: 1, poorSupply: 1, constructionBacklog: 1 }).category, "none");
});

test("every capture is evaluated and no fifth-capture defense package exists", () => {
  const player = { ...marine };
  const categories = ["none", "resource", "production", "defensive", "none"];
  categories.forEach((category, index) => recordTerritoryDevelopment(player, `${index},0`, index + 1, {
    category,
    buildingType: category === "none" ? null : category === "resource" ? "mine" : category === "production" ? "barracks" : "bunker",
    reason: category,
    priority: 70
  }));
  assert.equal(player.territoryCaptureCount, 5);
  assert.equal(player.territoryDevelopmentHistory.length, 5);
  assert.deepEqual(player.territoryDevelopmentOrders.map(order => order.buildingType), ["mine", "barracks", "bunker"]);
  const pending = pendingTerritoryDevelopmentOrder(player, []);
  assert.equal(pending.buildingType, "mine");
});

test("Marine Servitors have construction depth and physical capture is exactly three times faster", () => {
  const workforce = builderWorkforceProfileFor(marine);
  assert.equal(workforce.perBuilding, 0);
  assert.equal(workforce.startingMin, 2);
  assert.equal(workforce.startingMax, 4);
  assert.equal(workforce.hardCap, 8);
  assert.equal(workforce.reserveBase, 3);
  assert.equal(workforce.repairReserve, 2);
  assert.equal(workforce.constructionReserve, 3);
  assert.equal(UNIT_CONFIG.baseCaptureSeconds, 20);
});

test("runtime keeps Marine construction ahead of routine home maintenance", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  const builder = source.slice(source.indexOf("function updateBuilder"), source.indexOf("function cancelConstruction"));
  assert.match(builder, /homeStatus\.condition < 0\.55/);
  assert.match(builder, /homeStatus\.home\.type === "outpost" && homeStatus\.condition < 0\.7/);
  assert.match(builder, /unit\.constructionCommitUntil = state\.time \+ 25/);
  assert.ok(builder.indexOf("if (unit.buildProject)") < builder.lastIndexOf("if (marineServitor && homeStatus.needsRepair)"));
  assert.doesNotMatch(source, /every fifth|defensive package was ordered|TERRITORY_DEFENSE_INTERVAL/);
});
