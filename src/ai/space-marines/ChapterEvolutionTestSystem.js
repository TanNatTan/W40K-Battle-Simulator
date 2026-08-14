import {
  CHAPTER_FORCE_STRUCTURE_PROFILES,
  chapterForceStructureProfileFor,
  runChapterCapacityTest
} from "./ChapterForceStructureProfile.js";

export const CHAPTER_EVOLUTION_SEQUENCE = Object.freeze(Object.keys(CHAPTER_FORCE_STRUCTURE_PROFILES));
export const CHAPTER_EVOLUTION_THRESHOLDS = Object.freeze({
  doctrineFidelity: 80,
  objectiveAdherence: 90,
  consecutivePasses: 3,
  defaultRunDurationMs: 10 * 60 * 1000
});
export const DOCTRINE_DIFFERENCE_MINIMUM = 12;
export const DOCTRINE_VECTOR_KEYS = Object.freeze([
  "compositionDiversity", "specialistNeedResponse", "weaponLoadoutDiversity", "vehicleUtilization",
  "engagementDistance", "formationDiversity", "reconUsage", "defensiveBehavior", "deploymentVariety", "regroupBehavior",
  "packCoordination", "crusadePressure"
]);

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));
const roundScore = value => Math.round(clamp01(value) * 1000) / 10;

export function chapterDecisionPriorities({ objectiveNeed = {}, battlefieldNeed = {}, learnedExperience = {}, chapterDoctrine = {}, learningConfidence = 0 } = {}) {
  const keys = new Set([...Object.keys(objectiveNeed), ...Object.keys(battlefieldNeed), ...Object.keys(learnedExperience), ...Object.keys(chapterDoctrine)]);
  const confidence = clamp01(learningConfidence);
  return Object.freeze(Object.fromEntries([...keys].map(key => [key,
    (Number(objectiveNeed[key]) || 0)
    + (Number(battlefieldNeed[key]) || 0)
    + (Number(learnedExperience[key]) || 0) * confidence
    + (Number(chapterDoctrine[key]) || 0)
  ])));
}

export function doctrineBehaviorVector(metrics = {}) {
  return Object.freeze(Object.fromEntries(DOCTRINE_VECTOR_KEYS.map(key => [key, clamp01(metrics[key])])));
}

export function doctrineDifferenceScore(leftMetrics = {}, rightMetrics = {}) {
  const left = doctrineBehaviorVector(leftMetrics);
  const right = doctrineBehaviorVector(rightMetrics);
  const squaredDistance = DOCTRINE_VECTOR_KEYS.reduce((sum, key) => sum + (left[key] - right[key]) ** 2, 0) / DOCTRINE_VECTOR_KEYS.length;
  return roundScore(Math.sqrt(squaredDistance));
}

function doctrineEvidenceScore(profile, metrics) {
  const expected = profile.doctrine.behaviors;
  const evidence = metrics.doctrineEvidence || {};
  if (!expected.length) return 1;
  const behaviorScore = expected.reduce((sum, behavior) => {
    const row = evidence[behavior];
    if (typeof row === "boolean") return sum + (row ? 1 : 0);
    if (typeof row === "number") return sum + clamp01(row);
    if (row && typeof row === "object") return sum + clamp01((Number(row.successes) || 0) / Math.max(1, Number(row.opportunities) || 0));
    return sum;
  }, 0) / expected.length;
  const composition = clamp01(metrics.compositionDiversity ?? 0);
  const vehicle = clamp01(metrics.vehicleUtilization ?? 0);
  const specialists = clamp01(metrics.specialistNeedResponse ?? 0);
  const weaponDiversity = clamp01(metrics.weaponLoadoutDiversity ?? 0);
  const identity = clamp01(metrics.antiHomogenization ?? 0);
  return behaviorScore * 0.5 + composition * 0.13 + vehicle * 0.1 + specialists * 0.1 + weaponDiversity * 0.07 + identity * 0.1;
}

function objectiveAdherence(metrics) {
  const progress = clamp01(metrics.objectiveProgress ?? (metrics.objectiveCompleted ? 1 : 0));
  const usefulOrders = Math.max(0, Number(metrics.objectiveOrders) || 0);
  const divertedOrders = Math.max(0, Number(metrics.unrelatedOrders) || 0);
  const orderFocus = usefulOrders + divertedOrders ? usefulOrders / (usefulOrders + divertedOrders) : progress;
  const mapPresence = clamp01(metrics.mapPresence ?? 0);
  const sustainment = clamp01(metrics.economyControl ?? 0);
  const completion = metrics.objectiveCompleted ? 1 : progress;
  return completion * 0.55 + orderFocus * 0.25 + mapPresence * 0.1 + sustainment * 0.1;
}

export function evaluateChapterEvolutionRun(chapter, metrics = {}) {
  const profile = chapterForceStructureProfileFor(chapter);
  const doctrineFidelityScore = roundScore(doctrineEvidenceScore(profile, metrics));
  const objectiveAdherenceScore = roundScore(objectiveAdherence(metrics));
  const checks = Object.freeze({
    doctrineFidelity: doctrineFidelityScore >= CHAPTER_EVOLUTION_THRESHOLDS.doctrineFidelity,
    objectiveAdherence: objectiveAdherenceScore >= CHAPTER_EVOLUTION_THRESHOLDS.objectiveAdherence,
    objectiveAuthoritative: metrics.objectiveOverridden !== true,
    stableRuntime: metrics.froze !== true && metrics.runtimeErrors !== true,
    organizationValid: metrics.organizationValid !== false,
    capacityUnblocked: metrics.capacityUnblocked !== false,
    compositionDiverse: clamp01(metrics.compositionDiversity) >= 0.6,
    vehiclesUsed: clamp01(metrics.vehicleUtilization) >= 0.5,
    antiHomogenization: clamp01(metrics.antiHomogenization) >= 0.6,
    noLearningCheats: metrics.learningCheats !== true,
    noForbiddenUnits: Math.max(0, Number(metrics.forbiddenUnitCount) || 0) === 0,
    capabilitiesAvailable: Math.max(0, Number(metrics.missingCapabilities) || 0) === 0
  });
  return Object.freeze({
    chapter: profile.chapter,
    doctrineFidelityScore,
    objectiveAdherenceScore,
    checks,
    passed: Object.values(checks).every(Boolean),
    failedChecks: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name),
    metrics: Object.freeze({ ...metrics })
  });
}

