const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

export const ECONOMIC_NODE_TYPES = Object.freeze([
  "hive-city", "manufactorum", "mechanicus-enclave", "agri-complex", "mining-colony",
  "fuel-refinery", "space-port", "civilian-settlement", "orbital-elevator",
  "fortress-monastery", "supply-depot", "forward-operating-base"
]);

export const TRADE_ROUTE_TYPES = Object.freeze(["road", "rail", "sea", "river", "air", "orbital", "underground", "warp"]);

export const ECONOMY_OVERLAY_GROUPS = Object.freeze({
  food: ["food", "biomass"],
  fuel: ["fuel"],
  energy: ["energy"],
  minerals: ["materials", "scrap"],
  requisition: ["requisition", "influence"],
  medical: ["medical"]
});

export const NODE_DEFAULTS = Object.freeze({
  "hive-city": { exports: { food: 8, requisition: 14, influence: 4 }, imports: { fuel: 8, medical: 5, ammunition: 3 } },
  manufactorum: { exports: { materials: 12, parts: 8, ammunition: 7 }, imports: { energy: 8, fuel: 6, food: 3 } },
  "mechanicus-enclave": { exports: { energy: 10, parts: 9, influence: 4 }, imports: { materials: 7, fuel: 4 } },
  "agri-complex": { exports: { food: 16, medical: 4 }, imports: { fuel: 5, energy: 3 } },
  "mining-colony": { exports: { materials: 18, scrap: 5 }, imports: { food: 5, fuel: 6, medical: 2 } },
  "fuel-refinery": { exports: { fuel: 16, energy: 5 }, imports: { materials: 4, parts: 3 } },
  "space-port": { exports: { requisition: 8, fuel: 5 }, imports: { food: 4, ammunition: 4 } },
  "civilian-settlement": { exports: { food: 6, requisition: 4 }, imports: { medical: 4, security: 5 } },
  "orbital-elevator": { exports: { requisition: 12, materials: 6 }, imports: { energy: 7, security: 6 } },
  "fortress-monastery": { exports: { security: 12, ammunition: 5 }, imports: { food: 4, fuel: 5, medical: 3 } },
  "supply-depot": { exports: { ammunition: 8, food: 5, medical: 4 }, imports: { fuel: 3, materials: 3 } },
  "forward-operating-base": { exports: { security: 7 }, imports: { ammunition: 6, food: 4, medical: 4, fuel: 3 } }
});

function cleanResourceMap(value = {}) {
  return Object.fromEntries(Object.entries(value)
    .map(([resource, amount]) => [String(resource).trim().toLowerCase(), Math.max(0, Number(amount) || 0)])
    .filter(([resource, amount]) => resource && amount > 0));
}

export function parseResourceMap(text = "") {
  if (typeof text === "object" && text) return cleanResourceMap(text);
  const entries = String(text).split(",").map(item => item.trim()).filter(Boolean).map(item => {
    const [resource, amount = "1"] = item.split(":");
    return [resource, amount];
  });
  return cleanResourceMap(Object.fromEntries(entries));
}

export function formatResourceMap(resources = {}) {
  return Object.entries(resources).map(([resource, amount]) => `${resource}:${amount}`).join(", ");
}

export function createEconomicNode(id, point, overrides = {}) {
  const type = ECONOMIC_NODE_TYPES.includes(overrides.type) ? overrides.type : "hive-city";
  const defaults = NODE_DEFAULTS[type];
  return {
    id,
    name: overrides.name || type.split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" "),
    type,
    x: Number(overrides.x ?? point?.x) || 0,
    y: Number(overrides.y ?? point?.y) || 0,
    startingOwner: overrides.startingOwner || "",
    owner: overrides.owner ?? overrides.startingOwner ?? "",
    exports: cleanResourceMap(overrides.exports || defaults.exports),
    imports: cleanResourceMap(overrides.imports || defaults.imports),
    capacity: Math.max(1, Number(overrides.capacity) || 1000),
    strategicValue: clamp(overrides.strategicValue ?? 70, 0, 100),
    active: overrides.active !== false,
    authored: true
  };
}

