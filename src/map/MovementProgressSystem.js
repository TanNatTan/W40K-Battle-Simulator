const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const distanceBetween = (a = {}, b = {}) => Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0));

export function navigationFingerprint(path = [], cellSize = 32) {
  const size = Math.max(1, Number(cellSize) || 32);
  return path.slice(0, 6).map(point => `${Math.round((Number(point.x) || 0) / size)},${Math.round((Number(point.y) || 0) / size)}`).join("|");
}

export function createNavigationMonitor(now = 0) {
  return {
    goalKey: null,
    goal: null,
    initialGoalDistance: 0,
    lastSampleAt: Number(now) || 0,
    samples: [],
    pathHashes: [],
    failedCells: [],
    lowProgressTime: 0,
    repeatedPathCount: 0,
    recoveryLevel: 0,
    lastRecoveryAt: -Infinity,
    routeFailures: 0,
    emergencyDisplacements: 0,
    spawnRecoveries: 0,
    repaths: 0,
    makingProgress: true,
    progress: 0,
    expectedSpeed: 0,
    netMovement: 0,
    goalImprovement: 0
  };
}

export function ensureNavigationMonitor(subject = {}, now = 0) {
  subject.navigationMonitor ||= createNavigationMonitor(now);
  return subject.navigationMonitor;
}

function beginGoal(monitor, position, goal, now, goalKey) {
  monitor.goalKey = goalKey;
  monitor.goal = { x: goal.x, y: goal.y };
  monitor.initialGoalDistance = distanceBetween(position, goal);
  monitor.lastSampleAt = now;
  monitor.samples = [{ x: position.x, y: position.y, goalDistance: monitor.initialGoalDistance, expectedSpeed: 0, at: now }];
  monitor.pathHashes = [];
  monitor.failedCells = [];
  monitor.lowProgressTime = 0;
  monitor.repeatedPathCount = 0;
  monitor.recoveryLevel = 0;
  monitor.routeFailures = 0;
  monitor.emergencyDisplacements = 0;
  monitor.makingProgress = true;
  monitor.progress = 0;
}

function recoveryStageFor(monitor) {
  if (monitor.lowProgressTime >= 7 || monitor.routeFailures >= 3 || monitor.emergencyDisplacements >= 2 && monitor.lowProgressTime >= 2) return 4;
  if (monitor.lowProgressTime >= 5) return 3;
  if (monitor.lowProgressTime >= 3 || monitor.repeatedPathCount >= 3) return 2;
  if (monitor.lowProgressTime >= 1.25) return 1;
  return 0;
}

