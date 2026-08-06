export const SHARED_AI_SYSTEMS = Object.freeze([
  "combat", "economy", "territory", "pathfinding", "logistics", "squads", "morale", "learning"
]);

export const STRATEGIC_CHOICES = Object.freeze(["attack", "defend", "expand", "research", "logistics", "regroup"]);

export const FALLBACK_FACTION_BRANCHES = Object.freeze({
  "Space Marines": { behavior: { aggression: 58, caution: 54, expansion: 44, economy: 48 }, weights: { attack: 1.05, defend: 1, expand: 0.82, research: 1.05, logistics: 0.9, melee: 0.85, ranged: 1.1, vehicles: 0.95, swarm: 0.25 }, identity: { elite: 0.9, discipline: 0.9 } },
  "Imperial Guard": { behavior: { aggression: 46, caution: 62, expansion: 56, economy: 68 }, weights: { attack: 0.92, defend: 1.15, expand: 1, research: 0.8, logistics: 1.25, melee: 0.45, ranged: 1.15, vehicles: 1.2, swarm: 0.72 }, identity: { attrition: 0.82, artillery: 0.85 } },
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
  if (faction.includes("spacemarine")) return "Space Marines";
  if (faction.includes("imperialguard")) return "Imperial Guard";
  if (race.includes("chaos")) return "Chaos";
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

export function resolveFactionAIProfile(player = {}, catalog = globalThis.AWTData?.factionAI) {
  const branch = raceBranchFor(player);
  const raceProfile = catalog?.races?.[branch] || FALLBACK_FACTION_BRANCHES[branch];
  const subProfile = subfactionProfile(player.subfaction, catalog);
  return {
    id: `${branch}:${player.subfaction || "default"}`,
    branch,
    subfaction: player.subfaction || "default",
    sharedCore: SHARED_AI_SYSTEMS,
    behavior: { ...raceProfile.behavior, ...(subProfile.behavior || {}) },
    weights: { ...raceProfile.weights, ...(subProfile.weights || {}) },
    identity: { ...raceProfile.identity, ...(subProfile.identity || {}) }
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
  return {
    attack: (38 + ownStrength * 42 - enemyStrength * 18 - casualtyRatio * 22) * weights.attack,
    defend: (24 + pressure * 58 + enemyStrength * 18 + casualtyRatio * 12) * weights.defend,
    expand: (26 + territory * 48 - pressure * 20) * weights.expand,
    research: (22 + (1 - pressure) * 34 + ownStrength * 12) * weights.research,
    logistics: (20 + shortage * 62 + routeRisk * 42) * weights.logistics,
    regroup: 12 + casualtyRatio * 78 + Math.max(0, enemyStrength - ownStrength) * 54
  };
}

export function selectStrategicChoice(profile, context = {}, learnedWeights = {}) {
  const scores = scoreStrategicChoices(profile, context, learnedWeights);
  const [choice, score] = Object.entries(scores).sort((a, b) => b[1] - a[1] || STRATEGIC_CHOICES.indexOf(a[0]) - STRATEGIC_CHOICES.indexOf(b[0]))[0];
  return { choice, score, scores, profileId: profile.id };
}

export function branchBehaviorFor(player, catalog = globalThis.AWTData?.factionAI) {
  return resolveFactionAIProfile(player, catalog).behavior;
}
