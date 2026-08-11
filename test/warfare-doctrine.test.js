import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveFactionAIProfile } from "../src/ai/FactionAISystem.js";
import { resolveBattleObjectivePlan } from "../src/ai/BattleObjectiveSystem.js";
import {
  DOCTRINE_MODIFIER_FIELDS,
  RateGate,
  effectiveObjectiveFocus,
  resolveWarfareDoctrine,
  scoreTacticalOpportunity
} from "../src/ai/WarfareDoctrineSystem.js";

const doctrines = JSON.parse(await readFile(new URL("../data/ai/warfare-doctrines.json", import.meta.url), "utf8"));
const factions = JSON.parse(await readFile(new URL("../data/ai/faction-branches.json", import.meta.url), "utf8"));
const objectives = JSON.parse(await readFile(new URL("../data/ai/battle-objectives.json", import.meta.url), "utf8"));

test("PDF doctrine registry covers eight races, sixteen cadence profiles, and twenty-nine scoped subfactions", () => {
  assert.equal(doctrines.schemaVersion, 1);
  assert.equal(Object.keys(doctrines.objectiveInterpretation).length, 8);
  assert.equal(Object.keys(doctrines.tickProfiles).length, 16);
  assert.equal(Object.values(doctrines.subfactions).reduce((sum, entries) => sum + Object.keys(entries).length, 0), 29);
  for (const entries of Object.values(doctrines.subfactions)) {
    for (const profile of Object.values(entries)) {
      assert.ok(["specific", "unspecified"].includes(profile.loreStatus));
      assert.ok(doctrines.tickProfiles[profile.tick], `Unknown cadence ${profile.tick}`);
      assert.equal(Object.hasOwn(profile, "order"), false, "Subfactions must score actions rather than issue orders");
      for (const field of DOCTRINE_MODIFIER_FIELDS) assert.ok(profile[field] >= 0 && profile[field] <= 1, `${field} is outside 0..1`);
    }
  }
  for (const tick of Object.values(doctrines.tickProfiles)) {
    assert.equal(tick.coreHz, 30);
    assert.equal(tick.activeCombatSubsteps, 2);
  }
});

test("Battle Objective remains selected while race and subfaction doctrine change its method", () => {
  const worldEaters = { race: "Chaos", faction: "Chaos Space Marines", subfaction: "World Eaters", battleObjective: "stronghold_assault" };
  const alphaLegion = { ...worldEaters, subfaction: "Alpha Legion" };
  const worldProfile = resolveFactionAIProfile(worldEaters, factions, doctrines);
  const alphaProfile = resolveFactionAIProfile(alphaLegion, factions, doctrines);
  const worldPlan = resolveBattleObjectivePlan(worldEaters, worldProfile, objectives);
  const alphaPlan = resolveBattleObjectivePlan(alphaLegion, alphaProfile, objectives);
  assert.equal(worldPlan.id, "stronghold_assault");
  assert.equal(alphaPlan.id, "stronghold_assault");
  assert.equal(worldPlan.doctrine.raceMethod, "assess_shape_commit_exploit");
  assert.equal(worldPlan.doctrine.objectiveMethod, "weaken_then_overmatch_selected_sector");
  assert.notDeepEqual(worldPlan.doctrine.modifiers, alphaPlan.doctrine.modifiers);
  assert.equal(worldPlan.doctrine.tickProfileId, "chaos_berserk");
  assert.equal(alphaPlan.doctrine.tickProfileId, "chaos_deception");
});

test("opportunity scoring makes berserk and deception profiles value the same fight differently", () => {
  const world = resolveWarfareDoctrine({ race: "Chaos", faction: "Chaos Space Marines", subfaction: "World Eaters" }, doctrines);
  const alpha = resolveWarfareDoctrine({ race: "Chaos", faction: "Chaos Space Marines", subfaction: "Alpha Legion" }, doctrines);
  const exposedFight = {
    objectiveGain: 0.2,
    enemyDamagePotential: 0.95,
    defensiveGain: 0.1,
    territorialGain: 0.15,
    salvageGain: 0.1,
    expectedFriendlyLoss: 0.65,
    expectedTechLoss: 0.2,
    mobilityGain: 0.4,
    isolationRisk: 0.7,
    supplyRisk: 0.45,
    counterAttackRisk: 0.55,
    distanceFromObjective: 0.8
  };
  assert.ok(scoreTacticalOpportunity(world.modifiers, exposedFight) > scoreTacticalOpportunity(alpha.modifiers, exposedFight));
  assert.ok(effectiveObjectiveFocus(0.62, 0.8, 0.1) > 0.62);
});

test("accumulator cadence supports non-divisible rates and immediate local reevaluation", () => {
  const gate = new RateGate();
  let runs = 0;
  for (let tick = 0; tick < 30; tick += 1) if (gate.shouldRun("squad:a", 8, 1 / 30)) runs += 1;
  assert.equal(runs, 8);
  gate.requestImmediate("squad:a");
  assert.equal(gate.shouldRun("squad:a", 8, 0), true);
  assert.equal(gate.shouldRun("disabled", 0, 1), false);
});

test("browser runtime uses the PDF cadence layer and precision combat substeps", async () => {
  const app = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(app, /const simulationStep = state\.performancePreset\.id === "total" \? 1 \/ 20 : 1 \/ 30/);
  assert.match(app, /queueDoctrineCadences\(dt\)/);
  assert.match(app, /requestImmediate\(`squad:\$\{unit\.faction\}`\)/);
  assert.match(app, /activeCombatSubsteps[^]*updateProjectiles\(combatDt\)/);
});
