// Part-based sprite rigs. Every drawable thing is assembled from NAMED parts that sit in a
// proportioned model, so a unit or building reads as a believable object when the camera is close:
//
//   humanoid  - head, neck, shoulders, torso ("body"), back, upper arms, elbows, forearms, hands,
//               groin, thighs, knees, calves, feet (near/far side of each limb pair)
//   vehicle   - tracks, road wheels, hull, skirt, turret, mantlet, barrel, hatch, exhaust, antenna
//   aircraft  - fuselage, cockpit, wing, tailfin, tailplane, engine
//   structure - foundation, walls, roof, door, windows, chimney, posts, planks, stakes ... per type
//
// The humanoid part list (head, thigh, calf, knee, ...) belongs to humanoids only. Vehicles,
// aircraft and buildings follow the *same logic* - a named part list in a fixed proportion table,
// posed by a small function, drawn back to front - with the parts that make sense for them.
//
// Model space: x runs forward (the way the thing faces), y runs UP from the ground, origin at the
// centre of the footprint. Humanoids are measured in head heights (the figure is ~7.5 heads tall),
// the others in their own length (vehicles, aircraft: 1 = overall length; buildings: 1 = width).

export const RIG_KINDS = Object.freeze(["humanoid", "vehicle", "aircraft", "structure"]);

// ---- humanoid proportions (in head heights) -------------------------------------------------
export const HUMANOID_CANON = Object.freeze({
  headsTall: 7.5,
  head: 1.0,
  neck: 0.5,           // chin to shoulder line
  torso: 2.25,         // shoulder line to hip joint
  thigh: 1.75,
  calf: 1.6,
  foot: 0.4,           // ankle height
  footLength: 1.1,
  upperArm: 1.45,
  forearm: 1.2,
  hand: 0.6,
  shoulderLine: 6.0,   // height of the shoulder joint above the ground
  hipLine: 3.75,
  kneeLine: 2.0
});

export const HUMANOID_PART_IDS = Object.freeze([
  "head", "neck", "shoulder.near", "shoulder.far", "torso", "back",
  "upperArm.near", "upperArm.far", "elbow.near", "elbow.far", "forearm.near", "forearm.far", "hand.near", "hand.far",
  "groin", "thigh.near", "thigh.far", "knee.near", "knee.far", "calf.near", "calf.far", "foot.near", "foot.far"
]);

/** Body build presets: multipliers on the canonical proportions. */
export const HUMANOID_BUILDS = Object.freeze({
  average: Object.freeze({ id: "average", height: 1, width: 1, shoulder: 1, head: 1, arm: 1, leg: 1, lean: 0.04, foot: 1, pack: 1 }),
  heavy: Object.freeze({ id: "heavy", height: 1.1, width: 1.3, shoulder: 1.6, head: 0.95, arm: 1, leg: 0.98, lean: 0.03, foot: 1.15, pack: 1.25 }),
  brute: Object.freeze({ id: "brute", height: 1.03, width: 1.5, shoulder: 1.45, head: 0.85, arm: 1.2, leg: 0.84, lean: 0.24, foot: 1.35, pack: 0.6 }),
  lean: Object.freeze({ id: "lean", height: 1.04, width: 0.82, shoulder: 0.85, head: 1, arm: 1, leg: 1.07, lean: 0.02, foot: 0.95, pack: 0.7 })
});

/** Pick a build from what the game knows about a unit. */
export function humanoidBuildFor({ race = "", faction = "", role = "", name = "" } = {}) {
  const text = `${race} ${faction} ${name}`.toLowerCase();
  if (/ork|goff|ghaz|boy|nob/.test(text)) return HUMANOID_BUILDS.brute;
  if (/space marine|astartes|marine|chapter/.test(text)) return HUMANOID_BUILDS.heavy;
  if (/necron|tau|t'au|eldar|aeldari|drukhari/.test(text) || role === "scout") return HUMANOID_BUILDS.lean;
  return HUMANOID_BUILDS.average;
}

// ---- palette -----------------------------------------------------------------------------------
export const DEFAULT_PALETTE = Object.freeze({
  armor: "#4a6a9a", trim: "#d2b45a", accent: "#c04a3a", cloth: "#5a5f4a", skin: "#d4a98a",
  dark: "#242622", metal: "#8e949a", glass: "#8fd0e8", wood: "#8a6a44", stone: "#9a9588", roof: "#7a4a36"
});

export function shade(hex, amount) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  const channel = shift => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * (1 + amount))));
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
}

