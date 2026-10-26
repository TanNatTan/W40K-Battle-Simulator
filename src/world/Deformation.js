// Terrain deformation. Shell craters, trenches, quarry pits and levelled
// building sites all edit the same two things: the height field (the shape of
// the ground) and the surface layers (what it is covered with). Because the
// layers hold buried deposits under a cover thickness, digging can expose ore
// and a deep enough crater reveals what lay underneath.

import { MAX_HEIGHT, MIN_HEIGHT, SAMPLE_SPACING } from "../terrain/HeightField.js";
import { DEPOSIT, DEPOSIT_RESOURCE, EARTHWORK, VEGETATION } from "./WorldLayers.js";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const COVER_PER_UNIT = 4; // cover is stored in quarter units
const DIG_SCALE = 30; // `dig` layer: excavated depth in 1/30 units (max ~8.5)

function lowerSample(field, i, j, amount, floor = MIN_HEIGHT) {
  const current = field.sample(i, j);
  const next = Math.max(floor, current - amount);
  const removed = current - next;
  if (removed > 1e-4) field.setSculptSample(i, j, field.getSculptSample(i, j) - removed);
  return removed;
}

function raiseSample(field, i, j, amount, ceiling = MAX_HEIGHT) {
  const current = field.sample(i, j);
  const next = Math.min(ceiling, current + amount);
  const added = next - current;
  if (added > 1e-4) field.setSculptSample(i, j, field.getSculptSample(i, j) + added);
  return added;
}

// Reduce the cover thickness over a deposit as material is removed; reports
// whether it became exposed. Digging out the cover is what "surveying by
// shelling" means: the deposit's amount is untouched, only access changes.
function strip(layers, i, j, removed) {
  if (!layers.get("deposit", i, j)) return false;
  const cover = layers.get("cover", i, j);
  if (cover <= 0) return true;
  const next = Math.max(0, cover - removed * COVER_PER_UNIT);
  layers.set("cover", i, j, next);
  return next <= 0;
}

/**
 * Blast a crater. Returns { removed, exposed, cleared } for effects and AI.
 */
export function crater(field, layers, x, y, radius, depth, { scorchRadius = radius * 1.7 } = {}) {
  let removed = 0;
  let exposed = 0;
  let cleared = 0;
  const reach = radius * 1.45 + SAMPLE_SPACING;
  layers.forEachInCircle(x, y, reach, (i, j, distance) => {
    const t = distance / radius;
    let delta = 0;
    if (t <= 1) delta = depth * (1 - t * t) ** 1.25;
    else if (t < 1.45) delta = -depth * 0.32 * Math.exp(-(((t - 1.12) / 0.2) ** 2));
    if (delta > 0.02) {
      const dug = lowerSample(field, i, j, delta);
      removed += dug;
      if (dug > 0 && strip(layers, i, j, dug) && layers.get("deposit", i, j)) exposed += 1;
      layers.set("earthwork", i, j, EARTHWORK.PIT);
      layers.set("dig", i, j, layers.get("dig", i, j) + dug * DIG_SCALE);
      layers.set("surface", i, j, 0);
    } else if (delta < -0.02) {
      raiseSample(field, i, j, -delta);
      layers.set("earthwork", i, j, EARTHWORK.EMBANKMENT);
    }
    if (t <= 1.15) {
      if (layers.get("vegetation", i, j) > 0) cleared += 1;
      layers.set("vegetation", i, j, 0);
      layers.set("vegKind", i, j, VEGETATION.NONE);
      layers.set("cropStage", i, j, 0);
      layers.set("integrity", i, j, Math.min(layers.get("integrity", i, j), 60));
    }
    if (distance <= scorchRadius) {
      const strength = (1 - distance / scorchRadius) * 220 + 20;
      layers.set("scorch", i, j, Math.max(layers.get("scorch", i, j), strength));
      layers.set("fertility", i, j, layers.get("fertility", i, j) * (1 - 0.35 * (1 - distance / scorchRadius)));
    }
  });
  return { removed, exposed, cleared };
}

/**
 * Dig a little trench along a segment. `depth` is the target depth below the
 * original surface; call repeatedly (workers dig incrementally) with `amount`
 * the depth to remove this call. Returns { removed, cells, complete }.
 */
