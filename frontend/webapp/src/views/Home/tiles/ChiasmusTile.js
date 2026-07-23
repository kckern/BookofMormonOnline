import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "src/models/Utils";
import MiniChiasm from "../../_Common/MiniChiasm";
import ChiasmGlyph from "../../_Common/ChiasmGlyph";
import { formatSpeakerName } from "../../Analysis/Chiasmus/chiasmUtils";
import RefPill from "./RefPill";

// Displayable in a tile: plain-letter mirrored schemes deep enough to be
// interesting, short enough not to scroll (ABCCBA … up to 12 lines).
const displayable = (c) => /^[A-Z]+$/.test(c.scheme || "") && c.scheme.length >= 6 && c.scheme.length <= 12;

/**
 * One sampled chiasm rendered as its mirrored structure — indent tracks the
 * letter depth in, then back out. A live taste of /analysis/chiasmus.
 */
export default function ChiasmusTile({ seed }) {
  const [chiasm, setChiasm] = useState(null);

  useEffect(() => {
    let cancelled = false;
    BoMOnlineAPI({ chiasmus: true })
      .then(({ chiasmus }) => {
        const list = Object.values(chiasmus || {}).filter(displayable);
        if (!list.length || cancelled) return null;
        const pick = list[(seed || 1) % list.length];
        return BoMOnlineAPI({ chiasm: [pick.chiasmus_id] });
      })
      .then((r) => {
        if (cancelled || !r) return;
        const full = Object.values(r.chiasm || {})[0];
        if (full?.lines?.length) setChiasm(full);
      });
    return () => {
      cancelled = true;
    };
  }, [seed]);

  if (!chiasm) return null;
  const speaker = chiasm.speaker;
  const speakerName = speaker?.name ? formatSpeakerName(speaker.name) : null;
  return (
    <div className="samplerTileInner chiasmusTile">
      <h3 className="tileHeading">
        <Link to="/analysis/chiasmus">{label("chiasmus")}</Link>
      </h3>
      <div className="chiasmusTileHead">
        <div className="chiasmusTileHeadTop">
          <ChiasmGlyph
            scheme={chiasm.scheme}
            lineLengths={chiasm.lines?.map((l) => (l.line_text || "").length)}
            size={40}
            title={chiasm.title || label("chiasmus")}
          />
          {speaker?.person_slug ? (
            <div className="chiasmusTileSpeaker">
              <img
                className="chiasmusTileAvatar"
                loading="lazy"
                width="32"
                height="32"
                alt={speakerName || ""}
                src={`${assetUrl}/people/${speaker.person_slug}`}
                onError={(e) => (e.target.style.display = "none")}
              />
              {speakerName ? <span className="chiasmusTileSpeakerName">{speakerName}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="chiasmusTileHeadText">
          {chiasm.title ? <span className="chiasmusTileTitle">{chiasm.title}</span> : null}
          <RefPill refText={chiasm.reference} />
        </div>
      </div>
      <MiniChiasm lines={chiasm.lines} className="chiasmusTileLines" />
      <Link to={`/analysis/chiasmus/${chiasm.chiasmus_id}`} className="tileMoreLink">
        {label("view_in_context")}
      </Link>
    </div>
  );
}
