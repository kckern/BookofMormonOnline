import React, { createContext, useContext, useMemo, useState } from "react";

/**
 * Two-layer CTA gating. A tile wraps its body in <RevealProvider>. A Layer-1
 * control that actually has something to expand calls registerGate() (there IS
 * a pending reveal) and calls reveal() when the user expands. <TileDeepLink>
 * hides only while `gated && !revealed`.
 *
 * The two flags matter: a tile whose prose is short and never truncates never
 * registers a gate, so its deeplink shows immediately instead of being hidden
 * forever. Without a provider, gated stays false → bare TileDeepLink is visible.
 */
const RevealContext = createContext({
  revealed: false,
  gated: false,
  reveal: () => {},
  registerGate: () => {},
});

export function RevealProvider({ children }) {
  const [revealed, setRevealed] = useState(false);
  const [gated, setGated] = useState(false);
  const value = useMemo(
    () => ({ revealed, gated, reveal: () => setRevealed(true), registerGate: () => setGated(true) }),
    [revealed, gated]
  );
  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>;
}

export function useReveal() {
  return useContext(RevealContext);
}
