// Gameplay rules that turn height-field geometry into combat and movement
// consequences. Pure functions: the simulator feeds in numbers and applies
// the returned multipliers, which keeps all of this unit-testable.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Slope is rise/run. 0.5 is a hard climb, 1.0 is a 45 degree face.
export function slopeMovementFactor(directionalSlope, { vehicle = false, airborne = false } = {}) {
  if (airborne) return 1;
  const slope = Number(directionalSlope) || 0;
  if (slope >= 0) {
    const penalty = slope * (vehicle ? 1.35 : 0.85);
    return clamp(1 - penalty, vehicle ? 0.18 : 0.3, 1);
  }
  // Downhill helps a little, but steep descents are controlled, not sprinted.
  const descent = -slope;
  return descent < 0.55 ? 1 + descent * 0.22 : clamp(1.12 - (descent - 0.55) * 0.6, 0.55, 1.12);
}

// Surfaces steeper than this are cliffs: infantry may scramble, vehicles may not.
export function isCliff(slope, { vehicle = false } = {}) {
  return Math.abs(slope) > (vehicle ? 0.9 : 1.6);
}

// Shooter above target: better accuracy and a little extra reach. Shooter
// below target: harder to hit and shorter reach. Capped so hills help
// without deciding fights alone.
export function highGroundModifiers(shooterHeight, targetHeight, distance = 0) {
  const delta = (Number(shooterHeight) || 0) - (Number(targetHeight) || 0);
  const normal = clamp(delta / 14, -1, 1);
  const closeness = clamp(1 - distance / 700, 0.35, 1);
  return {
    delta,
    accuracy: 1 + normal * 0.16 * closeness,
    range: 1 + normal * 0.1,
    incomingDamage: 1 - Math.max(0, normal) * 0.08 + Math.max(0, -normal) * 0.06,
    visionRange: 1 + normal * 0.18
  };
}

// Dead ground behind a ridge: fully hidden from direct fire when the sight
// line is blocked, with a soft penumbra when the ray only skims the crest.
export function lineOfSightModifiers(los) {
  if (!los) return { blocked: false, accuracy: 1, detection: 1 };
  if (!los.clear) return { blocked: true, accuracy: 0, detection: 0.15 };
  const margin = Number.isFinite(los.margin) ? los.margin : 4;
  if (margin < 1.5) return { blocked: false, accuracy: 0.72 + margin * 0.18, detection: 0.7 + margin * 0.2 };
  return { blocked: false, accuracy: 1, detection: 1 };
}

// Reverse-slope cover: a slope leaning away from the attacker shields units.
export function slopeCover(normal, attackerDirection) {
  if (!normal || !attackerDirection) return 0;
  const facing = normal.x * attackerDirection.x + normal.y * attackerDirection.y;
  return clamp(-facing * (1 - normal.z) * 2.2, 0, 0.35);
}

export function describeSlope(slope) {
  const value = Math.abs(Number(slope) || 0);
  if (value < 0.08) return "Flat";
  if (value < 0.25) return "Gentle";
  if (value < 0.5) return "Steep";
  if (value < 0.9) return "Severe";
  return "Cliff";
}

// Relief contributed by legacy terrain feature types so existing maps get
// hills and basins without being re-authored.
export const FEATURE_RELIEF = Object.freeze({
  hill: 14, raise: 10, terrace: 8, ridge: 20, mountain: 38, highground: 12, plateau: 16, cliff: 24, rock: 3, rubble: 2,
  lower: -6, crater: -5, trench: -3, canyon: -14, valley: -8, basin: -6,
  water: -4, shallowwater: -2, deepwater: -12, river: -4, lake: -8
});
