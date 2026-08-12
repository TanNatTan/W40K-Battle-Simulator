const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const distanceBetween = (a = {}, b = {}) => Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0));

const TERRITORY_AGENT_PATTERN = /scout|infiltrator|incursor|eliminator|reiver|probe|servo.?skull|raptor|warp talon|kommando|deathmark|praetorian|pathfinder|stealth|gargoyle|ravener|dragoon|skystalker|ratling|sentinel/i;

export function isTerritoryAgentCandidate(unit = {}) {
  if (!unit.alive || unit.incapacitated || unit.embarkedInId || unit.retreating) return false;
  if (["builder", "supply", "medic", "engineer", "commander"].includes(unit.role)) return false;
  return unit.role === "scout" || TERRITORY_AGENT_PATTERN.test(`${unit.name || ""} ${unit.type || ""}`);
}

export function selectTerritoryAgents({ units = [], playerId, desired = 3, base = { x: 0, y: 0 }, existingIds = [] } = {}) {
  const retained = new Set(existingIds || []);
  return units
    .filter(unit => unit.faction === playerId && isTerritoryAgentCandidate(unit))
    .map(unit => ({
      unit,
      score: (retained.has(unit.id) ? 80 : 0)
        + (unit.role === "scout" ? 48 : 20)
        + (unit.squadId ? -18 : 12)
        + clamp((Number(unit.hp) || 0) / Math.max(1, Number(unit.maxHp) || 1), 0, 1) * 18
        - distanceBetween(unit, base) * 0.012
    }))
    .sort((a, b) => b.score - a.score || String(a.unit.id).localeCompare(String(b.unit.id)))
    .slice(0, clamp(Math.floor(desired), 0, 6))
    .map(candidate => candidate.unit);
}

export function territoryAgentContactResponse({ unit = {}, enemies = [], selfDefenseRadius = 30, disengageRadius = 125 } = {}) {
  const nearby = enemies
    .filter(enemy => enemy?.alive !== false && !enemy.incapacitated)
    .map(enemy => ({ enemy, distance: distanceBetween(unit, enemy) }))
    .filter(contact => contact.distance <= disengageRadius)
    .sort((a, b) => a.distance - b.distance);
  if (!nearby.length) return Object.freeze({ action: "continue", contact: null });
  const closest = nearby[0];
  return Object.freeze({
    action: closest.distance <= selfDefenseRadius ? "self-defense" : "disengage",
    contact: closest.enemy,
    distance: closest.distance
  });
}

export function chooseTerritoryAgentFallback({ unit = {}, enemy = {}, controlledPoints = [], base = { x: 0, y: 0 } } = {}) {
  const candidates = controlledPoints.length ? controlledPoints : [base];
  return candidates
    .map(point => ({
      point,
      score: distanceBetween(point, enemy) * 0.72 - distanceBetween(point, unit) * 0.42 - distanceBetween(point, base) * 0.035
    }))
    .sort((a, b) => b.score - a.score)[0]?.point || base;
}

export const TERRITORY_AGENT_SELF_DEFENSE_RADIUS = 30;
export const TERRITORY_AGENT_DISENGAGE_RADIUS = 125;
