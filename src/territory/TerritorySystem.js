export const CELL_STATES = Object.freeze({
  neutral: "neutral",
  claimed: "claimed",
  contested: "contested",
  abandoned: "abandoned"
});

export const CELL_STATE = CELL_STATES;

export const OBJECTIVE_TYPES = Object.freeze([
  "strategic-point",
  "critical-location",
  "trade-station",
  "bridge",
  "relay",
  "spaceport",
  "high-ground",
  "resource-hub"
]);

export const OBJECTIVE_EFFECTS = Object.freeze({
  "strategic-point": { control: 3 },
  "critical-location": { control: 4 },
  "trade-station": { control: 2, road: 0.5, resource: 2 },
  bridge: { control: 2, road: 2 },
  relay: { control: 1.5, road: 1, supply: 1 },
  spaceport: { control: 5, road: 1, resource: 1 },
  "high-ground": { control: 2, defense: 2 },
  "resource-hub": { control: 2, resource: 3 }
});

export const DEFAULT_WEIGHTS = Object.freeze({
  resourceAccess: 1,
  objectives: 1.6,
  roadControl: 1.2,
  supplyConnection: 1.4,
  baseDefense: 1.1,
  strategicDepth: 0.7
});

export const UNIT_CONFIG = Object.freeze({
  unitsPerPlayer: 10,
  baseCaptureSeconds: 60,
  perUnitBonus: 0.2,
  maxUnitsPerTarget: 5,
  moveSecondsPerHop: 3.5
});

const mulberry32 = seed => {
  let value = Number(seed) >>> 0;
  return () => {
    value = value + 0x6D2B79F5 | 0;
    let next = Math.imul(value ^ value >>> 15, 1 | value);
    next = next + Math.imul(next ^ next >>> 7, 61 | next) ^ next;
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
};

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const PolygonMath = Object.freeze({
  clipHalfPlane(subject, linePoint, normal) {
    if (!subject.length) return [];
    const output = [];
    const side = point => (point.x - linePoint.x) * normal.x + (point.y - linePoint.y) * normal.y;
    const intersection = (a, b) => {
      const da = side(a);
      const db = side(b);
      const t = da / (da - db || 1e-9);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    };
    for (let index = 0; index < subject.length; index += 1) {
      const current = subject[index];
      const previous = subject[(index + subject.length - 1) % subject.length];
      const currentSide = side(current);
      const previousSide = side(previous);
      if (currentSide <= 0) {
        if (previousSide > 0) output.push(intersection(previous, current));
        output.push(current);
      } else if (previousSide <= 0) output.push(intersection(previous, current));
    }
    return output;
  },

  area(polygon) {
    let sum = 0;
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      sum += a.x * b.y - b.x * a.y;
    }
    return Math.abs(sum) / 2;
  },

  centroid(polygon) {
    if (!polygon.length) return { x: 0, y: 0 };
    let x = 0;
    let y = 0;
    let crossTotal = 0;
    for (let index = 0; index < polygon.length; index += 1) {
      const a = polygon[index];
      const b = polygon[(index + 1) % polygon.length];
      const cross = a.x * b.y - b.x * a.y;
      crossTotal += cross;
      x += (a.x + b.x) * cross;
      y += (a.y + b.y) * cross;
    }
    if (Math.abs(crossTotal) < 1e-9) {
      return {
        x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
        y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length
      };
    }
    return { x: x / (3 * crossTotal), y: y / (3 * crossTotal) };
  },

  contains(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const a = polygon[i];
      const b = polygon[j];
      if ((a.y > point.y) !== (b.y > point.y)
        && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y || 1e-9) + a.x) inside = !inside;
    }
    return inside;
  }
});

