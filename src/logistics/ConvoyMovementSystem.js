export const SUPPLY_TRANSPORT_SPEED = Object.freeze({
  Wartrukk: 24,
  "Rhino transport": 22,
  "supply truck": 20,
  "cargo carrier": 19,
  "rail convoy": 32,
  "sea convoy": 23,
  "cargo aircraft": 40
});

export function convoyBaseSpeed(convoy = {}) {
  if (["air", "orbital", "underground", "warp"].includes(convoy.routeType)) return SUPPLY_TRANSPORT_SPEED["cargo aircraft"];
  if (["sea", "river"].includes(convoy.routeType)) return SUPPLY_TRANSPORT_SPEED["sea convoy"];
  if (convoy.routeType === "rail") return SUPPLY_TRANSPORT_SPEED["rail convoy"];
  return SUPPLY_TRANSPORT_SPEED[convoy.mode] || 20;
}

export function convoyMovementFactor(status = "") {
  if (status === "Awaiting escort") return 0.6;
  if (String(status).includes("Ambushed")) return 0.75;
  return 1;
}

export function convoyEffectiveSpeed(convoy = {}, roadFactor = 1) {
  const routeFactor = (convoy.routeType || "road") === "road" ? Math.max(0.2, Number(roadFactor) || 0) : 1;
  return convoyBaseSpeed(convoy) * routeFactor * convoyMovementFactor(convoy.status);
}
