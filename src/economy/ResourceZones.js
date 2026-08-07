const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const RESOURCE_TYPES = Object.freeze([
  "requisition",
  "materials",
  "fuel",
  "energy",
  "ammunition",
  "medical",
  "food",
  "faith",
  "influence",
  "scrap",
  "biomass"
]);

export function resourceZoneCenter(zone) {
  const points = zone?.points || [];
  if (!points.length) return { x: Number(zone?.x) || 0, y: Number(zone?.y) || 0 };
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
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
    allowedCollectors: Array.isArray(overrides.allowedCollectors) && overrides.allowedCollectors.length ? [...overrides.allowedCollectors] : ["builder", "vehicle"],
    richness: clamp(Number(overrides.richness) || 1, 0.1, 3),
    strategicObjective: Boolean(overrides.strategicObjective),
    exhaustionReported: Boolean(overrides.exhaustionReported),
    resourceZone: true
  };
  Object.assign(zone, resourceZoneCenter(zone));
  return zone;
}

export function syncResourceZone(zone) {
  const center = resourceZoneCenter(zone);
  zone.x = center.x;
  zone.y = center.y;
  zone.maxReserve = Math.max(0, Number(zone.capacity) || 0);
  zone.remaining = clamp(Number(zone.remaining ?? zone.reserve) || 0, 0, zone.maxReserve);
  zone.reserve = zone.remaining;
  zone.resourceZone = true;
  return zone;
}

export function regenerateResourceZone(zone, dt) {
  syncResourceZone(zone);
  if (zone.infinite) return 0;
  if (zone.regeneration <= 0 || zone.remaining >= zone.capacity) return 0;
  const amount = Math.min(zone.capacity - zone.remaining, zone.regeneration * dt);
  zone.remaining += amount;
  zone.reserve = zone.remaining;
  if (zone.remaining > 0) zone.exhaustionReported = false;
  return amount;
}

export function drainResourceZone(zone, requested) {
  syncResourceZone(zone);
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
    points: zone.points.map(point => ({ x: point.x * scaleX, y: point.y * scaleY }))
  };
}
