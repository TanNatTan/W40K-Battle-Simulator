export const SHARED_AI_SYSTEMS = Object.freeze([
  "combat", "economy", "territory", "pathfinding", "logistics", "squads", "morale", "learning"
]);

export const STRATEGIC_CHOICES = Object.freeze(["attack", "defend", "expand", "research", "logistics", "regroup"]);

export const FALLBACK_FACTION_BRANCHES = Object.freeze({
  "Space Marines": { behavior: { aggression: 58, caution: 54, expansion: 44, economy: 48 }, weights: { attack: 1.05, defend: 1, expand: 0.82, research: 1.05, logistics: 0.9, melee: 0.85, ranged: 1.1, vehicles: 0.95, swarm: 0.25 }, identity: { elite: 0.9, discipline: 0.9 } },
  "Imperial Guard": { behavior: { aggression: 46, caution: 62, expansion: 56, economy: 68 }, weights: { attack: 0.92, defend: 1.15, expand: 1, research: 0.8, logistics: 1.25, melee: 0.45, ranged: 1.15, vehicles: 1.2, swarm: 0.72 }, identity: { attrition: 0.82, artillery: 0.85 } },
  "Adeptus Mechanicus": { behavior: { aggression: 48, caution: 66, expansion: 52, economy: 78 }, weights: { attack: 0.94, defend: 1.12, expand: 0.92, research: 1.4, logistics: 1.18, melee: 0.52, ranged: 1.22, vehicles: 1.32, swarm: 0.35 }, identity: { technology: 1, machinePreservation: 0.94, noosphere: 0.96 } },
  Chaos: { behavior: { aggression: 72, caution: 34, expansion: 54, economy: 42 }, weights: { attack: 1.22, defend: 0.72, expand: 0.98, research: 0.88, logistics: 0.7, melee: 1.18, ranged: 0.9, vehicles: 0.9, swarm: 0.62 }, identity: { ritual: 0.86, aggression: 0.84 } },
  Orks: { behavior: { aggression: 88, caution: 18, expansion: 68, economy: 28 }, weights: { attack: 1.38, defend: 0.52, expand: 1.12, research: 0.45, logistics: 0.62, melee: 1.4, ranged: 0.72, vehicles: 1.08, swarm: 1.25 }, identity: { waaagh: 1, melee: 0.95 } },
  Necrons: { behavior: { aggression: 52, caution: 68, expansion: 42, economy: 66 }, weights: { attack: 0.96, defend: 1.2, expand: 0.75, research: 1.32, logistics: 0.72, melee: 0.72, ranged: 1.12, vehicles: 1.1, swarm: 0.45 }, identity: { reanimation: 1, durability: 0.94 } },
  Tau: { behavior: { aggression: 42, caution: 74, expansion: 60, economy: 64 }, weights: { attack: 0.86, defend: 1.06, expand: 1.08, research: 1.18, logistics: 1.1, melee: 0.28, ranged: 1.42, vehicles: 1.15, swarm: 0.32 }, identity: { ranged: 1, meleeAvoidance: 1 } },
  Tyranids: { behavior: { aggression: 78, caution: 24, expansion: 86, economy: 36 }, weights: { attack: 1.24, defend: 0.58, expand: 1.38, research: 0.55, logistics: 0.45, melee: 1.22, ranged: 0.7, vehicles: 0.72, swarm: 1.5 }, identity: { swarm: 1, adaptation: 0.94, synapse: 1 } }
});

function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function normalize(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }

