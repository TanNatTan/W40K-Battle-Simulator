const createRecord = () => ({ calls: 0, totalMs: 0, maximumMs: 0, overBudget: 0 });

export class Profiler {
  constructor({ enabled = false, budgetMs = 8, clock = () => performance.now() } = {}) {
    this.enabled = Boolean(enabled);
    this.budgetMs = Math.max(0, Number(budgetMs) || 0);
    this.clock = clock;
    this.records = new Map();
  }

  profile(name, callback) {
    if (!this.enabled) return callback();
    const startedAt = this.clock();
    try {
      return callback();
    } finally {
      const duration = Math.max(0, this.clock() - startedAt);
      const record = this.records.get(name) || createRecord();
      record.calls += 1;
      record.totalMs += duration;
      record.maximumMs = Math.max(record.maximumMs, duration);
      if (duration > this.budgetMs) record.overBudget += 1;
      this.records.set(name, record);
    }
  }

  report() {
    return [...this.records.entries()]
      .map(([system, record]) => ({
        system,
        calls: record.calls,
        averageMs: Number((record.totalMs / Math.max(1, record.calls)).toFixed(3)),
        maximumMs: Number(record.maximumMs.toFixed(3)),
        overBudget: record.overBudget
      }))
      .sort((first, second) => second.averageMs - first.averageMs);
  }

  reset() {
    this.records.clear();
  }
}