export function createTradeRoute(id, overrides = {}) {
  const type = TRADE_ROUTE_TYPES.includes(overrides.type) ? overrides.type : "road";
  return {
    id,
    name: overrides.name || `Trade Route ${id}`,
    type,
    fromNodeId: overrides.fromNodeId || "",
    toNodeId: overrides.toNodeId || "",
    points: (overrides.points || []).map(point => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 })),
    capacity: Math.max(1, Number(overrides.capacity) || 100),
    resources: Array.isArray(overrides.resources) ? [...new Set(overrides.resources.map(String))] : [],
    allowedFactions: Array.isArray(overrides.allowedFactions) && overrides.allowedFactions.length ? [...new Set(overrides.allowedFactions.map(String))] : ["*"],
    roadRequired: Boolean(overrides.roadRequired),
    bidirectional: overrides.bidirectional !== false,
    active: overrides.active !== false,
    authored: true,
    nextDispatch: Number(overrides.nextDispatch) || 0,
    aiUsage: { ...(overrides.aiUsage || {}) }
  };
}

export function routeIsAuthoredAndComplete(route, nodes = []) {
  const nodeIds = new Set(nodes.map(node => node.id));
  return Boolean(route?.authored && route.active && nodeIds.has(route.fromNodeId) && nodeIds.has(route.toNodeId) && route.fromNodeId !== route.toNodeId && route.points?.length >= 2);
}

export function factionCanUseRoute(route, player = {}) {
  const allowed = route?.allowedFactions || ["*"];
  return allowed.includes("*") || allowed.some(value => [player.id, player.race, player.faction, player.subfaction].includes(value));
}

function routeTypePreference(player, type) {
  const faction = `${player.race || ""} ${player.faction || ""}`.toLowerCase();
  if (faction.includes("space marine")) return ["air", "orbital"].includes(type) ? 1.24 : type === "warp" ? 0.35 : 1;
  if (faction.includes("imperial guard")) return ["road", "rail"].includes(type) ? 1.24 : type === "orbital" ? 0.72 : 0.9;
  if (faction.includes("chaos")) return type === "warp" ? 1.4 : type === "orbital" ? 0.65 : 1;
  if (faction.includes("ork")) return ["road", "river"].includes(type) ? 1.2 : type === "orbital" ? 0.55 : 0.88;
  if (faction.includes("necron")) return ["underground", "orbital"].includes(type) ? 1.32 : 0.9;
  if (faction.includes("tau")) return ["air", "orbital", "road"].includes(type) ? 1.2 : type === "warp" ? 0.2 : 0.86;
  if (faction.includes("tyranid")) return ["underground", "air"].includes(type) ? 1.25 : type === "rail" ? 0.5 : 0.9;
  return 1;
}

export function scoreAuthoredTradeRoute(route, nodes, player, context = {}) {
  if (!routeIsAuthoredAndComplete(route, nodes) || !factionCanUseRoute(route, player)) return { score: -Infinity, action: "unavailable" };
  const authoredFrom = nodes.find(node => node.id === route.fromNodeId);
  const authoredTo = nodes.find(node => node.id === route.toNodeId);
  const shortageSet = new Set(context.shortages || []);
  const directions = [[authoredFrom, authoredTo], ...(route.bidirectional ? [[authoredTo, authoredFrom]] : [])];
  const [from, to, relevant, shortageValue] = directions.map(([origin, destination]) => {
    const resources = Object.keys(origin?.exports || {}).filter(resource => !route.resources.length || route.resources.includes(resource));
    const value = resources.reduce((sum, resource) => sum + (shortageSet.has(resource) ? 32 : 7), 0);
    return [origin, destination, resources, value];
  }).sort((a, b) => b[3] - a[3])[0];
  const ownership = [from?.owner, to?.owner].filter(Boolean).includes(player.id) ? 24 : 0;
  const danger = clamp(context.danger ?? 0, 0, 1);
  const blocked = Boolean(context.blocked);
  const score = (shortageValue + ownership + route.capacity * 0.08) * routeTypePreference(player, route.type) - danger * 38 - (blocked ? 42 : 0);
  const action = blocked ? (score > 5 ? "reroute" : "abandon") : danger > 0.65 ? "defend" : score > 18 ? "use" : "abandon";
  return { score, action, from, to, relevantResources: relevant };
}

export function serializeEconomicNode(node, scaleX = 1, scaleY = 1) {
  return { ...node, x: node.x * scaleX, y: node.y * scaleY, exports: { ...node.exports }, imports: { ...node.imports } };
}

export function serializeTradeRoute(route, scaleX = 1, scaleY = 1) {
  return { ...route, points: route.points.map(point => ({ x: point.x * scaleX, y: point.y * scaleY })), resources: [...route.resources], allowedFactions: [...route.allowedFactions], aiUsage: {} };
}
