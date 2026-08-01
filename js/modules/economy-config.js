(() => {
  const modules = window.AWTModules ||= {};

  modules.economy = Object.freeze({
    resources: [
      "requisition",
      "materials",
      "fuel",
      "energy",
      "ammunition",
      "medical",
      "food",
      "influence",
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
      influence: 180,
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
      influence: 320,
      parts: 420
    }),
    shortageThreshold: 0.16,
    storageSalvageRate: 0.25
  });
})();

