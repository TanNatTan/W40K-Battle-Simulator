import { chaosProfileFor } from "./ChaosProfiles.js";
import { createChaosOperationalMemory, transitionChaosPhase } from "./ChaosOperationalState.js";

const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));

const PHASE_BIAS = Object.freeze({
  assess: { attack: 0.7, defend: 1, expand: 0.85, research: 1, logistics: 1.05, regroup: 1 },
  shape: { attack: 0.92, defend: 0.9, expand: 1.05, research: 0.88, logistics: 1.14, regroup: 0.82 },
  commit: { attack: 1.42, defend: 0.7, expand: 0.82, research: 0.38, logistics: 0.72, regroup: 0.52 },
  exploit: { attack: 1.5, defend: 0.62, expand: 1.18, research: 0.3, logistics: 0.68, regroup: 0.42 },
  consolidate: { attack: 0.78, defend: 1.3, expand: 0.92, research: 0.82, logistics: 1.2, regroup: 1.05 },
  recover: { attack: 0.55, defend: 1.15, expand: 0.58, research: 0.72, logistics: 1.42, regroup: 1.55 },
  emergency: { attack: 0.9, defend: 1.62, expand: 0.35, research: 0.2, logistics: 1.22, regroup: 1.2 },
  endgame: { attack: 1.6, defend: 0.82, expand: 1.08, research: 0.15, logistics: 0.65, regroup: 0.3 }
});

function normalizedContext(context = {}) {
  return {
    ownStrength: clamp(context.ownStrength),
    observedEnemyStrength: clamp(context.observedEnemyStrength),
    enemyPressure: clamp(context.enemyPressure),
    casualtyRatio: clamp(context.casualtyRatio),
    morale: clamp(context.morale ?? 0.65),
    supplyCondition: clamp(context.supplyCondition ?? 0.65),
    objectiveProgress: clamp(context.objectiveProgress),
    timePressure: clamp(context.timePressure),
    territoryOpportunity: clamp(context.territoryOpportunity),
    resourceShortage: clamp(context.resourceShortage),
    routeRisk: clamp(context.routeRisk),
    enemyCohesion: clamp(context.enemyCohesion ?? 0.75),
    enemyIsolation: clamp(context.enemyIsolation),
    breachProgress: clamp(context.breachProgress),
    corruptionCoverage: clamp(context.corruptionCoverage),
    ritualProgress: clamp(context.ritualProgress),
    intelligenceConfidence: clamp(context.intelligenceConfidence ?? 0.35),
    localStrengthRatio: Math.max(0, Number(context.localStrengthRatio) || 0),
    offensiveMomentum: clamp(context.offensiveMomentum ?? 0.5),
    overextension: clamp(context.overextension),
    shapingOpportunity: clamp(context.shapingOpportunity ?? 0.5),
    objectiveSecured: Boolean(context.objectiveSecured),
    newStrategicOpportunity: clamp(context.newStrategicOpportunity ?? context.territoryOpportunity)
  };
}

function shouldCommit(profile, context, plan) {
  if (profile.thresholds.ritualCommit && context.ritualProgress >= profile.thresholds.ritualCommit) return true;
  if (context.enemyIsolation >= 0.65 && context.localStrengthRatio >= (profile.thresholds.isolatedAssaultRatio || profile.thresholds.minimumAssaultRatio)) return true;
  const defensesSuppressed = context.breachProgress >= 0.65;
  const threshold = defensesSuppressed && profile.thresholds.minimumSuppressedAssaultRatio
    ? profile.thresholds.minimumSuppressedAssaultRatio
    : profile.thresholds.minimumAssaultRatio;
  const objectiveUrgency = context.timePressure * (1 - context.objectiveProgress);
  return context.localStrengthRatio >= threshold || objectiveUrgency >= 0.82 || plan?.id === "last_stand" && context.enemyPressure > 0.35;
}

function evaluatePhase(now, profile, plan, context, memory) {
  const phaseAge = now - memory.enteredAt;
  const catastrophicPressure = context.enemyPressure > 0.88 && context.ownStrength < context.observedEnemyStrength * 0.8;
  if (catastrophicPressure && memory.phase !== "emergency") return transitionChaosPhase(memory, "emergency", now, "catastrophic_pressure", 8);
  if (memory.phase === "endgame") return memory.phase;
  if (now < memory.planCommitUntil && !["emergency", "assess"].includes(memory.phase)) return memory.phase;
  switch (memory.phase) {
    case "assess":
      if (context.intelligenceConfidence >= profile.thresholds.minIntel || phaseAge >= 12) return transitionChaosPhase(memory, "shape", now, "battlefield_assessed", profile.commitmentSeconds * 0.5);
      break;
    case "shape":
      if (shouldCommit(profile, context, plan)) return transitionChaosPhase(memory, "commit", now, "attack_window", profile.commitmentSeconds);
      break;
    case "commit":
      if (context.enemyCohesion < 0.35 || context.breachProgress > 0.8) return transitionChaosPhase(memory, "exploit", now, "enemy_structure_broken", profile.commitmentSeconds * 0.65);
      if (context.offensiveMomentum < 0.22 && phaseAge > 10) {
        memory.failureCount += 1;
        return transitionChaosPhase(memory, "recover", now, "offensive_stalled", profile.commitmentSeconds * 0.6);
      }
      break;
    case "exploit":
      if (context.objectiveSecured) return transitionChaosPhase(memory, "consolidate", now, "objective_secured", profile.commitmentSeconds * 0.7);
      if (context.overextension > profile.thresholds.maxOverextension) return transitionChaosPhase(memory, "recover", now, "force_overextended", profile.commitmentSeconds * 0.5);
      break;
    case "consolidate":
      if (context.objectiveProgress > 0.88) return transitionChaosPhase(memory, "endgame", now, "victory_near", 999999);
      if (context.newStrategicOpportunity > 0.72) return transitionChaosPhase(memory, "shape", now, "new_operation", profile.commitmentSeconds * 0.5);
      break;
    case "recover":
      if (context.supplyCondition > 0.6 && context.localStrengthRatio > 0.95) return transitionChaosPhase(memory, "shape", now, "combat_power_restored", profile.commitmentSeconds * 0.4);
      break;
    case "emergency":
      if (context.enemyPressure < 0.55) return transitionChaosPhase(memory, "shape", now, "crisis_resolved", profile.commitmentSeconds * 0.5);
      break;
    default:
      return transitionChaosPhase(memory, "assess", now, "invalid_phase_reset", 0);
  }
  return memory.phase;
}

