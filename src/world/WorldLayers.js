// Sparse surface/ecology layers that sit on top of the HeightField.
//
// The height field answers "how high is the ground"; these layers answer
// "what is on and under it": soil fertility, moisture, vegetation, standing
// water, scorching, buried deposits, structural integrity and ownership.
// Cells share the height field's lattice and chunking (16 world units per
// cell, 16 x 16 cells per chunk) so both systems page in and out together and
// renderers can bake whole chunks from either.

import { CHUNK_SAMPLES, CHUNK_SHIFT, CHUNK_SPAN, SAMPLE_SPACING } from "../terrain/HeightField.js";

export const SURFACE = Object.freeze({ SOIL: 0, STONE: 1, SAND: 2, MUD: 3, CONCRETE: 4, ROAD: 5 });
export const VEGETATION = Object.freeze({ NONE: 0, GRASS: 1, SHRUB: 2, FOREST: 3, CROP: 4 });
export const EARTHWORK = Object.freeze({ NONE: 0, TRENCH: 1, EMBANKMENT: 2, FIELD: 3, PIT: 4 });
export const DEPOSIT = Object.freeze({
  NONE: 0,
  IRON: 1,
  PROMETHIUM: 2,
  STONE: 3
});
export const DEPOSIT_RESOURCE = Object.freeze({ [DEPOSIT.IRON]: "materials", [DEPOSIT.PROMETHIUM]: "fuel", [DEPOSIT.STONE]: "materials" });
export const DEPOSIT_NAME = Object.freeze({ [DEPOSIT.IRON]: "iron ore", [DEPOSIT.PROMETHIUM]: "promethium seep", [DEPOSIT.STONE]: "stone" });

const CELLS = CHUNK_SAMPLES * CHUNK_SAMPLES;
const NO_WATER = -1e9;
const keyOf = (cx, cy) => (cx + 1024) * 4096 + (cy + 1024);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const BYTE_LAYERS = ["fertility", "moisture", "vegetation", "vegKind", "scorch", "trample", "fire", "deposit", "cover", "integrity", "owner", "surface", "earthwork", "cropStage", "dig"];

function createChunk(cx, cy, defaults) {
  const chunk = { cx, cy, rev: 0, waterSurface: new Float32Array(CELLS).fill(NO_WATER), depositAmount: new Uint16Array(CELLS) };
  for (const name of BYTE_LAYERS) {
    chunk[name] = new Uint8Array(CELLS);
    const fill = defaults[name];
    if (fill) chunk[name].fill(fill);
  }
  return chunk;
}

// Pure bilinear resampling of the padded layer grids to an n x n pixel raster.
export function rasterizePadded(grids, n) {
  const side = CHUNK_SAMPLES + 3;
  const surfaceGrid = grids.waterSurface;
  const out = {
    fertility: new Uint8Array(n * n), moisture: new Uint8Array(n * n), vegetation: new Uint8Array(n * n),
    scorch: new Uint8Array(n * n), trample: new Uint8Array(n * n), water: new Uint8Array(n * n),
    waterSurface: new Float32Array(n * n).fill(NO_WATER)
  };
  const names = ["fertility", "moisture", "vegetation", "scorch", "trample"];
  for (let py = 0; py < n; py += 1) {
    const fy = (py + 0.5) / n * CHUNK_SAMPLES + 1;
    const j = Math.floor(fy);
    const ty = fy - j;
    for (let px = 0; px < n; px += 1) {
      const fx = (px + 0.5) / n * CHUNK_SAMPLES + 1;
      const i = Math.floor(fx);
      const tx = fx - i;
      const base = j * side + i;
      const w00 = (1 - tx) * (1 - ty);
      const w10 = tx * (1 - ty);
      const w01 = (1 - tx) * ty;
      const w11 = tx * ty;
      const o = py * n + px;
      for (const name of names) {
        const g = grids[name];
        out[name][o] = g[base] * w00 + g[base + 1] * w10 + g[base + side] * w01 + g[base + side + 1] * w11;
      }
      // Coverage-weighted surface of wet neighbours only.
      let cover = 0;
      let surface = 0;
      const s00 = surfaceGrid[base];
      const s10 = surfaceGrid[base + 1];
      const s01 = surfaceGrid[base + side];
      const s11 = surfaceGrid[base + side + 1];
      if (s00 > NO_WATER) { cover += w00; surface += s00 * w00; }
      if (s10 > NO_WATER) { cover += w10; surface += s10 * w10; }
      if (s01 > NO_WATER) { cover += w01; surface += s01 * w01; }
      if (s11 > NO_WATER) { cover += w11; surface += s11 * w11; }
      if (cover > 0.18) out.waterSurface[o] = surface / cover;
    }
  }
  return out;
}

export class WorldLayers {
  constructor({ width = 1920, height = 1080, defaults = {} } = {}) {
    this.width = width;
    this.height = height;
    this.defaults = { fertility: 140, integrity: 255, ...defaults };
    this.chunks = new Map();
    this.bulk = 0;
    this.listeners = new Set();
  }

