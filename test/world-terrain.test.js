import assert from "node:assert/strict";
import test from "node:test";

import { HeightField, CHUNK_SPAN, SAMPLE_SPACING } from "../src/terrain/HeightField.js";
import { WorldLayers, DEPOSIT, VEGETATION } from "../src/world/WorldLayers.js";
import { generateRegion, pickSettlementSites } from "../src/world/RegionGenerator.js";
import { MATERIAL_ORDER, TERRAIN_PALETTES, materialWeights, shadeTerrainChunk } from "../src/terrain/TerrainShader.js";
import { buildProceduralTexture, buildProceduralTextures } from "../src/terrain/ProceduralTextures.js";

const SIZE = { width: 1536, height: 1024 };
const build = seed => {
  const field = new HeightField(SIZE);
  const layers = new WorldLayers(SIZE);
  const info = generateRegion({ field, layers, seed, ...SIZE });
  return { field, layers, info };
};

test("procedural textures are seamless, opaque and non-flat", () => {
  const tex = buildProceduralTexture("grass", 64);
  assert.equal(tex.data.length, 64 * 64 * 4);
  let min = 255; let max = 0;
  for (let n = 0; n < tex.data.length; n += 4) { min = Math.min(min, tex.data[n + 1]); max = Math.max(max, tex.data[n + 1]); assert.equal(tex.data[n + 3], 255); }
  assert.ok(max - min > 40, "grass should have visible variation");
  // Periodic: the first and last columns are neighbours across the wrap, so their difference stays small.
  let seam = 0; let inner = 0;
  for (let y = 0; y < 64; y += 1) {
    seam += Math.abs(tex.data[(y * 64) * 4 + 1] - tex.data[(y * 64 + 63) * 4 + 1]);
    inner += Math.abs(tex.data[(y * 64 + 31) * 4 + 1] - tex.data[(y * 64 + 32) * 4 + 1]);
  }
  assert.ok(seam < inner * 3 + 64, "wrap seam should look like any interior step");
  assert.deepEqual(Object.keys(buildProceduralTextures(16)).sort(), ["ash", "darksoil", "dirt", "drydirt", "drygrass", "grass", "gravel", "mud", "rockysoil", "sand"]);
});

test("material weights are normalised and follow slope, altitude and wetness", () => {
  const flat = materialWeights({ aboveWater: 6, slope: 0.02, fertility: 0.8, moisture: 0.2, vegetation: 0, scorch: 0, trample: 0, noise: 0.5 });
  const cliff = materialWeights({ aboveWater: 30, slope: 0.7, fertility: 0.8, moisture: 0.2, vegetation: 0, scorch: 0, trample: 0, noise: 0.5 });
  const burnt = materialWeights({ aboveWater: 6, slope: 0.02, fertility: 0.8, moisture: 0.2, vegetation: 0, scorch: 1, trample: 0, noise: 0.5 });
  for (const w of [flat, cliff, burnt]) assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-4);
  const idx = name => MATERIAL_ORDER.indexOf(name);
  assert.ok(flat[idx("flat")] > 0.5);
  assert.ok(cliff[idx("steep")] > 0.7);
  assert.ok(burnt[idx("burnt")] > 0.6);
});

test("generated regions are deterministic, varied and contain water, woods and deposits", () => {
  const a = build("BRAVO");
  const b = build("BRAVO");
  const c = build("CHARLIE");
  assert.deepEqual(a.field.serialize(), b.field.serialize());
  assert.notDeepEqual(a.field.serialize().chunks[0], c.field.serialize().chunks[0]);
  const { min, max } = a.field.extent();
  assert.ok(max - min > 40, `relief range ${min}..${max}`);
  const stats = a.layers.stats();
  assert.ok(stats.forest > 100, "woodland expected");
  assert.ok(stats.wet > 20, "standing water expected");
  assert.ok(stats.deposits > 20, "buried deposits expected");
  assert.ok(a.info.sites.length > 5, "settlement sites expected");
});

