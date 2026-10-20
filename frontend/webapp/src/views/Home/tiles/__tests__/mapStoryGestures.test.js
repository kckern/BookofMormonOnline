import { storyMapGestures } from "../mapStoryGestures";

// Blind R11 mapstory-F1: on phone a one-finger swipe that starts on the 270px map
// panned the map instead of scrolling the feed (OpenLayers sets touch-action:none
// and pans on any one-pointer drag). Touch devices get cooperative gestures.
describe("storyMapGestures", () => {
  test("touch: one finger leaves vertical scrolling to the page; two fingers pan", () => {
    const g = storyMapGestures(true);
    expect(g.touchAction).toBe("pan-y");
    expect(g.defaultDragPan).toBe(false);
    expect(g.panCondition.call({ getPointerCount: () => 1 })).toBe(false);
    expect(g.panCondition.call({ getPointerCount: () => 2 })).toBe(true);
    expect(g.hint).toBe(true);
  });
  test("mouse: unchanged (drag pans, OpenLayers owns the gesture)", () => {
    const g = storyMapGestures(false);
    expect(g.touchAction).toBe("none");
    expect(g.defaultDragPan).toBe(true);
    expect(g.panCondition).toBeNull();
    expect(g.hint).toBe(false);
  });
});
