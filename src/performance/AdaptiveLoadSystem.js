export const LIGHTWEIGHT_ENTITY_THRESHOLD = 280;

export function largeBattleLoadActive(entityCount = 0) {
  return Math.max(0, Number(entityCount) || 0) >= LIGHTWEIGHT_ENTITY_THRESHOLD;
}

export function adaptivePerformanceRequest(requested = "auto", entityCount = 0) {
  // A busy base is simulation load too. Once units plus weighted structures
  // cross the safe threshold, preserve responsiveness with the coarse schedule
  // even when Auto would classify the unit count alone as a normal Battle.
  return largeBattleLoadActive(entityCount) ? "total" : requested;
}

export function adaptiveEntityUpdatePreset(preset = {}, entityCount = 0) {
  if (!largeBattleLoadActive(entityCount)) return preset;
  const veryDense = entityCount >= 600;
  return Object.freeze({
    ...preset,
    // Tactical state is accumulated between visits, so these actors still move
    // and fight at the correct simulated rate without all thinking in one frame.
    nearStride: Math.max(Number(preset.nearStride) || 1, veryDense ? 12 : 8),
    nearEngagedStride: Math.max(Number(preset.nearEngagedStride) || 1, veryDense ? 6 : 4),
    distantStride: Math.max(Number(preset.distantStride) || 1, veryDense ? 24 : 12)
  });
}

export function adaptiveThinkingBudgets(presetId = "skirmish", entityCount = 0) {
  const normal = {
    total: { awareness: 6, sensors: 4 },
    major: { awareness: 16, sensors: 10 },
    battle: { awareness: 32, sensors: 20 },
    skirmish: { awareness: 64, sensors: 40 }
  }[presetId] || { awareness: 32, sensors: 20 };
  if (!largeBattleLoadActive(entityCount)) return Object.freeze(normal);
  return Object.freeze({ awareness: Math.min(normal.awareness, 16), sensors: Math.min(normal.sensors, 10) });
}

export function adaptiveRenderInterval(presetId = "skirmish", speed = 1, entityCount = 0) {
  if (presetId === "total") return 1 / 10;
  if (largeBattleLoadActive(entityCount)) return 1 / 15;
  return speed >= 8 ? 1 / 6 : 1 / 30;
}
