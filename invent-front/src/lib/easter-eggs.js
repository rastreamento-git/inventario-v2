export const EASTER_EGGS = { thereisnourflevel: "reset", zenpoweradd: "users" };
export function commandFor(value) {
  return EASTER_EGGS[String(value).trim().toLowerCase()] || null;
}
export function keySequence() {
  let buffer = "",
    last = 0;
  return (key, now) => {
    if (key.length !== 1) {
      buffer = "";
      return null;
    }
    if (now - last > 5000) buffer = "";
    last = now;
    buffer = (buffer + key.toLowerCase()).slice(-32);
    for (const [code, action] of Object.entries(EASTER_EGGS))
      if (buffer.endsWith(code)) {
        buffer = "";
        return action;
      }
    return null;
  };
}
