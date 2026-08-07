import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveFactionAIProfile, selectStrategicChoice } from "../src/ai/FactionAISystem.js";
import {
  deriveDynamicAIBehavior,
  evaluateBattleObjective,
  objectiveOptionsFor,
  objectiveStrategicBias,
  resolveBattleObjectivePlan
} from "../src/ai/BattleObjectiveSystem.js";

const objectives = JSON.parse(await readFile(new URL("../data/ai/battle-objectives.json", import.meta.url), "utf8"));
const factions = JSON.parse(await readFile(new URL("../data/ai/faction-branches.json", import.meta.url), "utf8"));

test("battle objectives replace setup-authored doctrine and temperament controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(html, /id="awt-player-battle-objective"/);
  assert.doesNotMatch(html, /id="awt-player-doctrine"|id="awt-player-ai-preset"|id="awt-ai-(aggression|caution|expansion|economy)"/);
  assert.doesNotMatch(app, /playerDoctrine|playerAiPreset|player\.doctrine\s*=/);
});

test("all universal objectives receive race-specific names and plans", () => {
  const marine = { race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines", battleObjective: "stronghold_assault" };
  const options = objectiveOptionsFor(marine, objectives);
  assert.equal(options.length, 18);
  const profile = resolveFactionAIProfile(marine, factions);
  const plan = resolveBattleObjectivePlan(marine, profile, objectives);
  assert.equal(plan.id, "stronghold_assault");
  assert.ok(plan.method);
  assert.ok(plan.signals.attack > plan.signals.expansion);
});

test("subfactions pursue the same objective through different methods", () => {
  const imperialFist = { race: "Imperium", faction: "Space Marines", subfaction: "Imperial Fists", battleObjective: "stronghold_assault" };
  const bloodAngel = { race: "Imperium", faction: "Space Marines", subfaction: "Blood Angels", battleObjective: "stronghold_assault" };
  const fistPlan = resolveBattleObjectivePlan(imperialFist, resolveFactionAIProfile(imperialFist, factions), objectives);
  const angelPlan = resolveBattleObjectivePlan(bloodAngel, resolveFactionAIProfile(bloodAngel, factions), objectives);
  assert.notEqual(fistPlan.method, angelPlan.method);
  assert.notDeepEqual(fistPlan.behaviorModifiers, angelPlan.behaviorModifiers);
});

test("temperament adapts to battle state and objective biases strategic choice", () => {
  const player = { race: "T'au", faction: "Frontier Cadre", subfaction: "T'au Sept", battleObjective: "convoy_escort" };
  const profile = resolveFactionAIProfile(player, factions);
  const plan = resolveBattleObjectivePlan(player, profile, objectives);
  const stable = deriveDynamicAIBehavior(profile, plan, { morale: 0.9, supplyCondition: 0.9 });
  const pressured = deriveDynamicAIBehavior(profile, plan, { casualtyRatio: 0.7, morale: 0.2, supplyCondition: 0.2, enemyPressure: 0.8, routeRisk: 0.9 });
  assert.ok(pressured.caution > stable.caution);
  assert.ok(pressured.economy > stable.economy);
  const objectiveBias = objectiveStrategicBias(plan);
  assert.ok(objectiveBias.logistics > objectiveBias.attack);
  assert.ok(objectiveBias.defend > objectiveBias.attack);
  const context = { ownStrength: 0.5, observedEnemyStrength: 0.5, enemyPressure: 0.7, resourceShortage: 0.6, routeRisk: 0.8, territoryOpportunity: 0.5, objectiveBias };
  const decision = selectStrategicChoice(profile, context);
  assert.ok(["defend", "logistics", "regroup"].includes(decision.choice));
});

test("hold objectives require continuous control for their authored duration", () => {
  const player = { race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines", battleObjective: "strategic_point_control" };
  const plan = resolveBattleObjectivePlan(player, resolveFactionAIProfile(player, factions), objectives);
  const started = evaluateBattleObjective(plan, { valid: true, elapsedSeconds: 20, strategicPointControl: 0.8 });
  assert.equal(started.complete, false);
  const completed = evaluateBattleObjective(plan, { valid: true, elapsedSeconds: 141, strategicPointControl: 0.8 }, started);
  assert.equal(completed.complete, true);
});
