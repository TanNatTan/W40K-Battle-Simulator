// What the ground does to whoever stands on it. Pure: feed in a surfaceInfo
// sample from WorldLayers and a unit class, get movement, cover and
// concealment multipliers back. Unit classes differ on purpose -- a Guardsman
// bogs down in mud differently from a power-armoured Marine, a Dreadnought
// wades what a truck cannot, and a trench is cover for infantry but a hazard
// for wheels.

import { EARTHWORK, SURFACE, VEGETATION } from "./WorldLayers.js";

const NO_WATER = -1e9;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const UNIT_CLASSES = Object.freeze(["civilian", "infantry", "powerarmor", "vehicle", "dreadnought", "beast"]);

// Per-class tolerance: how bad each hazard is (1 = baseline infantry).
const PROFILE = {
  civilian: { mud: 1.15, forest: 0.95, wade: 0.55, trench: 1, rubble: 1, load: 1 },
  infantry: { mud: 1, forest: 1, wade: 0.75, trench: 1, rubble: 1, load: 1 },
  powerarmor: { mud: 0.82, forest: 0.8, wade: 1.05, trench: 0.9, rubble: 0.8, load: 1 },
  vehicle: { mud: 1.45, forest: 1.9, wade: 0.5, trench: 2.2, rubble: 1.1, load: 1 },
  dreadnought: { mud: 0.75, forest: 0.7, wade: 1.6, trench: 0.7, rubble: 0.6, load: 1 },
  beast: { mud: 0.9, forest: 0.7, wade: 0.9, trench: 0.9, rubble: 0.9, load: 1 }
};

export function unitClassFor(unit = {}) {
  if (unit.civilian) return "civilian";
  const name = String(unit.name || unit.unitClass || "").toLowerCase();
  if (name.includes("dread")) return "dreadnought";
  if (unit.role === "vehicle") return "vehicle";
  const faction = String(unit.factionName || unit.faction || "").toLowerCase();
  if (faction.includes("marine") || faction.includes("chaos") || name.includes("marine") || name.includes("terminator")) return "powerarmor";
  if (name.includes("beast") || name.includes("squig") || name.includes("hound")) return "beast";
  return "infantry";
}

/**
 * @param info    WorldLayers.surfaceInfo(x, y)
 * @param ground  height-field height at the same point
 * @param kind    one of UNIT_CLASSES
 * @param weather { rain } from the ecosystem (0..1)
 */
export function groundEffects(info, ground, kind = "infantry", weather = {}) {
  const p = PROFILE[kind] || PROFILE.infantry;
  const rain = weather.rain || 0;
  let speed = 1;
  let cover = 0;
  let detection = 1;
  let hazard = 0;
  let impassable = false;
  const notes = [];

  // Standing water.
  const depth = info.waterSurface > NO_WATER ? info.waterSurface - ground : 0;
  if (depth > 0.15) {
    const wadeLimit = (kind === "dreadnought" ? 2.4 : kind === "vehicle" ? 0.8 : kind === "powerarmor" ? 1.6 : 1.1);
    if (depth > wadeLimit) { speed *= 0.08; impassable = true; hazard += 0.5; notes.push("deep water"); }
    else { speed *= clamp(1 - (depth / wadeLimit) * 0.55 / p.wade, 0.25, 0.95); notes.push("wading"); }
    cover = Math.max(cover, 0);
  }

  // Mud: wet soil plus actual mud surface; rain makes both worse.
  const wet = clamp(info.moisture - 0.45, 0, 0.55) / 0.55;
  const mud = info.surface === SURFACE.MUD ? 1 : wet * 0.55;
  if (mud > 0.05 && depth <= 0.15) {
    speed *= clamp(1 - mud * 0.42 * p.mud * (1 + rain * 0.35), 0.28, 1);
    notes.push("mud");
  }

  // Woodland and crops.
  if (info.vegKind === VEGETATION.FOREST) {
    const density = clamp(info.vegetation, 0, 1);
    speed *= clamp(1 - density * 0.38 * p.forest, 0.3, 1);
    cover = Math.max(cover, 0.18 + density * 0.2);
    detection *= 1 - density * 0.4;
    notes.push("woodland");
  } else if (info.vegKind === VEGETATION.SHRUB) {
    speed *= clamp(1 - info.vegetation * 0.14 * p.forest, 0.6, 1);
    cover = Math.max(cover, 0.08 + info.vegetation * 0.08);
    detection *= 1 - info.vegetation * 0.18;
  } else if (info.vegKind === VEGETATION.GRASS) {
    detection *= 1 - info.vegetation * 0.06;
  } else if (info.vegKind === VEGETATION.CROP) {
    speed *= 0.92;
    cover = Math.max(cover, 0.05 + info.vegetation * 0.08);
    detection *= 0.9;
  }

  // Earthworks.
  switch (info.earthwork) {
    case EARTHWORK.TRENCH:
      if (kind === "vehicle" || kind === "dreadnought") { speed *= 1 / p.trench * 0.7; hazard += 0.1; notes.push("trench crossing"); }
      else { speed *= 0.82 * (kind === "civilian" ? 0.9 : 1) / p.trench; cover = Math.max(cover, 0.5); detection *= 0.7; notes.push("trench"); }
      break;
    case EARTHWORK.EMBANKMENT: cover = Math.max(cover, 0.24); speed *= 0.88; break;
    case EARTHWORK.PIT: cover = Math.max(cover, 0.28); speed *= 0.8 / (kind === "vehicle" ? p.trench : 1); notes.push("crater"); break;
    case EARTHWORK.FIELD: speed *= 0.95; break;
    default: break;
  }

  // Roads and paved ground help; ruined ground (low integrity) hinders.
  if (info.surface === SURFACE.ROAD) speed *= 1.18;
  else if (info.surface === SURFACE.CONCRETE) speed *= 1.1;
  else if (info.surface === SURFACE.SAND) speed *= clamp(0.9 / Math.sqrt(p.mud), 0.7, 0.95);
  else if (info.surface === SURFACE.STONE) speed *= 0.96;
  if (info.integrity < 0.5 && (info.surface === SURFACE.ROAD || info.surface === SURFACE.CONCRETE)) {
    speed *= clamp(0.55 + info.integrity * 0.9, 0.55, 1) * (1 / p.rubble) ** 0.3;
    cover = Math.max(cover, 0.14);
    notes.push("rubble");
  }

  // Fire.
  if (info.scorch > 0.8 && info.fire) { hazard += 0.6; speed *= 0.6; notes.push("burning"); }
  return {
    speed: clamp(speed, 0.05, 1.35), cover: clamp(cover, 0, 0.75), detection: clamp(detection, 0.25, 1.1),
    hazard, impassable, notes
  };
}

/** Weather applied to a whole map: visibility and a general mobility change. */
export function weatherEffects(weather = {}) {
  const rain = weather.rain || 0;
  return {
    visibility: clamp(1 - rain * 0.35 - (weather.cloud || 0) * 0.05, 0.4, 1),
    rangePenalty: 1 - rain * 0.12,
    smokeDecay: 1 + rain
  };
}
