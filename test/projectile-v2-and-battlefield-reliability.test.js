import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROJECTILE_ARCHETYPES,
  PROJECTILE_BEHAVIOR_FLAGS,
  PROJECTILE_TYPES,
  compactProjectileRuntime,
  inferProjectileType,
  projectileArchetypeForWeapon,
  projectileHasFlag
} from "../src/combat/ProjectileArchetypeSystem.js";
import { PROJECTILE_ATLAS_ROW_COUNT, projectileVisualForWeapon } from "../src/combat/ProjectileVisualizationSystem.js";
import { MARINE_INFANTRY_MODELS, hasMarineInfantryModel, marineFacingAngle } from "../src/rendering/MarineInfantryRenderer.js";
import { COLLISION_LAYERS, collisionLayerFor, shouldSeparateUnits } from "../src/physics/CollisionLayers.js";
import { degradedFormationFor, resolveFormationSlot } from "../src/formations/FormationSystem.js";
import {
  FORWARD_OUTPOST_LIMIT,
  FORWARD_OUTPOST_MINIMUM_SPACING,
  predictForwardOutpostPosition,
  shouldBuildForwardOutpost
} from "../src/logistics/ForwardOutpostSystem.js";
import { DROP_POD_PAYLOADS, canLoadDropPod, chooseDropPodPayload, dropPodPayloadSlots } from "../src/deployment/DeploymentSystem.js";
import {
  boardTransport,
  createVehicleState,
  reserveTransportForSquad,
  transportReadyToDeploy
} from "../src/vehicles/VehicleAircraftSystem.js";
import { desiredWaaaghBannerCount } from "../src/factions/WaaaghFieldSystem.js";
import { spaceMarineCommandRequirements } from "../src/ai/space-marines/SpaceMarineForceComposition.js";

test("ProjectileSet V2 uses exactly fifteen engine classes and the complete behavior flag vocabulary", () => {
  assert.equal(PROJECTILE_TYPES.length, 15);
  assert.equal(Object.keys(PROJECTILE_ARCHETYPES).length, 15);
  assert.equal(PROJECTILE_BEHAVIOR_FLAGS.length, 15);
  assert.equal(PROJECTILE_ATLAS_ROW_COUNT, 37);
  assert.equal(inferProjectileType({ label: "Heavy Bolter" }), "BOLT");
  assert.equal(inferProjectileType({ label: "Earthshaker Artillery" }), "ARTILLERY");
  assert.equal(inferProjectileType({ label: "Tyranid Acid Spore" }), "BIO_PROJECTILE");
  const runtime = compactProjectileRuntime({ label: "Hunter Homing Missile" });
  assert.equal(projectileHasFlag(runtime, "guided"), true);
  assert.equal(projectileVisualForWeapon({ label: "Gauss Cannon" }).id, "gauss");
  assert.equal(projectileArchetypeForWeapon({ projectileType: "PLASMA" }).type, "PLASMA");
});

test("MarineInfantrySet V1 exposes all thirteen directional models and reads cardinal/diagonal facing", () => {
  assert.equal(Object.keys(MARINE_INFANTRY_MODELS).length, 13);
  assert.equal(hasMarineInfantryModel({ name: "Tactical Marine 12" }), true);
  assert.equal(hasMarineInfantryModel({ name: "Guardsman 12" }), false);
  assert.equal(marineFacingAngle({ movementVelocity: { x: 0, y: -1 } }), -Math.PI / 2);
  assert.equal(marineFacingAngle({ movementVelocity: { x: 1, y: 1 } }), Math.PI / 4);
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["awt-player-color", "awt-player-secondary-color", "awt-player-tertiary-color", "awt-player-body-color"]) assert.match(html, new RegExp(`id="${id}"`));
});

