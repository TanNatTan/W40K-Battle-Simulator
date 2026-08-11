const STAGES = Object.freeze(["selected", "funding-wait", "dependency-wait", "site-wait", "builder-travel", "construction", "completed", "cancelled", "training-wait", "force-cap-wait", "manifest-resource-wait", "deployed"]);

export class ConstructionTelemetry {
  constructor(limit = 500) {
    this.limit = Math.max(20, Number(limit) || 500);
    this.records = [];
    this.active = new Map();
  }

  record(key, stage, now, detail = {}) {
    if (!STAGES.includes(stage)) throw new Error(`Unknown construction telemetry stage: ${stage}`);
    const previous = this.active.get(key);
    if (previous?.stage === stage && previous?.blockedReason === detail.blockedReason) return previous;
    const entry = Object.freeze({ key, stage, at: Number(now) || 0, previousStage: previous?.stage || null, ...detail });
    this.active.set(key, entry);
    this.records.push(entry);
    if (this.records.length > this.limit) this.records.splice(0, this.records.length - this.limit);
    return entry;
  }

  historyFor(key) {
    return this.records.filter(entry => entry.key === key);
  }

  summary() {
    const stages = {};
    const blockedReasons = {};
    for (const entry of this.active.values()) {
      stages[entry.stage] = (stages[entry.stage] || 0) + 1;
      if (entry.blockedReason) blockedReasons[entry.blockedReason] = (blockedReasons[entry.blockedReason] || 0) + 1;
    }
    return Object.freeze({ active: this.active.size, records: this.records.length, stages: Object.freeze(stages), blockedReasons: Object.freeze(blockedReasons) });
  }
}
