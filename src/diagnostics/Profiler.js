class TimingRecord {
  constructor(sampleCount = 256) {
    this.samples = new Float32Array(sampleCount);
    this.cursor = 0;
    this.sampleSize = 0;
    this.calls = 0;
    this.totalMs = 0;
    this.maximumMs = 0;
    this.overBudget = 0;
    this.firstAt = null;
    this.lastAt = null;
  }

  push(duration, at, budgetMs) {
    this.samples[this.cursor] = duration;
    this.cursor = (this.cursor + 1) % this.samples.length;
    this.sampleSize = Math.min(this.samples.length, this.sampleSize + 1);
    this.calls += 1;
    this.totalMs += duration;
    this.maximumMs = Math.max(this.maximumMs, duration);
    if (duration > budgetMs) this.overBudget += 1;
    this.firstAt ??= at;
    this.lastAt = at;
  }

  percentile(fraction) {
    if (!this.sampleSize) return 0;
    const sorted = Array.from(this.samples.subarray(0, this.sampleSize)).sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
  }
}

export class Profiler {
  constructor({ enabled = false, budgetMs = 8, sampleCount = 256, clock = () => performance.now() } = {}) {
    this.enabled = Boolean(enabled);
    this.budgetMs = Math.max(0, Number(budgetMs) || 0);
    this.clock = clock;
    this.sampleCount = Math.max(16, Number(sampleCount) || 256);
    this.records = new Map();
  }

  profile(name, callback) {
    if (!this.enabled) return callback();
    const startedAt = this.clock();
    try {
      return callback();
    } finally {
      const duration = Math.max(0, this.clock() - startedAt);
      const record = this.records.get(name) || new TimingRecord(this.sampleCount);
      record.push(duration, startedAt, this.budgetMs);
      this.records.set(name, record);
    }
  }

  report() {
    return [...this.records.entries()]
      .map(([system, record]) => ({
        system,
        calls: record.calls,
        averageMs: Number((record.totalMs / Math.max(1, record.calls)).toFixed(3)),
        p50Ms: Number(record.percentile(0.5).toFixed(3)),
        p90Ms: Number(record.percentile(0.9).toFixed(3)),
        p95Ms: Number(record.percentile(0.95).toFixed(3)),
        p99Ms: Number(record.percentile(0.99).toFixed(3)),
        maximumMs: Number(record.maximumMs.toFixed(3)),
        overBudget: record.overBudget,
        callsPerSecond: record.lastAt > record.firstAt ? Number((record.calls * 1000 / (record.lastAt - record.firstAt)).toFixed(2)) : record.calls
      }))
      .sort((first, second) => second.averageMs - first.averageMs);
  }

  reset() {
    this.records.clear();
  }
}
