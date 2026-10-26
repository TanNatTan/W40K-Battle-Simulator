// Unit markers as plain geometric shapes. One shape per role so a player can read the battlefield
// at a glance: the shape says what a unit does, the fill and outline say whose it is, and the
// pointer end (muzzle tick, barrel, dart tip) says which way it faces.
//
// Geometry is traced into any path-like object (CanvasRenderingContext2D or Path2D), so the same
// code serves the detailed renderer and the batched renderer used for very large armies.

export const GLYPH_KINDS = Object.freeze({
  trooper: "circle",
  capture: "circle",
  scout: "dart",
  commander: "hex",
  standard: "square",
  headquarters: "square",
  medic: "cross",
  engineer: "diamond",
  builder: "diamond",
  supply: "crate",
  vehicle: "tank",
  aircraft: "wing"
});

/** Name and one-line meaning of each shape, for legends and tooltips. */
export const GLYPH_LEGEND = Object.freeze([
  { kind: "circle", label: "Line infantry" },
  { kind: "dart", label: "Scout" },
  { kind: "hex", label: "Squad leader" },
  { kind: "square", label: "Standard bearer" },
  { kind: "cross", label: "Medic" },
  { kind: "diamond", label: "Engineer / builder" },
  { kind: "crate", label: "Supply carrier" },
  { kind: "tank", label: "Vehicle" },
  { kind: "wing", label: "Aircraft" }
]);

// Half-size of each shape (world units at scale 1), used for picking and for minimum screen size.
// Everything below is drawn at SIZE x these sizes so a marker is easy to see and to click.
const SIZE = 1.3;
const RADIUS = { circle: 5, dart: 7, hex: 6.5, square: 5, cross: 6, diamond: 6, crate: 7, tank: 10, wing: 9 };

const POLYGONS = {
  dart: [[7, 0], [-5, 4.5], [-2.5, 0], [-5, -4.5]],
  hex: [[6.5, 0], [3.25, 5.63], [-3.25, 5.63], [-6.5, 0], [-3.25, -5.63], [3.25, -5.63]],
  square: [[4.8, -4.8], [4.8, 4.8], [-4.8, 4.8], [-4.8, -4.8]],
  cross: [[2, -6], [2, -2], [6, -2], [6, 2], [2, 2], [2, 6], [-2, 6], [-2, 2], [-6, 2], [-6, -2], [-2, -2], [-2, -6]],
  diamond: [[6, 0], [0, 5.5], [-6, 0], [0, -5.5]],
  crate: [[7, -4.5], [7, 4.5], [-7, 4.5], [-7, -4.5]],
  tank: [[10, -5], [10, 5], [-10, 6], [-10, -6]],
  wing: [[9, 0], [-6, 8], [-3, 0], [-6, -8]]
};

export function glyphKind(role) {
  return GLYPH_KINDS[role] || "circle";
}

export function glyphRadius(kind, scale = 1) {
  return (RADIUS[kind] || 5) * SIZE * scale;
}

/**
 * Scale that keeps a marker readable when zoomed out: at least `minPixels` radius on screen,
 * never more than 3x, and never below the unit's own scale.
 */
export function glyphScale(kind, unitScale = 1, zoom = 1, minPixels = 4.5) {
  const base = glyphRadius(kind, unitScale);
  const wanted = minPixels / Math.max(0.0001, zoom);
  return unitScale * Math.min(3, Math.max(1, wanted / base));
}

/**
 * Add the outline (and the facing mark) of one glyph to `path`.
 * Works with a canvas context after beginPath() or with a Path2D.
 */
export function traceGlyph(path, kind, x, y, angle = 0, scale = 1) {
  const cos = Math.cos(angle) * scale * SIZE;
  const sin = Math.sin(angle) * scale * SIZE;
  const px = (lx, ly) => x + lx * cos - ly * sin;
  const py = (lx, ly) => y + lx * sin + ly * cos;
  const polygon = points => {
    path.moveTo(px(points[0][0], points[0][1]), py(points[0][0], points[0][1]));
    for (let index = 1; index < points.length; index += 1) path.lineTo(px(points[index][0], points[index][1]), py(points[index][0], points[index][1]));
    path.closePath();
  };
  const line = (ax, ay, bx, by) => { path.moveTo(px(ax, ay), py(ax, ay)); path.lineTo(px(bx, by), py(bx, by)); };
  if (kind === "circle") {
    path.moveTo(x + 4.6 * scale * SIZE, y);
    path.arc(x, y, 4.6 * scale * SIZE, 0, Math.PI * 2);
    line(4.6, 0, 9, 0); // muzzle: which way it faces
    return;
  }
  const points = POLYGONS[kind] || POLYGONS.square;
  polygon(points);
  if (kind === "tank") {
    path.moveTo(px(4, 0), py(4, 0));
    path.arc(px(0, 0), py(0, 0), 4 * scale * SIZE, 0, Math.PI * 2);
    line(4, 0, 15, 0); // gun barrel
  } else if (kind === "hex") {
    path.moveTo(px(2.4, 0), py(2.4, 0));
    path.arc(px(0, 0), py(0, 0), 2.4 * scale * SIZE, 0, Math.PI * 2);
  } else if (kind === "square") {
    line(0, -4.8, 0, -11); // flag pole
    polygon([[0, -11], [6, -9], [0, -7]]);
  } else if (kind === "crate") {
    line(-7, 0, 7, 0);
    line(0, -4.5, 0, 4.5);
  }
}

/** Fill and outline one glyph on a context. `angle` is the facing in radians. */
export function drawGlyph(ctx, role, x, y, { fill, stroke = "#000", angle = 0, scale = 1, lineWidth = 1.2, alpha = 1 } = {}) {
  const kind = glyphKind(role);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.beginPath();
  traceGlyph(ctx, kind, x, y, angle, scale);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.restore();
  return kind;
}

/** Unit under a world point, from `candidates` ({x, y, role, spriteScale?}). Closest relative to its own size wins. */
export function pickGlyph(candidates, point, pickRadius) {
  let best = null;
  let bestScore = Infinity;
  for (const unit of candidates) {
    const own = glyphRadius(glyphKind(unit.role), unit.spriteScale || 1);
    const reach = Math.max(pickRadius, own + pickRadius * 0.35);
    const distance = Math.hypot(unit.x - point.x, unit.y - point.y);
    if (distance > reach) continue;
    const score = distance / reach;
    if (score < bestScore) { best = unit; bestScore = score; }
  }
  return best;
}
