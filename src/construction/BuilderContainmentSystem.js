const ringOffsets = Object.freeze([
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2]
]);

export function unitFitsInsideSpawnZone(point, radius = 0, contains = () => true) {
  const safeRadius = Math.max(0, Number(radius) || 0);
  return ringOffsets.every(([x, y]) => contains({
    x: (Number(point?.x) || 0) + x * safeRadius,
    y: (Number(point?.y) || 0) + y * safeRadius
  }));
}

export function structureFitsInsideSpawnZone(site, hitbox = {}, clearance = 0, contains = () => true) {
  const halfWidth = Math.max(0, (Number(hitbox.w) || 0) / 2 + (Number(clearance) || 0));
  const halfHeight = Math.max(0, (Number(hitbox.h) || 0) / 2 + (Number(clearance) || 0));
  return [
    [0, 0], [halfWidth, 0], [-halfWidth, 0], [0, halfHeight], [0, -halfHeight],
    [halfWidth, halfHeight], [-halfWidth, halfHeight], [halfWidth, -halfHeight], [-halfWidth, -halfHeight]
  ].every(([x, y]) => contains({ x: (Number(site?.x) || 0) + x, y: (Number(site?.y) || 0) + y }));
}

export function constrainPointToSpawnZone(point, origin, radius = 0, contains = () => true) {
  if (unitFitsInsideSpawnZone(point, radius, contains)) return { x: Number(point.x) || 0, y: Number(point.y) || 0 };
  if (!unitFitsInsideSpawnZone(origin, radius, contains)) return null;
  let low = 0;
  let high = 1;
  for (let index = 0; index < 20; index += 1) {
    const t = (low + high) / 2;
    const candidate = {
      x: (Number(origin.x) || 0) + ((Number(point?.x) || 0) - (Number(origin.x) || 0)) * t,
      y: (Number(origin.y) || 0) + ((Number(point?.y) || 0) - (Number(origin.y) || 0)) * t
    };
    if (unitFitsInsideSpawnZone(candidate, radius, contains)) low = t;
    else high = t;
  }
  const safeT = Math.max(0, low - 0.002);
  return {
    x: (Number(origin.x) || 0) + ((Number(point?.x) || 0) - (Number(origin.x) || 0)) * safeT,
    y: (Number(origin.y) || 0) + ((Number(point?.y) || 0) - (Number(origin.y) || 0)) * safeT
  };
}

