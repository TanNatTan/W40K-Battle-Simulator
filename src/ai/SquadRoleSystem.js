export const SQUAD_ROLES = Object.freeze([
  "base-defense",
  "economy-defense",
  "territory-defense",
  "reinforcement",
  "offensive",
  "capture",
  "reconnaissance",
  "route-security",
  "ambush",
  "reserve",
  "escort",
  "medical-support",
  "siege"
]);

export const SQUAD_ROLE_DEFINITIONS = Object.freeze({
  "base-defense": Object.freeze({ label: "Base Defense", color: "#3B82F6", secondary: "reinforcement", detachPermission: false, returnAfterMission: true, engagementRadius: 150, formations: ["defensive-ring", "line", "circle"] }),
  "economy-defense": Object.freeze({ label: "Guard Economy", color: "#0EA5A4", secondary: "base-defense", detachPermission: false, returnAfterMission: true, engagementRadius: 110, formations: ["defensive-ring", "staggered", "line"] }),
  "territory-defense": Object.freeze({ label: "Territory Defense", color: "#2563EB", secondary: "route-security", detachPermission: true, returnAfterMission: true, engagementRadius: 165, formations: ["line", "staggered", "defensive-ring"] }),
  reinforcement: Object.freeze({ label: "Reinforcement", color: "#22C55E", secondary: "reserve", detachPermission: true, returnAfterMission: true, engagementRadius: 190, formations: ["column", "wedge", "triangle"] }),
  offensive: Object.freeze({ label: "Offensive", color: "#EF4444", secondary: "capture", detachPermission: true, returnAfterMission: false, engagementRadius: Infinity, formations: ["wedge", "line", "flanking"] }),
  capture: Object.freeze({ label: "Capture", color: "#EAB308", secondary: "reconnaissance", detachPermission: true, returnAfterMission: true, engagementRadius: 125, formations: ["column", "wedge", "triangle"] }),
  reconnaissance: Object.freeze({ label: "Reconnaissance", color: "#A855F7", secondary: "ambush", detachPermission: true, returnAfterMission: true, engagementRadius: 75, formations: ["staggered", "flanking", "column"] }),
  "route-security": Object.freeze({ label: "Route Security", color: "#F97316", secondary: "territory-defense", detachPermission: true, returnAfterMission: true, engagementRadius: 145, formations: ["column", "line", "staggered"] }),
  ambush: Object.freeze({ label: "Ambush", color: "#7C3AED", secondary: "reconnaissance", detachPermission: true, returnAfterMission: true, engagementRadius: 105, formations: ["flanking", "staggered", "line"] }),
  reserve: Object.freeze({ label: "Reserve", color: "#64748B", secondary: "reinforcement", detachPermission: true, returnAfterMission: true, engagementRadius: 80, formations: ["column", "triangle", "defensive-ring"] }),
  escort: Object.freeze({ label: "Escort", color: "#14B8A6", secondary: "base-defense", detachPermission: false, returnAfterMission: true, engagementRadius: 120, formations: ["escort", "defensive-ring", "circle"] }),
  "medical-support": Object.freeze({ label: "Medical Support", color: "#10B981", secondary: "escort", detachPermission: false, returnAfterMission: true, engagementRadius: 70, formations: ["defensive-ring", "escort", "column"] }),
  siege: Object.freeze({ label: "Siege", color: "#DC2626", secondary: "offensive", detachPermission: false, returnAfterMission: false, engagementRadius: 230, formations: ["line", "staggered", "wedge"] })
});

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function unitSignals(members) {
  const count = Math.max(1, members.length);
  const identity = member => `${member.name || ""} ${member.specialty || ""} ${member.weapon || ""}`.toLowerCase();
  return {
    mobility: clamp01(average(members.map(member => (member.speed || 18) / 32))),
    durability: clamp01(average(members.map(member => (member.hp || 0) / Math.max(1, member.maxHp || 1))) * 0.7
      + average(members.map(member => Math.min(1, (member.maxHp || 50) / 180))) * 0.3),
    firepower: clamp01(average(members.map(member => (member.damage || 0) / 28))),
    range: clamp01(average(members.map(member => (member.range || 0) / 190))),
    experience: clamp01(average(members.map(member => (member.experience || 0) / 100))),
    morale: clamp01(average(members.map(member => member.morale ?? 0.5))),
    ammo: clamp01(average(members.map(member => member.maxAmmo ? member.ammo / member.maxAmmo : 0.6))),
    scout: members.filter(member => member.role === "scout" || /scout|recon|eliminator|pathfinder|kommando|ranger/.test(identity(member))).length / count,
    medic: members.filter(member => member.role === "medic" || /medic|apothecary|painboy|medical/.test(identity(member))).length / count,
    engineer: members.filter(member => member.role === "engineer" || member.role === "builder" || /engineer|mek|techmarine|demolition/.test(identity(member))).length / count,
    heavy: members.filter(member => member.role === "vehicle" || /heavy|devastator|terminator|launcher|cannon|melta|artillery|tank/.test(identity(member))).length / count,
    vehicle: members.filter(member => member.role === "vehicle").length / count
  };
}

export function squadReadiness(members = [], nominalSize = members.length || 1) {
  if (!members.length) return 0;
  const signals = unitSignals(members);
  const strength = clamp01(members.length / Math.max(1, nominalSize));
  const fatigue = clamp01(average(members.map(member => member.fatigue || 0)));
  return clamp01(strength * 0.25 + signals.durability * 0.28 + signals.morale * 0.2 + signals.ammo * 0.17 + (1 - fatigue) * 0.1);
}

