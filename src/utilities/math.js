export function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

// Math.hypot is several times slower than sqrt of the sum of squares in V8, and
// distance() sits in the innermost loops of targeting, awareness and separation.
export function hypot2(x, y) {
  return Math.sqrt(x * x + y * y);
}

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