function strategicBiasFor(profile, phase, plan, context) {
  const result = { ...PHASE_BIAS[phase] };
  if (["Iron Warriors", "Death Guard", "Nurgle Host"].includes(plan?.subfaction)) {
    result.defend *= 1.12;
    result.logistics *= 1.08;
  }
  if (["Alpha Legion", "Night Lords", "Tzeentch Coven"].includes(plan?.subfaction) && phase === "shape") result.expand *= 1.16;
  if (["World Eaters", "Khorne Host"].includes(plan?.subfaction)) {
    result.attack *= 1.2;
    result.research *= 0.45;
  }
  if (["convoy_escort", "evacuation", "stronghold_defense"].includes(plan?.id)) {
    result.defend *= 1.25;
    result.logistics *= 1.2;
    if (context.objectiveProgress < 0.9) result.expand *= 0.72;
  }
  return result;
}

function constructionBiasFor(profile, phase) {
  const bias = {};
  const construction = profile.construction;
  for (const type of ["barracks", "workshop", "dropbay"]) bias[type] = construction.military * 32;
  for (const type of ["bunker", "turret", "observationtower"]) bias[type] = construction.fortification * 36;
  for (const type of ["warehouse", "refinery", "fueldepot", "ammodepot"]) bias[type] = construction.logistics * 30;
  bias.researchcenter = construction.research * 30 + construction.ritual * 22;
  if (phase === "commit" || phase === "exploit") {
    bias.barracks += 24;
    bias.workshop += 18;
    bias.researchcenter -= 26;
  }
  if (phase === "consolidate") {
    bias.bunker += 28;
    bias.turret += 22;
  }
  return bias;
}

export function evaluateChaosStrategy({ now = 0, player = {}, plan = {}, context = {}, memory = null } = {}) {
  const profile = chaosProfileFor(player.subfaction || plan.subfaction);
  const operationalMemory = memory || createChaosOperationalMemory({ enteredAt: now });
  const current = normalizedContext(context);
  const phase = evaluatePhase(now, profile, plan, current, operationalMemory);
  operationalMemory.primaryObjectiveId = plan.id || operationalMemory.primaryObjectiveId;
  operationalMemory.breachProgress = current.breachProgress;
  return {
    phase,
    reason: operationalMemory.lastReason,
    method: plan.method || profile.style,
    style: profile.style,
    profileId: profile.id,
    strategicBias: strategicBiasFor(profile, phase, plan, current),
    targetPolicy: { ...profile.priorities },
    constructionBias: constructionBiasFor(profile, phase),
    reservePolicy: {
      fraction: phase === "commit" || phase === "exploit" ? 0 : profile.reserveFraction,
      committed: operationalMemory.reserveCommitted,
      preserveCommandAssets: ["Thousand Sons", "Alpha Legion", "Black Legion"].includes(plan.subfaction)
    },
    memory: operationalMemory
  };
}

export function combineStrategicBias(primary = {}, secondary = {}) {
  const result = {};
  for (const key of new Set([...Object.keys(primary), ...Object.keys(secondary)])) result[key] = clamp((primary[key] ?? 1) * (secondary[key] ?? 1), 0.2, 2.4);
  return result;
}

export function chaosTargetMultiplier(strategy, target = {}, { visible = true } = {}) {
  if (!strategy || !visible) return visible ? 1 : 0;
  const policy = strategy.targetPolicy || {};
  const descriptor = `${target.role || ""} ${target.type || ""} ${target.name || ""}`.toLowerCase();
  const commander = /commander|warboss|captain|lord|ethereal|psyker|cryptek|synapse/.test(descriptor);
  const infrastructure = /outpost|headquarters|generator|warehouse|refinery|barracks|workshop|dropbay|bridge/.test(descriptor);
  const isolated = Number(target.nearbyAllies ?? 1) <= 0 || Number(target.objectiveDistanceRatio ?? 0) > 0.7;
  const strongEnemy = target.role === "vehicle" || target.role === "commander" || Number(target.maxHp) >= 180;
  let multiplier = 1;
  if (commander) multiplier += (policy.commander || 0) * 0.65;
  if (infrastructure) multiplier += (policy.infrastructure || 0) * 0.55;
  if (isolated) multiplier += (policy.isolated || 0) * 0.45;
  if (strongEnemy) multiplier += (policy.strongEnemy || 0) * 0.35;
  return multiplier;
}