// ---- part helpers ------------------------------------------------------------------------------
const rect = (id, x0, y0, x1, y1, slot, z, extra = {}) => ({ id, shape: "poly", points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], slot, z, ...extra });
const poly = (id, points, slot, z, extra = {}) => ({ id, shape: "poly", points, slot, z, ...extra });
const ellipse = (id, cx, cy, rx, ry, slot, z, extra = {}) => ({ id, shape: "ellipse", cx, cy, rx, ry, slot, z, ...extra });
const circle = (id, cx, cy, r, slot, z, extra = {}) => ellipse(id, cx, cy, r, r, slot, z, extra);
const limb = (id, a, b, w0, w1, slot, z, extra = {}) => ({ id, shape: "capsule", a, b, w0, w1, slot, z, ...extra });

const PI = Math.PI;
const dir = angle => [Math.sin(angle), -Math.cos(angle)]; // angle from straight-down, positive = forward

// ---- humanoid ----------------------------------------------------------------------------------
/**
 * Posed humanoid parts.
 * pose: { phase (walk cycle, radians), stride 0..1 (how much it is walking), aim 0..1 (weapon raised),
 *         crouch 0..1, role, dead }
 */
export function humanoidParts(buildInput = HUMANOID_BUILDS.average, pose = {}) {
  const build = typeof buildInput === "string" ? HUMANOID_BUILDS[buildInput] || HUMANOID_BUILDS.average : buildInput;
  const C = HUMANOID_CANON;
  const { phase = 0, stride = 0, aim = 0, crouch = 0, role = "trooper" } = pose;
  const W = build.width;
  const thighLen = C.thigh * build.leg;
  const calfLen = C.calf * build.leg;
  const ankleH = C.foot;
  const torsoLen = C.torso * build.height;
  const upperLen = C.upperArm * build.arm;
  const foreLen = C.forearm * build.arm;
  const handLen = C.hand * build.arm;
  const headH = C.head * build.head;
  const headW = 0.85 * build.head * (build.id === "brute" ? 1.2 : 1);

  // legs: thigh swings from the hip, the calf folds back at the knee; crouching folds both.
  const legs = [0, 1].map(index => {
    const sign = index === 0 ? 1 : -1; // near leg leads on phase 0
    const swing = stride * 0.62 * Math.sin(phase) * sign;
    const flex = stride * 0.95 * Math.max(0, Math.sin(phase * sign + 1.1));
    const thighAngle = swing + crouch * 0.85;
    const calfAngle = thighAngle - (flex + crouch * 1.55);
    const knee = [0, 0]; const ankle = [0, 0];
    const [tx, ty] = dir(thighAngle);
    knee[0] = tx * thighLen; knee[1] = ty * thighLen;
    const [cx, cy] = dir(calfAngle);
    ankle[0] = knee[0] + cx * calfLen; ankle[1] = knee[1] + cy * calfLen;
    return { knee, ankle, thighAngle, calfAngle, sole: ankle[1] - ankleH };
  });
  const lift = -Math.min(legs[0].sole, legs[1].sole); // keep the lower foot on the ground
  const hip = [0, lift];
  const lean = build.lean + stride * 0.08 + aim * 0.05 + crouch * 0.25;
  const [lx, ly] = [Math.sin(lean), Math.cos(lean)];
  const shoulder = [hip[0] + lx * torsoLen, hip[1] + ly * torsoLen];
  const headTilt = lean * 0.4;
  const headBase = [shoulder[0] + Math.sin(headTilt) * C.neck, shoulder[1] + Math.cos(headTilt) * C.neck];
  const headCenter = [headBase[0] + Math.sin(headTilt) * headH * 0.5 + 0.05, headBase[1] + Math.cos(headTilt) * headH * 0.5];

  const parts = [];
  legs.forEach((leg, index) => {
    const side = index === 0 ? "near" : "far";
    const z0 = index === 0 ? 40 : 10;
    const dim = index === 0 ? 0 : -0.22;
    const kneeAt = [hip[0] + leg.knee[0], hip[1] + leg.knee[1]];
    const ankleAt = [hip[0] + leg.ankle[0], hip[1] + leg.ankle[1]];
    parts.push(limb(`thigh.${side}`, [hip[0], hip[1]], kneeAt, 0.5 * W, 0.4 * W, "cloth", z0, { shade: dim }));
    parts.push(limb(`calf.${side}`, kneeAt, ankleAt, 0.38 * W, 0.3 * W, "armor", z0 + 1, { shade: dim }));
    parts.push(circle(`knee.${side}`, kneeAt[0] + 0.04, kneeAt[1], 0.24 * W, "trim", z0 + 2, { shade: dim }));
    // The foot stays flat to the ground, toes forward.
    const fl = C.footLength * build.foot;
    parts.push(poly(`foot.${side}`, [
      [ankleAt[0] - 0.22, ankleAt[1] + 0.05], [ankleAt[0] + 0.2, ankleAt[1] + 0.05],
      [ankleAt[0] + fl * 0.82, ankleAt[1] - ankleH * 0.7], [ankleAt[0] + fl * 0.9, ankleAt[1] - ankleH],
      [ankleAt[0] - 0.28, ankleAt[1] - ankleH]
    ], "dark", z0 + 3, { shade: dim }));
  });

  // pelvis, torso and back
  parts.push(ellipse("groin", hip[0], hip[1] + 0.05, 0.46 * W, 0.34, "cloth", 30));
  const hipFront = hip[0] + 0.05;
  const torsoMid = [(hip[0] + shoulder[0]) / 2, (hip[1] + shoulder[1]) / 2];
  parts.push(limb("torso", [hipFront, hip[1] + 0.15], [shoulder[0] + 0.02, shoulder[1] - 0.2], 0.78 * W, 0.98 * W, "armor", 32));
  parts.push(limb("back", [hip[0] - 0.42 * W, hip[1] + torsoLen * 0.25], [shoulder[0] - 0.46 * W, shoulder[1] - 0.45], 0.4 * build.pack, 0.34 * build.pack, role === "supply" || role === "medic" || role === "builder" ? "cloth" : "dark", 31));
  parts.push(limb("neck", headBase, [headBase[0] - Math.sin(headTilt) * 0.3, headBase[1] - 0.3], 0.34, 0.38, "skin", 33));
  parts.push(ellipse("head", headCenter[0], headCenter[1], headW * 0.5, headH * 0.5, "skin", 36));
  parts.push({ id: "helmet", shape: "ellipse", cx: headCenter[0] - 0.04, cy: headCenter[1] + headH * 0.2, rx: headW * 0.53, ry: headH * 0.34, slot: "armor", z: 37, gear: true });

  // arms: opposite swing to the legs; aiming raises both toward the weapon.
  const shoulderAt = [shoulder[0] - 0.02, shoulder[1] - 0.1];
  const arms = [0, 1].map(index => {
    const sign = index === 0 ? -1 : 1;
    const swing = stride * 0.55 * Math.sin(phase) * sign;
    const upperAngle = swing * (1 - aim) + (index === 0 ? 1.28 : 1.05) * aim;
    const elbowFlex = (0.25 + stride * 0.45 * (index === 0 ? Math.max(0, -Math.sin(phase)) : Math.max(0, Math.sin(phase)))) * (1 - aim) + (index === 0 ? 0.35 : 0.8) * aim;
    const foreAngle = upperAngle + elbowFlex;
    const [ux, uy] = dir(upperAngle);
    const elbow = [shoulderAt[0] + ux * upperLen, shoulderAt[1] + uy * upperLen];
    const [fx, fy] = dir(foreAngle);
    const wrist = [elbow[0] + fx * foreLen, elbow[1] + fy * foreLen];
    const [hx, hy] = dir(foreAngle + 0.1);
    const fingers = [wrist[0] + hx * handLen, wrist[1] + hy * handLen];
    return { elbow, wrist, fingers, foreAngle };
  });
  arms.forEach((arm, index) => {
    const side = index === 0 ? "near" : "far";
    const z0 = index === 0 ? 60 : 5;
    const dim = index === 0 ? 0 : -0.25;
    parts.push(limb(`upperArm.${side}`, shoulderAt, arm.elbow, 0.4 * W, 0.34 * W, "cloth", z0, { shade: dim }));
    parts.push(limb(`forearm.${side}`, arm.elbow, arm.wrist, 0.33 * W, 0.27 * W, "armor", z0 + 1, { shade: dim }));
    parts.push(circle(`elbow.${side}`, arm.elbow[0], arm.elbow[1], 0.21 * W, "trim", z0 + 2, { shade: dim }));
    parts.push(limb(`hand.${side}`, arm.wrist, arm.fingers, 0.28, 0.22, "dark", z0 + 3, { shade: dim }));
    parts.push(circle(`shoulder.${side}`, shoulderAt[0], shoulderAt[1] + 0.05, (index === 0 ? 0.36 : 0.3) * build.shoulder ** 0.7, index === 0 ? "armor" : "trim", z0 + (index === 0 ? 4 : 30), { shade: dim }));
  });

  // gear, by role
  const hand = arms[0].fingers;
  const aimAngle = aim > 0.1 ? 0.04 : -0.4;
  const gunDir = [Math.cos(aimAngle), Math.sin(aimAngle)];
  if (["trooper", "scout", "commander", "capture", "engineer", "builder", "headquarters"].includes(role) || role === "vehicle") {
    const len = role === "scout" ? 2.1 : 2.4;
    parts.push(limb("weapon", [hand[0] - gunDir[0] * 0.8, hand[1] - gunDir[1] * 0.8], [hand[0] + gunDir[0] * (len - 0.8), hand[1] + gunDir[1] * (len - 0.8)], 0.26, 0.2, "metal", 70, { gear: true }));
  }
  if (role === "worker") {
    // A hand tool: haft with a metal head, held in the near hand.
    parts.push(limb("tool", [hand[0] - 0.2, hand[1] - 0.9], [hand[0] + 0.5, hand[1] + 1.1], 0.14, 0.12, "wood", 70, { gear: true }));
    parts.push(rect("toolHead", hand[0] + 0.25, hand[1] + 0.95, hand[0] + 0.85, hand[1] + 1.2, "metal", 71, { gear: true }));
  }
  if (role === "medic") parts.push(rect("medicCross", shoulder[0] - 0.25, shoulder[1] - 1.0, shoulder[0] + 0.25, shoulder[1] - 0.5, "accent", 61, { gear: true }));
  if (role === "standard") {
    const top = shoulder[1] + 3.2;
    parts.push(limb("bannerPole", [hand[0], hip[1] + 0.2], [hand[0], top], 0.12, 0.12, "wood", 72, { gear: true }));
    parts.push(poly("banner", [[hand[0], top], [hand[0] - 1.9, top - 0.2], [hand[0] - 1.7, top - 1.3], [hand[0], top - 1.1]], "accent", 73, { gear: true }));
  }
  if (role === "commander") parts.push(poly("cape", [[shoulder[0] - 0.4, shoulder[1] - 0.2], [hip[0] - 0.55 * W, hip[1] - 0.8], [hip[0] - 0.1, hip[1] - 0.9], [shoulder[0] - 0.1, shoulder[1] - 0.6]], "accent", 29, { gear: true }));
  void torsoMid;
  return parts;
}

