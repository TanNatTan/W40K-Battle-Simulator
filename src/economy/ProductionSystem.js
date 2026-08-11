const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function updateProductionBuilding(structure, definition, connection, dt, { activeResources = [], factionMultiplier = 1, demand = {} } = {}) {
  if (!definition || structure.alive === false || structure.progress < 1) return { produced: {}, consumed: {}, reason: "inactive" };
  structure.inventory ||= {};
  structure.productionState ||= { disconnectedFor: 0, lastReason: "starting", totalProduced: 0 };
  const state = structure.productionState;
  state.disconnectedFor = connection?.connected ? 0 : state.disconnectedFor + dt;
  if (!connection?.connected && state.disconnectedFor > definition.graceSeconds) {
    state.lastReason = "disconnected";
    return { produced: {}, consumed: {}, reason: "disconnected" };
  }
  const active = new Set(activeResources);
  const inputFactor = Math.min(1, ...Object.entries(definition.inputs)
    .filter(([resource]) => active.has(resource))
    .map(([resource, rate]) => (structure.inventory[resource] || 0) / Math.max(0.001, rate * dt)));
  if (inputFactor <= 0) {
    state.lastReason = "missing-input";
    return { produced: {}, consumed: {}, reason: "missing-input" };
  }
  const storedOutput = Object.keys(definition.outputs).reduce((sum, resource) => sum + (structure.inventory[resource] || 0), 0);
  const bufferFactor = clamp(1 - storedOutput / definition.bufferCapacity, 0, 1);
  const demandFactor = clamp(Object.keys(definition.outputs).reduce((sum, resource) => sum + (Number(demand[resource]) || 0.6), 0) / Math.max(1, Object.keys(definition.outputs).length), 0.2, 1);
  const conditionFactor = clamp(Number(structure.condition) || 1, 0.15, 1);
  const factor = conditionFactor * clamp(connection?.throughput ?? 1, 0, 1) * inputFactor * clamp(factionMultiplier, 0.2, 2) * bufferFactor * demandFactor;
  const consumed = {};
  for (const [resource, rate] of Object.entries(definition.inputs)) {
    if (!active.has(resource)) continue;
    const amount = Math.min(structure.inventory[resource] || 0, rate * dt * factor);
    structure.inventory[resource] = Math.max(0, (structure.inventory[resource] || 0) - amount);
    consumed[resource] = amount;
  }
  const produced = {};
  for (const [resource, rate] of Object.entries(definition.outputs)) {
    if (!active.has(resource)) continue;
    const room = Math.max(0, definition.bufferCapacity - Object.keys(definition.outputs).reduce((sum, key) => sum + (structure.inventory[key] || 0), 0));
    const amount = Math.min(room, rate * dt * factor);
    structure.inventory[resource] = (structure.inventory[resource] || 0) + amount;
    produced[resource] = amount;
    state.totalProduced += amount;
  }
  state.lastReason = Object.values(produced).some(Boolean) ? "producing" : "buffer-full";
  return { produced, consumed, reason: state.lastReason, factor };
}
