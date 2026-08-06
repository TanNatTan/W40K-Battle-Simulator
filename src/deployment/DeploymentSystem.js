export const DEPLOYMENT_METHODS = Object.freeze([
  "ground-deployment", "map-edge-convoy", "drop-pod", "aircraft-landing", "teleportation",
  "underground-emergence", "biological-spawning", "reanimation", "warp-summoning"
]);

export const FACTION_DEPLOYMENT_DEFAULTS = Object.freeze({
  "Space Marines": Object.freeze(["ground-deployment", "drop-pod", "aircraft-landing", "teleportation"]),
  "Imperial Guard": Object.freeze(["ground-deployment", "map-edge-convoy", "aircraft-landing"]),
  Chaos: Object.freeze(["ground-deployment", "warp-summoning", "teleportation"]),
  Orks: Object.freeze(["ground-deployment", "map-edge-convoy", "biological-spawning"]),
  Necrons: Object.freeze(["reanimation", "teleportation", "ground-deployment"]),
  "T'au": Object.freeze(["ground-deployment", "aircraft-landing", "map-edge-convoy"]),
  Tyranids: Object.freeze(["biological-spawning", "underground-emergence", "aircraft-landing"])
});

export function deploymentDefaultsFor({ faction = "", race = "" } = {}) {
  return FACTION_DEPLOYMENT_DEFAULTS[faction] || FACTION_DEPLOYMENT_DEFAULTS[race] || Object.freeze(["ground-deployment"]);
}

function inferMethod(label, defaults) {
  const text = String(label || "").toLowerCase();
  if (/drop pod|orbital pod/.test(text)) return "drop-pod";
  if (/aircraft|valkyrie|thunderhawk|orca|landing/.test(text)) return "aircraft-landing";
  if (/teleport|portal/.test(text)) return "teleportation";
  if (/underground|tunnel|emerg/.test(text)) return "underground-emergence";
  if (/spore|gestat|brood|spawn|nest/.test(text)) return "biological-spawning";
  if (/reanim|tomb/.test(text)) return "reanimation";
  if (/warp|summon|ritual/.test(text)) return "warp-summoning";
  if (/convoy|map edge/.test(text)) return "map-edge-convoy";
  return defaults[0] || "ground-deployment";
}

export function createDeploymentRecord({ faction, race, source, time = 0, sequence = 0 } = {}) {
  const defaults = deploymentDefaultsFor({ faction, race });
  const input = typeof source === "object" && source ? source : { label: source };
  const method = DEPLOYMENT_METHODS.includes(input.method) ? input.method : inferMethod(input.label, defaults);
  const sourceId = input.sourceId || `${method}:${faction || race || "neutral"}`;
  const label = input.label || method.replaceAll("-", " ");
  return {
    id: input.id || `deployment-${faction || race || "neutral"}-${sequence}`,
    faction,
    method,
    sourceId,
    sourceType: input.sourceType || (method === "ground-deployment" ? "deployment-zone" : "deployment-source"),
    label,
    createdAt: time,
    state: input.state || "deployed"
  };
}

export function validateDeploymentRecord(record) {
  return Boolean(record && record.id && record.faction && DEPLOYMENT_METHODS.includes(record.method) && record.sourceId && record.sourceType && record.label);
}

export function chooseDeploymentMethod({ faction, race, distance = 0, urgency = 0, groundRoute = true, friendlyTerritory = true, specialAvailable = {} } = {}) {
  const defaults = deploymentDefaultsFor({ faction, race });
  const normal = groundRoute ? (distance > 520 ? "map-edge-convoy" : "ground-deployment") : null;
  if (normal && urgency < 0.68 && distance < 720) return { method: normal, reason: "normal travel is sufficient" };
  for (const method of defaults) {
    if (["ground-deployment", "map-edge-convoy"].includes(method)) continue;
    if (specialAvailable[method] === false) continue;
    if (method === "drop-pod" && friendlyTerritory && distance < 420 && urgency < 0.82) continue;
    return { method, reason: !friendlyTerritory ? "reinforcement required outside friendly territory" : "distance or urgency justifies special deployment" };
  }
  return { method: normal || defaults[0] || "ground-deployment", reason: groundRoute ? "special deployment unavailable" : "best available deployment source" };
}

export function advanceDeployment(record, dt) {
  const transitions = {
    requested: ["preparing", 2], preparing: ["in-transit", 4], "in-transit": ["arriving", 3], arriving: ["deployed", 1]
  };
  if (!transitions[record.state]) return record;
  record.stateElapsed = (record.stateElapsed || 0) + dt;
  const [next, duration] = transitions[record.state];
  if (record.stateElapsed >= duration) { record.state = next; record.stateElapsed = 0; }
  return record;
}
