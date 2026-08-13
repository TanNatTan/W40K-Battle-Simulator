import { vehicleCompositionFor } from "./ArmyCompositionSystem.js";

const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
const condition = entity => clamp(Number(entity?.hp) / Math.max(1, Number(entity?.maxHp) || 1));

function roleCount(units, role) {
  return units.filter(unit => unit?.alive !== false && !unit?.incapacitated && unit.role === role).length;
}

export function analyzeProductionDemand({
  player = {}, ownUnits = [], enemyUnits = [], structures = [], economy = {}, objectiveSignals = {}, forceState = {}, casualties = 0
} = {}) {
  const ownCombat = ownUnits.filter(unit => unit?.alive !== false && !unit?.incapacitated && !["builder", "supply"].includes(unit.role));
  const enemies = enemyUnits.filter(unit => unit?.alive !== false && !unit?.incapacitated);
  const enemyVehicles = roleCount(enemies, "vehicle");
  const ownVehicles = roleCount(ownCombat, "vehicle");
  const ownScouts = roleCount(ownCombat, "scout");
  const ownMedics = roleCount(ownCombat, "medic");
  const ownEngineers = roleCount(ownCombat, "engineer");
  const enemyArmorPressure = clamp((enemyVehicles + enemies.filter(unit => Number(unit.armorProtection) >= 14).length * 0.5) / Math.max(2, enemies.length * 0.3));
  const enemyHordePressure = clamp(enemies.length / Math.max(8, ownCombat.length * 1.3));
  const casualtyPressure = clamp(Number(casualties) / Math.max(4, ownCombat.length + Number(casualties)));
  const damagedVehicles = ownCombat.filter(unit => unit.role === "vehicle" && condition(unit) < 0.72).length;
  const damagedBuildings = structures.filter(item => item?.alive !== false && Number(item.progress) >= 1 && condition(item) < 0.82).length;
  const shortagePressure = clamp((economy.shortages?.length || 0) / 4);
  const rawCommitment = Number(forceState.commitment);
  const commitment = forceState.allIn ? 1 : Number.isFinite(rawCommitment)
    ? clamp(rawCommitment) : clamp(Number(forceState.level || 0) / 4);
  const vehicleComposition = vehicleCompositionFor(player, ownCombat);
  const vehicleDeficit = vehicleComposition.vehicleDeficit;
  const infantryDeficit = clamp(0.62 - roleCount(ownCombat, "trooper") / Math.max(1, ownCombat.length));
  const mobilityDeficit = clamp((ownCombat.length / 6 - ownVehicles) / Math.max(1, ownCombat.length / 6));
  const reconDeficit = clamp((ownCombat.length / 10 - ownScouts) / Math.max(1, ownCombat.length / 10));
  const supportDeficit = clamp((ownCombat.length / 12 - ownMedics - ownEngineers) / Math.max(1, ownCombat.length / 12));
  const threat = clamp(Number(player.factionAIContext?.enemyPressure) || enemies.filter(enemy => {
    const dx = Number(enemy.x) - Number(player.base?.x);
    const dy = Number(enemy.y) - Number(player.base?.y);
    return dx * dx + dy * dy < 320 * 320;
  }).length / 7);

  const tokenScores = {
    battleline: 34 + infantryDeficit * 70 + threat * 20,
    "line-infantry": 34 + infantryDeficit * 70,
    "mobile-battleline": 30 + infantryDeficit * 45 + mobilityDeficit * 45,
    assault: 24 + commitment * 36 + (objectiveSignals.attack || 0) * 42,
    "assault-infantry": 26 + commitment * 38,
    "fast-melee": 24 + mobilityDeficit * 30 + commitment * 35,
    berserker: 28 + commitment * 48,
    ranged: 28 + enemyHordePressure * 28,
    "ranged-support": 30 + enemyHordePressure * 38,
    "precision-ranged": 28 + (objectiveSignals.scouting || 0) * 35,
    "heavy-weapons": 32 + enemyArmorPressure * 55,
    "anti-armour": 36 + enemyArmorPressure * 75,
    scout: 20 + reconDeficit * 70 + (objectiveSignals.scouting || 0) * 45,
    stealth: 22 + reconDeficit * 55,
    infiltrator: 22 + reconDeficit * 55 + (objectiveSignals.attack || 0) * 20,
    support: 20 + supportDeficit * 62 + casualtyPressure * 35,
    engineer: 22 + supportDeficit * 45 + clamp((damagedVehicles + damagedBuildings) / 4) * 65,
    command: 18 + clamp(1 - roleCount(ownCombat, "commander") / 2) * 52,
    elite: 18 + commitment * 42,
    "elite-infantry": 18 + commitment * 42,
    "elite-melee": 20 + commitment * 48,
    transport: 28 + mobilityDeficit * 68,
    "light-transport": 28 + mobilityDeficit * 65,
    "airmobile-transport": 25 + mobilityDeficit * 70,
    walker: 24 + enemyArmorPressure * 35 + clamp(damagedVehicles / 3) * -20,
    "light-walker": 24 + reconDeficit * 30,
    tank: 25 + enemyArmorPressure * 45 + commitment * 25,
    "heavy-tank": 18 + enemyArmorPressure * 55 + commitment * 35,
    artillery: 22 + (objectiveSignals.fortification || 0) * 55,
    "anti-air": 18 + enemies.filter(unit => unit.aircraftState).length * 14,
    "fast-vehicle": 24 + mobilityDeficit * 60,
    "fast-attack": 24 + mobilityDeficit * 60,
    "fast-skimmer": 24 + mobilityDeficit * 60,
    heavy: 18 + enemyArmorPressure * 45 + commitment * 30,
    "heavy-command": 14 + commitment * 45,
    "repair-support": 24 + clamp((damagedVehicles + damagedBuildings) / 4) * 72
  };
  tokenScores.vehicle = 42 + vehicleDeficit * 105 + commitment * 24;
  tokenScores.transport += vehicleDeficit * 36;
  tokenScores["light-transport"] += vehicleDeficit * 32;
  tokenScores.walker += vehicleDeficit * 42;
  tokenScores.tank += vehicleDeficit * 58;
  tokenScores["heavy-tank"] += vehicleDeficit * 44;
  tokenScores.artillery += vehicleDeficit * 30;

  const constructionNeeds = {
    Power: shortagePressure * 30 + (economy.shortages || []).includes("energy") * 80,
    Logistics: shortagePressure * 70 + (objectiveSignals.logistics || 0) * 50,
    Muster: infantryDeficit * 85 + (objectiveSignals.attack || 0) * 30,
    Industry: enemyArmorPressure * 35 + shortagePressure * 45,
    Doctrine: enemyArmorPressure * 55 + (objectiveSignals.scouting || 0) * 20,
    "War Forge": mobilityDeficit * 45 + vehicleDeficit * 95 + enemyArmorPressure * 70 + damagedVehicles * 10,
    Sustainment: casualtyPressure * 85 + damagedBuildings * 12,
    Intel: reconDeficit * 75 + (objectiveSignals.scouting || 0) * 55,
    Deployment: mobilityDeficit * 72 + commitment * 35,
    Fortification: threat * 80 + (objectiveSignals.fortification || objectiveSignals.defense || 0) * 55,
    Emplacement: threat * 85 + enemyArmorPressure * 35,
    Signature: commitment * 60 + (forceState.allIn ? 45 : 0)
  };

  return Object.freeze({
    tokenScores: Object.freeze(tokenScores),
    constructionNeeds: Object.freeze(constructionNeeds),
    signals: Object.freeze({ enemyArmorPressure, enemyHordePressure, casualtyPressure, shortagePressure, commitment,
      infantryDeficit, mobilityDeficit, vehicleDeficit, vehicleRatio: vehicleComposition.vehicleRatio,
      desiredVehicleRatio: vehicleComposition.desiredVehicleRatio, expectedVehicles: vehicleComposition.expectedVehicles,
      reconDeficit, supportDeficit, threat, damagedVehicles, damagedBuildings })
  });
}
