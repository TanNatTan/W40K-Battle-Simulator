export const CHAOS_OPERATIONAL_PHASES = Object.freeze([
  "assess", "shape", "commit", "exploit", "consolidate", "recover", "emergency", "endgame"
]);

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export function createChaosOperationalMemory(overrides = {}) {
  return {
    phase: CHAOS_OPERATIONAL_PHASES.includes(overrides.phase) ? overrides.phase : "assess",
    enteredAt: Math.max(0, Number(overrides.enteredAt) || 0),
    primaryObjectiveId: overrides.primaryObjectiveId || null,
    primaryTargetId: overrides.primaryTargetId || null,
    breachTargetId: overrides.breachTargetId || null,
    breachProgress: clamp01(overrides.breachProgress),
    feintTargetId: overrides.feintTargetId || null,
    reserveCommitted: Boolean(overrides.reserveCommitted),
    lastPlanChangeAt: Number(overrides.lastPlanChangeAt) || -Infinity,
    planCommitUntil: Math.max(0, Number(overrides.planCommitUntil) || 0),
    failureCount: Math.max(0, Number(overrides.failureCount) || 0),
    successfulRaids: Math.max(0, Number(overrides.successfulRaids) || 0),
    lastReason: overrides.lastReason || "battle_started",
    recentReasons: Array.isArray(overrides.recentReasons) ? overrides.recentReasons.slice(-8) : []
  };
}

export function transitionChaosPhase(memory, phase, now, reason, commitmentSeconds = 12) {
  if (!CHAOS_OPERATIONAL_PHASES.includes(phase) || memory.phase === phase) return memory.phase;
  memory.phase = phase;
  memory.enteredAt = now;
  memory.lastPlanChangeAt = now;
  memory.planCommitUntil = now + Math.max(0, commitmentSeconds);
  memory.lastReason = reason;
  memory.recentReasons.push({ phase, reason, at: now });
  if (memory.recentReasons.length > 8) memory.recentReasons.shift();
  if (phase === "commit") memory.reserveCommitted = true;
  if (["recover", "assess"].includes(phase)) memory.reserveCommitted = false;
  return phase;
}

export function serializeChaosOperationalMemory(memory) {
  return {
    ...memory,
    recentReasons: memory.recentReasons.map(reason => ({ ...reason }))
  };
}
