import { SQUAD_ROLES, roleSuitability } from "./SquadRoleSystem.js";

export const ARMY_ROLE_PRIORITY = Object.freeze([
  "offensive",
  "capture",
  "territory-defense",
  "base-defense",
  "reinforcement",
  "reconnaissance",
  "route-security",
  "escort",
  "medical-support",
  "siege",
  "ambush",
  "reserve"
]);

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export function calculateArmyRoleBudget(context = {}, squadCount = Number(context.squadCount) || 0) {
  const danger = clamp01(
    clamp01(context.baseThreat) * 0.35
    + clamp01(context.territoryThreat) * 0.25
    + clamp01(context.reinforcementThreat) * 0.2
    + clamp01(context.forceDisadvantage) * 0.2
  );
  const emergency = danger >= 0.72;
  const count = Math.max(0, Math.floor(squadCount));
  return Object.freeze({
    danger,
    emergency,
    offensive: Object.freeze({ priority: 1, min: Math.min(count, Math.max(Math.min(2, count), Math.ceil(count * (emergency ? 0.35 : 0.62)))), max: count }),
    capture: Object.freeze({ priority: 2, min: !emergency && count >= 5 ? 1 : 0, max: Math.min(count, Math.max(count ? 1 : 0, Math.ceil(count * 0.2))) }),
    "territory-defense": Object.freeze({ priority: 3, min: 0, max: Math.min(count, emergency ? 3 : 2) }),
    "base-defense": Object.freeze({ priority: 3, min: emergency ? Math.min(2, count) : 0, max: Math.min(count, emergency ? 3 : 2) }),
    reinforcement: Object.freeze({ priority: 4, min: 0, max: Math.min(count, 3) }),
    reconnaissance: Object.freeze({ priority: 5, min: 0, max: Math.min(count, 2) }),
    "route-security": Object.freeze({ priority: 6, min: 0, max: Math.min(count, 2) }),
    escort: Object.freeze({ priority: 7, min: 0, max: Math.min(count, 2) }),
    "medical-support": Object.freeze({ priority: 7, min: 0, max: Math.min(count, 2) }),
    siege: Object.freeze({ priority: 7, min: 0, max: Math.min(count, 2) }),
    ambush: Object.freeze({ priority: 7, min: 0, max: Math.min(count, 2) }),
    reserve: Object.freeze({ priority: 8, min: 0, max: Math.min(count, 3) })
  });
}

function membersFor(membersBySquad, squad) {
  if (membersBySquad instanceof Map) return membersBySquad.get(squad.id) || [];
  return membersBySquad?.[squad.id] || [];
}

export function allocateArmyRoles({ squads = [], membersBySquad = new Map(), context = {}, demands = {}, commanderPreference = {} } = {}) {
  const budget = calculateArmyRoleBudget(context, squads.length);
  const assignments = new Map();
  const counts = Object.fromEntries(SQUAD_ROLES.map(role => [role, 0]));
  const available = [];
  for (const squad of squads) {
    const readiness = Number.isFinite(squad.readiness) ? squad.readiness : 1;
    if (readiness < 0.3) {
      assignments.set(squad.id, "reserve");
      counts.reserve += 1;
    } else available.push(squad);
  }

  const score = (squad, role) => roleSuitability(role, membersFor(membersBySquad, squad), commanderPreference)
    + (Number(demands[role]) || 0)
    + (squad.primaryRole === role ? 4 : 0)
    - (role === "capture" && Number(squad.captureCooldownUntil) > Number(context.now || 0) ? 1000 : 0);
  const takeBest = (role, amount) => {
    for (let index = 0; index < amount && available.length; index += 1) {
      available.sort((a, b) => score(b, role) - score(a, role) || String(a.id).localeCompare(String(b.id)));
      const squad = available.shift();
      assignments.set(squad.id, role);
      counts[role] += 1;
    }
  };

  // P1 is allocated before every other battlefield responsibility.
  takeBest("offensive", Math.min(available.length, budget.offensive.min));
  if (budget.emergency) takeBest("base-defense", Math.min(available.length, budget["base-defense"].min));
  takeBest("capture", Math.min(available.length, budget.capture.min));

  while (available.length) {
    const squad = available.shift();
    const candidates = ARMY_ROLE_PRIORITY.filter(role => counts[role] < (budget[role]?.max ?? 0));
    const role = (candidates.length ? candidates : ["offensive"])
      .sort((a, b) => score(squad, b) - score(squad, a) || ARMY_ROLE_PRIORITY.indexOf(a) - ARMY_ROLE_PRIORITY.indexOf(b))[0];
    assignments.set(squad.id, role);
    counts[role] += 1;
  }

  return { assignments, counts, budget };
}
