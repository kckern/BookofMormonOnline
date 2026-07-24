import React from "react";
import Parser from "html-react-parser";
import ReactTooltip from "react-tooltip";
import { parse } from "node-html-parser";
import { parseApparatus } from "./ATV/parseATV";
import { ATVApparatus } from "./ATV/ATVApparatus";

function ATVHeader({ atvHTML }) {
  if (!atvHTML) return null;
  // atvHTML is the <div class='source'> outerHTML. Parse to its inner apparatus
  // so the units render INSIDE a rebuilt .source wrapper (CSS targets .atv .source).
  const inner = parse(atvHTML).querySelector(".source");
  const src = inner ? inner.innerHTML : atvHTML;
  const { segments } = parseApparatus(src);
  if (!segments.length) return null;

  return (
    <>
      <div className="atv">
        <div className="source">
          {segments.map((seg, i) => (
            <React.Fragment key={i}>
              {i > 0 ? " " : ""}
              {seg.kind === "text" ? Parser(seg.text) : <ATVApparatus readings={seg.readings} />}
            </React.Fragment>
          ))}
        </div>
      </div>
      <ReactTooltip id="atv-tooltip" place="top" effect="solid" />
    </>
  );
}

export { ATVHeader };