// ---- vehicles (1 = overall hull length) -----------------------------------------------------------
export const VEHICLE_PART_IDS = Object.freeze(["track.far", "track.near", "hull", "skirt", "turret", "mantlet", "barrel", "hatch", "exhaust", "antenna"]);

export function vehicleParts(pose = {}) {
  const { aim = 0, recoil = 0, wheelPhase = 0 } = pose;
  const parts = [];
  parts.push(rect("track.far", -0.5, 0, 0.5, 0.17, "dark", 5, { shade: -0.3, rounded: 0.08 }));
  parts.push(rect("track.near", -0.5, 0, 0.5, 0.19, "dark", 40, { rounded: 0.09 }));
  for (let n = 0; n < 6; n += 1) {
    const big = n === 0 || n === 5;
    parts.push(circle(`roadwheel.${n}`, -0.4 + n * 0.16, 0.095, big ? 0.075 : 0.065, "metal", 41, { spin: wheelPhase * (big ? 1 : 1.2) + n }));
  }
  parts.push(poly("hull", [[-0.46, 0.14], [-0.47, 0.35], [0.28, 0.38], [0.5, 0.25], [0.5, 0.14]], "armor", 42));
  parts.push(rect("skirt", -0.42, 0.14, 0.42, 0.24, "trim", 43));
  parts.push(rect("exhaust", -0.53, 0.26, -0.46, 0.32, "dark", 44));
  parts.push(poly("turret", [[-0.2, 0.37], [-0.13, 0.52], [0.15, 0.52], [0.23, 0.37]], "armor", 50));
  parts.push(rect("mantlet", 0.2, 0.4, 0.27, 0.5, "trim", 51));
  const barrelY = 0.45; const angle = aim * 0.12;
  const reach = 0.56 - recoil * 0.05;
  parts.push(limb("barrel", [0.26, barrelY], [0.26 + Math.cos(angle) * reach, barrelY + Math.sin(angle) * reach], 0.04, 0.035, "dark", 49));
  parts.push(ellipse("hatch", -0.04, 0.54, 0.055, 0.025, "metal", 52));
  parts.push(limb("antenna", [-0.16, 0.5], [-0.2, 0.78], 0.008, 0.005, "dark", 53));
  return parts;
}

