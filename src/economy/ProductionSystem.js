const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

export function enabledProductionOutputs(definition, connection = {}) {
  if (!definition) return {};
  const outputs = { ...(definition.baseOutputs || definition.outputs || {}) };
  const tags = new Set(connection.componentSummary?.tags || connection.tags || []);
  for (const rule of definition.synergyRules || []) {
    const matches = rule.requiresTags.every(tag => tags.has(tag));
    if (!matches) continue;
    const partnerCount = connection.componentSummary?.structureIds?.length ?? connection.componentSummary?.structureCount ?? 0;
    if (partnerCount < (rule.minPartners || 1)) continue;
    for (const [resource, rate] of Object.entries(rule.addOutputs || {})) outputs[resource] = Math.max(outputs[resource] || 0, rate);
  }
  return outputs;
}

function outputCapacity(definition, resource) {
  return typeof definition.bufferCapacity === "object"
    ? Math.max(0, Number(definition.bufferCapacity[resource]) || 0)
    : null;
}

export function updateProductionBuilding(structure, definition, connection, dt, { activeResources = [], factionMultiplier = 1, demand = {} } = {}) {
  if (!definition || structure.alive === false || structure.progress < 1) return { produced: {}, consumed: {}, reason: "inactive" };
  structure.inventory ||= {};
  structure.productionState ||= { componentId: null, enabledOutputs: {}, disconnectedFor: 0, lastReason: "starting", totalProduced: 0, totalProducedByResource: {} };
  const state = structure.productionState;
  state.totalProduced ||= 0;
  state.totalProducedByResource ||= {};
  const resolvedOutputs = enabledProductionOutputs(definition, connection);
  const enabledOutputs = !connection?.connected && state.disconnectedFor <= definition.graceSeconds && Object.keys(state.enabledOutputs || {}).length
    ? { ...state.enabledOutputs }
    : resolvedOutputs;
  state.componentId = connection?.componentId || null;
  state.enabledOutputs = { ...enabledOutputs };
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
  const outputIds = Object.keys(enabledOutputs).filter(resource => active.has(resource));
  const sharedCapacity = typeof definition.bufferCapacity === "number" ? definition.bufferCapacity : null;
  const storedOutput = outputIds.reduce((sum, resource) => sum + (structure.inventory[resource] || 0), 0);
  const bufferFactor = sharedCapacity == null
    ? outputIds.reduce((sum, resource) => sum + clamp(1 - (structure.inventory[resource] || 0) / Math.max(1, outputCapacity(definition, resource)), 0, 1), 0) / Math.max(1, outputIds.length)
    : clamp(1 - storedOutput / sharedCapacity, 0, 1);
  const demandFactor = clamp(outputIds.reduce((sum, resource) => sum + (Number(demand[resource]) || 0.6), 0) / Math.max(1, outputIds.length), 0.2, 1);
  const conditionFactor = clamp(Number(structure.condition) || 1, 0.15, 1);
  const factor = conditionFactor * clamp(connection?.throughput ?? 1, 0, 1) * inputFactor * clamp(factionMultiplier, 0.2, 2) * bufferFactor * demandFactor;
  const consumed = {};
  for (const [resource, rate] of Object.entries(definition.inputs)) {
    if (!active.has(resource)) continue;
    const amount = Math.min(structure.inventory[resource] || 0, rate * dt * factor);
    structure.inventory[resource] = Math.max(0, (structure.inventory[resource] || 0) - amount);
    consumed[resource] = amount;
  }
  const requests = Object.fromEntries(outputIds.map(resource => [resource, Math.max(0, enabledOutputs[resource] * dt * factor)]));
  const requestedTotal = Object.values(requests).reduce((sum, amount) => sum + amount, 0);
  const sharedRoom = sharedCapacity == null ? Infinity : Math.max(0, sharedCapacity - storedOutput);
  const sharedScale = requestedTotal > sharedRoom ? sharedRoom / Math.max(0.001, requestedTotal) : 1;
  const produced = {};
  for (const resource of outputIds) {
    const room = outputCapacity(definition, resource);
    const amount = Math.min(room == null ? Infinity : Math.max(0, room - (structure.inventory[resource] || 0)), requests[resource] * sharedScale);
    structure.inventory[resource] = (structure.inventory[resource] || 0) + amount;
    produced[resource] = amount;
    state.totalProduced += amount;
    state.totalProducedByResource[resource] = (state.totalProducedByResource[resource] || 0) + amount;
  }
  state.lastReason = Object.values(produced).some(Boolean) ? "producing" : "buffer-full";
  return { produced, consumed, reason: state.lastReason, factor };
}