/** One-time organic polygon pool. Gameplay mutates cells but never rebuilds it. */
export class SpatialPartition {
  constructor({ width, height, cellCount = 90, seed = 1, relaxIterations = 2 } = {}) {
    this.width = Math.max(1, Number(width) || 1920);
    this.height = Math.max(1, Number(height) || 1080);
    this.random = mulberry32(seed);
    this.sites = this._scatter(Math.max(2, cellCount));
    for (let index = 0; index < relaxIterations; index += 1) {
      this.sites = this._polygons(this.sites).map(cell => PolygonMath.centroid(cell.polygon));
    }
    const polygons = this._polygons(this.sites);
    this.cells = polygons.map((cell, index) => {
      const edgeNeighbors = polygons
        .map((candidate, candidateIndex) => candidateIndex !== index && SpatialPartition._sharesEdge(cell.polygon, candidate.polygon) ? candidateIndex : -1)
        .filter(candidateIndex => candidateIndex >= 0);
      // Degenerate border cells still receive a navigable fallback connection.
      const neighbors = edgeNeighbors.length ? edgeNeighbors : this.sites
        .map((site, candidate) => ({ candidate, value: candidate === index ? Infinity : distance(cell.site, site) }))
        .sort((a, b) => a.value - b.value)
        .slice(0, 1)
        .map(item => item.candidate);
      return { ...cell, id: index, neighbors };
    });
    this._makeAdjacencySymmetric();
  }

  static _sharesEdge(first, second) {
    const epsilon = 0.75;
    let sharedVertices = 0;
    for (const a of first) {
      for (const b of second) {
        if (Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon) sharedVertices += 1;
      }
    }
    return sharedVertices >= 2;
  }

  _scatter(count) {
    const columns = Math.ceil(Math.sqrt(count * this.width / this.height));
    const rows = Math.ceil(count / columns);
    const cellWidth = this.width / columns;
    const cellHeight = this.height / rows;
    const sites = [];
    for (let row = 0; row < rows && sites.length < count; row += 1) {
      for (let column = 0; column < columns && sites.length < count; column += 1) {
        sites.push({
          x: column * cellWidth + cellWidth * (0.1 + this.random() * 0.8),
          y: row * cellHeight + cellHeight * (0.1 + this.random() * 0.8)
        });
      }
    }
    return sites;
  }

  _polygons(sites) {
    const bounds = [{ x: 0, y: 0 }, { x: this.width, y: 0 }, { x: this.width, y: this.height }, { x: 0, y: this.height }];
    return sites.map((site, index) => {
      let polygon = bounds.map(point => ({ ...point }));
      for (let otherIndex = 0; otherIndex < sites.length && polygon.length; otherIndex += 1) {
        if (otherIndex === index) continue;
        const other = sites[otherIndex];
        polygon = PolygonMath.clipHalfPlane(polygon, {
          x: (site.x + other.x) / 2,
          y: (site.y + other.y) / 2
        }, { x: other.x - site.x, y: other.y - site.y });
      }
      return { site: { ...site }, polygon };
    });
  }

  _makeAdjacencySymmetric() {
    for (const cell of this.cells) {
      for (const neighborId of cell.neighbors) {
        const neighbor = this.cells[neighborId];
        if (neighbor && !neighbor.neighbors.includes(cell.id)) neighbor.neighbors.push(cell.id);
      }
    }
  }

  closestCell(point) {
    return this.cells.reduce((best, cell) => distance(cell.site, point) < distance(best.site, point) ? cell : best, this.cells[0]);
  }
}

export class TerritorySystem {
  constructor(partition, players = [], options = {}) {
    this.partition = partition;
    this.weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
    this.unitConfig = { ...UNIT_CONFIG, ...(options.unitConfig || {}) };
    this.players = new Map(players.map(player => [player.id, { ...player }]));
    this.tickCount = 0;
    this.simSeconds = 0;
    this.log = [];
    this.cells = partition.cells.map(source => {
      const cell = {
        id: source.id,
        polygon: source.polygon.map(point => ({ ...point })),
        neighbors: [...source.neighbors],
        centroid: PolygonMath.centroid(source.polygon),
        area: PolygonMath.area(source.polygon),
        owner: null,
        state: CELL_STATES.neutral,
        objective: null,
        objectiveId: null,
        objectiveStrategicValue: 0,
        resources: { resourceAccess: 0, roadControl: 0, supplyConnected: false },
        siege: null,
        lastOwner: null,
        previousOwnerId: null,
        isolatedTicks: 0,
        isBase: false
      };
      // Flat aliases preserve the existing renderer and objective evaluator API.
      for (const key of ["resourceAccess", "roadControl", "supplyConnected"]) {
        Object.defineProperty(cell, key, {
          enumerable: true,
          get: () => cell.resources[key],
          set: value => { cell.resources[key] = value; }
        });
      }
      return cell;
    });
    this.byId = new Map(this.cells.map(cell => [cell.id, cell]));
    this._cellReferences = new Map(this.cells.map(cell => [cell.id, cell]));
    this._seedAuthoredLayer(options);
    this._seedBases(players);
    this.units = [];
    this._spawnUnits();
    this._unitReferences = new Map(this.units.map(unit => [unit.id, unit]));
    // Compatibility readout for the current UI; territory agents are the garrison.
    this.garrisons = new Map(players.map(player => [player.id, this.unitConfig.unitsPerPlayer]));
    this.casualties = new Map(players.map(player => [player.id, 0]));
    this.eliminated = new Set();
    this._reconnectTimer = 0;
    this.gameOver = false;
    this.winner = null;
  }

