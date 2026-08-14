const freeze = value => Object.freeze(value);
const list = values => freeze([...values]);
const normalize = value => String(value || "Ultramarines").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const CODEX_COMPANY_ROLES = list([
  "veteran", "battle", "battle", "battle", "battle",
  "reserve-battleline", "reserve-battleline", "reserve-assault", "reserve-fire-support", "scout"
]);

function codexProfile(chapter, doctrine, overrides = {}) {
  return freeze({
    chapter,
    organization: "Chapter",
    formationLabel: "Company",
    squadLabel: "Squad",
    companyCount: 10,
    squadsPerCompany: 10,
    marinesPerSquad: 10,
    companyRoles: CODEX_COMPANY_ROLES,
    bounded: true,
    maximumCoreMarines: 1000,
    vehicleBudgetRatio: 0.22,
    specialistRatio: freeze({ minimum: 0.08, target: 0.14, maximum: 0.24 }),
    doctrine: freeze(doctrine),
    forbiddenPatterns: list([]),
    capabilityAliases: freeze({}),
    ...overrides
  });
}

export const CHAPTER_FORCE_STRUCTURE_PROFILES = freeze({
  Ultramarines: codexProfile("Ultramarines", {
    preferred: list(["battleline", "command", "veteran", "transport", "tank"]),
    weapons: list(["bolt", "plasma", "precision"]),
    behaviors: list(["combined-arms", "reserve-response", "objective-flexibility"])
  }, { vehicleBudgetRatio: 0.24 }),
  "Blood Angels": codexProfile("Blood Angels", {
    preferred: list(["assault", "jump-pack", "veteran", "medical", "transport"]),
    weapons: list(["melee", "melta", "flame"]),
    behaviors: list(["rapid-assault", "decapitation", "controlled-aggression"])
  }, { specialistRatio: freeze({ minimum: 0.1, target: 0.18, maximum: 0.28 }) }),
  "Imperial Fists": codexProfile("Imperial Fists", {
    preferred: list(["battleline", "heavy-weapons", "terminator", "defense", "tank"]),
    weapons: list(["bolt", "heavy", "anti-armour"]),
    behaviors: list(["fortification", "siege", "hold-ground"])
  }, { vehicleBudgetRatio: 0.27 }),
  Salamanders: codexProfile("Salamanders", {
    preferred: list(["battleline", "medical", "engineer", "heavy", "transport"]),
    weapons: list(["flame", "melta", "close-range"]),
    behaviors: list(["civilian-preservation", "durable-advance", "mutual-support"])
  }, {
    companyCount: 7,
    squadsPerCompany: 12,
    maximumCoreMarines: 840,
    companyRoles: list(["veteran", "battle", "battle", "battle", "battle", "reserve", "scout"]),
    specialistRatio: freeze({ minimum: 0.1, target: 0.17, maximum: 0.27 })
  }),
  "Emerald Suns": codexProfile("Emerald Suns", {
    preferred: list(["ranged-support", "medical", "scout", "vehicle", "battleline"]),
    weapons: list(["long-range", "suppression", "plasma"]),
    behaviors: list(["controlled-escalation", "isolate", "preserve-gene-seed", "finish"])
  }, {
    companyCount: 8,
    squadsPerCompany: 12,
    maximumCoreMarines: 960,
    companyRoles: list(["veteran", "battle", "battle", "battle", "battle", "reserve-battleline", "reserve-fire-support", "scout"]),
    vehicleBudgetRatio: 0.26,
    specialistRatio: freeze({ minimum: 0.12, target: 0.2, maximum: 0.3 })
  }),
  "White Scars": codexProfile("White Scars", {
    preferred: list(["mobile-infantry", "fast-vehicle", "transport", "scout", "assault"]),
    weapons: list(["mobile", "melta", "assault"]),
    behaviors: list(["encirclement", "hit-and-run", "route-control"])
  }, { formationLabel: "Brotherhood", vehicleBudgetRatio: 0.34 }),
  "Raven Guard": codexProfile("Raven Guard", {
    preferred: list(["scout", "stealth", "precision-ranged", "jump-pack", "transport"]),
    weapons: list(["precision", "suppressed", "anti-command"]),
    behaviors: list(["infiltration", "ambush", "decapitation", "avoid-attrition"])
  }, { vehicleBudgetRatio: 0.18 }),
  "Iron Hands": codexProfile("Iron Hands", {
    preferred: list(["vehicle", "walker", "heavy", "engineer", "ranged-support"]),
    weapons: list(["heavy", "plasma", "anti-armour"]),
    behaviors: list(["armoured-pressure", "repair-cycle", "calculated-attrition"])
  }, { formationLabel: "Clan-Company", vehicleBudgetRatio: 0.42, specialistRatio: freeze({ minimum: 0.1, target: 0.18, maximum: 0.28 }) }),
  "Space Wolves": freeze({
    chapter: "Space Wolves",
    organization: "Great Company Host",
    formationLabel: "Great Company",
    squadLabel: "Pack",
    companyCount: 12,
    squadsPerCompany: 10,
    marinesPerSquad: 10,
    packSize: freeze({ minimum: 5, target: 10, maximum: 15 }),
    companyRoles: list(Array.from({ length: 12 }, () => "great-company")),
    bounded: true,
    maximumCoreMarines: 1200,
    vehicleBudgetRatio: 0.25,
    specialistRatio: freeze({ minimum: 0.1, target: 0.19, maximum: 0.3 }),
    doctrine: freeze({
      preferred: list(["assault", "scout", "veteran", "command", "transport"]),
      weapons: list(["melee", "melta", "bolt"]),
      behaviors: list(["priority-hunt", "counterattack", "pack-support"])
    }),
    forbiddenPatterns: list([]),
    capabilityAliases: freeze({
      "Wolf Guard": "Vanguard Veteran",
      "Wolf Priest": "Chaplain",
      "Rune Priest": "Librarian",
      "Iron Priest": "Techmarine",
      "Blood Claw": "Assault Marine",
      "Grey Hunter": "Tactical Marine",
      "Long Fang": "Devastator",
      "Wolf Lord": "Captain"
    })
  }),
  "Black Templars": freeze({
    chapter: "Black Templars",
    organization: "Crusade",
    formationLabel: "Fighting Company",
    squadLabel: "Crusader Squad",
    companyCount: null,
    squadsPerCompany: null,
    marinesPerSquad: 10,
    companyRoles: list(["crusade-veteran", "crusader", "crusader", "recon"]),
    bounded: false,
    maximumCoreMarines: null,
    vehicleBudgetRatio: 0.25,
    specialistRatio: freeze({ minimum: 0.12, target: 0.22, maximum: 0.32 }),
    doctrine: freeze({
      preferred: list(["assault", "battleline", "spiritual", "terminator", "transport"]),
      weapons: list(["melee", "melta", "bolt"]),
      behaviors: list(["relentless-advance", "close-assault", "vow-driven"])
    }),
    forbiddenPatterns: list(["librarian", "psyker", "psychic"]),
    capabilityAliases: freeze({ "Emperor's Champion": "Company Champion", "Sword Brethren": "Bladeguard Veteran" })
  })
});

