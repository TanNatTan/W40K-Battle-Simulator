// Generates one living region: hills and mountain ranges with cliffs, carved
// rivers that flow downhill, soil fertility and moisture, woodland, buried
// mineral and promethium deposits, and ranked settlement sites. Everything is
// deterministic from the seed, so a region can be regenerated or compared.

import { MAX_HEIGHT, MIN_HEIGHT, SAMPLE_SPACING, fractalNoise, seededRandom, valueNoise } from "../terrain/HeightField.js";
import { DEPOSIT, SURFACE, VEGETATION } from "./WorldLayers.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hashSeed = text => Array.from(String(text)).reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7) >>> 0;

export const REGION_BIOMES = Object.freeze({
  temperate: { palette: "temperate", fertility: 1, forest: 0.55, mountains: 0.5, rain: 0.5 },
  forest: { palette: "forest", fertility: 1.1, forest: 0.9, mountains: 0.35, rain: 0.7 },
  desert: { palette: "desert", fertility: 0.45, forest: 0.08, mountains: 0.55, rain: 0.1 },
  frozen: { palette: "frozen", fertility: 0.5, forest: 0.25, mountains: 0.7, rain: 0.3 },
  volcanic: { palette: "volcanic", fertility: 0.35, forest: 0.05, mountains: 0.85, rain: 0.2 }
});