  _seedAuthoredLayer(options) {
    for (const objective of options.objectives || []) {
      if (!OBJECTIVE_TYPES.includes(objective.type)) continue;
      const cell = objective.cellId == null ? this.byId.get(this.partition.closestCell(objective).id) : this.byId.get(objective.cellId);
      if (cell) {
        cell.objective = objective.type;
        cell.objectiveId = objective.sourceId || objective.id || `objective:${cell.id}`;
        cell.objectiveStrategicValue = Number(objective.strategicValue) || (OBJECTIVE_EFFECTS[objective.type]?.control || 1) * 20;
      }
    }
    for (const zone of options.resourceZones || []) {
      const cell = this.byId.get(this.partition.closestCell(zone).id);
      if (cell) cell.resourceAccess += Math.max(0.25, Number(zone.strategicValue ?? zone.richness) || 1);
    }
    for (const road of options.roads || []) {
      for (const point of road.points || []) this.byId.get(this.partition.closestCell(point).id).roadControl += 0.5;
    }
  }

  _seedBases(players) {
    for (const player of players) {
      const cell = player.baseCellId == null ? this.byId.get(this.partition.closestCell(player.base || player).id) : this.byId.get(player.baseCellId);
      if (!cell) throw new Error(`Player ${player.id} has no valid base cell.`);
      this._setOwner(cell, player.id, CELL_STATES.claimed);
      cell.isBase = true;
      player.baseCellId = cell.id;
      this.players.set(player.id, { ...player });
    }
  }

  _spawnUnits() {
    for (const player of this.players.values()) {
      for (let index = 0; index < this.unitConfig.unitsPerPlayer; index += 1) {
        this.units.push({
          id: `${player.id}-territory-${index}`,
          playerId: player.id,
          cellId: player.baseCellId,
          targetCellId: null,
          path: [],
          moveTimer: 0,
          state: "idle"
        });
      }
    }
  }

  _setOwner(cell, owner, state) {
    if (cell.owner && cell.owner !== owner) {
      cell.lastOwner = cell.owner;
      cell.previousOwnerId = cell.owner;
    }
    cell.owner = owner;
    cell.state = state;
    cell.siege = null;
    cell.isolatedTicks = 0;
  }

  _record(action, cell, actor, detail = "") {
    this.log.push({
      tick: this.tickCount,
      action,
      type: action,
      cellId: cell?.id ?? null,
      actor: actor ?? null,
      playerId: actor ?? null,
      detail
    });
    if (this.log.length > 2000) this.log.splice(0, this.log.length - 2000);
  }

  territoryCount(playerId) {
    let count = 0;
    for (const cell of this.cells) if (cell.owner === playerId) count += 1;
    return count;
  }

  fieldFor(playerId) {
    return this.cells.filter(cell => cell.owner === playerId);
  }

  claimCell(cellId, playerId, reason = "expansion") {
    if (this.gameOver) return false;
    const cell = this.byId.get(cellId);
    if (!cell || cell.owner === playerId) return false;
    if (cell.owner) return false;
    this._setOwner(cell, playerId, CELL_STATES.claimed);
    this._record("claim", cell, playerId, reason);
    return true;
  }

