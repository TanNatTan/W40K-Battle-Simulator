import assert from "node:assert/strict";
import test from "node:test";

import { HeightField } from "../src/terrain/HeightField.js";
import { WorldLayers, rasterizePadded } from "../src/world/WorldLayers.js";
import { SHADER_PIXELS, TERRAIN_PALETTES, gatherTerrainChunkInput, shadeTerrainChunk, shadeTerrainChunkFromInput } from "../src/terrain/TerrainShader.js";
import { buildProceduralTextures } from "../src/terrain/ProceduralTextures.js";
import { TerrainBakeClient } from "../src/terrain/TerrainBakeClient.js";
import { viewTransform } from "../src/rendering/GLGroundLayer.js";

function sampleField() {
  const field = new HeightField({ width: 1024, height: 1024 });
  field.applyBrush?.({ x: 400, y: 400, radius: 140, strength: 14, mode: "raise" });
  return field;
}

test("gather + shade is identical to the one-shot shader and survives a structured clone", () => {
  const field = sampleField();
  const layers = new WorldLayers({ width: 1024, height: 1024 });
  const textures = buildProceduralTextures(64);
  const direct = shadeTerrainChunk({ field, layers, chunkX: 1, chunkY: 1, size: 48, textures, palette: TERRAIN_PALETTES.temperate, seed: 5 });
  const input = gatherTerrainChunkInput({ field, layers, chunkX: 1, chunkY: 1, size: 48, seed: 5 });
  const viaWorkerShape = structuredClone(input); // what postMessage does
  const split = shadeTerrainChunkFromInput(viaWorkerShape, textures, TERRAIN_PALETTES.temperate);
  assert.equal(split.pixels.length, direct.pixels.length);
  assert.deepEqual(Array.from(split.pixels.slice(0, 400)), Array.from(direct.pixels.slice(0, 400)));
  assert.ok(input.lattice instanceof Float32Array && input.padded.fertility instanceof Float32Array);
});

test("layer rasterisation is the same through rasterize() and rasterizePadded()", () => {
  const layers = new WorldLayers({ width: 1024, height: 1024 });
  const a = layers.rasterize(0, 0, 16);
  const b = rasterizePadded(layers.gatherPadded(0, 0), 16);
  assert.deepEqual(Array.from(a.fertility), Array.from(b.fertility));
  assert.deepEqual(Array.from(a.waterSurface), Array.from(b.waterSurface));
});

test("bake client bounds in-flight work, returns results and drops superseded ones", () => {
  const posted = [];
  const worker = { postMessage: message => posted.push(message), terminate() {} };
  const client = new TerrainBakeClient({ createWorker: () => worker, poolSize: 1, perWorker: 2 });
  const input = () => ({ lattice: new Float32Array(4), padded: null });
  const done = [];
  assert.ok(client.request("0,0", 1, input(), result => done.push(result.key)));
  assert.ok(client.request("1,0", 1, input(), result => done.push(result.key)));
  assert.equal(client.request("2,0", 1, input(), () => {}), false, "third request waits for a slot");
  assert.ok(client.isPending("0,0", 1));
  client.reset(); // the map changed: everything in flight is stale
  worker.onmessage({ data: { id: posted[0].id, size: 2, pixels: new ArrayBuffer(16) } });
  assert.deepEqual(done, [], "stale result dropped");
  worker.onmessage({ data: { id: posted[1].id, size: 2, pixels: new ArrayBuffer(16) } });
  assert.equal(client.inFlight, 0);
  assert.ok(client.request("3,0", 2, input(), result => done.push(result.key)));
  worker.onmessage({ data: { id: posted[2].id, key: "3,0", rev: 2, size: 2, pixels: new ArrayBuffer(16), ms: 3 } });
  assert.deepEqual(done, ["3,0"]);
});

test("bake client reports unavailable when workers cannot be created", () => {
  const client = new TerrainBakeClient({ createWorker: () => { throw new Error("no workers"); } });
  assert.equal(client.available, false);
  assert.equal(client.request("0,0", 1, { lattice: new Float32Array(1) }, () => {}), false);
});

test("view transform matches the 2D camera transform", () => {
  const t = viewTransform({ x: 500, y: 300, zoom: 2 }, 1920, 1080, 1920, 1080);
  assert.equal(t.a, 2);
  assert.equal(t.d, 2);
  assert.equal(t.a * 500 + t.e, 960, "camera centre lands in the middle of the canvas");
  assert.equal(t.d * 300 + t.f, 540);
});

test("the SHADER_PIXELS tile size is what the chunk canvases use", () => {
  assert.ok(SHADER_PIXELS >= 64);
});
