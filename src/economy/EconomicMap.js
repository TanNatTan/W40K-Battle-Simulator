import { RESOURCE_DEFINITIONS, RESOURCE_IDS, isKnownResource, normalizeResourceId } from "./ResourceCatalog.js";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

export const ECONOMIC_NODE_TYPES = Object.freeze([
  "hive-city", "manufactorum", "mechanicus-enclave", "agri-complex", "mining-colony",
  "fuel-refinery", "space-port", "civilian-settlement", "orbital-elevator",
  "fortress-monastery", "supply-depot", "forward-operating-base"
]);

export const TRADE_ROUTE_TYPES = Object.freeze(["road", "rail", "sea", "river", "air", "orbital", "underground", "warp"]);
export const RESOURCE_FLOW_DIRECTIONS = Object.freeze(["produce", "consume"]);

export const ECONOMY_OVERLAY_GROUPS = Object.freeze({
  food: ["food", "biomass"],
  fuel: ["fuel"],
  energy: ["energy"],
  minerals: ["materials", "scrap"],
  requisition: ["requisition", "influence"],
  medical: ["medical"]
});

const flow = (resource, direction, rate, enabled = true) => Object.freeze({ resource, direction, rate, enabled });

export const LANDMARK_TYPE_DEFINITIONS = Object.freeze({
  "hive-city": Object.freeze({ capacity: 2400, strategicValue: 92, tags: ["population-center", "command", "trade-hub"], routeTypes: ["road", "rail", "air", "orbital"], flows: [flow("requisition", "produce", 22), flow("influence", "produce", 8), flow("food", "produce", 8), flow("fuel", "consume", 12), flow("energy", "consume", 10), flow("medical", "consume", 9), flow("ammunition", "consume", 8), flow("security", "consume", 10)] }),
  manufactorum: Object.freeze({ capacity: 1900, strategicValue: 88, tags: ["industry", "production", "trade-hub"], routeTypes: ["road", "rail", "orbital"], flows: [flow("materials", "produce", 18), flow("parts", "produce", 14), flow("ammunition", "produce", 12), flow("energy", "consume", 13), flow("fuel", "consume", 10), flow("food", "consume", 5)] }),
  "mechanicus-enclave": Object.freeze({ capacity: 1700, strategicValue: 90, tags: ["technology", "repair", "energy"], routeTypes: ["road", "rail", "air", "orbital"], flows: [flow("energy", "produce", 16), flow("parts", "produce", 14), flow("influence", "produce", 7), flow("materials", "consume", 11), flow("fuel", "consume", 7)] }),
  "agri-complex": Object.freeze({ capacity: 1800, strategicValue: 74, tags: ["agriculture", "population-support"], routeTypes: ["road", "rail", "river", "air"], flows: [flow("food", "produce", 28), flow("medical", "produce", 9), flow("fuel", "consume", 7), flow("energy", "consume", 5), flow("security", "consume", 4)] }),
  "mining-colony": Object.freeze({ capacity: 2100, strategicValue: 80, tags: ["extraction", "industry"], routeTypes: ["road", "rail", "underground"], flows: [flow("materials", "produce", 26), flow("scrap", "produce", 9), flow("food", "consume", 7), flow("fuel", "consume", 9), flow("medical", "consume", 4)] }),
  "fuel-refinery": Object.freeze({ capacity: 2200, strategicValue: 91, tags: ["fuel", "energy", "hazardous"], routeTypes: ["road", "rail", "river", "sea"], flows: [flow("fuel", "produce", 30), flow("energy", "produce", 9), flow("materials", "consume", 7), flow("parts", "consume", 6), flow("security", "consume", 4)] }),
  "space-port": Object.freeze({ capacity: 2000, strategicValue: 93, tags: ["trade-hub", "reinforcement", "extraction"], routeTypes: ["road", "rail", "air", "orbital"], flows: [flow("requisition", "produce", 15), flow("influence", "produce", 6), flow("fuel", "produce", 9), flow("food", "consume", 7), flow("ammunition", "consume", 7), flow("security", "consume", 8)] }),
  "civilian-settlement": Object.freeze({ capacity: 1100, strategicValue: 55, tags: ["population-center", "trade"], routeTypes: ["road", "river", "air"], flows: [flow("food", "produce", 9), flow("requisition", "produce", 7), flow("influence", "produce", 3), flow("medical", "consume", 6), flow("security", "consume", 8), flow("energy", "consume", 4)] }),
  "orbital-elevator": Object.freeze({ capacity: 2600, strategicValue: 98, tags: ["trade-hub", "orbital", "reinforcement", "extraction"], routeTypes: ["road", "rail", "air", "orbital"], flows: [flow("requisition", "produce", 20), flow("materials", "produce", 12), flow("parts", "produce", 6), flow("energy", "consume", 12), flow("security", "consume", 10), flow("fuel", "consume", 6)] }),
  "fortress-monastery": Object.freeze({ capacity: 1800, strategicValue: 96, tags: ["command", "fortress", "military"], routeTypes: ["road", "air", "orbital"], flows: [flow("security", "produce", 20), flow("ammunition", "produce", 12), flow("influence", "produce", 7), flow("food", "consume", 7), flow("fuel", "consume", 8), flow("medical", "consume", 6), flow("materials", "consume", 5)] }),
  "supply-depot": Object.freeze({ capacity: 3000, strategicValue: 86, tags: ["trade-hub", "storage", "logistics"], routeTypes: ["road", "rail", "air", "river", "sea"], flows: [flow("ammunition", "produce", 18), flow("food", "produce", 13), flow("medical", "produce", 11), flow("fuel", "produce", 10), flow("parts", "produce", 8), flow("materials", "consume", 7), flow("energy", "consume", 5), flow("security", "consume", 5)] }),
  "forward-operating-base": Object.freeze({ capacity: 950, strategicValue: 76, tags: ["military", "logistics", "forward-base"], routeTypes: ["road", "air", "underground"], flows: [flow("security", "produce", 12), flow("ammunition", "produce", 6), flow("ammunition", "consume", 9), flow("food", "consume", 6), flow("medical", "consume", 6), flow("fuel", "consume", 5)] })
});

