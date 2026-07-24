import React from "react";
import { faxCandidates } from "./faxVersions";
import { WITNESSES } from "./apparatus";
import { FaxCrop } from "./FaxCrop";
import "./WitnessPeek.scss";

/**
 * Tier-1 hover peek (spec §6.4): a tiny decoration card for ONE reading. It
 * shows a single crop from the EARLIEST geometry-bearing witness plus a one-line
 * label ("1837 · +N later editions"). Everything here is also in the compare
 * modal, so when there is no geometry-bearing witness — or no verseId (prose
 * body, §6.4 trap) — we render the label line alone: no crop, no empty frame.
 */
export function WitnessPeek({ reading, verseId }) {
  if (!reading) return null;
  const sigla = reading.sigla || [];
  const candidates = faxCandidates(sigla);
  const earliest = candidates[0] || null;
  const others = Math.max(0, candidates.length - 1);

  const labelLine = earliest
    ? `${earliest.label}${
        others ? ` · +${others} later edition${others > 1 ? "s" : ""}` : ""
      }`
    : sigla
        .map((s) => WITNESSES[s] && WITNESSES[s].label)
        .filter(Boolean)
        .join(" · ");

  const showCrop = earliest && verseId != null;

  return (
    <span className="atv-peek" role="tooltip">
      {showCrop && (
        <FaxCrop
          version={earliest.version}
          selector={`ids/${verseId}`}
          width={200}
          alt={earliest.label}
        />
      )}
      <span className="atv-peek-label">{labelLine}</span>
    </span>
  );
}
