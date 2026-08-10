export const OPERATIONAL_PHASES = Object.freeze([
  "assess", "shape", "commit", "exploit", "consolidate", "recover", "endgame"
]);

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const OPERATIONAL_PHASE_BIAS = Object.freeze({
  assess: Object.freeze({ attack: 0.72, defend: 1.05, expand: 0.82, research: 1.08, logistics: 1.12, regroup: 1.02 }),
  shape: Object.freeze({ attack: 0.94, defend: 0.96, expand: 1.08, research: 0.95, logistics: 1.16, regroup: 0.86 }),
  commit: Object.freeze({ attack: 1.38, defend: 0.76, expand: 0.84, research: 0.5, logistics: 0.78, regroup: 0.56 }),
  exploit: Object.freeze({ attack: 1.48, defend: 0.68, expand: 1.2, research: 0.42, logistics: 0.72, regroup: 0.48 }),
  consolidate: Object.freeze({ attack: 0.78, defend: 1.32, expand: 0.96, research: 0.9, logistics: 1.24, regroup: 1.02 }),
  recover: Object.freeze({ attack: 0.52, defend: 1.18, expand: 0.58, research: 0.84, logistics: 1.45, regroup: 1.58 }),
  endgame: Object.freeze({ attack: 1.62, defend: 0.84, expand: 1.12, research: 0.2, logistics: 0.72, regroup: 0.3 })
});

export function createOperationalMemory(overrides = {}) {
  return {
    phase: OPERATIONAL_PHASES.includes(overrides.phase) ? overrides.phase : "assess",
    enteredAt: Math.max(0, Number(overrides.enteredAt) || 0),
    commitUntil: Math.max(0, Number(overrides.commitUntil) || 0),
    transitionReason: overrides.transitionReason || "battle_started",
    objectiveId: overrides.objectiveId || null,
    transitionCount: Math.max(0, Number(overrides.transitionCount) || 0)
  };
}

function transition(memory, phase, now, reason, commitment = 8) {
  if (memory.phase === phase) return phase;
  memory.phase = phase;
  memory.enteredAt = now;
  memory.commitUntil = now + Math.max(0, commitment);
  memory.transitionReason = reason;
  memory.transitionCount += 1;
  return phase;
}

export function evaluateOperationalPhase({ now = 0, plan = {}, context = {}, memory = null } = {}) {
  const state = memory || createOperationalMemory({ enteredAt: now });
  const progress = clamp01(context.objectiveProgress);
  const pressure = clamp01(context.enemyPressure);
  const supply = clamp01(context.supplyCondition ?? 0.65);
  const momentum = clamp01(context.offensiveMomentum ?? 0.5);
  const intelligence = clamp01(context.intelligenceConfidence ?? 0.25);
  const overextension = clamp01(context.overextension);
  const strengthRatio = Math.max(0, Number(context.localStrengthRatio) || 0);
  const age = now - state.enteredAt;
  state.objectiveId = plan.id || state.objectiveId;

  if (progress >= 0.9 || context.enemyRecoveryCollapsed) transition(state, "endgame", now, "objective_near_completion", 999999);
  else if (state.phase === "endgame") {
    // Endgame is deliberately sticky: armies must finish the selected objective.
  } else if (pressure > 0.82 && (supply < 0.35 || strengthRatio < 0.72)) transition(state, "recover", now, "combat_power_at_risk", 10);
  else if (now >= state.commitUntil) {
    switch (state.phase) {
      case "assess":
        if (intelligence >= 0.45 || age >= 12) transition(state, "shape", now, "battlefield_assessed", 7);
        break;
      case "shape":
        if (strengthRatio >= 1.05 || clamp01(context.timePressure) > 0.78) transition(state, "commit", now, "decisive_window", 14);
        break;
      case "commit":
        if (momentum >= 0.72 || clamp01(context.breachProgress) >= 0.68) transition(state, "exploit", now, "enemy_disrupted", 10);
        else if (momentum < 0.22 && age >= 12) transition(state, "recover", now, "commitment_stalled", 10);
        break;
      case "exploit":
        if (context.objectiveSecured || progress >= 0.7) transition(state, "consolidate", now, "objective_foothold_secured", 10);
        else if (overextension > 0.78) transition(state, "recover", now, "force_overextended", 10);
        break;
      case "consolidate":
        if (clamp01(context.newStrategicOpportunity) > 0.7) transition(state, "shape", now, "next_objective_opened", 7);
        break;
      case "recover":
        if (supply >= 0.62 && strengthRatio >= 0.92 && pressure < 0.65) transition(state, "shape", now, "combat_power_restored", 7);
        break;
      default:
        transition(state, "assess", now, "invalid_phase_reset", 0);
    }
  }

  return {
    phase: state.phase,
    reason: state.transitionReason,
    strategicBias: { ...OPERATIONAL_PHASE_BIAS[state.phase] },
    objectiveLeash: objectiveLeashFor(plan, context),
    memory: state
  };
}

export function objectiveLeashFor(plan = {}, context = {}) {
  const signals = plan.signals || {};
  const progress = clamp01(context.objectiveProgress);
  const doctrineFocus = plan.doctrine?.modifiers?.objectiveFocus ?? plan.doctrine?.objectiveLeash ?? 0.72;
  const effectiveFocus = effectiveObjectiveFocus(doctrineFocus, context.scoreDeficit01, context.timeRemaining01 ?? 1 - clamp01(context.timePressure));
  const urgency = clamp01(Math.max(0.55, effectiveFocus * 0.78 + (1 - progress) * clamp01(context.timePressure) * 0.28));
  const primaryChoices = [];
  if ((signals.attack || 0) >= 0.55) primaryChoices.push("attack");
  if ((signals.defense || 0) >= 0.55) primaryChoices.push("defend");
  if ((signals.expansion || 0) >= 0.55) primaryChoices.push("expand");
  if ((signals.logistics || 0) >= 0.55) primaryChoices.push("logistics");
  if ((signals.economy || 0) >= 0.62) primaryChoices.push("research");
  if (!primaryChoices.length) primaryChoices.push("attack", "defend");
  return Object.freeze({
    objectiveId: plan.id || "annihilation",
    primaryChoices: Object.freeze([...new Set(primaryChoices)]),
    minimumBias: urgency,
    effectiveFocus,
    reserveBias: plan.doctrine?.reserveBias ?? 0.5,
    consolidationBias: plan.doctrine?.consolidationBias ?? 0.5,
    canAbandon: false
  });
}

export function applyObjectiveLeash(bias = {}, leash = {}) {
  const result = { ...bias };
  for (const choice of leash.primaryChoices || []) result[choice] = Math.max(Number(result[choice]) || 0, leash.minimumBias || 0.72);
  return result;
}
import { effectiveObjectiveFocus } from "./WarfareDoctrineSystem.js";
