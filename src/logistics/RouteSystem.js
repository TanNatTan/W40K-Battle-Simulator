export const ROAD_STATES = Object.freeze({
  CLEAR: { passable: true, costMultiplier: 1, risk: 0 },
  CONGESTED: { passable: true, costMultiplier: 2, risk: 0 },
  DAMAGED: { passable: true, costMultiplier: 3, risk: 0.05 },
  BLOCKED: { passable: false, costMultiplier: Infinity, risk: 0 },
  MINED: { passable: true, costMultiplier: 1.5, risk: 0.15 },
  FLOODED: { passable: false, costMultiplier: Infinity, risk: 0 },
  CONTESTED: { passable: true, costMultiplier: 1.8, risk: 0.2, needsEscort: true },
  SECURED: { passable: true, costMultiplier: 0.8, risk: 0 }
});

export const SUPPLY_ROUTE_KINDS = Object.freeze([
  "depot-to-unit",
  "warehouse-to-base",
  "base-to-frontline",
  "fuel-depot-to-vehicles"
]);

const normalizeState = value => String(value || "CLEAR").replaceAll(" ", "_").toUpperCase();
const roadState = road => ROAD_STATES[normalizeState(road.state ?? road.status)] || ROAD_STATES.CLEAR;
const edgeCost = road => {
  const state = roadState(road);
  return state.passable ? Math.max(0.001, Number(road.baseCost ?? road.base_cost) || 1) * Math.max(0.001, Number(road.length) || 1) * state.costMultiplier : Infinity;
};

export class RouteHistory {
  constructor(limit = 5000) {
    this.limit = limit;
    this.road = [];
    this.convoy = [];
    this.trade = [];
    this.ai = [];
  }

  _push(target, entry) {
    target.push(Object.freeze({ ...entry }));
    if (target.length > this.limit) target.splice(0, target.length - this.limit);
    return entry;
  }

  roadEvent(roadId, tick, action, details = {}) { return this._push(this.road, { roadId, tick, action, details }); }
  convoyEvent(convoyId, tick, action, details = {}) { return this._push(this.convoy, { convoyId, tick, action, details }); }
  tradeEvent(routeId, convoyId, tick, action, details = {}) { return this._push(this.trade, { routeId, convoyId, tick, action, details }); }
  aiAction(action, targetType, targetId, faction, tick, details = {}) { return this._push(this.ai, { action, targetType, targetId, faction, tick, details }); }

  toJSON() {
    return { road: [...this.road], convoy: [...this.convoy], trade: [...this.trade], ai: [...this.ai] };
  }
}

export class RoadGraph {
  constructor(nodes = [], roads = []) {
    this.nodes = new Map(nodes.map(node => [node.id, { ...node }]));
    this.roads = new Map();
    this.adjacency = new Map(nodes.map(node => [node.id, []]));
    for (const road of roads) this.addRoad(road);
  }

  addRoad(road) {
    const normalized = {
      ...road,
      id: road.id,
      from: road.from ?? road.fromId ?? road.from_node,
      to: road.to ?? road.toId ?? road.to_node,
      state: normalizeState(road.state ?? road.status),
      length: Number(road.length) || 1,
      baseCost: Number(road.baseCost ?? road.base_cost) || 1,
      bidirectional: road.bidirectional !== false,
      isBridge: Boolean(road.isBridge ?? road.is_bridge)
    };
    if (!normalized.id || !this.nodes.has(normalized.from) || !this.nodes.has(normalized.to)) throw new Error(`Road ${normalized.id || "unknown"} has invalid endpoints.`);
    this.roads.set(normalized.id, normalized);
    this.adjacency.get(normalized.from).push({ roadId: normalized.id, to: normalized.to });
    if (normalized.bidirectional) this.adjacency.get(normalized.to).push({ roadId: normalized.id, to: normalized.from });
    return normalized;
  }

  setRoadState(id, state) {
    const road = this.roads.get(id);
    const normalized = normalizeState(state);
    if (!road || !ROAD_STATES[normalized]) return null;
    road.state = normalized;
    road.status = normalized[0] + normalized.slice(1).toLowerCase().replaceAll("_", " ");
    return road;
  }

