// Continuous, sparse terrain height field.
//
// Heights are stored on a lattice of SAMPLE_SPACING world units, grouped in
// chunks of CHUNK_SAMPLES x CHUNK_SAMPLES so a 65k x 65k world only pays for
// the regions that actually have relief. Anything not stored reads as the
// field's `baseHeight`. Queries are bilinear so slope, normals and line of
// sight are smooth and stable instead of snapping at tile borders.

export const SAMPLE_SPACING = 16;
export const CHUNK_SHIFT = 4;
export const CHUNK_SAMPLES = 1 << CHUNK_SHIFT;
export const CHUNK_SPAN = SAMPLE_SPACING * CHUNK_SAMPLES;
export const MAX_HEIGHT = 120;
export const MIN_HEIGHT = -40;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const keyOf = (cx, cy) => (cx + 1024) * 4096 + (cy + 1024);

// mulberry32 -- tiny deterministic PRNG so map seeds reproduce exactly.
export function seededRandom(seed) {
  let a = (Number(seed) || 1) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) / 4294967296);
}

const smooth = t => t * t * (3 - 2 * t);

export function valueNoise(x, y, seed = 1) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

export function fractalNoise(x, y, seed = 1, octaves = 5, persistence = 0.5) {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(x * frequency, y * frequency, seed + octave * 101) * amplitude;
    norm += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return total / norm;
}

