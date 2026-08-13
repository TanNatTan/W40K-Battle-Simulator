import test from "node:test";
import assert from "node:assert/strict";
import { factionConfig } from "../js/modules/faction-config.js";
import {
  astartesSquadCapacityFor,
  configureSpaceMarineUnit,
  isAstartesCoreMember,
  reinforcementWaveSize,
  selectIncompleteAstartesSquad,
  spaceMarineProfileFor,
  synchronizeAstartesSquad
} from "../src/ai/space-marines/SpaceMarineForceComposition.js";
import { updateSpaceMarineCharacterAttachments } from "../src/ai/space-marines/SpaceMarineCommanderAttachmentSystem.js";
import { updateAstartesCohesionMode } from "../src/formations/FormationSystem.js";
import { shouldUseArmyBattleFormation, updateArmyBattleFormation } from "../src/formations/ArmyBattleFormationSystem.js";
import { absorbSpaceMarineDamage, evaluateSpaceMarineAbility, spaceMarineAttackDelayMultiplier } from "../src/combat/SpaceMarineAbilitySystem.js";
import { canGenerateGeneSeed, createGeneSeedRecoveryState, advanceGeneSeedRecovery } from "../src/medical/GeneSeedRecoverySystem.js";

function marine(overrides = {}) {
  return {
    id: "m1", name: "Tactical Marine", specialty: "Tactical Marine", role: "trooper", faction: "a",
    alive: true, incapacitated: false, x: 0, y: 0, hp: 100, maxHp: 100, range: 100, speed: 20,
    armorProtection: 9, suppressionResistance: 0.5, accuracy: 0.85, precision: 0.85, morale: 0.8,
    index: 1, ...overrides
  };
}

test("Space Marine roster exposes battleline, specialists, veterans, Terminators, and command", () => {
  const roster = factionConfig.astartes.roster;
  for (const name of ["Heavy Intercessor", "Jump Pack Intercessor", "Devastator", "Eradicator"]) assert.ok(roster.trooper.includes(name));
  for (const name of ["Sternguard Veteran", "Vanguard Veteran", "Bladeguard Veteran", "Terminator", "Assault Terminator"]) assert.ok(roster.standard.includes(name));
  for (const name of ["Captain", "Chaplain", "Librarian", "Judiciar", "Chapter Master"]) assert.ok(roster.commander.includes(name));
});

test("reinforcement waves fill compatible ten-Marine and five-Terminator squads without overfilling", () => {
  assert.equal(reinforcementWaveSize({ sequence: 0, missing: 10 }), 3);
  assert.equal(reinforcementWaveSize({ sequence: 1, missing: 7 }), 4);
  assert.equal(reinforcementWaveSize({ sequence: 2, missing: 2 }), 2);
  assert.equal(reinforcementWaveSize({ sequence: 0, missing: 5, squadClass: "terminator" }), 3);
  assert.equal(reinforcementWaveSize({ sequence: 1, missing: 2, squadClass: "terminator" }), 2);
  assert.equal(astartesSquadCapacityFor("Tactical Marine"), 10);
  assert.equal(astartesSquadCapacityFor("Assault Terminator"), 5);
  const squads = [{ id: "s1", astartesSquadClass: "line", nominalSize: 10, createdAt: 1 }];
  const units = Array.from({ length: 7 }, (_, index) => configureSpaceMarineUnit(marine({ id: `u${index}`, squadId: "s1" }), "Intercessor"));
  assert.equal(selectIncompleteAstartesSquad(squads, units, { name: "Devastator" })?.id, "s1");
});

test("specialist configuration applies exact Devastator mobility and fire profile", () => {
  const unit = configureSpaceMarineUnit(marine(), "Devastator");
  assert.equal(unit.range, 150);
  assert.equal(unit.speed, 15);
  assert.equal(unit.attackRateMultiplier, 1.75);
  assert.ok(unit.combatTags.includes("long-range"));
  assert.equal(spaceMarineAttackDelayMultiplier(unit, null, 0), 1 / 1.75);
});

