import React, { useEffect, useState } from "react";
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

// Displayable in a tile: plain-letter mirrored schemes deep enough to be
// interesting, short enough not to scroll (ABCCBA … up to 12 lines), and with
// at most ~600 characters of text — a 12-line chiasm of long verses ran the
// tile to 800px (118 of 149 eligible chiasms fit).
const MAX_CHARS = 600;
const textLength = (c) => (Array.isArray(c.line_lengths) ? c.line_lengths.reduce((a, b) => a + (Number(b) || 0), 0) : 0);
export const displayable = (c) =>
  /^[A-Z]+$/.test(c.scheme || "") && c.scheme.length >= 6 && c.scheme.length <= 12 && textLength(c) <= MAX_CHARS;

// "Alma2" → "Alma²": keep the disambiguator, in the People-tile convention.
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const speakerLabel = (name) =>
  name ? String(name).replace(/(\d+)$/, (d) => [...d].map((c) => SUP[c]).join("")) : null;

const heading = () => labelOr("chiasmus", "Chiasmus");

/**
 * One sampled chiasm rendered as its mirrored structure — indent tracks the
 * letter depth in, then back out. A live taste of /analysis/chiasmus.
 *
 * States: loading → a tile-sized skeleton; a pick → the chiasm; nothing
 * displayable or a failed fetch → null (`.tile-chiasmus:empty` collapses it).
 */
export default function ChiasmusTile({ seed }) {
  const [state, setState] = useState({ status: "loading", chiasm: null });
  const single = useSingleColumn();

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", chiasm: null });
    const done = (chiasm) => !cancelled && setState(chiasm ? { status: "ready", chiasm } : { status: "empty", chiasm: null });
    Promise.resolve(BoMOnlineAPI({ chiasmus: true }))
      .then((res) => {
        const list = Object.values(res?.chiasmus || {}).filter(displayable);
        if (!list.length || cancelled) return null;
        const pick = list[Math.abs(seed || 1) % list.length];
        return BoMOnlineAPI({ chiasm: [pick.chiasmus_id] });
      })
      .then((r) => {
        const full = r ? Object.values(r.chiasm || {})[0] : null;
        done(full?.lines?.length ? full : null);
      })
      .catch(() => done(null));
    return () => {
      cancelled = true;
    };
  }, [seed]);

  if (state.status === "loading") {
    return (
      <div
        className="samplerTileInner chiasmusTile isLoading"
        aria-busy="true"
        style={{ minHeight: `calc(${skeletonHeight("tile-chiasmus", single)} - 2px)` }}
      >
        <h3 className="tileHeading">{heading()}</h3>
        <div className="tileInnerSkeleton" aria-hidden="true" />
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
    <div className="samplerTileInner chiasmusTile">
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
