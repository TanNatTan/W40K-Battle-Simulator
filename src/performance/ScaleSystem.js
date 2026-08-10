export const SCALE_PRESETS = Object.freeze({
  skirmish: Object.freeze({ label: "Skirmish", targetUnits: 120, nearStride: 1, nearEngagedStride: 1, distantStride: 2, snapshotSeconds: 1.5, pathBudget: 16, pathVisited: 5200, logBatch: 24 }),
  battle: Object.freeze({ label: "Battle", targetUnits: 400, nearStride: 1, nearEngagedStride: 1, distantStride: 3, snapshotSeconds: 3, pathBudget: 12, pathVisited: 4200, logBatch: 40 }),
  major: Object.freeze({ label: "Major Battle", targetUnits: 1000, nearStride: 2, nearEngagedStride: 2, distantStride: 6, snapshotSeconds: 6, pathBudget: 8, pathVisited: 2800, logBatch: 64 }),
  total: Object.freeze({ label: "Total Battlefield", targetUnits: 4000, nearStride: 6, nearEngagedStride: 6, distantStride: 15, snapshotSeconds: 12, pathBudget: 1, pathVisited: 900, logBatch: 96 })
});

export function scalePresetFor(unitCount = 0, requested = "auto") {
  if (requested !== "auto" && SCALE_PRESETS[requested]) return { id: requested, ...SCALE_PRESETS[requested] };
  const id = unitCount <= 120 ? "skirmish" : unitCount <= 400 ? "battle" : unitCount <= 1000 ? "major" : "total";
  return { id, ...SCALE_PRESETS[id] };
}

export function shouldUpdateEntity({ index = 0, frame = 0, distanceFromCamera = 0, critical = false, engaged = false, preset } = {}) {
  if (critical) return true;
  if (distanceFromCamera < 900) {
    const nearStride = Math.max(1, engaged ? preset?.nearEngagedStride || 1 : preset?.nearStride || 1);
    return (index + frame) % nearStride === 0;
  }
  const baseStride = Math.max(1, preset?.distantStride || 1);
  const stride = engaged ? Math.max(1, Math.ceil(baseStride / 2)) : baseStride;
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

export class WorkBudget {
  constructor(limit = 0) {
    this.limit = 0;
    this.remaining = 0;
    this.used = 0;
    this.deferred = 0;
    this.begin(limit);
  }

  begin(limit = this.limit) {
    this.limit = Math.max(0, Math.floor(Number(limit) || 0));
    this.remaining = this.limit;
    this.used = 0;
    this.deferred = 0;
    return this;
  }

  take(weight = 1) {
    const cost = Math.max(1, Math.floor(Number(weight) || 1));
    if (this.remaining < cost) {
      this.deferred += 1;
      return false;
    }
    this.remaining -= cost;
    this.used += cost;
    return true;
  }
}

export class ObjectPool {
  constructor(factory, reset = value => value) { this.factory = factory; this.reset = reset; this.free = []; this.active = new Set(); }
  acquire() { const value = this.free.pop() || this.factory(); this.active.add(value); return value; }
  release(value) { if (!this.active.delete(value)) return false; this.reset(value); this.free.push(value); return true; }
}
