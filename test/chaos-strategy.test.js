import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveFactionAIProfile } from "../src/ai/FactionAISystem.js";
import { resolveBattleObjectivePlan } from "../src/ai/BattleObjectiveSystem.js";
import { CHAOS_SUBFACTION_PROFILES } from "../src/ai/chaos/ChaosProfiles.js";
import { createChaosOperationalMemory } from "../src/ai/chaos/ChaosOperationalState.js";
import { chaosTargetMultiplier, evaluateChaosStrategy } from "../src/ai/chaos/ChaosStrategySystem.js";

const objectives = JSON.parse(await readFile(new URL("../data/ai/battle-objectives.json", import.meta.url), "utf8"));
const factions = JSON.parse(await readFile(new URL("../data/ai/faction-branches.json", import.meta.url), "utf8"));

const baseContext = {
  ownStrength: 0.7,
  observedEnemyStrength: 0.55,
  enemyPressure: 0.2,
  casualtyRatio: 0.08,
  morale: 0.8,
  supplyCondition: 0.8,
  objectiveProgress: 0.2,
  timePressure: 0.25,
  territoryOpportunity: 0.6,
  resourceShortage: 0.1,
  routeRisk: 0.2,
  enemyCohesion: 0.72,
  enemyIsolation: 0.2,
  breachProgress: 0.1,
  intelligenceConfidence: 0.8,
  localStrengthRatio: 1.1,
  offensiveMomentum: 0.7,
  overextension: 0.1
};

test("all thirteen Chaos subfactions resolve distinct base profiles", () => {
  assert.equal(Object.keys(CHAOS_SUBFACTION_PROFILES).length, 13);
  for (const subfaction of Object.keys(CHAOS_SUBFACTION_PROFILES)) {
    const player = { race: "Chaos", faction: "Chaos Space Marines", subfaction, battleObjective: "annihilation" };
    const resolved = resolveFactionAIProfile(player, factions);
    assert.equal(resolved.branch, "Chaos");
    assert.notDeepEqual(resolved.weights, factions.races.Chaos.weights);
    const plan = resolveBattleObjectivePlan(player, resolved, objectives);
    assert.ok(plan.method);
    assert.ok(Object.values(plan.signals).every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  }
});

test("Iron Warriors shape before an unsupported stronghold assault then commit after suppression", () => {
  const player = { race: "Chaos", faction: "Chaos Space Marines", subfaction: "Iron Warriors", battleObjective: "stronghold_assault" };
  const plan = resolveBattleObjectivePlan(player, resolveFactionAIProfile(player, factions), objectives);
  const memory = createChaosOperationalMemory({ phase: "shape", enteredAt: 0 });
  const shaping = evaluateChaosStrategy({ now: 20, player, plan, context: { ...baseContext, localStrengthRatio: 1.1, breachProgress: 0.1 }, memory });
  assert.equal(shaping.phase, "shape");
  assert.ok(shaping.strategicBias.logistics > shaping.strategicBias.attack);
  const committed = evaluateChaosStrategy({ now: 40, player, plan, context: { ...baseContext, localStrengthRatio: 1.05, breachProgress: 0.8 }, memory });
  assert.equal(committed.phase, "commit");
  assert.ok(committed.constructionBias.barracks > committed.constructionBias.researchcenter);
});

test("World Eaters remain objective-leashed during escort while retaining attack pressure", () => {
  const player = { race: "Chaos", faction: "Chaos Space Marines", subfaction: "World Eaters", battleObjective: "convoy_escort" };
  const plan = resolveBattleObjectivePlan(player, resolveFactionAIProfile(player, factions), objectives);
  const strategy = evaluateChaosStrategy({ now: 30, player, plan, context: { ...baseContext, localStrengthRatio: 1.2 }, memory: createChaosOperationalMemory({ phase: "shape" }) });
  assert.equal(plan.method, "route_leashed_assault_screen");
  assert.ok(strategy.strategicBias.defend > 0.8);
  assert.ok(strategy.strategicBias.attack > 1);
  assert.ok(strategy.strategicBias.expand < 1);
});

test("Chaos target policy never scores hidden information", () => {
  const player = { race: "Chaos", faction: "Chaos Space Marines", subfaction: "Alpha Legion", battleObjective: "assassination" };
  const plan = resolveBattleObjectivePlan(player, resolveFactionAIProfile(player, factions), objectives);
  const strategy = evaluateChaosStrategy({ now: 20, player, plan, context: baseContext, memory: createChaosOperationalMemory({ phase: "shape" }) });
  const commander = { role: "commander", name: "Enemy Commander", maxHp: 200 };
  assert.equal(chaosTargetMultiplier(strategy, commander, { visible: false }), 0);
  assert.ok(chaosTargetMultiplier(strategy, commander, { visible: true }) > 1);
});
