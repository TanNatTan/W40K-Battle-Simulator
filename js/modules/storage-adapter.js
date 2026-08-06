const modules = globalThis.AWTModules ||= {};
const prefix = "awt-scenario:";

export const storageAdapter = Object.freeze({
    save(slot, value) {
      localStorage.setItem(`${prefix}${slot}`, JSON.stringify(value));
    },
    load(slot) {
      try {
        const value = localStorage.getItem(`${prefix}${slot}`);
        return value ? JSON.parse(value) : null;
      } catch {
        return null;
      }
    },
    remove(slot) {
      localStorage.removeItem(`${prefix}${slot}`);
    }
});

modules.storage = storageAdapter;
export default storageAdapter;
