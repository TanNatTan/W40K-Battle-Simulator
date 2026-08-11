import { classifyEnemy } from "./PerceptionMemorySystem.js";

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

const CLASS_VALUE = Object.freeze({
  commander: 82,
  armor: 90,
  "heavy-weapon": 86,
  builder: 72,
  logistics: 68,
  medic: 66,
  structure: 70,
  infantry: 50
});

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
  let state = ENEMY_CONDITION_STATES.HEALTHY;
  if (incapacitated) state = ENEMY_CONDITION_STATES.INCAPACITATED;
  else if (healthRatio <= 0.35 || criticalWound) state = ENEMY_CONDITION_STATES.CRITICAL;
  else if (healthRatio < 0.78 || knockedDown || bleeding >= 0.12) state = ENEMY_CONDITION_STATES.INJURED;
  const severity = incapacitated ? 1
    : clamp01((1 - healthRatio) * 0.78 + (criticalWound ? 0.22 : 0) + (knockedDown ? 0.14 : 0)
      + bleeding * 0.18 + (candidate.retreating ? 0.08 : 0));
  return Object.freeze({
    state,
    healthRatio,
    conditionPercent: Math.round(healthRatio * 100),
    severity,
    incapacitated,
    knockedDown,
    combatCapable: candidate.alive !== false && !incapacitated,
    finishRecommended: candidate.alive !== false && (incapacitated || state === ENEMY_CONDITION_STATES.CRITICAL)
  });
}

export function scoreTargetCandidate(attacker = {}, candidate = {}, context = {}) {
  const classification = classifyEnemy(candidate);
  const distance = Math.max(0, Number(context.distance) || 0);
  const detectionRadius = Math.max(1, Number(context.detectionRadius) || Number(attacker.range) || 1);
  const condition = assessEnemyCondition(candidate);
  const focusCount = Math.max(0, Number(context.focusCount) || 0);
  const immediateThreatPressure = clamp01(context.immediateThreatPressure);
  const damagingSelf = candidate.targetId === attacker.id || candidate.targetId && candidate.targetId === context.squadId;
  const weaponMatch = attacker.antiArmor && classification === "armor" ? 34
    : attacker.antiArmor && classification === "infantry" ? -10
      : classification === "armor" && Number(attacker.penetration) < 8 ? -24 : 0;
  const lineOfFire = context.lineOfFire === false ? -80 : 0;
  const strategic = CLASS_VALUE[classification] || 50;
  const activeThreatFactor = condition.combatCapable ? 1 : 0.15;
  const threat = (strategic + (Number(candidate.damage) || 0) * 0.9 + (Number(candidate.range) || 0) * 0.08 + (damagingSelf ? 36 : 0)) * activeThreatFactor;
  const finishBonus = condition.finishRecommended ? 48 * (1 - immediateThreatPressure * 0.75) : 0;
  const disabledThreatPenalty = condition.incapacitated ? immediateThreatPressure * 30 : 0;
  const opportunity = condition.severity * 34 + finishBonus + weaponMatch + (context.isolated ? 12 : 0) + clamp01(candidate.suppression) * 8 - disabledThreatPenalty;
  const rangeAdvantage = (1 - Math.min(1, distance / detectionRadius)) * 68;
  const focusPenalty = Math.max(0, focusCount - 1) * 13;
  const confidence = clamp01(context.confidence ?? 1);
  const stickiness = candidate.id === context.currentTargetId ? Math.max(0, Number(context.stickiness) || 18) : 0;
  return confidence * (threat + opportunity + rangeAdvantage + lineOfFire) - focusPenalty + stickiness;
}

export function selectTarget(candidates = [], { currentTargetId = null, switchThreshold = 16, score = scoreTargetCandidate } = {}) {
  const ranked = candidates.map(candidate => ({ candidate, score: score(candidate) })).sort((a, b) => b.score - a.score);
  const best = ranked[0] || null;
  const current = ranked.find(item => item.candidate.id === currentTargetId) || null;
  if (current && best && best.candidate.id !== current.candidate.id && best.score < current.score + switchThreshold) return { target: current.candidate, score: current.score, switched: false, ranked };
  return { target: best?.candidate || null, score: best?.score ?? -Infinity, switched: Boolean(current && best && current.candidate.id !== best.candidate.id), ranked };
}
