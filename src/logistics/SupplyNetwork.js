const distance = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));

const disconnected = revision => Object.freeze({
  connected: false,
  hub: false,
  componentId: null,
  componentSummary: null,
  pathCost: Infinity,
  throughput: 0,
  bottleneck: 0,
  risk: 1,
  path: Object.freeze([]),
  lastChanged: revision
});

/** Cached supply topology. Component metadata is rebuilt only after invalidateTopology(). */
export class SupplyNetwork {
  constructor({ defaultReach = 220 } = {}) {
    this.defaultReach = defaultReach;
    this.revision = 0;
    this.rebuildCount = 0;
    this.dirty = true;
    this.connections = new Map();
    this.components = new Map();
  }

  invalidateTopology() {
    this.revision += 1;
    this.dirty = true;
  }

  rebuild({ structures = [], economicNodes = [], tradeRoutes = [], players = [] } = {}) {
    if (!this.dirty) return false;
    const nodes = structures.filter(item => item.alive !== false && item.progress >= 1).map(item => ({
      id: item.id,
      x: item.x,
      y: item.y,
      faction: item.faction,
      hub: ["outpost", "forwardoutpost", "warehouse", "supplydepot"].includes(item.type),
      headquarters: Boolean(item.headquarters || item.productionRole === "headquarters" || item.type === "outpost"),
      kind: "structure",
      type: item.type,
      tags: [...new Set([item.type, ...(item.productionTags || [])])],
      outputCapabilities: [...new Set(item.productionOutputCapabilities || [])],
      reach: Number(item.supplyRadius) || this.defaultReach,
      risk: Number(item.routeRisk) || 0
    }));
    for (const item of economicNodes.filter(item => item.active !== false && item.owner)) nodes.push({
      id: item.id,
      x: item.x ?? item.position?.x,
      y: item.y ?? item.position?.y,
      faction: item.owner,
      hub: true,
      headquarters: false,
      kind: "economic-node",
      type: item.type || "economic-node",
      tags: [...new Set(["economic-node", item.type, ...Object.keys(item.exports || {}).map(resource => `export:${resource}`)].filter(Boolean))],
      outputCapabilities: Object.keys(item.exports || {}),
      reach: this.defaultReach,
      risk: Number(item.routeRisk) || 0.1
    });
    const byFaction = new Map();
    for (const node of nodes) {
      if (!byFaction.has(node.faction)) byFaction.set(node.faction, []);
      byFaction.get(node.faction).push(node);
    }
    const routedPairs = new Set();
    for (const route of tradeRoutes.filter(route => route.authored !== false && route.complete !== false)) {
      const points = route.points || [];
      for (const [faction, candidates] of byFaction) {
        if (route.allowedFactions?.length && !route.allowedFactions.includes(faction)) continue;
        const endpoints = [points[0], points.at(-1)].filter(Boolean).map(point => candidates.slice().sort((a, b) => distance(a, point) - distance(b, point))[0]);
        if (endpoints.length === 2 && endpoints[0]?.id !== endpoints[1]?.id) routedPairs.add(`${faction}:${endpoints[0].id}:${endpoints[1].id}`);
      }
    }

    this.connections.clear();
    this.components.clear();
    for (const [faction, factionNodes] of byFaction) {
      const byId = new Map(factionNodes.map(node => [node.id, node]));
      const adjacency = new Map(factionNodes.map(node => [node.id, []]));
      for (let i = 0; i < factionNodes.length; i += 1) for (let j = i + 1; j < factionNodes.length; j += 1) {
        const a = factionNodes[i];
        const b = factionNodes[j];
        const authored = routedPairs.has(`${faction}:${a.id}:${b.id}`) || routedPairs.has(`${faction}:${b.id}:${a.id}`);
        const length = distance(a, b);
        if (!authored && length > Math.max(a.reach, b.reach, this.defaultReach)) continue;
        const cost = length * (authored ? 0.65 : 1);
        const edge = { cost, risk: Math.max(a.risk, b.risk) };
        adjacency.get(a.id).push({ id: b.id, ...edge });
        adjacency.get(b.id).push({ id: a.id, ...edge });
      }

      const componentByNode = new Map();
      let componentIndex = 0;
      for (const seed of factionNodes) {
        if (componentByNode.has(seed.id)) continue;
        const componentNodes = [];
        const queue = [seed.id];
        componentByNode.set(seed.id, componentIndex);
        while (queue.length) {
          const id = queue.shift();
          const node = byId.get(id);
          componentNodes.push(node);
          for (const edge of adjacency.get(id) || []) {
            if (componentByNode.has(edge.id)) continue;
            componentByNode.set(edge.id, componentIndex);
            queue.push(edge.id);
          }
        }
        const componentId = `${faction}:component:${componentIndex}`;
        const typeCounts = {};
        const tags = new Set();
        const outputCapabilities = new Set();
        for (const node of componentNodes) {
          typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
          node.tags.forEach(tag => tags.add(tag));
          node.outputCapabilities.forEach(resource => outputCapabilities.add(resource));
        }
        const summary = Object.freeze({
          id: componentId,
          faction,
          connectedToHQ: componentNodes.some(node => node.headquarters),
          structureIds: Object.freeze(componentNodes.filter(node => node.kind === "structure").map(node => node.id)),
          nodeIds: Object.freeze(componentNodes.map(node => node.id)),
          structureCount: componentNodes.filter(node => node.kind === "structure").length,
          typeCounts: Object.freeze(typeCounts),
          tags: Object.freeze([...tags]),
          outputCapabilities: Object.freeze([...outputCapabilities]),
          topologyVersion: this.revision
        });
        this.components.set(componentId, summary);
        for (const node of componentNodes) componentByNode.set(node.id, componentId);
        componentIndex += 1;
      }

      const headquarters = factionNodes.filter(node => node.headquarters);
      const frontier = headquarters.map(node => ({ node, cost: 0, risk: node.risk, path: [node.id] }));
      const best = new Map(frontier.map(item => [item.node.id, item]));
      while (frontier.length) {
        frontier.sort((a, b) => a.cost - b.cost);
        const current = frontier.shift();
        for (const edge of adjacency.get(current.node.id) || []) {
          const cost = current.cost + edge.cost;
          if (best.has(edge.id) && best.get(edge.id).cost <= cost) continue;
          const next = { node: byId.get(edge.id), cost, risk: Math.max(current.risk, edge.risk), path: [...current.path, edge.id] };
          best.set(edge.id, next);
          frontier.push(next);
        }
      }
      for (const node of factionNodes) {
        const route = best.get(node.id);
        const componentId = componentByNode.get(node.id);
        const componentSummary = this.components.get(componentId);
        const connected = Boolean(route && componentSummary?.connectedToHQ);
        const throughput = connected ? Math.max(0.2, 1 - route.cost / 2400) * Math.max(0.2, 1 - route.risk) : 0;
        this.connections.set(node.id, Object.freeze({
          connected,
          hub: Boolean(node.hub),
          componentId,
          componentSummary,
          pathCost: route?.cost ?? Infinity,
          throughput,
          bottleneck: throughput,
          risk: route?.risk ?? 1,
          path: Object.freeze(route?.path || []),
          lastChanged: this.revision
        }));
      }
    }
    this.dirty = false;
    this.rebuildCount += 1;
    return true;
  }

  connectionFor(structureOrId) {
    const id = typeof structureOrId === "string" ? structureOrId : structureOrId?.id;
    return this.connections.get(id) || disconnected(this.revision);
  }

  componentFor(structureOrId) {
    return this.connectionFor(structureOrId).componentSummary || null;
  }

  componentSummaries() {
    return [...this.components.values()];
  }
}
