export const COLLISION_LAYERS = Object.freeze({
  GROUND_INFANTRY: "GROUND_INFANTRY",
  GROUND_VEHICLE: "GROUND_VEHICLE",
  AIR: "AIR",
  STRUCTURE: "STRUCTURE",
  PROJECTILE: "PROJECTILE"
});

const AIRCRAFT_IDENTITY = /aircraft|flyer|fighter|bomber|gunship|thunderhawk|stormraven|stormtalon|stormhawk|dakkajet|valkyrie|barracuda|heldrake|doom scythe|night scythe|razorwing|harpy|crone/i;

export function collisionLayerFor(entity = {}) {
  if (entity.collisionLayer && Object.values(COLLISION_LAYERS).includes(entity.collisionLayer)) return entity.collisionLayer;
  if (entity.projectileType || entity.visualKind) return COLLISION_LAYERS.PROJECTILE;
  if (entity.hitbox && entity.progress != null) return COLLISION_LAYERS.STRUCTURE;
  if (entity.aircraftState || Number(entity.altitude) > 0 || AIRCRAFT_IDENTITY.test(`${entity.name || ""} ${entity.type || ""} ${entity.specialty || ""}`)) return COLLISION_LAYERS.AIR;
  if (entity.role === "vehicle" || entity.vehicleState) return COLLISION_LAYERS.GROUND_VEHICLE;
  return COLLISION_LAYERS.GROUND_INFANTRY;
}

export function layersCollide(left, right) {
  const a = typeof left === "string" ? left : collisionLayerFor(left);
  const b = typeof right === "string" ? right : collisionLayerFor(right);
  if (a === COLLISION_LAYERS.PROJECTILE || b === COLLISION_LAYERS.PROJECTILE) return true;
  if (a === COLLISION_LAYERS.AIR || b === COLLISION_LAYERS.AIR) return a === b;
  if (a === COLLISION_LAYERS.STRUCTURE || b === COLLISION_LAYERS.STRUCTURE) return true;
  return true;
}

export function shouldSeparateUnits(left = {}, right = {}) {
  return layersCollide(left, right) && collisionLayerFor(left) !== COLLISION_LAYERS.PROJECTILE && collisionLayerFor(right) !== COLLISION_LAYERS.PROJECTILE;
}

export function ignoresGroundObstacles(entity = {}) {
  return collisionLayerFor(entity) === COLLISION_LAYERS.AIR;
}
