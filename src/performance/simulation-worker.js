import { analyzeDistantSnapshot } from "./DistantSimulation.js";

self.onmessage = event => {
  const { requestId, battleGeneration, dt = 1 } = event.data || {};
  const startedAt = performance.now();
  const analysis = analyzeDistantSnapshot(event.data, dt);
  self.postMessage({
    requestId,
    battleGeneration,
    analysisMs: performance.now() - startedAt,
    count: analysis.count,
    processed: analysis.processed,
    factionSummaries: analysis.factionSummaries,
    hostileBuffer: analysis.hostileIndices.buffer,
    allyBuffer: analysis.allyIndices.buffer,
    distanceBuffer: analysis.nearestHostileDistance.buffer
  }, [analysis.hostileIndices.buffer, analysis.allyIndices.buffer, analysis.nearestHostileDistance.buffer]);
};
