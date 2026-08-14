const distanceBetween = (left = {}, right = {}) => Math.hypot(
  (Number(left.x) || 0) - (Number(right.x) || 0),
  (Number(left.y) || 0) - (Number(right.y) || 0)
);

export const WITHDRAWAL_CONTACT_GRACE_SECONDS = 8;

export function markEnemyContact(unit = null, enemy = null, now = 0) {
  if (!unit || !Number.isFinite(Number(now))) return unit;
  unit.lastEnemyContactAt = Number(now);
  if (enemy?.id != null) unit.lastEnemyContactId = enemy.id;
  return unit;
}

export function hasRecentEnemyContact(unit = {}, now = 0, graceSeconds = WITHDRAWAL_CONTACT_GRACE_SECONDS) {
  const contactAt = Number(unit.lastEnemyContactAt);
  if (!Number.isFinite(contactAt)) return false;
  const age = Number(now) - contactAt;
  return age >= 0 && age <= Math.max(0, Number(graceSeconds) || 0);
}

export function squadHasRecentEnemyContact(squad = {}, members = [], now = 0, graceSeconds = WITHDRAWAL_CONTACT_GRACE_SECONDS) {
  if (members.some(member => hasRecentEnemyContact(member, now, graceSeconds))) return true;
  const lastSeenAt = Number(squad.combatContact?.lastSeenAt);
  return Number.isFinite(lastSeenAt) && Number(now) - lastSeenAt >= 0 && Number(now) - lastSeenAt <= graceSeconds;
}

export function withdrawalOrderAppliesTo(unit = {}, squad = null, now = 0, {
  graceSeconds = WITHDRAWAL_CONTACT_GRACE_SECONDS,
  distanceTo = distanceBetween
} = {}) {
  if (hasRecentEnemyContact(unit, now, graceSeconds)) return true;
  const contact = squad?.combatContact;
  if (!contact || !Number.isFinite(Number(contact.lastSeenAt)) || Number(now) - Number(contact.lastSeenAt) > graceSeconds) return false;
  const contactPoint = { x: Number(contact.lastKnownX) || 0, y: Number(contact.lastKnownY) || 0 };
  const participationRadius = Math.max(120, (Number(unit.range) || 0) * 1.35);
  return distanceTo(unit, contactPoint) <= participationRadius;
}
