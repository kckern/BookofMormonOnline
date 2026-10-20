/**
 * Map gestures for the map-story tile. On touch screens the map is a third of
 * the viewport, so a one-finger swipe that starts on it must scroll the page
 * (blind R11 mapstory-F1): the viewport allows vertical panning by the browser,
 * the map pans only with two fingers, and a one-finger touch shows a hint.
 * Mouse/trackpad keep OpenLayers' default drag-to-pan.
 */
export function storyMapGestures(coarse) {
  if (!coarse) return { touchAction: "none", defaultDragPan: true, panCondition: null, hint: false };
  return {
    touchAction: "pan-y",
    defaultDragPan: false,
    // called by ol/interaction/DragPan with `this` bound to the interaction
    panCondition() {
      return this.getPointerCount() === 2;
    },
    hint: true,
  };
}

export const isCoarsePointer = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