test("formation slots deform around blocked terrain and release an impossible line", () => {
  const desired = { x: 40, y: 40 };
  const resolved = resolveFormationSlot(desired, { unit: { x: 10, y: 10 }, searchRings: 3, step: 8, isWalkable: point => point.x >= 56 });
  assert.equal(resolved.available, true);
  assert.ok(resolved.position.x >= 56);
  assert.equal(degradedFormationFor("line", 4, 10), "staggered");
  assert.equal(degradedFormationFor("staggered", 4, 10), "column");
});

test("air units ignore ground separation while aircraft still separate from aircraft", () => {
  const aircraft = { name: "Thunderhawk", role: "vehicle" };
  const marine = { name: "Intercessor", role: "trooper" };
  assert.equal(collisionLayerFor(aircraft), COLLISION_LAYERS.AIR);
  assert.equal(shouldSeparateUnits(aircraft, marine), false);
  assert.equal(shouldSeparateUnits(aircraft, { name: "Dakkajet", role: "vehicle" }), true);
});

test("forward outposts require intelligence, cap at four, and maintain 220-unit spacing", () => {
  assert.equal(FORWARD_OUTPOST_LIMIT, 4);
  assert.equal(FORWARD_OUTPOST_MINIMUM_SPACING, 220);
  assert.equal(shouldBuildForwardOutpost({ frontlineDistance: 500, nearestOutpostDistance: 300, threat: 0.2, territorySafe: true, enemyBaseConfidence: 0.4 }), false);
  assert.equal(shouldBuildForwardOutpost({ frontlineDistance: 500, nearestOutpostDistance: 300, threat: 0.2, territorySafe: true, enemyBaseConfidence: 0.8, outpostCount: 4 }), false);
  assert.equal(shouldBuildForwardOutpost({ frontlineDistance: 500, nearestOutpostDistance: 300, threat: 0.2, territorySafe: true, enemyBaseConfidence: 0.8, outpostCount: 2 }), true);
  const point = predictForwardOutpostPosition({ base: { x: 0, y: 0 }, enemy: { x: 1000, y: 0 }, existingOutposts: [] });
  assert.ok(point.x > 300 && point.x < 800);
});

test("transports reserve squads and Drop Pods accept four infantry or one Dreadnought", () => {
  const rhino = createVehicleState({ id: "rhino", name: "Rhino" });
  const marines = Array.from({ length: 4 }, (_, index) => ({ id: `m${index}`, role: "trooper" }));
  assert.equal(reserveTransportForSquad(rhino, "squad-1", marines.map(unit => unit.id), 0), true);
  marines.slice(0, 3).forEach(unit => boardTransport(rhino, unit));
  assert.equal(transportReadyToDeploy(rhino, 1), true);
  assert.deepEqual(dropPodPayloadSlots(DROP_POD_PAYLOADS.INFANTRY_FIRETEAM), { infantry: 4, dreadnoughts: 0 });
  assert.equal(canLoadDropPod(DROP_POD_PAYLOADS.INFANTRY_FIRETEAM, marines), true);
  assert.equal(canLoadDropPod(DROP_POD_PAYLOADS.DREADNOUGHT, [{ id: "d1", role: "vehicle", name: "Dreadnought" }]), true);
  assert.equal(chooseDropPodPayload({ decisiveAssault: true, dreadnoughtAvailable: true }).id, "DREADNOUGHT");
});

test("Astartes command presence and Ork Waaagh banner demand scale with real force size", () => {
  assert.deepEqual(spaceMarineCommandRequirements(9), { Sergeant: 0, Lieutenant: 0, Captain: 0, Chaplain: 0, Apothecary: 0, Techmarine: 0, Librarian: 0, Judiciar: 0, Ancient: 0, "Company Champion": 0 });
  const command = spaceMarineCommandRequirements(80);
  assert.equal(command.Sergeant, 8);
  assert.equal(command.Captain, 1);
  assert.equal(command.Chaplain, 1);
  assert.equal(command.Ancient, 1);
  assert.equal(desiredWaaaghBannerCount(19), 0);
  assert.equal(desiredWaaaghBannerCount(80), 3);
  assert.equal(desiredWaaaghBannerCount(80, { majorAssault: true }), 4);
});
