export const SCALE_PRESETS = Object.freeze({
  skirmish: Object.freeze({ label: "Skirmish", targetUnits: 120, distantStride: 2, snapshotSeconds: 1.5, pathBudget: 16, logBatch: 24 }),
  battle: Object.freeze({ label: "Battle", targetUnits: 400, distantStride: 3, snapshotSeconds: 3, pathBudget: 12, logBatch: 40 }),
  major: Object.freeze({ label: "Major Battle", targetUnits: 1000, distantStride: 6, snapshotSeconds: 6, pathBudget: 8, logBatch: 64 }),
  total: Object.freeze({ label: "Total Battlefield", targetUnits: 4000, distantStride: 10, snapshotSeconds: 12, pathBudget: 4, logBatch: 96 })
});

export function scalePresetFor(unitCount = 0, requested = "auto") {
  if (requested !== "auto" && SCALE_PRESETS[requested]) return { id: requested, ...SCALE_PRESETS[requested] };
  const id = unitCount <= 120 ? "skirmish" : unitCount <= 400 ? "battle" : unitCount <= 1000 ? "major" : "total";
  return { id, ...SCALE_PRESETS[id] };
}

export function shouldUpdateEntity({ index = 0, frame = 0, distanceFromCamera = 0, critical = false, preset } = {}) {
  if (critical || distanceFromCamera < 900) return true;
  const stride = Math.max(1, preset?.distantStride || 1);
  return (index + frame) % stride === 0;
}

export function statisticalDistantCombat(first, second, dt, random = Math.random) {
  if (!first?.alive || !second?.alive || first.faction === second.faction) return null;
  const firstPower = Math.max(0, first.damage || 0) * Math.max(0.1, first.accuracy || 0.5) * Math.max(0.1, first.morale || 0.5);
  const secondPower = Math.max(0, second.damage || 0) * Math.max(0.1, second.accuracy || 0.5) * Math.max(0.1, second.morale || 0.5);
  const exchange = Math.max(0, Number(dt) || 0) * (0.75 + random() * 0.5);
  const firstLoss = secondPower * exchange * 0.02;
  const secondLoss = firstPower * exchange * 0.02;
  first.hp = Math.max(0, first.hp - firstLoss);
  second.hp = Math.max(0, second.hp - secondLoss);
  if (first.hp <= 0) first.alive = false;
  if (second.hp <= 0) second.alive = false;
  return { firstLoss, secondLoss };
}

export class ObjectPool {
  constructor(factory, reset = value => value) { this.factory = factory; this.reset = reset; this.free = []; this.active = new Set(); }
  acquire() { const value = this.free.pop() || this.factory(); this.active.add(value); return value; }
  release(value) { if (!this.active.delete(value)) return false; this.reset(value); this.free.push(value); return true; }
}
