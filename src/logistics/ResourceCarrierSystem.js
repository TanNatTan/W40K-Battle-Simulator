export const RESOURCE_CARRIER_STATES = Object.freeze([
  "idle",
  "assigned-pickup",
  "travelling-to-source",
  "loading",
  "travelling-to-storage",
  "unloading",
  "returning-to-pickup",
  "disrupted"
]);

export function ensureResourceCarrierState(carrier, assignment = {}) {
  carrier.logisticsState ||= {
    role: "resource-hauler",
    sourceKind: null,
    sourceId: null,
    destinationId: null,
    resourceType: null,
    cargo: 0,
    capacity: carrier.resourceCargo?.capacity || 32,
    state: "idle",
    repeat: true,
    deliveries: 0,
    cargoLost: 0
  };
  Object.assign(carrier.logisticsState, assignment);
  return carrier.logisticsState;
}

export function assignResourceCarrier(carrier, { sourceKind = "production-building", sourceId, destinationId = null, resourceType } = {}) {
  return ensureResourceCarrierState(carrier, {
    sourceKind,
    sourceId,
    destinationId,
    resourceType,
    state: "assigned-pickup",
    repeat: true
  });
}

export function setResourceCarrierState(carrier, state, details = {}) {
  if (!RESOURCE_CARRIER_STATES.includes(state)) throw new Error(`Unknown resource-carrier state: ${state}`);
  return ensureResourceCarrierState(carrier, { ...details, state });
}

export function desiredResourceCarriers(sources = [], base = { x: 0, y: 0 }, minimum = 2) {
  const active = sources.filter(source => source.active !== false && Number(source.remaining ?? source.capacity ?? 1) > 0);
  const distant = active.filter(source => Math.hypot((source.x || 0) - (base.x || 0), (source.y || 0) - (base.y || 0)) > 420).length;
  const highOutput = active.filter(source => Number(source.gatherRate || Object.values(source.exports || {}).reduce((sum, value) => sum + Number(value || 0), 0)) >= 20).length;
  return Math.max(minimum, Math.min(8, Math.ceil(active.length / 2) + Math.ceil(distant / 2) + Math.ceil(highOutput / 2)));
}
