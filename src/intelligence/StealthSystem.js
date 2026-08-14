const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const STEALTH_STATES = Object.freeze({
  EXPOSED: "EXPOSED",
  CONCEALED: "CONCEALED",
  CAMOUFLAGED: "CAMOUFLAGED",
  PROBABLE_ORIGIN: "PROBABLE_ORIGIN"
});

export function stealthProfileFor(unit = {}) {
  const text = `${unit.name || ""} ${unit.role || ""} ${unit.specialization || ""}`.toLowerCase();
  const sniper = /sniper|eliminator/.test(text) || unit.role === "sniper";
  const infiltrator = /infiltrator|vanguard|scout/.test(text) || unit.role === "scout";
  const camouflage = clamp01((Number(unit.camouflage) || 0.25) + (sniper ? 0.28 : infiltrator ? 0.16 : 0));
  return Object.freeze({
    camouflage,
    visualSignature: Math.max(0.12, 1 - camouflage * 0.74),
    thermalSignature: Math.max(0.18, 1 - camouflage * (sniper ? 0.36 : 0.18)),
    motionSignature: Math.max(0.12, 1 - camouflage * 0.48),
    sniper,
    infiltrator
  });
}

export function stealthStateFor(unit = {}, context = {}) {
  const profile = context.profile || stealthProfileFor(unit);
  const cover = clamp01(context.cover);
  const smoke = clamp01(context.smoke);
  const moving = Boolean(context.moving);
  const firing = Boolean(context.firing || unit.revealedUntil > (context.now || 0));
  const concealment = clamp01(profile.camouflage * 0.58 + cover * 0.34 + smoke * 0.32 - (moving ? 0.2 : 0) - (firing ? 0.62 : 0));
  return Object.freeze({
    state: firing ? STEALTH_STATES.EXPOSED : concealment >= 0.68 ? STEALTH_STATES.CAMOUFLAGED : concealment >= 0.34 ? STEALTH_STATES.CONCEALED : STEALTH_STATES.EXPOSED,
    concealment,
    signatures: Object.freeze({
      visual: Math.max(0.08, profile.visualSignature * (1 - cover * 0.42) * (1 - smoke * 0.55) * (moving ? 1.28 : 0.82) * (firing ? 2.2 : 1)),
      thermal: Math.max(0.12, profile.thermalSignature * (firing ? 1.5 : 1)),
      motion: Math.max(0.06, profile.motionSignature * (moving ? 1.5 : 0.2))
    })
  });
}

export function revealFromWeaponFire(unit = {}, now = 0, duration = 4) {
  unit.revealedUntil = Math.max(Number(unit.revealedUntil) || 0, now + duration);
  unit.lastWeaponDischargeAt = now;
  return unit.revealedUntil;
}

export function probableSniperOrigin(shooter = {}, now = 0) {
  return Object.freeze({
    state: STEALTH_STATES.PROBABLE_ORIGIN,
    position: Object.freeze({ x: Number(shooter.x) || 0, y: Number(shooter.y) || 0 }),
    confidence: 0.64,
    uncertaintyRadius: 55,
    createdAt: now,
    expiresAt: now + 24
  });
}

export function sniperTacticalDecision(sniper = {}, context = {}) {
  const detected = clamp01(context.counterDetection) >= 0.55 || sniper.revealedUntil > (context.now || 0);
  if (detected && context.relocationPoint) return Object.freeze({ action: "RELOCATE", destination: context.relocationPoint, reason: "counter-detected firing position" });
  if (context.target && clamp01(context.cover) >= 0.35 && (context.rangeToTarget || Infinity) >= (sniper.range || 120) * 0.55) {
    return Object.freeze({ action: "AIM", targetId: context.target.id, reason: "covered long-range firing solution" });
  }
  if (context.vantagePoint) return Object.freeze({ action: "SEEK_VANTAGE", destination: context.vantagePoint, reason: "cover and elevation improve concealment" });
  return Object.freeze({ action: "HOLD", reason: "remain still and preserve camouflage" });
}
