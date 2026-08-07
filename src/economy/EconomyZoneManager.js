import {
  createResourceZone,
  drainResourceZone,
  pointInResourceZone,
  regenerateResourceZone,
  serializeResourceZone,
  syncResourceZone
} from "./ResourceZones.js";

const copyPoint = point => ({ x: Number(point?.x) || 0, y: Number(point?.y) || 0 });

/** Canonical runtime/editor owner for map-authored polygon resource zones. */
export class EconomyZoneManager {
  constructor(zones = []) {
    this.zones = [];
    this.byId = new Map();
    this.loadState(zones);
  }

  loadState(payload = []) {
    const zones = Array.isArray(payload) ? payload : payload.zones || [];
    this.zones = zones.map((zone, index) => createResourceZone(
      zone.id || `resource-zone-${index + 1}`,
      zone,
      { ...zone, points: zone.points?.map(copyPoint) }
    ));
    this._reindex();
    return this.zones;
  }

  adopt(zones = []) {
    this.zones = zones;
    for (const zone of this.zones) syncResourceZone(zone);
    this._reindex();
    return this.zones;
  }

  _reindex() {
    this.byId = new Map(this.zones.map(zone => [zone.id, zone]));
  }

  create(id, center, overrides = {}) {
    if (this.byId.has(id)) throw new Error(`Economy zone already exists: ${id}`);
    const zone = createResourceZone(id, center, overrides);
    this.zones.push(zone);
    this.byId.set(zone.id, zone);
    return zone;
  }

  remove(id) {
    const index = this.zones.findIndex(zone => zone.id === id);
    if (index < 0) return false;
    this.zones.splice(index, 1);
    this.byId.delete(id);
    return true;
  }

  addPoint(id, point, index = null) {
    const zone = this.byId.get(id);
    if (!zone) return null;
    const insertAt = index == null ? zone.points.length : Math.max(0, Math.min(zone.points.length, index));
    zone.points.splice(insertAt, 0, copyPoint(point));
    return syncResourceZone(zone);
  }

  movePoint(id, index, point) {
    const zone = this.byId.get(id);
    if (!zone?.points[index]) return null;
    Object.assign(zone.points[index], copyPoint(point));
    return syncResourceZone(zone);
  }

  deletePoint(id, index) {
    const zone = this.byId.get(id);
    if (!zone || zone.points.length <= 3 || !zone.points[index]) return false;
    zone.points.splice(index, 1);
    syncResourceZone(zone);
    return true;
  }

  bendEdge(id, edgeIndex, amount = 0.5) {
    const zone = this.byId.get(id);
    if (!zone?.points.length) return null;
    const a = zone.points[((edgeIndex % zone.points.length) + zone.points.length) % zone.points.length];
    const b = zone.points[(edgeIndex + 1 + zone.points.length) % zone.points.length];
    return this.addPoint(id, {
      x: a.x + (b.x - a.x) * amount,
      y: a.y + (b.y - a.y) * amount
    }, edgeIndex + 1);
  }

  at(point) {
    return this.zones.filter(zone => pointInResourceZone(point, zone));
  }

  harvest(id, requested) {
    const zone = this.byId.get(id);
    return zone ? drainResourceZone(zone, requested) : 0;
  }

  tick(dt) {
    let regenerated = 0;
    for (const zone of this.zones) regenerated += regenerateResourceZone(zone, dt);
    return regenerated;
  }

  toJSON() {
    return { version: 1, zones: this.zones.map(zone => serializeResourceZone(zone)) };
  }
}
