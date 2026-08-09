export class SnapshotRingBuffer extends Array {
  static get [Symbol.species]() { return Array; }

  constructor(capacity = 180) {
    super();
    this.capacity = Math.max(2, Math.floor(Number(capacity) || 180));
  }

  push(...values) {
    for (const value of values) {
      if (this.length < this.capacity) {
        super.push(value);
      } else {
        this.copyWithin(0, 1);
        this[this.length - 1] = value;
      }
    }
    return this.length;
  }

  clear() {
    this.length = 0;
  }
}
