export const DISTANT_VALUE_STRIDE = 5;
export const DISTANT_HINT_NEIGHBORS = 6;

const CELL_SIZE = 240;
const SENSE_RADIUS = 320;
const MAX_NEIGHBORS = DISTANT_HINT_NEIGHBORS;
const MAX_CELL_COORDINATE = 65536;

const numericCellKey = (x, y) => Math.floor(x / CELL_SIZE) * MAX_CELL_COORDINATE + Math.floor(y / CELL_SIZE);

export function packDistantUnits(units = [], teamFor = unit => unit.team) {
  const alive = units.filter(unit => unit.alive !== false);
  const count = alive.length;
  const ids = new Array(count);
  const factionNames = [];
  const teamNames = [];
  const factionIndex = new Map();
  const teamIndex = new Map();
  const values = new Float32Array(count * DISTANT_VALUE_STRIDE);
  const factions = new Uint16Array(count);
  const teams = new Uint16Array(count);
  for (let index = 0; index < count; index += 1) {
    const unit = alive[index];
    ids[index] = unit.id;
    const faction = String(unit.faction ?? "");
    const team = String(teamFor(unit) ?? "");
    if (!factionIndex.has(faction)) { factionIndex.set(faction, factionNames.length); factionNames.push(faction); }
    if (!teamIndex.has(team)) { teamIndex.set(team, teamNames.length); teamNames.push(team); }
    factions[index] = factionIndex.get(faction);
    teams[index] = teamIndex.get(team);
    const offset = index * DISTANT_VALUE_STRIDE;
    values[offset] = Number(unit.x) || 0;
    values[offset + 1] = Number(unit.y) || 0;
    values[offset + 2] = Math.max(0, Number(unit.damage) || 0);
    values[offset + 3] = Math.max(0.1, Number(unit.accuracy) || 0.5);
    values[offset + 4] = Math.max(0.1, Number(unit.morale) || 0.5);
  }
  return { count, ids, factionNames, teamNames, values, factions, teams };
}

function typedView(value, Type) {
  if (value instanceof Type) return value;
  if (value instanceof ArrayBuffer) return new Type(value);
  return new Type(value || 0);
}

function insertNearest(indices, distances, base, candidateIndex, distanceSquared) {
  let slot = 0;
  while (slot < MAX_NEIGHBORS && distances[base + slot] <= distanceSquared) slot += 1;
  if (slot >= MAX_NEIGHBORS) return;
  for (let move = MAX_NEIGHBORS - 1; move > slot; move -= 1) {
    indices[base + move] = indices[base + move - 1];
    distances[base + move] = distances[base + move - 1];
  }
  indices[base + slot] = candidateIndex;
  distances[base + slot] = distanceSquared;
}

