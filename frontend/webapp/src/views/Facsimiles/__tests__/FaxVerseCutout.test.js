import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import FaxVerseCutout from "../FaxVerseCutout";

const verses = [
  { verse_id: 100, ref: "Alma 5:1", text: "verse one hundred", boxes: [{ x: 350, y: 100, w: 100, h: 50 }] },
  { verse_id: 101, ref: "Alma 5:2", text: "verse one oh one", boxes: [{ x: 350, y: 200, w: 100, h: 50 }, { x: 460, y: 200, w: 40, h: 50 }] },
];

function setup(props) {
  return render(
    <FaxVerseCutout
      verses={verses}
      pageScale={700}
      displayedWidth={1400}
      idSuffix={5}
      activeVerseId={props.activeVerseId ?? null}
      onHover={props.onHover || (() => {})}
      onLeave={props.onLeave || (() => {})}
      onOpen={props.onOpen || (() => {})}
      hoverIntentMs={0}
    />
  );
}

describe("FaxVerseCutout", () => {
  test("renders one hotspot per box, scaled by displayedWidth/pageScale", () => {
    const { container } = setup({});
    const spots = container.querySelectorAll(".faxHotspot");
    expect(spots).toHaveLength(3);
    expect(spots[0].style.left).toBe("700px");
    expect(spots[0].style.width).toBe("200px");
  });

  test("hover fires onHover after intent; leave fires onLeave", () => {
    const onHover = jest.fn(), onLeave = jest.fn();
    const { container } = setup({ onHover, onLeave });
    const spot = container.querySelector(".faxHotspot");
    act(() => { fireEvent.mouseEnter(spot); });
    expect(onHover).toHaveBeenCalledWith(100);
    fireEvent.mouseLeave(spot);
    expect(onLeave).toHaveBeenCalled();
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

  test("active verse renders the scrim mask (one punch per box) and tooltip text", () => {
    const { container } = setup({ activeVerseId: 101 });
    expect(container.querySelectorAll(".faxCutoutSvg mask rect.punch")).toHaveLength(2);
    expect(screen.getByText("verse one oh one")).toBeTruthy();
    expect(screen.getByText("Alma 5:2")).toBeTruthy();
  });

  test("no active verse -> no scrim, no tooltip", () => {
    const { container } = setup({ activeVerseId: null });
    expect(container.querySelector(".faxCutoutSvg")).toBeNull();
    expect(container.querySelector(".faxVerseTooltip")).toBeNull();
  });
});