  shortestPath(start, destination, { avoidRoadIds = [] } = {}) {
    if (!this.nodes.has(start) || !this.nodes.has(destination)) return null;
    const avoid = new Set(avoidRoadIds);
    const costs = new Map([[start, 0]]);
    const previous = new Map();
    const queue = new Set([start]);
    while (queue.size) {
      const current = [...queue].sort((a, b) => (costs.get(a) ?? Infinity) - (costs.get(b) ?? Infinity))[0];
      queue.delete(current);
      if (current === destination) break;
      for (const edge of this.adjacency.get(current) || []) {
        const road = this.roads.get(edge.roadId);
        if (avoid.has(edge.roadId)) continue;
        const cost = edgeCost(road);
        if (!Number.isFinite(cost)) continue;
        const candidate = (costs.get(current) ?? Infinity) + cost;
        if (candidate >= (costs.get(edge.to) ?? Infinity)) continue;
        costs.set(edge.to, candidate);
        previous.set(edge.to, { from: current, roadId: edge.roadId });
        queue.add(edge.to);
      }
    }
    if (!costs.has(destination)) return null;
    const path = [destination];
    const edges = [];
    let cursor = destination;
    while (cursor !== start) {
      const step = previous.get(cursor);
      if (!step) return null;
      path.unshift(step.from);
      edges.unshift(step.roadId);
      cursor = step.from;
    }
    return { path, edges, cost: costs.get(destination) };
  }
}

export class RouteManager {
  constructor(graph, history = new RouteHistory()) {
    this.graph = graph;
    this.history = history;
    this.supplyRoutes = new Map();
    this.tradeRoutes = new Map();
    this.serial = 1;
  }

  _pathThrough(origin, destination, waypoints = []) {
    const stops = [origin, ...waypoints, destination];
    const path = [origin];
    const edges = [];
    let cost = 0;
    for (let index = 0; index < stops.length - 1; index += 1) {
      const leg = this.graph.shortestPath(stops[index], stops[index + 1]);
      if (!leg) return null;
      path.push(...leg.path.slice(1));
      edges.push(...leg.edges);
      cost += leg.cost;
    }
    return { path, edges, cost };
  }

  createSupplyRoute({ kind, origin, destination, resource = null, tick = 0, ttlTicks = 60, faction = null } = {}) {
    if (!SUPPLY_ROUTE_KINDS.includes(kind)) throw new Error(`Unknown temporary supply route kind: ${kind}`);
    const result = this._pathThrough(origin, destination);
    if (!result) return null;
    const route = {
      id: `supply-route-${this.serial++}`,
      authored: false,
      temporary: true,
      kind,
      origin,
      destination,
      resource,
      faction,
      ...result,
      active: true,
      createdTick: tick,
      expiresTick: ttlTicks == null ? null : tick + Math.max(1, ttlTicks)
    };
    this.supplyRoutes.set(route.id, route);
    return route;
  }

  createTradeRoute({ authored = false, origin, destination, waypoints = [], capacity = 100, resources = [], allowedFactions = ["*"], roadRequirement = null, bidirectional = true, tick = 0, id = null } = {}) {
    if (!authored) throw new Error("Permanent trade routes must be authored by the map designer.");
    const result = this._pathThrough(origin, destination, waypoints);
    if (!result) return null;
    const route = {
      id: id || `trade-route-${this.serial++}`,
      authored: true,
      temporary: false,
      origin,
      destination,
      waypoints: [...waypoints],
      capacity: Math.max(1, Number(capacity) || 1),
      resources: [...resources],
      allowedFactions: [...allowedFactions],
      roadRequirement,
      bidirectional,
      ...result,
      active: true,
      createdTick: tick
    };
    this.tradeRoutes.set(route.id, route);
    return route;
  }

  expireSupplyRoutes(tick) {
    for (const route of this.supplyRoutes.values()) {
      if (route.active && route.expiresTick != null && tick >= route.expiresTick) route.active = false;
    }
  }

  reroute(route, fromNode) {
    const result = this.graph.shortestPath(fromNode, route.destination);
    if (!result) return null;
    Object.assign(route, result);
    return result;
  }

  toJSON() {
    return { supplyRoutes: [...this.supplyRoutes.values()], tradeRoutes: [...this.tradeRoutes.values()] };
  }
}

export class ConvoyManager {
  constructor(graph, routeManager, history = routeManager.history, speedPerTick = 10) {
    this.graph = graph;
    this.routes = routeManager;
    this.history = history;
    this.speedPerTick = speedPerTick;
    this.convoys = new Map();
    this.serial = 1;
  }

  spawn({ route, routeKind, faction, cargo = null, tick = 0 }) {
    if (!route?.active) return null;
    const convoy = {
      id: `convoy-${this.serial++}`,
      routeId: route.id,
      routeKind,
      faction,
      cargo,
      status: "traveling",
      path: [...route.path],
      edges: [...route.edges],
      edgeIndex: 0,
      progress: 0,
      createdTick: tick
    };
    this.convoys.set(convoy.id, convoy);
    this.history.convoyEvent(convoy.id, tick, "spawned", { routeId: route.id });
    if (!convoy.edges.length) convoy.status = "arrived";
    return convoy;
  }