export function digTrench(field, layers, ax, ay, bx, by, { width = 22, depth = 2.4, amount = depth, parapet = true } = {}) {
  const length = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(length / (SAMPLE_SPACING * 0.5)));
  let removed = 0;
  let cells = 0;
  let complete = true;
  const touched = new Set();
  for (let s = 0; s <= steps; s += 1) {
    const px = ax + (bx - ax) * s / steps;
    const py = ay + (by - ay) * s / steps;
    layers.forEachInCircle(px, py, width * 0.5 + SAMPLE_SPACING * 0.5, (i, j, distance) => {
      const key = i * 100003 + j;
      if (touched.has(key)) return;
      touched.add(key);
      // Profile follows the distance to the trench axis, not to whichever sample point reached the cell first.
      const t = length < 1e-6 ? 0 : clamp(((i * SAMPLE_SPACING - ax) * (bx - ax) + (j * SAMPLE_SPACING - ay) * (by - ay)) / (length * length), 0, 1);
      const across = Math.hypot(i * SAMPLE_SPACING - (ax + (bx - ax) * t), j * SAMPLE_SPACING - (ay + (by - ay) * t));
      const profile = clamp(1 - (across / (width * 0.5 + SAMPLE_SPACING * 0.5)) ** 2, 0, 1);
      const target = depth * Math.max(0.35, profile);
      const dugSoFar = layers.get("earthwork", i, j) === EARTHWORK.TRENCH ? layers.get("dig", i, j) / DIG_SCALE : 0;
      const want = Math.min(amount, Math.max(0, target - dugSoFar));
      if (want > 1e-3) {
        const dug = lowerSample(field, i, j, want);
        removed += dug;
        if (dug > 0) strip(layers, i, j, dug);
        layers.set("dig", i, j, (dugSoFar + dug) * DIG_SCALE);
      }
      layers.set("earthwork", i, j, EARTHWORK.TRENCH);
      layers.set("vegetation", i, j, 0);
      layers.set("vegKind", i, j, VEGETATION.NONE);
      if ((dugSoFar + want) < target - 0.05) complete = false;
      cells += 1;
    });
  }
  if (parapet && removed > 0) {
    // Spoil heaped on the enemy side is what actually gives a trench its cover;
    // here it is spread along both lips as a low bank.
    const nx = -(by - ay) / Math.max(1, length);
    const ny = (bx - ax) / Math.max(1, length);
    for (const side of [-1, 1]) {
      for (let s = 0; s <= steps; s += 1) {
        const px = ax + (bx - ax) * s / steps + nx * side * (width * 0.5 + SAMPLE_SPACING);
        const py = ay + (by - ay) * s / steps + ny * side * (width * 0.5 + SAMPLE_SPACING);
        const i = Math.round(px / SAMPLE_SPACING);
        const j = Math.round(py / SAMPLE_SPACING);
        raiseSample(field, i, j, removed / Math.max(1, steps * 6));
        if (layers.get("earthwork", i, j) === EARTHWORK.NONE) layers.set("earthwork", i, j, EARTHWORK.EMBANKMENT);
      }
    }
  }
  return { removed, cells, complete };
}

/**
 * Quarry / mine pit: lower ground within a radius and report the ore taken.
 * Only exposed deposit cells yield; covered ground just loses soil (the
 * `cover` shrinks, eventually exposing the ore).
 */
export function excavate(field, layers, x, y, radius, amount, { floor = -14 } = {}) {
  const ore = {};
  let removed = 0;
  layers.forEachInCircle(x, y, radius, (i, j, distance) => {
    const falloff = 1 - (distance / (radius + 1)) ** 2;
    const dug = lowerSample(field, i, j, amount * falloff, floor);
    removed += dug;
    const kind = layers.get("deposit", i, j);
    const exposed = strip(layers, i, j, dug);
    layers.set("earthwork", i, j, EARTHWORK.PIT);
    layers.set("vegetation", i, j, 0);
    layers.set("vegKind", i, j, VEGETATION.NONE);
    if (kind && exposed) {
      const left = layers.get("depositAmount", i, j);
      if (left > 0) {
        const take = Math.min(left, Math.round(dug * 60));
        if (take > 0) {
          layers.set("depositAmount", i, j, left - take);
          const resource = DEPOSIT_RESOURCE[kind];
          ore[resource] = (ore[resource] || 0) + take;
          if (left - take <= 0) layers.set("deposit", i, j, DEPOSIT.NONE);
        }
      }
    }
  });
  return { removed, ore };
}

/** Level a build site toward a target height (average if omitted). */
export function levelSite(field, layers, x, y, radius, target = null) {
  const level = target ?? field.heightAt(x, y);
  let moved = 0;
  layers.forEachInCircle(x, y, radius + SAMPLE_SPACING, (i, j, distance) => {
    const blend = distance <= radius ? 1 : clamp(1 - (distance - radius) / SAMPLE_SPACING, 0, 1);
    const current = field.sample(i, j);
    const next = current + (level - current) * 0.8 * blend;
    if (Math.abs(next - current) > 0.01) {
      field.setSculptSample(i, j, field.getSculptSample(i, j) + (next - current));
      moved += Math.abs(next - current);
    }
    if (blend > 0) {
      layers.set("vegetation", i, j, 0);
      layers.set("vegKind", i, j, VEGETATION.NONE);
      layers.set("earthwork", i, j, EARTHWORK.NONE);
    }
  });
  return moved;
}

/** Damage from sustained fire/blast that is too small to crater. */
export function scar(layers, x, y, radius, severity = 0.5) {
  layers.forEachInCircle(x, y, radius, (i, j, distance) => {
    const k = (1 - distance / radius) * severity;
    layers.set("scorch", i, j, Math.max(layers.get("scorch", i, j), k * 255));
    layers.set("integrity", i, j, layers.get("integrity", i, j) * (1 - k * 0.5));
    layers.set("trample", i, j, Math.max(layers.get("trample", i, j), k * 160));
  });
}