// ---- aircraft -----------------------------------------------------------------------------------------
export const AIRCRAFT_PART_IDS = Object.freeze(["fuselage", "cockpit", "wing.near", "wing.far", "tailfin", "tailplane", "engine"]);

export function aircraftParts(pose = {}) {
  const { bank = 0 } = pose;
  const parts = [];
  parts.push(poly("wing.far", [[0.05, 0.2], [-0.12, 0.2], [-0.2 + bank * 0.05, 0.34], [-0.02, 0.34]], "armor", 5, { shade: -0.25 }));
  parts.push(ellipse("fuselage", 0, 0.2, 0.5, 0.075, "armor", 20));
  parts.push(ellipse("cockpit", 0.2, 0.25, 0.1, 0.045, "glass", 21));
  parts.push(poly("tailfin", [[-0.4, 0.22], [-0.5, 0.42], [-0.42, 0.42], [-0.28, 0.24]], "trim", 19));
  parts.push(poly("tailplane", [[-0.4, 0.2], [-0.5, 0.15], [-0.42, 0.13], [-0.3, 0.19]], "trim", 22));
  parts.push(poly("wing.near", [[0.08, 0.17], [-0.14, 0.17], [-0.24, 0.04 - bank * 0.05], [-0.02, 0.04 - bank * 0.05]], "armor", 30));
  parts.push(limb("engine", [-0.05, 0.1], [-0.3, 0.1], 0.07, 0.06, "metal", 31));
  return parts;
}

