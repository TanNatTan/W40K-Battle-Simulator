import { economyProfileFor } from "../economy/FactionEconomyProfiles.js";

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const CONSUMPTION_PRESSURE = Object.freeze({
  "Space Marines": 0.72,
  "Imperial Guard": 1.05,
  Orks: 1.08,
  Tyranids: 1.12,
  Necrons: 0.68,
  "T'au": 0.82,
  Chaos: 0.94
});

function profileLabel(player = {}) {
  if (player.faction === "Space Marines" || player.faction === "Imperial Guard") return player.faction;
  if (player.race === "T'au") return "T'au";
  return player.race || player.faction;
}

export function simulateEconomyEndurance(player, options = {}) {
  const durationMinutes = Number(options.durationMinutes) || 60;
  const seconds = Math.round(durationMinutes * 60);
  const profile = economyProfileFor(player);
  const label = profileLabel(player);
  const pressure = CONSUMPTION_PRESSURE[label] || 0.9;
  const inventory = { ...profile.startingStockpile };
  const capacity = { ...profile.baseCapacity };
  const zeroSeconds = Object.fromEntries(profile.activeResources.map(resource => [resource, 0]));
  const productionByPhase = [0, 0, 0, 0];
  let deliveries = 0;
  let zoneCaptures = 0;
  let strandedResources = 0;
  let recoveryAssetOperational = true;
  let recoveryStartedAt = null;
  let recoveryCompletedAt = null;
  let productionOutput = 0;

  for (let second = 0; second < seconds; second += 1) {
    const minute = second / 60;
    const phase = Math.min(3, Math.floor(minute / Math.max(1, durationMinutes / 4)));
    if (second === 12 * 60 || second === 27 * 60 || second === 43 * 60) zoneCaptures += 1;
    if (second === 30 * 60) recoveryAssetOperational = false;

    for (const resource of profile.activeResources) {
      const priority = profile.resourcePriorities[resource] || 1;
      const isZoneResource = profile.producibleResources.includes(resource);
      const sourceRatePerMinute = (isZoneResource ? 12 : 8.5) * priority * (recoveryAssetOperational ? 1 : 0.58);
      const upkeepPerMinute = (isZoneResource ? 5.2 : 3.8) * pressure * (1 + phase * 0.13);
      inventory[resource] = Math.max(0, (inventory[resource] || 0) + (sourceRatePerMinute - upkeepPerMinute) / 60);
      if (inventory[resource] <= 0.001) zeroSeconds[resource] += 1;
      if (inventory[resource] > capacity[resource]) {
        strandedResources += inventory[resource] - capacity[resource];
        inventory[resource] = capacity[resource];
      }
    }

    if (second > 0 && second % 75 === 0) deliveries += 1;
    if (!recoveryAssetOperational && recoveryStartedAt == null) {
      const recoveryResource = profile.activeResources.find(resource => (inventory[resource] || 0) >= 40);
      if (recoveryResource) {
        inventory[recoveryResource] -= 40;
        recoveryStartedAt = second;
      }
    }
    if (!recoveryAssetOperational && recoveryStartedAt != null && second - recoveryStartedAt >= 150) {
      recoveryAssetOperational = true;
      recoveryCompletedAt = second;
    }

    if (second > 0 && second % 180 === 0) {
      const spendable = profile.activeResources.filter(resource => (inventory[resource] || 0) >= 12);
      if (spendable.length >= Math.max(1, Math.floor(profile.activeResources.length * 0.45))) {
        for (const resource of spendable.slice(0, 3)) inventory[resource] -= 12;
        const output = Math.round(2 + phase * 1.25 + (recoveryAssetOperational ? 1 : 0));
        productionOutput += output;
        productionByPhase[phase] += output;
      }
    }
  }

  const longestZeroSeconds = Math.max(0, ...Object.values(zeroSeconds));
  const result = {
    faction: label,
    durationMinutes,
    finalInventory: Object.fromEntries(Object.entries(inventory).map(([key, value]) => [key, Math.round(value * 10) / 10])),
    zeroSeconds,
    longestZeroSeconds,
    productionByPhase,
    productionOutput,
    deliveries,
    zoneCaptures,
    recoveryStartedAt,
    recoveryCompletedAt,
    recoveryAssetOperational,
    strandedResources: Math.round(strandedResources * 10) / 10
  };
  result.pass = longestZeroSeconds <= 30
    && productionByPhase.every(value => value > 0)
    && productionByPhase[3] >= productionByPhase[0] * 0.75
    && recoveryAssetOperational && recoveryCompletedAt != null
    && zoneCaptures >= 2 && deliveries >= 20
    && Object.values(result.finalInventory).every(value => Number.isFinite(value) && value >= 0);
  result.deadlock = !result.pass && (longestZeroSeconds > 30 || productionByPhase.some(value => value === 0));
  result.capacityUtilization = Object.fromEntries(profile.activeResources.map(resource => [resource, clamp((inventory[resource] || 0) / Math.max(1, capacity[resource] || 1), 0, 1)]));
  return Object.freeze(result);
}

export function runAllFactionEconomyEndurance(options = {}) {
  const players = [
    { race: "Imperium", faction: "Space Marines" },
    { race: "Imperium", faction: "Imperial Guard" },
    { race: "Orks", faction: "Orks" },
    { race: "Tyranids", faction: "Hive Fleet" },
    { race: "Necrons", faction: "Dynastic Host" },
    { race: "T'au", faction: "Frontier Cadre" },
    { race: "Chaos", faction: "Chaos Space Marines" }
  ];
  return Object.freeze(players.map(player => simulateEconomyEndurance(player, options)));
}