export function roleSuitability(role, members = [], commanderPreference = {}) {
  if (!SQUAD_ROLE_DEFINITIONS[role] || !members.length) return 0;
  const s = unitSignals(members);
  const health = clamp01(average(members.map(member => (member.hp || 0) / Math.max(1, member.maxHp || 1))));
  const preference = Math.max(-20, Math.min(20, Number(commanderPreference[role]) || 0));
  const common = health * 18 + s.experience * 10 + s.morale * 8;
  const specialized = {
    "base-defense": s.durability * 28 + s.heavy * 24 + s.firepower * 12 + (1 - s.mobility) * 5,
    "economy-defense": s.durability * 25 + s.range * 18 + s.firepower * 14 + s.engineer * 10,
    "territory-defense": s.durability * 22 + s.range * 18 + s.firepower * 14 + s.engineer * 8,
    reinforcement: s.mobility * 34 + s.durability * 14 + s.vehicle * 18,
    offensive: s.firepower * 25 + s.durability * 18 + s.mobility * 12 + s.heavy * 10,
    capture: s.mobility * 32 + s.scout * 24 + s.durability * 10,
    reconnaissance: s.scout * 45 + s.mobility * 28 + s.range * 8,
    "route-security": s.mobility * 20 + s.range * 16 + s.engineer * 18 + s.durability * 10,
    ambush: s.scout * 28 + s.range * 24 + s.firepower * 12 + s.mobility * 8,
    reserve: s.mobility * 18 + s.durability * 18 + s.ammo * 12 + (1 - s.experience) * 4,
    escort: s.durability * 28 + s.firepower * 18 + s.range * 10,
    "medical-support": s.medic * 52 + s.mobility * 12 + s.durability * 8,
    siege: s.heavy * 38 + s.range * 24 + s.firepower * 20 + s.engineer * 8
  }[role] || 0;
  return Math.max(0, Math.min(100, common + specialized + preference));
}

export function roleDemandScores(context = {}, assignedStrength = {}) {
  const c = key => clamp01(context[key]);
  const aggression = clamp01((context.aggression || 50) / 100);
  const caution = clamp01((context.caution || 50) / 100);
  const squadCount = Math.max(0, Number(context.squadCount) || 0);
  const raw = {
    "base-defense": 18 + c("baseThreat") * 100 + caution * 20,
    "economy-defense": 12 + c("economyThreat") * 108 + c("criticalProducerNeed") * 72 + c("routeThreat") * 18,
    "territory-defense": 12 + c("territoryThreat") * 88 + c("objectiveImportance") * 24,
    reinforcement: 12 + c("reinforcementThreat") * 92 + c("forceDisadvantage") * 25,
    offensive: 20 + aggression * 42 + c("enemyBaseKnown") * 28 + c("annihilation") * 42,
    capture: 14 + c("resourceNeed") * 45 + c("captureOpportunity") * 60 + c("objectiveImportance") * 18,
    reconnaissance: 10 + c("fogNeed") * 60 + (1 - c("enemyBaseKnown")) * 30,
    "route-security": 10 + c("routeThreat") * 72 + c("convoyThreat") * 35,
    ambush: 5 + aggression * 20 + c("enemyConvoyOpportunity") * 66,
    reserve: 38 + Math.min(32, squadCount * 4) + c("uncertainty") * 20,
    escort: 5 + c("protectedAssetNeed") * 90,
    "medical-support": 4 + c("casualtyPressure") * 100,
    siege: 5 + c("enemyFortifications") * 72 + c("annihilation") * 35 + c("enemyBaseKnown") * 15
  };
  return Object.fromEntries(SQUAD_ROLES.map(role => [role, Math.max(0, raw[role] - (assignedStrength[role] || 0) * 18)]));
}

export function roleMinimumDuration(squadId = "squad") {
  const hash = [...String(squadId)].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 17);
  return 30 + hash % 61;
}

export function shouldReassignSquadRole(squad, now, { emergency = false, objectiveComplete = false, supplyCut = false, readiness = 1, annihilation = false } = {}) {
  if (!squad?.primaryRole || !SQUAD_ROLE_DEFINITIONS[squad.primaryRole]) return true;
  if (emergency || objectiveComplete || supplyCut || readiness < 0.3) return true;
  if (annihilation && !["offensive", "siege", "reconnaissance"].includes(squad.primaryRole)) return true;
  return Number(now) >= Number(squad.roleCommitUntil || 0);
}

export function selectSquadRole({ squad, members = [], demands = {}, assignedStrength = {}, commanderPreference = {} } = {}) {
  const suitability = Object.fromEntries(SQUAD_ROLES.map(role => [role, roleSuitability(role, members, commanderPreference)]));
  const scored = SQUAD_ROLES.map(role => ({
    role,
    score: (demands[role] || 0) + suitability[role] * 0.72 - (assignedStrength[role] || 0) * 14 + (squad?.primaryRole === role ? 5 : 0)
  })).sort((a, b) => b.score - a.score || SQUAD_ROLES.indexOf(a.role) - SQUAD_ROLES.indexOf(b.role));
  return { primaryRole: scored[0].role, secondaryRole: scored[1]?.role || SQUAD_ROLE_DEFINITIONS[scored[0].role].secondary, suitability, scores: Object.fromEntries(scored.map(item => [item.role, item.score])) };
}

export function roleFormationBonus(role, formation) {
  const index = SQUAD_ROLE_DEFINITIONS[role]?.formations.indexOf(formation) ?? -1;
  return index < 0 ? 0 : [36, 22, 12][index];
}