export function analyzeDistantSnapshot(snapshot = {}, dt = 1) {
  const count = Math.max(0, Number(snapshot.count) || 0);
  const values = typedView(snapshot.values ?? snapshot.valuesBuffer, Float32Array);
  const factions = typedView(snapshot.factions ?? snapshot.factionBuffer, Uint16Array);
  const teams = typedView(snapshot.teams ?? snapshot.teamBuffer, Uint16Array);
  const factionNames = snapshot.factionNames || [];
  const teamNames = snapshot.teamNames || [];
  const grid = new Map();
  const summaries = factionNames.map((faction, index) => ({ faction, team: "", teamIndex: -1, units: 0, combatPower: 0, expectedAttrition: 0, index }));
  for (let index = 0; index < count; index += 1) {
    const offset = index * DISTANT_VALUE_STRIDE;
    const factionIndex = factions[index];
    const summary = summaries[factionIndex] ||= { faction: factionNames[factionIndex] || String(factionIndex), team: "", teamIndex: teams[index], units: 0, combatPower: 0, expectedAttrition: 0, index: factionIndex };
    summary.teamIndex = teams[index];
    summary.team = teamNames[teams[index]] ?? String(teams[index]);
    summary.units += 1;
    summary.combatPower += values[offset + 2] * values[offset + 3] * values[offset + 4];
    const key = numericCellKey(values[offset], values[offset + 1]);
    const bucket = grid.get(key);
    if (bucket) bucket.push(index);
    else grid.set(key, [index]);
  }
  const elapsed = Math.max(0, Number(dt) || 0);
  for (const summary of summaries) {
    const hostilePower = summaries.filter(other => other.teamIndex !== summary.teamIndex).reduce((sum, other) => sum + other.combatPower, 0);
    summary.expectedAttrition = hostilePower * elapsed * 0.0005;
  }

  const hostileIndices = new Int32Array(count * MAX_NEIGHBORS);
  const allyIndices = new Int32Array(count * MAX_NEIGHBORS);
  hostileIndices.fill(-1);
  allyIndices.fill(-1);
  const hostileDistances = new Float64Array(count * MAX_NEIGHBORS);
  const allyDistances = new Float64Array(count * MAX_NEIGHBORS);
  hostileDistances.fill(Infinity);
  allyDistances.fill(Infinity);
  const nearestHostileDistance = new Float32Array(count);
  nearestHostileDistance.fill(Infinity);
  const range = Math.ceil(SENSE_RADIUS / CELL_SIZE);
  const maximumDistanceSquared = SENSE_RADIUS * SENSE_RADIUS;
  for (let index = 0; index < count; index += 1) {
    const offset = index * DISTANT_VALUE_STRIDE;
    const x = values[offset];
    const y = values[offset + 1];
    const cellX = Math.floor(x / CELL_SIZE);
    const cellY = Math.floor(y / CELL_SIZE);
    const base = index * MAX_NEIGHBORS;
    for (let offsetY = -range; offsetY <= range; offsetY += 1) {
      for (let offsetX = -range; offsetX <= range; offsetX += 1) {
        const bucket = grid.get((cellX + offsetX) * MAX_CELL_COORDINATE + cellY + offsetY) || [];
        for (const otherIndex of bucket) {
          if (otherIndex === index) continue;
          const otherOffset = otherIndex * DISTANT_VALUE_STRIDE;
          const dx = values[otherOffset] - x;
          const dy = values[otherOffset + 1] - y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > maximumDistanceSquared) continue;
          if (teams[otherIndex] === teams[index]) insertNearest(allyIndices, allyDistances, base, otherIndex, distanceSquared);
          else insertNearest(hostileIndices, hostileDistances, base, otherIndex, distanceSquared);
        }
      }
    }
    if (hostileIndices[base] >= 0) nearestHostileDistance[index] = Math.sqrt(hostileDistances[base]);
  }
  return { count, processed: count, factionSummaries: summaries, hostileIndices, allyIndices, nearestHostileDistance };
}

export function unitHintsFromAnalysis(analysis, ids = []) {
  const result = [];
  for (let index = 0; index < analysis.count; index += 1) {
    const base = index * MAX_NEIGHBORS;
    const hostileIds = [];
    const allyIds = [];
    for (let slot = 0; slot < MAX_NEIGHBORS; slot += 1) {
      const hostile = analysis.hostileIndices[base + slot];
      const ally = analysis.allyIndices[base + slot];
      if (hostile >= 0) hostileIds.push(ids[hostile]);
      if (ally >= 0) allyIds.push(ids[ally]);
    }
    result.push({ id: ids[index], hostileIds, allyIds, nearestHostileDistance: analysis.nearestHostileDistance[index] });
  }
  return result;
}

export function analyzeDistantUnits(units = [], dt = 1) {
  const packed = packDistantUnits(units);
  const analysis = analyzeDistantSnapshot(packed, dt);
  return {
    factions: Object.fromEntries(analysis.factionSummaries.map(summary => [summary.faction, { team: summary.team, units: summary.units, combatPower: summary.combatPower, expectedAttrition: summary.expectedAttrition }])),
    unitHints: unitHintsFromAnalysis(analysis, packed.ids),
    processed: analysis.processed
  };
}

export default analyzeDistantUnits;