// ---- structures (1 = footprint width) --------------------------------------------------------------------
const STAGE = { frame: 0, walls: 0.35, roof: 0.7, detail: 0.92 };

function houseParts() {
  return [
    rect("foundation", -0.5, 0, 0.5, 0.08, "stone", 1, { stage: STAGE.frame }),
    rect("wall", -0.45, 0.08, 0.45, 0.5, "wood", 2, { stage: STAGE.walls }),
    poly("roof", [[-0.56, 0.5], [0, 0.88], [0.56, 0.5]], "roof", 4, { stage: STAGE.roof, fragile: true }),
    rect("door", -0.08, 0.08, 0.08, 0.34, "dark", 3, { stage: STAGE.detail }),
    rect("window.0", -0.34, 0.26, -0.2, 0.38, "glass", 3, { stage: STAGE.detail }),
    rect("window.1", 0.2, 0.26, 0.34, 0.38, "glass", 3, { stage: STAGE.detail }),
    rect("chimney", 0.25, 0.62, 0.35, 0.92, "stone", 3, { stage: STAGE.detail, fragile: true })
  ];
}

const STRUCTURE_BUILDERS = {
  house: houseParts,
  granary: () => [
    rect("foundation", -0.46, 0, 0.46, 0.1, "stone", 1, { stage: STAGE.frame }),
    rect("wall", -0.4, 0.1, 0.4, 0.62, "wood", 2, { stage: STAGE.walls }),
    poly("roof", [[-0.5, 0.62], [0, 1.0], [0.5, 0.62]], "roof", 4, { stage: STAGE.roof, fragile: true }),
    rect("door", -0.12, 0.1, 0.12, 0.42, "dark", 3, { stage: STAGE.detail }),
    rect("vent", -0.05, 0.7, 0.05, 0.78, "dark", 5, { stage: STAGE.detail, fragile: true })
  ],
  watchtower: () => [
    limb("leg.near", [-0.22, 0], [-0.14, 0.62], 0.06, 0.05, "wood", 2, { stage: STAGE.frame }),
    limb("leg.far", [0.22, 0], [0.14, 0.62], 0.06, 0.05, "wood", 1, { stage: STAGE.frame }),
    limb("brace", [-0.2, 0.12], [0.2, 0.5], 0.03, 0.03, "wood", 3, { stage: STAGE.walls }),
    rect("platform", -0.24, 0.62, 0.24, 0.68, "wood", 4, { stage: STAGE.walls }),
    rect("cabin", -0.2, 0.68, 0.2, 0.92, "wood", 5, { stage: STAGE.roof }),
    poly("roof", [[-0.28, 0.92], [0, 1.15], [0.28, 0.92]], "roof", 6, { stage: STAGE.roof, fragile: true }),
    rect("window.0", -0.08, 0.76, 0.08, 0.84, "glass", 6, { stage: STAGE.detail })
  ],
  barricade: () => [
    limb("post.0", [-0.4, 0], [-0.4, 0.42], 0.06, 0.05, "wood", 2, { stage: STAGE.frame }),
    limb("post.1", [0.4, 0], [0.4, 0.42], 0.06, 0.05, "wood", 2, { stage: STAGE.frame }),
    rect("plank.0", -0.46, 0.08, 0.46, 0.18, "wood", 3, { stage: STAGE.walls }),
    rect("plank.1", -0.46, 0.22, 0.46, 0.32, "wood", 3, { stage: STAGE.walls }),
    limb("spike.0", [-0.2, 0.3], [-0.1, 0.52], 0.03, 0.01, "dark", 4, { stage: STAGE.detail }),
    limb("spike.1", [0.2, 0.3], [0.1, 0.52], 0.03, 0.01, "dark", 4, { stage: STAGE.detail })
  ],
  palisade: () => {
    const parts = [rect("rail", -0.5, 0.15, 0.5, 0.22, "wood", 3, { stage: STAGE.walls })];
    for (let n = 0; n < 9; n += 1) parts.push(poly(`stake.${n}`, [[-0.5 + n * 0.115, 0], [-0.5 + n * 0.115 + 0.09, 0], [-0.5 + n * 0.115 + 0.045, 0.62 + (n % 3) * 0.04]], "wood", 2, { stage: STAGE.frame }));
    return parts;
  },
  mineworks: () => [
    rect("foundation", -0.5, 0, 0.5, 0.06, "stone", 1, { stage: STAGE.frame }),
    limb("headframe.left", [-0.3, 0.06], [0, 0.85], 0.06, 0.04, "wood", 3, { stage: STAGE.walls }),
    limb("headframe.right", [0.3, 0.06], [0, 0.85], 0.06, 0.04, "wood", 2, { stage: STAGE.walls }),
    circle("wheel", 0, 0.82, 0.1, "metal", 4, { stage: STAGE.roof }),
    rect("shed", 0.25, 0.06, 0.5, 0.3, "wood", 2, { stage: STAGE.roof }),
    rect("oreCart", -0.5, 0.06, -0.3, 0.2, "dark", 3, { stage: STAGE.detail })
  ],
  hall: () => [
    rect("foundation", -0.5, 0, 0.5, 0.08, "stone", 1, { stage: STAGE.frame }),
    rect("wall", -0.46, 0.08, 0.46, 0.46, "stone", 2, { stage: STAGE.walls }),
    rect("tower", 0.26, 0.46, 0.44, 0.9, "stone", 3, { stage: STAGE.roof }),
    poly("roof", [[-0.54, 0.46], [-0.1, 0.78], [0.3, 0.46]], "roof", 5, { stage: STAGE.roof, fragile: true }),
    poly("towerRoof", [[0.24, 0.9], [0.35, 1.12], [0.46, 0.9]], "roof", 6, { stage: STAGE.roof, fragile: true }),
    rect("door", -0.12, 0.08, 0.04, 0.32, "dark", 4, { stage: STAGE.detail }),
    limb("bannerPole", [-0.3, 0.46], [-0.3, 0.98], 0.025, 0.02, "wood", 4, { stage: STAGE.detail, fragile: true }),
    poly("banner", [[-0.3, 0.98], [-0.14, 0.94], [-0.14, 0.8], [-0.3, 0.84]], "accent", 5, { stage: STAGE.detail, fragile: true })
  ],
  bunker: () => [
    rect("foundation", -0.5, 0, 0.5, 0.06, "stone", 1, { stage: STAGE.frame }),
    poly("wall", [[-0.5, 0.06], [-0.44, 0.38], [0.44, 0.38], [0.5, 0.06]], "stone", 2, { stage: STAGE.walls }),
    rect("roofSlab", -0.5, 0.38, 0.5, 0.46, "armor", 4, { stage: STAGE.roof }),
    rect("slit", -0.3, 0.2, 0.3, 0.27, "dark", 3, { stage: STAGE.detail }),
    rect("door", 0.34, 0.06, 0.42, 0.24, "dark", 3, { stage: STAGE.detail })
  ]
};

