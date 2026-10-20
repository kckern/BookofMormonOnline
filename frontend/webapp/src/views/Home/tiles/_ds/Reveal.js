import React, { createContext, useContext, useMemo, useRef, useState } from "react";

/**
 * Two-layer CTA gating. A tile wraps its body in <RevealProvider>. A Layer-1
 * control that actually has something to expand calls registerGate() (there IS
 * a pending reveal) and calls reveal() when the user expands. <TileDeepLink>
 * hides only while `gated && !revealed`.
 *
 * The two flags matter: a tile whose prose is short and never truncates never
 * registers a gate, so its deeplink shows immediately instead of being hidden
 * forever. Without a provider, gated stays false → bare TileDeepLink is visible.
 *
 * `onReveal` (optional) fires when reveal() runs. An enclosing <BoundedTile>
 * also listens through TileBoundContext, so expanding a tile's own Layer-1
 * control lifts the phone height bound (no CTA left below a clip).
 */
export const TileBoundContext = createContext(null);

const RevealContext = createContext({
  revealed: false,
  gated: false,
  reveal: () => {},
  registerGate: () => {},
});

export function RevealProvider({ children, onReveal }) {
  const [revealed, setRevealed] = useState(false);
  const [gated, setGated] = useState(false);
  // Gates by id, so a re-measure can retract its own gate (blind R6
  // josephSmith-C3: a gate registered on a fallback-font measurement that
  // overflowed was never un-registered, and the tile lost its Layer-2 link).
  const gates = useRef(new Set());
  const bound = useContext(TileBoundContext);
  // latest callbacks without re-creating the context value each render
  const cbRef = useRef();
  cbRef.current = { onReveal, bound };
  const value = useMemo(
    () => ({
      revealed,
      gated,
      reveal: () => {
        setRevealed(true);
        cbRef.current.onReveal?.();
        cbRef.current.bound?.();
      },
      // registerGate() / registerGate(true, id) adds a gate; (false, id) retracts it.
      registerGate: (on = true, id = "default") => {
        if (on === false) gates.current.delete(id);
        else gates.current.add(id);
        setGated(gates.current.size > 0);
      },
    }),
    [revealed, gated]
  );
  return <RevealContext.Provider value={value}>{children}</RevealContext.Provider>;
}

export function useReveal() {
  return useContext(RevealContext);
}
