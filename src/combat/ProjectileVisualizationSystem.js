// Keep the supplied 3360x13440 atlas as the editable master. The runtime copy
// preserves the exact 6x24 frame grid at one quarter scale and avoids uploading
// a roughly 180 MB decoded texture to the browser during the first firefight.
export const PROJECTILE_ATLAS_URL = "assets/projectiles/projectile_sprite_sheet_runtime.png";
export const PROJECTILE_ATLAS_COLUMNS = 6;

export const PROJECTILE_ATLAS_ROWS = Object.freeze([
  "ballistic", "bolt", "high-caliber", "shot", "plasma", "plasma-overcharge",
  "laser", "melta", "flame", "rocket", "guided-missile", "frag-grenade",
  "krak-grenade", "smoke-grenade", "incendiary-grenade", "plasma-grenade",
  "grenade-launcher-frag", "grenade-launcher-krak", "mortar", "artillery",
  "tank-shell", "autocannon", "high-explosive", "tracer"
]);

const rowFor = id => Math.max(0, PROJECTILE_ATLAS_ROWS.indexOf(id));
const visual = (id, options = {}) => Object.freeze({
  id,
  row: rowFor(id),
  kind: options.kind || "ballistic",
  scale: options.scale || 1,
  frameRate: options.frameRate || 18,
  guided: Boolean(options.guided),
  turnRate: Number(options.turnRate) || 0,
  arcHeight: Number(options.arcHeight) || 0,
  beam: Boolean(options.beam),
  impactSeconds: Number(options.impactSeconds) || 0.22
});

const VISUALS = Object.freeze({
  ballistic: visual("ballistic"),
  bolt: visual("bolt", { scale: 1.15, impactSeconds: 0.28 }),
  "high-caliber": visual("high-caliber", { scale: 1.25 }),
  shot: visual("shot", { scale: 0.82 }),
  plasma: visual("plasma", { kind: "energy", scale: 1.35, impactSeconds: 0.34 }),
  "plasma-overcharge": visual("plasma-overcharge", { kind: "energy", scale: 1.7, impactSeconds: 0.42 }),
  laser: visual("laser", { kind: "beam", beam: true, scale: 0.9, impactSeconds: 0.12 }),
  melta: visual("melta", { kind: "beam", beam: true, scale: 1.5, impactSeconds: 0.3 }),
  flame: visual("flame", { kind: "stream", scale: 1.35, frameRate: 24, impactSeconds: 0.38 }),
  rocket: visual("rocket", { kind: "rocket", scale: 1.35, impactSeconds: 0.42 }),
  "guided-missile": visual("guided-missile", { kind: "missile", guided: true, turnRate: 2.7, scale: 1.5, impactSeconds: 0.48 }),
  "frag-grenade": visual("frag-grenade", { kind: "arc", arcHeight: 22, scale: 1.1, impactSeconds: 0.4 }),
  "krak-grenade": visual("krak-grenade", { kind: "arc", arcHeight: 20, scale: 1.1, impactSeconds: 0.38 }),
  "smoke-grenade": visual("smoke-grenade", { kind: "arc", arcHeight: 20, scale: 1.1, impactSeconds: 0.7 }),
  "incendiary-grenade": visual("incendiary-grenade", { kind: "arc", arcHeight: 20, scale: 1.2, impactSeconds: 0.55 }),
  "plasma-grenade": visual("plasma-grenade", { kind: "arc", arcHeight: 22, scale: 1.3, impactSeconds: 0.48 }),
  "grenade-launcher-frag": visual("grenade-launcher-frag", { kind: "arc", arcHeight: 25, scale: 1.05, impactSeconds: 0.42 }),
  "grenade-launcher-krak": visual("grenade-launcher-krak", { kind: "arc", arcHeight: 24, scale: 1.05, impactSeconds: 0.4 }),
  mortar: visual("mortar", { kind: "arc", arcHeight: 42, scale: 1.2, impactSeconds: 0.48 }),
  artillery: visual("artillery", { kind: "arc", arcHeight: 58, scale: 1.55, impactSeconds: 0.65 }),
  "tank-shell": visual("tank-shell", { scale: 1.45, impactSeconds: 0.48 }),
  autocannon: visual("autocannon", { scale: 1.25, impactSeconds: 0.32 }),
  "high-explosive": visual("high-explosive", { scale: 1.5, impactSeconds: 0.58 }),
  tracer: visual("tracer", { scale: 0.8, impactSeconds: 0.16 })
});

