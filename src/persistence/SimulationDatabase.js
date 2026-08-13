export const SIMULATION_DATABASE_NAME = "w40k-battle-simulator";
export const SIMULATION_DATABASE_VERSION = 1;
export const SIMULATION_DATABASE_STORES = Object.freeze(["battleSnapshots", "factionAnalytics", "maps", "replays", "settings"]);

export function createSimulationDatabase(indexedDb = globalThis.indexedDB) {
  let openPromise = null;
  const open = () => {
    if (!indexedDb) return Promise.resolve(null);
    if (openPromise) return openPromise;
    openPromise = new Promise((resolve, reject) => {
      const request = indexedDb.open(SIMULATION_DATABASE_NAME, SIMULATION_DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        for (const store of SIMULATION_DATABASE_STORES) if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => {
      console.warn("Simulation database is unavailable; local battle memory remains active.", error);
      return null;
    });
    return openPromise;
  };
  const put = async (store, value) => {
    if (!SIMULATION_DATABASE_STORES.includes(store) || !value?.id) return false;
    const database = await open();
    if (!database) return false;
    return new Promise(resolve => {
      const transaction = database.transaction(store, "readwrite");
      transaction.objectStore(store).put(structuredClone(value));
      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
      transaction.onabort = () => resolve(false);
    });
  };
  return Object.freeze({ open, put,
    saveBattleSnapshot: snapshot => put("battleSnapshots", snapshot),
    saveFactionAnalytics: analytics => put("factionAnalytics", analytics)
  });
}

export function factionAnalyticsRecord({ battleId, at = 0, player = {}, units = [], structures = [], territoryCells = 0, casualties = 0 } = {}) {
  const living = units.filter(unit => unit?.alive !== false && !unit?.incapacitated && unit.faction === player.id);
  return Object.freeze({
    id: `${battleId}:${player.id}:${Math.floor(Number(at) || 0)}`,
    battleId,
    playerId: player.id,
    race: player.race,
    faction: player.faction,
    subfaction: player.subfaction,
    at: Number(at) || 0,
    armySize: living.filter(unit => !["builder", "supply"].includes(unit.role)).length,
    vehicles: living.filter(unit => unit.role === "vehicle").length,
    builders: living.filter(unit => unit.role === "builder").length,
    structures: structures.filter(structure => structure?.alive !== false && structure.faction === player.id).length,
    territoryCells: Math.max(0, Number(territoryCells) || 0),
    casualties: Math.max(0, Number(casualties) || 0),
    workflow: player.decisionWorkflow?.current?.id || null
  });
}
