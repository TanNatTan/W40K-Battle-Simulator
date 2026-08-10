const CELL_SIZE = 240;
const SENSE_RADIUS = 320;
const MAX_NEIGHBORS = 6;

function keyFor(x, y) {
  return `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;
}

function insertNearest(list, unit, distanceSquared) {
  let index = list.length;
  while (index > 0 && list[index - 1].distanceSquared > distanceSquared) index -= 1;
  list.splice(index, 0, { id: unit.id, distanceSquared });
  if (list.length > MAX_NEIGHBORS) list.length = MAX_NEIGHBORS;
}

export function analyzeDistantUnits(units = [], dt = 1) {
  const factions = {};
  const grid = new Map();
  for (const unit of units) {
    if (!unit.alive) continue;
    const summary = factions[unit.faction] ||= { team: unit.team, units: 0, combatPower: 0, expectedAttrition: 0 };
    summary.units += 1;
    summary.combatPower += Math.max(0, unit.damage || 0) * Math.max(0.1, unit.accuracy || 0.5) * Math.max(0.1, unit.morale || 0.5);
    const key = keyFor(unit.x, unit.y);
    const bucket = grid.get(key) || [];
    bucket.push(unit);
    grid.set(key, bucket);
  }

  const entries = Object.entries(factions);
  for (const [, summary] of entries) {
    const hostilePower = entries.filter(([, other]) => other.team !== summary.team).reduce((sum, [, other]) => sum + other.combatPower, 0);
    summary.expectedAttrition = hostilePower * Math.max(0, Number(dt) || 0) * 0.0005;
  }

  const unitHints = [];
  const range = Math.ceil(SENSE_RADIUS / CELL_SIZE);
  const maximumDistanceSquared = SENSE_RADIUS * SENSE_RADIUS;
  for (const unit of units) {
    if (!unit.alive) continue;
    const hostiles = [];
    const allies = [];
    const cellX = Math.floor(unit.x / CELL_SIZE);
    const cellY = Math.floor(unit.y / CELL_SIZE);
    for (let offsetY = -range; offsetY <= range; offsetY += 1) {
      for (let offsetX = -range; offsetX <= range; offsetX += 1) {
        for (const other of grid.get(`${cellX + offsetX},${cellY + offsetY}`) || []) {
          if (other.id === unit.id) continue;
          const dx = other.x - unit.x;
          const dy = other.y - unit.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared > maximumDistanceSquared) continue;
          insertNearest(other.team === unit.team ? allies : hostiles, other, distanceSquared);
        }
      }
    }
    unitHints.push({
      id: unit.id,
      hostileIds: hostiles.map(item => item.id),
      allyIds: allies.map(item => item.id),
      nearestHostileDistance: hostiles.length ? Math.sqrt(hostiles[0].distanceSquared) : Infinity
    });
  }
  return { factions, unitHints, processed: units.length };
}

export default analyzeDistantUnits;