export class HeightField {
  constructor({ width = 4096, height = 2304, baseHeight = 0 } = {}) {
    this.width = width;
    this.height = height;
    this.baseHeight = baseHeight;
    this.chunks = new Map();
    this.relief = new Map();
    this.reliefProvider = null;
    this.reliefEnabled = false;
    this.version = 0;
    this.bulk = 0; // bumps on whole-field changes (generate, clear, adopt, relief)
    this.waterLevel = null; // null = no standing water (legacy maps)
    this.seed = 0;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  clear() {
    this.chunks.clear();
    this.relief.clear();
    this.version += 1;
    this.bulk += 1;
  }

  // True when there is any relief to evaluate. Flat maps skip all height work.
  get active() {
    return this.chunks.size > 0 || (this.reliefEnabled && Boolean(this.reliefProvider)) || this.baseHeight !== 0;
  }

  // ---- raw sample access -------------------------------------------------
  chunkAt(cx, cy, create = false) {
    const key = keyOf(cx, cy);
    let chunk = this.chunks.get(key);
    if (!chunk && create) {
      chunk = { cx, cy, data: new Float32Array(CHUNK_SAMPLES * CHUNK_SAMPLES), shade: null, shadeVersion: -1, rev: 0 };
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  reliefChunk(cx, cy) {
    if (!this.reliefProvider || !this.reliefEnabled) return null;
    const key = keyOf(cx, cy);
    let chunk = this.relief.get(key);
    if (!chunk) {
      const data = new Float32Array(CHUNK_SAMPLES * CHUNK_SAMPLES);
      let any = false;
      for (let j = 0; j < CHUNK_SAMPLES; j += 1) {
        for (let i = 0; i < CHUNK_SAMPLES; i += 1) {
          const value = Number(this.reliefProvider((cx * CHUNK_SAMPLES + i) * SAMPLE_SPACING, (cy * CHUNK_SAMPLES + j) * SAMPLE_SPACING)) || 0;
          data[j * CHUNK_SAMPLES + i] = value;
          if (value !== 0) any = true;
        }
      }
      chunk = any ? { data } : { data: null };
      this.relief.set(key, chunk);
    }
    return chunk.data ? chunk : null;
  }

  sample(i, j) {
    const cx = i >> CHUNK_SHIFT;
    const cy = j >> CHUNK_SHIFT;
    const li = i & (CHUNK_SAMPLES - 1);
    const lj = j & (CHUNK_SAMPLES - 1);
    let value = this.baseHeight;
    const sculpt = this.chunks.get(keyOf(cx, cy));
    if (sculpt) value += sculpt.data[lj * CHUNK_SAMPLES + li];
    if (this.reliefEnabled && this.reliefProvider) {
      const relief = this.reliefChunk(cx, cy);
      if (relief) value += relief.data[lj * CHUNK_SAMPLES + li];
    }
    return value;
  }

  setSculptSample(i, j, value) {
    const cx = Math.floor(i / CHUNK_SAMPLES);
    const cy = Math.floor(j / CHUNK_SAMPLES);
    const chunk = this.chunkAt(cx, cy, true);
    chunk.data[(j - cy * CHUNK_SAMPLES) * CHUNK_SAMPLES + (i - cx * CHUNK_SAMPLES)] = clamp(value, MIN_HEIGHT, MAX_HEIGHT);
    chunk.shadeVersion = -1;
    chunk.rev += 1;
  }

  getSculptSample(i, j) {
    const cx = Math.floor(i / CHUNK_SAMPLES);
    const cy = Math.floor(j / CHUNK_SAMPLES);
    const chunk = this.chunks.get(keyOf(cx, cy));
    return chunk ? chunk.data[(j - cy * CHUNK_SAMPLES) * CHUNK_SAMPLES + (i - cx * CHUNK_SAMPLES)] : 0;
  }

  // ---- relief layer (derived from terrain features) ----------------------
  setReliefProvider(provider) {
    this.reliefProvider = typeof provider === "function" ? provider : null;
    this.reliefEnabled = Boolean(this.reliefProvider);
    this.invalidateRelief();
  }

  invalidateRelief() {
    this.relief.clear();
    this.version += 1;
    this.bulk += 1;
  }

  // Change detector for anything baked from this field around a chunk: shadows
  // and slopes read neighbouring chunks, so the 3x3 neighbourhood is summed.
  revisionAround(cx, cy) {
    let total = this.bulk * 1e6;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const chunk = this.chunks.get(keyOf(cx + dx, cy + dy));
        if (chunk) total += chunk.rev + 1;
      }
    }
    return total;
  }

  // ---- queries -----------------------------------------------------------
  heightAt(x, y) {
    if (!this.active) return 0;
    const fx = x / SAMPLE_SPACING;
    const fy = y / SAMPLE_SPACING;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const li = i & (CHUNK_SAMPLES - 1);
    const lj = j & (CHUNK_SAMPLES - 1);
    let a;
    let b;
    let c;
    let d;
    if (li < CHUNK_SAMPLES - 1 && lj < CHUNK_SAMPLES - 1) {
      // Common case: the whole cell sits inside one chunk, so fetch it once.
      const cx = i >> CHUNK_SHIFT;
      const cy = j >> CHUNK_SHIFT;
      const sculpt = this.chunks.get(keyOf(cx, cy));
      const relief = this.reliefEnabled ? this.reliefChunk(cx, cy) : null;
      const k = lj * CHUNK_SAMPLES + li;
      a = b = c = d = this.baseHeight;
      if (sculpt) {
        const data = sculpt.data;
        a += data[k]; b += data[k + 1]; c += data[k + CHUNK_SAMPLES]; d += data[k + CHUNK_SAMPLES + 1];
      }
      if (relief) {
        const data = relief.data;
        a += data[k]; b += data[k + 1]; c += data[k + CHUNK_SAMPLES]; d += data[k + CHUNK_SAMPLES + 1];
      }
    } else {
      a = this.sample(i, j);
      b = this.sample(i + 1, j);
      c = this.sample(i, j + 1);
      d = this.sample(i + 1, j + 1);
    }
    const top = a + (b - a) * tx;
    const bottom = c + (d - c) * tx;
    return top + (bottom - top) * ty;
  }

  // World-space gradient (height units per world unit).
  gradientAt(x, y) {
    const e = SAMPLE_SPACING * 0.5;
    return {
      gx: (this.heightAt(x + e, y) - this.heightAt(x - e, y)) / (2 * e),
      gy: (this.heightAt(x, y + e) - this.heightAt(x, y - e)) / (2 * e)
    };
  }

  slopeAt(x, y) {
    const { gx, gy } = this.gradientAt(x, y);
    return Math.hypot(gx, gy);
  }

  // Positive when moving (dx,dy) climbs, negative when descending.
  directionalSlope(x, y, dx, dy) {
    const length = Math.hypot(dx, dy);
    if (length < 1e-6) return 0;
    const { gx, gy } = this.gradientAt(x, y);
    return (gx * dx + gy * dy) / length;
  }

  // Unit surface normal (nx, ny point downhill-facing horizontal part).
  normalAt(x, y) {
    const { gx, gy } = this.gradientAt(x, y);
    const length = Math.hypot(gx, gy, 1);
    return { x: -gx / length, y: -gy / length, z: 1 / length };
  }

  // Light-direction hillshade in 0..1 (0.5 is flat).
  shadeAt(x, y, light = { x: -0.55, y: -0.55, z: 0.63 }) {
    const n = this.normalAt(x, y);
    const lightLength = Math.hypot(light.x, light.y, light.z) || 1;
    const dot = (n.x * light.x + n.y * light.y + n.z * light.z) / lightLength;
    const flat = light.z / lightLength;
    return clamp(0.5 + (dot - flat) * 1.8, 0, 1);
  }

  // Clear-sight test between two eye points. Heights are added to the terrain
  // at each end (eye/target height in elevation units). Returns the fraction
  // 0..1 of the path that is visible-blocked (0 = clear).
  lineOfSight(ax, ay, bx, by, eyeA = 1.6, eyeB = 1, { step = SAMPLE_SPACING * 0.75 } = {}) {
    const distance = Math.hypot(bx - ax, by - ay);
    if (distance < step) return { clear: true, blockedAt: null, margin: 1 };
    const za = this.heightAt(ax, ay) + eyeA;
    const zb = this.heightAt(bx, by) + eyeB;
    const steps = Math.max(2, Math.ceil(distance / step));
    let worst = Infinity;
    let blockedAt = null;
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps;
      const ground = this.heightAt(ax + (bx - ax) * t, ay + (by - ay) * t);
      const ray = za + (zb - za) * t;
      const margin = ray - ground;
      if (margin < worst) worst = margin;
      if (margin < 0 && blockedAt === null) blockedAt = t;
    }
    return { clear: blockedAt === null, blockedAt, margin: worst };
  }

