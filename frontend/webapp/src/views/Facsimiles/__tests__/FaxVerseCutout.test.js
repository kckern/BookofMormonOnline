import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import FaxVerseCutout from "../FaxVerseCutout";

const verses = [
  { verse_id: 100, ref: "Alma 5:1", text: "verse one hundred", voice: "alma", person_slug: "alma-the-younger", boxes: [{ x: 350, y: 100, w: 100, h: 50 }] },
  { verse_id: 101, ref: "Alma 5:2", text: "verse one oh one", boxes: [{ x: 350, y: 200, w: 100, h: 50 }, { x: 460, y: 200, w: 40, h: 50 }] },
];

function setup(props = {}) {
  return render(
    <FaxVerseCutout
      verses={props.verses || verses}
      pageScale={700}
      displayedWidth={1400}
      displayedHeight={props.displayedHeight ?? 0}
      idSuffix={props.idSuffix ?? 5}
      activeVerseId={props.activeVerseId ?? null}
      onHover={props.onHover || (() => {})}
      onLeave={props.onLeave || (() => {})}
      onOpen={props.onOpen || (() => {})}
      hoverIntentMs={props.hoverIntentMs ?? 0}
    />
  );
}

describe("FaxVerseCutout", () => {
  test("renders one hotspot per box, scaled by displayedWidth/pageScale", () => {
    const { container } = setup();
    const spots = container.querySelectorAll(".faxHotspot");
    expect(spots).toHaveLength(3);
    expect(spots[0].style.left).toBe("700px");
    expect(spots[0].style.width).toBe("200px");
  });

  test("hover fires onHover; leave fires onLeave after the grace window", () => {
    jest.useFakeTimers();
    const onHover = jest.fn(), onLeave = jest.fn();
    const { container } = setup({ onHover, onLeave });
    const spot = container.querySelector(".faxHotspot");
    fireEvent.mouseEnter(spot);
    expect(onHover).toHaveBeenCalledWith(100);
    fireEvent.mouseLeave(spot);
    expect(onLeave).not.toHaveBeenCalled();       // deferred by the grace window (anti-flash)
    act(() => { jest.advanceTimersByTime(160); });
    expect(onLeave).toHaveBeenCalledWith(100);    // verse-scoped leave
    jest.useRealTimers();
  });

  test("click fires onOpen and stops propagation (so the page does not turn)", () => {
    const onOpen = jest.fn();
    const pageTurn = jest.fn();
    const { container } = render(
      <div onClick={pageTurn}>
        <FaxVerseCutout verses={verses} pageScale={700} displayedWidth={1400} idSuffix={5}
          activeVerseId={null} onHover={() => {}} onLeave={() => {}} onOpen={onOpen} hoverIntentMs={0} />
      </div>
    );
    fireEvent.click(container.querySelector(".faxHotspot"));
    expect(onOpen).toHaveBeenCalledWith(verses[0]);
    expect(pageTurn).not.toHaveBeenCalled();
  });

  test("active verse cuts one punch per box; hovering it shows the tooltip", () => {
    const { container } = setup({ activeVerseId: 101 });
    // scrim + punches come from the active state alone (no hover needed)
    expect(container.querySelectorAll(".faxCutoutSvg mask .punch")).toHaveLength(2);
    fireEvent.mouseEnter(container.querySelectorAll(".faxHotspot")[1]); // one of verse 101's boxes
    expect(screen.getByText("verse one oh one")).toBeTruthy();
    expect(screen.getByText("Alma 5:2")).toBeTruthy();
  });

  test("no active verse -> no scrim, no tooltip", () => {
    const { container } = setup({ activeVerseId: null });
    expect(container.querySelector(".faxCutoutSvg")).toBeNull();
    expect(container.querySelector(".faxVerseTooltip")).toBeNull();
  });

  test("active verse on the OTHER page -> this page dims solid (scrim, no punch)", () => {
    const { container } = setup({ activeVerseId: 999 }); // not on this page
    expect(container.querySelector(".faxCutoutSvg")).toBeTruthy();                 // still darkens
    expect(container.querySelectorAll(".faxCutoutSvg mask .punch")).toHaveLength(0); // nothing cut out here
    expect(container.querySelector(".faxVerseTooltip")).toBeNull();
  });

  test("a notched box is cut out as a polygon, not a rect", () => {
    const notched = [{ verse_id: 300, ref: "Alma 5:3", text: "t", boxes: [{ x: 10, y: 10, w: 100, h: 40, tlw: 20, tlh: 8 }] }];
    const { container } = setup({ verses: notched, activeVerseId: 300, idSuffix: 3 });
    expect(container.querySelector(".faxCutoutSvg mask polygon.punch")).toBeTruthy();
    expect(container.querySelector(".faxCutoutSvg mask rect.punch")).toBeNull();
  });

  test("tooltip carries the speaker avatar + voice name", () => {
    const { container } = setup({ activeVerseId: 100 });
    fireEvent.mouseEnter(container.querySelectorAll(".faxHotspot")[0]); // verse 100
    const avatar = container.querySelector(".faxVerseTooltip-avatar");
    expect(avatar.getAttribute("src")).toContain("/people/alma-the-younger");
    expect(container.querySelector(".faxVerseTooltip-voice")).toBeTruthy();
  });

  test("tooltip flips BELOW for a verse in the upper part of the page", () => {
    // displayedHeight 1000px; verse 100 box mid-y = (100+25)*k(2) = 250 < 500 -> below
    const { container } = setup({ activeVerseId: 100, displayedHeight: 1000 });
    fireEvent.mouseEnter(container.querySelectorAll(".faxHotspot")[0]);
    expect(container.querySelector(".faxVerseTooltip").classList.contains("below")).toBe(true);
  });

  test("active verse WITHOUT text still shows a ref-only tooltip on hover", () => {
    const noText = [{ verse_id: 200, ref: "Alma 5:9", boxes: [{ x: 10, y: 10, w: 20, h: 20 }] }];
    const { container } = setup({ verses: noText, activeVerseId: 200, idSuffix: 9 });
    fireEvent.mouseEnter(container.querySelector(".faxHotspot"));
    expect(container.querySelector(".faxVerseTooltip")).toBeTruthy();
    expect(container.querySelector(".faxVerseTooltip-ref").textContent).toBe("Alma 5:9");
    expect(container.querySelector(".faxVerseTooltip-text")).toBeNull();
  });

  test("pending hover-intent timer does not fire after unmount", () => {
    jest.useFakeTimers();
    const onHover = jest.fn();
    const { container, unmount } = setup({ onHover, hoverIntentMs: 100 });
    fireEvent.mouseEnter(container.querySelector(".faxHotspot"));
    unmount();
    jest.runOnlyPendingTimers();
    expect(onHover).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
