export const COLLISION_LAYERS = Object.freeze({
  GROUND_INFANTRY: "GROUND_INFANTRY",
  GROUND_VEHICLE: "GROUND_VEHICLE",
  AIR: "AIR",
  STRUCTURE: "STRUCTURE",
  PROJECTILE: "PROJECTILE"
});

const AIRCRAFT_IDENTITY = /aircraft|flyer|fighter|bomber|gunship|thunderhawk|stormraven|stormtalon|stormhawk|dakkajet|valkyrie|barracuda|heldrake|doom scythe|night scythe|razorwing|harpy|crone/i;

// This identity test runs once per entity per separation/collision check, and a
// dense battle can evaluate it millions of times per frame. The regex plus the
// template-string allocation it needs is the most expensive part of
// collisionLayerFor, so cache the result on the entity and only recompute it
// when the three fields it actually reads have changed (rare: battlefield
// promotions rename a handful of units per battle, not every frame).
function isAircraftIdentity(entity) {
  const name = entity.name || "";
  const type = entity.type || "";
  const specialty = entity.specialty || "";
  if (entity.__awtAircraftIdName === name && entity.__awtAircraftIdType === type && entity.__awtAircraftIdSpecialty === specialty) {
    return entity.__awtAircraftIdResult;
  }
  const result = AIRCRAFT_IDENTITY.test(`${name} ${type} ${specialty}`);
  if (entity && typeof entity === "object") {
    entity.__awtAircraftIdName = name;
    entity.__awtAircraftIdType = type;
    entity.__awtAircraftIdSpecialty = specialty;
    entity.__awtAircraftIdResult = result;
  }
  return result;
}

export function collisionLayerFor(entity = {}) {
  if (entity.collisionLayer && Object.values(COLLISION_LAYERS).includes(entity.collisionLayer)) return entity.collisionLayer;
  if (entity.projectileType || entity.visualKind) return COLLISION_LAYERS.PROJECTILE;
  if (entity.hitbox && entity.progress != null) return COLLISION_LAYERS.STRUCTURE;
  if (entity.aircraftState || Number(entity.altitude) > 0 || isAircraftIdentity(entity)) return COLLISION_LAYERS.AIR;
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

// Separation is the hottest pairwise check in the simulation (every nearby
// unit pair, every separation tick). The original implementation computed
// each entity's collision layer up to twice via layersCollide() plus twice
// more via its own explicit checks -- four lookups per pair for information
// that only changes twice. Compute each side's layer exactly once instead.
export function shouldSeparateUnits(left = {}, right = {}) {
  const layerA = collisionLayerFor(left);
  const layerB = collisionLayerFor(right);
  if (layerA === COLLISION_LAYERS.PROJECTILE || layerB === COLLISION_LAYERS.PROJECTILE) return false;
  if (layerA === COLLISION_LAYERS.AIR || layerB === COLLISION_LAYERS.AIR) return layerA === layerB;
  return true;
}

export function ignoresGroundObstacles(entity = {}) {
  return collisionLayerFor(entity) === COLLISION_LAYERS.AIR;
}
