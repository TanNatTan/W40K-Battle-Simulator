const TERMINAL_REQUEST_STATES = Object.freeze(["Delivered", "Denied", "Complete"]);

export function isActiveProductionRequest(request = {}) {
  return request.type === "train" && !TERMINAL_REQUEST_STATES.includes(request.status);
}

export function combatProductionCapacity(hardCap = 0, livingCombatants = 0) {
  const target = Math.max(0, Math.floor(Number(hardCap) || 0));
  const living = Math.max(0, Math.floor(Number(livingCombatants) || 0));
  return Object.freeze({ target, living, availableSlots: Math.max(0, target - living), shouldQueue: living < target });
}

export function selectMilitaryProducer({ structures = [], faction = "", producerTypes = [] } = {}) {
  const allowed = new Set(producerTypes);
  return structures.find(structure => structure?.faction === faction
    && allowed.has(structure.type)
    && structure.progress >= 1
    && structure.alive !== false
    && (structure.condition ?? 1) >= 0.35) || null;
}

export function productionRequestsToProcess(queue = [], strategicLimit = 2) {
  const active = queue.filter(request => !TERMINAL_REQUEST_STATES.includes(request.status));
  const selected = active.slice(0, Math.max(0, Math.floor(Number(strategicLimit) || 0)));
  const military = active.find(isActiveProductionRequest);
  if (military && !selected.includes(military)) selected.push(military);
  return selected;
}

export function trimRequestQueue(queue = [], limit = 12) {
  const maximum = Math.max(1, Math.floor(Number(limit) || 1));
  const retained = queue.slice(0, maximum);
  const military = queue.find(isActiveProductionRequest);
  if (military && !retained.includes(military)) retained[retained.length - 1] = military;
  return retained;
}

export function lockProductionManifest(request = {}, manifest = []) {
  if (!request.productionManifest?.length && manifest.length) {
    request.productionManifest = manifest.map(member => ({ ...member, producerTypes: [...(member.producerTypes || [])] }));
  }
  return request.productionManifest || [];
}
