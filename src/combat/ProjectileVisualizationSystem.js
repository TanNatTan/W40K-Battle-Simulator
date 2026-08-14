import { projectileArchetypeForWeapon } from "./ProjectileArchetypeSystem.js";

// V2 is a 6x37 atlas. Its quarter-scale runtime copy avoids decoding the
// 3360x20720 editable source during large firefights.
export const PROJECTILE_ATLAS_URL = "assets/projectiles/projectile-v2-runtime.png";
export const PROJECTILE_ATLAS_COLUMNS = 6;
export const PROJECTILE_ATLAS_ROWS = Object.freeze([
  "ballistic", "bolt", "high-caliber", "pellet", "plasma", "plasma-overcharge",
  "laser", "melta", "flame", "rocket", "guided-missile", "frag-grenade", "krak-grenade",
  "stun-grenade", "smoke-grenade", "incendiary-grenade", "emp-grenade", "grenade-launcher-frag",
  "grenade-launcher-krak", "mortar", "artillery", "tank-cannon", "autocannon", "he-shell",
  "ap-shell", "rail", "gauss", "tesla", "particle-beam", "warp-psychic", "bio", "acid",
  "spore", "haywire", "sonic", "continuous-beam", "energy-pulse"
]);
export const PROJECTILE_ATLAS_ROW_COUNT = PROJECTILE_ATLAS_ROWS.length;

const rowFor = id => Math.max(0, PROJECTILE_ATLAS_ROWS.indexOf(id));
const visual = (id, options = {}) => Object.freeze({
  id, row: rowFor(id), kind: options.kind || "ballistic", scale: options.scale || 1,
  frameRate: options.frameRate || 18, guided: Boolean(options.guided), turnRate: Number(options.turnRate) || 0,
  arcHeight: Number(options.arcHeight) || 0, beam: Boolean(options.beam), impactSeconds: Number(options.impactSeconds) || 0.22
});

const visualFromIdentity = (identity, type, flags) => {
  if (/continuous.?beam/.test(identity)) return visual("continuous-beam", { kind: "beam", beam: true, scale: 1.1, impactSeconds: 0.14 });
  if (/rail/.test(identity)) return visual("rail", { scale: 1.55, impactSeconds: 0.4 });
  if (/gauss/.test(identity)) return visual("gauss", { kind: "energy", scale: 1.3 });
  if (/tesla/.test(identity)) return visual("tesla", { kind: "energy", scale: 1.35 });
  if (/particle/.test(identity)) return visual("particle-beam", { kind: "energy", scale: 1.35 });
  if (/warp|psychic/.test(identity)) return visual("warp-psychic", { kind: "energy", scale: 1.45 });
  if (/acid|corrosive/.test(identity)) return visual("acid", { kind: "bio", scale: 1.25 });
  if (/spore/.test(identity)) return visual("spore", { kind: "bio", scale: 1.35 });
  if (/haywire|emp/.test(identity)) return visual(/grenade/.test(identity) ? "emp-grenade" : "haywire", { kind: "energy", scale: 1.2 });
  if (/sonic/.test(identity)) return visual("sonic", { kind: "energy", scale: 1.3 });
  if (/overcharge/.test(identity)) return visual("plasma-overcharge", { kind: "energy", scale: 1.7, impactSeconds: 0.42 });
  if (/stun.*grenade/.test(identity)) return visual("stun-grenade", { kind: "arc", arcHeight: 20, scale: 1.1 });
  if (/smoke.*grenade/.test(identity)) return visual("smoke-grenade", { kind: "arc", arcHeight: 20, scale: 1.1, impactSeconds: 0.7 });
  if (/incendiary.*grenade/.test(identity)) return visual("incendiary-grenade", { kind: "arc", arcHeight: 20, scale: 1.2, impactSeconds: 0.55 });
  if (/grenade.?launcher.*krak|krak.*launcher/.test(identity)) return visual("grenade-launcher-krak", { kind: "arc", arcHeight: 24 });
  if (/grenade.?launcher/.test(identity)) return visual("grenade-launcher-frag", { kind: "arc", arcHeight: 25 });
  if (/krak.*grenade/.test(identity)) return visual("krak-grenade", { kind: "arc", arcHeight: 20, scale: 1.1 });
  if (/ap shell/.test(identity)) return visual("ap-shell", { scale: 1.45 });
  if (/he shell|high.?explosive/.test(identity)) return visual("he-shell", { scale: 1.5, impactSeconds: 0.58 });
  if (/autocannon/.test(identity)) return visual("autocannon", { scale: 1.25 });
  const byType = {
    BALLISTIC: visual(/high.?caliber|anti.?materiel/.test(identity) ? "high-caliber" : "ballistic", { scale: /high.?caliber/.test(identity) ? 1.25 : 1 }),
    BOLT: visual("bolt", { scale: /heavy/.test(identity) ? 1.3 : 1.15, impactSeconds: 0.28 }),
    PELLET: visual("pellet", { scale: 0.82 }),
    BEAM: visual("laser", { kind: "beam", beam: true, scale: 0.9, impactSeconds: 0.12 }),
    ENERGY_BOLT: visual("energy-pulse", { kind: "energy", scale: 1.2 }),
    PLASMA: visual("plasma", { kind: "energy", scale: 1.35, impactSeconds: 0.34 }),
    MELTA: visual("melta", { kind: "beam", beam: true, scale: 1.5, impactSeconds: 0.3 }),
    FLAME: visual("flame", { kind: "stream", scale: 1.35, frameRate: 24, impactSeconds: 0.38 }),
    ROCKET: visual("rocket", { kind: "rocket", scale: 1.35, impactSeconds: 0.42 }),
    HOMING_MISSILE: visual("guided-missile", { kind: "missile", guided: true, turnRate: 2.7, scale: 1.5, impactSeconds: 0.48 }),
    GRENADE: visual("frag-grenade", { kind: "arc", arcHeight: 22, scale: 1.1, impactSeconds: 0.4 }),
    MORTAR: visual("mortar", { kind: "arc", arcHeight: 42, scale: 1.2, impactSeconds: 0.48 }),
    ARTILLERY: visual("artillery", { kind: "arc", arcHeight: 58, scale: 1.55, impactSeconds: 0.65 }),
    HEAVY_SHELL: visual(/tank|cannon/.test(identity) ? "tank-cannon" : "ap-shell", { scale: 1.45, impactSeconds: 0.48 }),
    BIO_PROJECTILE: visual("bio", { kind: "bio", scale: 1.3 })
  };
  const result = byType[type] || byType.BALLISTIC;
  return flags.guided && !result.guided ? { ...result, guided: true, turnRate: 2.7 } : result;
};

export function projectileVisualForWeapon(weapon = {}) {
  const archetype = projectileArchetypeForWeapon(weapon);
  const identity = `${weapon.id || ""} ${weapon.label || ""} ${weapon.ammoType || ""}`.toLowerCase();
  return Object.freeze({ ...visualFromIdentity(identity, archetype.type, archetype.flags), projectileType: archetype.type, flags: archetype.flags });
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
    const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter(value => value > 0);
    if (candidates.length) time = Math.min(...candidates);
  } else if (Math.abs(b) > 0.00001 && -c / b > 0) time = -c / b;
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
