// Web Worker: shades terrain chunks off the main thread. The page sends the
// small typed-array snapshot made by gatherTerrainChunkInput and gets RGBA
// bytes back (transferred, not copied).
import { buildProceduralTextures } from "./ProceduralTextures.js";
import { TERRAIN_PALETTES, shadeTerrainChunkFromInput } from "./TerrainShader.js";

let textures = null;

self.onmessage = event => {
  const { id, key, rev, generation, input } = event.data || {};
  try {
    const startedAt = performance.now();
    textures ||= buildProceduralTextures(256);
    const palette = TERRAIN_PALETTES[input.palette] || TERRAIN_PALETTES.temperate;
    const { pixels, size } = shadeTerrainChunkFromInput(input, textures, palette);
    self.postMessage({ id, key, rev, generation, size, ms: performance.now() - startedAt, pixels: pixels.buffer }, [pixels.buffer]);
  } catch (error) {
    self.postMessage({ id, key, rev, generation, error: String(error?.message || error) });
  }
};