  loseCell(cellId, reason = "overrun") {
    const cell = this.byId.get(cellId);
    if (!cell?.owner) return false;
    const owner = cell.owner;
    cell.lastOwner = owner;
    cell.previousOwnerId = owner;
    cell.owner = null;
    cell.state = CELL_STATES.neutral;
    cell.siege = null;
    this._record("lose", cell, owner, reason);
    return true;
  }

  reclaimCell(cellId, playerId) {
    const cell = this.byId.get(cellId);
    if (!cell || cell.lastOwner !== playerId || cell.owner === playerId || ![CELL_STATES.neutral, CELL_STATES.abandoned].includes(cell.state)) return false;
    this._setOwner(cell, playerId, CELL_STATES.claimed);
    this._record("reclaim", cell, playerId);
    return true;
  }

  /** Scripted contests resolve immediately; live contests advance through unit sieges. */
  contestCell(cellId, challengerId) {
    if (this.gameOver) return false;
    const cell = this.byId.get(cellId);
    if (!cell || cell.owner === challengerId) return false;
    cell.state = CELL_STATES.contested;
    cell.siege = {
      attackerId: challengerId,
      progress: 1,
      unitsAssigned: 0,
      effectiveCaptureSeconds: this.unitConfig.baseCaptureSeconds,
      startedAt: this.simSeconds,
      contested: false,
      eligibleForRecaptureBonus: false
    };
    this._record("contest", cell, challengerId, cell.owner ? `siege against ${cell.owner}` : "claiming neutral territory");
    return this.resolveContest(cellId);
  }

  resolveContest(cellId) {
    const cell = this.byId.get(cellId);
    if (!cell?.siege) return false;
    this._resolveSiege(cell);
    return true;
  }

  abandonCell(cellId) {
    const cell = this.byId.get(cellId);
    if (!cell?.owner || cell.isBase) return false;
    const owner = cell.owner;
    cell.lastOwner = owner;
    cell.previousOwnerId = owner;
    cell.owner = null;
    cell.state = CELL_STATES.abandoned;
    cell.siege = null;
    this._record("abandon", cell, owner);
    return true;
  }

  reconnectIsolatedCells(playerId, graceTicks = 2) {
    const owned = this.fieldFor(playerId);
    const bases = owned.filter(cell => cell.isBase);
    const reachable = new Set(bases.map(cell => cell.id));
    const queue = [...bases];
    while (queue.length) {
      const cell = queue.shift();
      for (const neighborId of cell.neighbors) {
        const neighbor = this.byId.get(neighborId);
        if (neighbor?.owner === playerId && !reachable.has(neighborId)) {
          reachable.add(neighborId);
          queue.push(neighbor);
        }
      }
    }
    const isolated = [];
    const reconnected = [];
    for (const cell of owned) {
      if (reachable.has(cell.id)) {
        if (cell.isolatedTicks) reconnected.push(cell.id);
        cell.isolatedTicks = 0;
        cell.supplyConnected = true;
      } else {
        cell.supplyConnected = false;
        cell.isolatedTicks += 1;
        isolated.push(cell.id);
        if (cell.isolatedTicks > graceTicks) this.abandonCell(cell.id);
      }
    }
    return { isolated, reconnected };
  }

  _score(cell, playerId, aggression = 0) {
    const objective = OBJECTIVE_EFFECTS[cell.objective] || {};
    const player = this.players.get(playerId);
    const baseCell = this.byId.get(player?.baseCellId);
    const enemy = cell.owner && cell.owner !== playerId;
    const supply = cell.neighbors.some(id => this.byId.get(id)?.owner === playerId) ? 1 : 0;
    const depth = cell.neighbors.filter(id => this.byId.get(id)?.owner === playerId).length;
    const baseDefense = baseCell ? 1 - Math.min(1, distance(cell.centroid, baseCell.centroid) / Math.max(this.partition.width, this.partition.height)) : 0;
    return (cell.resourceAccess + (objective.resource || 0)) * this.weights.resourceAccess
      + (objective.control || 0) * this.weights.objectives
      + (cell.roadControl + (objective.road || 0)) * this.weights.roadControl
      + supply * this.weights.supplyConnection
      + baseDefense * this.weights.baseDefense
      + depth * this.weights.strategicDepth
      + (enemy ? aggression * 5 : 0)
      + (cell.isBase && enemy ? aggression * 16 : 0);
  }

