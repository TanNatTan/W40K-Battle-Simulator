const normalize = value => String(value || "").trim().toLowerCase();

const CHARACTER_PATTERNS = Object.freeze([
  /\bsergeant\b/, /\blieutenant\b/, /\bcaptain\b/, /chapter master/,
  /\bchaplain\b/, /\blibrarian\b/, /\bjudiciar\b/, /\bapothecary\b/,
  /\btechmarine\b/, /\bancient\b/, /company champion/
]);

const PROFILE_RULES = Object.freeze([
  { pattern: /assault terminator/, astartesClass: "terminator", specialty: "assault-terminator", tags: ["elite", "melee", "teleport", "storm-shield"], abilities: ["teleport-strike", "storm-shield"] },
  { pattern: /\bterminator\b/, astartesClass: "terminator", specialty: "terminator", tags: ["elite", "heavy-infantry", "teleport"], abilities: ["teleport-strike"] },
  { pattern: /sternguard/, astartesClass: "veteran", specialty: "sternguard", tags: ["elite", "ranged", "adaptive-ammunition"], abilities: ["special-issue-ammunition"] },
  { pattern: /vanguard veteran/, astartesClass: "veteran", specialty: "vanguard", tags: ["elite", "melee", "jump-pack"], abilities: ["veteran-jump-pack"] },
  { pattern: /bladeguard/, astartesClass: "veteran", specialty: "bladeguard", tags: ["elite", "melee", "shield"], abilities: ["shield-wall"] },
  { pattern: /devastator/, astartesClass: "fire-support", specialty: "devastator", tags: ["heavy-weapon", "long-range", "suppression"], abilities: ["heavy-bolter-discipline"] },
  { pattern: /hellblaster/, astartesClass: "fire-support", specialty: "hellblaster", tags: ["plasma", "anti-elite", "anti-vehicle"], abilities: ["plasma-overcharge"] },
  { pattern: /eradicator/, astartesClass: "fire-support", specialty: "eradicator", tags: ["melta", "anti-vehicle"], abilities: ["melta-focus"] },
  { pattern: /jump pack intercessor|assault marine/, astartesClass: "assault", specialty: "jump-assault", tags: ["melee", "mobile", "jump-pack"], abilities: ["jump-pack"] },
  { pattern: /assault intercessor/, astartesClass: "assault", specialty: "assault-intercessor", tags: ["melee", "line-infantry"], abilities: ["shock-assault"] },
  { pattern: /heavy intercessor/, astartesClass: "battleline", specialty: "heavy-intercessor", tags: ["line-infantry", "durable", "ranged"], abilities: [] },
  { pattern: /tactical marine|\bintercessor\b/, astartesClass: "battleline", specialty: "battleline", tags: ["line-infantry", "ranged"], abilities: [] },
  { pattern: /eliminator/, astartesClass: "recon", specialty: "eliminator", tags: ["recon", "stealth", "precision"], abilities: ["priority-shot"] },
  { pattern: /infiltrator/, astartesClass: "recon", specialty: "infiltrator", tags: ["recon", "stealth", "screening"], abilities: [] },
  { pattern: /\breiver\b/, astartesClass: "recon", specialty: "reiver", tags: ["recon", "terror", "melee"], abilities: [] },
  { pattern: /scout marine/, astartesClass: "recon", specialty: "scout", tags: ["recon", "capture"], abilities: [] },
  { pattern: /skull probe|servo.?skull/, astartesClass: "drone", specialty: "skull-probe", tags: ["recon", "capture", "drone"], abilities: [] },
  { pattern: /\bchaplain\b/, astartesClass: "character", specialty: "chaplain", tags: ["character", "spiritual", "melee"], abilities: ["litany-of-battle"] },
  { pattern: /\bapothecary\b/, astartesClass: "character", specialty: "apothecary", tags: ["character", "medical", "gene-seed"], abilities: ["gene-seed-recovery"] },
  { pattern: /\btechmarine\b/, astartesClass: "character", specialty: "techmarine", tags: ["character", "technical", "repair"], abilities: ["battlefield-repair", "machine-blessing"] },
  { pattern: /\blibrarian\b/, astartesClass: "character", specialty: "librarian", tags: ["character", "psychic", "support"], abilities: ["psychic-barrier", "smite"] },
  { pattern: /\bjudiciar\b/, astartesClass: "character", specialty: "judiciar", tags: ["character", "judicial", "melee"], abilities: ["tempormortis"] },
  { pattern: /chapter master/, astartesClass: "character", specialty: "chapter-master", tags: ["character", "command", "exceptional"], abilities: ["iron-halo", "supreme-command"] },
  { pattern: /\bcaptain\b/, astartesClass: "character", specialty: "captain", tags: ["character", "command"], abilities: ["iron-halo", "rites-of-battle"] },
  { pattern: /\blieutenant\b/, astartesClass: "character", specialty: "lieutenant", tags: ["character", "command"], abilities: ["tactical-coordination"] },
  { pattern: /\bsergeant\b/, astartesClass: "character", specialty: "sergeant", tags: ["character", "command"], abilities: ["squad-command"] },
  { pattern: /\bancient\b/, astartesClass: "character", specialty: "ancient", tags: ["character", "support", "banner"], abilities: ["astartes-banner"] },
  { pattern: /company champion/, astartesClass: "character", specialty: "company-champion", tags: ["character", "duelist", "bodyguard"], abilities: ["honour-guard"] }
]);