export const NODE_DEFAULTS = Object.freeze(Object.fromEntries(Object.entries(LANDMARK_TYPE_DEFINITIONS).map(([type, definition]) => {
  const maps = resourceMapsFromFlows(definition.flows);
  return [type, Object.freeze({ exports: Object.freeze(maps.exports), imports: Object.freeze(maps.imports) })];
})));

function cleanResourceMap(value = {}) {
  const result = {};
  for (const [rawResource, rawAmount] of Object.entries(value || {})) {
    const resource = normalizeResourceId(rawResource);
    const amount = Math.max(0, Number(rawAmount) || 0);
    if (resource && amount > 0) result[resource] = amount;
  }
  return result;
}

export function parseResourceMap(text = "") {
  if (typeof text === "object" && text) return cleanResourceMap(text);
  const result = {};
  for (const item of String(text).split(",")) {
    const [rawResource, rawAmount = "1"] = item.trim().split(":");
    const resource = normalizeResourceId(rawResource);
    const amount = Math.max(0, Number(rawAmount) || 0);
    if (resource && amount > 0) result[resource] = amount;
  }
  return result;
}

export function formatResourceMap(resources = {}) {
  return Object.entries(cleanResourceMap(resources)).map(([resource, amount]) => `${resource}:${amount}`).join(", ");
}

export function normalizeResourceFlows(flows = []) {
  const result = [];
  for (const candidate of Array.isArray(flows) ? flows : []) {
    const resource = normalizeResourceId(candidate?.resource);
    const direction = RESOURCE_FLOW_DIRECTIONS.includes(candidate?.direction) ? candidate.direction : null;
    const rate = Math.max(0, Number(candidate?.rate) || 0);
    if (!resource || !direction || rate <= 0) continue;
    result.push({ resource, direction, rate, enabled: candidate.enabled !== false });
  }
  return result;
}

export function resourceFlowsFromMaps(exports = {}, imports = {}) {
  return [
    ...Object.entries(cleanResourceMap(exports)).map(([resource, rate]) => ({ resource, direction: "produce", rate, enabled: true })),
    ...Object.entries(cleanResourceMap(imports)).map(([resource, rate]) => ({ resource, direction: "consume", rate, enabled: true }))
  ];
}

export function resourceMapsFromFlows(flows = []) {
  const exports = {};
  const imports = {};
  for (const item of normalizeResourceFlows(flows)) {
    if (!item.enabled) continue;
    const target = item.direction === "produce" ? exports : imports;
    target[item.resource] = (target[item.resource] || 0) + item.rate;
  }
  return { exports, imports };
}

