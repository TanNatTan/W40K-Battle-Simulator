export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function formatElapsed(seconds) {
  return `${pad2(Math.floor(seconds / 60))}:${pad2(Math.floor(seconds % 60))}`;
}