test("river surfaces never rise downstream and sit above their carved bed", () => {
  const { info, field } = build("RIVERS-1");
  assert.ok(info.rivers.length >= 1);
  for (const river of info.rivers) {
    for (let k = 1; k < river.surfaces.length; k += 1) assert.ok(river.surfaces[k] <= river.surfaces[k - 1] + 1e-6);
    const mid = river.path[Math.floor(river.path.length / 2)];
    const k = Math.floor(river.path.length / 2);
    assert.ok(field.heightAt(mid.x, mid.y) < river.surfaces[k], "channel centre is below the water surface");
  }
});

test("chunk shading is deterministic, opaque, and renders water differently from land", () => {
  const { field, layers, info } = build("SHADE-1");
  const river = info.rivers[0];
  const mid = river.path[Math.floor(river.path.length / 2)];
  const cx = Math.floor(mid.x / CHUNK_SPAN);
  const cy = Math.floor(mid.y / CHUNK_SPAN);
  const textures = buildProceduralTextures(32);
  const args = { field, layers, chunkX: cx, chunkY: cy, size: 64, textures, palette: TERRAIN_PALETTES.temperate, seed: field.seed };
  const one = shadeTerrainChunk(args);
  const two = shadeTerrainChunk(args);
  assert.deepEqual(Array.from(one.pixels.slice(0, 400)), Array.from(two.pixels.slice(0, 400)));
  let blueish = 0;
  for (let n = 0; n < one.pixels.length; n += 4) { assert.equal(one.pixels[n + 3], 255); if (one.pixels[n + 2] > one.pixels[n] + 25) blueish += 1; }
  assert.ok(blueish > 30, "a river chunk must contain visible water");
});

test("world layers store, query, rasterise and round-trip through serialisation", () => {
  const layers = new WorldLayers({ width: 1024, height: 1024 });
  layers.set("fertility", 10, 12, 200);
  layers.set("vegKind", 10, 12, VEGETATION.FOREST);
  layers.set("deposit", 11, 12, DEPOSIT.IRON);
  layers.set("depositAmount", 11, 12, 777);
  layers.set("waterSurface", 3, 3, 1.25);
  assert.equal(layers.get("fertility", 10, 12), 200);
  assert.equal(layers.getAt("fertility", 10 * SAMPLE_SPACING, 12 * SAMPLE_SPACING), 200);
  assert.equal(layers.get("fertility", 400, 400), layers.defaults.fertility);
  assert.equal(layers.surfaceInfo(11 * SAMPLE_SPACING, 12 * SAMPLE_SPACING).deposit, DEPOSIT.IRON);
  const copy = WorldLayers.deserialize(JSON.parse(JSON.stringify(layers.serialize())), { width: 1024, height: 1024 });
  assert.equal(copy.get("depositAmount", 11, 12), 777);
  assert.equal(copy.get("waterSurface", 3, 3), 1.25);
  assert.equal(copy.get("vegKind", 10, 12), VEGETATION.FOREST);
  const hits = [];
  layers.forEachInCircle(10 * SAMPLE_SPACING, 12 * SAMPLE_SPACING, SAMPLE_SPACING * 1.5, (i, j) => hits.push([i, j]));
  assert.ok(hits.some(([i, j]) => i === 10 && j === 12));
  const raster = layers.rasterize(0, 0, 32);
  assert.ok(raster.waterSurface.some(value => value > -1e8));
  assert.ok(layers.revisionAround(0, 0) > 0);
});

test("settlement site picking keeps a minimum separation", () => {
  const { info } = build("SITES-1");
  const chosen = pickSettlementSites(info.sites, 4, 300);
  assert.ok(chosen.length >= 2);
  for (let a = 0; a < chosen.length; a += 1) for (let b = a + 1; b < chosen.length; b += 1) assert.ok(Math.hypot(chosen[a].x - chosen[b].x, chosen[a].y - chosen[b].y) >= 300);
});

test("older coarse height saves resample onto the finer lattice", () => {
  const payload = { version: 1, spacing: 32, chunkSamples: 8, baseHeight: 0, seed: 3, chunks: [{ cx: 0, cy: 0, data: Array.from({ length: 64 }, (_, n) => (n % 8) * 2) }] };
  const field = HeightField.deserialize(payload, { width: 512, height: 512 });
  assert.ok(Math.abs(field.heightAt(64, 32) - 4) < 0.6);
  assert.ok(field.heightAt(160, 32) > field.heightAt(64, 32));
});
