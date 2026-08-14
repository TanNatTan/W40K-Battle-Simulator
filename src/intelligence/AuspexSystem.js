const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const ASTARTES_AUSPEX_PROFILE = Object.freeze({
  passiveRadius: 95,
  activeRadius: 190,
  activeCooldownSeconds: 7,
  channels: Object.freeze(["motion", "thermal", "bio-sign", "material"])
});

export function auspexProfileFor(unit = {}) {
  const text = `${unit.name || ""} ${unit.role || ""} ${unit.specialization || ""}`.toLowerCase();
  let radiusMultiplier = 1;
  let confidenceMultiplier = 1;
  if (/infiltrator|vanguard/.test(text)) {
    radiusMultiplier = 1.42;
    confidenceMultiplier = 1.28;
  } else if (/scout/.test(text) || unit.role === "scout") {
    radiusMultiplier = 1.22;
    confidenceMultiplier = 1.16;
  } else if (/eliminator|sniper/.test(text) || unit.role === "sniper") {
    radiusMultiplier = 1.14;
    confidenceMultiplier = 1.2;
  } else if (/captain|commander/.test(text) || unit.role === "commander") {
    radiusMultiplier = 1.12;
    confidenceMultiplier = 1.12;
  }
  if (/damocles/.test(text) || unit.damoclesCommandRelay) {
    radiusMultiplier = Math.max(radiusMultiplier, 1.85);
    confidenceMultiplier = Math.max(confidenceMultiplier, 1.5);
  }
  return Object.freeze({ ...ASTARTES_AUSPEX_PROFILE, radiusMultiplier, confidenceMultiplier });
}

export function calculateSensorSignatures(target = {}, context = {}) {
  const camouflage = clamp01(target.camouflage);
  const cover = clamp01(context.cover);
  const smoke = clamp01(context.smoke);
  const speed = Math.hypot(Number(target.vx) || 0, Number(target.vy) || 0);
  const moving = speed > 0.25 || /moving|advancing|retreat|pursu|closing/i.test(target.status || "");
  const firing = Boolean(context.firing || target.revealedUntil > context.now || /firing|melee/i.test(target.status || ""));
  const size = target.role === "vehicle" ? 1.7 : target.type ? 2 : target.role === "commander" ? 1.12 : 1;
  const stealth = camouflage * (0.5 + cover * 0.32 + smoke * 0.3);
  return Object.freeze({
    visual: Math.max(0.12, size * (1 - stealth) * (firing ? 1.75 : moving ? 1.18 : 0.82)),
    thermal: Math.max(0.15, size * (target.role === "vehicle" ? 1.35 : 0.82) * (1 - camouflage * 0.18) * (firing ? 1.38 : 1)),
    motion: Math.max(0.08, size * (moving ? 1.2 + Math.min(0.8, speed / 24) : 0.18) * (1 - camouflage * 0.25)),
    bio: target.type || target.mechanical ? 0.12 : Math.max(0.15, size * (1 - camouflage * 0.24)),
    material: Math.max(0.2, size * (target.role === "vehicle" || target.type ? 1.35 : 0.72)),
    firing,
    moving
  });
}

export function canActiveScan(unit = {}, now = 0) {
  return (Number(unit.auspexReadyAt) || 0) <= now;
}

export function markActiveScan(unit = {}, now = 0, profile = auspexProfileFor(unit)) {
  unit.auspexReadyAt = now + profile.activeCooldownSeconds;
  unit.lastAuspexScanAt = now;
  return unit.auspexReadyAt;
}

export function auspexContact(observer = {}, target = {}, context = {}) {
  const profile = context.profile || auspexProfileFor(observer);
  const active = Boolean(context.active);
  const radius = (active ? profile.activeRadius : profile.passiveRadius) * profile.radiusMultiplier;
  const distance = Math.hypot((Number(target.x) || 0) - (Number(observer.x) || 0), (Number(target.y) || 0) - (Number(observer.y) || 0));
  const signatures = context.signatures || calculateSensorSignatures(target, context);
  const signal = Math.max(signatures.motion, signatures.thermal, signatures.bio, signatures.material * (active ? 0.9 : 0.34));
  const attenuation = clamp01((Number(context.materialTransmission) || 1) * (1 - clamp01(context.interference) * 0.72));
  const threshold = active ? 0.16 : 0.28;
  const strength = signal * attenuation * profile.confidenceMultiplier * Math.max(0, 1 - distance / Math.max(1, radius) * 0.72);
  const detected = distance <= radius && strength >= threshold;
  const confidence = detected ? clamp01(0.28 + strength * 0.45 + (active ? 0.14 : 0)) : 0;
  return Object.freeze({
    detected,
    sensor: active ? "AUSPEX_ACTIVE" : "AUSPEX_PASSIVE",
    state: detected ? "SENSOR_CONFIRMED" : "UNDETECTED",
    position: detected ? { x: Number(target.x) || 0, y: Number(target.y) || 0 } : null,
    uncertaintyRadius: detected ? Math.max(5, (1 - confidence) * (active ? 30 : 58)) : Infinity,
    classification: detected ? (target.role === "vehicle" ? "armored signature" : target.type ? "structural signature" : target.mechanical ? "mechanical lifeform" : "bio-sign") : null,
    confidence,
    distance,
    signatures
  });
}
