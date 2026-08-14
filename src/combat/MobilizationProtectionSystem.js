export const MOBILIZATION_GRACE_SECONDS = 300;
export const MOBILIZATION_READY_COMBATANTS = 12;

export function combatReadyCount(units = [], factionId = "") {
  return units.filter(unit => unit.faction === factionId && unit.alive !== false && !unit.incapacitated
    && !["builder", "supply"].includes(unit.role)).length;
}

export function isMobilizationProtected({
  now = 0,
  targetFaction,
  attackerFaction,
  allied = false,
  units = [],
  structures = [],
  graceSeconds = MOBILIZATION_GRACE_SECONDS,
  requiredCombatants = MOBILIZATION_READY_COMBATANTS
} = {}) {
  if (!targetFaction || targetFaction === attackerFaction || allied || Number(now) >= graceSeconds) return false;
  const operationalMuster = structures.some(structure => structure.faction === targetFaction && structure.type === "barracks"
    && structure.alive !== false && Number(structure.progress) >= 1 && Number(structure.condition ?? 1) >= 0.25);
  return !operationalMuster || combatReadyCount(units, targetFaction) < requiredCombatants;
}
