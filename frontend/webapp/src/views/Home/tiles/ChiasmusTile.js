import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import MiniChiasm from "../../_Common/MiniChiasm";
import ChiasmGlyph from "../../_Common/ChiasmGlyph";
import RefPill from "./RefPill";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import labelOr from "./_ds/labelOr";
import { skeletonHeight } from "./_ds/skeletonHeights";
import useSingleColumn from "./_ds/useSingleColumn";
import { createPickMemo } from "./_ds/pickMemo";
import { estimateChiasmLinesPx } from "./_ds/textFit";

// Displayable in a tile: plain-letter mirrored schemes deep enough to be
// interesting, short enough not to scroll (ABCCBA … up to 12 lines), and with
// at most ~600 characters of text — a 12-line chiasm of long verses ran the
// tile to 800px (118 of 149 eligible chiasms fit).
const MAX_CHARS = 600;
const textLength = (c) => (Array.isArray(c.line_lengths) ? c.line_lengths.reduce((a, b) => a + (Number(b) || 0), 0) : 0);
export const displayable = (c) =>
  /^[A-Z]+$/.test(c.scheme || "") && c.scheme.length >= 6 && c.scheme.length <= 12 && textLength(c) <= MAX_CHARS;

// R3 B2: the tile resolves INTO its reserved box (skeletonHeights, held as
// min-height after arrival), so it may only pick a chiasm whose lines fit what
// the box leaves after the head (eyebrow, glyph/speaker row, title + ref) and
// the CTA — measured 157px desktop / 180px phone. The list already carries
// scheme + line_lengths, so the fit is known before the detail fetch.
const HEAD_PX = { desktop: 157, single: 180 };
const FIT_SLACK = 8; // px of headroom for a title or font that runs long
const DEFAULT_MEASURE = { desktop: 334, single: 314 }; // lines' width when unmeasured (jsdom)
// …and prefers one that fills it to within ~3 rows, so the held box never
// shows a hole under a short chiasm (41 of 118 at 334px, 38 at 314px).
const FILL_BAND = 64;
const linesBudget = (single) =>
  parseInt(skeletonHeight("tile-chiasmus", single), 10) - HEAD_PX[single ? "single" : "desktop"] - FIT_SLACK;
export const fitsTile = (c, single, widthPx) =>
  estimateChiasmLinesPx(c.scheme, c.line_lengths, widthPx) <= linesBudget(single);
export const fillsTile = (c, single, widthPx) =>
  fitsTile(c, single, widthPx) && estimateChiasmLinesPx(c.scheme, c.line_lengths, widthPx) >= linesBudget(single) - FILL_BAND;

// "Alma2" → "Alma²": keep the disambiguator, in the People-tile convention.
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const speakerLabel = (name) =>
  name ? String(name).replace(/(\d+)$/, (d) => [...d].map((c) => SUP[c]).join("")) : null;

const heading = () => labelOr("chiasmus", "Chiasmus");

/** Resolved chiasm per seed: a remount (Back) renders at once, no skeleton flash (audit XC2). */
export const pickMemo = createPickMemo();

/**
 * One sampled chiasm rendered as its mirrored structure — indent tracks the
 * letter depth in, then back out. A live taste of /analysis/chiasmus.
 *
 * States: loading → a tile-sized skeleton; a pick → the chiasm; nothing
 * displayable or a failed fetch → null (`.tile-chiasmus:empty` collapses it).
 */
