import test from "node:test";
import assert from "node:assert/strict";
import {
  FORMATION_TYPES,
  assignCombinedArmsSupport,
  buildCombinedArmsGroups,
  formationLocalPosition,
  selectFormation
} from "../src/formations/FormationSystem.js";
import {
  assignAircraftMission,
  boardTransport,
  createAircraftState,
  createVehicleState,
  disembarkTransport,
  updateAircraftState,
  updateVehicleState,
  vehiclePerformance
} from "../src/vehicles/VehicleAircraftSystem.js";
import {
  DEPLOYMENT_METHODS,
  chooseDeploymentMethod,
  createDeploymentRecord,
  deploymentDefaultsFor,
  validateDeploymentRecord
} from "../src/deployment/DeploymentSystem.js";

const infantry = (id, x = 0, y = 0) => ({ id, name: "Tactical Marine", role: "trooper", weapon: "Bolter", hp: 100, maxHp: 100, alive: true, x, y });

test("Phase 14 selects road columns, open firing lines, and defensive rings", () => {
  assert.ok(FORMATION_TYPES.includes("defensive-ring"));
  const members = Array.from({ length: 8 }, (_, index) => infantry(`i${index}`));
  const road = selectFormation({ current: "wedge", elapsed: 10, members, terrain: { type: "road", cover: 0 }, nearbyRoad: true, objective: { type: "Patrol Route", moving: true } });
  assert.equal(road.formation, "column");
  const open = selectFormation({ current: "circle", elapsed: 10, members, terrain: { type: "grass", cover: 0.02 }, threat: { enemyCount: 2 }, objective: { type: "Hold Route", moving: false } });
  assert.equal(open.formation, "line");
  const surrounded = selectFormation({ current: "line", elapsed: 10, members, terrain: { type: "grass", cover: 0.1 }, threat: { enemyCount: 8, directions: 4, surrounded: true }, objective: { type: "Hold Route", moving: false } });
  assert.equal(surrounded.formation, "defensive-ring");
  assert.notDeepEqual(formationLocalPosition("wedge", 2, 8, members[2]), formationLocalPosition("column", 2, 8, members[2]));
});

test("Phase 14 forms combined-arms groups with mutual vehicle and infantry support", () => {
  const units = [
    infantry("inf", 0, 0),
    { id: "tank", name: "Predator Tank", role: "vehicle", alive: true, x: 20, y: 0 },
    { id: "med", name: "Apothecary", role: "medic", alive: true, x: 4, y: 0 },
    { id: "aa", name: "Hunter Anti-Air", role: "vehicle", alive: true, x: 30, y: 0 }
  ];
  const groups = buildCombinedArmsGroups(units);
  assert.equal(groups.infantry.length, 1);
  assert.equal(groups.vehicles.length, 1);
  assert.equal(groups["anti-air"].length, 1);
  const support = assignCombinedArmsSupport(units).assignments;
  assert.equal(support.get("tank").targetId, "inf");
  assert.equal(support.get("inf").targetId, "tank");
});

test("Phase 15 vehicles have subsystems, fuel, ammunition, crews, and transport capacity", () => {
  const unit = { id: "rhino", name: "Rhino Transport", maxAmmo: 20 };
  const state = createVehicleState(unit);
  assert.equal(state.type, "transport");
  assert.equal(state.passengerCapacity, 10);
  assert.deepEqual(Object.keys(state.systems), ["hull", "engine", "tracks", "turret", "weapons", "ammo", "fuel", "crew"]);
  const passenger = infantry("passenger");
  assert.equal(boardTransport(state, passenger), true);
  assert.equal(passenger.embarkedInId, "rhino");
  assert.deepEqual(disembarkTransport(state, [passenger], { x: 50, y: 60 }).map(item => item.id), ["passenger"]);
  state.systems.engine = 0.1;
  state.systems.tracks = 0.1;
  assert.equal(vehiclePerformance(state).immobilized, true);
  const fuelBefore = state.fuel;
  updateVehicleState(state, 2, { moving: true });
  assert.ok(state.fuel < fuelBefore);
});

test("Phase 15 aircraft take off, fly, react to anti-air, land, and carry troops", () => {
  const aircraft = createAircraftState({ id: "thunderhawk", type: "transport", passengerCapacity: 4, sourceId: "airfield-1" });
  const passenger = infantry("marine");
  assert.equal(boardTransport(aircraft, passenger), true);
  assert.equal(assignAircraftMission(aircraft, { action: "deploy", destination: { x: 500, y: 500 } }), true);
  for (let index = 0; index < 5; index += 1) updateAircraftState(aircraft, 1, { antiAirThreat: 1 });
  assert.equal(aircraft.phase, "flying");
  assert.ok(aircraft.altitude > 0);
  assert.ok(aircraft.integrity < 1);
  aircraft.mission.arrived = true;
  updateAircraftState(aircraft, 1);
  assert.equal(aircraft.phase, "landing");
  for (let index = 0; index < 5; index += 1) updateAircraftState(aircraft, 1);
  assert.equal(aircraft.phase, "landed");
  assert.equal(disembarkTransport(aircraft, [passenger], { x: 500, y: 500 }).length, 1);
});

test("Phase 16 gives every faction sourced deployment and prefers normal travel when sufficient", () => {
  for (const faction of ["Space Marines", "Imperial Guard", "Chaos", "Orks", "Necrons", "T'au", "Tyranids"]) {
    assert.ok(DEPLOYMENT_METHODS.includes(deploymentDefaultsFor({ faction })[0]));
    const record = createDeploymentRecord({ faction, race: faction, source: { sourceId: `${faction}-source`, sourceType: "structure", label: "Faction arrival" }, sequence: 1 });
    assert.equal(validateDeploymentRecord(record), true);
  }
  const normal = chooseDeploymentMethod({ faction: "Space Marines", distance: 300, urgency: 0.3, groundRoute: true, friendlyTerritory: true });
  assert.equal(normal.method, "ground-deployment");
  const emergency = chooseDeploymentMethod({ faction: "Space Marines", distance: 900, urgency: 0.9, groundRoute: false, friendlyTerritory: false, specialAvailable: { "drop-pod": true } });
  assert.equal(emergency.method, "drop-pod");
});
