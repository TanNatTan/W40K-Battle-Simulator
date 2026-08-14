const MARINE_INFANTRY_MODELS = Object.freeze({
  "Scout Marine": Object.freeze({ armor: "scout", weapon: "carbine", pack: "none" }),
  "Tactical Marine": Object.freeze({ armor: "mk7", weapon: "bolter", pack: "standard" }),
  Intercessor: Object.freeze({ armor: "mk10", weapon: "bolt-rifle", pack: "standard" }),
  "Assault Intercessor": Object.freeze({ armor: "mk10", weapon: "chainsword", pack: "standard" }),
  "Assault Marine": Object.freeze({ armor: "mk7", weapon: "chainsword", pack: "jump" }),
  Devastator: Object.freeze({ armor: "heavy", weapon: "heavy-bolter", pack: "ammo" }),
  Hellblaster: Object.freeze({ armor: "mk10", weapon: "plasma", pack: "plasma" }),
  Inceptor: Object.freeze({ armor: "gravis", weapon: "plasma-pair", pack: "jump" }),
  Aggressor: Object.freeze({ armor: "gravis", weapon: "flamer-pair", pack: "ammo" }),
  Reiver: Object.freeze({ armor: "phobos", weapon: "blade", pack: "grapnel" }),
  Incursor: Object.freeze({ armor: "phobos", weapon: "carbine", pack: "sensor" }),
  Infiltrator: Object.freeze({ armor: "phobos", weapon: "marksman", pack: "antenna" }),
  Eliminator: Object.freeze({ armor: "phobos", weapon: "sniper", pack: "cloak" })
});

const cache = new Map();
const stripSerial = value => String(value || "").replace(/\s+\d+$/, "").trim();
const modelKeyFor = unit => stripSerial(unit.name);
const canvasFactory = () => {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(96, 96);
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 96;
    return canvas;
  }
  return null;
};

export function hasMarineInfantryModel(unit = {}) {
  return Boolean(MARINE_INFANTRY_MODELS[modelKeyFor(unit)]);
}

export function marineFacingAngle(unit = {}) {
  if (Number.isFinite(unit.facing)) return unit.facing;
  const velocity = unit.movementVelocity || unit.velocity || {};
  const vx = Number(velocity.x ?? unit.vx) || 0;
  const vy = Number(velocity.y ?? unit.vy) || 0;
  return Math.hypot(vx, vy) > 0.02 ? Math.atan2(vy, vx) : -Math.PI / 2;
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
  ctx.stroke();
}

function drawPack(ctx, pack, colors) {
  ctx.fillStyle = "#1b2028";
  ctx.strokeStyle = colors.tertiary;
  if (pack === "none") return;
  if (pack === "jump") {
    for (const x of [-16, 10]) { ctx.fillRect(x, 1, 6, 18); ctx.strokeRect(x, 1, 6, 18); }
    ctx.fillStyle = colors.tertiary;
    ctx.fillRect(-15, 17, 4, 5); ctx.fillRect(11, 17, 4, 5);
    return;
  }
  ctx.fillRect(-13, -5, 26, 17);
  ctx.strokeRect(-13, -5, 26, 17);
  if (pack === "ammo") for (const x of [-9, -3, 3, 9]) ctx.fillRect(x - 1.5, 10, 3, 7);
  if (pack === "plasma") { ctx.fillStyle = colors.tertiary; ctx.fillRect(-9, 4, 18, 4); }
  if (pack === "grapnel") { ctx.beginPath(); ctx.arc(0, 6, 7, 0, Math.PI * 2); ctx.stroke(); }
  if (pack === "sensor") { ctx.fillStyle = colors.tertiary; ctx.beginPath(); ctx.arc(8, -3, 3, 0, Math.PI * 2); ctx.fill(); }
  if (pack === "antenna") { ctx.beginPath(); ctx.moveTo(9, 2); ctx.lineTo(14, -15); ctx.stroke(); }
  if (pack === "cloak") { ctx.fillStyle = colors.body; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(-13, -1); ctx.lineTo(0, 27); ctx.lineTo(13, -1); ctx.fill(); ctx.globalAlpha = 1; }
}

