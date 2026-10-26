// Bakes lit, textured terrain for one chunk from the height field and the
// world's surface layers. Pure (no DOM): it returns RGBA bytes, so it runs in
// tests and could move to a worker. Materials are blended from real texture
// samples by elevation, slope, moisture, fertility and wear, then lit with a
// hillshade plus cast shadows so cliffs, ridges, banks and craters read as
// three-dimensional from the top-down camera.

import { CHUNK_SAMPLES, CHUNK_SPAN, SAMPLE_SPACING, fractalNoise, valueNoise } from "./HeightField.js";
import { rasterizePadded } from "../world/WorldLayers.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const SHADER_PIXELS = 192;
export const TEXTURE_TEXELS_PER_UNIT = 1.0;
const MACRO_SCALE = 0.19;

// Palette ids a biome can choose from; names match TerrainTextureLibrary.
export const TERRAIN_PALETTES = Object.freeze({
  temperate: { flat: "grass", dry: "drygrass", bare: "dirt", shore: "sand", steep: "rockysoil", scree: "gravel", forest: "darksoil", wet: "mud", burnt: "ash", peak: "gravel" },
  forest: { flat: "grass", dry: "darksoil", bare: "dirt", shore: "mud", steep: "rockysoil", scree: "gravel", forest: "darksoil", wet: "mud", burnt: "ash", peak: "rockysoil" },
  desert: { flat: "sand", dry: "drydirt", bare: "sand", shore: "sand", steep: "rockysoil", scree: "gravel", forest: "drygrass", wet: "mud", burnt: "ash", peak: "rockysoil" },
  frozen: { flat: "gravel", dry: "gravel", bare: "dirt", shore: "gravel", steep: "rockysoil", scree: "gravel", forest: "darksoil", wet: "mud", burnt: "ash", peak: "rockysoil" },
  volcanic: { flat: "ash", dry: "ash", bare: "darksoil", shore: "ash", steep: "rockysoil", scree: "gravel", forest: "ash", wet: "mud", burnt: "ash", peak: "rockysoil" }
});

export const MATERIAL_ORDER = Object.freeze(["flat", "dry", "bare", "shore", "steep", "scree", "forest", "wet", "burnt", "peak"]);

// Material weights for one surface point. Pure and cheap; weights sum to 1.
export function materialWeights(input, out = new Float32Array(MATERIAL_ORDER.length)) {
  const { aboveWater, slope, fertility, moisture, vegetation, scorch, trample, noise } = input;
  const wobble = (noise - 0.5) * 0.12;
  const rock = smoothstep(0.17 + wobble, 0.40 + wobble, slope) * 0.95 + smoothstep(26, 62, aboveWater) * 0.85;
  const scree = smoothstep(0.09 + wobble, 0.2 + wobble, slope) * (1 - clamp(rock, 0, 1)) * 0.75;
  const shore = (1 - smoothstep(0.3, 1.5 + wobble * 5, aboveWater)) * (1 - clamp(rock, 0, 1)) * 0.85;
  const wet = smoothstep(0.55, 0.9, moisture) * (1 - clamp(rock + scree, 0, 1)) * (1 - shore);
  const burnt = clamp(scorch, 0, 1) * 0.92;
  const forest = clamp(vegetation, 0, 1) * smoothstep(0.35, 0.8, fertility) * 0.8;
  const worn = clamp(trample, 0, 1);
  const rest = Math.max(0, 1 - clamp(rock, 0, 1) - scree - shore - wet - burnt - forest);
  const lush = smoothstep(0.28, 0.62, fertility + wobble * 0.6) * (1 - worn);
  const dryShare = (1 - lush) * (1 - worn * 0.4);
  out[0] = rest * lush;
  out[1] = rest * dryShare * 0.7;
  out[2] = rest * ((1 - lush) * 0.3 + worn);
  out[3] = shore;
  out[4] = clamp(rock, 0, 1) * (1 - burnt * 0.5);
  out[5] = scree;
  out[6] = forest;
  out[7] = wet;
  out[8] = burnt;
  out[9] = 0;
  let total = 0;
  for (let n = 0; n < out.length; n += 1) total += out[n];
  if (total < 1e-5) { out[0] = 1; total = 1; }
  for (let n = 0; n < out.length; n += 1) out[n] /= total;
  return out;
}

function fallbackColor(name) {
  return ({
    grass: [112, 140, 62], drygrass: [176, 152, 92], dirt: [140, 108, 72], sand: [214, 190, 130], rockysoil: [122, 106, 88],
    gravel: [150, 142, 130], darksoil: [74, 78, 52], mud: [96, 74, 50], ash: [86, 84, 82], drydirt: [180, 150, 110]
  })[name] || [128, 128, 128];
}

