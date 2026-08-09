const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const FORCE_DENSITY = Object.freeze({
  "Space Marines": 0.55,
  "Imperial Guard": 1.35,
  Orks: 1.5,
  Tyranids: 1.8,
  Necrons: 0.8,
  "T'au": 0.75,
  Chaos: 0.95
});

export const COMMITMENT_STAGES = Object.freeze({
  contact: Object.freeze({ commitment: 0.35, label: "Contact" }),
  engagement: Object.freeze({ commitment: 0.58, label: "Engagement" }),
  major: Object.freeze({ commitment: 0.78, label: "Major Battle" }),
  decisive: Object.freeze({ commitment: 0.93, label: "Decisive Commitment" }),
  "all-in": Object.freeze({ commitment: 1, label: "All-In" })
});

export function forceProfileKey(player = {}) {
  if (player.faction === "Space Marines" || player.faction === "Imperial Guard") return player.faction;
  if (player.race === "Tau") return "T'au";
  return FORCE_DENSITY[player.race] ? player.race : FORCE_DENSITY[player.faction] ? player.faction : "Space Marines";
}

export function forceDensityFor(player) {
  return FORCE_DENSITY[forceProfileKey(player)] || 1;
}

export function allocateForceCaps(players = [], targetUnits = 0, minimum = 4) {
  const totalDensity = players.reduce((sum, player) => sum + forceDensityFor(player), 0);
  const entries = players.map(player => [player.id, Math.max(minimum, Math.round(Math.max(0, targetUnits) * forceDensityFor(player) / Math.max(0.01, totalDensity))), forceDensityFor(player)]);
  let remainder = Math.max(0, Math.round(targetUnits)) - entries.reduce((sum, [, cap]) => sum + cap, 0);
  const ranked = [...entries].sort((first, second) => second[2] - first[2]);
  for (let index = 0; remainder !== 0 && ranked.length; index = (index + 1) % ranked.length) {
    if (remainder > 0) { ranked[index][1] += 1; remainder -= 1; }
    else if (ranked[index][1] > minimum) { ranked[index][1] -= 1; remainder += 1; }
  }
  return Object.fromEntries(entries.map(([id, cap]) => [id, cap]));
}

export function shouldCommitEverything(context = {}) {
  return Number(context.headquartersThreat) >= 0.75
    || Boolean(context.lastCriticalObjectiveContested)
    || Boolean(context.enemyNearVictory)
    || Number(context.timeRemainingRatio ?? 1) <= 0.15
    || Boolean(context.forceDefeatImminent)
    || Number(context.victoryOpportunity) >= 0.85;
}

export function determineCommitment(context = {}) {
  if (shouldCommitEverything(context)) return "all-in";
  const score = clamp(Number(context.objectiveImportance) || 0, 0, 1) * 0.22
    + clamp(Number(context.enemyStrengthPressure) || 0, 0, 1) * 0.18
    + clamp(Number(context.territoryPressure) || 0, 0, 1) * 0.14
    + clamp(Number(context.casualtyPressure) || 0, 0, 1) * 0.12
    + clamp(Number(context.headquartersThreat) || 0, 0, 1) * 0.18
    + clamp(Number(context.timePressure) || 0, 0, 1) * 0.08
    + clamp(Number(context.victoryProximity) || 0, 0, 1) * 0.08;
  if (score >= 0.7) return "decisive";
  if (score >= 0.48) return "major";
  if (score >= 0.24) return "engagement";
  return "contact";
}

export function createForceState(stage = "contact") {
  const resolved = COMMITMENT_STAGES[stage] || COMMITMENT_STAGES.contact;
  return { fieldedStrength: 0, reserveStrength: 0, reinforcementCapacity: 0, commitment: resolved.commitment, commitmentStage: stage, allIn: stage === "all-in" };
}

export function updateForceState(previous = {}, context = {}) {
  const commitmentStage = determineCommitment(context);
  const stage = COMMITMENT_STAGES[commitmentStage];
  return { ...previous, commitmentStage, commitment: stage.commitment, allIn: commitmentStage === "all-in" };
}

export const COMMAND_PRESENCE = Object.freeze({
  "Space Marines": Object.freeze({ contact: "Sergeant", engagement: "Lieutenant", major: "Captain", decisive: "Captain", "all-in": "Chapter Master" }),
  "Imperial Guard": Object.freeze({ contact: "Sergeant", engagement: "Junior Officer", major: "Regimental Officer", decisive: "General", "all-in": "Lord Commander" }),
  Orks: Object.freeze({ contact: "Boss Nob", engagement: "Boss Nob", major: "Warboss", decisive: "Warboss", "all-in": "Warboss" }),
  Tyranids: Object.freeze({ contact: "Tyranid Warrior", engagement: "Tyranid Prime", major: "Hive Tyrant", decisive: "Neurotyrant", "all-in": "Swarmlord" }),
  Necrons: Object.freeze({ contact: "Royal Warden", engagement: "Lord", major: "Overlord", decisive: "Overlord", "all-in": "Dynastic Ruler" }),
  "T'au": Object.freeze({ contact: "Shas'ui", engagement: "Fireblade", major: "Battlesuit Commander", decisive: "Battlesuit Commander", "all-in": "Senior Ethereal" }),
  Chaos: Object.freeze({ contact: "Aspiring Champion", engagement: "Aspiring Champion", major: "Chaos Lord", decisive: "Sorcerer", "all-in": "Daemon Prince" })
});

export function commandPresenceFor(player, stage = "contact", scenarioTags = []) {
  const key = forceProfileKey(player);
  if (key === "Space Marines" && stage === "all-in") {
    const exceptional = new Set(["chapter-homeworld-threatened", "chapter-relic-at-risk", "chapter-level-offensive", "enemy-supreme-commander-present", "existential-threat"]);
    if (!scenarioTags.some(tag => exceptional.has(tag))) return "Captain";
  }
  return COMMAND_PRESENCE[key]?.[stage] || "Field Commander";
}
