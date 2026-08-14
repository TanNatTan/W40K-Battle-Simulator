const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const SENSOR_CONTACT_STATES = Object.freeze({
  UNEXPLORED: "UNEXPLORED",
  EXPLORED: "EXPLORED",
  VISIBLE: "VISIBLE",
  SENSOR_CONFIRMED: "SENSOR_CONFIRMED"
});

export const SPACE_MARINE_OPTICAL_PROFILE = Object.freeze({
  horizontalDegrees: 215,
  verticalDegrees: 132,
  centralDegrees: 120,
  peripheralRangeMultiplier: 0.72,
  peripheralConfidence: 0.66,
  lowLightPenalty: 0.1,
  flashResistance: 0.95,
  radiationPenalty: 0.05
});

export const BASELINE_OPTICAL_PROFILE = Object.freeze({
  horizontalDegrees: 190,
  verticalDegrees: 125,
  centralDegrees: 105,
  peripheralRangeMultiplier: 0.64,
  peripheralConfidence: 0.56,
  lowLightPenalty: 0.42,
  flashResistance: 0.25,
  radiationPenalty: 0.28
});

export function normalizeAngle(angle = 0) {
  return Math.atan2(Math.sin(Number(angle) || 0), Math.cos(Number(angle) || 0));
}

export function angularDifference(a = 0, b = 0) {
  return Math.abs(normalizeAngle(a - b));
}

export function opticalProfileFor(unit = {}, player = {}) {
  const marine = player.faction === "Space Marines"
    || unit.army === "Space Marines"
    || unit.race === "Astartes"
    || unit.isSpaceMarine === true;
  return marine ? SPACE_MARINE_OPTICAL_PROFILE : BASELINE_OPTICAL_PROFILE;
}

export function classifyOpticalArc(observer = {}, target = {}, profile = BASELINE_OPTICAL_PROFILE) {
  const bearing = Math.atan2((Number(target.y) || 0) - (Number(observer.y) || 0), (Number(target.x) || 0) - (Number(observer.x) || 0));
  const differenceDegrees = angularDifference(bearing, observer.facing ?? observer.heading ?? 0) * 180 / Math.PI;
  if (differenceDegrees <= profile.centralDegrees / 2) return Object.freeze({ arc: "central", differenceDegrees, multiplier: 1, confidence: 1 });
  if (differenceDegrees <= profile.horizontalDegrees / 2) {
    return Object.freeze({ arc: "peripheral", differenceDegrees, multiplier: profile.peripheralRangeMultiplier, confidence: profile.peripheralConfidence });
  }
  return Object.freeze({ arc: "blind", differenceDegrees, multiplier: 0, confidence: 0 });
}

export function opticalDetection(observer = {}, target = {}, context = {}) {
  const profile = context.profile || opticalProfileFor(observer, context.player);
  const arc = classifyOpticalArc(observer, target, profile);
  const dx = (Number(target.x) || 0) - (Number(observer.x) || 0);
  const dy = (Number(target.y) || 0) - (Number(observer.y) || 0);
  const distance = Math.hypot(dx, dy);
  const elevationDelta = Math.abs(Number(context.elevationDelta) || 0);
  const verticalLimit = Math.tan(profile.verticalDegrees * Math.PI / 360) * Math.max(1, distance);
  const verticalFactor = elevationDelta <= verticalLimit ? 1 : Math.max(0.25, verticalLimit / Math.max(1, elevationDelta));
  const lowLight = clamp01(context.lowLight);
  const flash = clamp01(context.flash);
  const radiation = clamp01(context.radiation);
  const obscuration = clamp01(context.obscuration);
  const signature = Math.max(0.08, Number(context.visualSignature) || 1);
  const environment = (1 - lowLight * profile.lowLightPenalty)
    * (1 - flash * (1 - profile.flashResistance))
    * (1 - radiation * profile.radiationPenalty)
    * (1 - obscuration * 0.68)
    * Math.max(0.08, Number(context.occlusion) || 1)
    * verticalFactor;
  const effectiveRange = Math.max(0, Number(context.range) || Number(observer.range) || 100) * arc.multiplier * environment * signature;
  const detected = arc.arc !== "blind" && distance <= effectiveRange;
  return Object.freeze({
    detected,
    sensor: "OPTICAL",
    arc: arc.arc,
    distance,
    effectiveRange,
    confidence: detected ? clamp01(arc.confidence * environment * Math.min(1, effectiveRange / Math.max(1, distance))) : 0,
    identification: detected && arc.arc === "central" && distance <= effectiveRange * 0.72 ? "identified" : detected ? "contact" : "none"
  });
}