  rankSiegeTargets(playerId, aggression = 0) {
    const frontier = new Set();
    for (const cell of this.cells) {
      if (cell.owner !== playerId) continue;
      for (const neighborId of cell.neighbors) {
        if (this.byId.get(neighborId)?.owner !== playerId) frontier.add(neighborId);
      }
    }
    const candidates = frontier.size
      ? [...frontier].map(id => this.byId.get(id)).filter(Boolean)
      : this.cells.filter(cell => cell.owner !== playerId);
    return candidates.map(cell => ({ cell, score: this._score(cell, playerId, aggression) }))
      .sort((a, b) => b.score - a.score);
  }

  _findPath(fromId, toId) {
    if (fromId === toId) return [];
    const visited = new Set([fromId]);
    const queue = [[fromId]];
    while (queue.length) {
      const path = queue.shift();
      const last = path[path.length - 1];
      for (const neighborId of this.byId.get(last)?.neighbors || []) {
        if (visited.has(neighborId)) continue;
        if (neighborId === toId) return [...path.slice(1), neighborId];
        visited.add(neighborId);
        queue.push([...path, neighborId]);
      }
    }
    return null;
  }

  _assignIdleUnits(playerId, aggression = 0) {
    if (this.eliminated.has(playerId)) return;
    const idle = this.units.filter(unit => unit.playerId === playerId && unit.state === "idle");
    if (!idle.length) return;
    const ranked = this.rankSiegeTargets(playerId, aggression);
    if (!ranked.length) return;
    for (const unit of idle) {
      let chosen = ranked[0].cell;
      for (const { cell } of ranked) {
        const assigned = this.units.filter(candidate => candidate.playerId === playerId
          && candidate.targetCellId === cell.id && candidate.state !== "idle").length;
        if (assigned < this.unitConfig.maxUnitsPerTarget) {
          chosen = cell;
          break;
        }
      }
      unit.targetCellId = chosen.id;
      unit.moveTimer = 0;
      if (unit.cellId === chosen.id) {
        unit.path.length = 0;
        unit.state = "capturing";
      } else {
        const path = this._findPath(unit.cellId, chosen.id);
        unit.path = path || [];
        unit.state = path?.length ? "moving" : "idle";
      }
    }
  }

  _updateMovement(dtSeconds) {
    for (const unit of this.units) {
      if (unit.state !== "moving") continue;
      unit.moveTimer += dtSeconds;
      while (unit.moveTimer >= this.unitConfig.moveSecondsPerHop && unit.path.length) {
        unit.moveTimer -= this.unitConfig.moveSecondsPerHop;
        unit.cellId = unit.path.shift();
      }
      if (!unit.path.length && unit.cellId === unit.targetCellId) unit.state = "capturing";
    }
  }

  _effectiveCaptureSeconds(cell, attackerId, oppositionPower = 0) {
    const eligible = attackerId != null && cell.previousOwnerId === attackerId && cell.owner !== attackerId;
    return eligible && oppositionPower <= 0 ? this.unitConfig.baseCaptureSeconds * 0.5 : this.unitConfig.baseCaptureSeconds;
  }

  _createSiege(cell, attackerId, unitsAssigned, oppositionPower = 0) {
    const eligibleForRecaptureBonus = cell.previousOwnerId === attackerId && cell.owner !== attackerId && oppositionPower <= 0;
    return {
      attackerId,
      progress: 0,
      unitsAssigned,
      effectiveCaptureSeconds: this._effectiveCaptureSeconds(cell, attackerId, oppositionPower),
      startedAt: this.simSeconds,
      contested: oppositionPower > 0,
      eligibleForRecaptureBonus
    };
  }

