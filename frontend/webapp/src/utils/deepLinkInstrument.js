let events = [];

export function recordDeepLinkEvent(name, payload) {
  if (typeof window === "undefined" || !window.__deepLinkInstrument) return;
  events.push({ name, payload: payload ?? null, t: performance.now() });
  window.__deepLinkEvents = events;
}

export function getDeepLinkEvents() {
  return events.slice();
}

export function resetDeepLinkEvents() {
  events = [];
  if (typeof window !== "undefined") window.__deepLinkEvents = events;
}
