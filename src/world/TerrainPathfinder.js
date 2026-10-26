// Terrain-aware A* on a coarse cost grid. Cost comes from the same height
// field and surface layers the rest of the world uses, so a path avoids
// cliffs and deep water, prefers roads, and detours around thick forest and
// bogs. Cell costs are cached and cleared when the ground changes.

import { groundEffects } from "./GroundEffects.js";

class MinHeap {
  constructor() { this.keys = []; this.items = []; }
  get size() { return this.items.length; }
  push(item, key) {
    const keys = this.keys; const items = this.items;
    let n = items.length;
    items.push(item); keys.push(key);
    while (n > 0) {
      const parent = (n - 1) >> 1;
      if (keys[parent] <= key) break;
      keys[n] = keys[parent]; items[n] = items[parent]; n = parent;
    }
    keys[n] = key; items[n] = item;
  }
  pop() {
    const keys = this.keys; const items = this.items;
    const top = items[0];
    const lastItem = items.pop(); const lastKey = keys.pop();
    const length = items.length;
    if (length > 0) {
      let n = 0;
      for (;;) {
        let child = n * 2 + 1;
        if (child >= length) break;
        if (child + 1 < length && keys[child + 1] < keys[child]) child += 1;
        if (keys[child] >= lastKey) break;
        keys[n] = keys[child]; items[n] = items[child]; n = child;
      }
      keys[n] = lastKey; items[n] = lastItem;
    }
    return top;
  }
}

export class TerrainPathfinder {
  constructor({ field, layers, width, height, cell = 16, weather = null } = {}) {
    this.field = field;
    this.layers = layers;
    this.cell = cell;
    this.cols = Math.ceil((width || field.width) / cell);
    this.rows = Math.ceil((height || field.height) / cell);
    this.weather = weather;
    this.costs = { civilian: new Float32Array(this.cols * this.rows), infantry: new Float32Array(this.cols * this.rows) };
    this.stats = { searches: 0, expanded: 0, cached: 0 };
    this.cache = new Map();
  }

  invalidate() {
    for (const grid of Object.values(this.costs)) grid.fill(0);
    this.cache.clear();
  }

  invalidateAround(x, y, radius) {
    const i0 = Math.max(0, Math.floor((x - radius) / this.cell));
    const i1 = Math.min(this.cols - 1, Math.floor((x + radius) / this.cell));
    const j0 = Math.max(0, Math.floor((y - radius) / this.cell));
    const j1 = Math.min(this.rows - 1, Math.floor((y + radius) / this.cell));
    for (const grid of Object.values(this.costs)) for (let j = j0; j <= j1; j += 1) for (let i = i0; i <= i1; i += 1) grid[j * this.cols + i] = 0;
    this.cache.clear();
  }

  /** Movement cost for entering a cell: 1 = flat open ground, Infinity = blocked. */
  cellCost(i, j, kind = "civilian") {
    const grid = this.costs[kind] || this.costs.civilian;
    const index = j * this.cols + i;
    const stored = grid[index];
    if (stored) return stored >= 1e5 ? Infinity : stored;
    const cx = (i + 0.5) * this.cell;
    const cy = (j + 0.5) * this.cell;
    // Rivers are narrower than a cell, so judge the cell by its worst sample, not just its centre.
    const reach = this.cell * 0.32;
    let cost = 0;
    for (let n = 0; n < 5; n += 1) {
      const x = cx + (n === 0 ? 0 : (n & 1 ? reach : -reach));
      const y = cy + (n === 0 ? 0 : (n & 2 ? reach : -reach));
      const slope = this.field.slopeAt(x, y);
      if (slope > 1.25) { cost = Infinity; break; }
      const info = this.layers.surfaceInfo(x, y);
      const effect = groundEffects(info, this.field.heightAt(x, y), kind, this.weather ? this.weather() : {});
      if (effect.impassable) { cost = Infinity; break; }
      cost = Math.max(cost, 1 / Math.max(0.12, effect.speed) + slope * 2.6 + effect.hazard * 6);
    }
    grid[index] = cost === Infinity ? 1e5 : cost;
    return cost;
  }

  blockedAt(x, y, kind = "civilian") {
    const i = Math.floor(x / this.cell);
    const j = Math.floor(y / this.cell);
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return true;
    return this.cellCost(i, j, kind) === Infinity;
  }

