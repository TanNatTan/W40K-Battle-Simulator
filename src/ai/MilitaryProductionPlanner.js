import { subfactionProductionPlanFor } from "./SubfactionProductionPlans.js";
import { chapterAllowsUnit, chapterForceStructureProfileFor } from "./space-marines/ChapterForceStructureProfile.js";

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
  veteran: /sternguard|vanguard veteran|bladeguard/i,
  terminator: /terminator/i,
  spiritual: /chaplain/i,
  medical: /apothecary|medic|painboy|medical drone/i,
  psychic: /librarian|psyker|sorcerer|weirdboy/i,
  judicial: /judiciar/i,
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

function summarizeProductionRoster(ownUnits = []) {
  const living = ownUnits.filter(unit => unit?.alive !== false);
  const normalizedNames = living.map(unit => normalize(unit.specialty || unit.name));
  const roleCounts = living.reduce((counts, unit) => {
    counts[unit.role] = (counts[unit.role] || 0) + 1;
    return counts;
  }, {});
  const marineInfantry = living.filter(unit => unit.role !== "vehicle"
    && !["builder", "supply"].includes(unit.role) && !/skull probe|servo.?skull/i.test(`${unit.specialty || ""} ${unit.name || ""}`)).length;
  const combatInfantry = living.filter(unit => !["builder", "supply", "vehicle"].includes(unit.role)).length;
  const livingSpecialists = living.filter(unit => productionTagsFor({ name: unit.specialty || unit.name, role: unit.role })
    .some(tag => ["medical", "engineer", "spiritual", "psychic", "judicial", "support", "command", "veteran", "terminator"].includes(tag))).length;
  const livingVehicles = roleCounts.vehicle || 0;
  const livingCombat = living.filter(unit => !["builder", "supply"].includes(unit.role)).length;
  return Object.freeze({ living, normalizedNames, roleCounts, marineInfantry, combatInfantry, livingSpecialists, livingVehicles, livingCombat });
}