export function flowsForLandmarkType(type) {
  const definition = LANDMARK_TYPE_DEFINITIONS[ECONOMIC_NODE_TYPES.includes(type) ? type : "hive-city"];
  return definition.flows.map(item => ({ ...item }));
}

export function syncEconomicNodeResources(node) {
  node.flows = normalizeResourceFlows(node.flows);
  const maps = resourceMapsFromFlows(node.flows);
  node.exports = maps.exports;
  node.imports = maps.imports;
  return node;
}

export function createEconomicNode(id, point, overrides = {}) {
  const type = ECONOMIC_NODE_TYPES.includes(overrides.type) ? overrides.type : "hive-city";
  const definition = LANDMARK_TYPE_DEFINITIONS[type];
  const nestedEconomy = overrides.economy || {};
  const nestedPosition = overrides.position || {};
  const nestedOwnership = overrides.ownership || {};
  const nestedStrategic = overrides.strategic || {};
  const hasExplicitFlows = Array.isArray(overrides.flows) || Array.isArray(nestedEconomy.flows);
  const hasLegacyMaps = overrides.exports || overrides.imports;
  const flows = hasExplicitFlows
    ? normalizeResourceFlows(overrides.flows || nestedEconomy.flows)
    : hasLegacyMaps
      ? resourceFlowsFromMaps(overrides.exports, overrides.imports)
      : flowsForLandmarkType(type);
  const node = {
    id,
    schemaVersion: 2,
    name: overrides.name || type.split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" "),
    type,
    x: Number(overrides.x ?? nestedPosition.x ?? point?.x) || 0,
    y: Number(overrides.y ?? nestedPosition.y ?? point?.y) || 0,
    startingOwner: overrides.startingOwner ?? nestedOwnership.startingOwner ?? "",
    owner: overrides.owner ?? nestedOwnership.owner ?? overrides.startingOwner ?? nestedOwnership.startingOwner ?? "",
    flows,
    useTypeDefaults: overrides.useTypeDefaults ?? (!hasExplicitFlows && !hasLegacyMaps),
    capacity: Math.max(1, Number(overrides.capacity ?? nestedEconomy.capacity) || definition.capacity),
    strategicValue: clamp(overrides.strategicValue ?? nestedStrategic.value ?? definition.strategicValue, 0, 100),
    strategicObjective: overrides.strategicObjective ?? nestedStrategic.enabled ?? true,
    tags: [...new Set((overrides.tags || nestedStrategic.tags || definition.tags).map(String))],
    allowedRouteTypes: [...new Set((overrides.allowedRouteTypes || definition.routeTypes).filter(type => TRADE_ROUTE_TYPES.includes(type)))],
    active: overrides.active !== false,
    authored: true
  };
  return syncEconomicNodeResources(node);
}

export function validateEconomicNode(node) {
  const errors = [];
  const warnings = [];
  if (!String(node?.id || "").trim()) errors.push("Landmark ID is required.");
  if (!ECONOMIC_NODE_TYPES.includes(node?.type)) errors.push("Unknown landmark type.");
  if (!Number.isFinite(Number(node?.x)) || !Number.isFinite(Number(node?.y))) errors.push("Landmark position must be finite.");
  if (!Number.isFinite(Number(node?.capacity)) || Number(node.capacity) <= 0) errors.push("Capacity must be greater than zero.");
  if (!Number.isFinite(Number(node?.strategicValue)) || node.strategicValue < 0 || node.strategicValue > 100) errors.push("Strategic value must be between 0 and 100.");
  for (const candidate of node?.flows || []) {
    if (!isKnownResource(candidate.resource)) errors.push(`Unknown resource: ${candidate.resource || "empty"}.`);
    if (!RESOURCE_FLOW_DIRECTIONS.includes(candidate.direction)) errors.push(`Unknown flow direction: ${candidate.direction || "empty"}.`);
    if (!Number.isFinite(Number(candidate.rate)) || Number(candidate.rate) <= 0) errors.push("Resource flow rates must be greater than zero.");
  }
  const activeFlows = normalizeResourceFlows(node?.flows).filter(item => item.enabled);
  for (const resource of RESOURCE_IDS) {
    if (activeFlows.some(item => item.resource === resource && item.direction === "produce")
      && activeFlows.some(item => item.resource === resource && item.direction === "consume")) {
      warnings.push(`${RESOURCE_DEFINITIONS[resource].name} is both produced and consumed.`);
    }
  }
  if (node?.strategicObjective && Number(node?.strategicValue) === 0) warnings.push("Strategic objective has zero value.");
  return { valid: errors.length === 0, errors, warnings };
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
    resources: Array.isArray(overrides.resources) ? [...new Set(overrides.resources.map(String).filter(isKnownResource))] : [],
    allowedFactions: Array.isArray(overrides.allowedFactions) && overrides.allowedFactions.length ? [...new Set(overrides.allowedFactions.map(String))] : ["*"],
    roadRequired: Boolean(overrides.roadRequired),
    bidirectional: overrides.bidirectional !== false,
    active: overrides.active !== false,
    authored: true,
    nextDispatch: Number(overrides.nextDispatch) || 0,
    aiUsage: { ...(overrides.aiUsage || {}) }
  };
}

