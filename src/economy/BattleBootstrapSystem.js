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

export function spawnZoneCentroid(player = {}) {
  const fallback = { x: Number(player.base?.x) || 0, y: Number(player.base?.y) || 0 };
  const zone = player.spawnZone || {};
  if (zone.shape !== "custom" || !Array.isArray(zone.points) || zone.points.length < 3) return fallback;
  const centroid = polygonCentroid(zone.points);
  return pointInPolygon(centroid, zone.points) ? centroid : fallback;
}

export function createStartingHeadquarters({ player, definition, buildingSpec = {}, id = `headquarters-${player?.id || "unknown"}`, now = 0 } = {}) {
  if (!player?.id) throw new Error("A player id is required to create a starting headquarters.");
  if (!definition || definition.role !== "headquarters") throw new Error(`No racial headquarters production definition is available for ${player.id}.`);
  const center = spawnZoneCentroid(player);
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
    hitbox: { ...(buildingSpec.hitbox || { w: 40, h: 34 }) },
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
