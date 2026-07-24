import React, { useRef, useState } from "react";
import Parser from "html-react-parser";
import { VariantCompare } from "./VariantCompare";
import { WitnessPeek } from "./WitnessPeek";

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

function Reading({ reading, onOpen, onPeekEnter, onPeekLeave }) {
  return (
    <span
      className="atv-string"
      data-indexes={reading.sigla.join("")}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onMouseEnter={onPeekEnter}
      onMouseLeave={onPeekLeave}
    >
      {renderStates(reading.states)}
    </span>
  );
}

/** One variation unit's readings as pills, joined by " / ". `variant` is a
 *  styling hook ("inline" in prose; undefined for the header box). Each pill is
 *  an operable button: click / Enter / Space open the compare modal for the
 *  whole unit; hover (mouse only) shows a small witness peek for that reading.
 *  `verseId` locates the verse in the scans (null for prose-body units, whose
 *  citations point at OTHER verses — §6.4: no crops there). */
export function ATVApparatus({ readings, variant, verseId = null, reference }) {
  const [open, setOpen] = useState(false);
  const [peekReading, setPeekReading] = useState(null);
  const peekTimer = useRef(null);

  const clearPeekTimer = () => {
    if (peekTimer.current) {
      clearTimeout(peekTimer.current);
      peekTimer.current = null;
    }
  };
  const hidePeek = () => {
    clearPeekTimer();
    setPeekReading(null);
  };
  const showPeek = (reading) => (e) => {
    // No peek on touch — tap opens the modal instead.
    if (e && e.pointerType === "touch") return;
    clearPeekTimer();
    peekTimer.current = setTimeout(() => setPeekReading(reading), 250);
  };
  const openModal = () => {
    hidePeek();
    setOpen(true);
  };

  if (!readings || !readings.length) return null;
  const cls = "atv-apparatus" + (variant ? ` atv-${variant}` : "");
  return (
    <span className={cls}>
      {readings.map((r, j) => (
        <React.Fragment key={j}>
          {j > 0 ? " / " : ""}
          <Reading
            reading={r}
            onOpen={openModal}
            onPeekEnter={showPeek(r)}
            onPeekLeave={hidePeek}
          />
        </React.Fragment>
      ))}
      {peekReading && !open && <WitnessPeek reading={peekReading} verseId={verseId} />}
      {open && (
        <VariantCompare
          unit={{ readings }}
          verseId={verseId}
          reference={reference}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}
