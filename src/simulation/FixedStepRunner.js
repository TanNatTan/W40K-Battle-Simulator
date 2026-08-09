export function runFixedStepBudget({
  accumulator = 0,
  stepSeconds = 1 / 20,
  maxSteps = 3,
  maxWorkMs = 8,
  backlogSteps = 4,
  clock = () => performance.now(),
  update
} = {}) {
  if (typeof update !== "function") throw new TypeError("A fixed-step update callback is required.");
  const step = Math.max(Number.EPSILON, Number(stepSeconds) || 1 / 20);
  const stepLimit = Math.max(1, Math.floor(Number(maxSteps) || 1));
  const workLimit = Math.max(0, Number(maxWorkMs) || 0);
  const startedAt = clock();
  let remaining = Math.max(0, Number(accumulator) || 0);
  let steps = 0;

  while (remaining >= step && steps < stepLimit && clock() - startedAt < workLimit) {
    update(step);
    remaining -= step;
    steps += 1;
  }

  const droppedBacklog = remaining > step * Math.max(1, Number(backlogSteps) || 1);
  if (droppedBacklog) remaining = step * Math.max(1, Number(backlogSteps) || 1);
  return { accumulator: remaining, steps, droppedBacklog, workMs: Math.max(0, clock() - startedAt) };
}
