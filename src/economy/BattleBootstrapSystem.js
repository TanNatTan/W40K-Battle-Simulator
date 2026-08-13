const polygonCentroid = points => {
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    twiceArea += cross;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }
  if (Math.abs(twiceArea) < 1e-9) return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
  return { x: x / (3 * twiceArea), y: y / (3 * twiceArea) };
};

const pointInPolygon = (point, polygon) => {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside;
  }
  return inside;
};

function footprintCorners(point, hitbox = {}) {
  const halfWidth = Math.max(0, Number(hitbox.w) || 0) * 0.5;
  const halfHeight = Math.max(0, Number(hitbox.h) || 0) * 0.5;
  return [
    { x: point.x - halfWidth, y: point.y - halfHeight },
    { x: point.x + halfWidth, y: point.y - halfHeight },
    { x: point.x + halfWidth, y: point.y + halfHeight },
    { x: point.x - halfWidth, y: point.y + halfHeight }
  ];
}

export function pointFitsSpawnZone(point, player = {}, hitbox = {}) {
  const zone = player.spawnZone || {};
  const center = { x: Number(player.base?.x) || 0, y: Number(player.base?.y) || 0 };
  const corners = footprintCorners(point, hitbox);
  if (zone.shape === "custom" && Array.isArray(zone.points) && zone.points.length >= 3) {
    return corners.every(corner => pointInPolygon(corner, zone.points));
  }
  if (zone.shape === "square") {
    const size = Math.max(1, Number(zone.size) || 84);
    return corners.every(corner => Math.abs(corner.x - center.x) <= size && Math.abs(corner.y - center.y) <= size);
  }
  const radius = Math.max(1, Number(zone.size) || 84);
  return corners.every(corner => Math.hypot(corner.x - center.x, corner.y - center.y) <= radius);
}

export function randomPointInsideSpawnZone(player = {}, hitbox = {}, random = Math.random) {
  const zone = player.spawnZone || {};
  const center = spawnZoneCentroid(player);
  const halfDiagonal = Math.hypot((Number(hitbox.w) || 0) * 0.5, (Number(hitbox.h) || 0) * 0.5);
  const points = Array.isArray(zone.points) ? zone.points : [];
  const bounds = zone.shape === "custom" && points.length >= 3 ? {
    left: Math.min(...points.map(point => point.x)), right: Math.max(...points.map(point => point.x)),
    top: Math.min(...points.map(point => point.y)), bottom: Math.max(...points.map(point => point.y))
  } : null;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    let candidate;
    if (bounds) candidate = {
      x: bounds.left + random() * (bounds.right - bounds.left),
      y: bounds.top + random() * (bounds.bottom - bounds.top)
    };
    else if (zone.shape === "square") {
      const reach = Math.max(0, (Number(zone.size) || 84) - halfDiagonal);
      candidate = { x: center.x + (random() * 2 - 1) * reach, y: center.y + (random() * 2 - 1) * reach };
    } else {
      const reach = Math.max(0, (Number(zone.size) || 84) - halfDiagonal);
      const angle = random() * Math.PI * 2;
      const radius = Math.sqrt(random()) * reach;
      candidate = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    }
    if (pointFitsSpawnZone(candidate, player, hitbox)) return candidate;
  }
  return center;
}

export function spawnZoneCentroid(player = {}) {
  const fallback = { x: Number(player.base?.x) || 0, y: Number(player.base?.y) || 0 };
  const zone = player.spawnZone || {};
  if (zone.shape !== "custom" || !Array.isArray(zone.points) || zone.points.length < 3) return fallback;
  const centroid = polygonCentroid(zone.points);
  return pointInPolygon(centroid, zone.points) ? centroid : fallback;
}

export function createStartingHeadquarters({ player, definition, buildingSpec = {}, id = `headquarters-${player?.id || "unknown"}`, now = 0, random = Math.random } = {}) {
  if (!player?.id) throw new Error("A player id is required to create a starting headquarters.");
  if (!definition || definition.role !== "headquarters") throw new Error(`No racial headquarters production definition is available for ${player.id}.`);
  const hitbox = { ...(buildingSpec.hitbox || { w: 40, h: 34 }) };
  const center = randomPointInsideSpawnZone(player, hitbox, random);
  const maxHp = Math.max(1, Number(buildingSpec.maxHp) || 720);
  return {
    id,
    type: definition.buildingType,
    faction: player.id,
    x: center.x,
    y: center.y,
    progress: 1,
    condition: 1,
    maxHp,
    hp: maxHp,
    hitbox,
    supplyRadius: definition.supplyRadius,
    productionRole: definition.role,
    productionTags: [...definition.tags],
    productionOutputCapabilities: Object.keys(definition.outputs),
    productionDefinitionId: definition.id,
    inventory: { ...definition.bootstrapInventory },
    headquarters: true,
    alive: true,
    createdAt: now,
    completedAt: now,
    bootstrap: true
  };
}
