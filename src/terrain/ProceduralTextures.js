// Seamless procedural terrain albedo textures. Everything is generated from
// periodic noise, so tiles wrap perfectly and the terrain never shows the
// grid or the drawn-sprite borders that image-based tiles introduce. Each
// texture is built once and then sampled by the terrain shader in world space.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;

function hash(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Periodic value noise: `period` lattice cells per tile edge.
function pnoise(u, v, period, seed) {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % period) + period) % period;
  const y0 = ((iy % period) + period) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
  const a = hash(x0, y0, seed);
  const b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed);
  const d = hash(x1, y1, seed);
  return mix(mix(a, b, sx), mix(c, d, sx), sy);
}

function fbm(u, v, basePeriod, octaves, seed, gain = 0.5) {
  let total = 0;
  let amplitude = 1;
  let norm = 0;
  let period = basePeriod;
  for (let o = 0; o < octaves; o += 1) {
    total += pnoise(u, v, period, seed + o * 17) * amplitude;
    norm += amplitude;
    amplitude *= gain;
    period *= 2;
  }
  return total / norm;
}

// Periodic Worley noise: returns nearest and second-nearest feature distance
// (in cell units) plus the nearest cell id hash.
function worley(u, v, cells, seed) {
  const x = u * cells;
  const y = v * cells;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  let id = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const cx = ix + dx;
      const cy = iy + dy;
      const wx = ((cx % cells) + cells) % cells;
      const wy = ((cy % cells) + cells) % cells;
      const px = cx + hash(wx, wy, seed) * 0.82 + 0.09;
      const py = cy + hash(wx, wy, seed + 71) * 0.82 + 0.09;
      const d = Math.hypot(px - x, py - y);
      if (d < f1) { f2 = f1; f1 = d; id = hash(wx, wy, seed + 5); } else if (d < f2) f2 = d;
    }
  }
  return { f1, f2, id };
}

const lerpColor = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

