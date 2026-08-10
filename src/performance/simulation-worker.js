import { analyzeDistantUnits } from "./DistantSimulation.js";

self.onmessage = event => {
  const { requestId, battleGeneration, units = [], dt = 1 } = event.data || {};
  const startedAt = performance.now();
  const analysis = analyzeDistantUnits(units, dt);
  self.postMessage({ requestId, battleGeneration, analysisMs: performance.now() - startedAt, ...analysis });
};
