export const SERVITOR_REPAIR_ASSIGNMENT_TTL = 0.8;

function isSpaceMarineServitor(player = {}, unit = {}) {
  const faction = String(player.faction || "").toLowerCase();
  const identity = `${unit.name || ""} ${unit.specialty || ""}`.toLowerCase();
  return faction.includes("space marine") && unit.role === "builder" && identity.includes("servitor");
}

export function servitorRepairCrewLimit(player = {}, unit = {}, request = {}, target = {}) {
  if (!isSpaceMarineServitor(player, unit) || request.targetType !== "building") return Infinity;
  const maximumHealth = Math.max(1, Number(target.maxHp) || Number(target.hp) || 1);
  const condition = Math.max(0, Math.min(1, Number(target.condition ?? target.hp / maximumHealth) || 0));
  const severe = Number(request.severity) >= 0.35
    || condition <= 0.55
    || Boolean(request.underFire)
    || target.type === "outpost" && condition <= 0.75;
  return severe ? 2 : 1;
}

export function activeRepairCrewCount({ units = [], targetId, faction, now = 0, excludeId = null } = {}) {
  if (!targetId) return 0;
  return units.filter(unit => unit.alive !== false
    && unit.id !== excludeId
    && unit.faction === faction
    && unit.role === "builder"
    && unit.repairTargetId === targetId
    && Number(now) - Number(unit.repairAssignmentAt || 0) <= SERVITOR_REPAIR_ASSIGNMENT_TTL).length;
}

export function servitorRepairSlotAvailable({ player = {}, unit = {}, request = {}, target = {}, units = [], now = 0 } = {}) {
  const limit = servitorRepairCrewLimit(player, unit, request, target);
  if (!Number.isFinite(limit)) return true;
  return activeRepairCrewCount({
    units,
    targetId: request.targetId || target.id,
    faction: unit.faction,
    now,
    excludeId: unit.id
  }) < limit;
}

export function releaseStaleRepairAssignment(unit = {}, now = 0) {
  if (!unit.repairTargetId) return false;
  if (Number(now) - Number(unit.repairAssignmentAt || 0) <= SERVITOR_REPAIR_ASSIGNMENT_TTL) return false;
  unit.repairTargetId = null;
  unit.repairAssignmentAt = null;
  return true;
}

export function claimRepairAssignment(unit = {}, targetId, now = 0) {
  unit.repairTargetId = targetId || null;
  unit.repairAssignmentAt = targetId ? Number(now) || 0 : null;
  return unit.repairTargetId;
}