const STRUCTURE_ALIASES = { outpost: "hall", barracks: "house", fieldhospital: "house", warehouse: "granary", observationtower: "watchtower", generator: "mineworks", workshop: "mineworks", dropbay: "hall" };
export const STRUCTURE_TYPES = Object.freeze(Object.keys(STRUCTURE_BUILDERS));

export function structureParts(type = "house", { progress = 1, damage = 0 } = {}) {
  const build = STRUCTURE_BUILDERS[type] || STRUCTURE_BUILDERS[STRUCTURE_ALIASES[type]] || STRUCTURE_BUILDERS.house;
  const parts = [ellipse("shadow", 0.05, 0, 0.58, 0.07, "dark", 0, { alpha: 0.28 })];
  for (const part of build()) {
    if (progress < (part.stage ?? 0)) continue;
    if (damage > 0.6 && part.fragile) continue; // roofs and chimneys go first
    parts.push(damage > 0.15 ? { ...part, shade: (part.shade || 0) - Math.min(0.45, damage * 0.5) } : part);
  }
  return parts;
}

// ---- generic access --------------------------------------------------------------------------------------
export function partsFor(kind, options = {}) {
  if (kind === "humanoid") return humanoidParts(options.build, options.pose);
  if (kind === "vehicle") return vehicleParts(options.pose);
  if (kind === "aircraft") return aircraftParts(options.pose);
  return structureParts(options.type, options);
}

