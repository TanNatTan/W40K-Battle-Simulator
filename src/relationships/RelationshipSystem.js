export const RELATIONSHIP_BANDS = Object.freeze([
  { min: 70, label: "Bonded" }, { min: 30, label: "Friendly" }, { min: 10, label: "Familiar" },
  { min: -9, label: "Neutral" }, { min: -29, label: "Not close" }, { min: -59, label: "Disliked" },
  { min: -84, label: "Hated but tolerated" }, { min: -100, label: "Enemy" }
]);

export const RELATIONSHIP_EVENT_DELTAS = Object.freeze({
  savedAlly: 12, savedFromDanger: 12, abandonedAlly: -8, abandoned: -8, sharedSupplies: 5,
  protectedBuilder: 7, friendlyFire: -14, successfulSquadHistory: 4, completedTogether: 6,
  commanderTrust: 6, successfulOrder: 3, rivalry: -5, repairedAlly: 8
});

const EFFECT_STRENGTH = Object.freeze({ escort: 0.1, healing: 0.1, repair: 0.07, attachment: 0.06, rescue: 0.12, morale: 0.05 });
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export function relationshipBandFor(score) {
  return RELATIONSHIP_BANDS.find(band => score >= band.min)?.label || "Enemy";
}

export function relationshipEffect(score, effect) {
  return clamp(score / 100 * (EFFECT_STRENGTH[effect] || 0.04), -0.12, 0.12);
}

export function relationshipPriority(basePriority, score, effect) {
  return basePriority * (1 + relationshipEffect(score, effect));
}

export function applyRelationshipEvent(record = {}, event, time = 0, amount = null, reason = event) {
  const previous = clamp(record.score || 0, -100, 100);
  const delta = amount ?? RELATIONSHIP_EVENT_DELTAS[event] ?? 0;
  const score = clamp(previous + delta, -100, 100);
  return { ...record, score, lastAt: time, lastReason: reason, events: [...(record.events || []), { event, delta, time }].slice(-12) };
}

export function serializeRelationshipMemory(units, battleId = "current") {
  const relationships = [];
  const unitHistory = [];
  for (const unit of units) {
    for (const [otherId, record] of Object.entries(unit.relationships || {})) relationships.push({ battleId, unitId: unit.id, otherUnitId: otherId, score: record.score || 0, band: relationshipBandFor(record.score || 0), lastAt: record.lastAt || 0, lastReason: record.lastReason || null });
    unitHistory.push({ battleId, unitId: unit.id, faction: unit.faction, battles: unit.battles || 0, kills: unit.kills || 0, injuries: unit.injuries || 0, memories: [...(unit.memories || [])].slice(-24) });
  }
  return { relationships, unitHistory };
}
