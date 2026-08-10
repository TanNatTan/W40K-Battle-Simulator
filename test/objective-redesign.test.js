import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveFactionAIProfile } from "../src/ai/FactionAISystem.js";
import { resolveBattleObjectivePlan } from "../src/ai/BattleObjectiveSystem.js";
import { applyObjectiveLeash, createOperationalMemory, evaluateOperationalPhase } from "../src/ai/OperationalPhaseSystem.js";
import { CHAOS_PROFILE_ACTIONS, createChaosStrategicState, selectChaosAction } from "../src/ai/chaos/ChaosCapabilitySystem.js";

const objectives = JSON.parse(await readFile(new URL("../data/ai/battle-objectives.json", import.meta.url), "utf8"));
const factions = JSON.parse(await readFile(new URL("../data/ai/faction-branches.json", import.meta.url), "utf8"));

const playableSamples = [
  { race: "Imperium", faction: "Space Marines", subfaction: "Ultramarines" },
  { race: "Imperium", faction: "Imperial Guard", subfaction: "Cadian" },
  { race: "Chaos", faction: "Chaos Space Marines", subfaction: "Word Bearers" },
  { race: "Orks", faction: "Orks", subfaction: "Goffs" },
  { race: "Necrons", faction: "Necrons", subfaction: "Sautekh" },
  { race: "T'au", faction: "Tau", subfaction: "Farsight Enclaves" },
  { race: "Tyranids", faction: "Tyranids", subfaction: "Kraken" }
];

test("every playable race sample resolves all eighteen objectives with a method and leash", () => {
  assert.equal(Object.keys(objectives.objectives).length, 18);
  for (const sample of playableSamples) {
    for (const objectiveId of Object.keys(objectives.objectives)) {
      const player = { ...sample, battleObjective: objectiveId };
      const plan = resolveBattleObjectivePlan(player, resolveFactionAIProfile(player, factions), objectives);
      const operation = evaluateOperationalPhase({ plan, context: {}, memory: createOperationalMemory() });
      assert.ok(plan.method, `${sample.subfaction}/${objectiveId} lacks a method`);
      assert.equal(operation.objectiveLeash.objectiveId, objectiveId);
      assert.equal(operation.objectiveLeash.canAbandon, false);
      assert.ok(operation.objectiveLeash.primaryChoices.length > 0);
    }
  }
});

test("operational phases move from assessment to endgame while preserving objective utility", () => {
  const plan = resolveBattleObjectivePlan({ ...playableSamples[0], battleObjective: "convoy_escort" }, null, objectives);
  const memory = createOperationalMemory();
  assert.equal(evaluateOperationalPhase({ now: 0, plan, context: {}, memory }).phase, "assess");
  assert.equal(evaluateOperationalPhase({ now: 15, plan, context: { intelligenceConfidence: 0.8 }, memory }).phase, "shape");
  assert.equal(evaluateOperationalPhase({ now: 30, plan, context: { localStrengthRatio: 1.2 }, memory }).phase, "commit");
  const finished = evaluateOperationalPhase({ now: 50, plan, context: { objectiveProgress: 0.95 }, memory });
  assert.equal(finished.phase, "endgame");
  const leashed = applyObjectiveLeash({ attack: 0.1, defend: 0.1, logistics: 0.1 }, finished.objectiveLeash);
  for (const choice of finished.objectiveLeash.primaryChoices) assert.ok(leashed[choice] >= finished.objectiveLeash.minimumBias);
});

test("each Chaos branch has at least three capability-gated actions", () => {
  assert.equal(Object.keys(CHAOS_PROFILE_ACTIONS).length, 13);
  for (const [profileId, actions] of Object.entries(CHAOS_PROFILE_ACTIONS)) {
    assert.ok(new Set(actions).size >= 3, `${profileId} lacks distinct actions`);
  }
  const ritualState = createChaosStrategicState({ ritualCharge: 0.8, daemonReservePower: 0.7, sacrificeValue: 0.5, corruptionByTerritory: { alpha: 0.8 } });
  const wordBearers = selectChaosAction("word-bearers", "commit", ritualState, { intelligenceConfidence: 0.8 }, 20);
  assert.ok(wordBearers.available.some(action => action.id === "summon_daemon_reserve"));
  const ironWarriors = selectChaosAction("iron-warriors", "shape", createChaosStrategicState(), { breachProgress: 0.1 }, 20);
  assert.ok(ironWarriors.available.some(action => action.id === "prepare_battery"));
  assert.notEqual(wordBearers.selected.id, ironWarriors.selected.id);
});
