import React from "react";
import Parser from "html-react-parser";
import { parse } from "node-html-parser";
import { lookupReference } from "scripture-guide";
import { parseApparatus } from "./ATV/parseATV";
import { ATVApparatus } from "./ATV/ATVApparatus";

function ATVHeader({ atvHTML, reference }) {
  if (!atvHTML) return null;
  // atvHTML is the <div class='source'> outerHTML. Parse to its inner apparatus
  // so the units render INSIDE a rebuilt .source wrapper (CSS targets .atv .source).
  const inner = parse(atvHTML).querySelector(".source");
  const src = inner ? inner.innerHTML : atvHTML;
  const { segments } = parseApparatus(src);
  if (!segments.length) return null;

  // The header apparatus cites the commentary's OWN verse, so its pills carry a
  // real verseId — the compare modal and witness peek crop that verse's scans.
  const verseId = (lookupReference(reference || "") || {}).verse_ids?.[0] || null;

  return (
    <div className="atv">
      <div className="source">
        {segments.map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 ? " " : ""}
            {seg.kind === "text" ? (
              Parser(seg.text)
            ) : (
              <ATVApparatus readings={seg.readings} verseId={verseId} reference={reference} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export { ATVHeader };
