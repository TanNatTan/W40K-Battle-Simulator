(() => {
  const modules = window.AWTModules ||= {};
  const prefix = "awt-scenario:";

  modules.storage = Object.freeze({
    save(slot, value) {
      localStorage.setItem(`${prefix}${slot}`, JSON.stringify(value));
    },
    load(slot) {
      const value = localStorage.getItem(`${prefix}${slot}`);
      return value ? JSON.parse(value) : null;
    },
    remove(slot) {
      localStorage.removeItem(`${prefix}${slot}`);
    }
  });
})();