const RECIPES = {
  grass(u, v) {
    const macro = fbm(u, v, 3, 4, 11);
    const patch = fbm(u, v, 7, 3, 23);
    const base = lerpColor([70, 104, 38], [118, 146, 58], clamp(macro * 1.4 - 0.1, 0, 1));
    const dry = lerpColor(base, [150, 148, 70], clamp((patch - 0.55) * 2.2, 0, 0.55));
    // Blade streaks: noise stretched along one axis, plus fine speckle.
    const blades = pnoise(u, v * 0.5, 96, 31) * 0.6 + pnoise(u * 0.5, v, 128, 37) * 0.4;
    const tuft = worley(u, v, 38, 41);
    const shade = 0.62 + blades * 0.62 + (tuft.f1 < 0.3 ? 0.07 : -0.04);
    const dark = 1 - clamp((0.32 - tuft.f1) * 0.5, 0, 0.12);
    return [dry[0] * shade * dark, dry[1] * shade * dark, dry[2] * shade * dark];
  },
  drygrass(u, v) {
    const macro = fbm(u, v, 3, 4, 13);
    const base = lerpColor([150, 128, 70], [196, 170, 100], macro);
    const blades = pnoise(u, v * 0.5, 96, 33) * 0.6 + pnoise(u * 0.5, v, 120, 39) * 0.4;
    const shade = 0.78 + blades * 0.4;
    return [base[0] * shade, base[1] * shade, base[2] * shade];
  },
  dirt(u, v) {
    const macro = fbm(u, v, 4, 4, 17);
    const base = lerpColor([102, 74, 48], [152, 114, 76], macro);
    const grain = pnoise(u, v, 128, 5) * 0.5 + pnoise(u, v, 64, 9) * 0.5;
    const pebble = worley(u, v, 30, 53);
    const dome = pebble.f1 < 0.2 ? 0.22 - pebble.f1 : 0;
    const shade = 0.82 + grain * 0.3 + dome * 1.2;
    return [base[0] * shade, base[1] * shade, base[2] * shade];
  },
  drydirt(u, v) {
    const macro = fbm(u, v, 4, 4, 19);
    const base = lerpColor([160, 128, 92], [204, 170, 126], macro);
    const grain = pnoise(u, v, 128, 6) * 0.6 + pnoise(u, v, 48, 10) * 0.4;
    const shade = 0.84 + grain * 0.28;
    return [base[0] * shade, base[1] * shade, base[2] * shade];
  },
  sand(u, v) {
    const macro = fbm(u, v, 3, 3, 29);
    const base = lerpColor([204, 178, 120], [232, 210, 154], macro);
    const warp = fbm(u, v, 6, 3, 61) * 1.6;
    const ripple = 0.5 + 0.5 * Math.sin((u * 18 + warp * 3.3) * Math.PI * 2);
    const grain = pnoise(u, v, 160, 7);
    const shade = 0.9 + ripple * 0.08 + grain * 0.12;
    return [base[0] * shade, base[1] * shade, base[2] * shade];
  },
  rockysoil(u, v) {
    // Weathered rock face: ridged fracture lines at three scales, sheared
    // strata, mineral staining and fine grain. No regular cells.
    const warp = fbm(u, v, 4, 3, 73) * 0.35;
    const ridge = (period, seed) => 1 - Math.abs(fbm(u + warp, v + warp * 0.6, period, 3, seed) * 2 - 1);
    const fractures = Math.max(ridge(5, 79) ** 6, ridge(11, 83) ** 8 * 0.8, ridge(24, 87) ** 10 * 0.6);
    const strata = 0.5 + 0.5 * Math.sin((v * 17 + u * 2.5 + fbm(u, v, 5, 3, 91) * 5) * Math.PI * 2);
    const stain = fbm(u, v, 3, 4, 95);
    const tone = lerpColor([112, 102, 90], [186, 170, 148], clamp(stain * 1.3 - 0.1, 0, 1));
    const rusty = clamp((fbm(u, v, 6, 3, 99) - 0.58) * 3, 0, 1);
    const grain = pnoise(u, v, 192, 101) * 0.5 + pnoise(u, v, 96, 103) * 0.5;
    const shade = (1 - fractures * 0.5) * (0.82 + strata * 0.1) * (0.8 + grain * 0.38);
    return [tone[0] * shade + rusty * 22, tone[1] * shade + rusty * 6, tone[2] * shade - rusty * 8];
  },
  gravel(u, v) {
    const stones = worley(u, v, 44, 97);
    const dome = clamp(1 - stones.f1 * 2.1, 0, 1);
    const tone = lerpColor([112, 106, 98], [178, 166, 148], stones.id);
    const gap = clamp((stones.f2 - stones.f1) * 6, 0, 1);
    const shade = (0.5 + dome * 0.55) * (0.55 + gap * 0.45) + pnoise(u, v, 128, 3) * 0.1;
    return [tone[0] * shade, tone[1] * shade, tone[2] * shade];
  },
  darksoil(u, v) {
    const macro = fbm(u, v, 5, 4, 101);
    const base = lerpColor([44, 48, 30], [78, 74, 46], macro);
    const litter = worley(u, v, 52, 107);
    const leaf = litter.f1 < 0.18 ? 0.35 * (litter.id - 0.4) : 0;
    const grain = pnoise(u, v, 128, 12);
    const shade = 0.8 + grain * 0.3 + leaf;
    return [base[0] * shade + leaf * 40, base[1] * shade + leaf * 20, base[2] * shade];
  },
  mud(u, v) {
    const macro = fbm(u, v, 4, 4, 113);
    const base = lerpColor([58, 42, 28], [102, 76, 50], macro);
    const wet = fbm(u, v, 9, 3, 127);
    const gloss = clamp((wet - 0.58) * 3, 0, 1);
    const shade = 0.84 + pnoise(u, v, 96, 14) * 0.2;
    return [base[0] * shade + gloss * 26, base[1] * shade + gloss * 24, base[2] * shade + gloss * 22];
  },
  ash(u, v) {
    const macro = fbm(u, v, 4, 4, 131);
    const base = lerpColor([46, 45, 44], [94, 92, 90], macro);
    const fleck = pnoise(u, v, 160, 16);
    const ember = pnoise(u, v, 36, 18) > 0.93 ? 1 : 0;
    const shade = 0.78 + fleck * 0.4;
    return [base[0] * shade + ember * 70, base[1] * shade + ember * 30, base[2] * shade];
  }
};

export const PROCEDURAL_TEXTURE_NAMES = Object.freeze(Object.keys(RECIPES));

export function buildProceduralTexture(name, size = 256) {
  const recipe = RECIPES[name];
  if (!recipe) return null;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const color = recipe((x + 0.5) / size, (y + 0.5) / size);
      const o = (y * size + x) * 4;
      data[o] = color[0];
      data[o + 1] = color[1];
      data[o + 2] = color[2];
      data[o + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}

export function buildProceduralTextures(size = 256, names = PROCEDURAL_TEXTURE_NAMES) {
  const result = {};
  for (const name of names) result[name] = buildProceduralTexture(name, size);
  return result;
}
