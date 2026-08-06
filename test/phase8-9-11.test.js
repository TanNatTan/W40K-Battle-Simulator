import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  armorFacingFor,
  beginMeleeAttack,
  ensureWeaponState,
  requestRangedShot,
  resolveArmorHit,
  updateCombatState
} from "../src/combat/CombatSystem.js";
import {
  forceTreatmentThreshold,
  injuryStateFor,
  medicalProfileFor,
  tickFactionRecovery
} from "../src/medical/MedicalSystem.js";
import {
  createResourceZone,
  drainResourceZone,
  pointInResourceZone,
  regenerateResourceZone,
  serializeResourceZone
} from "../src/economy/ResourceZones.js";

const weapons = JSON.parse(await readFile(new URL("../data/weapons.json", import.meta.url), "utf8"));

test("Phase 8 weapon state supports magazines, reloads, heat, melee phases, and armor facing", () => {
  const unit = { id: "u1", role: "trooper", weaponId: "rifle", ammo: 16 };
  const { state } = ensureWeaponState(unit, weapons);
  assert.equal(state.roundsInMagazine, 8);
  for (let shot = 0; shot < 8; shot += 1) assert.equal(requestRangedShot(unit, weapons).allowed, true);
  assert.equal(requestRangedShot(unit, weapons).reason, "reload-started");
  updateCombatState(unit, weapons.rifle.reloadTime, weapons);
  assert.equal(unit.weaponState.roundsInMagazine, 8);
  assert.equal(beginMeleeAttack(unit, "enemy", true, weapons), true);
  const events = updateCombatState(unit, 1, weapons);
  assert.equal(events.some(event => event.type === "melee-strike" && event.charged), true);

  const vehicle = { role: "vehicle", facing: 0, armorProtection: 20 };
  const projectile = { vx: -1, vy: 0, penetration: 18 };
  assert.equal(armorFacingFor(vehicle, projectile), "front");
  const armor = resolveArmorHit(vehicle, projectile, () => 0);
  assert.equal(armor.facing, "front");
  assert.equal(armor.result, "ricochet");
});

test("Phase 9 exposes force triage, knocked-down state, and faction recovery", () => {
  const units = [
    { faction: "a", alive: true, hp: 100, maxHp: 100 },
    { faction: "a", alive: true, hp: 35, maxHp: 100 },
    { faction: "a", alive: true, hp: 60, maxHp: 100 },
    { faction: "a", alive: true, hp: 1, maxHp: 100, incapacitated: true }
  ];
  assert.equal(forceTreatmentThreshold(units, "a").active, true);
  assert.equal(injuryStateFor({ alive: true, hp: 90, maxHp: 100, knockedDownRemaining: 1 }), "Knocked Down");
  assert.equal(medicalProfileFor({ race: "Orks" }).id, "painboy");

  const necron = { alive: true, hp: 1, maxHp: 100, incapacitated: true, stabilized: true, reanimationProgress: 0.99, morale: 0.5 };
  const events = tickFactionRecovery(necron, 1, { race: "Necrons" }, () => 0);
  assert.equal(events.some(event => event.type === "reanimated"), true);
  assert.equal(necron.incapacitated, false);
});

test("Phase 11 resource zones support polygons, depletion, regeneration, and save scaling", () => {
  const zone = createResourceZone("zone-1", { x: 50, y: 50 }, {
    resourceType: "biomass",
    capacity: 100,
    remaining: 80,
    gatherRate: 12,
    regeneration: 2,
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]
  });
  assert.equal(pointInResourceZone({ x: 50, y: 50 }, zone), true);
  assert.equal(pointInResourceZone({ x: 150, y: 50 }, zone), false);
  assert.equal(drainResourceZone(zone, 50), 12);
  assert.equal(zone.remaining, 68);
  assert.equal(regenerateResourceZone(zone, 5), 10);
  assert.equal(zone.remaining, 78);
  const saved = serializeResourceZone(zone, 2, 3);
  assert.deepEqual(saved.points[1], { x: 200, y: 0 });
});