// textures: { name: { data: Uint8ClampedArray(RGBA), width, height } }.
// Two taps at different scales break up repetition: the fine tap carries the
// detail, a slow tap of the same material modulates brightness over long
// distances so the tile period never reads.
function sampleTexture(texture, wx, wy, name, rgb) {
  if (!texture) { const c = fallbackColor(name); rgb[0] = c[0]; rgb[1] = c[1]; rgb[2] = c[2]; return; }
  const w = texture.width;
  const h = texture.height;
  const u = ((Math.floor(wx * TEXTURE_TEXELS_PER_UNIT) % w) + w) % w;
  const v = ((Math.floor(wy * TEXTURE_TEXELS_PER_UNIT) % h) + h) % h;
  const k = (v * w + u) * 4;
  const mu = ((Math.floor(wx * MACRO_SCALE + 97) % w) + w) % w;
  const mv = ((Math.floor(wy * MACRO_SCALE + 41) % h) + h) % h;
  const mk = (mv * w + mu) * 4;
  const lum = (texture.data[mk] + texture.data[mk + 1] + texture.data[mk + 2]) / 3 / 128;
  const gain = 0.68 + 0.32 * lum;
  rgb[0] = texture.data[k] * gain; rgb[1] = texture.data[k + 1] * gain; rgb[2] = texture.data[k + 2] * gain;
}

const DEFAULT_SUN = Object.freeze({ x: -0.55, y: -0.5, z: 0.62 });

/**
 * @param {object} options
 * @param {import("./HeightField.js").HeightField} options.field
 * @param {object|null} options.layers  optional WorldLayers (rasterize(...))
 * @param {number} options.chunkX
 * @param {number} options.chunkY
 * @returns {{ pixels: Uint8ClampedArray, size: number }}
 */
export function gatherTerrainChunkInput({ field, layers = null, chunkX, chunkY, size = SHADER_PIXELS, palette = "temperate", seed = 1, sun = DEFAULT_SUN }) {
  const latticeMargin = 5;
  const latticeSide = CHUNK_SAMPLES + latticeMargin * 2 + 1;
  const lattice = new Float32Array(latticeSide * latticeSide);
  const maxI = Math.floor(field.width / SAMPLE_SPACING);
  const maxJ = Math.floor(field.height / SAMPLE_SPACING);
  const baseI = chunkX * CHUNK_SAMPLES - latticeMargin;
  const baseJ = chunkY * CHUNK_SAMPLES - latticeMargin;
  for (let lj = 0; lj < latticeSide; lj += 1) {
    const j = clamp(baseJ + lj, 0, maxJ);
    for (let li = 0; li < latticeSide; li += 1) lattice[lj * latticeSide + li] = field.sample(clamp(baseI + li, 0, maxI), j);
  }
  return {
    chunkX, chunkY, size, palette, seed, sun,
    lattice, latticeSide, latticeMargin,
    waterLevel: field.waterLevel,
    padded: layers?.gatherPadded ? layers.gatherPadded(chunkX, chunkY) : null
  };
}

export function shadeTerrainChunk({ field, layers = null, chunkX, chunkY, size = SHADER_PIXELS, textures = {}, palette = TERRAIN_PALETTES.temperate, sun = DEFAULT_SUN, seed = 1 }) {
  const input = gatherTerrainChunkInput({ field, layers, chunkX, chunkY, size, seed, sun });
  return shadeTerrainChunkFromInput(input, textures, palette);
}

/**
 * Pure: runs entirely on typed arrays, so it can execute in a Web Worker.
 * `input` comes from gatherTerrainChunkInput; `palette` is a palette object
 * (not its name) so a worker can resolve it from TERRAIN_PALETTES itself.
 */
