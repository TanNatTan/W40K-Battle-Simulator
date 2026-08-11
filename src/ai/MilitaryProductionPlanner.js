import { subfactionProductionPlanFor } from "./SubfactionProductionPlans.js";

const normalize = value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

const TOKEN_PATTERNS = Object.freeze({
  battleline: /tactical|intercessor|guardsman|shock|fire warrior|warrior|chaos space marine|slugga|termagant|skitarii/i,
  "line-infantry": /guardsman|shock|warrior|fire warrior|marine/i,
  "mobile-infantry": /scion|breacher|assault|raptor|praetorian|ravener|gargoyle/i,
  "mobile-battleline": /scion|breacher|assault|raptor/i,
  assault: /assault|slugga|flayed|lychguard|hormagaunt|genestealer|chosen|warp talon|battlesuit/i,
  "assault-infantry": /assault|slugga|flayed|hormagaunt|genestealer|chosen/i,
  "anti-armour": /hellblaster|tankbusta|broadside|havoc|melta|lascannon/i,
  "ranged-support": /hellblaster|eliminator|havoc|shoota|broadside|immortal|exocrine/i,
  "precision-ranged": /eliminator|deathmark|ratling|pathfinder/i,
  "heavy-weapons": /hellblaster|havoc|tankbusta|broadside|heavy/i,
  scout: /scout|infiltrator|eliminator|ratling|sentinel|kommando|deathmark|pathfinder|stealth|gargoyle|ravener|raptor/i,
  stealth: /infiltrator|eliminator|ratling|kommando|deathmark|stealth|lictor/i,
  command: /sergeant|officer|captain|lieutenant|lord|overlord|warden|nob|fireblade|commander|prime|tyrant|champion/i,
  support: /medic|apothecary|painboy|drone|engineer|techmarine|warpsmith|cryptek|technomancer|ripper/i,
  engineer: /engineer|techmarine|warpsmith|cryptek|mek|repair drone|ripper/i,
  transport: /rhino|chimera|devilfish|ghost ark|trukk|battlewagon|carrier|transport/i,
  "light-transport": /rhino|chimera|devilfish|trukk/i,
  walker: /dreadnought|sentinel|defiler|deff dread|killa kan|canoptek/i,
  "light-walker": /sentinel|killa kan/i,
  tank: /predator|land raider|leman russ|rogal dorn|hammerhead|doomsday|annihilation|monolith|battlewagon/i,
  "heavy-tank": /land raider|rogal dorn|monolith/i,
  "fast-vehicle": /piranha|venomcrawler|trukk/i,
  "fast-skimmer": /piranha|annihilation barge/i,
  "fast-attack": /piranha|venomcrawler|trukk|ravener/i,
  artillery: /exocrine|doomsday|defiler/i,
  heavy: /land raider|rogal dorn|monolith|tyrannofex|carnifex|forgefiend|broadside|dreadnought/i,
  "heavy-command": /land raider|rogal dorn|monolith/i,
  "repair-support": /techmarine|engineer|warpsmith|cryptek|technomancer|mek|repair drone|ripper/i,
  battlesuit: /battlesuit|broadside/i,
  breacher: /breacher/i,
  pathfinder: /pathfinder/i,
  immortal: /immortal/i,
  warrior: /warrior/i,
  lychguard: /lychguard/i,
  "flayed-one": /flayed one/i,
  deathmark: /deathmark/i,
  triarch: /triarch/i,
  canoptek: /canoptek/i,
  "slugga-boy": /slugga/i,
  "shoota-boy": /shoota/i,
  tankbusta: /tankbusta/i,
  kommando: /kommando/i,
  gretchin: /gretchin/i,
  nob: /nob/i,
  cultist: /cultist/i,
  "chaos-marine": /chaos space marine/i,
  havoc: /havoc/i,
  chosen: /chosen/i,
  raptor: /raptor/i,
  "warp-talon": /warp talon/i,
  termagant: /termagant/i,
  hormagaunt: /hormagaunt/i,
  genestealer: /genestealer/i,
  gargoyle: /gargoyle/i,
  ravener: /ravener/i,
  carnifex: /carnifex/i,
  trygon: /trygon/i,
  exocrine: /exocrine/i,
  tyrannofex: /tyrannofex/i
});