export function scoreProductionCandidate(member, { player = {}, plan, demand = {}, ownUnits = [], availableProducerTypes = [], rosterSummary = null } = {}) {
  const summary = rosterSummary || summarizeProductionRoster(ownUnits);
  const tags = productionTagsFor(member);
  const priorities = member.role === "vehicle" ? plan?.vehiclePriority || [] : plan?.unitPriority || [];
  let doctrine = 12;
  for (let index = 0; index < priorities.length; index += 1) if (tags.includes(priorities[index])) doctrine = Math.max(doctrine, 92 - index * 11);
  const battlefield = tags.reduce((maximum, tag) => Math.max(maximum, Number(demand.tokenScores?.[tag]) || 0), 0);
  const normalizedMemberName = normalize(member.name);
  const sameName = summary.normalizedNames.filter(name => name.includes(normalizedMemberName)).length;
  const sameRole = summary.roleCounts[member.role] || 0;
  const oversaturation = sameName * 14 + Math.max(0, sameRole - Math.max(2, summary.living.length * 0.32)) * 3;
  const producers = producerTypesForProduction(member);
  const facilityAvailable = !availableProducerTypes.length || producers.some(type => availableProducerTypes.includes(type));
  const captureSpecialist = /scout marine|skull probe/i.test(member.name || "");
  const sameCaptureSpecialist = sameName;
  // Scouts and probes are complementary. A Scout Marine batch must not make
  // the planner believe that it has also fulfilled the Skull Probe need.
  const captureSupport = player.faction === "Space Marines" && captureSpecialist && sameCaptureSpecialist < 2
    ? /skull probe/i.test(member.name || "") && sameCaptureSpecialist === 0 ? 800 : 92 - sameCaptureSpecialist * 40 : 0;
  const marineInfantry = summary.marineInfantry;
  const marineInfantryFloor = Math.min(120, Math.max(20, Math.floor((Number(player.forceState?.reinforcementCapacity) || 36) * 0.6)));
  const lineGrowth = player.faction === "Space Marines" && marineInfantry < marineInfantryFloor
    ? member.role === "trooper" || /scout marine/i.test(member.name || "")
      ? 260 + Math.min(220, (marineInfantryFloor - marineInfantry) * 3.5)
      : member.role === "vehicle" ? marineInfantry < 30 ? -300 : 0 : -80
    : 0;
  const marineSpecialist = player.faction === "Space Marines" && marineInfantry >= 18 && sameName === 0
    ? /apothecary|techmarine|chaplain|librarian|judiciar|ancient|company champion/i.test(member.name || "") ? 135
      : /sternguard|vanguard veteran|bladeguard/i.test(member.name || "") && marineInfantry >= 24 ? 105
        : /terminator/i.test(member.name || "") && marineInfantry >= 30 ? 115 : 0
    : 0;
  const characterCap = /chapter master/i.test(member.name || "") ? 1
    : /captain|chaplain|librarian|judiciar|apothecary|techmarine|ancient|company champion/i.test(member.name || "") ? 2
      : /lieutenant/i.test(member.name || "") ? 3 : Infinity;
  const cappedCharacter = sameName >= characterCap ? 900 : 0;
  const chapterProfile = player.faction === "Space Marines" ? chapterForceStructureProfileFor(player) : null;
  const chapterPreferred = chapterProfile?.doctrine?.preferred || [];
  const chapterDoctrine = chapterPreferred.reduce((score, token, index) => tags.includes(token)
    ? Math.max(score, 64 - index * 7) : score, 0);
  const chapterForbidden = chapterProfile && !chapterAllowsUnit(chapterProfile.chapter, member) ? 5000 : 0;
  const specialistCandidate = tags.some(tag => ["medical", "engineer", "spiritual", "psychic", "judicial", "support", "command", "veteran", "terminator"].includes(tag));
  const specialistRatio = summary.livingSpecialists / Math.max(1, summary.combatInfantry);
  const specialistBattlefieldNeed = tags.reduce((score, tag) => Math.max(score, Number(demand.tokenScores?.[tag]) || 0), 0);
  const specialistDoctrine = chapterProfile && specialistCandidate
    ? Math.max(0, chapterProfile.specialistRatio.target - specialistRatio) * 260 + specialistBattlefieldNeed * 0.6 : 0;
  const vehicleRatio = summary.livingVehicles / Math.max(1, summary.livingCombat);
  const vehicleBudget = chapterProfile && member.role === "vehicle"
    ? vehicleRatio < chapterProfile.vehicleBudgetRatio ? 48 + (chapterProfile.vehicleBudgetRatio - vehicleRatio) * 180 : -35 : 0;
  const mobilizationVehicleBudget = member.role === "vehicle" && summary.livingCombat >= 24 && summary.livingVehicles < 4
    ? 360 + (4 - summary.livingVehicles) * 45 : 0;
  return Object.freeze({ member, tags, producerTypes: producers, facilityAvailable,
    score: doctrine + battlefield + captureSupport + lineGrowth + marineSpecialist + chapterDoctrine + specialistDoctrine + vehicleBudget + mobilizationVehicleBudget
      - chapterForbidden - cappedCharacter - oversaturation - (facilityAvailable ? 0 : 160),
    doctrine, battlefield, captureSupport, lineGrowth, marineSpecialist, chapterDoctrine, specialistDoctrine, vehicleBudget, mobilizationVehicleBudget,
    chapterForbidden, cappedCharacter, oversaturation });
}

export function chooseMilitaryProduction({ player = {}, roster = {}, demand = {}, ownUnits = [], availableProducerTypes = [], sequence = 0 } = {}) {
  const plan = subfactionProductionPlanFor(player);
  const rosterSummary = summarizeProductionRoster(ownUnits);
  const ranked = rosterMembers(roster).map(member => scoreProductionCandidate(member, { player, plan, demand, ownUnits, availableProducerTypes, rosterSummary }))
    .filter(candidate => candidate.facilityAvailable)
    .sort((a, b) => b.score - a.score || String(a.member.name).localeCompare(String(b.member.name)));
  if (!ranked.length) return null;
  const competitive = ranked.filter(candidate => candidate.score >= ranked[0].score - 7);
  const selected = competitive[Math.abs(Math.floor(Number(sequence) || 0)) % competitive.length];
  return Object.freeze({ ...selected.member, producerTypes: selected.producerTypes, productionPlan: plan?.name || player.subfaction || "Default",
    productionStyle: plan?.productionStyle || "adaptive", score: selected.score, scoreBreakdown: Object.freeze({ doctrine: selected.doctrine,
      battlefield: selected.battlefield, captureSupport: selected.captureSupport, lineGrowth: selected.lineGrowth,
      marineSpecialist: selected.marineSpecialist, chapterDoctrine: selected.chapterDoctrine, specialistDoctrine: selected.specialistDoctrine, vehicleBudget: selected.vehicleBudget,
      mobilizationVehicleBudget: selected.mobilizationVehicleBudget,
      chapterForbidden: selected.chapterForbidden, cappedCharacter: selected.cappedCharacter, oversaturation: selected.oversaturation }) });
}