  _updateSieges(dtSeconds) {
    const forces = new Map();
    for (const unit of this.units) {
      if (unit.state !== "capturing") continue;
      const cell = this.byId.get(unit.cellId);
      if (!cell || cell.owner === unit.playerId) {
        unit.state = "idle";
        unit.targetCellId = null;
        continue;
      }
      if (!forces.has(cell.id)) forces.set(cell.id, new Map());
      const byPlayer = forces.get(cell.id);
      byPlayer.set(unit.playerId, (byPlayer.get(unit.playerId) || 0) + 1);
    }
    for (const [cellId, byPlayer] of forces) {
      const cell = this.byId.get(cellId);
      let attackerId = null;
      let unitsAssigned = 0;
      for (const [playerId, count] of byPlayer) {
        if (count > unitsAssigned) {
          attackerId = playerId;
          unitsAssigned = count;
        }
      }
      if (!cell.siege || cell.siege.attackerId !== attackerId) {
        cell.siege = this._createSiege(cell, attackerId, unitsAssigned);
      }
      cell.state = CELL_STATES.contested;
      cell.siege.unitsAssigned = unitsAssigned;
      cell.siege.contested = false;
      cell.siege.eligibleForRecaptureBonus = cell.previousOwnerId === attackerId && cell.owner !== attackerId;
      cell.siege.effectiveCaptureSeconds = this._effectiveCaptureSeconds(cell, attackerId, 0);
      const rate = (1 / cell.siege.effectiveCaptureSeconds)
        * (1 + this.unitConfig.perUnitBonus * Math.max(0, unitsAssigned - 1));
      cell.siege.progress = Math.min(1, cell.siege.progress + rate * dtSeconds);
      if (cell.siege.progress >= 1) this._resolveSiege(cell);
      if (this.gameOver) break;
    }
  }

  _resolveSiege(cell) {
    const attackerId = cell.siege?.attackerId;
    if (!attackerId) return false;
    const defenderId = cell.owner;
    const wasBase = cell.isBase;
    if (!defenderId) {
      if (cell.lastOwner === attackerId) this.reclaimCell(cell.id, attackerId);
      else this.claimCell(cell.id, attackerId, "siege-complete");
    } else {
      this._setOwner(cell, attackerId, CELL_STATES.claimed);
      this._record("decapture", cell, attackerId, wasBase ? `overran ${defenderId}'s base` : `overcame ${defenderId}`);
      this._record("lose", cell, defenderId, `lost to ${attackerId}`);
    }
    cell.siege = null;
    for (const unit of this.units) {
      if (unit.playerId === attackerId && unit.cellId === cell.id && unit.state === "capturing") {
        unit.state = "idle";
        unit.targetCellId = null;
      }
    }
    this._checkVictory();
    return true;
  }

  /** Advance capture using real runtime units supplied by the host simulation.
   *  No internal territory agent can contribute to this path. */
  advancePhysical(dtSeconds = 1, forces = [], { isAllied = (first, second) => first === second } = {}) {
    if (this.gameOver) return [];
    const elapsed = Math.max(0, Number(dtSeconds) || 0);
    const logStart = this.log.length;
    this.tickCount += 1;
    this.simSeconds += elapsed;
    const forcesByCell = new Map();
    for (const force of forces) {
      if (!this.byId.has(force.cellId) || !this.players.has(force.playerId)) continue;
      if (!forcesByCell.has(force.cellId)) forcesByCell.set(force.cellId, new Map());
      const groups = forcesByCell.get(force.cellId);
      groups.set(force.playerId, (groups.get(force.playerId) || 0) + Math.max(0, Number(force.power) || 1));
    }
    for (const cell of this.cells) {
      const groups = forcesByCell.get(cell.id) || new Map();
      const attackers = [...groups.entries()]
        .filter(([playerId]) => !cell.owner || !isAllied(playerId, cell.owner))
        .sort((a, b) => b[1] - a[1]);
      const [leading, runnerUp] = attackers;
      const defenderPower = cell.owner
        ? [...groups.entries()].filter(([playerId]) => isAllied(playerId, cell.owner)).reduce((sum, [, power]) => sum + power, 0)
        : 0;
      const opposition = Math.max(defenderPower, runnerUp?.[1] || 0);
      if (!leading || leading[1] <= opposition) {
        if (cell.siege) {
          cell.siege.contested = groups.size > 1;
          cell.siege.eligibleForRecaptureBonus = false;
          cell.siege.effectiveCaptureSeconds = this.unitConfig.baseCaptureSeconds;
          cell.siege.progress = Math.max(0, cell.siege.progress - elapsed / this.unitConfig.baseCaptureSeconds);
          if (cell.siege.progress <= 0) {
            cell.siege = null;
            cell.state = cell.owner ? CELL_STATES.claimed : CELL_STATES.neutral;
          }
        }
        continue;
      }
      const [attackerId, attackerPower] = leading;
      const effectiveUnits = Math.min(this.unitConfig.maxUnitsPerTarget, Math.max(1, attackerPower - opposition * 0.75));
      if (!cell.siege || cell.siege.attackerId !== attackerId) {
        cell.siege = this._createSiege(cell, attackerId, effectiveUnits, opposition);
      }
      cell.state = CELL_STATES.contested;
      cell.siege.unitsAssigned = effectiveUnits;
      cell.siege.contested = opposition > 0;
      cell.siege.eligibleForRecaptureBonus = cell.previousOwnerId === attackerId && cell.owner !== attackerId && opposition <= 0;
      cell.siege.effectiveCaptureSeconds = this._effectiveCaptureSeconds(cell, attackerId, opposition);
      const rate = (1 / cell.siege.effectiveCaptureSeconds)
        * (1 + this.unitConfig.perUnitBonus * Math.max(0, effectiveUnits - 1));
      cell.siege.progress = Math.min(1, cell.siege.progress + rate * elapsed);
      if (cell.siege.progress >= 1) this._resolveSiege(cell);
      if (this.gameOver) break;
    }
    this._reconnectTimer += elapsed;
    if (this._reconnectTimer >= 2) {
      this._reconnectTimer %= 2;
      for (const playerId of this.players.keys()) this.reconnectIsolatedCells(playerId);
    }
    this.assertNoNewObjects();
    this.assertNoNewUnits();
    return this.log.slice(logStart);
  }