  /** Nearest walkable point to (x, y) within `radius`. */
  nearestOpen(x, y, kind = "civilian", radius = 160) {
    if (!this.blockedAt(x, y, kind)) return { x, y };
    for (let r = this.cell; r <= radius; r += this.cell) {
      for (let a = 0; a < 12; a += 1) {
        const angle = a / 12 * Math.PI * 2;
        const px = x + Math.cos(angle) * r;
        const py = y + Math.sin(angle) * r;
        if (!this.blockedAt(px, py, kind)) return { x: px, y: py };
      }
    }
    return null;
  }

  find(ax, ay, bx, by, { kind = "civilian", maxNodes = 5000, cacheKey = null } = {}) {
    if (cacheKey && this.cache.has(cacheKey)) { this.stats.cached += 1; return this.cache.get(cacheKey).map(point => ({ ...point })); }
    this.stats.searches += 1;
    const cell = this.cell;
    const start = this.nearestOpen(ax, ay, kind, 120);
    const goal = this.nearestOpen(bx, by, kind, 200);
    if (!start || !goal) return null;
    const si = clampIndex(Math.floor(start.x / cell), this.cols);
    const sj = clampIndex(Math.floor(start.y / cell), this.rows);
    const gi = clampIndex(Math.floor(goal.x / cell), this.cols);
    const gj = clampIndex(Math.floor(goal.y / cell), this.rows);
    const total = this.cols * this.rows;
    const g = new Float32Array(total).fill(Infinity);
    const parent = new Int32Array(total).fill(-1);
    const closed = new Uint8Array(total);
    const open = new MinHeap();
    const startIndex = sj * this.cols + si;
    const goalIndex = gj * this.cols + gi;
    g[startIndex] = 0;
    open.push(startIndex, 0);
    let expanded = 0;
    let bestIndex = startIndex;
    let bestH = Infinity;
    while (open.size) {
      const current = open.pop();
      if (closed[current]) continue;
      closed[current] = 1;
      expanded += 1;
      if (current === goalIndex) { bestIndex = current; break; }
      const ci = current % this.cols;
      const cj = (current / this.cols) | 0;
      const h = Math.hypot(ci - gi, cj - gj);
      if (h < bestH) { bestH = h; bestIndex = current; }
      if (expanded > maxNodes) break;
      for (let dj = -1; dj <= 1; dj += 1) {
        for (let di = -1; di <= 1; di += 1) {
          if (!di && !dj) continue;
          const ni = ci + di; const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= this.cols || nj >= this.rows) continue;
          const next = nj * this.cols + ni;
          if (closed[next]) continue;
          const stepCost = this.cellCost(ni, nj, kind);
          if (stepCost === Infinity) continue;
          // Don't cut diagonally between blocked corners.
          if (di && dj && (this.cellCost(ci + di, cj, kind) === Infinity || this.cellCost(ci, cj + dj, kind) === Infinity)) continue;
          const candidate = g[current] + stepCost * (di && dj ? 1.4142 : 1);
          if (candidate < g[next]) {
            g[next] = candidate;
            parent[next] = current;
            open.push(next, candidate + Math.hypot(ni - gi, nj - gj));
          }
        }
      }
    }
    this.stats.expanded += expanded;
    const cells = [];
    for (let at = bestIndex; at !== -1; at = parent[at]) cells.push(at);
    cells.reverse();
    const points = cells.map(index => ({ x: ((index % this.cols) + 0.5) * cell, y: (Math.floor(index / this.cols) + 0.5) * cell }));
    points[0] = { x: start.x, y: start.y };
    if (bestIndex === goalIndex) points[points.length - 1] = { x: goal.x, y: goal.y };
    const smoothed = this.smooth(points, kind);
    if (cacheKey) { this.cache.set(cacheKey, smoothed.map(point => ({ ...point }))); if (this.cache.size > 400) this.cache.delete(this.cache.keys().next().value); }
    return smoothed;
  }

  /** Drop waypoints that a straight walk can skip. */
  smooth(points, kind) {
    if (points.length <= 2) return points;
    const result = [points[0]];
    let anchor = 0;
    for (let n = 2; n < points.length; n += 1) {
      if (!this.clearLine(points[anchor], points[n], kind)) { result.push(points[n - 1]); anchor = n - 1; }
    }
    result.push(points[points.length - 1]);
    return result;
  }

  clearLine(a, b, kind) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.ceil(length / (this.cell * 0.5));
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps;
      if (this.blockedAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, kind)) return false;
    }
    return true;
  }
}

function clampIndex(value, size) { return Math.min(size - 1, Math.max(0, value)); }
