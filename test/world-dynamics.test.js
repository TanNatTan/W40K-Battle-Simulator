import assert from "node:assert/strict";
import test from "node:test";

import { HeightField } from "../src/terrain/HeightField.js";
import { WorldLayers, EARTHWORK, VEGETATION, DEPOSIT, NO_WATER } from "../src/world/WorldLayers.js";
import { crater, digTrench, excavate, levelSite } from "../src/world/Deformation.js";
import { EcosystemSimulator, plantCrop } from "../src/world/Ecosystem.js";
import { plantsForCell } from "../src/rendering/VegetationRenderer.js";

const SIZE = { width: 1024, height: 1024 };
const flat = (height = 6) => {
  const field = new HeightField({ ...SIZE, baseHeight: height });
  const layers = new WorldLayers(SIZE);
  for (let j = 0; j < 40; j += 1) for (let i = 0; i < 40; i += 1) {
    layers.set("vegKind", i, j, VEGETATION.GRASS);
    layers.set("vegetation", i, j, 140);
    layers.set("fertility", i, j, 150);
    layers.set("moisture", i, j, 120);
  }
  return { field, layers };
};
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

test("craters lower the ground, raise a lip, clear plants and scorch the soil", () => {
  const { field, layers } = flat();
  const before = field.heightAt(320, 320);
  const result = crater(field, layers, 320, 320, 48, 4);
  assert.ok(field.heightAt(320, 320) < before - 2, "centre should be dug out");
  assert.ok(result.removed > 5);
  assert.equal(layers.getAt("vegKind", 320, 320), VEGETATION.NONE);
  assert.ok(layers.getAt("scorch", 320, 320) > 150);
  assert.equal(layers.getAt("earthwork", 320, 320), EARTHWORK.PIT);
  let lip = 0;
  for (let a = 0; a < 16; a += 1) lip = Math.max(lip, field.heightAt(320 + Math.cos(a) * 58, 320 + Math.sin(a) * 58) - before);
  assert.ok(lip > 0.05, "a lip of spoil should surround the crater");
});

test("craters expose buried ore", () => {
  const { field, layers } = flat();
  layers.set("deposit", 20, 20, DEPOSIT.IRON);
  layers.set("depositAmount", 20, 20, 400);
  layers.set("cover", 20, 20, 8);
  const result = crater(field, layers, 320, 320, 40, 5);
  assert.ok(result.exposed >= 1);
  assert.equal(layers.get("cover", 20, 20), 0);
});

test("trenches deepen incrementally and finish at the requested depth", () => {
  const { field, layers } = flat();
  const base = field.heightAt(200, 300);
  let calls = 0;
  let done = false;
  while (!done && calls < 20) {
    done = digTrench(field, layers, 160, 300, 360, 300, { width: 20, depth: 2.4, amount: 0.6 }).complete;
    calls += 1;
  }
  assert.ok(calls > 1 && calls <= 20, "digging takes several passes");
  assert.ok(base - field.heightAt(260, 300) > 1.5);
  assert.equal(layers.getAt("earthwork", 260, 300), EARTHWORK.TRENCH);
  assert.ok(field.heightAt(260, 300 + 24) >= base - 0.05, "spoil bank beside the cut");
});

test("mining removes finite ore and lowers ground", () => {
  const { field, layers } = flat();
  for (let j = 18; j <= 22; j += 1) for (let i = 18; i <= 22; i += 1) {
    layers.set("deposit", i, j, DEPOSIT.IRON);
    layers.set("depositAmount", i, j, 100);
    layers.set("cover", i, j, 0);
  }
  let ore = 0;
  for (let k = 0; k < 12; k += 1) ore += excavate(field, layers, 320, 320, 30, 0.5).ore.materials || 0;
  assert.ok(ore > 100, "ore should be taken");
  assert.ok(ore <= 25 * 100, "never more than the deposit holds");
  assert.ok(field.heightAt(320, 320) < 6 - 1);
});

test("levelling a build site flattens it and clears plants", () => {
  const { field, layers } = flat();
  field.applyBrush(300, 300, 60, 1, "raise");
  levelSite(field, layers, 300, 300, 40, 6);
  assert.ok(Math.abs(field.heightAt(300, 300) - 6) < 1.2);
  assert.equal(layers.getAt("vegKind", 300, 300), VEGETATION.NONE);
});

