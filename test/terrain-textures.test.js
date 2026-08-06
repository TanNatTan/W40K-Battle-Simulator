import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  TERRAIN_TEXTURE_MANIFEST,
  terrainTexturePaths,
  terrainTextureType,
  terrainTextureVariant
} from "../src/rendering/TerrainTextureLibrary.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedTerrains = ["ash", "darksoil", "dirt", "drydirt", "drygrass", "grass", "gravel", "mud", "rockysoil", "sand"];

test("terrain texture manifest exposes four variants for every requested terrain", async () => {
  assert.deepEqual(Object.keys(TERRAIN_TEXTURE_MANIFEST), expectedTerrains);
  for (const terrain of expectedTerrains) {
    const paths = terrainTexturePaths(terrain);
    assert.equal(paths.length, 4, `${terrain} should have four texture variants`);
    await Promise.all(paths.map(path => access(resolve(projectRoot, path))));
  }
});

test("legacy terrain aliases use the appropriate new texture", () => {
  assert.equal(terrainTextureType("darkgrass"), "darksoil");
  assert.equal(terrainTextureType("rock"), "rockysoil");
  assert.equal(terrainTextureType("water"), null);
});

test("terrain variants are deterministic and remain within their terrain series", () => {
  const first = terrainTextureVariant("grass", 17, 29);
  assert.equal(first, terrainTextureVariant("grass", 17, 29));
  assert.ok(terrainTexturePaths("grass").includes(first));
  assert.equal(terrainTextureVariant("water", 17, 29), null);
});
