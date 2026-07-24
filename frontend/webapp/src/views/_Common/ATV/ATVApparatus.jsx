import React from "react";
import Parser from "html-react-parser";
import { WITNESSES } from "./apparatus";

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

/** One variation unit's readings as pills, joined by " / ". `variant` is a
 *  styling hook ("inline" in prose; undefined for the header box). */
export function ATVApparatus({ readings, variant }) {
  if (!readings || !readings.length) return null;
  const cls = "atv-apparatus" + (variant ? ` atv-${variant}` : "");
  return (
    <span className={cls}>
      {readings.map((r, j) => (
        <React.Fragment key={j}>
          {j > 0 ? " / " : ""}
          <Reading reading={r} />
        </React.Fragment>
      ))}
    </span>
  );
}
