const modules = globalThis.AWTModules ||= {};

const profiles = {
    sapling: { family: "tree", movement: "soft", trunk: 2.5, canopy: 10, cover: "light", destructible: true, crushable: true },
    smalltree: { family: "tree", movement: "circle", trunk: 4, canopy: 15, cover: "light", destructible: true, crushable: true },
    mediumtree: { family: "tree", movement: "circle", trunk: 6, canopy: 21, cover: "medium", destructible: true, crushable: false },
    largetree: { family: "tree", movement: "circle", trunk: 8, canopy: 28, cover: "heavy", destructible: true, crushable: false },
    pinetree: { family: "tree", movement: "circle", trunk: 6, canopy: 22, cover: "medium", destructible: true, crushable: false },
    palmtree: { family: "tree", movement: "circle", trunk: 5, canopy: 20, cover: "medium", destructible: true, crushable: true },
    trees: { family: "tree-cluster", movement: "multi-circle", trunk: 5, canopy: 0.82, cover: "medium", destructible: true, crushable: false },
    denseforest: { family: "tree-cluster", movement: "multi-circle", trunk: 6, canopy: 0.94, cover: "heavy", destructible: true, crushable: false },
    jungle: { family: "tree-cluster", movement: "multi-circle", trunk: 5, canopy: 0.92, cover: "heavy", destructible: true, crushable: false },
    deadforest: { family: "tree-cluster", movement: "multi-circle", trunk: 5, canopy: 0.68, cover: "medium", destructible: true, crushable: false },
    stump: { family: "tree", movement: "circle", trunk: 3.5, canopy: 0, cover: "light", destructible: true, crushable: true },
    fallenlog: { family: "log", movement: "capsule", width: 5, cover: "medium", destructible: true, crushable: true },
    bushes: { family: "brush", movement: "soft", canopy: 0.72, cover: "light", destructible: true, crushable: true },
    largebush: { family: "brush", movement: "soft", canopy: 0.82, cover: "medium", destructible: true, crushable: true },
    pebbles: { family: "rubble", movement: "soft", movementCost: 1.06, cover: "none", destructible: false },
    smallrocks: { family: "rubble", movement: "soft", movementCost: 1.18, cover: "light", destructible: false },
    boulders: { family: "rock", movement: "ellipse", width: 0.7, height: 0.5, cover: "heavy", destructible: false },
    crystal: { family: "rock", movement: "circle", width: 0.34, cover: "medium", destructible: true, crushable: false },
    ruins: { family: "heavy-debris", movement: "rotated-rect", width: 1.22, height: 0.68, cover: "heavy", destructible: true, removable: true },
    building: { family: "heavy-debris", movement: "rotated-rect", width: 1.2, height: 0.78, cover: "heavy", destructible: true, removable: true },
    civilian: { family: "heavy-debris", movement: "rotated-rect", width: 1.12, height: 0.72, cover: "heavy", destructible: true, removable: true },
    factory: { family: "heavy-debris", movement: "rotated-rect", width: 1.24, height: 0.78, cover: "heavy", destructible: true, removable: true },
    powerplant: { family: "heavy-debris", movement: "rotated-rect", width: 1.12, height: 0.72, cover: "heavy", destructible: true, removable: true },
    spaceport: { family: "heavy-debris", movement: "rotated-rect", width: 1.2, height: 0.62, cover: "heavy", destructible: true, removable: true },
    wall: { family: "heavy-debris", movement: "rotated-rect", width: 1.35, height: 0.28, cover: "heavy", destructible: true, removable: true },
    gate: { family: "medium-debris", movement: "rotated-rect", width: 1.1, height: 0.26, cover: "medium", destructible: true, removable: true },
    tanktraps: { family: "medium-debris", movement: "rotated-rect", width: 1.05, height: 0.5, cover: "medium", destructible: true, removable: true },
    barbedwire: { family: "medium-debris", movement: "rotated-rect", width: 1.25, height: 0.18, cover: "light", destructible: true, removable: true },
    crates: { family: "medium-debris", movement: "rect", width: 0.72, height: 0.52, cover: "light", destructible: true, removable: true, crushable: true },
    barricade: { family: "medium-debris", movement: "rotated-rect", width: 1.08, height: 0.32, cover: "medium", destructible: true, removable: true, crushable: true },
    wreck: { family: "heavy-debris", movement: "rotated-rect", width: 1.16, height: 0.62, cover: "heavy", destructible: true, removable: true },
    biomassremains: { family: "biomass", movement: "soft", movementCost: 1.08, cover: "light", destructible: true, removable: true, crushable: true }
  };

export const environmentConfig = Object.freeze({
    spatialCellSize: 128,
    coverValues: Object.freeze({ none: 0, light: 0.12, medium: 0.24, heavy: 0.42 }),
    profiles: Object.freeze(profiles)
});

modules.environment = environmentConfig;
export default environmentConfig;
