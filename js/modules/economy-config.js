const modules = globalThis.AWTModules ||= {};

export const economyConfig = Object.freeze({
    resources: [
      "requisition",
      "materials",
      "fuel",
      "energy",
      "ammunition",
      "medical",
      "food",
      "faith",
      "influence",
      "scrap",
      "biomass",
      "parts"
    ],
    startingStockpile: Object.freeze({
      requisition: 600,
      materials: 450,
      fuel: 300,
      energy: 320,
      ammunition: 420,
      medical: 220,
      food: 360,
      faith: 90,
      influence: 180,
      scrap: 80,
      biomass: 80,
      parts: 240
    }),
    baseCapacity: Object.freeze({
      requisition: 800,
      materials: 620,
      fuel: 460,
      energy: 480,
      ammunition: 650,
      medical: 360,
      food: 520,
      faith: 280,
      influence: 320,
      scrap: 420,
      biomass: 420,
      parts: 420
    }),
    shortageThreshold: 0.16,
    storageSalvageRate: 0.25
});

modules.economy = economyConfig;
export default economyConfig;
