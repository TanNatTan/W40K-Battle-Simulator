const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, Number(value) || 0));
const behaviorScore = value => Number.isFinite(Number(value)) ? Number(value) : 50;

export const ACTIVE_FORCE_ROLES = Object.freeze(new Set([
  "capture",
  "reconnaissance",
  "offensive",
  "reinforcement",
  "territory-defense",
  "route-security",
  "escort",
  "siege"
]));

export const PASSIVE_FORCE_ROLES = Object.freeze(new Set([
  "base-defense",
  "economy-defense",
  "reserve",
  "medical-support",
  "ambush"
]));

export function desiredActiveForceRatio(player = {}, behavior = {}) {
  let ratio = 0.58
    + (behaviorScore(behavior.aggression) - 50) * 0.0035
    + (behaviorScore(behavior.expansion) - 50) * 0.003;
  const subfaction = String(player.subfaction || "").toLowerCase();
  if (/imperial fists|nihilakh|guardian web|tomb watch/.test(subfaction)) ratio -= 0.07;
  if (/speed freeks|white scars|kraken|hydra|world eaters|vior'la/.test(subfaction)) ratio += 0.08;
  if (/raven guard|alpha legion|lictors?|recon swarm/.test(subfaction)) ratio += 0.04;
  return clamp(ratio, 0.5, 0.82);
}

function preferredActiveRole(player = {}, behavior = {}) {
  const subfaction = String(player.subfaction || "").toLowerCase();
  if (/raven guard|alpha legion|lictors?|recon swarm|night lords/.test(subfaction)) return "reconnaissance";
  if (behaviorScore(behavior.expansion) >= Math.max(62, behaviorScore(behavior.aggression))) return "capture";
  if (behaviorScore(behavior.caution) >= 70) return "territory-defense";
  return "offensive";
}

export function enforceActiveForceRatio({
  player = {},
  behavior = {},
  squads = [],
  assignments = new Map(),
  baseThreat = 0,
  preserveBaseDefense = 1,
  preserveEconomyDefense = 0
} = {}) {
  const result = new Map(assignments);
  const ready = squads.filter(squad => (Number(squad.readiness) || 0) >= 0.3);
  const ratio = desiredActiveForceRatio(player, behavior);
  const required = Math.min(ready.length, Math.ceil(ready.length * ratio));
  if (Number(baseThreat) >= 0.65 || ready.length < 2) {
    return { assignments: result, ratio, required, active: ready.filter(squad => ACTIVE_FORCE_ROLES.has(result.get(squad.id) || squad.primaryRole)).length, converted: [] };
  }

  const roleCount = role => ready.filter(squad => (result.get(squad.id) || squad.primaryRole) === role).length;
  let active = ready.filter(squad => ACTIVE_FORCE_ROLES.has(result.get(squad.id) || squad.primaryRole)).length;
  const converted = [];
  const candidates = ready
    .filter(squad => PASSIVE_FORCE_ROLES.has(result.get(squad.id) || squad.primaryRole))
    .sort((a, b) => {
      const roleA = result.get(a.id) || a.primaryRole;
      const roleB = result.get(b.id) || b.primaryRole;
      const rank = role => role === "reserve" ? 0 : role === "medical-support" ? 1 : role === "ambush" ? 2 : role === "economy-defense" ? 3 : 4;
      return rank(roleA) - rank(roleB) || (Number(b.readiness) || 0) - (Number(a.readiness) || 0);
    });

  for (const squad of candidates) {
    if (active >= required) break;
    const current = result.get(squad.id) || squad.primaryRole;
    if (current === "base-defense" && roleCount("base-defense") <= preserveBaseDefense) continue;
    if (current === "economy-defense" && roleCount("economy-defense") <= preserveEconomyDefense) continue;
    const role = preferredActiveRole(player, behavior);
    result.set(squad.id, role);
    converted.push({ squadId: squad.id, from: current, to: role });
    active += 1;
  }
  return { assignments: result, ratio, required, active, converted };
}
