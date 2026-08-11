const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function hashSeed(value = "regroup") {
  return [...String(value)].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
}

function randomSequence(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

export function pointInPolygon(point = {}, polygon = []) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[index];
    const b = polygon[previous];
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / ((b.y - a.y) || 0.000001) + a.x) inside = !inside;
  }
  return inside;
}

export function regroupCandidates(player = {}, squad = {}, count = 24) {
  const zone = player.spawnZone || { shape: "circle", size: 84, points: [] };
  const center = player.base || { x: 0, y: 0 };
  const random = randomSequence(hashSeed(`${squad.id || "squad"}:${squad.regroupSerial || 0}`));
  const candidates = [];
  if (zone.shape === "custom" && (zone.points || []).length >= 3) {
    const xs = zone.points.map(point => point.x);
    const ys = zone.points.map(point => point.y);
    const bounds = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
    for (let attempt = 0; attempt < count * 8 && candidates.length < count; attempt += 1) {
      const point = { x: bounds.left + random() * (bounds.right - bounds.left), y: bounds.top + random() * (bounds.bottom - bounds.top) };
      if (pointInPolygon(point, zone.points)) candidates.push(point);
    }
  } else if (zone.shape === "square") {
    const size = Math.max(24, Number(zone.size) || 84);
    for (let index = 0; index < count; index += 1) {
      candidates.push({ x: center.x + (random() * 1.5 - 0.75) * size, y: center.y + (random() * 1.5 - 0.75) * size });
    }
  } else {
    const size = Math.max(24, Number(zone.size) || 84);
    for (let index = 0; index < count; index += 1) {
      const angle = random() * Math.PI * 2;
      const radius = size * (0.3 + random() * 0.45);
      candidates.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
    }
  }
  return candidates;
}

export function chooseRegroupPoint(player = {}, squad = {}, { score = () => 0, valid = () => true, bounds = null, fallback = player.base || { x: 0, y: 0 } } = {}) {
  const candidates = regroupCandidates(player, squad)
    .map(point => bounds ? { x: clamp(point.x, bounds.left, bounds.right), y: clamp(point.y, bounds.top, bounds.bottom) } : point)
    .filter(valid)
    .map(point => ({ point, score: Number(score(point)) || 0 }))
    .sort((a, b) => b.score - a.score);
  const selected = candidates[0]?.point || fallback;
  return Object.freeze({ x: selected.x, y: selected.y, regroup: true });
}
