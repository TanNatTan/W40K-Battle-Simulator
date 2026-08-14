const NEIGHBORS = Object.freeze([
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
]);

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(priority, value) {
    this.items.push({ priority, value });
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].priority <= priority) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = { priority, value };
  }

  pop() {
    if (!this.items.length) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child = right < this.items.length && this.items[right].priority < this.items[left].priority ? right : left;
        if (this.items[child].priority >= last.priority) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

function cellKey(cell) {
  return `${cell.x},${cell.y}`;
}

function octile(left, right) {
  const dx = Math.abs(left.x - right.x);
  const dy = Math.abs(left.y - right.y);
  return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

export class NavigationPlanner {
  constructor({ cellSize = 32, maxVisited = 6000, maxCacheEntries = 192, maxWorkMs = Infinity } = {}) {
    this.cellSize = cellSize;
    this.maxVisited = maxVisited;
    this.maxCacheEntries = maxCacheEntries;
    this.maxWorkMs = Number.isFinite(maxWorkMs) ? Math.max(0.25, maxWorkMs) : Infinity;
    this.cache = new Map();
  }

  clear() {
    this.cache.clear();
  }

  worldToCell(point) {
    return { x: Math.floor(point.x / this.cellSize), y: Math.floor(point.y / this.cellSize) };
  }

  cellCenter(cell) {
    return {
      x: cell.x * this.cellSize + this.cellSize / 2,
      y: cell.y * this.cellSize + this.cellSize / 2
    };
  }

  cachedPath({ start, goal, profile = "infantry", revision = 0, bypassCache = false }) {
    if (bypassCache) return null;
    const startCell = this.worldToCell(start);
    const goalCell = this.worldToCell(goal);
    const cached = this.cache.get(`${cellKey(startCell)}|${cellKey(goalCell)}|${profile}|${revision}`);
    return cached ? cached.map(point => ({ ...point })) : null;
  }

  findPath({ start, goal, profile = "infantry", revision = 0, isPassable, costAt = () => 1, bypassCache = false }) {
    const workStartedAt = performance.now();
    const startCell = this.worldToCell(start);
    let goalCell = this.worldToCell(goal);
    const cacheKey = `${cellKey(startCell)}|${cellKey(goalCell)}|${profile}|${revision}`;
    const cached = bypassCache ? null : this.cache.get(cacheKey);
    if (cached) return cached.map(point => ({ ...point }));

    const passable = cell => isPassable(this.cellCenter(cell), profile);
    const nearestGoal = this.#nearestPassable(goalCell, passable);
    if (!nearestGoal) return [];
    goalCell = nearestGoal;

    const open = new MinHeap();
    const cameFrom = new Map();
    const gScore = new Map();
    const closed = new Set();
    const startKey = cellKey(startCell);
    cameFrom.set(startKey, null);
    gScore.set(startKey, 0);
    open.push(octile(startCell, goalCell), startCell);

    let visited = 0;
    let found = null;
    while (open.size && visited < this.maxVisited) {
      if (visited > 0 && performance.now() - workStartedAt >= this.maxWorkMs) break;
      const current = open.pop().value;
      const currentKey = cellKey(current);
      if (closed.has(currentKey)) continue;
      closed.add(currentKey);
      visited += 1;
      if (current.x === goalCell.x && current.y === goalCell.y) {
        found = current;
        break;
      }

      for (const [dx, dy] of NEIGHBORS) {
        const neighbor = { x: current.x + dx, y: current.y + dy };
        if (!passable(neighbor)) continue;
        if (dx && dy) {
          const horizontal = { x: current.x + dx, y: current.y };
          const vertical = { x: current.x, y: current.y + dy };
          if (!passable(horizontal) && !passable(vertical)) continue;
        }
        const neighborKey = cellKey(neighbor);
        const stepCost = (dx && dy ? Math.SQRT2 : 1) * Math.max(0.1, costAt(this.cellCenter(neighbor), profile));
        const tentative = gScore.get(currentKey) + stepCost;
        if (tentative >= (gScore.get(neighborKey) ?? Infinity)) continue;
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentative);
        open.push(tentative + octile(neighbor, goalCell), neighbor);
      }
    }

    if (!found) return [];
    const cells = [];
    let cursor = found;
    while (cursor) {
      cells.push(cursor);
      cursor = cameFrom.get(cellKey(cursor));
    }
    cells.reverse();
    const smoothed = this.#smooth(cells, passable);
    const points = smoothed.slice(1).map(cell => this.cellCenter(cell));
    if (points.length) points[points.length - 1] = { ...goal };

    if (!bypassCache) {
      this.cache.set(cacheKey, points.map(point => ({ ...point })));
      while (this.cache.size > this.maxCacheEntries) this.cache.delete(this.cache.keys().next().value);
    }
    return points;
  }

  #nearestPassable(goal, passable, maximumRadius = 8) {
    if (passable(goal)) return goal;
    // A bounded Total Battlefield search must also bound blocked-goal probing;
    // otherwise a nominal 12-node route can still perform hundreds of costly
    // terrain/structure checks before A* begins.
    const boundedRadius = Math.min(maximumRadius, Math.max(2, Math.ceil(Math.sqrt(this.maxVisited) / 2)));
    for (let radius = 1; radius <= boundedRadius; radius += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const candidate = { x: goal.x + dx, y: goal.y + dy };
          if (passable(candidate)) return candidate;
        }
      }
    }
    return null;
  }

  #smooth(path, passable) {
    if (path.length <= 2) return path;
    const result = [path[0]];
    let index = 0;
    while (index < path.length - 1) {
      let next = path.length - 1;
      while (next > index + 1 && !this.#linePassable(path[index], path[next], passable)) next -= 1;
      result.push(path[next]);
      index = next;
    }
    return result;
  }

  #linePassable(start, end, passable) {
    const length = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
    const steps = Math.max(1, length * 2);
    for (let index = 0; index <= steps; index += 1) {
      const amount = index / steps;
      const cell = {
        x: Math.round(start.x + (end.x - start.x) * amount),
        y: Math.round(start.y + (end.y - start.y) * amount)
      };
      if (!passable(cell)) return false;
    }
    return true;
  }
}

export default NavigationPlanner;
