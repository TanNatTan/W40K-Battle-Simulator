import assert from "node:assert/strict";
import test from "node:test";

import {
  FORMATION_VALUES,
  attackSector,
  boxSlot,
  encircleSlot,
  encirclementState,
  encirclementMoraleDrain,
  formationDamageMultiplier,
  mixedBandFor,
  mixedSlot,
  planBoxPerimeter,
  rectanglePerimeterSlot,
  scoreDoctrineFormations,
  smoothHeading,
  squadPaceFactor
} from "../src/formations/FormationDoctrine.js";

test("defensive formations reduce damage, scaled by cohesion", () => {
  const box = formationDamageMultiplier("box", { cohesion: 1, sector: "front" });
  const line = formationDamageMultiplier("line", { cohesion: 1, sector: "rear" });
  assert.ok(box < 0.9);
  assert.ok(line > 1);
  const shattered = formationDamageMultiplier("box", { cohesion: 0.1, sector: "front" });
  assert.ok(shattered > box && shattered < 1.01);
  const core = formationDamageMultiplier("box", { cohesion: 1, sector: "front", core: true });
  assert.ok(core < box);
  assert.ok(FORMATION_VALUES["defensive-ring"].front < FORMATION_VALUES.line.front);
});

test("attack sector is relative to heading and wraps correctly", () => {
  assert.equal(attackSector(0, 0.2), "front");
  assert.equal(attackSector(0, Math.PI / 2), "flank");
  assert.equal(attackSector(0, Math.PI), "rear");
  assert.equal(attackSector(Math.PI - 0.1, -Math.PI + 0.1), "front");
});

test("box puts fighters on the perimeter and protected members inside", () => {
  const fighters = Array.from({ length: 8 }, (_, n) => ({ id: `f${n}`, formationGroup: "left" }));
  const medic = { id: "m", formationGroup: "support" };
  const plan = planBoxPerimeter([...fighters, medic]);
  assert.equal(plan.perimeterCount, 8);
  const edge = fighters.map((member, n) => boxSlot(n, 9, member, 0, plan.perimeterCount, n));
  const interior = boxSlot(8, 9, medic, 0, plan.perimeterCount, null);
  const width = Math.max(30, Math.ceil(8 / 2) * 9);
  const depth = Math.max(22, Math.ceil(8 / 2) * 6.5);
  for (const slot of edge) assert.ok(Math.abs(slot.x) === width / 2 || Math.abs(slot.y) === depth / 2 || Math.abs(Math.abs(slot.x) - width / 2) < 1e-9 || Math.abs(Math.abs(slot.y) - depth / 2) < 1e-9);
  assert.ok(Math.abs(interior.x) < width / 2 - 8 && Math.abs(interior.y) < depth / 2 - 4);
  const slot = rectanglePerimeterSlot(0, 8, 40, 20);
  assert.deepEqual(slot, { x: -20, y: 10 });
});

test("mixed formation sorts heavies forward, scouts to wings and support to the core", () => {
  assert.equal(mixedBandFor({ role: "trooper", specialty: "heavy bolter" }), "front");
  assert.equal(mixedBandFor({ role: "scout" }), "wing");
  assert.equal(mixedBandFor({ formationGroup: "support" }), "core");
  assert.equal(mixedBandFor({ role: "trooper", weapon: "plasma gun" }), "rear");
  assert.ok(mixedSlot({}, 0, 3, "front").y > mixedSlot({}, 0, 3, "rear").y);
  assert.ok(Math.abs(mixedSlot({}, 0, 2, "wing").x) > Math.abs(mixedSlot({}, 0, 2, "core").x));
});

test("encircle places a full ring around the enemy for large squads and a horseshoe for small ones", () => {
  const radius = 60;
  const full = Array.from({ length: 10 }, (_, n) => encircleSlot(n, 10, { targetDistance: 100, radius }));
  for (const slot of full) assert.ok(Math.abs(Math.hypot(slot.x, slot.y - 100) - radius) < 1e-6);
  const behind = full.filter(slot => slot.y > 100).length;
  assert.ok(behind >= 3, "ring wraps behind the enemy");
  const small = Array.from({ length: 6 }, (_, n) => encircleSlot(n, 6, { targetDistance: 100, radius }));
  assert.ok(small.filter(slot => slot.y > 100 + radius * 0.8).length <= 1, "horseshoe stays on the near side");
});

test("encirclement needs enemies on several sides and nearby", () => {
  const center = { x: 0, y: 0 };
  const ring = Array.from({ length: 8 }, (_, n) => ({ x: Math.cos(n * Math.PI / 4) * 90, y: Math.sin(n * Math.PI / 4) * 90 }));
  const surrounded = encirclementState(center, ring, { radius: 160 });
  assert.equal(surrounded.surrounded, true);
  assert.ok(surrounded.coverage > 0.6);
  const oneSide = encirclementState(center, ring.slice(0, 3), { radius: 160 });
  assert.equal(oneSide.surrounded, false);
  const far = encirclementState(center, ring.map(e => ({ x: e.x * 5, y: e.y * 5 })), { radius: 160 });
  assert.equal(far.surrounded, false);
  assert.ok(encirclementMoraleDrain(surrounded, "line", 0.3) > encirclementMoraleDrain(surrounded, "box", 0.3));
  assert.equal(encirclementMoraleDrain(oneSide, "line", 0.3), 0);
});

test("doctrine scores favour box under pressure, encircle with superiority and nothing when tiny", () => {
  const squad = Array.from({ length: 10 }, (_, n) => ({ id: n, formationGroup: n < 2 ? "support" : "left", role: "trooper" }));
  const enemies = [{}, {}, {}];
  const pressured = scoreDoctrineFormations({ members: squad, enemies, directions: 2, protectedCount: 2, rangedRatio: 0.8, orderType: "Hold Route" });
  const strong = scoreDoctrineFormations({ members: squad, enemies: [{}], strengthRatio: 3, aggression: 80 });
  assert.ok(pressured.box > pressured.encircle);
  assert.ok(strong.encircle > strong.box);
  const tiny = scoreDoctrineFormations({ members: squad.slice(0, 3), enemies, directions: 2 });
  assert.ok(tiny.box < 0 && tiny.encircle < 0);
  const hopeless = scoreDoctrineFormations({ members: squad, enemies, strengthRatio: 3, surrounded: true });
  assert.ok(hopeless.encircle < 0);
});

test("pacing waits for stragglers outside contact and heading turns smoothly", () => {
  assert.equal(squadPaceFactor({ cohesion: 1 }), 1);
  assert.ok(squadPaceFactor({ cohesion: 0.2 }) < 0.7);
  assert.equal(squadPaceFactor({ cohesion: 0.2, inContact: true }), 1);
  const turned = smoothHeading(0, Math.PI, 0.1);
  assert.ok(Math.abs(turned) > 0 && Math.abs(turned) < 0.5);
  assert.ok(Math.abs(smoothHeading(0, 0.05, 1) - 0.05) < 1e-9);
});

test("browser runtime applies formation protection, accuracy, pacing and encirclement", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /formationProtectionFor\(target, shooter \|\| projectile\)/);
  assert.match(source, /formationProtectionFor\(target, attacker\)/);
  assert.match(source, /formationAccuracyFor\(unit\)/);
  assert.match(source, /formationSpeedFor\(unit\)/);
  assert.match(source, /squadPaceFactor\(\{/);
  assert.match(source, /encirclementState\(center, enemies/);
  assert.match(source, /prepareDoctrineFormation\(squad, members, target\)/);
  assert.match(source, /smoothHeading\(squad\.heading/);
});
