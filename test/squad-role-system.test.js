import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SQUAD_ROLES,
  roleDemandScores,
  roleMinimumDuration,
  roleSuitability,
  selectSquadRole,
  shouldReassignSquadRole,
  squadReadiness
} from "../src/ai/SquadRoleSystem.js";

const member = (overrides = {}) => ({ hp: 100, maxHp: 100, morale: 0.8, fatigue: 0.1, ammo: 8, maxAmmo: 10, speed: 22, damage: 14, range: 120, experience: 45, role: "trooper", ...overrides });

test("all twelve squad responsibilities exist and readiness reflects casualties", () => {
  assert.equal(SQUAD_ROLES.length, 12);
  assert.ok(squadReadiness([member(), member()], 2) > squadReadiness([member({ hp: 20 })], 4));
});

test("specialists are matched to appropriate primary roles", () => {
  const scouts = [member({ role: "scout", speed: 31, range: 180 }), member({ role: "scout", speed: 30 })];
  const medics = [member({ role: "medic" }), member({ role: "medic" })];
  const heavy = [member({ name: "Devastator", weapon: "Heavy cannon", damage: 28, range: 190 }), member({ role: "vehicle", maxHp: 220, hp: 220, damage: 30 })];
  assert.ok(roleSuitability("reconnaissance", scouts) > roleSuitability("siege", scouts));
  assert.ok(roleSuitability("medical-support", medics) > roleSuitability("offensive", medics));
  assert.ok(roleSuitability("siege", heavy) > roleSuitability("reconnaissance", heavy));
});

test("commander demand reacts to emergencies and subtracts assigned strength", () => {
  const emergency = roleDemandScores({ baseThreat: 1, squadCount: 6 }, {});
  const covered = roleDemandScores({ baseThreat: 1, squadCount: 6 }, { "base-defense": 5 });
  assert.ok(emergency["base-defense"] > emergency.reserve);
  assert.ok(covered["base-defense"] < emergency["base-defense"]);
});

test("an urgent resource opportunity pulls squads out of reserve", () => {
  const demand = roleDemandScores({
    resourceNeed: 1,
    captureOpportunity: 1,
    objectiveImportance: 0.5,
    squadCount: 4
  }, {});
  assert.ok(demand.capture > demand.reserve);
});

test("greedy unmet-demand assignment produces a force structure with a reserve", () => {
  const context = { baseThreat: 0.3, territoryThreat: 0.5, reinforcementThreat: 0.4, resourceNeed: 0.6, captureOpportunity: 1, fogNeed: 0.7, routeThreat: 0.5, enemyBaseKnown: 1, enemyFortifications: 0.5, aggression: 70, caution: 55, squadCount: 8 };
  const assigned = {};
  const roles = [];
  for (let index = 0; index < 8; index += 1) {
    const plan = selectSquadRole({ squad: { id: `squad-${index}` }, members: [member()], demands: roleDemandScores(context, assigned), assignedStrength: assigned });
    roles.push(plan.primaryRole);
    assigned[plan.primaryRole] = (assigned[plan.primaryRole] || 0) + 0.8;
  }
  assert.ok(new Set(roles).size >= 4);
  assert.ok(roles.includes("reserve"));
});

test("role assignment has a 30-90 second commitment with emergency override", () => {
  const duration = roleMinimumDuration("squad-14");
  assert.ok(duration >= 30 && duration <= 90);
  const squad = { primaryRole: "offensive", roleCommitUntil: 80 };
  assert.equal(shouldReassignSquadRole(squad, 40), false);
  assert.equal(shouldReassignSquadRole(squad, 40, { emergency: true }), true);
  const plan = selectSquadRole({ squad, members: [member()], demands: { capture: 100 }, assignedStrength: {} });
  assert.equal(plan.primaryRole, "capture");
  assert.notEqual(plan.secondaryRole, plan.primaryRole);
});

test("observer UI exposes role inspector and overlay without player commands", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="awt-squad-role-toggle"/);
  assert.match(html, /id="awt-squad-role-summary"/);
  assert.match(html, /id="awt-role-legend"/);
  assert.doesNotMatch(html, /Assign squad role/i);
});