export function sampleNavigationProgress(monitor, {
  now = 0,
  position = {},
  goal = {},
  path = [],
  expectedSpeed = 0,
  sampleInterval = 0.5,
  goalCellSize = 96,
  cellSize = 32
} = {}) {
  const timestamp = Number(now) || 0;
  const key = `${Math.round((Number(goal.x) || 0) / goalCellSize)},${Math.round((Number(goal.y) || 0) / goalCellSize)}`;
  if (monitor.goalKey !== key) beginGoal(monitor, position, goal, timestamp, key);
  monitor.goal = { x: goal.x, y: goal.y };
  monitor.expectedSpeed = Math.max(0, Number(expectedSpeed) || 0);
  const sinceLastSample = timestamp - monitor.lastSampleAt;
  if (sinceLastSample < sampleInterval) return { sampled: false, recoveryStage: 0, monitor };

  const goalDistance = distanceBetween(position, goal);
  const sample = { x: position.x, y: position.y, goalDistance, expectedSpeed: monitor.expectedSpeed, at: timestamp };
  monitor.samples.push(sample);
  while (monitor.samples.length > 8 || monitor.samples.length > 2 && timestamp - monitor.samples[0].at > 4) monitor.samples.shift();
  const fingerprint = navigationFingerprint(path, cellSize);
  if (fingerprint) {
    monitor.pathHashes.push(fingerprint);
    if (monitor.pathHashes.length > 6) monitor.pathHashes.shift();
  }

  const oldest = monitor.samples[0];
  const elapsed = Math.max(sampleInterval, timestamp - oldest.at);
  const averageExpectedSpeed = monitor.samples.reduce((sum, item) => sum + item.expectedSpeed, 0) / Math.max(1, monitor.samples.length);
  const expectedDistance = averageExpectedSpeed * elapsed;
  const requiredProgress = Math.min(Math.max(5, expectedDistance * 0.15), Math.max(1.5, expectedDistance * 0.6));
  monitor.netMovement = distanceBetween(oldest, sample);
  monitor.goalImprovement = oldest.goalDistance - goalDistance;
  monitor.makingProgress = monitor.netMovement >= requiredProgress || monitor.goalImprovement >= Math.max(4, requiredProgress * 0.6);
  const repeatedMatches = fingerprint ? monitor.pathHashes.filter(previous => previous === fingerprint).length : 0;
  monitor.repeatedPathCount = monitor.makingProgress ? 0 : repeatedMatches;
  if (monitor.makingProgress) {
    monitor.lowProgressTime = Math.max(0, monitor.lowProgressTime - sinceLastSample * 1.5);
    if (monitor.lowProgressTime < 0.5) monitor.recoveryLevel = 0;
    if (timestamp - monitor.lastRecoveryAt > 20) {
      monitor.routeFailures = 0;
      monitor.emergencyDisplacements = 0;
    }
  } else monitor.lowProgressTime += sinceLastSample;
  monitor.progress = monitor.initialGoalDistance > 0 ? clamp01(1 - goalDistance / monitor.initialGoalDistance) : 1;
  monitor.lastSampleAt = timestamp;
  const stage = recoveryStageFor(monitor);
  const canEscalate = stage > monitor.recoveryLevel && timestamp - monitor.lastRecoveryAt >= 0.6;
  return { sampled: true, recoveryStage: canEscalate ? stage : 0, requiredProgress, repeated: repeatedMatches >= 3, monitor };
}

export function rememberFailedPath(monitor, path = [], cellSize = 32) {
  const size = Math.max(1, Number(cellSize) || 32);
  const cells = path.slice(0, 16).map(point => `${Math.round((Number(point.x) || 0) / size)},${Math.round((Number(point.y) || 0) / size)}`);
  monitor.failedCells = [...new Set([...(monitor.failedCells || []), ...cells])].slice(-24);
  return monitor.failedCells;
}

export function markNavigationRecovery(monitor, stage, { now = 0, failedPath = [] } = {}) {
  monitor.recoveryLevel = Math.max(monitor.recoveryLevel || 0, stage);
  monitor.lastRecoveryAt = Number(now) || 0;
  if (stage === 2) {
    monitor.routeFailures += 1;
    monitor.repaths += 1;
    rememberFailedPath(monitor, failedPath);
  } else if (stage === 3) monitor.emergencyDisplacements += 1;
  else if (stage >= 4) monitor.spawnRecoveries += 1;
  return monitor;
}

export function movementDiagnostic({ baseSpeed = 0, terrain = 1, obstacle = 1, road = 1, fatigue = 1, suppression = 1, legs = 1, condition = 1, fuel = 1, vehicle = 1, speedFactor = 1, monitor = {} } = {}) {
  const factors = { terrain, obstacle, road, fatigue, suppression, legs, condition, fuel, vehicle, speedFactor };
  const effectiveSpeed = Math.max(0, Number(baseSpeed) || 0) * Object.values(factors).reduce((product, factor) => product * Math.max(0, Number(factor) || 0), 1);
  return {
    baseSpeed: Math.max(0, Number(baseSpeed) || 0),
    factors,
    effectiveSpeed,
    navigation: monitor.goalKey ? monitor.makingProgress ? "PATHING" : "RECOVERING" : "DIRECT",
    progress: clamp01(monitor.progress),
    stuck: (monitor.lowProgressTime || 0) >= 1.25,
    lowProgressTime: monitor.lowProgressTime || 0,
    repeatedPathCount: monitor.repeatedPathCount || 0,
    recoveryLevel: monitor.recoveryLevel || 0,
    repaths: monitor.repaths || 0,
    spawnRecoveries: monitor.spawnRecoveries || 0
  };
}