  advance(dtSeconds = 1, { aggression = 0 } = {}) {
    if (this.gameOver) return [];
    const elapsed = Math.max(0, Number(dtSeconds) || 0);
    const logStart = this.log.length;
    this.tickCount += 1;
    this.simSeconds += elapsed;
    for (const playerId of this.players.keys()) this._assignIdleUnits(playerId, aggression);
    this._updateMovement(elapsed);
    this._updateSieges(elapsed);
    this._reconnectTimer += elapsed;
    if (this._reconnectTimer >= 2) {
      this._reconnectTimer %= 2;
      for (const playerId of this.players.keys()) this.reconnectIsolatedCells(playerId);
    }
    this._checkVictory();
    this.assertNoNewObjects();
    this.assertNoNewUnits();
    return this.log.slice(logStart);
  }

  step({ dtSeconds = 5, aggression = 0 } = {}) {
    return this.advance(dtSeconds, { aggression });
  }

  _checkVictory() {
    for (const playerId of this.players.keys()) {
      if (this.territoryCount(playerId) === 0) {
        this.eliminated.add(playerId);
        for (const unit of this.units) {
          if (unit.playerId !== playerId) continue;
          unit.state = "idle";
          unit.targetCellId = null;
          unit.path.length = 0;
        }
      }
    }
    const alive = [...this.players.keys()].filter(playerId => !this.eliminated.has(playerId));
    if (alive.length <= 1 && this.players.size > 1) {
      this.gameOver = true;
      this.winner = alive[0] || null;
      this._record("game-over", null, this.winner, this.winner ? `${this.winner} annihilated every rival` : "mutual annihilation");
    }
  }

  assertNoNewObjects() {
    if (this.cells.length !== this._cellReferences.size) throw new Error("Territory cell pool size changed.");
    for (const cell of this.cells) if (this._cellReferences.get(cell.id) !== cell) throw new Error(`Territory cell ${cell.id} was replaced.`);
    return true;
  }

  assertNoNewUnits() {
    if (this.units.length !== this._unitReferences.size) throw new Error("Territory unit pool size changed.");
    for (const unit of this.units) if (this._unitReferences.get(unit.id) !== unit) throw new Error(`Territory unit ${unit.id} was replaced.`);
    return true;
  }

  unitsFor(playerId) {
    return this.units.filter(unit => unit.playerId === playerId);
  }