function nodeMapFor(nodes) {
  return nodes instanceof Map ? nodes : new Map((nodes || []).map(node => [node.id, node]));
}

export function routeIsAuthoredAndComplete(route, nodes = []) {
  const byId = nodeMapFor(nodes);
  return Boolean(route?.authored && route.active && byId.has(route.fromNodeId) && byId.has(route.toNodeId) && route.fromNodeId !== route.toNodeId && route.points?.length >= 2);
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

function routeDirectionValue(origin, route, shortages) {
  let shortageValue = 0;
  const relevantResources = [];
  for (const resource of Object.keys(origin?.exports || {})) {
    if (route.resources.length && !route.resources.includes(resource)) continue;
    relevantResources.push(resource);
    shortageValue += shortages.has(resource) ? 32 : 7;
  }
  return { shortageValue, relevantResources };
}

export function scoreAuthoredTradeRoute(route, nodes, player, context = {}) {
  const byId = nodeMapFor(nodes);
  if (!routeIsAuthoredAndComplete(route, byId) || !factionCanUseRoute(route, player)) return { score: -Infinity, action: "unavailable" };
  const authoredFrom = byId.get(route.fromNodeId);
  const authoredTo = byId.get(route.toNodeId);
  const shortages = new Set(context.shortages || []);
  let from = authoredFrom;
  let to = authoredTo;
  let direction = routeDirectionValue(from, route, shortages);
  if (route.bidirectional) {
    const reverse = routeDirectionValue(authoredTo, route, shortages);
    if (reverse.shortageValue > direction.shortageValue) {
      from = authoredTo;
      to = authoredFrom;
      direction = reverse;
    }
  }
  const ownership = from?.owner === player.id || to?.owner === player.id ? 24 : 0;
  const danger = clamp(context.danger ?? 0, 0, 1);
  const blocked = Boolean(context.blocked);
  const score = (direction.shortageValue + ownership + route.capacity * 0.08) * routeTypePreference(player, route.type) - danger * 38 - (blocked ? 42 : 0);
  const action = blocked ? (score > 5 ? "reroute" : "abandon") : danger > 0.65 ? "defend" : score > 18 ? "use" : "abandon";
  return { score, action, from, to, relevantResources: direction.relevantResources };
}

export function serializeEconomicNode(node, scaleX = 1, scaleY = 1) {
  syncEconomicNodeResources(node);
  return {
    id: node.id,
    schemaVersion: 2,
    name: node.name,
    type: node.type,
    position: { x: node.x * scaleX, y: node.y * scaleY, space: "world" },
    ownership: { startingOwner: node.startingOwner || "", owner: node.owner || "" },
    strategic: { enabled: node.strategicObjective !== false, value: node.strategicValue, tags: [...(node.tags || [])] },
    economy: { capacity: node.capacity, flows: normalizeResourceFlows(node.flows) },
    allowedRouteTypes: [...(node.allowedRouteTypes || [])],
    useTypeDefaults: Boolean(node.useTypeDefaults),
    active: node.active !== false,
    authored: true
  };
}

export function serializeTradeRoute(route, scaleX = 1, scaleY = 1) {
  return { ...route, points: route.points.map(point => ({ x: point.x * scaleX, y: point.y * scaleY })), resources: [...route.resources], allowedFactions: [...route.allowedFactions], aiUsage: {} };
}
