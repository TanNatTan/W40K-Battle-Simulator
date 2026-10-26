// Main-thread side of the terrain bake workers. It keeps a bounded number of
// requests in flight across a small pool, drops results that were superseded
// (the map was reset or the chunk changed again) and reports when workers are
// not available so the caller can bake synchronously instead.

export class TerrainBakeClient {
  constructor({ createWorker, poolSize = 1, perWorker = 1 } = {}) {
    this.createWorker = createWorker;
    this.poolSize = Math.max(1, poolSize);
    this.perWorker = Math.max(1, perWorker);
    this.pool = [];
    this.failed = false;
    this.nextId = 1;
    this.generation = 0;
    this.pending = new Map(); // id -> { key, rev, onDone, generation, slot }
    this.pendingKeys = new Map(); // key -> rev
    this.stats = { requested: 0, completed: 0, dropped: 0, totalMs: 0 };
  }

  get available() {
    if (this.failed || !this.createWorker) return false;
    if (!this.pool.length) {
      try {
        for (let index = 0; index < this.poolSize; index += 1) {
          const slot = { worker: this.createWorker(), load: 0 };
          slot.worker.onmessage = event => this.receive(event.data || {});
          slot.worker.onerror = () => this.fail();
          this.pool.push(slot);
        }
      } catch {
        this.fail();
        return false;
      }
    }
    return this.pool.length > 0;
  }

  get capacity() { return this.poolSize * this.perWorker; }
  get busy() { return this.pending.size >= this.capacity; }
  get inFlight() { return this.pending.size; }

  isPending(key, rev) { return this.pendingKeys.get(key) === rev; }

  request(key, rev, input, onDone) {
    if (!this.available || this.busy) return false;
    const slot = this.pool.reduce((best, item) => (item.load < best.load ? item : best));
    const id = this.nextId++;
    const transfer = [input.lattice?.buffer];
    if (input.padded) for (const grid of Object.values(input.padded)) transfer.push(grid.buffer);
    this.pending.set(id, { key, rev, onDone, generation: this.generation, slot });
    this.pendingKeys.set(key, rev);
    slot.load += 1;
    try {
      slot.worker.postMessage({ id, key, rev, generation: this.generation, input }, transfer.filter(Boolean));
    } catch {
      this.fail();
      return false;
    }
    this.stats.requested += 1;
    return true;
  }

  receive(message) {
    const job = this.pending.get(message.id);
    if (!job) return;
    this.pending.delete(message.id);
    job.slot.load = Math.max(0, job.slot.load - 1);
    if (this.pendingKeys.get(job.key) === job.rev) this.pendingKeys.delete(job.key);
    if (message.error || job.generation !== this.generation) {
      this.stats.dropped += 1;
      if (message.error) this.fail();
      return;
    }
    this.stats.completed += 1;
    this.stats.totalMs += message.ms || 0;
    job.onDone({ key: job.key, rev: job.rev, size: message.size, pixels: new Uint8ClampedArray(message.pixels) });
  }

  // Forget everything in flight (new map, palette change, ...).
  reset() {
    this.generation += 1;
    this.pendingKeys.clear();
  }

  fail() {
    this.failed = true;
    for (const slot of this.pool) {
      try { slot.worker.terminate(); } catch { /* already gone */ }
    }
    this.pool = [];
    this.pending.clear();
    this.pendingKeys.clear();
  }

  dispose() { this.fail(); }
}