  objectivePublicStates() {
    return this.cells.filter(cell => cell.objective).map(cell => Object.freeze({
      objectiveId: cell.objectiveId || `objective:${cell.id}`,
      territoryCellId: cell.id,
      type: cell.objective,
      ownerId: cell.owner,
      state: cell.siege ? (cell.siege.contested ? "contested" : "capturing") : cell.owner ? "controlled" : "neutral",
      attackerId: cell.siege?.attackerId || null,
      captureProgress: cell.siege?.progress || 0,
      recaptureBonus: Boolean(cell.siege?.eligibleForRecaptureBonus),
      strategicValue: cell.objectiveStrategicValue,
      position: Object.freeze({ ...cell.centroid })
    }));
  }

  toJSON() {
    return {
      version: 3,
      tickCount: this.tickCount,
      simSeconds: this.simSeconds,
      cells: this.cells.map(cell => ({
        id: cell.id, owner: cell.owner, state: cell.state, objective: cell.objective, objectiveId: cell.objectiveId,
        objectiveStrategicValue: cell.objectiveStrategicValue,
        resources: { ...cell.resources }, siege: cell.siege ? { ...cell.siege } : null,
        lastOwner: cell.lastOwner, previousOwnerId: cell.previousOwnerId, isolatedTicks: cell.isolatedTicks, isBase: cell.isBase
      })),
      units: this.units.map(unit => ({
        id: unit.id,
        playerId: unit.playerId,
        cellId: unit.cellId,
        targetCellId: unit.targetCellId,
        path: [...unit.path],
        moveTimer: unit.moveTimer,
        state: unit.state
      })),
      garrisons: Object.fromEntries(this.garrisons),
      casualties: Object.fromEntries(this.casualties),
      eliminated: [...this.eliminated],
      gameOver: this.gameOver,
      winner: this.winner,
      log: this.log.slice(-500)
    };
  }

  loadState(payload) {
    const state = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!state || state.cells?.length !== this.cells.length) throw new Error("Territory state does not match the fixed cell pool.");
    for (const saved of state.cells) {
      const cell = this.byId.get(saved.id);
      if (!cell) throw new Error(`Unknown territory cell ${saved.id}.`);
      cell.owner = saved.owner ?? null;
      cell.state = saved.state || CELL_STATES.neutral;
      cell.objective = saved.objective ?? null;
      cell.objectiveId = saved.objectiveId ?? (cell.objective ? `objective:${cell.id}` : null);
      cell.objectiveStrategicValue = Number(saved.objectiveStrategicValue) || 0;
      cell.resources = saved.resources ? { ...saved.resources } : {
        resourceAccess: Number(saved.resourceAccess) || 0,
        roadControl: Number(saved.roadControl) || 0,
        supplyConnected: Boolean(saved.supplyConnected)
      };
      cell.siege = saved.siege ? { ...saved.siege } : saved.contest ? {
        attackerId: saved.contest.challengerId,
        progress: 0,
        unitsAssigned: 0
      } : null;
      cell.lastOwner = saved.lastOwner ?? null;
      cell.previousOwnerId = saved.previousOwnerId ?? saved.lastOwner ?? null;
      cell.isolatedTicks = Number(saved.isolatedTicks) || 0;
      cell.isBase = Boolean(saved.isBase);
    }
    if (state.units) {
      const savedUnits = new Map(state.units.map(unit => [unit.id, unit]));
      for (const unit of this.units) {
        const saved = savedUnits.get(unit.id);
        if (!saved) continue;
        unit.cellId = saved.cellId;
        unit.targetCellId = saved.targetCellId ?? null;
        unit.path = [...(saved.path || [])];
        unit.moveTimer = Number(saved.moveTimer) || 0;
        unit.state = saved.state || "idle";
      }
    }
    this.tickCount = Number(state.tickCount) || 0;
    this.simSeconds = Number(state.simSeconds) || 0;
    this.garrisons = new Map(Object.entries(state.garrisons || {}));
    this.casualties = new Map(Object.entries(state.casualties || {}));
    this.eliminated = new Set(state.eliminated || []);
    this.gameOver = Boolean(state.gameOver);
    this.winner = state.winner ?? null;
    this.log = [...(state.log || [])];
    this.assertNoNewObjects();
    this.assertNoNewUnits();
    return this;
  }
}
