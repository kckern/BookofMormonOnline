/**
 * TextContentContext — publishes the per-block textContentController object
 * across a single TextContent block's subtree.
 *
 * Phase 3 of the controller-context migration (Task 20). See
 * docs/audits/2026-07-13-controller-context-migration-blast-radius.md.
 *
 * textContentController is created PER TextContent instance (one per scripture
 * block, via useReducer). TextContent RECURSES for quotes, and each quote
 * instance creates its OWN textContentController and mounts its OWN provider —
 * so the nested provider SHADOWS the parent, and nested-provider / nearest-wins
 * gives every block's bubbles their own controller.
 *
 * textContentController never leaves the TextContent subtree (no out-of-tree
 * consumers), so useTextContent() THROWS with no provider — like useNarration /
 * useAppController / useTheater, not like usePageController.
 */
import React, { createContext, useContext } from "react";

export const TextContentContext = createContext(null);

export const useTextContent = () => {
  const textContentController = useContext(TextContentContext);
  if (!textContentController)
    throw new Error(
      "useTextContent() called outside <TextContentProvider>. " +
        "A provider is mounted per block in views/Page/TextContent.js; in tests, " +
        "wrap your component with <TextContentProvider textContentController={fixture}>."
    );
  return textContentController;
};

export function TextContentProvider({ textContentController, children }) {
  return (
    <TextContentContext.Provider value={textContentController}>
      {children}
    </TextContentContext.Provider>
  );
}
