export const BUILDER_REPAIR_ASSIGNMENT_TTL = 0.8;
export const SERVITOR_REPAIR_ASSIGNMENT_TTL = BUILDER_REPAIR_ASSIGNMENT_TTL;
export const BUILDER_REPAIR_CREW_LIMIT = 1;

export function builderRepairCrewLimit(player = {}, unit = {}, request = {}, target = {}) {
  if (unit.role !== "builder" || request.targetType !== "building") return Infinity;
  const residentCrew = Math.max(BUILDER_REPAIR_CREW_LIMIT, caretakerRequirementForStructure(player, target));
  const severe = Number(request.severity) >= 0.18 || Number(target.hp) < Number(target.maxHp) * 0.82;
  return residentCrew + (severe ? builderWorkforceProfileFor(player).repairReserve : 0);
}

// Kept as compatibility aliases for existing integrations and saved test fixtures.
export const servitorRepairCrewLimit = builderRepairCrewLimit;

export function activeRepairCrewCount({ units = [], targetId, faction, now = 0, excludeId = null } = {}) {
  if (!targetId) return 0;
  return units.filter(unit => unit.alive !== false
    && unit.id !== excludeId
    && unit.faction === faction
    && unit.role === "builder"
    && unit.repairTargetId === targetId
    && Number(now) - Number(unit.repairAssignmentAt || 0) <= BUILDER_REPAIR_ASSIGNMENT_TTL).length;
}

export function builderRepairSlotAvailable({ player = {}, unit = {}, request = {}, target = {}, units = [], now = 0 } = {}) {
  const limit = builderRepairCrewLimit(player, unit, request, target);
  if (!Number.isFinite(limit)) return true;
  return activeRepairCrewCount({
    units,
    targetId: request.targetId || target.id,
    faction: unit.faction,
    now,
    excludeId: unit.id
  }) < limit;
}

export const servitorRepairSlotAvailable = builderRepairSlotAvailable;

export function releaseStaleRepairAssignment(unit = {}, now = 0) {
  if (!unit.repairTargetId) return false;
  if (Number(now) - Number(unit.repairAssignmentAt || 0) <= BUILDER_REPAIR_ASSIGNMENT_TTL) return false;
  unit.repairTargetId = null;
  unit.repairAssignmentAt = null;
  return true;
}

export function claimRepairAssignment(unit = {}, targetId, now = 0) {
  unit.repairTargetId = targetId || null;
  unit.repairAssignmentAt = targetId ? Number(now) || 0 : null;
  return unit.repairTargetId;
}
import { builderWorkforceProfileFor, caretakerRequirementForStructure } from "./BuilderWorkforceSystem.js";
