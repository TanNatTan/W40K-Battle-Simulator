import { raceBranchFor, resolveFactionAIProfile } from "./FactionAISystem.js";

export const DEFAULT_BATTLE_OBJECTIVE = "annihilation";

const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function matchingSubfaction(player, catalog) {
  const wanted = normalize(player?.subfaction);
  if (!wanted) return {};
  return Object.entries(catalog?.subfactionModifiers || {})
    .find(([name]) => wanted.includes(normalize(name)) || normalize(name).includes(wanted))?.[1] || {};
}

export function normalizeBattleObjectiveId(value, catalog = globalThis.AWTData?.battleObjectives) {
  return catalog?.objectives?.[value] ? value : catalog?.defaultObjective || DEFAULT_BATTLE_OBJECTIVE;
}

export function objectiveOptionsFor(player, catalog = globalThis.AWTData?.battleObjectives) {
  const branch = raceBranchFor(player);
  const interpretation = catalog?.raceInterpretations?.[branch] || {};
  return Object.entries(catalog?.objectives || {}).map(([id, objective]) => ({
    id,
    name: interpretation.names?.[id] || objective.name,
    universalName: objective.name,
    category: objective.category,
    summary: objective.summary
  }));
}

export function resolveBattleObjectivePlan(player, profile = resolveFactionAIProfile(player), catalog = globalThis.AWTData?.battleObjectives) {
  const id = normalizeBattleObjectiveId(player?.battleObjective, catalog);
  const objective = catalog?.objectives?.[id] || {};
  const branch = profile?.branch || raceBranchFor(player);
  const interpretation = catalog?.raceInterpretations?.[branch] || {};
  const subfaction = matchingSubfaction(player, catalog);
  const signals = { ...(objective.aiSignals || {}) };
  for (const [signal, modifier] of Object.entries(interpretation.signalModifiers || {})) signals[signal] = clamp((signals[signal] || 0) + modifier);
  for (const [signal, modifier] of Object.entries(subfaction.signals || {})) signals[signal] = clamp((signals[signal] || 0) + modifier);
  return {
    id,
    name: interpretation.names?.[id] || objective.name || id,
    universalName: objective.name || id,
    category: objective.category || "control",
    summary: objective.summary || "Complete the selected battle objective.",
    metric: objective.metric || "enemyElimination",
    threshold: clamp(objective.threshold ?? 1),
    holdSeconds: Math.max(0, Number(objective.holdSeconds) || 0),
    durationSeconds: Math.max(0, Number(objective.durationSeconds) || 0),
    method: subfaction.objectiveMethods?.[id] || subfaction.method || interpretation.methods?.[id] || interpretation.defaultMethod || "adaptive_operation",
    signals,
    behaviorModifiers: { ...(subfaction.behavior || {}) },
    branch,
    subfaction: player?.subfaction || "default"
  };
}

export function deriveDynamicAIBehavior(profile, plan, context = {}) {
  const base = profile?.behavior || { aggression: 50, caution: 50, expansion: 50, economy: 50 };
  const signals = plan?.signals || {};
  const modifier = plan?.behaviorModifiers || {};
  const casualties = clamp(context.casualtyRatio);
  const morale = clamp(context.morale ?? 0.65);
  const supply = clamp(context.supplyCondition ?? 0.65);
  const pressure = clamp(context.enemyPressure);
  const enemyWeakness = clamp(context.enemyWeakness);
  const territoryOpportunity = clamp(context.territoryOpportunity ?? 0.5);
  const shortage = clamp(context.resourceShortage);
  const routeRisk = clamp(context.routeRisk);
  const timePressure = clamp(context.timePressure);
  const enemyAggression = clamp(context.enemyAggression);
  const enemyCaution = clamp(context.enemyCaution);
  const enemyExpansion = clamp(context.enemyExpansion);
  return {
    aggression: clamp(
      base.aggression * 0.48 + (signals.attack || 0) * 40 + enemyWeakness * 13 + timePressure * 8
      + enemyCaution * 7 - casualties * (signals.preservation || 0) * 17 - pressure * 5 + (modifier.aggression || 0), 8, 96
    ),
    caution: clamp(
      base.caution * 0.45 + (signals.defense || 0) * 18 + (signals.preservation || 0) * 25
      + casualties * 15 + (1 - morale) * 14 + routeRisk * 8 + enemyAggression * 8 - timePressure * 7 + (modifier.caution || 0), 8, 96
    ),
    expansion: clamp(
      base.expansion * 0.42 + (signals.expansion || 0) * 42 + territoryOpportunity * 15
      + shortage * (signals.economy || 0) * 8 + enemyExpansion * 4 - pressure * 9 + (modifier.expansion || 0), 5, 96
    ),
    economy: clamp(
      base.economy * 0.42 + (signals.economy || 0) * 34 + (signals.logistics || 0) * 20
      + shortage * 18 + (1 - supply) * 12 - pressure * 7 + (modifier.economy || 0), 5, 96
    )
  };
}

