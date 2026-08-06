// Application composition root. Keep simulation, rendering, and UI behavior out
// of this file as those systems move out of the compatibility runtime.
globalThis.AWTData ||= {};
try {
  const response = await fetch(new URL("../data/weapons.json", import.meta.url));
  if (!response.ok) throw new Error(`Weapon data returned ${response.status}`);
  globalThis.AWTData.weapons = await response.json();
} catch (error) {
  globalThis.AWTData.weapons = {};
  console.warn("Weapon data could not be loaded; the combat fallback profile will be used.", error);
}

try {
  const response = await fetch(new URL("../data/ai/faction-branches.json", import.meta.url));
  if (!response.ok) throw new Error(`Faction AI data returned ${response.status}`);
  globalThis.AWTData.factionAI = await response.json();
} catch (error) {
  globalThis.AWTData.factionAI = null;
  console.warn("Faction AI data could not be loaded; built-in race profiles will be used.", error);
}

await import("../js/app.js");