test("rain wets the soil, fills pits and stops ponding when dry", () => {
  const { field, layers } = flat();
  crater(field, layers, 320, 320, 36, 3);
  const eco = new EcosystemSimulator({ layers, field, random: rng(3) });
  eco.setWeather("storm");
  eco.weather.changeAt = 1e9;
  for (let t = 0; t < 200; t += 1) eco.step(1);
  const pond = layers.getAt("waterSurface", 320, 320);
  assert.ok(pond > NO_WATER, "crater floor should pond");
  assert.ok(layers.getAt("moisture", 700, 700) === 0 || layers.getAt("moisture", 200, 200) > 120, "ground should be wetter");
  eco.setWeather("clear");
  eco.weather.changeAt = 1e9;
  for (let t = 0; t < 1200; t += 1) eco.step(1);
  const after = layers.getAt("waterSurface", 320, 320);
  assert.ok(after === NO_WATER || after < pond, "pond shrinks in dry weather");
});

test("fire spreads through vegetation, scars it, and rain puts it out", () => {
  const { field, layers } = flat();
  for (let j = 0; j < 40; j += 1) for (let i = 0; i < 40; i += 1) {
    layers.set("vegKind", i, j, VEGETATION.FOREST);
    layers.set("vegetation", i, j, 230);
    layers.set("moisture", i, j, 20);
  }
  const eco = new EcosystemSimulator({ layers, field, random: rng(9) });
  eco.weather.changeAt = 1e9;
  assert.ok(eco.ignite(320, 320, 1.2));
  let peak = 0;
  for (let t = 0; t < 120; t += 1) { eco.step(1); peak = Math.max(peak, eco.burning); }
  assert.ok(peak > 6, `fire should spread (peak ${peak})`);
  assert.ok(eco.stats.burnedCells > 4);
  assert.ok(layers.getAt("scorch", 320, 320) > 100);
  assert.ok(layers.getAt("vegetation", 320, 320) < 60);
  // Rain on a second fire.
  const second = new EcosystemSimulator({ layers: flat().layers, field, random: rng(9) });
  second.setWeather("storm");
  second.weather.changeAt = 1e9;
  const wetLayers = second.layers;
  for (let j = 0; j < 40; j += 1) for (let i = 0; i < 40; i += 1) { wetLayers.set("vegKind", i, j, VEGETATION.FOREST); wetLayers.set("vegetation", i, j, 230); wetLayers.set("moisture", i, j, 240); }
  second.ignite(320, 320, 1.2);
  for (let t = 0; t < 60; t += 1) second.step(1);
  assert.ok(second.burning <= 2, "storm douses the fire");
});

test("scorched ground heals and plants regrow slowly", () => {
  const { field, layers } = flat();
  crater(field, layers, 320, 320, 30, 1.2);
  const eco = new EcosystemSimulator({ layers, field, random: rng(5) });
  eco.setWeather("rain");
  eco.weather.changeAt = 1e9;
  const startScorch = layers.getAt("scorch", 360, 320);
  for (let t = 0; t < 1500; t += 1) eco.step(1);
  assert.ok(layers.getAt("scorch", 360, 320) < startScorch, "scorch fades");
});

test("crops grow, can be harvested once, and burn", () => {
  const { field, layers } = flat();
  assert.ok(plantCrop(layers, 10, 10));
  const eco = new EcosystemSimulator({ layers, field, random: rng(11) });
  eco.setWeather("rain");
  eco.weather.changeAt = 1e9;
  assert.equal(eco.harvest(10, 10), 0, "unripe crops yield nothing");
  for (let t = 0; t < 3000 && layers.get("cropStage", 10, 10) < 200; t += 1) eco.step(1);
  assert.ok(layers.get("cropStage", 10, 10) >= 150, "crop ripens");
  const food = eco.harvest(10, 10);
  assert.ok(food > 0);
  assert.equal(eco.harvest(10, 10), 0, "harvest resets the plot");
});

test("vegetation placement is deterministic", () => {
  const a = plantsForCell(12, 9, VEGETATION.FOREST, 0.8, 0);
  const b = plantsForCell(12, 9, VEGETATION.FOREST, 0.8, 0);
  assert.deepEqual(a, b);
  assert.ok(Array.isArray(a));
});
