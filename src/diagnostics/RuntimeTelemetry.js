export class RuntimeTelemetry {
  constructor({ intervalMs = 1000 } = {}) {
    this.intervalMs = Math.max(100, Number(intervalMs) || 1000);
    this.nextUpdateAt = 0;
  }

  shouldUpdate(now, force = false) {
    const current = Number(now) || 0;
    if (!force && current < this.nextUpdateAt) return false;
    this.nextUpdateAt = current + this.intervalMs;
    return true;
  }

  set(element, key, value) {
    if (!element?.dataset) return false;
    const stringValue = String(value);
    if (element.dataset[key] === stringValue) return false;
    element.dataset[key] = stringValue;
    return true;
  }

  reset() {
    this.nextUpdateAt = 0;
  }
}
