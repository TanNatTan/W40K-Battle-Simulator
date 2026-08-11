const distance = (a, b) => Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));

export class SupplyNetwork {
  constructor({ defaultReach = 220 } = {}) {
    this.defaultReach = defaultReach;
    this.revision = 0;
    this.rebuildCount = 0;
    this.dirty = true;
    this.connections = new Map();
  }

  invalidateTopology() {
    this.revision += 1;
    this.dirty = true;
  }

  rebuild({ structures = [], economicNodes = [], tradeRoutes = [], players = [] } = {}) {
    if (!this.dirty) return false;
    const playerById = new Map(players.map(player => [player.id, player]));
    const nodes = structures.filter(item => item.alive !== false && item.progress >= 1).map(item => ({
      id: item.id,
      x: item.x,
      y: item.y,
      faction: item.faction,
      hub: ["outpost", "warehouse", "supplydepot"].includes(item.type),
      reach: Number(item.supplyRadius) || this.defaultReach,
      risk: Number(item.routeRisk) || 0
    }));
    for (const item of economicNodes.filter(item => item.active !== false && item.owner)) nodes.push({
      id: item.id,
      x: item.x ?? item.position?.x,
      y: item.y ?? item.position?.y,
      faction: item.owner,
      hub: true,
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
      for (const faction of byFaction.keys()) {
        if (route.allowedFactions?.length && !route.allowedFactions.includes(faction)) continue;
        const candidates = byFaction.get(faction);
        const endpoints = [points[0], points.at(-1)].filter(Boolean).map(point => candidates.slice().sort((a, b) => distance(a, point) - distance(b, point))[0]);
        if (endpoints.length === 2 && endpoints[0]?.id !== endpoints[1]?.id) routedPairs.add(`${faction}:${endpoints[0].id}:${endpoints[1].id}`);
      }
    }
    this.connections.clear();
    for (const [faction, factionNodes] of byFaction) {
      const adjacency = new Map(factionNodes.map(node => [node.id, []]));
      for (let i = 0; i < factionNodes.length; i += 1) for (let j = i + 1; j < factionNodes.length; j += 1) {
        const a = factionNodes[i];
        const b = factionNodes[j];
        const authored = routedPairs.has(`${faction}:${a.id}:${b.id}`) || routedPairs.has(`${faction}:${b.id}:${a.id}`);
        const length = distance(a, b);
        if (!authored && length > Math.max(a.reach, b.reach, this.defaultReach)) continue;
        const cost = length * (authored ? 0.65 : 1);
        adjacency.get(a.id).push({ id: b.id, cost, risk: Math.max(a.risk, b.risk) });
        adjacency.get(b.id).push({ id: a.id, cost, risk: Math.max(a.risk, b.risk) });
      }
      const hubs = factionNodes.filter(node => node.hub || playerById.get(faction)?.base && distance(node, playerById.get(faction).base) < 80);
      const frontier = hubs.map(node => ({ node, cost: 0, risk: node.risk, path: [node.id] }));
      const best = new Map(frontier.map(item => [item.node.id, item]));
      while (frontier.length) {
        frontier.sort((a, b) => a.cost - b.cost);
        const current = frontier.shift();
        for (const edge of adjacency.get(current.node.id) || []) {
          const cost = current.cost + edge.cost;
          if (best.has(edge.id) && best.get(edge.id).cost <= cost) continue;
          const next = { node: factionNodes.find(node => node.id === edge.id), cost, risk: Math.max(current.risk, edge.risk), path: [...current.path, edge.id] };
          best.set(edge.id, next);
          frontier.push(next);
        }
      }
      for (const node of factionNodes) {
        const route = best.get(node.id);
        const throughput = route ? Math.max(0.2, 1 - route.cost / 2400) * Math.max(0.2, 1 - route.risk) : 0;
        this.connections.set(node.id, Object.freeze({
          connected: Boolean(route),
          hub: Boolean(node.hub),
          pathCost: route?.cost ?? Infinity,
          throughput,
          bottleneck: route ? throughput : 0,
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
    return this.connections.get(id) || Object.freeze({ connected: false, hub: false, pathCost: Infinity, throughput: 0, bottleneck: 0, risk: 1, path: Object.freeze([]), lastChanged: this.revision });
  }
}
