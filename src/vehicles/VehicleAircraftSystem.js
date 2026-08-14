const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

const VEHICLE_PROFILES = Object.freeze([
  { test: /supply|cargo|ammo|fuel vehicle/i, type: "supply", passengerCapacity: 2, fuel: 110, turnRate: 0.9, baseSpeed: 30 },
  { test: /storm speeder/i, type: "recon", passengerCapacity: 0, fuel: 88, turnRate: 1.55, baseSpeed: 46 },
  { test: /invader atv/i, type: "recon", passengerCapacity: 0, fuel: 82, turnRate: 1.6, baseSpeed: 44 },
  { test: /impulsor/i, type: "transport", passengerCapacity: 6, fuel: 100, turnRate: 1.42, baseSpeed: 40 },
  { test: /trukk/i, type: "transport", passengerCapacity: 12, fuel: 100, turnRate: 1.45, baseSpeed: 38 },
  { test: /rhino|razorback|loot trukk/i, type: "transport", passengerCapacity: 10, fuel: 100, turnRate: 1.3, baseSpeed: 34 },
  { test: /repulsor/i, type: "transport", passengerCapacity: 10, fuel: 112, turnRate: 1.08, baseSpeed: 32 },
  { test: /predator|gladiator/i, type: "tank", passengerCapacity: 0, fuel: 100, turnRate: 1.02, baseSpeed: 32 },
  { test: /vindicator|whirlwind|basilisk|artillery|mortar|exocrine|doomsday/i, type: "artillery", passengerCapacity: 0, fuel: 90, turnRate: 0.72, baseSpeed: 27 },
  { test: /land raider|battlewagon|command|monolith/i, type: "command", passengerCapacity: 8, fuel: 120, turnRate: 0.66, baseSpeed: 26 },
  { test: /ballistus|killa kan/i, type: "walker", passengerCapacity: 0, fuel: 80, turnRate: 1.35, baseSpeed: 22 },
  { test: /redemptor|deff dread/i, type: "walker", passengerCapacity: 0, fuel: 88, turnRate: 1.32, baseSpeed: 24 },
  { test: /sentinel|dreadnought|walker|defiler|carnifex|trygon/i, type: "walker", passengerCapacity: 0, fuel: 80, turnRate: 1.5, baseSpeed: 24 },
  { test: /hunter|stalker|hydra|skyray|anti.?air/i, type: "anti-air", passengerCapacity: 0, fuel: 90, turnRate: 1.05, baseSpeed: 31 },
  { test: /techmarine|mek|repair vehicle|recovery/i, type: "repair", passengerCapacity: 2, fuel: 75, turnRate: 1.1, baseSpeed: 30 },
  { test: /chimera|devilfish|ghost ark|transport|apc/i, type: "transport", passengerCapacity: 10, fuel: 100, turnRate: 1.3, baseSpeed: 34 },
  { test: /.*/, type: "tank", passengerCapacity: 0, fuel: 100, turnRate: 0.82, baseSpeed: 30 }
]);

export function vehicleProfileFor(unit) {
  const identity = `${unit.name || ""} ${unit.type || ""} ${unit.specialty || ""}`;
  return { ...VEHICLE_PROFILES.find(profile => profile.test.test(identity)) };
}

export function createVehicleState(unit = {}) {
  const profile = vehicleProfileFor(unit);
  return {
    id: unit.id || null,
    type: profile.type,
    systems: { hull: 1, engine: 1, tracks: 1, turret: 1, weapons: 1, ammo: 1, fuel: 1, crew: 1 },
    fuel: profile.fuel,
    maxFuel: profile.fuel,
    ammunition: unit.maxAmmo ?? unit.ammo ?? 18,
    maxAmmunition: unit.maxAmmo ?? unit.ammo ?? 18,
    passengerCapacity: profile.passengerCapacity,
    passengerIds: [],
    crew: profile.type === "walker" ? 1 : 3,
    maxCrew: profile.type === "walker" ? 1 : 3,
    baseSpeed: profile.baseSpeed,
    currentSpeed: 0,
    turnRate: profile.turnRate,
    state: "idle"
  };
}

export function vehiclePerformance(state, legacySystems = {}) {
  const systems = { ...state.systems };
  for (const key of Object.keys(systems)) if (legacySystems[key] != null) systems[key] = Math.min(systems[key], legacySystems[key]);
  if (legacySystems.mainGun != null) systems.weapons = Math.min(systems.weapons, legacySystems.mainGun);
  if (legacySystems.ammoStorage != null) systems.ammo = Math.min(systems.ammo, legacySystems.ammoStorage);
  const crewFactor = clamp01((state.crew || 0) / Math.max(1, state.maxCrew || 1));
  const speedFactor = state.fuel <= 0 ? 0.08 : clamp01((systems.engine * 0.55 + systems.tracks * 0.45) * (0.45 + crewFactor * 0.55));
  return {
    speedFactor,
    turnFactor: clamp01((systems.engine * 0.35 + systems.tracks * 0.65) * (0.4 + crewFactor * 0.6)),
    weaponFactor: clamp01(systems.turret * 0.35 + systems.weapons * 0.45 + systems.ammo * 0.2) * crewFactor,
    operational: systems.hull > 0.05 && crewFactor > 0,
    immobilized: speedFactor < 0.18
  };
}

