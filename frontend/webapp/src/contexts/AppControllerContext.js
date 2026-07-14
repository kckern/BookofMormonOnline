/**
 * AppControllerContext — publishes the appController object app-wide.
 *
 * Step 2 of the appController→context migration (step 1 was
 * contexts/MessengerContext.js; see
 * docs/audits/2026-07-13-controller-context-migration-blast-radius.md).
 *
 * Main.js still OWNS the reducer (useReducer + global._appDispatch); this
 * provider only distributes the current object. The reducer returns a fresh
 * shallow copy on every dispatch, so every consumer re-renders per dispatch —
 * identical to the prop-drilling behavior this replaces.
 */
import React, { createContext, useContext } from "react";

export const AppControllerContext = createContext(null);

export const useAppController = () => {
  const appController = useContext(AppControllerContext);
  if (!appController)
    throw new Error(
      "useAppController() called outside <AppControllerProvider>. " +
        "The provider is mounted in views/_Common/Main.js; in tests, wrap " +
        "your component with <AppControllerProvider appController={fixture}>."
    );
  return appController;
};

export function AppControllerProvider({ appController, children }) {
  return (
    <AppControllerContext.Provider value={appController}>
      {children}
    </AppControllerContext.Provider>
  );
}