const NORMALIZED_PROFILES = new Map(Object.entries(CHAPTER_FORCE_STRUCTURE_PROFILES).map(([name, profile]) => [normalize(name), profile]));

export function chapterForceStructureProfileFor(playerOrChapter = {}) {
  const chapter = typeof playerOrChapter === "string" ? playerOrChapter : playerOrChapter?.subfaction;
  return NORMALIZED_PROFILES.get(normalize(chapter)) || CHAPTER_FORCE_STRUCTURE_PROFILES.Ultramarines;
}

export function chapterCoreCapacity(profileOrChapter, { performanceLimit = Infinity, resourceLimit = Infinity } = {}) {
  const profile = typeof profileOrChapter === "object" && profileOrChapter?.chapter
    ? profileOrChapter : chapterForceStructureProfileFor(profileOrChapter);
  const organizationLimit = profile.bounded ? profile.maximumCoreMarines : Infinity;
  return Math.max(0, Math.floor(Math.min(organizationLimit, performanceLimit, resourceLimit)));
}

export function chapterCompanyRole(profileOrChapter, companyIndex = 0) {
  const profile = typeof profileOrChapter === "object" && profileOrChapter?.chapter
    ? profileOrChapter : chapterForceStructureProfileFor(profileOrChapter);
  return profile.companyRoles[Math.abs(Math.floor(companyIndex)) % profile.companyRoles.length];
}

export function createChapterForceRegistry(profileOrChapter, { performanceLimit = Infinity, resourceLimit = Infinity } = {}) {
  const profile = typeof profileOrChapter === "object" && profileOrChapter?.chapter
    ? profileOrChapter : chapterForceStructureProfileFor(profileOrChapter);
  return {
    version: 1,
    chapter: profile.chapter,
    organization: profile.organization,
    coreCapacity: chapterCoreCapacity(profile, { performanceLimit, resourceLimit }),
    companies: profile.companyCount == null ? [] : profile.companyRoles.map((role, index) => ({
      id: `${profile.chapter.replace(/\s+/g, "-").toLowerCase()}-${index + 1}`,
      index,
      label: `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} ${profile.formationLabel}`,
      role,
      squads: []
    })),
    assignments: {},
    missingCapabilities: []
  };
}

