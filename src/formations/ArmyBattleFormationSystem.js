export const ARMY_BATTLE_PHASES = Object.freeze(["ASSEMBLE", "RALLY", "ADVANCE", "ENGAGE", "EXPLOIT", "DISPERSE"]);

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function shouldUseArmyBattleFormation({ squadCount = 0, combatUnits = 0, baseThreat = 0, objectiveImportance = 0, allIn = false, annihilation = false } = {}) {
  return squadCount >= 2 && combatUnits >= 12 && (allIn || annihilation || baseThreat >= 0.55 || objectiveImportance >= 0.72);
}

function phaseFor(elapsed, inContact) {
  if (elapsed < 4) return "ASSEMBLE";
  if (elapsed < 8) return "RALLY";
  if (!inContact && elapsed < 20) return "ADVANCE";
  if (inContact && elapsed < 35) return "ENGAGE";
  if (inContact) return "EXPLOIT";
  return "DISPERSE";
}

export function updateArmyBattleFormation(existing = {}, { now = 0, activate = false, rallyPoint = { x: 0, y: 0 }, objective = rallyPoint, squads = [], vehicles = [], inContact = false } = {}) {
  if (!activate) return { active: false, phase: "DISPERSE", since: now, squadAnchors: {}, vehicleAnchors: {} };
  const since = existing.active ? existing.since : now;
  const phase = phaseFor(now - since, inContact);
  const dx = objective.x - rallyPoint.x;
  const dy = objective.y - rallyPoint.y;
  const length = Math.hypot(dx, dy) || 1;
  const forward = { x: dx / length, y: dy / length };
  const right = { x: -forward.y, y: forward.x };
  const progress = phase === "ASSEMBLE" ? 0.12 : phase === "RALLY" ? 0.28 : phase === "ADVANCE" ? 0.58 : phase === "ENGAGE" ? 0.82 : 0.94;
  const center = { x: rallyPoint.x + dx * progress, y: rallyPoint.y + dy * progress };
  const squadAnchors = {};
  squads.forEach((squad, index) => {
    const centered = index - (squads.length - 1) / 2;
    const rear = ["medical-support", "reserve", "escort"].includes(squad.primaryRole) ? -70 : ["siege"].includes(squad.primaryRole) ? -42 : 0;
    squadAnchors[squad.id] = { x: center.x + right.x * centered * 72 + forward.x * rear, y: center.y + right.y * centered * 72 + forward.y * rear };
  });
  const vehicleAnchors = {};
  vehicles.forEach((vehicle, index) => {
    const side = index % 2 ? -1 : 1;
    const rank = Math.floor(index / 2);
    vehicleAnchors[vehicle.id] = { x: center.x + right.x * side * (58 + rank * 28) - forward.x * 28, y: center.y + right.y * side * (58 + rank * 28) - forward.y * 28 };
  });
  return { active: true, phase, since, center, objective: { ...objective }, squadAnchors, vehicleAnchors, cohesion: clamp(0.55 + (now - since) / 30, 0.55, 1) };
}