export function generateRegion({ field, layers, seed = "REGION-1", width = field.width, height = field.height, biome = "temperate", mountains = null, riverCount = 2, lakeCount = 1, forestDensity = null, deposits = { iron: 3, promethium: 1, stone: 2 }, flatZones = [] } = {}) {
  const profile = REGION_BIOMES[biome] || REGION_BIOMES.temperate;
  const numericSeed = hashSeed(seed);
  const random = seededRandom(numericSeed);
  const mountainAmount = mountains ?? profile.mountains;
  const waterLevel = -2;
  field.clear();
  layers.clear();
  field.waterLevel = waterLevel;
  field.seed = numericSeed;
  field.resize(width, height);
  layers.width = width;
  layers.height = height;

  const cols = Math.ceil(width / SAMPLE_SPACING) + 1;
  const rows = Math.ceil(height / SAMPLE_SPACING) + 1;
  const grid = new Float32Array(cols * rows);
  const mask = new Float32Array(cols * rows);
  const unit = Math.min(width, height);

  // --- relief ---------------------------------------------------------------
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = i * SAMPLE_SPACING;
      const y = j * SAMPLE_SPACING;
      const broad = fractalNoise(x / (unit * 0.55), y / (unit * 0.55), numericSeed, 4);
      const hills = fractalNoise(x / 260, y / 260, numericSeed + 3, 3);
      const rangeNoise = fractalNoise(x / (unit * 0.75) + 9.2, y / (unit * 0.75) - 4.7, numericSeed + 5, 3);
      const rangeMask = smoothstep(0.55 - mountainAmount * 0.25, 0.74 - mountainAmount * 0.2, rangeNoise);
      const ridged = 1 - Math.abs(fractalNoise(x / (unit * 0.28), y / (unit * 0.28), numericSeed + 8, 4) * 2 - 1);
      const crags = fractalNoise(x / 150, y / 150, numericSeed + 12, 5);
      const lowland = 4 + (broad - 0.5) * 16 + (hills - 0.5) * 12;
      const knoll = (fractalNoise(x / 105, y / 105, numericSeed + 14, 3) - 0.5) * 4;
      let h = lowland + knoll + rangeMask * (ridged ** 2 * 92 + (crags - 0.5) * 46 + 12);
      // Rock ledges: partially quantise the highlands into cliff bands.
      const step = 13;
      const band = h / step;
      const terraced = (Math.floor(band) + smoothstep(0.34, 0.66, band - Math.floor(band))) * step;
      h += (terraced - h) * 0.22 * smoothstep(0.08, 0.45, rangeMask);
      grid[j * cols + i] = h;
      mask[j * cols + i] = rangeMask;
    }
  }
  for (const zone of flatZones) {
    const level = Number.isFinite(zone.level) ? zone.level : 4;
    const radius = Math.max(SAMPLE_SPACING * 2, zone.radius || 200);
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const distance = Math.hypot(i * SAMPLE_SPACING - zone.x, j * SAMPLE_SPACING - zone.y);
        if (distance > radius * 1.7) continue;
        const blend = distance <= radius ? 1 : clamp(1 - (distance - radius) / (radius * 0.7), 0, 1);
        const k = j * cols + i;
        grid[k] += (level - grid[k]) * smoothstep(0, 1, blend);
      }
    }
  }
  field._thermalErode(grid, cols, rows, 8.5);
  field._thermalErode(grid, cols, rows, 8.5);

  // --- lakes ------------------------------------------------------------------
  const lakes = [];
  for (let n = 0; n < lakeCount; n += 1) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const x = width * (0.15 + random() * 0.7);
      const y = height * (0.15 + random() * 0.7);
      const at = grid[Math.round(y / SAMPLE_SPACING) * cols + Math.round(x / SAMPLE_SPACING)];
      if (at > 14 || flatZones.some(zone => Math.hypot(zone.x - x, zone.y - y) < (zone.radius || 200) * 2.2)) continue;
      const radius = unit * (0.05 + random() * 0.05);
      lakes.push({ x, y, radius });
      for (let j = 0; j < rows; j += 1) {
        for (let i = 0; i < cols; i += 1) {
          const wobble = 0.8 + valueNoise((i * SAMPLE_SPACING) / 110 + 4, (j * SAMPLE_SPACING) / 110, numericSeed + 55) * 0.45;
          const distance = Math.hypot(i * SAMPLE_SPACING - x, j * SAMPLE_SPACING - y) / (radius * wobble);
          if (distance >= 1.6) continue;
          const bowl = (1 - smoothstep(0.35, 1.6, distance));
          const k = j * cols + i;
          grid[k] += (waterLevel - 3.5 - grid[k]) * bowl;
        }
      }
      break;
    }
  }

  // --- rivers ---------------------------------------------------------------
  const rivers = [];
  const carve = (path, surfaces, halfWidths) => {
    const reach = Math.max(...halfWidths) + 70;
    for (let k = 0; k < path.length; k += 1) {
      const p = path[k];
      const half = halfWidths[k];
      const bed = surfaces[k] - (2.4 + half * 0.07);
      const i0 = Math.max(0, Math.floor((p.x - reach) / SAMPLE_SPACING));
      const i1 = Math.min(cols - 1, Math.ceil((p.x + reach) / SAMPLE_SPACING));
      const j0 = Math.max(0, Math.floor((p.y - reach) / SAMPLE_SPACING));
      const j1 = Math.min(rows - 1, Math.ceil((p.y + reach) / SAMPLE_SPACING));
      for (let j = j0; j <= j1; j += 1) {
        for (let i = i0; i <= i1; i += 1) {
          const d = Math.hypot(i * SAMPLE_SPACING - p.x, j * SAMPLE_SPACING - p.y);
          const idx = j * cols + i;
          if (d <= half) {
            const t = d / half;
            grid[idx] = Math.min(grid[idx], bed + t * t * (surfaces[k] - bed + 0.15));
          } else if (d <= half + 64) {
            const t = (d - half) / 64;
            const bank = surfaces[k] + 0.7 + t * t * 6;
            if (grid[idx] > bank) grid[idx] += (bank - grid[idx]) * (1 - t) * 0.85;
          }
        }
      }
    }
  };
  const smoothGround = (x, y) => {
    const i = clamp(Math.round(x / SAMPLE_SPACING), 1, cols - 2);
    const j = clamp(Math.round(y / SAMPLE_SPACING), 1, rows - 2);
    let sum = 0;
    for (let dj = -2; dj <= 2; dj += 1) for (let di = -2; di <= 2; di += 1) sum += grid[clamp(j + dj, 0, rows - 1) * cols + clamp(i + di, 0, cols - 1)];
    return sum / 25;
  };
  for (let n = 0; n < riverCount; n += 1) {
    for (let tries = 0; tries < 8; tries += 1) {
      let best = null;
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const x = width * (0.1 + random() * 0.8);
        const y = height * (0.1 + random() * 0.8);
        if (flatZones.some(zone => Math.hypot(zone.x - x, zone.y - y) < (zone.radius || 200) * 2.2)) continue;
        const ground = smoothGround(x, y);
        const mask01 = mask[Math.round(y / SAMPLE_SPACING) * cols + Math.round(x / SAMPLE_SPACING)];
        const score = ground + mask01 * 20 + random() * 8;
        if (ground > 10 && ground < 34 && (!best || score > best.score)) best = { x, y, score };
      }
      if (!best) best = { x: width * (0.2 + random() * 0.6), y: height * 0.05, score: 0 };
      const raw = [{ x: best.x, y: best.y }];
      let heading = random() * Math.PI * 2;
      const visited = new Set();
      for (let stepIndex = 0; stepIndex < 520; stepIndex += 1) {
        const current = raw[raw.length - 1];
        if (current.x < 20 || current.y < 20 || current.x > width - 20 || current.y > height - 20) break;
        const here = smoothGround(current.x, current.y);
        if (here < waterLevel + 0.8 && stepIndex > 6) break;
        let pick = null;
        for (let option = 0; option < 12; option += 1) {
          const angle = heading + (option - 5.5) * (Math.PI / 9);
          const nx = current.x + Math.cos(angle) * 40;
          const ny = current.y + Math.sin(angle) * 40;
          const key = `${Math.round(nx / 28)},${Math.round(ny / 28)}`;
          if (visited.has(key)) continue;
          // Rivers keep clear of deployment zones so a base is never flooded.
          if (flatZones.some(zone => Math.hypot(zone.x - nx, zone.y - ny) < (zone.radius || 200) * 1.9)) continue;
          const meander = (valueNoise(nx / 160, ny / 160, numericSeed + 70 + n) - 0.5) * 3.5;
          const outward = Math.hypot(nx - width / 2, ny - height / 2) * 0.006;
            const cost = smoothGround(nx, ny) + meander + Math.abs(angle - heading) * 0.8 - outward;
          if (!pick || cost < pick.cost) pick = { cost, angle, nx, ny, key };
        }
        if (!pick) break;
        visited.add(pick.key);
        heading = heading * 0.55 + pick.angle * 0.45;
        raw.push({ x: pick.nx, y: pick.ny });
      }
      if (raw.length < 12) continue;
      // Smooth the polyline, then give it a monotone-descending surface.
      const path = raw.map((p, k) => {
        let sx = 0, sy = 0, count = 0;
        for (let d = -2; d <= 2; d += 1) { const q = raw[clamp(k + d, 0, raw.length - 1)]; sx += q.x; sy += q.y; count += 1; }
        return { x: sx / count, y: sy / count };
      });
      const surfaces = [];
      let level = Infinity;
      for (const p of path) {
        level = Math.min(level - 0.02, smoothGround(p.x, p.y) - 0.6);
        surfaces.push(Math.max(level, waterLevel - 0.5));
      }
      const halfWidths = path.map((_, k) => 9 + Math.min(1, k / 18) * 14 + (k / path.length) * 14 + valueNoise(k / 6, n * 3.1, numericSeed + 90) * 7);
      carve(path, surfaces, halfWidths);
      rivers.push({ path, surfaces, halfWidths });
      if (rivers.length > n) break;
    }
  }
  // --- commit the height field -----------------------------------------------
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const value = clamp(grid[j * cols + i], MIN_HEIGHT, MAX_HEIGHT);
      if (Math.abs(value) > 0.01) field.setSculptSample(i, j, value);
    }
  }
  field.version += 1;
  field.bulk += 1;

  // Standing river water: wet wherever the carved ground sits under the surface.
  for (const river of rivers) {
    river.path.forEach((p, k) => {
      // Dilate past the banks: the shader tests surface against the carved
      // ground per pixel, so the shoreline follows the terrain, not the lattice.
      const reach = river.halfWidths[k] + 26;
      layers.forEachInCircle(p.x, p.y, reach, (i, j) => {
        const existing = layers.get("waterSurface", i, j);
        if (existing < -1e8 || river.surfaces[k] > existing) layers.set("waterSurface", i, j, river.surfaces[k]);
      });
    });
  }

  // --- ecology ----------------------------------------------------------------
  const wetness = new Float32Array(cols * rows);
  const waterCells = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const ground = field.sample(i, j);
      if (ground < waterLevel || layers.get("waterSurface", i, j) > -1e8) waterCells.push({ i, j });
    }
  }
  // Distance-to-water by a coarse breadth-first spread.
  wetness.fill(1e9);
  const queue = [];
  for (const cell of waterCells) { wetness[cell.j * cols + cell.i] = 0; queue.push(cell); }
  for (let head = 0; head < queue.length; head += 1) {
    const { i, j } = queue[head];
    const base = wetness[j * cols + i];
    if (base >= 14) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di; const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
      if (wetness[nj * cols + ni] > base + 1) { wetness[nj * cols + ni] = base + 1; queue.push({ i: ni, j: nj }); }
    }
  }
  const forestMask = forestDensity ?? profile.forest;
  const sites = [];
  for (let j = 0; j < rows; j += 1) {
    for (let i = 0; i < cols; i += 1) {
      const x = i * SAMPLE_SPACING;
      const y = j * SAMPLE_SPACING;
      const h = field.sample(i, j);
      const slope = field.slopeAt(x, y);
      const water = wetness[j * cols + i];
      const underwater = h < waterLevel || layers.get("waterSurface", i, j) > -1e8;
      const nearWater = clamp(1 - water / 10, 0, 1);
      const soilNoise = fractalNoise(x / 240 + 3, y / 240 - 8, numericSeed + 21, 3);
      const moisture = clamp(nearWater * 0.7 + soilNoise * 0.4 * (0.4 + profile.rain) - Math.max(0, h) * 0.004, 0, 1);
      let fertility = clamp((0.25 + soilNoise * 0.5 + nearWater * 0.35 - slope * 0.9 - Math.max(0, h - 30) * 0.012) * profile.fertility, 0, 1);
      if (underwater) fertility = 0.1;
      const forestNoise = fractalNoise(x / 190 - 5, y / 190 + 2, numericSeed + 33, 4);
      const forestScore = forestNoise * 0.75 + moisture * 0.35 + fertility * 0.25 - slope * 0.6;
      let vegKind = VEGETATION.GRASS;
      let vegetation = clamp(fertility * 0.8 + 0.1, 0, 1);
      if (underwater || h > 52 || slope > 0.5) { vegKind = VEGETATION.NONE; vegetation = 0; }
      else if (forestScore > 0.78 - forestMask * 0.42) { vegKind = VEGETATION.FOREST; vegetation = clamp(0.55 + fertility * 0.45, 0, 1); }
      else if (forestScore > 0.66 - forestMask * 0.3) { vegKind = VEGETATION.SHRUB; vegetation = clamp(0.4 + fertility * 0.4, 0, 1); }
      layers.set("fertility", i, j, fertility * 255);
      layers.set("moisture", i, j, moisture * 255);
      layers.set("vegetation", i, j, vegetation * 255);
      layers.set("vegKind", i, j, vegKind);
      layers.set("surface", i, j, slope > 0.45 ? SURFACE.STONE : (water < 1.5 ? SURFACE.SAND : SURFACE.SOIL));
      layers.set("integrity", i, j, 255);
      // Settlement candidates: flat, fertile, near (but not in) water.
      if (!underwater && slope < 0.1 && fertility > 0.45 && water > 1.5 && water < 9 && h > 0 && h < 18 && i % 3 === 0 && j % 3 === 0 && x > 120 && y > 120 && x < width - 120 && y < height - 120) {
        sites.push({ x, y, score: fertility * 1.4 + nearWater * 0.7 - slope * 3 + soilNoise * 0.2 });
      } else if (!underwater && slope < 0.13 && fertility > 0.3 && water > 1.5 && h > 0 && h < 30 && i % 4 === 0 && j % 4 === 0 && x > 140 && y > 140 && x < width - 140 && y < height - 140) {
        // Second tier: drier or higher ground, so a region can hold many settlements when asked to.
        sites.push({ x, y, score: fertility * 1.4 + nearWater * 0.7 - slope * 3 + soilNoise * 0.2 - 1.5, relaxed: true });
      }
    }
  }

  // --- buried deposits -----------------------------------------------------------
  const placed = [];
  const place = (kind, count, picker, radiusCells, amount) => {
    for (let n = 0; n < count; n += 1) {
      let best = null;
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const x = width * (0.06 + random() * 0.88);
        const y = height * (0.06 + random() * 0.88);
        const h = field.heightAt(x, y);
        const slope = field.slopeAt(x, y);
        if (h < waterLevel + 1 || layers.getAt("waterSurface", x, y) > -1e8) continue;
        const score = picker(h, slope, mask[Math.round(y / SAMPLE_SPACING) * cols + Math.round(x / SAMPLE_SPACING)]) + random() * 0.4;
        if (score > 0 && placed.every(other => Math.hypot(other.x - x, other.y - y) > 140) && (!best || score > best.score)) best = { x, y, score };
      }
      if (!best) continue;
      placed.push({ x: best.x, y: best.y, kind });
      const cluster = [];
      layers.forEachInCircle(best.x, best.y, radiusCells * SAMPLE_SPACING, (i, j, distance) => {
        const falloff = 1 - distance / (radiusCells * SAMPLE_SPACING);
        if (random() < 0.35 + falloff * 0.75) {
          layers.set("deposit", i, j, kind);
          layers.set("depositAmount", i, j, Math.round(amount * (0.5 + falloff * 0.9)));
          layers.set("cover", i, j, Math.round((3 + random() * 10) * 4)); // quarter-unit cover thickness
          cluster.push({ i, j });
        }
      });
    }
  };
  place(DEPOSIT.IRON, deposits.iron ?? 0, (h, slope, m) => (h > 8 && h < 55 ? 0.4 + m + slope : -1), 4, 900);
  place(DEPOSIT.PROMETHIUM, deposits.promethium ?? 0, (h, slope) => (h < 14 && slope < 0.2 ? 1 - Math.abs(h - 4) * 0.05 : -1), 3, 1400);
  place(DEPOSIT.STONE, deposits.stone ?? 0, (h, slope, m) => (h > 18 ? 0.3 + m * 1.2 + slope : -1), 4, 1100);

  // Prefer sites with plenty of open, dry, gentle land around them to farm.
  for (const site of sites) {
    let open = 0;
    let total = 0;
    layers.forEachInCircle(site.x, site.y, 140, (i, j) => {
      if ((i + j) % 2) return;
      total += 1;
      if (layers.get("waterSurface", i, j) > -1e8 || layers.get("vegKind", i, j) === VEGETATION.FOREST) return;
      if (field.slopeAt(i * SAMPLE_SPACING, j * SAMPLE_SPACING) > 0.14) return;
      open += 1;
    });
    site.arable = total ? open / total : 0;
    site.score += site.arable * 2.6 - (site.arable < 0.25 ? 1.5 : 0);
  }
  sites.sort((a, b) => b.score - a.score);
  return { seed: String(seed), biome, palette: profile.palette, waterLevel, rivers, lakes, sites, deposits: placed, cols, rows };
}

// Greedy pick of well-separated settlement sites.
export function pickSettlementSites(sites, count, minSeparation = 420, avoid = []) {
  const chosen = [];
  for (const site of sites) {
    if (chosen.length >= count) break;
    if (chosen.some(other => Math.hypot(other.x - site.x, other.y - site.y) < minSeparation)) continue;
    if (avoid.some(zone => Math.hypot(zone.x - site.x, zone.y - site.y) < (zone.radius || 200) + 160)) continue;
    chosen.push(site);
  }
  return chosen;
}
