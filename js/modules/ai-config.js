const modules = globalThis.AWTModules ||= {};

export const aiConfig = Object.freeze({
    behaviorPresets: Object.freeze({
      balanced: Object.freeze({ aggression: 50, caution: 50, expansion: 50, economy: 50 }),
      offensive: Object.freeze({ aggression: 85, caution: 25, expansion: 60, economy: 35 }),
      defensive: Object.freeze({ aggression: 25, caution: 85, expansion: 25, economy: 55 }),
      expansion: Object.freeze({ aggression: 55, caution: 40, expansion: 90, economy: 65 }),
      economic: Object.freeze({ aggression: 30, caution: 65, expansion: 55, economy: 90 })
    }),
    relationshipBands: [
      { min: 70, label: "Strong bond" },
      { min: 30, label: "Friendly" },
      { min: 10, label: "Familiar" },
      { min: -9, label: "Neutral" },
      { min: -29, label: "Not close" },
      { min: -69, label: "Disliked" },
      { min: -100, label: "Hated but tolerated" }
    ],
    relationshipEvents: Object.freeze({
      foughtTogether: 3,
      protectedBuilder: 7,
      savedFromDanger: 12,
      repairedAlly: 8,
      sharedSupplies: 5,
      successfulOrder: 3,
      completedTogether: 6,
      abandoned: -7,
      ignoredEscort: -4,
      exposedAlly: -6,
      rivalry: -5,
      friendlyCasualty: -12,
      enemyHarm: -9,
      enemyKill: -16
    }),
    formations: Object.freeze(["line", "column", "wedge", "triangle", "circle", "staggered", "flanking", "escort"]),
    routeOrders: Object.freeze(["Hold Route", "Block Route", "Patrol Route", "Observe Route", "Escort Route", "Keep Route Open", "Delay Enemy", "Destroy Route if Overrun", "Ambush Route"]),
    guardTemplates: Object.freeze({
      standard: {
        label: "Infantry Squad",
        costMultiplier: 1,
        members: [
          { role: "commander", title: "Sergeant", weapon: "Las pistol and chainsword" },
          { role: "trooper", title: "Guardsman", count: 6, weapon: "Lasgun" },
          { role: "trooper", title: "Grenadier", weapon: "Grenade launcher" },
          { role: "standard", title: "Vox Operator", weapon: "Lasgun", attachment: "Vox caster" },
          { role: "trooper", title: "Heavy Weapon Gunner", weapon: "Heavy bolter", attachment: "Heavy weapon team" }
        ]
      },
      heavy: {
        label: "Heavy Weapons Squad",
        costMultiplier: 1.22,
        members: [
          { role: "commander", title: "Heavy Weapons Sergeant", weapon: "Lasgun" },
          { role: "trooper", title: "Heavy Weapon Gunner", count: 3, weapon: "Autocannon", attachment: "Heavy weapon team" },
          { role: "trooper", title: "Loader", count: 2, weapon: "Lasgun", attachment: "Ammunition carrier" }
        ]
      },
      command: {
        label: "Command Squad",
        costMultiplier: 1.35,
        members: [
          { role: "commander", title: "Officer", weapon: "Bolt pistol" },
          { role: "standard", title: "Vox Operator", weapon: "Lasgun", attachment: "Vox caster" },
          { role: "medic", title: "Field Medic", weapon: "Lasgun", attachment: "Medic pack" },
          { role: "standard", title: "Regimental Standard Bearer", weapon: "Las pistol", attachment: "Regimental standard" },
          { role: "trooper", title: "Special Weapon Guardsman", weapon: "Plasma gun" }
        ]
      },
      veteran: {
        label: "Veteran Squad",
        costMultiplier: 1.42,
        members: [
          { role: "commander", title: "Veteran Sergeant", weapon: "Bolt pistol" },
          { role: "trooper", title: "Veteran Guardsman", count: 5, weapon: "Lasgun" },
          { role: "scout", title: "Marksman", weapon: "Long-las" },
          { role: "trooper", title: "Special Weapon Veteran", weapon: "Meltagun" }
        ]
      },
      conscript: {
        label: "Conscript Squad",
        costMultiplier: 0.62,
        members: [
          { role: "commander", title: "Conscript Overseer", weapon: "Las pistol" },
          { role: "trooper", title: "Conscript", count: 11, weapon: "Lasgun" }
        ]
      }
    })
});

modules.ai = aiConfig;
export default aiConfig;