export function productionTagsFor(member = {}) {
  const tags = new Set([member.role]);
  for (const [token, pattern] of Object.entries(TOKEN_PATTERNS)) if (pattern.test(member.name || "")) tags.add(token);
  if (member.role === "vehicle") tags.add("vehicle");
  if (member.role === "medic" || member.role === "engineer") tags.add("support");
  return Object.freeze([...tags]);
}

export function producerTypesForProduction(member = {}) {
  if (member.role === "vehicle") return /thunderhawk|stormraven|stormtalon|stormhawk|heldrake|dakkajet|doom scythe|night scythe|barracuda|tyrannocyte/i.test(member.name || "")
    ? Object.freeze(["dropbay", "workshop"]) : Object.freeze(["workshop"]);
  if (member.role === "medic") return Object.freeze(["fieldhospital", "barracks"]);
  if (member.role === "engineer") return Object.freeze(["workshop", "fieldhospital", "barracks"]);
  if (member.role === "scout") return Object.freeze(["observationtower", "barracks"]);
  if (["commander", "standard"].includes(member.role)) return Object.freeze(["researchcenter", "barracks"]);
  return Object.freeze(["barracks"]);
}

function rosterMembers(roster = {}) {
  return ["trooper", "scout", "medic", "engineer", "commander", "standard", "vehicle"].flatMap(role =>
    (roster[role] || []).map(name => Object.freeze({ name, role })));
}

export function scoreProductionCandidate(member, { plan, demand = {}, ownUnits = [], availableProducerTypes = [] } = {}) {
  const tags = productionTagsFor(member);
  const priorities = member.role === "vehicle" ? plan?.vehiclePriority || [] : plan?.unitPriority || [];
  let doctrine = 12;
  for (let index = 0; index < priorities.length; index += 1) if (tags.includes(priorities[index])) doctrine = Math.max(doctrine, 92 - index * 11);
  const battlefield = tags.reduce((maximum, tag) => Math.max(maximum, Number(demand.tokenScores?.[tag]) || 0), 0);
  const sameName = ownUnits.filter(unit => unit?.alive !== false && normalize(unit.specialty || unit.name).includes(normalize(member.name))).length;
  const sameRole = ownUnits.filter(unit => unit?.alive !== false && unit.role === member.role).length;
  const oversaturation = sameName * 14 + Math.max(0, sameRole - Math.max(2, ownUnits.length * 0.32)) * 3;
  const producers = producerTypesForProduction(member);
  const facilityAvailable = !availableProducerTypes.length || producers.some(type => availableProducerTypes.includes(type));
  return Object.freeze({ member, tags, producerTypes: producers, facilityAvailable,
    score: doctrine + battlefield - oversaturation - (facilityAvailable ? 0 : 160), doctrine, battlefield, oversaturation });
}

export function chooseMilitaryProduction({ player = {}, roster = {}, demand = {}, ownUnits = [], availableProducerTypes = [], sequence = 0 } = {}) {
  const plan = subfactionProductionPlanFor(player);
  const ranked = rosterMembers(roster).map(member => scoreProductionCandidate(member, { plan, demand, ownUnits, availableProducerTypes }))
    .filter(candidate => candidate.facilityAvailable)
    .sort((a, b) => b.score - a.score || String(a.member.name).localeCompare(String(b.member.name)));
  if (!ranked.length) return null;
  const competitive = ranked.filter(candidate => candidate.score >= ranked[0].score - 7);
  const selected = competitive[Math.abs(Math.floor(Number(sequence) || 0)) % competitive.length];
  return Object.freeze({ ...selected.member, producerTypes: selected.producerTypes, productionPlan: plan?.name || player.subfaction || "Default",
    productionStyle: plan?.productionStyle || "adaptive", score: selected.score, scoreBreakdown: Object.freeze({ doctrine: selected.doctrine,
      battlefield: selected.battlefield, oversaturation: selected.oversaturation }) });
}