function drawWeapon(ctx, weapon, colors) {
  ctx.save();
  ctx.translate(12, -5);
  ctx.fillStyle = "#202731";
  ctx.strokeStyle = colors.tertiary;
  ctx.lineWidth = 1.2;
  if (/chainsword|blade/.test(weapon)) {
    ctx.fillRect(-3, -20, 6, 31); ctx.strokeRect(-3, -20, 6, 31);
    ctx.fillStyle = colors.tertiary; ctx.fillRect(-5, -20, 10, 4);
  } else {
    const long = /heavy|sniper|marksman/.test(weapon);
    const twin = /pair/.test(weapon);
    const length = long ? 33 : 25;
    const barrel = offset => {
      ctx.fillStyle = /plasma/.test(weapon) ? colors.tertiary : "#202731";
      ctx.fillRect(-4 + offset, -length, 8, length + 10); ctx.strokeRect(-4 + offset, -length, 8, length + 10);
      ctx.fillStyle = "#9ca8b5"; ctx.fillRect(-1 + offset, -length - 7, 2, 8);
    };
    if (twin) { barrel(-5); barrel(5); } else barrel(0);
    if (/heavy/.test(weapon)) { ctx.fillStyle = colors.secondary; ctx.fillRect(-7, -16, 14, 8); }
    if (/flamer/.test(weapon)) { ctx.fillStyle = "#c77b30"; ctx.fillRect(-5, -12, 10, 8); }
  }
  ctx.restore();
}

function paintModel(ctx, model, colors) {
  const heavy = ["heavy", "gravis"].includes(model.armor);
  const light = ["scout", "phobos"].includes(model.armor);
  const scale = heavy ? 1.12 : light ? 0.92 : 1;
  ctx.save();
  ctx.translate(48, 48);
  ctx.scale(scale, scale);
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = "rgba(3,7,12,.9)";
  drawPack(ctx, model.pack, colors);
  ctx.fillStyle = colors.body;
  roundedRect(ctx, -10, -7, 20, 25, 5);
  ctx.fillRect(-10, 12, 7, 17); ctx.fillRect(3, 12, 7, 17);
  ctx.strokeRect(-10, 12, 7, 17); ctx.strokeRect(3, 12, 7, 17);
  ctx.fillStyle = colors.secondary;
  for (const x of [-12, 12]) { ctx.beginPath(); ctx.arc(x, -4, heavy ? 7 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = colors.primary;
  ctx.beginPath(); ctx.arc(0, -14, light ? 5.4 : 6.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = colors.tertiary;
  ctx.fillRect(-4.5, -17, 9, 2.4);
  drawWeapon(ctx, model.weapon, colors);
  ctx.restore();
}

function cachedModel(modelName, colors) {
  const key = `${modelName}|${colors.primary}|${colors.secondary}|${colors.tertiary}|${colors.body}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = canvasFactory();
  if (!canvas) return null;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  paintModel(context, MARINE_INFANTRY_MODELS[modelName], colors);
  cache.set(key, canvas);
  return canvas;
}

export function drawMarineInfantry(ctx, unit = {}, colors = {}, time = 0) {
  const modelName = modelKeyFor(unit);
  if (!MARINE_INFANTRY_MODELS[modelName]) return false;
  const palette = {
    primary: colors.primary || "#3b82f6",
    secondary: colors.secondary || "#bae6fd",
    tertiary: colors.tertiary || colors.accent || "#7ee5ff",
    body: colors.body || colors.primary || "#3b82f6"
  };
  const sprite = cachedModel(modelName, palette);
  if (!sprite) return false;
  const moving = Math.hypot(Number(unit.movementVelocity?.x) || 0, Number(unit.movementVelocity?.y) || 0) > 0.05;
  const bob = moving ? Math.sin(time * 8 + (unit.index || 0)) * 0.55 : 0;
  ctx.save();
  ctx.translate(0, bob);
  ctx.rotate(marineFacingAngle(unit) + Math.PI / 2);
  ctx.drawImage(sprite, -24, -24, 48, 48);
  ctx.restore();
  return true;
}

export function clearMarineInfantryCache() {
  cache.clear();
}

export { MARINE_INFANTRY_MODELS };
