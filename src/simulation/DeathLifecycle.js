function finiteTime(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function scheduleDeathRemoval(unit, now = 0, lifetimeSeconds = 8) {
  if (!unit || unit.alive !== false) return null;
  const currentTime = Math.max(0, finiteTime(now));
  const lifetime = Math.max(0, finiteTime(lifetimeSeconds));
  if (!Number.isFinite(unit.deathStartedAt)) unit.deathStartedAt = currentTime;
  const earliestDeadline = unit.deathStartedAt + lifetime;
  if (!Number.isFinite(unit.removalAt) || unit.removalAt < unit.deathStartedAt) {
    unit.removalAt = earliestDeadline;
  }
  return unit.removalAt;
}

export function expiredDeadUnitIds(units = [], now = 0, lifetimeSeconds = 8) {
  const currentTime = Math.max(0, finiteTime(now));
  const expired = new Set();
  for (const unit of units) {
    if (!unit || unit.alive !== false) continue;
    const deadline = scheduleDeathRemoval(unit, currentTime, lifetimeSeconds);
    if (deadline != null && currentTime >= deadline) expired.add(unit.id);
  }
  return expired;
}