  // ---- editing -----------------------------------------------------------
  // modes: raise | lower | smooth | flatten | plateau | ridge
  applyBrush(x, y, radius, strength, mode = "raise", { target = null } = {}) {
    const r = Math.max(SAMPLE_SPACING, radius);
    const i0 = Math.floor((x - r) / SAMPLE_SPACING);
    const i1 = Math.ceil((x + r) / SAMPLE_SPACING);
    const j0 = Math.floor((y - r) / SAMPLE_SPACING);
    const j1 = Math.ceil((y + r) / SAMPLE_SPACING);
    const maxI = Math.ceil(this.width / SAMPLE_SPACING);
    const maxJ = Math.ceil(this.height / SAMPLE_SPACING);
    const flattenTarget = target ?? this.heightAt(x, y);
    let touched = 0;
    // Smoothing needs the unmodified neighbourhood.
    const snapshot = mode === "smooth" ? new Map() : null;
    if (snapshot) {
      for (let j = j0 - 1; j <= j1 + 1; j += 1) for (let i = i0 - 1; i <= i1 + 1; i += 1) snapshot.set(`${i},${j}`, this.sample(i, j));
    }
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        if (i < 0 || j < 0 || i > maxI || j > maxJ) continue;
        const dist = Math.hypot(i * SAMPLE_SPACING - x, j * SAMPLE_SPACING - y);
        if (dist > r) continue;
        const falloff = smooth(1 - dist / r);
        const current = this.sample(i, j);
        const sculpt = this.getSculptSample(i, j);
        let next = current;
        if (mode === "raise") next = current + strength * falloff;
        else if (mode === "lower") next = current - strength * falloff;
        else if (mode === "flatten") next = current + (flattenTarget - current) * clamp(falloff * 0.35 * Math.abs(strength || 1), 0, 1);
        else if (mode === "plateau") next = current + (flattenTarget - current) * (falloff > 0.6 ? 0.6 : falloff * 0.25);
        else if (mode === "ridge") next = current + strength * falloff * (dist < r * 0.35 ? 1.6 : 0.6);
        else if (mode === "noise") next = current + (hash2(i, j, (this.version + 1) * 31) - 0.5) * 2 * strength * falloff;
        else if (mode === "terrace") {
          const step = Math.max(2, Math.abs(strength) * 2);
          next = current + (Math.round(current / step) * step - current) * clamp(falloff * 0.5, 0, 1);
        } else if (mode === "smooth") {
          let sum = 0;
          for (let dj = -1; dj <= 1; dj += 1) for (let di = -1; di <= 1; di += 1) sum += snapshot.get(`${i + di},${j + dj}`);
          next = current + (sum / 9 - current) * clamp(falloff * 0.6, 0, 1);
        }
        if (next !== current) {
          this.setSculptSample(i, j, sculpt + (next - current));
          touched += 1;
        }
      }
    }
    if (touched) this.version += 1;
    return touched;
  }

  // ---- procedural generation --------------------------------------------
  // Fractal terrain with an optional thermal-erosion pass that slumps steep
  // faces into believable talus slopes, plus a flattened plateau option so
  // deployment zones stay playable.
  generate({ seed = 1, amplitude = 46, scale = 900, octaves = 5, ridged = 0.35, erosionPasses = 4, seaLevel = -4, flatZones = [], mapWidth = this.width, mapHeight = this.height } = {}) {
    this.chunks.clear();
    this.seed = seed >>> 0;
    const cols = Math.ceil(mapWidth / SAMPLE_SPACING) + 1;
    const rows = Math.ceil(mapHeight / SAMPLE_SPACING) + 1;
    const grid = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const wx = i * SAMPLE_SPACING;
        const wy = j * SAMPLE_SPACING;
        const base = fractalNoise(wx / scale, wy / scale, this.seed, octaves);
        const ridgeNoise = 1 - Math.abs(fractalNoise(wx / (scale * 0.7) + 17.3, wy / (scale * 0.7) - 9.1, this.seed + 7, 4) * 2 - 1);
        const mixed = base * (1 - ridged) + ridgeNoise * ridged;
        // Gentle bias so the map centre is not always the high point.
        grid[j * cols + i] = mixed;
      }
    }
    // Value noise clusters near the middle of its range, so stretch the field
    // to use the full amplitude no matter the map size or seed.
    let low = Infinity;
    let high = -Infinity;
    for (let n = 0; n < grid.length; n += 1) { if (grid[n] < low) low = grid[n]; if (grid[n] > high) high = grid[n]; }
    const spread = Math.max(1e-6, high - low);
    for (let n = 0; n < grid.length; n += 1) {
      let h = ((grid[n] - low) / spread - 0.5) * 2 * amplitude;
      if (h < seaLevel) h = seaLevel + (h - seaLevel) * 0.5;
      grid[n] = h;
    }
    for (let pass = 0; pass < erosionPasses; pass += 1) this._thermalErode(grid, cols, rows, 4.2 * SAMPLE_SPACING / 32);
    for (const zone of flatZones) {
      const level = Number.isFinite(zone.level) ? zone.level : 0;
      const radius = Math.max(SAMPLE_SPACING, zone.radius || 200);
      const i0 = Math.max(0, Math.floor((zone.x - radius * 1.6) / SAMPLE_SPACING));
      const i1 = Math.min(cols - 1, Math.ceil((zone.x + radius * 1.6) / SAMPLE_SPACING));
      const j0 = Math.max(0, Math.floor((zone.y - radius * 1.6) / SAMPLE_SPACING));
      const j1 = Math.min(rows - 1, Math.ceil((zone.y + radius * 1.6) / SAMPLE_SPACING));
      for (let j = j0; j <= j1; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          const dist = Math.hypot(i * SAMPLE_SPACING - zone.x, j * SAMPLE_SPACING - zone.y);
          const blend = dist <= radius ? 1 : clamp(1 - (dist - radius) / (radius * 0.6), 0, 1);
          if (blend <= 0) continue;
          const k = j * cols + i;
          grid[k] = grid[k] + (level - grid[k]) * smooth(blend);
        }
      }
    }
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const value = grid[j * cols + i];
        if (Math.abs(value) > 0.01) this.setSculptSample(i, j, value);
      }
    }
    this.relief.clear();
    this.version += 1;
    this.bulk += 1;
    return this;
  }

  _thermalErode(grid, cols, rows, talus) {
    const next = Float32Array.from(grid);
    for (let j = 1; j < rows - 1; j += 1) {
      for (let i = 1; i < cols - 1; i += 1) {
        const k = j * cols + i;
        let maxDiff = 0;
        let total = 0;
        const neighbours = [k - 1, k + 1, k - cols, k + cols];
        for (const n of neighbours) {
          const diff = grid[k] - grid[n];
          if (diff > talus) { total += diff - talus; if (diff > maxDiff) maxDiff = diff; }
        }
        if (total <= 0) continue;
        const moved = (maxDiff - talus) * 0.5;
        for (const n of neighbours) {
          const diff = grid[k] - grid[n];
          if (diff > talus) {
            const share = moved * ((diff - talus) / total);
            next[k] -= share;
            next[n] += share;
          }
        }
      }
    }
    grid.set(next);
  }

  // ---- persistence -------------------------------------------------------
  serialize() {
    const chunks = [];
    for (const chunk of this.chunks.values()) {
      let any = false;
      for (let n = 0; n < chunk.data.length; n += 1) if (Math.abs(chunk.data[n]) > 0.005) { any = true; break; }
      if (!any) continue;
      chunks.push({ cx: chunk.cx, cy: chunk.cy, data: Array.from(chunk.data, value => Math.round(value * 100) / 100) });
    }
    return { version: 1, spacing: SAMPLE_SPACING, chunkSamples: CHUNK_SAMPLES, baseHeight: this.baseHeight, seed: this.seed, waterLevel: this.waterLevel, chunks };
  }

  static deserialize(payload, size = {}) {
    const field = new HeightField({ width: size.width, height: size.height, baseHeight: Number(payload?.baseHeight) || 0 });
    if (!payload) return field;
    field.seed = Number(payload.seed) || 0;
    if (payload.waterLevel != null) field.waterLevel = Number(payload.waterLevel);
    if (payload.spacing === SAMPLE_SPACING && payload.chunkSamples === CHUNK_SAMPLES) {
      for (const entry of payload.chunks || []) {
        if (!Array.isArray(entry.data) || entry.data.length !== CHUNK_SAMPLES * CHUNK_SAMPLES) continue;
        const chunk = field.chunkAt(Number(entry.cx) | 0, Number(entry.cy) | 0, true);
        for (let n = 0; n < entry.data.length; n += 1) chunk.data[n] = clamp(Number(entry.data[n]) || 0, MIN_HEIGHT, MAX_HEIGHT);
      }
      return field;
    }
    // Older saves used a coarser lattice: resample them bilinearly.
    const oldSpacing = Number(payload.spacing);
    const oldSamples = Number(payload.chunkSamples);
    if (!(oldSpacing > 0) || !(oldSamples > 0)) return field;
    const grid = new Map();
    let maxI = 0;
    let maxJ = 0;
    for (const entry of payload.chunks || []) {
      if (!Array.isArray(entry.data) || entry.data.length !== oldSamples * oldSamples) continue;
      for (let n = 0; n < entry.data.length; n += 1) {
        const i = (Number(entry.cx) | 0) * oldSamples + (n % oldSamples);
        const j = (Number(entry.cy) | 0) * oldSamples + Math.floor(n / oldSamples);
        grid.set(`${i},${j}`, Number(entry.data[n]) || 0);
        if (i > maxI) maxI = i;
        if (j > maxJ) maxJ = j;
      }
    }
    const at = (i, j) => grid.get(`${i},${j}`) || 0;
    const cols = Math.ceil((maxI + 1) * oldSpacing / SAMPLE_SPACING);
    const rows = Math.ceil((maxJ + 1) * oldSpacing / SAMPLE_SPACING);
    for (let j = 0; j <= rows; j += 1) {
      for (let i = 0; i <= cols; i += 1) {
        const fx = i * SAMPLE_SPACING / oldSpacing;
        const fy = j * SAMPLE_SPACING / oldSpacing;
        const i0 = Math.floor(fx);
        const j0 = Math.floor(fy);
        const tx = fx - i0;
        const ty = fy - j0;
        const top = at(i0, j0) + (at(i0 + 1, j0) - at(i0, j0)) * tx;
        const bottom = at(i0, j0 + 1) + (at(i0 + 1, j0 + 1) - at(i0, j0 + 1)) * tx;
        const value = top + (bottom - top) * ty;
        if (Math.abs(value) > 0.01) field.setSculptSample(i, j, value);
      }
    }
    return field;
  }

  // Bilinear height of the hand-authored/generated layer only (no relief), used
  // when saving so feature-derived hills are not baked in twice.
  sculptHeightAt(x, y) {
    const fx = x / SAMPLE_SPACING;
    const fy = y / SAMPLE_SPACING;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const a = this.getSculptSample(i, j);
    const b = this.getSculptSample(i + 1, j);
    const c = this.getSculptSample(i, j + 1);
    const d = this.getSculptSample(i + 1, j + 1);
    const top = a + (b - a) * tx;
    return top + (c + (d - c) * tx - top) * ty;
  }

  // Copy of the sculpt layer resampled onto a differently sized world.
  resampledSculpt(width, height) {
    const out = new HeightField({ width, height, baseHeight: this.baseHeight });
    const scaleX = this.width / Math.max(1, width);
    const scaleY = this.height / Math.max(1, height);
    if (scaleX === 1 && scaleY === 1) {
      for (const chunk of this.chunks.values()) out.chunkAt(chunk.cx, chunk.cy, true).data.set(chunk.data);
      out.seed = this.seed;
      return out;
    }
    const cols = Math.ceil(width / SAMPLE_SPACING) + 1;
    const rows = Math.ceil(height / SAMPLE_SPACING) + 1;
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const value = this.sculptHeightAt(i * SAMPLE_SPACING * scaleX, j * SAMPLE_SPACING * scaleY);
        if (Math.abs(value) > 0.01) out.setSculptSample(i, j, value);
      }
    }
    out.seed = this.seed;
    return out;
  }

  // Adopt another field's sculpt data in place (keeps the relief provider).
  adopt(other) {
    this.chunks = other.chunks;
    this.baseHeight = other.baseHeight;
    this.seed = other.seed;
    this.waterLevel = other.waterLevel;
    this.relief.clear();
    this.version += 1;
    this.bulk += 1;
  }

  // Min/max of loaded data -- used for minimap legends and tests.
  extent() {
    let min = Infinity;
    let max = -Infinity;
    for (const chunk of this.chunks.values()) {
      for (const value of chunk.data) {
        if (value < min) min = value;
        if (value > max) max = value;
      }
    }
    return min === Infinity ? { min: 0, max: 0 } : { min: min + this.baseHeight, max: max + this.baseHeight };
  }
}