export function createChapterEvolutionTest({ chapters = CHAPTER_EVOLUTION_SEQUENCE, passesRequired = CHAPTER_EVOLUTION_THRESHOLDS.consecutivePasses, runDurationMs = CHAPTER_EVOLUTION_THRESHOLDS.defaultRunDurationMs, startedAt = Date.now() } = {}) {
  return {
    version: 1,
    active: false,
    completed: false,
    chapters: [...chapters],
    chapterIndex: 0,
    iteration: 0,
    consecutivePasses: 0,
    passesRequired: Math.max(1, Math.floor(passesRequired)),
    runDurationMs: Math.max(1000, Math.floor(runDurationMs)),
    startedAt,
    runStartedAt: startedAt,
    nextRestartAt: startedAt + Math.max(1000, Math.floor(runDurationMs)),
    history: [],
    chapterResults: {},
    lastEvaluation: null,
    learningSummary: "No completed battle observations yet."
  };
}

export function beginChapterEvolutionTest(testState, now = Date.now()) {
  testState.active = true;
  testState.completed = false;
  testState.startedAt = now;
  testState.runStartedAt = now;
  testState.nextRestartAt = now + testState.runDurationMs;
  return testState;
}

export function recordChapterEvolutionRun(testState, metrics = {}, now = Date.now()) {
  if (!testState || testState.completed) return testState?.lastEvaluation || null;
  const chapter = testState.chapters[testState.chapterIndex];
  const baseEvaluation = evaluateChapterEvolutionRun(chapter, metrics);
  const priorChapters = Object.entries(testState.chapterResults).filter(([name, result]) => name !== chapter && result?.final?.metrics);
  const nearestDifference = priorChapters.length ? Math.min(...priorChapters.map(([, result]) => doctrineDifferenceScore(metrics, result.final.metrics))) : 100;
  const distinct = nearestDifference >= DOCTRINE_DIFFERENCE_MINIMUM;
  const checks = Object.freeze({ ...baseEvaluation.checks, chapterDistinct: distinct });
  const evaluation = Object.freeze({ ...baseEvaluation, checks, nearestChapterDifference: nearestDifference,
    passed: Object.values(checks).every(Boolean), failedChecks: Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name) });
  testState.iteration += 1;
  testState.consecutivePasses = evaluation.passed ? testState.consecutivePasses + 1 : 0;
  const record = Object.freeze({ ...evaluation, iteration: testState.iteration, at: now, streak: testState.consecutivePasses });
  testState.history.push(record);
  testState.lastEvaluation = record;
  testState.learningSummary = metrics.learningSummary || (evaluation.passed
    ? `Stable doctrine evidence retained for ${chapter}.`
    : `Adjustment required: ${evaluation.failedChecks.join(", ")}.`);
  if (testState.consecutivePasses >= testState.passesRequired) {
    testState.chapterResults[chapter] = Object.freeze({ passed: true, attempts: testState.history.filter(item => item.chapter === chapter).length, final: record });
    testState.chapterIndex += 1;
    testState.consecutivePasses = 0;
    if (testState.chapterIndex >= testState.chapters.length) {
      testState.completed = true;
      testState.active = false;
    }
  }
  testState.runStartedAt = now;
  testState.nextRestartAt = now + testState.runDurationMs;
  return record;
}

export function chapterEvolutionPanelSnapshot(testState, now = Date.now()) {
  const chapter = testState?.chapters?.[testState.chapterIndex] || testState?.chapters?.at(-1) || "--";
  const elapsedMs = Math.max(0, now - (testState?.startedAt ?? now));
  const restartMs = testState?.completed ? 0 : Math.max(0, (testState?.nextRestartAt || now) - now);
  const runElapsedMs = Math.max(0, Math.min(testState?.runDurationMs || 0, now - (testState?.runStartedAt ?? now)));
  return Object.freeze({
    chapter,
    iteration: testState?.iteration || 0,
    elapsedMs,
    runElapsedMs,
    runDurationMs: testState?.runDurationMs || CHAPTER_EVOLUTION_THRESHOLDS.defaultRunDurationMs,
    consecutivePasses: testState?.consecutivePasses || 0,
    passesRequired: testState?.passesRequired || CHAPTER_EVOLUTION_THRESHOLDS.consecutivePasses,
    doctrineFidelityScore: testState?.lastEvaluation?.doctrineFidelityScore ?? null,
    objectiveAdherenceScore: testState?.lastEvaluation?.objectiveAdherenceScore ?? null,
    learningSummary: testState?.learningSummary || "No completed battle observations yet.",
    restartMs,
    completed: Boolean(testState?.completed),
    active: Boolean(testState?.active)
  });
}

export function runAllChapterCapacityTests(options = {}) {
  return Object.freeze(CHAPTER_EVOLUTION_SEQUENCE.map(chapter => runChapterCapacityTest(chapter, options)));
}
