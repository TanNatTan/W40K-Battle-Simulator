const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const distanceBetween = (a = {}, b = {}) => Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0));

export const ENEMY_CONDITION_STATES = Object.freeze({
  HEALTHY: "healthy",
  INJURED: "injured",
  CRITICAL: "critical",
  INCAPACITATED: "incapacitated"
});

export function assessEnemyCondition(candidate = {}) {
  const suppliedHealth = Number(candidate.hp);
  const maximumHealth = Math.max(1, Number(candidate.maxHp) || (Number.isFinite(suppliedHealth) ? suppliedHealth : 1));
  const healthRatio = clamp01((Number.isFinite(suppliedHealth) ? suppliedHealth : maximumHealth) / maximumHealth);
  const woundState = String(candidate.woundState || candidate.status || "").toLowerCase();
  const incapacitated = Boolean(candidate.incapacitated) || woundState.includes("incapacitated");
  const criticalWound = woundState.includes("gravely") || woundState.includes("critical");
  const knockedDown = (Number(candidate.knockedDownRemaining) || 0) > 0 || woundState.includes("knocked down");
  const bleeding = clamp01(candidate.bleeding);
  const disabledSystems = Object.entries(candidate.vehicleSystems || {})
    .filter(([, condition]) => Number(condition) < 0.25)
    .map(([system]) => system);
  let state = ENEMY_CONDITION_STATES.HEALTHY;
  if (incapacitated) state = ENEMY_CONDITION_STATES.INCAPACITATED;
  else if (healthRatio <= 0.35 || criticalWound || disabledSystems.length) state = ENEMY_CONDITION_STATES.CRITICAL;
  else if (healthRatio < 0.78 || knockedDown || bleeding >= 0.12) state = ENEMY_CONDITION_STATES.INJURED;
  const severity = incapacitated ? 1
    : clamp01((1 - healthRatio) * 0.78 + (criticalWound ? 0.22 : 0) + (knockedDown ? 0.14 : 0)
      + bleeding * 0.18 + (candidate.retreating ? 0.08 : 0) + (disabledSystems.length ? 0.2 : 0));
  return Object.freeze({
    state,
    healthRatio,
    conditionPercent: Math.round(healthRatio * 100),
    severity,
    incapacitated,
    knockedDown,
    disabledSystems: Object.freeze(disabledSystems),
    combatCapable: candidate.alive !== false && !incapacitated,
    finishRecommended: candidate.alive !== false && (incapacitated || state === ENEMY_CONDITION_STATES.CRITICAL)
  });
}

export function finishOpportunityFor(attacker = {}, target = {}, context = {}) {
  const condition = assessEnemyCondition(target);
  const friendlyPower = Math.max(0, Number(context.friendlyPower) || 0);
  const enemyPower = Math.max(0, Number(context.enemyPower) || 0);
  const nearbyAdvantage = friendlyPower >= enemyPower * 0.8;
  const pursuitRadius = Math.max(0, Number(context.pursuitRadius) || Number(attacker.combatCommitment?.pursuitRadius) || 0);
  const leash = Math.max((Number(attacker.range) || 0) * 1.4, pursuitRadius);
  const targetDistance = Number.isFinite(context.distance) ? Math.max(0, context.distance) : distanceBetween(attacker, target);
  const withinLeash = leash <= 0 || targetDistance <= leash;
  const compromised = Boolean(target.retreating) || condition.knockedDown
    || Number(target.morale) < 0.25 || Number(target.suppression) > 0.7;
  const vehicleDisabled = target.role === "vehicle" && condition.disabledSystems.length > 0;
  const valuable = condition.incapacitated || condition.healthRatio <= 0.28
    || condition.healthRatio <= 0.42 && compromised || vehicleDisabled;
  return Object.freeze({
    valuable,
    safe: nearbyAdvantage && withinLeash,
    nearbyAdvantage,
    withinLeash,
    targetDistance,
    condition,
    reason: condition.incapacitated ? "incapacitated military threat"
      : vehicleDisabled ? `disabled ${condition.disabledSystems.join(", ")}`
        : compromised ? "critically compromised" : "badly damaged"
  });
}

export function estimatedFriendlyDamageAssigned(targetId, friendlies = []) {
  if (!targetId) return 0;
  return friendlies.reduce((sum, friendly) => {
    if (friendly?.alive === false || friendly?.targetId !== targetId) return sum;
    const accuracy = clamp01(friendly.accuracy ?? 0.65);
    return sum + Math.max(0, Number(friendly.damage) || 0) * Math.max(0.25, accuracy);
  }, 0);
}

export function overkillPenaltyFor(target = {}, assignedDamage = 0) {
  const remainingHealth = Math.max(1, Number(target.hp) || 1);
  if (assignedDamage < remainingHealth * 1.25) return 0;
  return Math.min(90, 55 + (assignedDamage / remainingHealth - 1.25) * 12);
}