  clear() {
    this.chunks.clear();
    this.bulk += 1;
  }

  chunkAt(cx, cy, create = false) {
    const key = keyOf(cx, cy);
    let chunk = this.chunks.get(key);
    if (!chunk && create) {
      chunk = createChunk(cx, cy, this.defaults);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  revisionAround(cx, cy) {
    let total = this.bulk * 1e5;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const chunk = this.chunks.get(keyOf(cx + dx, cy + dy));
        if (chunk) total += chunk.rev + 1;
      }
    }
    return total;
  }

  // ---- cell addressing ---------------------------------------------------
  // A cell's value lives at world point (i * spacing, j * spacing), the same
  // lattice the height field uses, so shorelines and banks line up exactly.
  static cellOf(x, y) { return { i: Math.round(x / SAMPLE_SPACING), j: Math.round(y / SAMPLE_SPACING) }; }

  _locate(i, j, create) {
    const cx = i >> CHUNK_SHIFT;
    const cy = j >> CHUNK_SHIFT;
    const chunk = this.chunkAt(cx, cy, create);
    if (!chunk) return null;
    return { chunk, index: (j & (CHUNK_SAMPLES - 1)) * CHUNK_SAMPLES + (i & (CHUNK_SAMPLES - 1)) };
  }

  get(name, i, j) {
    const spot = this._locate(i, j, false);
    if (!spot) return name === "waterSurface" ? NO_WATER : (name === "depositAmount" ? 0 : (this.defaults[name] || 0));
    return spot.chunk[name][spot.index];
  }

  set(name, i, j, value) {
    const spot = this._locate(i, j, true);
    const array = spot.chunk[name];
    let next = value;
    if (array instanceof Uint8Array) next = clamp(Math.round(value), 0, 255);
    else if (array instanceof Uint16Array) next = clamp(Math.round(value), 0, 65535);
    if (array[spot.index] !== next) { array[spot.index] = next; spot.chunk.rev += 1; }
  }

  add(name, i, j, delta) { this.set(name, i, j, this.get(name, i, j) + delta); }

  getAt(name, x, y) { return this.get(name, Math.round(x / SAMPLE_SPACING), Math.round(y / SAMPLE_SPACING)); }
  setAt(name, x, y, value) { this.set(name, Math.round(x / SAMPLE_SPACING), Math.round(y / SAMPLE_SPACING), value); }

