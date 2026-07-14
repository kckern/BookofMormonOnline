/**
 * MapContext — publishes the mapController object across the Map component tree.
 *
 * Step of the mapController→context migration (Task 16; Phase 1 moved
 * appController onto AppControllerContext, Phase 2 moved theaterController onto
 * TheaterContext). See
 * docs/audits/2026-07-13-controller-context-migration-blast-radius.md.
 *
 * MapContainer still OWNS the state (the useState pairs) and builds the
 * mapController object literal each render, still CARRYING appController as a
 * key; this provider only distributes the current object. MapContainer returns
 * a fresh object every render, so every consumer re-renders per render —
 * identical to the prop-drilling behavior this replaces.
 */
import React, { createContext, useContext } from "react";

export const MapContext = createContext(null);

export const useMapController = () => {
  const mapController = useContext(MapContext);
  if (!mapController)
    throw new Error(
      "useMapController() called outside <MapProvider>. " +
        "The provider is mounted in views/Map/Map.js; in tests, wrap " +
        "your component with <MapProvider mapController={fixture}>."
    );
  return mapController;
};

export function MapProvider({ mapController, children }) {
  return (
    <MapContext.Provider value={mapController}>{children}</MapContext.Provider>
  );
}