export function objectiveStrategicBias(plan, context = {}) {
  const signals = plan?.signals || {};
  const progress = clamp(context.objectiveProgress);
  const urgency = clamp(context.timePressure) * (1 - progress);
  return {
    attack: 0.65 + (signals.attack || 0) * 0.75 + urgency * 0.2,
    defend: 0.65 + (signals.defense || 0) * 0.72 + (signals.preservation || 0) * 0.18,
    expand: 0.62 + (signals.expansion || 0) * 0.82,
    research: 0.7 + (signals.economy || 0) * 0.42,
    logistics: 0.65 + (signals.logistics || 0) * 0.76,
    regroup: 0.7 + (signals.preservation || 0) * 0.5
  };
}

export function objectiveTargetBias(plan, target = {}) {
  const signals = plan?.signals || {};
  const role = String(target.role || "").toLowerCase();
  const type = String(target.type || "").toLowerCase();
  const commander = role === "commander" || /warboss|ethereal|psyker|cryptek|synapse/.test(`${role} ${target.name || ""}`.toLowerCase());
  const headquarters = /outpost|headquarters|command/.test(type);
  const infrastructure = /outpost|generator|barracks|workshop|warehouse|refinery|dropbay|observationtower|bridge/.test(type);
  const convoy = Boolean(target.cargo || target.trade || target.supplyRouteId);
  let multiplier = 1;
  if (commander) multiplier += (signals.targetCommand || 0) * 0.75;
  if (infrastructure) multiplier += (signals.targetInfrastructure || 0) * 0.65;
  if (headquarters && ["headquarters_destruction", "stronghold_assault"].includes(plan?.id)) multiplier += 1.2;
  if (commander && plan?.id === "assassination") multiplier += 1.1;
  if (infrastructure && plan?.id === "sabotage") multiplier += 0.9;
  if (convoy && plan?.id === "convoy_interdiction") multiplier += 0.9;
  if (plan?.id === "stronghold_defense" && distanceFromProtectedTarget(target) > 0.75) multiplier *= 0.72;
  return multiplier;
}

function distanceFromProtectedTarget(target) {
  return clamp(target.objectiveDistanceRatio ?? 0);
}

export function evaluateBattleObjective(plan, context = {}, previous = {}) {
  const valid = context.valid !== false && Number.isFinite(Number(context[plan.metric]));
  const value = valid ? clamp(context[plan.metric]) : 0;
  const threshold = clamp(plan.threshold ?? 1);
  const now = Math.max(0, Number(context.elapsedSeconds) || 0);
  let holdStartedAt = previous.holdStartedAt ?? null;
  if (value >= threshold) holdStartedAt ??= now;
  else holdStartedAt = null;
  const heldFor = holdStartedAt == null ? 0 : Math.max(0, now - holdStartedAt);
  const requiredHold = Math.max(0, Number(plan.holdSeconds) || 0);
  const complete = valid && value >= threshold && heldFor >= requiredHold;
  return {
    objectiveId: plan.id,
    metric: plan.metric,
    valid,
    progress: threshold > 0 ? clamp(value / threshold) : value,
    value,
    threshold,
    holdStartedAt,
    heldFor,
    requiredHold,
    complete,
    completedAt: complete ? previous.completedAt ?? now : null
  };
}