/** Which rig kind draws a unit role (null = keep the plain shape marker). */
export function rigKindForRole(role) {
  if (role === "vehicle") return "vehicle";
  if (role === "aircraft") return "aircraft";
  return "humanoid";
}

/** Axis-aligned extent of a parts list in model units. */
export function partsExtent(parts) {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  const take = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
  for (const part of parts) {
    if (part.gear) continue;
    if (part.shape === "poly") for (const [x, y] of part.points) take(x, y);
    else if (part.shape === "ellipse") { take(part.cx - part.rx, part.cy - part.ry); take(part.cx + part.rx, part.cy + part.ry); }
    else if (part.shape === "capsule") {
      const r = Math.max(part.w0, part.w1) / 2;
      take(part.a[0] - r, part.a[1] - r); take(part.a[0] + r, part.a[1] + r); take(part.b[0] - r, part.b[1] - r); take(part.b[0] + r, part.b[1] + r);
    }
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

// ---- drawing ------------------------------------------------------------------------------------------------
function tracePart(ctx, part, px, py) {
  if (part.shape === "poly") {
    const first = part.points[0];
    ctx.moveTo(px(first[0]), py(first[1]));
    for (let n = 1; n < part.points.length; n += 1) ctx.lineTo(px(part.points[n][0]), py(part.points[n][1]));
    ctx.closePath();
  } else if (part.shape === "ellipse") {
    ctx.ellipse(px(part.cx), py(part.cy), Math.abs(px(part.rx) - px(0)), Math.abs(py(part.ry) - py(0)), 0, 0, Math.PI * 2);
  } else if (part.shape === "capsule") {
    const ax = px(part.a[0]); const ay = py(part.a[1]); const bx = px(part.b[0]); const by = py(part.b[1]);
    const r0 = Math.abs(px(part.w0 / 2) - px(0)); const r1 = Math.abs(px(part.w1 / 2) - px(0));
    const angle = Math.atan2(by - ay, bx - ax);
    ctx.arc(ax, ay, r0, angle + Math.PI / 2, angle + Math.PI * 1.5);
    ctx.arc(bx, by, r1, angle - Math.PI / 2, angle + Math.PI / 2);
    ctx.closePath();
  }
}

/**
 * Draw posed parts onto a context at world point (x, y) (the footprint centre / feet).
 * `unit` is world units per model unit; `flip` mirrors the figure (facing left).
 */
export function drawParts(ctx, parts, x, y, { unit = 1, flip = false, palette = DEFAULT_PALETTE, outline = "rgba(8,10,8,0.85)", lineWidth = 0.5, alpha = 1 } = {}) {
  const side = flip ? -1 : 1;
  const px = value => x + value * unit * side;
  const py = value => y - value * unit;
  const ordered = [...parts].sort((a, b) => a.z - b.z);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = outline;
  for (const part of ordered) {
    const base = palette[part.slot] || DEFAULT_PALETTE[part.slot] || "#888";
    ctx.globalAlpha = alpha * (part.alpha ?? 1);
    ctx.fillStyle = part.shade ? shade(base, part.shade) : base;
    ctx.beginPath();
    tracePart(ctx, part, px, py);
    ctx.fill();
    if (part.alpha == null) ctx.stroke();
  }
  ctx.restore();
}

/** Convenience: build parts for a kind and draw them. Returns the parts (for tests and hit areas). */
export function drawRig(ctx, kind, x, y, options = {}) {
  const parts = partsFor(kind, options);
  drawParts(ctx, parts, x, y, options);
  return parts;
}
