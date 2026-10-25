import assert from "node:assert/strict";
import test from "node:test";

import { HeightField, seededRandom, SAMPLE_SPACING } from "../src/terrain/HeightField.js";
import {
  slopeMovementFactor,
  highGroundModifiers,
  lineOfSightModifiers,
  isCliff,
  describeSlope
} from "../src/terrain/ElevationEffects.js";

test("empty field is flat and free", () => {
  const field = new HeightField({ width: 4096, height: 2304 });
  assert.equal(field.heightAt(500, 500), 0);
  assert.equal(field.slopeAt(500, 500), 0);
  assert.equal(field.lineOfSight(0, 0, 900, 900).clear, true);
});

test("brush raises a smooth bump with bilinear interpolation", () => {
  const field = new HeightField({ width: 4096, height: 2304 });
  assert.ok(field.applyBrush(1000, 1000, 160, 20, "raise") > 0);
  const centre = field.heightAt(1000, 1000);
  const edge = field.heightAt(1140, 1000);
  assert.ok(centre > 10, `centre ${centre}`);
  assert.ok(edge < centre);
  const mid = field.heightAt(1000 + SAMPLE_SPACING / 2, 1000);
  assert.ok(mid <= centre && mid >= field.heightAt(1000 + SAMPLE_SPACING, 1000));
});

test("directional slope is signed and drives movement factors", () => {
  const field = new HeightField({ width: 4096, height: 2304 });
  field.applyBrush(1000, 1000, 220, 40, "raise");
  const uphill = field.directionalSlope(900, 1000, 1, 0);
  const downhill = field.directionalSlope(1100, 1000, 1, 0);
  assert.ok(uphill > 0 && downhill < 0);
  assert.ok(slopeMovementFactor(uphill) < 1);
  assert.ok(slopeMovementFactor(downhill) > slopeMovementFactor(uphill));
  assert.ok(slopeMovementFactor(0.8, { vehicle: true }) < slopeMovementFactor(0.8));
  assert.equal(slopeMovementFactor(5, { airborne: true }), 1);
  assert.equal(isCliff(1, { vehicle: true }), true);
  assert.equal(isCliff(1, { vehicle: false }), false);
  assert.equal(describeSlope(0.3), "Steep");
});

test("a ridge blocks line of sight and high ground sees over low ground", () => {
  const field = new HeightField({ width: 4096, height: 2304 });
  field.applyBrush(1000, 1000, 180, 80, "raise");
  const blocked = field.lineOfSight(500, 1000, 1500, 1000, 1.6, 1);
  assert.equal(blocked.clear, false);
  assert.equal(lineOfSightModifiers(blocked).blocked, true);
  const fromTop = field.lineOfSight(1000, 1000, 1500, 1000, 1.6, 1);
  assert.equal(fromTop.clear, true);
  const high = highGroundModifiers(30, 0, 300);
  const low = highGroundModifiers(0, 30, 300);
  assert.ok(high.accuracy > 1 && low.accuracy < 1);
  assert.ok(high.range > 1 && low.range < 1);
});

test("generation is deterministic per seed, bounded and honours flat zones", () => {
  const zone = { x: 300, y: 300, radius: 150, level: 2 };
  const a = new HeightField({ width: 2048, height: 1152 }).generate({ seed: 42, flatZones: [zone] });
  const b = new HeightField({ width: 2048, height: 1152 }).generate({ seed: 42, flatZones: [zone] });
  const c = new HeightField({ width: 2048, height: 1152 }).generate({ seed: 43 });
  assert.equal(a.heightAt(777, 555), b.heightAt(777, 555));
  assert.notEqual(a.heightAt(777, 555), c.heightAt(777, 555));
  assert.ok(Math.abs(a.heightAt(300, 300) - 2) < 0.5);
  const { min, max } = a.extent();
  assert.ok(max - min > 15, "terrain has relief");
  assert.ok(min >= -40 && max <= 120);
});

test("serialize round-trips and relief provider layers on top of sculpting", () => {
  const field = new HeightField({ width: 2048, height: 1152 });
  field.applyBrush(600, 600, 120, 15, "raise");
  const copy = HeightField.deserialize(JSON.parse(JSON.stringify(field.serialize())), { width: 2048, height: 1152 });
  assert.ok(Math.abs(copy.heightAt(600, 600) - field.heightAt(600, 600)) < 0.05);
  const before = field.heightAt(600, 600);
  field.setReliefProvider((x, y) => (Math.hypot(x - 600, y - 600) < 100 ? 10 : 0));
  assert.ok(field.heightAt(600, 600) > before + 5);
  field.setReliefProvider(null);
  assert.ok(Math.abs(field.heightAt(600, 600) - before) < 1e-6);
});

test("smooth brush reduces slope", () => {
  const field = new HeightField({ width: 2048, height: 1152 });
  field.applyBrush(800, 800, 100, 60, "raise");
  const before = field.slopeAt(850, 800);
  for (let n = 0; n < 6; n += 1) field.applyBrush(800, 800, 140, 1, "smooth");
  assert.ok(field.slopeAt(850, 800) < before);
  assert.ok(typeof seededRandom(5)() === "number");
});

test("browser runtime wires the height field into movement, combat, vision, sculpting and saves", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");
  assert.match(source, /unitSlopeFactor\(unit, dx, dy\)/);
  assert.match(source, /elevationCombatFor\(unit, target\)/);
  assert.match(source, /state\.heightField\.lineOfSight\(a\.x, a\.y, b\.x, b\.y/);
  assert.match(source, /SCULPT_BRUSHES\.has\(type\)/);
  assert.match(source, /generateReliefFor\(biome, seedText\)/);
  assert.match(source, /heightField: state\.heightField\.resampledSculpt/);
  assert.match(source, /drawHeightShading\(bounds\)/);
});
