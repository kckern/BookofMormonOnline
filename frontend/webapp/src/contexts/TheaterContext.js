/**
 * TheaterContext — publishes the theaterController object across the Theater
 * component tree.
 *
 * Step 2 of the theaterController→context migration (Phase 2; Phase 1 moved
 * appController onto AppControllerContext). See
 * docs/audits/2026-07-13-controller-context-migration-blast-radius.md.
 *
 * TheaterWrapper still OWNS the state (the useState pairs + controls object);
 * this provider only distributes the current object. TheaterMainPanel augments
 * the base controller with per-panel keys (subCursorIndex, hasNextContent, …)
 * and RE-PROVIDES it, so descendants under the main panel see a richer object
 * than descendants under the side panel — exactly the split the prop-drilling
 * produced.
 */
import React, { createContext, useContext } from "react";

export const TheaterContext = createContext(null);

export const useTheater = () => {
  const theaterController = useContext(TheaterContext);
  if (!theaterController)
    throw new Error(
      "useTheater() called outside <TheaterProvider>. " +
        "The provider is mounted in views/Theater/Theater.js."
    );
  return theaterController;
};

export function TheaterProvider({ theaterController, children }) {
  return (
    <TheaterContext.Provider value={theaterController}>
      {children}
    </TheaterContext.Provider>
  );
}