export const SPACE_MARINE_ROSTER = Object.freeze({
  battleline: Object.freeze(["Tactical Marine", "Intercessor", "Heavy Intercessor"]),
  assault: Object.freeze(["Assault Intercessor", "Assault Marine", "Jump Pack Intercessor"]),
  fireSupport: Object.freeze(["Devastator", "Hellblaster", "Eradicator"]),
  recon: Object.freeze(["Scout Marine", "Infiltrator", "Eliminator", "Reiver", "Skull Probe"]),
  veterans: Object.freeze(["Sternguard Veteran", "Vanguard Veteran", "Bladeguard Veteran"]),
  terminators: Object.freeze(["Terminator", "Assault Terminator"]),
  specialists: Object.freeze(["Apothecary", "Techmarine", "Chaplain", "Librarian", "Judiciar", "Ancient", "Company Champion"]),
  command: Object.freeze(["Sergeant", "Lieutenant", "Captain", "Chapter Master"])
});

export function spaceMarineCommandRequirements(marineInfantry = 0) {
  const count = Math.max(0, Math.floor(Number(marineInfantry) || 0));
  return Object.freeze({
    Sergeant: Math.floor(count / 10),
    Lieutenant: count >= 20 ? Math.max(1, Math.floor(count / 40)) : 0,
    Captain: count >= 30 ? 1 : 0,
    Chaplain: count >= 40 ? 1 : 0,
    Apothecary: count >= 40 ? 1 : 0,
    Techmarine: count >= 50 ? 1 : 0,
    Librarian: count >= 60 ? 1 : 0,
    Judiciar: count >= 70 ? 1 : 0,
    Ancient: count >= 80 ? 1 : 0,
    "Company Champion": count >= 90 ? 1 : 0
  });
}

export function spaceMarineProfileFor(unitOrName = {}) {
  const primary = normalize(typeof unitOrName === "string" ? unitOrName : unitOrName.specialty || unitOrName.name || "");
  const fallback = normalize(typeof unitOrName === "string" ? "" : unitOrName.name || "");
  const match = PROFILE_RULES.find(rule => rule.pattern.test(primary)) || PROFILE_RULES.find(rule => rule.pattern.test(fallback));
  if (match) return Object.freeze({ ...match, tags: Object.freeze([...match.tags]), abilities: Object.freeze([...match.abilities]) });
  return Object.freeze({ astartesClass: "battleline", specialty: "battleline", tags: Object.freeze(["line-infantry"]), abilities: Object.freeze([]) });
}

export function isSpaceMarineCharacter(unitOrName = {}) {
  const text = normalize(typeof unitOrName === "string" ? unitOrName : unitOrName.specialty || unitOrName.name || "");
  return CHARACTER_PATTERNS.some(pattern => pattern.test(text)) || spaceMarineProfileFor(unitOrName).astartesClass === "character";
}

export function astartesSquadClassFor(unitOrName = {}) {
  const profile = spaceMarineProfileFor(unitOrName);
  if (profile.astartesClass === "terminator") return "terminator";
  if (profile.astartesClass === "veteran") return "veteran";
  if (profile.astartesClass === "recon") return "recon";
  if (["battleline", "assault", "fire-support"].includes(profile.astartesClass)) return "line";
  return null;
}

export function astartesSquadCapacityFor(unitOrName = {}) {
  const squadClass = astartesSquadClassFor(unitOrName);
  return squadClass === "terminator" ? 5 : squadClass ? 10 : 0;
}

