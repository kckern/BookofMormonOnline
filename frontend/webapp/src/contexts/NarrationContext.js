/**
 * NarrationContext — publishes the per-row narrationController object across a
 * single Narration row's subtree.
 *
 * Phase 3 of the controller-context migration (Task 19). See
 * docs/audits/2026-07-13-controller-context-migration-blast-radius.md.
 *
 * Unlike the app-wide controllers, narrationController is created PER Narration
 * instance (one per narration row, via useReducer). Each Narration mounts its
 * OWN provider around the panels + TextContent it renders, so nested-provider /
 * nearest-wins gives every descendant its row's controller — and the
 * quote-recursive TextContent (same subtree) sees the same one.
 *
 * narrationController never leaves the Narration subtree (no out-of-tree
 * consumers), so useNarration() THROWS with no provider — like useAppController
 * / useTheater, not like usePageController.
 */
import React, { createContext, useContext } from "react";

export const NarrationContext = createContext(null);

export const useNarration = () => {
  const narrationController = useContext(NarrationContext);
  if (!narrationController)
    throw new Error(
      "useNarration() called outside <NarrationProvider>. " +
        "A provider is mounted per row in views/Page/Narration.js; in tests, " +
        "wrap your component with <NarrationProvider narrationController={fixture}>."
    );
  return narrationController;
};

export function NarrationProvider({ narrationController, children }) {
  return (
    <NarrationContext.Provider value={narrationController}>
      {children}
    </NarrationContext.Provider>
  );
}
