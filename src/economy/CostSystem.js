import { constructionCostFor as factionConstructionCostFor } from "./FactionEconomyProfiles.js";

const normalized = value => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function mergeCosts(...costs) {
  const result = {};
  for (const cost of costs) for (const [resource, amount] of Object.entries(cost || {})) {
    const value = Math.max(0, Number(amount) || 0);
    if (value) result[resource] = (result[resource] || 0) + value;
  }
  return result;
}

export function canAffordCost(inventory = {}, cost = {}) {
  return Object.entries(cost).every(([resource, amount]) => (Number(inventory[resource]) || 0) >= amount);
}

export function spendCost(inventory = {}, cost = {}) {
  if (!canAffordCost(inventory, cost)) return false;
  for (const [resource, amount] of Object.entries(cost)) inventory[resource] = Math.max(0, (Number(inventory[resource]) || 0) - amount);
  return true;
}

function factionKey(player = {}) {
  if (player.faction === "Space Marines") return "space-marines";
  if (player.faction === "Imperial Guard") return "imperial-guard";
  if (["T'au", "Tau"].includes(player.race)) return "tau";
  return normalized(player.race || player.faction || "generic");
}

export function unitCostFor(player, member = {}, catalog = globalThis.AWTData?.costs) {
  const units = catalog?.units || {};
  const exact = units[normalized(member.name)];
  if (exact) return { ...exact };
  const defaults = catalog?.defaults || {};
  const faction = defaults[factionKey(player)] || defaults.generic || {};
  const role = member.role === "vehicle" ? "vehicle" : member.role === "commander" ? "commander" : member.role === "builder" ? "builder" : member.role === "supply" ? "supply" : "infantry";
  return { ...(faction[role] || faction.infantry || { requisition: 7, materials: 3 }) };
}

export function costForManifest(player, manifest = [], catalog = globalThis.AWTData?.costs) {
  return manifest.reduce((total, member) => mergeCosts(total, unitCostFor(player, member, catalog), member.equipmentCost), {});
}

export function actionCost(action, catalog = globalThis.AWTData?.costs) {
  const actionId = typeof action === "string" ? action : action?.id;
  const base = catalog?.actions?.[normalized(actionId)] || action?.baseCost || {};
  const components = typeof action === "object" ? action.components || [] : [];
  return mergeCosts(base, ...components.map(component => component.cost || component));
}

export function calculateCost(action = {}, catalog = globalThis.AWTData?.costs) {
  if (action.type === "formation") return costForManifest(action.player, action.manifest, catalog);
  if (action.type === "construction") return factionConstructionCostFor(action.player, action.baseCost);
  if (action.type === "unit") return mergeCosts(unitCostFor(action.player, action.member, catalog), action.member?.equipmentCost);
  return actionCost(action.id || action.type || action, catalog);
}

export function trainingDelayFor(player, manifest = []) {
  if (player?.faction === "Space Marines") return 24 + manifest.length * 1.8;
  if (player?.race === "Chaos") return 14 + manifest.length * 1.25;
  if (player?.race === "Imperium") return 10 + manifest.length * 0.85;
  return 10 + manifest.length * 0.9;
}