export function updateVehicleState(state, dt, { moving = false, firing = false, legacySystems = {} } = {}) {
  const performance = vehiclePerformance(state, legacySystems);
  const fuelBurn = moving && performance.operational ? dt * (0.22 + state.currentSpeed * 0.008) : dt * 0.015;
  state.fuel = Math.max(0, state.fuel - fuelBurn);
  if (firing && state.ammunition > 0 && performance.weaponFactor > 0.12) state.ammunition = Math.max(0, state.ammunition - dt * 0.5);
  const desiredSpeed = moving && performance.operational ? state.baseSpeed * performance.speedFactor : 0;
  state.currentSpeed += (desiredSpeed - state.currentSpeed) * Math.min(1, dt * (desiredSpeed > state.currentSpeed ? 1.6 : 2.4));
  state.state = !performance.operational ? "destroyed" : performance.immobilized ? "immobilized" : state.fuel <= 0 ? "out-of-fuel" : moving ? "moving" : firing ? "firing" : "idle";
  return { ...performance, state: state.state, fuelRatio: state.fuel / Math.max(1, state.maxFuel), ammoRatio: state.ammunition / Math.max(1, state.maxAmmunition) };
}

export function boardTransport(vehicleState, passenger) {
  if (!passenger?.id || vehicleState.state === "destroyed" || vehicleState.phase === "crashed" || vehicleState.passengerIds.includes(passenger.id)) return false;
  if (vehicleState.passengerIds.length >= vehicleState.passengerCapacity) return false;
  vehicleState.passengerIds.push(passenger.id);
  passenger.embarkedInId = vehicleState.id || true;
  return true;
}

export function reserveTransportForSquad(vehicleState, squadId, memberIds = [], now = 0) {
  if (!vehicleState || vehicleState.state === "destroyed" || vehicleState.phase === "crashed" || vehicleState.passengerCapacity <= 0 || !squadId) return false;
  if (vehicleState.transportReservation?.squadId && vehicleState.transportReservation.squadId !== squadId) return false;
  vehicleState.transportReservation = {
    squadId,
    memberIds: [...new Set(memberIds)].slice(0, vehicleState.passengerCapacity),
    createdAt: vehicleState.transportReservation?.createdAt ?? now,
    expiresAt: now + 18
  };
  return true;
}

export function transportReadyToDeploy(vehicleState, now = 0, { minimumLoadRatio = 0.6, maximumWait = 8 } = {}) {
  const reservation = vehicleState?.transportReservation;
  if (!reservation) return vehicleState?.passengerIds?.length > 0;
  const desired = Math.max(1, Math.min(vehicleState.passengerCapacity, reservation.memberIds.length));
  const loaded = vehicleState.passengerIds.length;
  return loaded >= desired || loaded / desired >= minimumLoadRatio || (loaded > 0 && now - reservation.createdAt >= maximumWait);
}

export function clearTransportReservation(vehicleState) {
  if (vehicleState) vehicleState.transportReservation = null;
}

export function disembarkTransport(vehicleState, passengers, position = { x: 0, y: 0 }) {
  const ids = new Set(vehicleState.passengerIds);
  const deployed = passengers.filter(passenger => ids.has(passenger.id));
  deployed.forEach((passenger, index) => {
    passenger.embarkedInId = null;
    passenger.x = position.x + Math.cos(index * 2.4) * (12 + index * 2);
    passenger.y = position.y + Math.sin(index * 2.4) * (12 + index * 2);
  });
  vehicleState.passengerIds = [];
  vehicleState.transportReservation = null;
  return deployed;
}

export function createAircraftState({ id, type = "transport", passengerCapacity = 10, sourceId = null } = {}) {
  return { id, type, sourceId, phase: "landed", altitude: 0, speed: 0, fuel: 100, integrity: 1, passengerCapacity, passengerIds: [], mission: null, antiAirThreat: 0 };
}

export function assignAircraftMission(state, mission) {
  if (!mission?.destination || state.phase === "crashed") return false;
  state.mission = { kind: "transport", action: "deploy", ...mission };
  state.phase = state.altitude > 0 ? "flying" : "taking-off";
  return true;
}

export function updateAircraftState(state, dt, { antiAirThreat = 0 } = {}) {
  if (state.phase === "crashed") return state;
  state.antiAirThreat = Math.max(0, antiAirThreat);
  if (state.integrity <= 0) { state.phase = "crashed"; state.altitude = Math.max(0, state.altitude - dt * 40); return state; }
  if (state.phase === "taking-off") {
    state.altitude = Math.min(120, state.altitude + dt * 45);
    state.speed = Math.min(60, state.speed + dt * 24);
    if (state.altitude >= 80) state.phase = "flying";
  } else if (state.phase === "flying") {
    state.altitude = Math.min(150, state.altitude + dt * 12);
    state.speed = Math.min(90, state.speed + dt * 14);
    state.fuel = Math.max(0, state.fuel - dt * 0.32);
    if (state.mission?.arrived) state.phase = state.mission.action === "attack" ? "attacking" : "landing";
  } else if (state.phase === "attacking") {
    state.speed = Math.max(45, state.speed - dt * 10);
    state.fuel = Math.max(0, state.fuel - dt * 0.55);
    if (state.mission?.complete) state.phase = "flying";
  } else if (state.phase === "landing") {
    state.altitude = Math.max(0, state.altitude - dt * 38);
    state.speed = Math.max(0, state.speed - dt * 28);
    if (state.altitude <= 0) state.phase = "landed";
  } else if (state.phase === "hovering") {
    state.speed = 0;
    state.fuel = Math.max(0, state.fuel - dt * 0.24);
  }
  if (state.antiAirThreat > 0) state.integrity = Math.max(0, state.integrity - dt * state.antiAirThreat * 0.012);
  if (state.fuel <= 0 && state.altitude > 0) state.phase = "landing";
  return state;
}
