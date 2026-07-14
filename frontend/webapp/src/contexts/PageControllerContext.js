import React, { createContext, useContext } from "react";

export const PageControllerContext = createContext(null);

// Returns the override when given one (out-of-tree callers pass
// appController.activeLeafCursorController — see blast-radius audit H1),
// otherwise the nearest provider's controller, otherwise null.
// Does NOT throw: out-of-tree consumers (Commentary, PopUp History) render
// <Comments> with the override prop and no provider above them.
export const usePageController = (override = null) => {
  const fromContext = useContext(PageControllerContext);
  return override || fromContext;
};

export function PageControllerProvider({ pageController, children }) {
  return (
    <PageControllerContext.Provider value={pageController}>
      {children}
    </PageControllerContext.Provider>
  );
}
