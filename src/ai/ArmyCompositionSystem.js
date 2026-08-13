import compositionData from "../../data/ai/army-compositions.json" with { type: "json" };
import { builderWorkforceBranchFor } from "../construction/BuilderWorkforceSystem.js";

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export const ARMY_COMPOSITION_PROFILES = Object.freeze(Object.fromEntries(Object.entries(compositionData.profiles)
  .map(([id, profile]) => [id, Object.freeze({ ...profile })])));

export function armyCompositionProfileFor(player = {}) {
  return ARMY_COMPOSITION_PROFILES[builderWorkforceBranchFor(player)] || ARMY_COMPOSITION_PROFILES.space_marines;
}

export function vehicleCompositionFor(player = {}, units = []) {
  const profile = armyCompositionProfileFor(player);
  const combat = units.filter(unit => unit?.alive !== false && !unit?.incapacitated && !["builder", "supply"].includes(unit.role));
  const vehicles = combat.filter(unit => unit.role === "vehicle");
  const desiredVehicleRatio = clamp01(profile.desiredVehicleRatio);
  const vehicleRatio = vehicles.length / Math.max(1, combat.length);
  const expectedVehicles = Math.max(combat.length >= 5 ? 1 : 0, Math.ceil(combat.length * desiredVehicleRatio));
  const vehicleDeficit = clamp01((desiredVehicleRatio - vehicleRatio) / Math.max(0.01, desiredVehicleRatio));
  return Object.freeze({ profile, combatants: combat.length, vehicles: vehicles.length, expectedVehicles, vehicleRatio, desiredVehicleRatio,
    missingVehicles: Math.max(0, expectedVehicles - vehicles.length), vehicleDeficit });
}
