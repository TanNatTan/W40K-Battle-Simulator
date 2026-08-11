const LARGE_PRODUCTION_TYPES = new Set(["outpost", "dropbay"]);
const PRODUCTION_TYPES = new Set(["barracks", "workshop", "researchcenter", "fieldhospital", "generator", "mine", "refinery", "farm", "signature"]);
const STORAGE_TYPES = new Set(["warehouse", "fueldepot", "ammodepot"]);
const DEFENSE_TYPES = new Set(["bunker", "observationtower"]);

export const BUILDING_CLEARANCE = Object.freeze({
  headquarters: 18,
  largeProduction: 14,
  production: 10,
  storage: 9,
  defense: 6,
  turret: 4,
  default: 8
});

export function buildingClearanceFor(type = "", spec = {}) {
  if (type === "outpost" || spec.headquarters) return BUILDING_CLEARANCE.headquarters;
  if (type === "turret") return BUILDING_CLEARANCE.turret;
  if (LARGE_PRODUCTION_TYPES.has(type) || Math.max(spec.hitbox?.w || 0, spec.hitbox?.h || 0) >= 42) return BUILDING_CLEARANCE.largeProduction;
  if (PRODUCTION_TYPES.has(type) || spec.purpose === "Production" || spec.purpose === "Technology") return BUILDING_CLEARANCE.production;
  if (STORAGE_TYPES.has(type) || spec.purpose === "Storage") return BUILDING_CLEARANCE.storage;
  if (DEFENSE_TYPES.has(type) || spec.purpose === "Defense") return BUILDING_CLEARANCE.defense;
  return BUILDING_CLEARANCE.default;
}

export function placementRectsOverlap(point = {}, proposedHitbox = {}, proposedClearance = 0, structure = {}, structureClearance = 0) {
  const clearance = Math.max(0, proposedClearance, structureClearance);
  return Math.abs((Number(point.x) || 0) - (Number(structure.x) || 0)) < ((Number(structure.hitbox?.w) || 0) + (Number(proposedHitbox.w) || 0)) / 2 + clearance
    && Math.abs((Number(point.y) || 0) - (Number(structure.y) || 0)) < ((Number(structure.hitbox?.h) || 0) + (Number(proposedHitbox.h) || 0)) / 2 + clearance;
}

export function blocksServiceCorridor({ point = {}, hitbox = {}, base = {}, corridorHalfWidth = 9, corridorLength = 180 } = {}) {
  const halfWidth = Math.max(1, Number(hitbox.w) || 0) / 2;
  const halfHeight = Math.max(1, Number(hitbox.h) || 0) / 2;
  const dx = (Number(point.x) || 0) - (Number(base.x) || 0);
  const dy = (Number(point.y) || 0) - (Number(base.y) || 0);
  const blocksHorizontal = Math.abs(dy) < corridorHalfWidth + halfHeight && Math.abs(dx) < corridorLength + halfWidth;
  const blocksVertical = Math.abs(dx) < corridorHalfWidth + halfWidth && Math.abs(dy) < corridorLength + halfHeight;
  return blocksHorizontal || blocksVertical;
}
