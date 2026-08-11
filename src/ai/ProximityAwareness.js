const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const PROXIMITY_ALERT_STATES = Object.freeze(["Calm", "Wary", "Tense", "Afraid", "Aggressive"]);

const combatPower = unit => {
  if (!unit || unit.alive === false || unit.incapacitated) return 0;
  const health = clamp((unit.hp ?? 1) / Math.max(1, unit.maxHp ?? unit.hp ?? 1), 0, 1);
  const role = unit.role === "vehicle" ? 2.4 : unit.role === "commander" ? 1.5 : ["builder", "supply"].includes(unit.role) ? 0.18 : 1;
  return health * role * clamp(0.4 + (unit.morale ?? 0.6) * 0.6, 0.2, 1);
};

export function evaluateProximityAwareness(unit, hostiles = [], allies = [], dt = 0.05, awarenessRadius = 160, { usesFear = false } = {}) {
  const previousLevel = clamp(Number(unit?.alertLevel) || 0, 0, 1);
  if (!hostiles.length) {
    const alertLevel = clamp(previousLevel - Math.max(0, dt) * 0.34, 0, 1);
    return {
      alertLevel,
      alertState: alertLevel > 0.12 ? "Wary" : "Calm",
      nearestThreatId: null,
      nearestThreatDistance: Infinity,
      localHostilePower: 0,
      localFriendlyPower: allies.reduce((sum, ally) => sum + combatPower(ally), combatPower(unit))
    };
  }

  let nearest = hostiles[0];
  const firstDistance = Number(hostiles[0].distance);
  let nearestDistance = Number.isFinite(firstDistance) ? firstDistance : Infinity;
  for (let index = 1; index < hostiles.length; index += 1) {
    const numericDistance = Number(hostiles[index].distance);
    const candidateDistance = Number.isFinite(numericDistance) ? numericDistance : Infinity;
    if (candidateDistance < nearestDistance) {
      nearest = hostiles[index];
      nearestDistance = candidateDistance;
    }
  }
  const hostileUnits = hostiles.map(entry => entry.unit || entry);
  const localHostilePower = hostileUnits.reduce((sum, hostile) => sum + combatPower(hostile), 0);
  const localFriendlyPower = allies.reduce((sum, ally) => sum + combatPower(ally), combatPower(unit));
  const proximity = clamp(1 - nearestDistance / Math.max(1, awarenessRadius), 0, 1);
  const pressure = clamp(localHostilePower / Math.max(0.1, localHostilePower + localFriendlyPower), 0, 1);
  const crowdPressure = clamp((hostileUnits.length - 1) * 0.055, 0, 0.22);
  const targetLevel = clamp(Math.pow(proximity, 0.72) * 0.72 + pressure * 0.22 + crowdPressure, 0, 1);
  const supportRole = ["builder", "supply"].includes(unit?.role);
  const responsiveness = unit?.role === "vehicle" ? 0.55 : supportRole ? 0.82 : 1;
  const alertLevel = clamp(previousLevel + (targetLevel - previousLevel) * clamp(Math.max(0, dt) * responsiveness * 2.2, 0, 1), 0, 1);
  const health = clamp((unit?.hp ?? 1) / Math.max(1, unit?.maxHp ?? unit?.hp ?? 1), 0, 1);
  const composure = clamp((unit?.courage ?? 0.5) * 0.38 + (unit?.discipline ?? 0.5) * 0.32
    + (unit?.resolve ?? unit?.morale ?? 0.65) * 0.3, 0, 1);
  const aggression = clamp((unit?.aggression ?? 0.5) * 0.7 + (unit?.vengeance ?? 0.3) * 0.15
    + clamp((localFriendlyPower - localHostilePower) / Math.max(0.1, localFriendlyPower + localHostilePower), -1, 1) * 0.15, 0, 1);
  const stress = clamp(alertLevel * 0.48 + pressure * 0.28 + (1 - health) * 0.14 + (unit?.suppression ?? 0) * 0.22
    + (supportRole ? 0.12 : 0), 0, 1);

  let alertState = "Wary";
  if (alertLevel >= 0.18) {
    if (usesFear && stress > composure + 0.08) alertState = "Afraid";
    else if (!supportRole && aggression > composure + 0.04 && alertLevel >= 0.4) alertState = "Aggressive";
    else alertState = "Tense";
  }
  return {
    alertLevel,
    alertState,
    nearestThreatId: (nearest.unit || nearest)?.id || null,
    nearestThreatDistance: nearestDistance,
    localHostilePower,
    localFriendlyPower
  };
}

export function proximityCombatModifiers(unit = {}) {
  const level = clamp(Number(unit.alertLevel) || 0, 0, 1);
  switch (unit.alertState) {
    case "Aggressive": return { confidence: 15 * level, threshold: -9 * level, aim: 1.06, move: 1.15, fireDelay: 0.82 };
    case "Afraid": return { confidence: -18 * level, threshold: 11 * level, aim: 0.67, move: 0.72, fireDelay: 1.22 };
    case "Tense": return { confidence: -4 * level, threshold: 3 * level, aim: 0.86, move: 0.88, fireDelay: 1.08 };
    case "Wary": return { confidence: 2 * level, threshold: 0, aim: 0.97, move: 0.95, fireDelay: 1.02 };
    default: return { confidence: 0, threshold: 0, aim: 1, move: 1, fireDelay: 1 };
  }
}