  // Visit every cell whose centre lies within `radius` of (x, y).
  forEachInCircle(x, y, radius, visit) {
    const i0 = Math.ceil((x - radius) / SAMPLE_SPACING);
    const i1 = Math.floor((x + radius) / SAMPLE_SPACING);
    const j0 = Math.ceil((y - radius) / SAMPLE_SPACING);
    const j1 = Math.floor((y + radius) / SAMPLE_SPACING);
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        if (i < 0 || j < 0) continue;
        const dx = i * SAMPLE_SPACING - x;
        const dy = j * SAMPLE_SPACING - y;
        const distance = Math.hypot(dx, dy);
        if (distance <= radius) visit(i, j, distance);
      }
    }
  }

  // Aggregate query used by gameplay: what does the ground here do to units?
  surfaceInfo(x, y) {
    const i = Math.round(x / SAMPLE_SPACING);
    const j = Math.round(y / SAMPLE_SPACING);
    const spot = this._locate(i, j, false);
    if (!spot) {
      return { fertility: this.defaults.fertility / 255, moisture: 0, vegetation: 0, vegKind: 0, scorch: 0, fire: 0, earthwork: 0, integrity: 1, owner: 0, surface: 0, deposit: 0, waterSurface: NO_WATER };
    }
    const c = spot.chunk;
    const k = spot.index;
    return {
      fertility: c.fertility[k] / 255,
      moisture: c.moisture[k] / 255,
      vegetation: c.vegetation[k] / 255,
      vegKind: c.vegKind[k],
      scorch: c.scorch[k] / 255,
      fire: c.fire[k] / 255,
      earthwork: c.earthwork[k],
      integrity: c.integrity[k] / 255,
      owner: c.owner[k],
      surface: c.surface[k],
      deposit: c.deposit[k],
      waterSurface: c.waterSurface[k]
    };
  }

  // ---- baking support ----------------------------------------------------
  // Padded (CHUNK_SAMPLES + 3)^2 float grid for a layer so a chunk can be
  // interpolated at pixel resolution without per-pixel chunk lookups.
  _padded(name, cx, cy, fallback) {
    const side = CHUNK_SAMPLES + 3;
    const grid = new Float32Array(side * side);
    for (let gj = 0; gj < side; gj += 1) {
      for (let gi = 0; gi < side; gi += 1) {
        const i = cx * CHUNK_SAMPLES + gi - 1;
        const j = cy * CHUNK_SAMPLES + gj - 1;
        const spot = this._locate(i, j, false);
        grid[gj * side + gi] = spot ? spot.chunk[name][spot.index] : fallback;
      }
    }
    return grid;
  }

  // Plain typed-array snapshot of everything rasterize() needs for one chunk,
  // so the interpolation can run off the main thread (see TerrainBakeCore).
  gatherPadded(cx, cy) {
    return {
      fertility: this._padded("fertility", cx, cy, this.defaults.fertility),
      moisture: this._padded("moisture", cx, cy, 0),
      vegetation: this._padded("vegetation", cx, cy, 0),
      scorch: this._padded("scorch", cx, cy, 0),
      trample: this._padded("trample", cx, cy, 0),
      waterSurface: this._padded("waterSurface", cx, cy, NO_WATER)
    };
  }

  // Pixel rasters (n x n) for the terrain shader. Standing water is resolved
  // as a coverage-weighted surface height so shorelines follow the terrain.
  rasterize(cx, cy, n) {
    return rasterizePadded(this.gatherPadded(cx, cy), n);
  }

  // ---- persistence -------------------------------------------------------
  serialize() {
    const chunks = [];
    for (const chunk of this.chunks.values()) {
      const entry = { cx: chunk.cx, cy: chunk.cy };
      for (const name of BYTE_LAYERS) entry[name] = encodeBytes(chunk[name], this.defaults[name] || 0);
      entry.depositAmount = encodeWords(chunk.depositAmount);
      entry.waterSurface = encodeWater(chunk.waterSurface);
      chunks.push(entry);
    }
    return { version: 1, spacing: SAMPLE_SPACING, chunkSamples: CHUNK_SAMPLES, defaults: this.defaults, chunks };
  }

  static deserialize(payload, size = {}) {
    const layers = new WorldLayers({ width: size.width, height: size.height, defaults: payload?.defaults || {} });
    if (!payload || payload.spacing !== SAMPLE_SPACING || payload.chunkSamples !== CHUNK_SAMPLES) return layers;
    for (const entry of payload.chunks || []) {
      const chunk = layers.chunkAt(Number(entry.cx) | 0, Number(entry.cy) | 0, true);
      for (const name of BYTE_LAYERS) if (entry[name] != null) decodeBytes(entry[name], chunk[name]);
      if (entry.depositAmount != null) decodeWords(entry.depositAmount, chunk.depositAmount);
      if (entry.waterSurface != null) decodeWater(entry.waterSurface, chunk.waterSurface);
      chunk.rev += 1;
    }
    return layers;
  }

  // Number of cells with any non-default content -- handy for diagnostics.
  stats() {
    let cells = 0;
    let forest = 0;
    let wet = 0;
    let burnt = 0;
    let deposits = 0;
    for (const chunk of this.chunks.values()) {
      cells += CELLS;
      for (let n = 0; n < CELLS; n += 1) {
        if (chunk.vegKind[n] === VEGETATION.FOREST) forest += 1;
        if (chunk.waterSurface[n] > NO_WATER) wet += 1;
        if (chunk.scorch[n] > 40) burnt += 1;
        if (chunk.deposit[n] && chunk.depositAmount[n] > 0) deposits += 1;
      }
    }
    return { chunks: this.chunks.size, cells, forest, wet, burnt, deposits };
  }
}

// ---- compact run-length codecs (JSON friendly) -----------------------------
function encodeBytes(array, fill) {
  const runs = [];
  let value = array[0];
  let count = 1;
  for (let n = 1; n < array.length; n += 1) {
    if (array[n] === value) count += 1;
    else { runs.push(value, count); value = array[n]; count = 1; }
  }
  runs.push(value, count);
  if (runs.length === 2 && runs[0] === fill) return 0;
  return runs;
}
function decodeBytes(runs, target) {
  if (!Array.isArray(runs)) return;
  let at = 0;
  for (let n = 0; n + 1 < runs.length && at < target.length; n += 2) {
    const value = runs[n];
    const count = runs[n + 1];
    for (let k = 0; k < count && at < target.length; k += 1) target[at++] = value;
  }
}
function encodeWords(array) {
  let any = false;
  for (const value of array) if (value) { any = true; break; }
  return any ? Array.from(array) : 0;
}
function decodeWords(values, target) {
  if (!Array.isArray(values)) return;
  for (let n = 0; n < target.length && n < values.length; n += 1) target[n] = values[n];
}
function encodeWater(array) {
  let any = false;
  for (const value of array) if (value > NO_WATER) { any = true; break; }
  return any ? Array.from(array, value => (value > NO_WATER ? Math.round(value * 100) / 100 : null)) : 0;
}
function decodeWater(values, target) {
  if (!Array.isArray(values)) return;
  for (let n = 0; n < target.length && n < values.length; n += 1) target[n] = values[n] == null ? NO_WATER : values[n];
}

export { NO_WATER, CHUNK_SPAN, BYTE_LAYERS };
