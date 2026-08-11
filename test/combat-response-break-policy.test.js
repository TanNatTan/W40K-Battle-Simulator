import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BREAK_POLICY_IDS,
  breakPolicyFor,
  commissarInterventionFor,
  createPsychologyState,
  updateFactionPressure,
  withdrawalDecisionFor
} from "../src/ai/FactionBreakPolicy.js";
import {
  COMBAT_RESPONSES,
  combatContactPhase,
  combatContactPoint,
  evaluateCombatResponse,
  refreshSquadCombatContact
} from "../src/ai/CombatResponseSystem.js";

const marinePlayer = { race: "Imperium", faction: "Space Marines" };
const guardPlayer = { race: "Imperium", faction: "Imperial Guard" };

test("only Imperial Guard uses fear-driven combat stress and rout", () => {
  assert.equal(breakPolicyFor(marinePlayer).usesFear, false);
  assert.equal(breakPolicyFor(guardPlayer).usesFear, true);
  assert.equal(breakPolicyFor({ race: "Chaos", faction: "Chaos Space Marines" }).usesFear, false);
  assert.equal(breakPolicyFor({ race: "Orks", faction: "Redfang Horde" }).usesFear, false);
  assert.equal(breakPolicyFor({ race: "Tau", faction: "Tau Cadre" }).usesFear, false);

  const marine = { hp: 100, maxHp: 100, morale: 0.01, ammo: 8 };
  assert.equal(withdrawalDecisionFor(marine, marinePlayer, { hasRangedWeapon: true }), null);
  const guard = { hp: 100, maxHp: 100, combatStress: 94, breakThreshold: 82, ammo: 8 };
  assert.equal(withdrawalDecisionFor(guard, guardPlayer, { hasRangedWeapon: true }), "ROUT");
});

test("non-Guard psychology contains resolve but no universal fear property", () => {
  const marine = createPsychologyState(marinePlayer, () => 0.5);
  const guard = createPsychologyState(guardPlayer, () => 0.5);
  assert.equal(marine.breakPolicyId, BREAK_POLICY_IDS.ASTARTES);
  assert.equal("fear" in marine, false);
  assert.equal("combatStress" in marine, false);
  assert.equal(guard.breakPolicyId, BREAK_POLICY_IDS.GUARD);
  assert.equal(guard.combatStress, 0);
  const pressured = updateFactionPressure(guard, guardPlayer, { hostilePower: 5, friendlyPower: 1, suppression: 1, isolated: true }, 1);
  assert.ok(pressured.combatStress > 0);
});

test("Commissars rally wavering Guardsmen and execute only a genuine rout", () => {
  const commissar = { id: "c", alive: true, name: "Commissar Varn", discipline: 0.95, commandRank: 4 };
  const wavering = [{ id: "g1", alive: true, breakState: "ROUT", combatStress: 91, resolve: 0.6 }];
  assert.equal(commissarInterventionFor({ members: wavering, commissar, now: 20 }).action, "RALLY");
  const routed = [{ id: "g1", alive: true, breakState: "ROUT", combatStress: 100, resolve: 0.2 }];
  const execution = commissarInterventionFor({ members: routed, commissar: { ...commissar, discipline: 0.4 }, now: 20 });
  assert.equal(execution.action, "SUMMARY_EXECUTION");
  assert.equal(execution.candidateId, "g1");
});

test("visible enemies always produce a concrete response instead of Ignore", () => {
  const unit = { id: "m1", squadId: "s1", x: 0, y: 0, range: 100, damage: 12, ammo: 8 };
  const enemy = { id: "o1", alive: true, x: 30, y: 0, hp: 100, maxHp: 100, range: 20, role: "trooper" };
  const defensive = evaluateCombatResponse({ unit, squad: {}, visibleEnemies: [enemy], context: { confidence: 15 } });
  assert.ok([COMBAT_RESPONSES.TAKE_COVER, COMBAT_RESPONSES.CONTAIN].includes(defensive.action));
  assert.notEqual(defensive.action, "IGNORE");
  const finish = evaluateCombatResponse({ unit, squad: {}, visibleEnemies: [enemy], context: { confidence: 80, finishRecommended: true } });
  assert.equal(finish.action, COMBAT_RESPONSES.FINISH);
});

test("an immediate local attacker interrupts an older squad target", () => {
  const unit = { id: "m1", squadId: "s1", x: 0, y: 0, range: 100, damage: 12, ammo: 8 };
  const oldTarget = { id: "old", alive: true, x: 90, y: 0, hp: 100, maxHp: 100, range: 50, role: "commander" };
  const attacker = { id: "attacker", alive: true, x: 16, y: 0, hp: 100, maxHp: 100, range: 30, role: "trooper", targetId: "m1" };
  const response = evaluateCombatResponse({
    unit,
    squad: { combatContact: { targetId: "old" } },
    visibleEnemies: [oldTarget, attacker],
    context: { confidence: 55 }
  });
  assert.equal(response.target.id, "attacker");
  assert.notEqual(response.action, COMBAT_RESPONSES.NO_CONTACT);
});

test("squad combat contacts persist through pursuit, search, then expire", () => {
  const contact = refreshSquadCombatContact(null, { id: "enemy", x: 60, y: 80 }, 10, { confidence: 0.9 });
  assert.equal(combatContactPhase(contact, 13.9), "PURSUE_LAST_KNOWN");
  assert.equal(combatContactPhase(contact, 17), "SEARCH_LAST_KNOWN");
  assert.deepEqual(combatContactPoint(contact, 17), { x: 60, y: 80, phase: "SEARCH_LAST_KNOWN", targetId: "enemy" });
  assert.equal(combatContactPoint(contact, 21), null);
});

test("browser runtime delegates fear, withdrawal, and immediate response to focused systems", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fear:\s*rand\(/);
  assert.doesNotMatch(source, /unit\.fear\s*=/);
  assert.match(source, /breakPolicyFor\(playerFor\(unit\.faction\)\)/);
  assert.match(source, /evaluateCombatResponse\(\{/);
  assert.match(source, /refreshSquadCombatContact\(/);
  assert.match(source, /combatContactPoint\(/);
  assert.doesNotMatch(source, /intent\s*=.*"Ignore"/);
});
