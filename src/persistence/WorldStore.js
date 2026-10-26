// IndexedDB store for persistent worlds. A saved world is the ground (height
// field and per-cell layers), the ecosystem clock and every settlement with
// its people, memories and doctrine -- everything that must survive a reload
// for "the world remembers what happened". It lives in its own database so it
// never disturbs the battle-history schema.

export const WORLD_STORE_NAME = "w40k-persistent-world";
export const WORLD_STORE_VERSION = 1;
const STORE = "worlds";

export function createWorldStore(indexedDb = globalThis.indexedDB) {
  let openPromise = null;
  const open = () => {
    if (!indexedDb) return Promise.resolve(null);
    if (openPromise) return openPromise;
    openPromise = new Promise((resolve, reject) => {
      const request = indexedDb.open(WORLD_STORE_NAME, WORLD_STORE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(error => {
      console.warn("World store unavailable; the world will not persist across reloads.", error);
      return null;
    });
    return openPromise;
  };
  const run = async (mode, work) => {
    const database = await open();
    if (!database) return null;
    return new Promise(resolve => {
      let result = null;
      let transaction;
      try {
        transaction = database.transaction(STORE, mode);
        const request = work(transaction.objectStore(STORE));
        if (request) request.onsuccess = () => { result = request.result ?? null; };
      } catch (error) {
        resolve(null);
        return;
      }
      transaction.oncomplete = () => resolve(result ?? true);
      transaction.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    });
  };
  return Object.freeze({
    open,
    save: async (slot, payload, meta = {}) => Boolean(slot && payload && await run("readwrite", store => store.put({ id: String(slot), savedAt: Date.now(), ...meta, payload }))),
    load: async slot => {
      const record = await run("readonly", store => store.get(String(slot)));
      return record && record !== true ? record : null;
    },
    list: async () => {
      const records = await run("readonly", store => store.getAll());
      return Array.isArray(records) ? records.map(({ id, savedAt, name, summary }) => ({ id, savedAt, name, summary })) : [];
    },
    remove: slot => run("readwrite", store => store.delete(String(slot)))
  });
}
