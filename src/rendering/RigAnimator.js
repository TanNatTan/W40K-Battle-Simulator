// Turns "where was this thing last frame" into walk-cycle phase, stride and aim for the part rigs.
// State lives in a WeakMap keyed by the unit object, so nothing leaks into saves or snapshots.

const STEP_LENGTH = 6;   // world units covered by one stride of one leg
const SMOOTH = 0.3;      // how fast stride/aim ease toward their target (per update)

export class RigAnimator {
  constructor() { this.states = new WeakMap(); }

  /** Update and return { phase, stride, aim, flip } for `key` standing at (x, y) facing `facing`. */
  pose(key, x, y, { facing = null, engaged = false, seed = 0 } = {}) {
    let s = this.states.get(key);
    if (!s) { s = { x, y, phase: seed * 1.7, stride: 0, aim: 0, flip: facing != null && Math.cos(facing) < 0 }; this.states.set(key, s); }
    const moved = Math.hypot(x - s.x, y - s.y);
    if (moved > 0.01 && moved < 80) s.phase += moved / STEP_LENGTH * Math.PI;
    s.stride += ((moved > 0.02 && moved < 80 ? 1 : 0) - s.stride) * SMOOTH;
    s.aim += ((engaged ? 1 : 0) - s.aim) * SMOOTH;
    const cos = facing != null ? Math.cos(facing) : (moved > 0.01 ? (x - s.x) / moved : 0);
    if (Math.abs(cos) > 0.15) s.flip = cos < 0; // keep the last side while facing straight up or down
    s.x = x; s.y = y;
    return { phase: s.phase, stride: s.stride < 0.03 ? 0 : s.stride, aim: s.aim < 0.03 ? 0 : s.aim, flip: s.flip };
  }
}