export function isAstartesCoreMember(unit = {}) {
  return Boolean(astartesSquadClassFor(unit)) && !isSpaceMarineCharacter(unit) && !/skull probe|servo.?skull/i.test(`${unit.specialty || ""} ${unit.name || ""}`);
}

export function configureSpaceMarineUnit(unit, specialty = unit?.specialty || unit?.name) {
  if (!unit) return unit;
  unit.specialty = specialty;
  if (["vehicle", "builder", "supply"].includes(unit.role)) {
    unit.astartesClass = unit.role;
    unit.specialtyClass = unit.role;
    unit.combatTags = [...new Set([...(unit.combatTags || []), unit.role])];
    unit.abilities ||= [];
    unit.astartesCharacter = false;
    unit.geneSeedBearing = false;
    unit.astartesConfigured = true;
    return unit;
  }
  const profile = spaceMarineProfileFor(specialty);
  unit.astartesClass = profile.astartesClass;
  unit.specialtyClass = profile.specialty;
  unit.combatTags = [...new Set([...(unit.combatTags || []), ...profile.tags])];
  unit.abilities = [...new Set([...(unit.abilities || []), ...profile.abilities])];
  unit.astartesCharacter = isSpaceMarineCharacter(specialty);
  unit.geneSeedBearing = isAstartesCoreMember({ ...unit, specialty });
  if (unit.astartesConfigured) return unit;
  unit.astartesConfigured = true;
  unit.cohesionMode ||= "DISTRIBUTED";
  if (profile.specialty === "devastator") {
    unit.range *= 1.5;
    unit.speed *= 0.75;
    unit.attackRateMultiplier = 1.75;
    unit.suppressionOutputMultiplier = 1.35;
  } else if (profile.astartesClass === "terminator") {
    unit.maxHp *= 1.65;
    unit.hp = unit.maxHp;
    unit.armorProtection += 7;
    unit.speed *= 0.72;
    unit.suppressionResistance = Math.min(1, unit.suppressionResistance + 0.3);
    if (profile.specialty === "assault-terminator") unit.frontalDamageReduction = 0.35;
  } else if (profile.specialty === "heavy-intercessor") {
    unit.maxHp *= 1.22;
    unit.hp = unit.maxHp;
    unit.armorProtection += 2;
    unit.speed *= 0.9;
  } else if (profile.astartesClass === "veteran") {
    unit.maxHp *= 1.16;
    unit.hp = unit.maxHp;
    unit.accuracy = Math.min(0.98, unit.accuracy + 0.07);
    unit.precision = Math.min(0.98, unit.precision + 0.07);
  }
  if (unit.astartesCharacter) {
    unit.maxHp *= 1.2;
    unit.hp = unit.maxHp;
    unit.armorProtection += 2;
  }
  return unit;
}

export function reinforcementWaveSize({ sequence = 0, missing = 10, squadClass = "line" } = {}) {
  const normalWave = squadClass === "terminator" ? 3 : 3 + Math.abs(sequence % 2);
  return Math.max(0, Math.min(missing, normalWave));
}

export function selectIncompleteAstartesSquad(squads = [], units = [], candidate = {}) {
  const squadClass = astartesSquadClassFor(candidate);
  const capacity = astartesSquadCapacityFor(candidate);
  if (!squadClass || !capacity) return null;
  const living = new Map();
  for (const unit of units) {
    if (unit.alive === false || unit.incapacitated || !unit.squadId || !isAstartesCoreMember(unit)) continue;
    living.set(unit.squadId, (living.get(unit.squadId) || 0) + 1);
  }
  return squads
    .filter(squad => squad.astartesSquadClass === squadClass && (living.get(squad.id) || 0) < (squad.nominalSize || capacity))
    .sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0))[0] || null;
}

export function synchronizeAstartesSquad(squad, units = []) {
  if (!squad) return squad;
  squad.coreMemberIds = units.filter(unit => unit.alive !== false && unit.squadId === squad.id && isAstartesCoreMember(unit)).map(unit => unit.id);
  squad.attachedCharacterIds = [...new Set((squad.attachedCharacterIds || []).filter(id => units.some(unit => unit.id === id && unit.alive !== false && unit.attachedSquadId === squad.id)))];
  squad.cohesionMode ||= "DISTRIBUTED";
  squad.formationActive ??= false;
  if (squad.chapterOrganization) for (const unit of units) {
    if (unit.alive !== false && (unit.squadId === squad.id || unit.attachedSquadId === squad.id)) unit.chapterOrganization = { ...squad.chapterOrganization };
  }
  return squad;
}
