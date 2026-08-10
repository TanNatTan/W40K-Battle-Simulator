const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export const DOCTRINE_MODIFIER_FIELDS = Object.freeze([
  "aggression", "defense", "expansion", "lootSalvage", "objectiveFocus", "preservation", "techPreservation", "mobility"
]);

export const ACTIVITY_RATE_MULTIPLIER = Object.freeze({
  critical: 1.25,
  active: 1,
  nearby: 0.65,
  distant: 0.3,
  dormant: 0.15
});

export const DEFAULT_TICK_PROFILE = Object.freeze({
  coreHz: 30,
  activeCombatSubsteps: 2,
  perceptionHz: 10,
  squadAIHz: 8,
  commanderAIHz: 3,
  strategyHz: 1
});

const RACE_KEYS = Object.freeze({
  "Space Marines": "space_marines",
  "Imperial Guard": "imperial_guard",
  "Adeptus Mechanicus": "adeptus_mechanicus",
  Chaos: "chaos",
  Orks: "orks",
  Necrons: "necrons",
  Tau: "tau",
  Tyranids: "tyranids"
});

function branchFor(player = {}) {
  const race = normalize(player.race);
  const faction = normalize(player.faction);
  if (race.includes("chaos")) return "Chaos";
  if (faction.includes("spacemarine")) return "Space Marines";
  if (faction.includes("imperialguard")) return "Imperial Guard";
  if (faction.includes("machinecult") || faction.includes("mechanicus")) return "Adeptus Mechanicus";
  if (race.includes("ork")) return "Orks";
  if (race.includes("necron")) return "Necrons";
  if (race.includes("tau")) return "Tau";
  if (race.includes("tyranid")) return "Tyranids";
  return "Space Marines";
}

function matchingSubfaction(entries = {}, value = "") {
  const wanted = normalize(value);
  if (!wanted) return null;
  return Object.entries(entries).find(([key]) => wanted.includes(normalize(key)) || normalize(key).includes(wanted)) || null;
}

function fallbackModifiers(profile = {}) {
  const behavior = profile.behavior || {};
  const weights = profile.weights || {};
  return {
    aggression: clamp((behavior.aggression ?? 50) / 100),
    defense: clamp((weights.defend ?? 1) / 1.5),
    expansion: clamp((behavior.expansion ?? 50) / 100),
    lootSalvage: 0.25,
    objectiveFocus: 0.82,
    preservation: clamp((behavior.caution ?? 50) / 100),
    techPreservation: clamp((weights.research ?? 1) / 1.5),
    mobility: clamp(profile.identity?.mobility ?? 0.55)
  };
}

export function resolveWarfareDoctrine(player = {}, database = globalThis.AWTData?.warfareDoctrines, baseProfile = {}) {
  const branch = baseProfile.branch || branchFor(player);
  const raceKey = RACE_KEYS[branch] || "space_marines";
  const raceInterpretation = database?.objectiveInterpretation?.[raceKey] || {};
  const match = matchingSubfaction(database?.subfactions?.[raceKey], player.subfaction);
  const source = match?.[1] || {};
  const modifiers = {};
  const fallback = fallbackModifiers(baseProfile);
  for (const field of DOCTRINE_MODIFIER_FIELDS) modifiers[field] = clamp(source[field] ?? fallback[field]);
  const tickProfileId = source.tick || "elite_balanced";
  const tickProfile = { ...DEFAULT_TICK_PROFILE, ...(database?.tickProfiles?.[tickProfileId] || {}) };
  return Object.freeze({
    raceKey,
    branch,
    subfactionKey: match?.[0] || "race_default",
    loreStatus: source.loreStatus || "unspecified",
    modifiers: Object.freeze(modifiers),
    objectiveInterpretation: Object.freeze({ ...raceInterpretation }),
    tickProfileId,
    tickProfile: Object.freeze(tickProfile)
  });
}

export function effectiveObjectiveFocus(base, scoreDeficit01 = 0, timeRemaining01 = 1) {
  const comebackPressure = clamp(scoreDeficit01) * (1 - clamp(timeRemaining01));
  return clamp(clamp(base) + comebackPressure * 0.35);
}

export function scoreTacticalOpportunity(ai = {}, opportunity = {}, context = {}) {
  const objectiveFocus = effectiveObjectiveFocus(ai.objectiveFocus, context.scoreDeficit01, context.timeRemaining01);
  const reward =
    clamp(opportunity.objectiveGain) * objectiveFocus * 2
    + clamp(opportunity.enemyDamagePotential) * clamp(ai.aggression)
    + clamp(opportunity.defensiveGain) * clamp(ai.defense)
    + clamp(opportunity.territorialGain) * clamp(ai.expansion)
    + clamp(opportunity.salvageGain) * clamp(ai.lootSalvage)
    + clamp(opportunity.mobilityGain) * clamp(ai.mobility);
  const cost =
    clamp(opportunity.expectedFriendlyLoss) * clamp(ai.preservation)
    + clamp(opportunity.expectedTechLoss) * clamp(ai.techPreservation)
    + clamp(opportunity.isolationRisk) * (0.35 + clamp(ai.preservation) * 0.65)
    + clamp(opportunity.supplyRisk) * 0.7
    + clamp(opportunity.counterAttackRisk) * clamp(ai.defense) * 0.5
    + clamp(opportunity.distanceFromObjective) * objectiveFocus;
  return reward - cost;
}

export function objectiveInterpretationMethod(interpretation = {}, objective = {}) {
  const id = String(objective.id || "");
  const category = String(objective.category || "");
  if (/breakthrough|stronghold_assault/.test(id)) return interpretation.breakthrough || interpretation.destroy || interpretation.method;
  if (/recover|relic|evacuation|convoy_escort/.test(`${id} ${category}`)) return interpretation.recover || interpretation.capture || interpretation.method;
  if (/defend|last_stand/.test(`${id} ${category}`)) return interpretation.defend || interpretation.method;
  if (/capture|control|territor|resource/.test(`${id} ${category}`)) return interpretation.capture || interpretation.method;
  if (/destroy|annihilation|assassination/.test(`${id} ${category}`)) return interpretation.destroy || interpretation.method;
  return interpretation.method || "adaptive_operation";
}

export function activityRateMultiplier(activity = "active") {
  return ACTIVITY_RATE_MULTIPLIER[activity] ?? ACTIVITY_RATE_MULTIPLIER.active;
}

export class RateGate {
  constructor() {
    this.states = new Map();
    this.immediate = new Set();
  }

  requestImmediate(key) {
    this.immediate.add(String(key));
  }

  shouldRun(key, hz, fixedDt, multiplier = 1) {
    const id = String(key);
    if (this.immediate.delete(id)) return true;
    const rate = Math.max(0, Number(hz) || 0) * Math.max(0, Number(multiplier) || 0);
    if (rate <= 0) return false;
    const state = this.states.get(id) || { elapsed: 0 };
    state.elapsed += Math.max(0, Number(fixedDt) || 0);
    const interval = 1 / rate;
    if (state.elapsed + Number.EPSILON >= interval) {
      state.elapsed %= interval;
      this.states.set(id, state);
      return true;
    }
    this.states.set(id, state);
    return false;
  }

  reset() {
    this.states.clear();
    this.immediate.clear();
  }
}
