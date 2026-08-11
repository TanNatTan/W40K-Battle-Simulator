const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function recoveryRingCandidates(center = {}, {
  radii = [32, 48, 64, 96, 128],
  pointsPerRing = 16,
  seed = 0,
  bounds = null
} = {}) {
  const candidates = [];
  const offset = (Number(seed) || 0) * 0.6180339887498949;
  for (const radius of radii) {
    for (let index = 0; index < pointsPerRing; index += 1) {
      const angle = offset + index * Math.PI * 2 / pointsPerRing;
      const point = { x: (Number(center.x) || 0) + Math.cos(angle) * radius, y: (Number(center.y) || 0) + Math.sin(angle) * radius };
      candidates.push(bounds ? {
        x: clamp(point.x, bounds.left, bounds.right),
        y: clamp(point.y, bounds.top, bounds.bottom)
      } : point);
    }
  }
  return candidates;
}

export function chooseRecoveryPoint(center = {}, objective = {}, {
  valid = () => true,
  occupied = () => false,
  radii,
  pointsPerRing,
  seed,
  bounds,
  requireCloser = false
} = {}) {
  const startDistance = Math.hypot((center.x || 0) - (objective.x || 0), (center.y || 0) - (objective.y || 0));
  return recoveryRingCandidates(center, { radii, pointsPerRing, seed, bounds })
    .filter(point => valid(point) && !occupied(point))
    .map(point => ({ point, goalDistance: Math.hypot(point.x - (objective.x || 0), point.y - (objective.y || 0)), displacement: Math.hypot(point.x - (center.x || 0), point.y - (center.y || 0)) }))
    .filter(candidate => !requireCloser || candidate.goalDistance < startDistance - 2)
    .sort((a, b) => a.goalDistance - b.goalDistance || a.displacement - b.displacement)[0]?.point || null;
}

export function clearNavigationState(subject = {}) {
  subject.navigationPath = [];
  subject.navigationDestination = null;
  subject.detour = null;
  subject.stuckTime = 0;
  subject.nextNavigationPlanAt = 0;
  return subject;
}
