import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clampWords } from "../textUtils";
import { onLayoutChange } from "./clampGuard";

/**
 * Text that fits `lines` whole lines by WORDS, never mid-word: renders the full
 * text, and when its box overflows (max-height: N lh), binary-searches the
 * longest word-budget cut (clampWords, phrase mode — never ending on "in…",
 * "of…") that fits. Replaces -webkit-line-clamp's mid-word ellipsis on tiny
 * card bands ("later occupie…", "Lamanites in…") (audit places H3).
 *
 * `prefix` (e.g. a RefPill) shares the first line and is never cut. Re-fits on
 * width changes and web-font loads. With no layout (jsdom) the full text stays. The text span is
 * written by the layout effect (pre-paint), never by React, so the binary
 * search can't desync React's text node.
 */
export default function FitWords({ text = "", lines = 2, className = "", prefix = null, as: Tag = "span" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(text);
  const [width, setWidth] = useState(0);
  const [fontTick, setFontTick] = useState(0);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const target = box.querySelector("[data-fit-text]");
    if (!target) return;
    // the text's last line box must end inside the clip; scrollHeight alone
    // also counts a chip's absolutely-positioned touch hit area (::after)
    const fits = () => {
      const rects = target.getClientRects();
      const last = rects[rects.length - 1];
      if (!last) return box.scrollHeight <= box.clientHeight + 1; // no layout (jsdom)
      // against the CONTENT bottom: a box may pad its edges (negative margins)
      // only to widen a chip's hit/focus area — text must not spill into it
      const padB = parseFloat(getComputedStyle(box).paddingBottom) || 0;
      return last.bottom <= box.getBoundingClientRect().bottom - padB + 0.5;
    };
    target.textContent = text;
    if (fits()) {
      setShown(text);
      return;
    }
    const n = text.split(" ").length;
    let lo = 1;
    let hi = n - 1;
    let best = clampWords(text, 1, { phrase: true });
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const cut = clampWords(text, mid, { phrase: true });
      target.textContent = cut;
      if (fits()) {
        best = cut;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    target.textContent = best;
    setShown(best);
  }, [text, lines, width, fontTick]);

  // Re-fit on a width change, and whenever the web fonts settle (a fit taken
  // in the fallback font is wrong both ways once the face swaps in — C3).
  useEffect(() => {
    const box = ref.current;
    if (!box) return undefined;
    let last = box.clientWidth;
    return onLayoutChange(box, (why) => {
      if (why === "fonts") setFontTick((t) => t + 1);
      else if (box.clientWidth !== last) {
        last = box.clientWidth;
        setWidth(last);
      }
    });
  }, []);

  return (
    <Tag ref={ref} className={`fitWords ${className}`.trim()} style={{ "--fit-lines": lines }} title={shown !== text ? text : undefined}>
      {prefix}
      {prefix && text ? " " : null}
      {/* owned imperatively (textContent) by the fit pass — React renders it empty */}
      <span data-fit-text="" />
    </Tag>
  );
}