export default function ChiasmusTile({ seed }) {
  const [state, setState] = useState(() => pickMemo.get(String(seed)) || { status: "loading", chiasm: null });
  const single = useSingleColumn();
  const measureRef = useRef(null);

  useEffect(() => {
    const key = String(seed);
    const memo = pickMemo.get(key);
    if (memo) {
      setState(memo);
      return undefined;
    }
    let cancelled = false;
    setState({ status: "loading", chiasm: null });
    const settle = (next) => {
      pickMemo.set(key, next);
      if (!cancelled) setState(next);
    };
    const fail = () => !cancelled && setState({ status: "empty", chiasm: null });
    Promise.resolve(BoMOnlineAPI({ chiasmus: true }))
      .then((res) => {
        if (res?.error) throw new Error("chiasmus unavailable");
        const shown = Object.values(res?.chiasmus || {}).filter(displayable);
        if (cancelled) return undefined;
        const w = measureRef.current?.getBoundingClientRect?.().width || DEFAULT_MEASURE[single ? "single" : "desktop"];
        const filling = shown.filter((c) => fillsTile(c, single, w));
        const fitting = shown.filter((c) => fitsTile(c, single, w));
        // nothing estimated to fit (a very narrow column): any displayable one
        const list = filling.length ? filling : fitting.length ? fitting : shown;
        if (!list.length) return null;
        const pick = list[Math.abs(seed || 1) % list.length];
        return BoMOnlineAPI({ chiasm: [pick.chiasmus_id] });
      })
      .then((r) => {
        if (r === undefined) return;
        if (r?.error) throw new Error("chiasm unavailable");
        const full = r ? Object.values(r.chiasm || {})[0] : null;
        settle(full?.lines?.length ? { status: "ready", chiasm: full } : { status: "empty", chiasm: null });
      })
      .catch(fail);
    return () => {
      cancelled = true;
    };
    // `single` is read once per pick: the memo keeps the first resolution
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  if (state.status === "loading") {
    return (
      <div
        className="samplerTileInner chiasmusTile isLoading"
        aria-busy="true"
        style={{ minHeight: `calc(${skeletonHeight("tile-chiasmus", single)} - 2px)` }}
      >
        <h3 className="tileHeading">{heading()}</h3>
        <div className="tileInnerSkeleton" aria-hidden="true" ref={measureRef} />
      </div>
    );
  }
  if (state.status !== "ready") return null;

  const { chiasm } = state;
  const speaker = chiasm.speaker;
  const speakerName = speakerLabel(speaker?.name);
  const ident = speakerName ? (
    <>
      {speaker?.person_slug ? (
        <TileImage
          className="chiasmusTileAvatar"
          path={`people/${speaker.person_slug}`}
          widths={[256]}
          sizes="40px"
          width="40"
          height="40"
          alt=""
          onError={(e) => (e.currentTarget.style.visibility = "hidden")}
        />
      ) : null}
      <span className="chiasmusTileSpeakerName">{speakerName}</span>
    </>
  ) : null;
  return (
    <div
      className="samplerTileInner chiasmusTile"
      style={{ minHeight: `calc(${skeletonHeight("tile-chiasmus", single)} - 2px)` }}
    >
      <h3 className="tileHeading">
        <Link to="/analysis/chiasmus">{heading()}</Link>
      </h3>
      <div className="chiasmusTileHead">
        <div className="chiasmusTileHeadTop">
          <ChiasmGlyph
            scheme={chiasm.scheme}
            lineLengths={chiasm.lines?.map((l) => (l.line_text || "").length)}
            size={40}
            title={chiasm.title || heading()}
          />
          {/* the speaker is a person entity: one link (face + name) to their page */}
          {ident && speaker?.person_slug ? (
            <Link className="chiasmusTileSpeaker" to={`/people/${speaker.person_slug}`}>
              {ident}
            </Link>
          ) : ident ? (
            <span className="chiasmusTileSpeaker">{ident}</span>
          ) : null}
        </div>
        <div className="chiasmusTileHeadText">
          {chiasm.title ? <span className="chiasmusTileTitle">{chiasm.title}</span> : null}
          <RefPill refText={chiasm.reference} className="chiasmusTileRef" />
        </div>
      </div>
      <MiniChiasm lines={chiasm.lines} className="chiasmusTileLines" />
      <TileDeepLink to={`/analysis/chiasmus/${chiasm.chiasmus_id}`} always verb="seeInContext" />
    </div>
  );
}
