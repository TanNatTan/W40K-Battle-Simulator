import { EXTRACTABLE_RESOURCE_IDS } from "./ResourceCatalog.js";

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const RESOURCE_TYPES = EXTRACTABLE_RESOURCE_IDS;

function calculateResourceZoneGeometry(points = []) {
  if (points.length < 3) {
    const point = points[0] || { x: 0, y: 0 };
    return { center: { x: Number(point.x) || 0, y: Number(point.y) || 0 }, bounds: { left: 0, top: 0, right: 0, bottom: 0 }, area: 0 };
  }
  let signedArea = 0;
  let centroidX = 0;
  let centroidY = 0;
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    signedArea += cross;
    centroidX += (current.x + next.x) * cross;
    centroidY += (current.y + next.y) * cross;
    left = Math.min(left, current.x);
    right = Math.max(right, current.x);
    top = Math.min(top, current.y);
    bottom = Math.max(bottom, current.y);
  }
  const area = signedArea / 2;
  const divisor = signedArea * 3;
  const center = Math.abs(area) > 0.0001
    ? { x: centroidX / divisor, y: centroidY / divisor }
    : { x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length };
  return { center, bounds: { left, top, right, bottom }, area: Math.abs(area) };
}

export function resourceZoneCenter(zone) {
  if (zone?.geometry?.revision === zone?.geometryRevision) return zone.geometry.interactionPoint || zone.geometry.center;
  const points = zone?.points || [];
  if (!points.length) return { x: Number(zone?.x) || 0, y: Number(zone?.y) || 0 };
  return calculateResourceZoneGeometry(points).center;
}

export function touchResourceZoneGeometry(zone) {
  zone.geometryRevision = Math.max(0, Number(zone.geometryRevision) || 0) + 1;
  return syncResourceZone(zone);
}

export function pointInResourceZone(point, zone) {
  if (!zone?.points || zone.points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = zone.points.length - 1; i < zone.points.length; j = i, i += 1) {
    const a = zone.points[i];
    const b = zone.points[j];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 0.0001) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function createResourceZone(id, center, overrides = {}) {
  const radius = Number(overrides.radius) || 46;
  const points = overrides.points?.length ? overrides.points.map(point => ({ x: Number(point.x), y: Number(point.y) })) : [
    { x: center.x - radius, y: center.y - radius },
    { x: center.x + radius, y: center.y - radius },
    { x: center.x + radius, y: center.y + radius },
    { x: center.x - radius, y: center.y + radius }
  ];
  const capacity = Math.max(0, Number(overrides.capacity) || 600);
  const remaining = clamp(Number(overrides.remaining ?? overrides.reserve ?? capacity), 0, capacity);
  const zone = {
    id,
    name: overrides.name || `Resource Zone ${id}`,
    resourceType: RESOURCE_TYPES.includes(overrides.resourceType) ? overrides.resourceType : "materials",
    points,
    geometryRevision: Math.max(1, Number(overrides.geometryRevision) || 1),
    geometry: overrides.interactionPoint ? { revision: -1, interactionPoint: { x: Number(overrides.interactionPoint.x) || 0, y: Number(overrides.interactionPoint.y) || 0 } } : null,
    capacity,
    infinite: Boolean(overrides.infinite),
    remaining,
    reserve: remaining,
    maxReserve: capacity,
    gatherRate: Math.max(0, Number(overrides.gatherRate) || 8),
    regeneration: Math.max(0, Number(overrides.regeneration) || 0),
    startingOwner: overrides.startingOwner || "",
    owner: overrides.owner ?? overrides.startingOwner ?? "",
    requiresBuilding: overrides.requiresBuilding !== false,
    allowedCollectors: Array.isArray(overrides.allowedCollectors) && overrides.allowedCollectors.length ? [...overrides.allowedCollectors] : ["builder", "supply"],
    richness: clamp(Number(overrides.richness) || 1, 0.1, 3),
    strategicObjective: Boolean(overrides.strategicObjective),
    exhaustionReported: Boolean(overrides.exhaustionReported),
    resourceZone: true
  };
  return syncResourceZone(zone);
}

export function syncResourceZone(zone) {
  zone.allowedCollectors = [...new Set((Array.isArray(zone.allowedCollectors) && zone.allowedCollectors.length
    ? zone.allowedCollectors : ["builder", "supply"]).filter(role => ["builder", "supply", "vehicle"].includes(role)))];
  if (zone.allowedCollectors.includes("vehicle") && !zone.allowedCollectors.includes("supply")) zone.allowedCollectors.push("supply");
  if (zone.geometry?.revision !== zone.geometryRevision) {
    const interactionPoint = zone.geometry?.interactionPoint ? { ...zone.geometry.interactionPoint } : null;
    const geometry = calculateResourceZoneGeometry(zone.points);
    zone.geometry = { ...geometry, interactionPoint, revision: zone.geometryRevision };
  }
  const center = zone.geometry.interactionPoint || zone.geometry.center;
  zone.x = center.x;
  zone.y = center.y;
  zone.maxReserve = Math.max(0, Number(zone.capacity) || 0);
  zone.remaining = clamp(Number(zone.remaining ?? zone.reserve) || 0, 0, zone.maxReserve);
  zone.reserve = zone.remaining;
  zone.resourceZone = true;
  return zone;
}

export function regenerateResourceZone(zone, dt) {
  zone.maxReserve = Math.max(0, Number(zone.capacity) || 0);
  zone.remaining = clamp(Number(zone.remaining ?? zone.reserve) || 0, 0, zone.maxReserve);
  if (zone.infinite) return 0;
  if (zone.regeneration <= 0 || zone.remaining >= zone.capacity) return 0;
  const amount = Math.min(zone.capacity - zone.remaining, zone.regeneration * dt);
  zone.remaining += amount;
  zone.reserve = zone.remaining;
  if (zone.remaining > 0) zone.exhaustionReported = false;
  return amount;
}

export function drainResourceZone(zone, requested) {
  zone.maxReserve = Math.max(0, Number(zone.capacity) || 0);
  zone.remaining = clamp(Number(zone.remaining ?? zone.reserve) || 0, 0, zone.maxReserve);
  const amount = Math.min(zone.remaining, Math.max(0, requested), zone.gatherRate);
  if (zone.infinite) return Math.min(Math.max(0, requested), zone.gatherRate);
  zone.remaining -= amount;
  zone.reserve = zone.remaining;
  return amount;
}

export function serializeResourceZone(zone, scaleX = 1, scaleY = 1) {
  return {
    id: zone.id,
    name: zone.name,
    resourceType: zone.resourceType,
    capacity: zone.capacity,
    infinite: Boolean(zone.infinite),
    remaining: zone.remaining,
    gatherRate: zone.gatherRate,
    regeneration: zone.regeneration,
    startingOwner: zone.startingOwner,
    owner: zone.owner,
    requiresBuilding: zone.requiresBuilding,
    allowedCollectors: [...zone.allowedCollectors],
    richness: zone.richness,
    strategicObjective: zone.strategicObjective,
    geometryRevision: zone.geometryRevision,
    interactionPoint: zone.geometry?.interactionPoint ? { x: zone.geometry.interactionPoint.x * scaleX, y: zone.geometry.interactionPoint.y * scaleY } : null,
    points: zone.points.map(point => ({ x: point.x * scaleX, y: point.y * scaleY }))
  };
}
