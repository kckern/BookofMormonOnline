import React from "react";
import Parser from "html-react-parser";
import ReactTooltip from "react-tooltip";
import { parse } from "node-html-parser";
import { parseApparatus } from "./ATV/parseATV";
import { WITNESSES } from "./ATV/apparatus";

const tipFor = (sigla) =>
  sigla.map((s) => WITNESSES[s] && WITNESSES[s].label).filter(Boolean).join("; ");

// One reading's states, in order: original, then (arrow + next state) per correction.
function renderStates(states) {
  const out = [];
  states.forEach((st, i) => {
    if (i > 0) out.push(<span className="atv-change" key={`c${i}`}>⮕ </span>);
    out.push(
      <React.Fragment key={`s${i}`}>
        {st.omitted ? <b>∅</b> : Parser(st.content)}
      </React.Fragment>
    );
  });
  return out;
}

function Reading({ reading }) {
  return (
    <span
      className="atv-string"
      data-indexes={reading.sigla.join("")}
      data-tip={tipFor(reading.sigla)}
      data-for="atv-tooltip"
    >
      {renderStates(reading.states)}
    </span>
  );
}

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
              {seg.kind === "text" ? (
                Parser(seg.text)
              ) : (
                seg.readings.map((r, j) => (
                  <React.Fragment key={j}>
                    {j > 0 ? " / " : ""}
                    <Reading reading={r} />
                  </React.Fragment>
                ))
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      <ReactTooltip id="atv-tooltip" place="top" effect="solid" />
    </>
  );
}

export { ATVHeader };
