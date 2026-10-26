import assert from "node:assert/strict";
import test from "node:test";

import {
  AIRCRAFT_PART_IDS, DEFAULT_PALETTE, HUMANOID_BUILDS, HUMANOID_CANON, HUMANOID_PART_IDS, STRUCTURE_TYPES, VEHICLE_PART_IDS,
  aircraftParts, drawParts, humanoidBuildFor, humanoidParts, partsExtent, partsFor, structureParts, vehicleParts
} from "../src/rendering/PartRigs.js";

const byId = parts => new Map(parts.map(part => [part.id, part]));
const length = part => Math.hypot(part.b[0] - part.a[0], part.b[1] - part.a[1]);
const HUMANOID_ONLY = ["head", "neck", "thigh", "calf", "knee", "foot", "groin", "shoulder", "elbow", "forearm", "upperArm", "hand", "torso", "back"];
const rootName = id => id.split(".")[0];

test("a humanoid has every named part, near and far", () => {
  const parts = byId(humanoidParts());
  for (const id of HUMANOID_PART_IDS) assert.ok(parts.has(id), `missing part ${id}`);
  for (const name of ["head", "neck", "torso", "back", "groin"]) assert.ok(parts.has(name));
  for (const name of ["shoulder", "upperArm", "elbow", "forearm", "hand", "thigh", "knee", "calf", "foot"]) {
    assert.ok(parts.has(`${name}.near`) && parts.has(`${name}.far`), `${name} needs both sides`);
  }
});

test("humanoid proportions follow the head-count canon", () => {
  const parts = humanoidParts(HUMANOID_BUILDS.average, { stride: 0, aim: 0 });
  const map = byId(parts);
  const extent = partsExtent(parts);
  assert.ok(Math.abs(extent.minY) < 0.15, `feet stand on the ground (${extent.minY})`);
  assert.ok(Math.abs(extent.height - HUMANOID_CANON.headsTall) < 0.45, `about 7.5 heads tall (${extent.height.toFixed(2)})`);
  const head = map.get("head");
  assert.ok(Math.abs(head.ry * 2 - 1) < 0.05, "the head is the unit of measure");
  assert.ok(Math.abs(length(map.get("thigh.near")) - HUMANOID_CANON.thigh) < 0.05);
  assert.ok(Math.abs(length(map.get("calf.near")) - HUMANOID_CANON.calf) < 0.05);
  assert.ok(Math.abs(length(map.get("upperArm.near")) - HUMANOID_CANON.upperArm) < 0.05);
  assert.ok(Math.abs(length(map.get("forearm.near")) - HUMANOID_CANON.forearm) < 0.05);
  // Joints are in anatomical order from the top down.
  const y = id => (map.get(id).cy ?? map.get(id).a?.[1]);
  assert.ok(y("head") > y("shoulder.near") && y("shoulder.near") > y("elbow.near") && y("elbow.near") > y("hand.near") - 0.01);
  assert.ok(y("groin") > y("knee.near") && y("knee.near") > map.get("foot.near").points[0][1]);
  // Arms hang to about mid-thigh, legs are roughly half the figure.
  const wristY = map.get("forearm.near").b[1];
  assert.ok(wristY < y("groin") + 0.6 && wristY > y("knee.near"));
});

test("builds change proportions but keep the same parts", () => {
  const avg = humanoidParts(HUMANOID_BUILDS.average);
  const heavy = humanoidParts(HUMANOID_BUILDS.heavy);
  const brute = humanoidParts(HUMANOID_BUILDS.brute);
  assert.deepEqual(avg.filter(p => !p.gear).map(p => p.id).sort(), heavy.filter(p => !p.gear).map(p => p.id).sort());
  const wide = parts => byId(parts).get("torso").w1;
  assert.ok(wide(heavy) > wide(avg) && wide(brute) > wide(avg));
  assert.ok(length(byId(brute).get("forearm.near")) > length(byId(avg).get("forearm.near")), "orks have long arms");
  assert.ok(length(byId(brute).get("thigh.near")) < length(byId(avg).get("thigh.near")), "and short legs");
  assert.equal(humanoidBuildFor({ race: "Orks" }).id, "brute");
  assert.equal(humanoidBuildFor({ faction: "Space Marines" }).id, "heavy");
  assert.equal(humanoidBuildFor({ race: "Necrons" }).id, "lean");
  assert.equal(humanoidBuildFor({ race: "Imperium", faction: "Imperial Guard" }).id, "average");
});

test("walking moves the legs and arms; the lower foot stays on the ground", () => {
  const rest = byId(humanoidParts(HUMANOID_BUILDS.average, { stride: 0 }));
  for (const phase of [1, 2, 3, 4, 5]) {
    const parts = humanoidParts(HUMANOID_BUILDS.average, { stride: 1, phase });
    const extent = partsExtent(parts);
    assert.ok(Math.abs(extent.minY) < 0.2, `feet on the ground at phase ${phase} (${extent.minY.toFixed(2)})`);
    const map = byId(parts);
    assert.notDeepEqual(map.get("knee.near").cx, rest.get("knee.near").cx);
  }
  const aimed = byId(humanoidParts(HUMANOID_BUILDS.average, { aim: 1 }));
  assert.ok(aimed.get("hand.near").b[0] > rest.get("hand.near").b[0] + 0.5, "aiming raises the hands forward");
  const crouched = partsExtent(humanoidParts(HUMANOID_BUILDS.average, { crouch: 1 }));
  assert.ok(crouched.height < HUMANOID_CANON.headsTall - 0.8, "crouching lowers the figure");
});

