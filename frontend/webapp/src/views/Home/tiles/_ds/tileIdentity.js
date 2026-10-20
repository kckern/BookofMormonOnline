import { createContext, useCallback, useContext, useState } from "react";
import { readExpanded, writeExpanded } from "../samplerSession";

/**
 * The identity of the Home tile a component renders in: "<seed>|<data-tile-id>"
 * (Sampler provides it around every tile shell). Reveals persist under it, so
 * EVERY reveal on Home — ExpandableText, BoundedTile, a tile's own toggle —
 * comes back expanded after a Back without each tile having to remember to
 * pass a key (blind R1-R6 E2 recurred in people, personProfile, placeProfile,
 * commentary… one tile at a time). Null outside the sampler (other pages,
 * isolated tests): nothing persists there.
 */
export const TileIdentityContext = createContext(null);
export const TileIdentity = TileIdentityContext.Provider;

export const useTileIdentity = () => useContext(TileIdentityContext);

/** Short stable hash (FNV-1a) — tells apart two reveals in one tile by their text. */
export function hashText(s = "") {
  let h = 0x811c9dc5;
  const t = String(s).replace(/\s+/g, " ").trim().slice(0, 240);
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** The session key for reveal `slot` in the current tile, or undefined. */
export function useRevealKey(slot) {
  const id = useTileIdentity();
  return id && slot ? `tile:${id}#${slot}` : undefined;
}

/**
 * useState(false) for a reveal toggle, remembered for the Home session under
 * the tile identity + `slot` (or an explicit `key`). Returns [open, setOpen].
 */
export function usePersistedOpen(slot, key) {
  const derived = useRevealKey(slot);
  const k = key || derived;
  const [open, setOpenState] = useState(() => readExpanded(k));
  const setOpen = useCallback(
    (next) => {
      setOpenState((prev) => {
        const v = typeof next === "function" ? next(prev) : next;
        writeExpanded(k, v);
        return v;
      });
    },
    [k],
  );
  return [open, setOpen];
}