export function shadeTerrainChunkFromInput(input, textures = {}, palette = TERRAIN_PALETTES.temperate) {
  const { chunkX, chunkY, size, seed, sun, lattice, latticeSide, latticeMargin, waterLevel, padded } = input;
  const step = CHUNK_SPAN / size;
  const margin = 40; // pixels of height context for slopes and cast shadows
  const grid = size + margin * 2;
  const originX = chunkX * CHUNK_SPAN - margin * step;
  const originY = chunkY * CHUNK_SPAN - margin * step;
  const heights = new Float32Array(grid * grid);
  const baseI = chunkX * CHUNK_SAMPLES - latticeMargin;
  const baseJ = chunkY * CHUNK_SAMPLES - latticeMargin;
  const cr = (t, a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const row = [0, 0, 0, 0];
  for (let gy = 0; gy < grid; gy += 1) {
    const v = (originY + gy * step) / SAMPLE_SPACING - baseJ;
    const j0 = clamp(Math.floor(v), 1, latticeSide - 3);
    const ty = v - j0;
    for (let gx = 0; gx < grid; gx += 1) {
      const u = (originX + gx * step) / SAMPLE_SPACING - baseI;
      const i0 = clamp(Math.floor(u), 1, latticeSide - 3);
      const tx = u - i0;
      for (let q = 0; q < 4; q += 1) {
        const o = (j0 - 1 + q) * latticeSide + i0 - 1;
        row[q] = cr(tx, lattice[o], lattice[o + 1], lattice[o + 2], lattice[o + 3]);
      }
      let value = cr(ty, row[0], row[1], row[2], row[3]);
      const c0 = lattice[j0 * latticeSide + i0];
      const c1 = lattice[j0 * latticeSide + i0 + 1];
      const c2 = lattice[(j0 + 1) * latticeSide + i0];
      const c3 = lattice[(j0 + 1) * latticeSide + i0 + 1];
      const lo = Math.min(c0, c1, c2, c3);
      const hi = Math.max(c0, c1, c2, c3);
      if (value < lo) value = lo; else if (value > hi) value = hi;
      heights[gy * grid + gx] = value;
    }
  }
  const raster = padded ? rasterizePadded(padded, size) : null;
  const pixels = new Uint8ClampedArray(size * size * 4);
  const weights = new Float32Array(MATERIAL_ORDER.length);
  const rgb = [0, 0, 0];
  const albedo = [0, 0, 0];
  const sunLength = Math.hypot(sun.x, sun.y, sun.z) || 1;
  const sx = sun.x / sunLength;
  const sy = sun.y / sunLength;
  const sz = sun.z / sunLength;
  const flatLight = sz;
  const shadowDirX = -sun.x / Math.hypot(sun.x, sun.y);
  const shadowDirY = -sun.y / Math.hypot(sun.x, sun.y);
  const sunTan = sz / Math.max(1e-3, Math.hypot(sx, sy));
  const exaggeration = 1.6;
  const materialTextures = MATERIAL_ORDER.map(key => textures[palette[key]] || null);
  const materialNames = MATERIAL_ORDER.map(key => palette[key]);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const gx = px + margin;
      const gy = py + margin;
      const h = heights[gy * grid + gx];
      const wx = chunkX * CHUNK_SPAN + (px + 0.5) * step;
      const wy = chunkY * CHUNK_SPAN + (py + 0.5) * step;
      const hl = heights[gy * grid + gx - 1];
      const hr = heights[gy * grid + gx + 1];
      const hu = heights[(gy - 1) * grid + gx];
      const hd = heights[(gy + 1) * grid + gx];
      const gradX = (hr - hl) / (2 * step);
      const gradY = (hd - hu) / (2 * step);
      const slope = Math.hypot(gradX, gradY);
      const noise = valueNoise(wx / 7, wy / 7, seed + 11);
      const broad = fractalNoise(wx / 180, wy / 180, seed + 3, 3);
      const idx = py * size + px;
      const fertility = raster ? raster.fertility[idx] / 255 : clamp(0.55 + (broad - 0.5) * 1.1 - Math.max(0, h) * 0.006, 0, 1);
      const moisture = raster ? raster.moisture[idx] / 255 : clamp(0.35 - h * 0.05 + (broad - 0.5) * 0.4, 0, 1);
      const vegetation = raster ? raster.vegetation[idx] / 255 : 0;
      const scorch = raster ? raster.scorch[idx] / 255 : 0;
      const trample = raster ? raster.trample[idx] / 255 : 0;
      let surface = waterLevel == null ? -1e9 : waterLevel;
      if (raster && raster.waterSurface[idx] > surface) surface = raster.waterSurface[idx];
      const aboveWater = surface < -1e8 ? h + 10 : h - surface;
      let r;
      let g;
      let b;
      const waterDepth = surface < -1e8 ? 0 : Math.max(0, -aboveWater);
      if (waterDepth > 0.02) {
        // Water: depth tint, bed visible in the shallows, drifting caustic sparkle.
        const depth = clamp(waterDepth / 9, 0, 1);
        const sparkle = valueNoise(wx / 5 + 3.1, wy / 5, seed + 29) * valueNoise(wx / 9, wy / 9 + 5.3, seed + 41);
        const shallow = [92, 168, 170];
        const deep = [26, 78, 112];
        r = shallow[0] + (deep[0] - shallow[0]) * Math.sqrt(depth);
        g = shallow[1] + (deep[1] - shallow[1]) * Math.sqrt(depth);
        b = shallow[2] + (deep[2] - shallow[2]) * Math.sqrt(depth);
        if (depth < 0.35) {
          materialWeights({ aboveWater: 0, slope, fertility: 0.2, moisture: 1, vegetation: 0, scorch: 0, trample: 0, noise }, weights);
          sampleTexture(textures.sand || textures.dirt, wx, wy, "sand", rgb);
          const mix = (0.35 - depth) / 0.35 * 0.55;
          r += (rgb[0] - r) * mix; g += (rgb[1] - g) * mix; b += (rgb[2] - b) * mix;
        }
        const glint = Math.max(0, sparkle - 0.32) * 120 * (1 - depth * 0.6);
        r += glint * 0.6; g += glint * 0.8; b += glint;
        // Soft foam where the bank meets the water.
        if (waterDepth < 0.5) { const foam = (0.5 - waterDepth) * 1.2 * (0.55 + noise * 0.6); r += (236 - r) * foam * 0.5; g += (240 - g) * foam * 0.5; b += (232 - b) * foam * 0.5; }
        // Water gets only a gentle light and no cast shadows.
        const light = 0.94 + clamp((-gradX * sx - gradY * sy) * 0.4, -0.06, 0.06);
        r *= light; g *= light; b *= light;
      } else {
        materialWeights({ aboveWater, slope, fertility, moisture, vegetation, scorch, trample, noise }, weights);
        albedo[0] = albedo[1] = albedo[2] = 0;
        for (let m = 0; m < weights.length; m += 1) {
          const weight = weights[m];
          if (weight < 0.01) continue;
          sampleTexture(materialTextures[m], wx, wy, materialNames[m], rgb);
          albedo[0] += rgb[0] * weight; albedo[1] += rgb[1] * weight; albedo[2] += rgb[2] * weight;
        }
        // Rock strata: faint horizontal banding by height on steep faces.
        const cliff = smoothstep(0.3, 0.7, slope);
        if (cliff > 0) {
          const strata = 0.9 + 0.1 * Math.sin(h * 1.6 + noise * 5) + (noise - 0.5) * 0.12;
          const k = 1 - cliff * (1 - strata) * 1.1 - cliff * 0.05;
          albedo[0] *= k; albedo[1] *= k * 0.99; albedo[2] *= k * 0.98;
        }
        // Wet soil is darker.
        const darken = 1 - moisture * 0.18 - (scorch * 0.25);
        albedo[0] *= darken; albedo[1] *= darken; albedo[2] *= darken;
        // Lambert lighting from the height gradient.
        const nx = -gradX * exaggeration;
        const ny = -gradY * exaggeration;
        const nz = 1;
        const nl = Math.hypot(nx, ny, nz);
        const diffuse = (nx * sx + ny * sy + nz * sz) / nl;
        let light = 0.58 + (diffuse - flatLight) * 1.55;
        // Cast shadow: march toward the sun through the height grid.
        let shadow = 0;
        for (let s = 1; s <= 9; s += 1) {
          const dist = s * 4.5;
          const qx = gx + Math.round(shadowDirX * dist / step * -1);
          const qy = gy + Math.round(shadowDirY * dist / step * -1);
          if (qx < 0 || qy < 0 || qx >= grid || qy >= grid) break;
          const rise = heights[qy * grid + qx] - h;
          const need = dist * sunTan;
          if (rise > need) { shadow = Math.max(shadow, Math.min(1, (rise - need) / 6 + 0.35)); if (shadow >= 1) break; }
        }
        light *= 1 - shadow * 0.24;
        // Gentle ambient occlusion in hollows (height below neighbourhood average).
        const avg = (hl + hr + hu + hd) * 0.25;
        light *= 1 + clamp((avg - h) * 0.04, -0.04, 0.06);
        light = clamp(light, 0.55, 1.3);
        // Altitude haze: higher ground reads slightly paler.
        const haze = clamp(aboveWater / 160, 0, 0.18);
        r = albedo[0] * light + haze * 40;
        g = albedo[1] * light + haze * 42;
        b = albedo[2] * light + haze * 46;
        // Slightly cool shadows, warm highlights.
        const tint = clamp(light - 0.9, -0.5, 0.4);
        r += tint * 10; b -= tint * 8;
        // Soft shoreline darkening where land meets water.
        if (surface > -1e8 && aboveWater < 0.7) { const wetEdge = (0.7 - aboveWater) / 0.7; r *= 1 - wetEdge * 0.12; g *= 1 - wetEdge * 0.1; b *= 1 - wetEdge * 0.06; }
      }
      const o = idx * 4;
      pixels[o] = r; pixels[o + 1] = g; pixels[o + 2] = b; pixels[o + 3] = 255;
    }
  }
  return { pixels, size };
}