test("vehicles, aircraft and buildings use part lists of their own, not the humanoid ones", () => {
  const sets = {
    vehicle: vehicleParts(),
    aircraft: aircraftParts(),
    ...Object.fromEntries(STRUCTURE_TYPES.map(type => [type, structureParts(type)]))
  };
  for (const [name, parts] of Object.entries(sets)) {
    assert.ok(parts.length >= 4, `${name} is built from several parts`);
    for (const part of parts) {
      assert.ok(!HUMANOID_ONLY.includes(rootName(part.id)), `${name} must not carry the humanoid part "${part.id}"`);
      assert.ok(Number.isFinite(part.z) && typeof part.slot === "string");
      assert.ok(DEFAULT_PALETTE[part.slot], `${name}.${part.id} uses a known colour slot`);
    }
  }
  const vehicle = byId(vehicleParts());
  for (const id of VEHICLE_PART_IDS) assert.ok(vehicle.has(id), `vehicle part ${id}`);
  const aircraft = byId(aircraftParts());
  for (const id of AIRCRAFT_PART_IDS) assert.ok(aircraft.has(id), `aircraft part ${id}`);
});

test("vehicle and building proportions are sensible", () => {
  const tank = partsExtent(vehicleParts({ aim: 0 }).filter(part => part.id !== "barrel" && part.id !== "antenna"));
  assert.ok(tank.width > tank.height * 1.6 && tank.width <= 1.1, "a tank is long and low");
  const barrel = length(byId(vehicleParts()).get("barrel"));
  assert.ok(barrel > 0.4 && barrel < 0.7, "the gun is about half the hull length");
  const house = byId(structureParts("house"));
  assert.ok(house.has("foundation") && house.has("wall") && house.has("roof") && house.has("door") && house.has("window.0"));
  const tower = byId(structureParts("watchtower"));
  const towerExtent = partsExtent([...tower.values()].filter(part => part.id !== "shadow"));
  assert.ok(towerExtent.height > towerExtent.width * 2, "a watchtower is tall and narrow");
});

test("buildings rise in stages and lose roofs when wrecked", () => {
  const ids = (type, options) => structureParts(type, options).map(part => part.id);
  assert.ok(!ids("house", { progress: 0.1 }).includes("wall"), "only the foundation at the start");
  assert.ok(ids("house", { progress: 0.5 }).includes("wall") && !ids("house", { progress: 0.5 }).includes("roof"));
  assert.ok(ids("house", { progress: 1 }).includes("roof") && ids("house", { progress: 1 }).includes("chimney"));
  assert.ok(!ids("house", { damage: 0.8 }).includes("roof") && ids("house", { damage: 0.8 }).includes("wall"));
  assert.equal(partsFor("structure", { type: "outpost" }).length > 4, true, "battle structure types map onto a rig");
});

test("drawing paints every part back to front", () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, name) => (...args) => { calls.push([name, args]); }, set: (_, name, value) => { calls.push(["set:" + name, value]); return true; } });
  const parts = humanoidParts(HUMANOID_BUILDS.heavy, { role: "medic" });
  drawParts(ctx, parts, 100, 100, { unit: 5 });
  assert.equal(calls.filter(([name]) => name === "fill").length, parts.length);
  // Medic gear appears; a standard bearer carries a banner.
  assert.ok(parts.some(part => part.id === "medicCross"));
  assert.ok(humanoidParts(HUMANOID_BUILDS.average, { role: "standard" }).some(part => part.id === "banner"));
});

test("the animator turns movement into stride, phase and facing without touching the unit", async () => {
  const { RigAnimator } = await import("../src/rendering/RigAnimator.js");
  const animator = new RigAnimator();
  const unit = { id: "u1" };
  const still = animator.pose(unit, 100, 100, { facing: 0 });
  assert.equal(still.stride, 0);
  assert.equal(still.flip, false);
  let last = still;
  for (let step = 1; step <= 12; step += 1) last = animator.pose(unit, 100 - step * 0.8, 100, { facing: Math.PI });
  assert.ok(last.stride > 0.6, "walking builds up stride");
  assert.ok(last.phase > still.phase + 2, "the walk cycle advances with distance covered");
  assert.equal(last.flip, true, "facing left mirrors the figure");
  for (let step = 0; step < 20; step += 1) last = animator.pose(unit, 90, 100, { facing: Math.PI });
  assert.equal(last.stride, 0, "standing still settles");
  const engaged = animator.pose({ id: "u2" }, 5, 5, { engaged: true });
  const later = animator.pose({ id: "u2" }, 5, 5, { engaged: true });
  assert.ok(later.aim > engaged.aim || later.aim > 0.2, "engaged units raise their weapons");
  assert.deepEqual(Object.keys(unit), ["id"], "no state is written onto the unit");
});