  tick(tick) {
    for (const convoy of this.convoys.values()) if (convoy.status === "traveling") this._advance(convoy, tick);
  }

  _advance(convoy, tick) {
    const roadId = convoy.edges[convoy.edgeIndex];
    if (!roadId) {
      convoy.status = "arrived";
      this.history.convoyEvent(convoy.id, tick, "arrived", { node: convoy.path.at(-1) });
      if (convoy.routeKind === "trade") this.history.tradeEvent(convoy.routeId, convoy.id, tick, "delivered", convoy.cargo || {});
      return;
    }
    const road = this.graph.roads.get(roadId);
    if (!roadState(road).passable) {
      this.history.convoyEvent(convoy.id, tick, "blocked", { roadId, node: convoy.path[convoy.edgeIndex] });
      const destination = convoy.path.at(-1);
      const reroute = this.graph.shortestPath(convoy.path[convoy.edgeIndex], destination);
      if (!reroute || (!reroute.edges.length && convoy.path[convoy.edgeIndex] !== destination)) {
        convoy.status = "stranded";
        this.history.convoyEvent(convoy.id, tick, "stranded", { node: convoy.path[convoy.edgeIndex] });
        return;
      }
      convoy.path = convoy.path.slice(0, convoy.edgeIndex + 1).concat(reroute.path.slice(1));
      convoy.edges = convoy.edges.slice(0, convoy.edgeIndex).concat(reroute.edges);
      convoy.progress = 0;
      this.history.convoyEvent(convoy.id, tick, "rerouted", { edges: reroute.edges });
      return;
    }
    convoy.progress += this.speedPerTick / edgeCost(road);
    if (convoy.progress < 1) return;
    convoy.progress = 0;
    convoy.edgeIndex += 1;
    this.history.convoyEvent(convoy.id, tick, "advanced", { roadId, node: convoy.path[convoy.edgeIndex] });
    if (convoy.edgeIndex >= convoy.edges.length) this._advance(convoy, tick);
  }
}

export class RouteAI {
  constructor(graph, routeManager, convoyManager, history = routeManager.history, faction = "ai") {
    this.graph = graph;
    this.routes = routeManager;
    this.convoys = convoyManager;
    this.history = history;
    this.faction = faction;
  }

  _action(action, targetType, targetId, tick, details = {}) {
    this.history.aiAction(action, targetType, targetId, this.faction, tick, details);
  }

  secure(roadId, tick = 0) { this.graph.setRoadState(roadId, "SECURED"); this._action("secure", "road", roadId, tick); }
  patrol(roadId, tick = 0) { this._action("patrol", "road", roadId, tick); }
  hold(nodeId, tick = 0) { this._action("hold", "node", nodeId, tick); }
  escort(convoyId, tick = 0) { this._action("escort", "convoy", convoyId, tick); }
  repair(roadId, tick = 0) { this.graph.setRoadState(roadId, "CLEAR"); this._action("repair", "road", roadId, tick); }
  reroute(routeId, kind = "supply", tick = 0) {
    const route = (kind === "trade" ? this.routes.tradeRoutes : this.routes.supplyRoutes).get(routeId);
    const result = route ? this.routes.reroute(route, route.origin) : null;
    this._action("reroute", "route", routeId, tick, { success: Boolean(result) });
    return result;
  }
  block(roadId, tick = 0) { this.graph.setRoadState(roadId, "BLOCKED"); this._action("block", "road", roadId, tick); }
  ambush(roadId, tick = 0) { this.graph.setRoadState(roadId, "CONTESTED"); this._action("ambush", "road", roadId, tick); }
  destroy(roadId, tick = 0) { this.graph.setRoadState(roadId, "BLOCKED"); this._action("destroy", "road", roadId, tick); }

  runTick(tick) {
    const important = new Set();
    for (const route of [...this.routes.supplyRoutes.values(), ...this.routes.tradeRoutes.values()]) {
      if (route.active) for (const roadId of route.edges) important.add(roadId);
    }
    const actions = [];
    for (const roadId of important) {
      const state = normalizeState(this.graph.roads.get(roadId)?.state);
      if (state === "DAMAGED" || state === "BLOCKED") { this.repair(roadId, tick); actions.push({ roadId, action: "repair" }); }
      else if (state === "CONTESTED" || state === "MINED") { this.patrol(roadId, tick); actions.push({ roadId, action: "patrol" }); }
      else if (["CLEAR", "CONGESTED"].includes(state)) { this.secure(roadId, tick); actions.push({ roadId, action: "secure" }); }
    }
    for (const convoy of this.convoys.convoys.values()) if (convoy.status === "stranded") this.escort(convoy.id, tick);
    this.routes.expireSupplyRoutes(tick);
    return actions;
  }
}
