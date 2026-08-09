import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import Parser from "html-react-parser";
import { label } from "src/models/Utils";
import { renderBaseUrl } from "src/models/BoMOnlineAPI";
import FaxVerseZoom from "../../Facsimiles/FaxVerseZoom";
import { WITNESSES } from "./apparatus";
import { FAX_FOR_SIGLUM, faxCandidates } from "./faxVersions";
import { FaxCrop } from "./FaxCrop";
import "./VariantCompare.scss";

/**
 * Translate through the label dictionary when a key resolves, else fall back to
 * literal English. `label()` returns " " when no dictionary is loaded and the
 * key itself when the dictionary lacks the key — both mean "no translation", so
 * we use the caller's fallback in those cases.
 */
const lbl = (key, fallback) => {
  const v = label(key);
  return !v || v === " " || v === key ? fallback : v;
};

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** One reading's states, joined by ⮕: original, then each correction. */
function ReadingText({ states }) {
  return (
    <span className="atv-vc-text">
      {states.map((st, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="atv-vc-arrow">⮕ </span>}
          {st.omitted ? <b>∅</b> : Parser(st.content)}
        </React.Fragment>
      ))}
    </span>
  );
}

/** Provenance lines from the correction chain (spec P7): "corrected by …". */
function ProvenanceLines({ states }) {
  const lines = states
    .map((st) => st.via && st.via.label)
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <ul className="atv-vc-provenance">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

/** The witness evidence under one reading: crops + label-only gaps (spec §6.5). */
function WitnessEvidence({ reading, verseId, reference, onZoom }) {
  const selector = `ids/${verseId}`;
  // Treatment 2: an omission reading (its resulting state is ∅) still shows the
  // crop — the image is the evidence the phrase is absent.
  const isOmission =
    reading.states.length > 0 &&
    reading.states[reading.states.length - 1].omitted;

  // Treatment 1 & 4: geometry-bearing witnesses, chronological.
  const candidates = faxCandidates(reading.sigla);
  // Treatment 3: sigla with a witness but no page geometry — label only.
  const noGeom = reading.sigla.filter(
    (s) => FAX_FOR_SIGLUM[s] && !FAX_FOR_SIGLUM[s].hasGeometry
  );

  // A lone crop with no label-only gaps fills the reading's full width, so render
  // it at a larger crop so the stretched image stays crisp.
  const soleFigure = candidates.length === 1 && noGeom.length === 0;

  return (
    <div className="atv-vc-witnesses">
      {candidates.map((c) => {
        // Treatment 4: placeholder scans (J/O) are captioned with the SCAN's
        // real name, never Skousen's edition name.
        const caption = isOmission
          ? lbl("atv_words_absent", "these words do not appear")
          : c.exact
          ? c.label
          : c.scanTitle;
        // Visible caption stays edition-only; the crop's alt carries the
        // reference too (spec §6.7: "1837 Kirtland edition, 1 Nephi 1:3").
        const alt = reference ? `${caption}, ${reference}` : caption;
        return (
          <figure className="atv-vc-fig" key={c.siglum}>
            <button
              type="button"
              className="atv-vc-cropbtn"
              onClick={() => onZoom({ version: c.version, selector, caption, alt })}
              aria-label={`${lbl("atv_zoom_image", "Zoom")}: ${alt}`}
            >
              <FaxCrop version={c.version} selector={selector} alt={alt} width={soleFigure ? 800 : 400} />
            </button>
            <figcaption className="atv-vc-cap">{caption}</figcaption>
            {!c.exact && (
              <div className="atv-vc-note">
                {lbl("atv_nearest_scan", "nearest available scan")}
              </div>
            )}
          </figure>
        );
      })}

      {noGeom.map((s) => (
        <div className="atv-vc-gap" key={s}>
          {s === "0" ? (
            // Treatment 3 (siglum 0): the reading is attested but there is no
            // page scan to crop.
            <span>
              {lbl(
                "atv_original_manuscript_gap",
                "Original Manuscript — reading attested; page image not yet indexed."
              )}
            </span>
          ) : (
            // The other no-geometry editions: label only, no crop, no frame.
            <span>{WITNESSES[s] ? WITNESSES[s].label : s}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function ReadingBlock({ reading, verseId, reference, onZoom }) {
  return (
    <section className="atv-vc-reading">
      <ReadingText states={reading.states} />
      <ProvenanceLines states={reading.states} />
      <WitnessEvidence reading={reading} verseId={verseId} reference={reference} onZoom={onZoom} />
    </section>
  );
}

/**
 * Full-res zoom of a single crop, portalled above the compare panel. Reuses the
 * FaxVerseZoom hover-magnifier at the native-res (`wfull`) render. Its Escape
 * handler captures (and stopImmediatePropagation) so closing the lightbox does
 * not also dismiss the VariantCompare modal behind it.
 */
function CropLightbox({ version, selector, caption, alt, onClose }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
      e.preventDefault();
      onCloseRef.current();
    };
    // Capture phase so this fires before VariantCompare's bubble-phase Escape.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  const src = `${renderBaseUrl}/fax/render/${version}/crop/wfull/${selector}.jpg`;
  // React portals bubble events through the React tree, not the DOM — stop here so
  // a backdrop click closes only the lightbox, not the VariantCompare modal behind it.
  return ReactDOM.createPortal(
    <div
      className="atv-vc-lightbox-backdrop"
      onClick={(e) => { e.stopPropagation(); onCloseRef.current(); }}
    >
      <div
        className="atv-vc-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={alt || caption}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="atv-vc-lightbox-close"
          aria-label={lbl("close", "Close")}
          onClick={() => onCloseRef.current()}
        >
          ×
        </button>
        <div className="atv-vc-lightbox-img">
          <FaxVerseZoom src={src} />
        </div>
        {(alt || caption) && <div className="atv-vc-lightbox-cap">{alt || caption}</div>}
      </div>
    </div>,
    document.body
  );
}

/**
 * Modal that compares one variation unit's competing readings across editions in
 * facsimile. Portalled to document.body so it floats above the draggable
 * commentary popup. Traps focus, closes on ×/Escape/backdrop, and stops keydown
 * propagation so Commentary's arrow/Tab handler does not also fire.
 */
export function VariantCompare({ unit, verseId, reference, onClose }) {
  const panelRef = useRef(null);
  // The crop currently opened in the full-res lightbox ({version, selector, ...}).
  const [zoom, setZoom] = useState(null);
  // Keep the latest onClose without re-running the mount effect (which would
  // thrash focus restore on every parent render).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const prevFocus = document.activeElement;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKeyDown);

    const first =
      (panelRef.current &&
        panelRef.current.querySelector(FOCUSABLE)) ||
      panelRef.current;
    if (first && first.focus) first.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };
  }, []);

  const onPanelKeyDown = (e) => {
    // Keep Commentary.js's own arrow/Tab keyboard listener from also firing.
    e.stopPropagation();
    if (e.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.prototype.slice
      .call(panelRef.current.querySelectorAll(FOCUSABLE))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!focusables.length) {
      e.preventDefault();
      return;
    }
    const firstEl = focusables[0];
    const lastEl = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  const readings = (unit && unit.readings) || [];

  return ReactDOM.createPortal(
    <div
      className="atv-vc-backdrop"
      data-testid="atv-vc-backdrop"
      onClick={() => onCloseRef.current()}
    >
      <div
        className="atv-vc-panel"
        role="dialog"
        aria-modal="true"
        aria-label={lbl("atv_compare_readings", "Compare readings") + " — " + reference}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
      >
        <header className="atv-vc-header">
          <h2 className="atv-vc-ref">{reference}</h2>
          <button
            type="button"
            className="atv-vc-close"
            aria-label={lbl("close", "Close")}
            onClick={() => onCloseRef.current()}
          >
            ×
          </button>
        </header>
        <div className="atv-vc-body">
          {readings.map((reading, i) => (
            <ReadingBlock key={i} reading={reading} verseId={verseId} reference={reference} onZoom={setZoom} />
          ))}
        </div>
      </div>
      {zoom && <CropLightbox {...zoom} onClose={() => setZoom(null)} />}
    </div>,
    document.body
  );
}