export function projectileVisualForWeapon(weapon = {}) {
  const identity = `${weapon.id || ""} ${weapon.label || ""} ${weapon.ammoType || ""}`.toLowerCase();
  if (/guided|seeker|homing|missile/.test(identity)) return VISUALS["guided-missile"];
  if (/artillery|basilisk|earthshaker/.test(identity)) return VISUALS.artillery;
  if (/mortar/.test(identity)) return VISUALS.mortar;
  if (/grenade.?launcher.*krak|krak.*launcher/.test(identity)) return VISUALS["grenade-launcher-krak"];
  if (/grenade.?launcher/.test(identity)) return VISUALS["grenade-launcher-frag"];
  if (/plasma.*grenade/.test(identity)) return VISUALS["plasma-grenade"];
  if (/incendiary.*grenade/.test(identity)) return VISUALS["incendiary-grenade"];
  if (/smoke.*grenade/.test(identity)) return VISUALS["smoke-grenade"];
  if (/krak.*grenade/.test(identity)) return VISUALS["krak-grenade"];
  if (/frag.*grenade|grenade/.test(identity)) return VISUALS["frag-grenade"];
  if (/rocket/.test(identity)) return VISUALS.rocket;
  if (/flam|promethium/.test(identity)) return VISUALS.flame;
  if (/melta/.test(identity)) return VISUALS.melta;
  if (/laser|lasgun|lascannon/.test(identity)) return VISUALS.laser;
  if (/overcharge/.test(identity)) return VISUALS["plasma-overcharge"];
  if (/plasma/.test(identity)) return VISUALS.plasma;
  if (/tank|cannon shell|battle cannon/.test(identity)) return VISUALS["tank-shell"];
  if (/autocannon/.test(identity)) return VISUALS.autocannon;
  if (/heavy.?gun|high.?explosive|demolisher/.test(identity)) return VISUALS["high-explosive"];
  if (/heavy.?bolter|high.?caliber/.test(identity)) return VISUALS["high-caliber"];
  if (/shotgun|scatter/.test(identity)) return VISUALS.shot;
  if (/bolt/.test(identity)) return VISUALS.bolt;
  return VISUALS.ballistic;
}

export function predictedInterceptPoint(shooter = {}, target = {}, projectileSpeed = 0) {
  const speed = Math.max(1, Number(projectileSpeed) || 1);
  const velocity = target.movementVelocity || target.velocity || {};
  const vx = Number(velocity.x ?? target.vx) || 0;
  const vy = Number(velocity.y ?? target.vy) || 0;
  const dx = (Number(target.x) || 0) - (Number(shooter.x) || 0);
  const dy = (Number(target.y) || 0) - (Number(shooter.y) || 0);
  const a = vx * vx + vy * vy - speed * speed;
  const b = 2 * (dx * vx + dy * vy);
  const c = dx * dx + dy * dy;
  const discriminant = b * b - 4 * a * c;
  let time = Math.sqrt(c) / speed;
  if (Math.abs(a) > 0.00001 && discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    const first = (-b - root) / (2 * a);
    const second = (-b + root) / (2 * a);
    const candidates = [first, second].filter(value => value > 0);
    if (candidates.length) time = Math.min(...candidates);
  } else if (Math.abs(b) > 0.00001) {
    const linear = -c / b;
    if (linear > 0) time = linear;
  }
  time = Math.min(2.5, Math.max(0, time));
  return Object.freeze({ x: (Number(target.x) || 0) + vx * time, y: (Number(target.y) || 0) + vy * time, time });
}

export function guideProjectile(projectile = {}, target = null, dt = 0) {
  if (!projectile.guided || !target?.alive) return projectile;
  const speed = Math.hypot(Number(projectile.vx) || 0, Number(projectile.vy) || 0) || 1;
  const current = Math.atan2(projectile.vy, projectile.vx);
  const desired = Math.atan2(target.y - projectile.y, target.x - projectile.x);
  const delta = Math.atan2(Math.sin(desired - current), Math.cos(desired - current));
  const maximum = Math.max(0, Number(projectile.turnRate) || 0) * Math.max(0, Number(dt) || 0);
  const angle = current + Math.max(-maximum, Math.min(maximum, delta));
  projectile.vx = Math.cos(angle) * speed;
  projectile.vy = Math.sin(angle) * speed;
  return projectile;
}

export function projectileArcOffset(projectile = {}) {
  const height = Number(projectile.arcHeight) || 0;
  if (!height) return 0;
  const progress = Math.max(0, Math.min(1, (Number(projectile.traveled) || 0) / Math.max(1, Number(projectile.maxTravel) || 1)));
  return Math.sin(progress * Math.PI) * height;
}