test("characters attach separately and do not consume squad core capacity", () => {
  const core = Array.from({ length: 4 }, (_, index) => configureSpaceMarineUnit(marine({ id: `core-${index}`, squadId: "s1" }), "Intercessor"));
  const captain = configureSpaceMarineUnit(marine({ id: "captain", role: "commander", squadId: null }), "Captain");
  const squad = { id: "s1", primaryRole: "offensive", readiness: 0.9, attachedCharacterIds: [] };
  const changes = updateSpaceMarineCharacterAttachments({ characters: [captain], squads: [squad], membersForSquad: () => core, now: 10 });
  assert.equal(changes[0].toSquadId, "s1");
  assert.equal(captain.squadId, null);
  assert.equal(captain.attachedSquadId, "s1");
  synchronizeAstartesSquad(squad, [...core, captain]);
  assert.equal(squad.coreMemberIds.length, 4);
  assert.deepEqual(squad.attachedCharacterIds, ["captain"]);
  assert.equal(isAstartesCoreMember(captain), false);
});

test("Astartes disperse in quiet movement and reform for serious contact", () => {
  const squad = {};
  assert.equal(updateAstartesCohesionMode(squad, { now: 20 }), "DISTRIBUTED");
  assert.equal(squad.formationActive, false);
  assert.equal(updateAstartesCohesionMode(squad, { now: 21, seriousContact: true }), "BATTLE_FORMATION");
  assert.equal(squad.formationActive, true);
  assert.equal(updateAstartesCohesionMode(squad, { now: 40 }), "DISTRIBUTED");
});

test("decisive conditions create hierarchical infantry and vehicle army anchors", () => {
  assert.equal(shouldUseArmyBattleFormation({ squadCount: 3, combatUnits: 24, objectiveImportance: 0.8 }), true);
  const formation = updateArmyBattleFormation({}, {
    now: 10, activate: true, rallyPoint: { x: 0, y: 0 }, objective: { x: 400, y: 0 },
    squads: [{ id: "s1", primaryRole: "offensive" }, { id: "s2", primaryRole: "medical-support" }],
    vehicles: [{ id: "tank-1" }]
  });
  assert.equal(formation.active, true);
  assert.ok(formation.squadAnchors.s1);
  assert.ok(formation.squadAnchors.s2.x < formation.squadAnchors.s1.x);
  assert.ok(formation.vehicleAnchors["tank-1"]);
});

test("Chaplain buffs and Iron Halo absorbs then recharges damage", () => {
  const chaplain = configureSpaceMarineUnit(marine({ id: "chaplain", role: "commander" }), "Chaplain");
  const allies = Array.from({ length: 3 }, (_, index) => marine({ id: `ally-${index}`, x: index * 5 }));
  const events = evaluateSpaceMarineAbility(chaplain, { allies, enemies: [], now: 1, dt: 0.25 });
  assert.equal(events[0].type, "LITANY");
  assert.ok(allies.every(ally => ally.litanyUntil === 12));
  const captain = configureSpaceMarineUnit(marine({ id: "captain", role: "commander" }), "Captain");
  const hit = absorbSpaceMarineDamage(captain, 90, 2);
  assert.equal(hit.absorbed, 70);
  assert.equal(hit.damage, 20);
});

test("only biological Astartes produce gene-seed and Apothecaries return it to the monastery", () => {
  const fallen = configureSpaceMarineUnit(marine({ alive: false }), "Tactical Marine");
  const wreck = configureSpaceMarineUnit(marine({ alive: false, role: "vehicle" }), "Rhino");
  assert.equal(canGenerateGeneSeed(fallen), true);
  assert.equal(canGenerateGeneSeed(wreck), false);
  const apothecary = configureSpaceMarineUnit(marine({ id: "apothecary", role: "medic" }), "Apothecary");
  const corpse = { id: "seed-1", x: 0, y: 0, geneSeed: true, sourceFaction: "a" };
  const monastery = { id: "hq", x: 0, y: 0 };
  const recovery = createGeneSeedRecoveryState();
  let result = advanceGeneSeedRecovery(recovery, { apothecary, target: corpse, monastery, dt: 2.5, distanceTo: () => 0, random: () => 0.1 });
  assert.equal(result.action, "RECOVERED");
  result = advanceGeneSeedRecovery(recovery, { apothecary, target: null, monastery, dt: 0.1, distanceTo: () => 0, random: () => 0.1 });
  assert.equal(result.action, "CREATE_MARINE");
});