export function assignChapterSquad(registry, squad = {}, { size = 10 } = {}) {
  const profile = chapterForceStructureProfileFor(registry?.chapter);
  if (!registry || !squad?.id || registry.assignments[squad.id]) return registry?.assignments?.[squad.id] || null;
  const hint = String(squad.chapterRoleHint || squad.astartesSquadClass || "battleline").toLowerCase();
  const preferredRoles = hint.includes("terminator") || hint.includes("veteran") ? ["veteran", "crusade-veteran"]
    : hint.includes("recon") || hint.includes("scout") ? ["scout", "recon"]
      : hint.includes("assault") ? ["reserve-assault", "battle", "great-company", "crusader"]
        : hint.includes("fire") || hint.includes("heavy") ? ["reserve-fire-support", "battle", "great-company", "crusader"]
          : ["battle", "reserve-battleline", "great-company", "crusader"];
  let company = registry.companies.filter(row => preferredRoles.includes(row.role)
    && row.squads.length < (profile.squadsPerCompany || 12)).sort((left, right) => left.squads.length - right.squads.length || left.index - right.index)[0];
  if (!company) company = registry.companies.find(row => row.squads.length < (profile.squadsPerCompany || 12));
  if (!company) {
    if (profile.companyCount != null && registry.companies.length >= profile.companyCount) return null;
    const index = registry.companies.length;
    company = {
      id: `${profile.chapter.replace(/\s+/g, "-").toLowerCase()}-${index + 1}`,
      index,
      label: `${index + 1}${index === 0 ? "st" : index === 1 ? "nd" : index === 2 ? "rd" : "th"} ${profile.formationLabel}`,
      role: chapterCompanyRole(profile, index),
      squads: []
    };
    registry.companies.push(company);
  }
  const assignment = {
    companyId: company.id,
    companyIndex: company.index,
    companyRole: company.role,
    squadIndex: company.squads.length,
    squadLabel: `${profile.squadLabel} ${company.squads.length + 1}`,
    nominalSize: Math.max(profile.packSize?.minimum || 1, Math.min(profile.packSize?.maximum || profile.marinesPerSquad, size))
  };
  company.squads.push(squad.id);
  registry.assignments[squad.id] = assignment;
  return assignment;
}

export function capabilityNameForChapter(chapter, requestedName) {
  const profile = chapterForceStructureProfileFor(chapter);
  return profile.capabilityAliases[requestedName] || requestedName;
}

export function validateChapterCapability(chapter, requestedName, availableNames = []) {
  const resolved = capabilityNameForChapter(chapter, requestedName);
  const exact = availableNames.some(name => normalize(name) === normalize(requestedName));
  const fallback = availableNames.some(name => normalize(name) === normalize(resolved));
  return freeze({ found: exact || fallback, exact, fallback, requestedName, resolvedName: resolved,
    diagnostic: exact ? null : "MISSING_CHAPTER_CAPABILITY" });
}

export function chapterAllowsUnit(chapter, unitOrName = {}) {
  const profile = chapterForceStructureProfileFor(chapter);
  const text = normalize(typeof unitOrName === "string" ? unitOrName : `${unitOrName.name || ""} ${unitOrName.specialty || ""}`);
  return !profile.forbiddenPatterns.some(pattern => text.includes(normalize(pattern)));
}

export function runChapterCapacityTest(chapter, { performanceLimit = Infinity, resourceLimit = Infinity } = {}) {
  const profile = chapterForceStructureProfileFor(chapter);
  const capacity = chapterCoreCapacity(profile, { performanceLimit, resourceLimit });
  const registry = createChapterForceRegistry(profile, { performanceLimit, resourceLimit });
  const organizationCapacity = profile.bounded ? profile.maximumCoreMarines : capacity;
  const requestedSquads = Math.ceil(capacity / profile.marinesPerSquad);
  let assignedMarines = 0;
  for (let index = 0; index < requestedSquads; index += 1) {
    const remaining = capacity - assignedMarines;
    const size = Math.min(profile.marinesPerSquad, remaining);
    const roleCycle = ["veteran", "battleline", "battleline", "assault", "fire-support", "recon"];
    if (size <= 0 || !assignChapterSquad(registry, { id: `capacity-squad-${index + 1}`, chapterRoleHint: roleCycle[index % roleCycle.length] }, { size })) break;
    assignedMarines += size;
  }
  return freeze({
    chapter: profile.chapter,
    organization: profile.organization,
    organizationCapacity,
    effectiveCapacity: capacity,
    assignedMarines,
    companies: registry.companies.length,
    squads: Object.keys(registry.assignments).length,
    passed: assignedMarines === capacity && (!profile.bounded || capacity <= profile.maximumCoreMarines)
  });
}