export function raceBranchFor(player = {}) {
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

function subfactionProfile(subfaction, catalog) {
  const key = normalize(subfaction);
  if (!key) return {};
  return Object.entries(catalog?.subfactions || {}).find(([name]) => key.includes(normalize(name)) || normalize(name).includes(key))?.[1] || {};
}

export function resolveFactionAIProfile(player = {}, catalog = globalThis.AWTData?.factionAI, doctrineDatabase = globalThis.AWTData?.warfareDoctrines) {
  const branch = raceBranchFor(player);
  const raceProfile = catalog?.races?.[branch] || FALLBACK_FACTION_BRANCHES[branch];
  const subProfile = subfactionProfile(player.subfaction, catalog);
  const doctrine = resolveWarfareDoctrine(player, doctrineDatabase, { branch, ...raceProfile, identity: { ...raceProfile.identity, ...(subProfile.identity || {}) } });
  const modifiers = doctrine.modifiers;
  return {
    id: `${branch}:${player.subfaction || "default"}`,
    branch,
    subfaction: player.subfaction || "default",
    sharedCore: SHARED_AI_SYSTEMS,
    behavior: {
      aggression: modifiers.aggression * 100,
      caution: (modifiers.preservation * 0.65 + modifiers.defense * 0.35) * 100,
      expansion: modifiers.expansion * 100,
      economy: (modifiers.techPreservation * 0.55 + modifiers.lootSalvage * 0.25 + modifiers.objectiveFocus * 0.2) * 100,
      ...(subProfile.behavior || {})
    },
    weights: { ...raceProfile.weights, ...(subProfile.weights || {}) },
    identity: { ...raceProfile.identity, ...(subProfile.identity || {}) },
    doctrine
  };
}

export function enforceFactionIdentity(profile, weights) {
  const bounded = { ...profile.weights };
  for (const [key, base] of Object.entries(profile.weights)) bounded[key] = clamp(weights[key] ?? base, base * 0.8, base * 1.2);
  if (profile.branch === "Orks") { bounded.melee = Math.max(bounded.melee, 1.12); bounded.attack = Math.max(bounded.attack, 1.1); }
  if (profile.branch === "Tau") { bounded.melee = Math.min(bounded.melee, 0.42); bounded.ranged = Math.max(bounded.ranged, 1.18); }
  if (profile.branch === "Tyranids") { bounded.swarm = Math.max(bounded.swarm, 1.2); bounded.expand = Math.max(bounded.expand, 1.1); }
  if (profile.branch === "Necrons") bounded.research = Math.max(bounded.research, 1.05);
  return bounded;
}

export function scoreStrategicChoices(profile, context = {}, learnedWeights = {}) {
  const weights = enforceFactionIdentity(profile, { ...profile.weights, ...learnedWeights });
  const ownStrength = clamp(context.ownStrength ?? 0.5, 0, 1);
  const enemyStrength = clamp(context.observedEnemyStrength ?? 0, 0, 1);
  const pressure = clamp(context.enemyPressure ?? 0, 0, 1);
  const shortage = clamp(context.resourceShortage ?? 0, 0, 1);
  const territory = clamp(context.territoryOpportunity ?? 0.5, 0, 1);
  const routeRisk = clamp(context.routeRisk ?? 0, 0, 1);
  const casualtyRatio = clamp(context.casualtyRatio ?? 0, 0, 1);
  const scores = {
    attack: (38 + ownStrength * 42 - enemyStrength * 18 - casualtyRatio * 22) * weights.attack,
    defend: (24 + pressure * 58 + enemyStrength * 18 + casualtyRatio * 12) * weights.defend,
    expand: (26 + territory * 48 - pressure * 20) * weights.expand,
    research: (22 + (1 - pressure) * 34 + ownStrength * 12) * weights.research,
    logistics: (20 + shortage * 62 + routeRisk * 42) * weights.logistics,
    regroup: 12 + casualtyRatio * 78 + Math.max(0, enemyStrength - ownStrength) * 54
  };
  const objectiveBias = context.objectiveBias || {};
  for (const choice of STRATEGIC_CHOICES) {
    scores[choice] *= clamp(objectiveBias[choice] ?? 1, 0.35, 1.8);
    if (profile.doctrine?.modifiers) scores[choice] += scoreTacticalOpportunity(
      profile.doctrine.modifiers,
      strategicOpportunityFor(choice, context, objectiveBias),
      context
    ) * 22;
  }
  return scores;
}

function strategicOpportunityFor(choice, context, objectiveBias) {
  const own = clamp(context.ownStrength ?? 0.5, 0, 1);
  const enemy = clamp(context.observedEnemyStrength ?? 0.5, 0, 1);
  const pressure = clamp(context.enemyPressure, 0, 1);
  const shortage = clamp(context.resourceShortage, 0, 1);
  const territory = clamp(context.territoryOpportunity ?? 0.5, 0, 1);
  const routeRisk = clamp(context.routeRisk, 0, 1);
  const casualties = clamp(context.casualtyRatio, 0, 1);
  const objectiveGain = clamp((objectiveBias[choice] ?? 1) / 1.8, 0, 1);
  const base = {
    objectiveGain,
    enemyDamagePotential: 0,
    defensiveGain: 0,
    territorialGain: 0,
    salvageGain: 0,
    expectedFriendlyLoss: casualties,
    expectedTechLoss: 0,
    mobilityGain: 0,
    isolationRisk: 0,
    supplyRisk: routeRisk,
    counterAttackRisk: pressure,
    distanceFromObjective: clamp(1 - objectiveGain)
  };
  if (choice === "attack") return { ...base, enemyDamagePotential: clamp(own * 0.55 + enemy * 0.45), territorialGain: territory * 0.25, salvageGain: enemy * 0.3, expectedFriendlyLoss: clamp(casualties + Math.max(0, enemy - own) * 0.7), expectedTechLoss: enemy * 0.35, isolationRisk: routeRisk * 0.7, mobilityGain: territory * 0.25 };
  if (choice === "defend") return { ...base, defensiveGain: clamp(pressure * 0.75 + 0.25), expectedFriendlyLoss: casualties * 0.55, expectedTechLoss: pressure * 0.2, isolationRisk: 0.1, supplyRisk: routeRisk * 0.45, counterAttackRisk: pressure * 0.25 };
  if (choice === "expand") return { ...base, territorialGain: territory, salvageGain: territory * 0.4, mobilityGain: territory * 0.55, expectedFriendlyLoss: enemy * 0.25, expectedTechLoss: routeRisk * 0.25, isolationRisk: clamp(routeRisk * 0.7 + pressure * 0.35), supplyRisk: routeRisk };
  if (choice === "research") return { ...base, defensiveGain: 0.25, salvageGain: 0.15, expectedFriendlyLoss: pressure * 0.2, expectedTechLoss: pressure * 0.55, isolationRisk: 0, supplyRisk: shortage * 0.3, counterAttackRisk: pressure * 0.65 };
  if (choice === "logistics") return { ...base, defensiveGain: shortage * 0.5, territorialGain: territory * 0.15, salvageGain: shortage * 0.35, expectedFriendlyLoss: routeRisk * 0.3, expectedTechLoss: routeRisk * 0.2, mobilityGain: 0.35, isolationRisk: routeRisk * 0.2, supplyRisk: shortage * 0.15, counterAttackRisk: pressure * 0.35 };
  return { ...base, defensiveGain: clamp(casualties + pressure * 0.45), expectedFriendlyLoss: casualties * 0.15, expectedTechLoss: pressure * 0.15, mobilityGain: 0.25, isolationRisk: 0.08, supplyRisk: shortage * 0.35, counterAttackRisk: pressure * 0.2 };
}

export function selectStrategicChoice(profile, context = {}, learnedWeights = {}) {
  const scores = scoreStrategicChoices(profile, context, learnedWeights);
  let choice = STRATEGIC_CHOICES[0];
  let score = scores[choice];
  for (let index = 1; index < STRATEGIC_CHOICES.length; index += 1) {
    const candidate = STRATEGIC_CHOICES[index];
    if (scores[candidate] > score) {
      choice = candidate;
      score = scores[candidate];
    }
  }
  return { choice, score, scores, profileId: profile.id };
}

export function branchBehaviorFor(player, catalog = globalThis.AWTData?.factionAI) {
  return resolveFactionAIProfile(player, catalog).behavior;
}
import { resolveWarfareDoctrine, scoreTacticalOpportunity } from "./WarfareDoctrineSystem.js";
