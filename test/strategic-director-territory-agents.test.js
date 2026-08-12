import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateBaseMaturity,
  evaluateStrategicDirector,
  scoreConstructionCandidate,
  selectConstructionIntent
} from "../src/ai/StrategicDirectorSystem.js";
import {
  chooseTerritoryAgentFallback,
  isTerritoryAgentCandidate,
  selectTerritoryAgents,
  territoryAgentContactResponse
} from "../src/ai/TerritoryAgentSystem.js";
import { scoreProjectForBuilder } from "../src/construction/BuilderAssignmentSystem.js";
import { constructionQueueCapacity } from "../src/construction/ConstructionQueueSystem.js";

test("base maturity and operational phase change construction without becoming a fixed build order", () => {
  const player = { id: "p1", race: "Imperium", faction: "Space Marines", subfaction: "White Scars" };
  const early = evaluateStrategicDirector({ player, operationalPhase: "assess", completedBuildings: 1, resourceReadiness: 0.25, armyReadiness: 0.2, territoryCells: 5 });
  const mature = evaluateStrategicDirector({ player, operationalPhase: "exploit", completedBuildings: 11, resourceReadiness: 0.9, armyReadiness: 0.8, territoryCells: 20, supplyCondition: 0.9, intelligenceConfidence: 0.8 });
  assert.ok(mature.maturity > early.maturity);
  assert.equal(early.constructionConcurrency, 2);
  assert.equal(mature.constructionConcurrency, 3);
  assert.ok(mature.roleWeights.Deployment > early.roleWeights.Deployment);
  assert.ok(calculateBaseMaturity({ completedBuildings: 13, resourceReadiness: 1, armyReadiness: 1, territoryCells: 18, supplyCondition: 1, intelligenceConfidence: 1 }) >= 0.99);
});

test("race identity changes weights while live need can override a late maturity gate", () => {
  const orks = evaluateStrategicDirector({ player: { race: "Orks", faction: "Orks", subfaction: "Goffs" }, operationalPhase: "shape", completedBuildings: 3, territoryCells: 8 });
  const marines = evaluateStrategicDirector({ player: { race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines" }, operationalPhase: "shape", completedBuildings: 3, territoryCells: 8 });
  assert.ok(orks.roleWeights.Industry > marines.roleWeights.Industry);
  const ordinarySignature = scoreConstructionCandidate({ buildingType: "signature", utility: 90, liveNeed: 20 }, marines);
  const urgentSignature = scoreConstructionCandidate({ buildingType: "signature", utility: 90, liveNeed: 92 }, marines);
  assert.ok(urgentSignature > ordinarySignature + 50);
});

test("construction intents stay sticky unless the incumbent becomes invalid", () => {
  const director = { maturity: 0.6, roleWeights: { Muster: 1, Logistics: 1 } };
  const candidates = [
    { buildingType: "barracks", operationalRole: "Muster", utility: 85, liveNeed: 70, prerequisitesSatisfied: true },
    { buildingType: "warehouse", operationalRole: "Logistics", utility: 83, liveNeed: 70, prerequisitesSatisfied: true }
  ];
  const first = selectConstructionIntent({ candidates, director, now: 10 });
  const sticky = selectConstructionIntent({ candidates: candidates.map(candidate => candidate.buildingType === "warehouse" ? { ...candidate, utility: 91 } : candidate), director, currentIntent: first, now: 12 });
  assert.equal(first.buildingType, "barracks");
  assert.equal(sticky.buildingType, "barracks");
  const replaced = selectConstructionIntent({ candidates: candidates.filter(candidate => candidate.buildingType !== "barracks"), director, currentIntent: sticky, now: 13 });
  assert.equal(replaced.buildingType, "warehouse");
});

test("builders obey director priority instead of a hard-coded building type hierarchy", () => {
  const builder = { x: 0, y: 0 };
  const urgentTower = scoreProjectForBuilder(builder, { type: "observationtower", x: 10, y: 0, priority: 95, progress: 0.1, desiredBuilders: 1 });
  const routineBarracks = scoreProjectForBuilder(builder, { type: "barracks", x: 10, y: 0, priority: 25, progress: 0.1, desiredBuilders: 1 });
  assert.ok(urgentTower > routineBarracks);
});

test("territory agents select scouts and disengage except at self-defense range", () => {
  const units = [
    { id: "builder", faction: "p1", role: "builder", name: "Servitor", alive: true, hp: 100, maxHp: 100 },
    { id: "marine", faction: "p1", role: "trooper", name: "Tactical Marine", alive: true, hp: 100, maxHp: 100 },
    { id: "scout", faction: "p1", role: "scout", name: "Scout Marine", alive: true, hp: 100, maxHp: 100 },
    { id: "probe", faction: "p1", role: "trooper", name: "Skull Probe", alive: true, hp: 100, maxHp: 100 }
  ];
  assert.equal(isTerritoryAgentCandidate(units[0]), false);
  assert.deepEqual(selectTerritoryAgents({ units, playerId: "p1", desired: 4 }).map(unit => unit.id).sort(), ["probe", "scout"]);
  const unit = { x: 0, y: 0 };
  assert.equal(territoryAgentContactResponse({ unit, enemies: [{ id: "far", x: 80, y: 0, alive: true }] }).action, "disengage");
  assert.equal(territoryAgentContactResponse({ unit, enemies: [{ id: "close", x: 20, y: 0, alive: true }] }).action, "self-defense");
  const fallback = chooseTerritoryAgentFallback({ unit, enemy: { x: 20, y: 0 }, controlledPoints: [{ x: 10, y: 0 }, { x: -40, y: 0 }], base: { x: -50, y: 0 } });
  assert.equal(fallback.x, -40);
});

test("the strategic director can cap construction bursts below territory capacity", () => {
  const structures = Array.from({ length: 13 }, (_, index) => ({ id: `s${index}`, type: index ? "barracks" : "outpost", faction: "p1", alive: true, progress: 1 }));
  const capacity = constructionQueueCapacity({ player: { id: "p1", race: "Orks" }, structures, claimedTerritoryCells: 30, strategicLimit: 4 });
  assert.equal(capacity.capacity, 4);
  assert.equal(capacity.strategicLimit, 4);
});
