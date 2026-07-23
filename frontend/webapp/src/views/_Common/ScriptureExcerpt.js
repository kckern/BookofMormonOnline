import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI.js";
import { lookup } from "scripture-guide";
import { label } from "src/models/Utils";
import { slugify, getEnglishReference } from "src/utils/scriptureUtils";
import "../Read/Read.scss";
import "./ScriptureExcerpt.css";

/** Canonicalize abbreviated refs ("ps 67:2" → "Psalm 67:2"). */
export const canonical = (ref) => {
  try {
    return lookup(ref)?.ref || ref;
  } catch {
    return ref;
  }
};

/** "Alma 17:7" → /read/alma-17/7 (first verse for ranges). */
export const readPath = (ref) => {
  const m = /^(.+?)\s+(\d+)(?::(\d+))?/.exec(ref || "");
  if (!m) return null;
  const bookCh = `${m[1].toLowerCase().replace(/\s+/g, "-")}-${m[2]}`;
  return `/read/${bookCh}${m[3] ? `/${m[3]}` : ""}`;
};

/** "Alma 17:7" / "1 Nephi 2:11-12" → chapter ref ("Alma 17") for the read query. */
const chapterRef = (ref) => (/^(.+?\s+\d+)(?::|\s*$)/.exec(ref || "")?.[1] || null);

// Section headings carry a name-disambiguation index as a UNICODE SUBSCRIPT
// ("Isaiah₁ Reassures…") plus a trailing parenthetical ref shown elsewhere.
// Lift the index to a superscript (People-tile convention) and drop the paren.
const SUB_TO_SUP = { "₀": "⁰", "₁": "¹", "₂": "²", "₃": "³", "₄": "⁴", "₅": "⁵", "₆": "⁶", "₇": "⁷", "₈": "⁸", "₉": "⁹" };
const cleanHeading = (h) =>
  (h || "")
    .replace(/｢\d+｣/g, "")
    .replace(/\s*\([^)]*\d+[.:]\d+[^)]*\)\s*$/, "")
    .replace(/[₀-₉]/g, (c) => SUB_TO_SUP[c] || c)
    .trim();

const targetVerseIds = (ref) => {
  try {
    return new Set(lookup(ref)?.verse_ids || []);
  } catch {
    return new Set();
  }
};

/**
 * Renders a scripture reference in the exact Read experience — speaker circle,
 * voice label, section heading + Study button, verse typography — for Book of
 * Mormon refs (via the `read` query), falling back to plain passages for Bible
 * refs the `read` query doesn't serve. Shared by ScripturePopup and any tile
 * that wants inline scripture (e.g. the art tile). Must be wrapped by a
 * `.read-content` element so the Read.scss styles apply.
 *
 * onNavigate fires when a Study link is clicked (so a popup can dismiss).
 */
// Strip the curly/straight quotes an anchor phrase is stored with, so it can be
// substring-matched against the plain verse text.
const cleanPhrase = (p) => (p || "").replace(/[“”"'‘’]/g, "").trim();

// Wrap the first occurrence of `phrase` inside `text` in a highlight <mark>.
// Returns the raw string when there's no phrase or no match (graceful).
const highlightPhrase = (text, phrase) => {
  if (!phrase) return text;
  const idx = text.toLowerCase().indexOf(phrase.toLowerCase());
  if (idx < 0) return text;
  return [
    text.slice(0, idx),
    <mark key="anchor" className="scriptureAnchorMark">{text.slice(idx, idx + phrase.length)}</mark>,
    text.slice(idx + phrase.length),
  ];
};

export default function ScriptureExcerpt({ refText, onNavigate, hideStudy = false, refAsPopup = false, highlight = null }) {
  const anchor = cleanPhrase(highlight);
  const ref = refText ? canonical(refText) : null;
  // One entry per compound segment, IN ORDER — each is either a BoM result
  // ({ sections }) or a Bible/cross-ref result ({ passages }). Keeping the
  // ordered mix (not flattening to sections-OR-passages) is what lets a
  // reference like "Acts 10:3-4; 3 Ne. 27:1; Psalm 35:13" render every segment
  // instead of dropping the Bible ones the moment any BoM section appears.
  const [segments, setSegments] = useState(null);

  useEffect(() => {
    if (!ref) return undefined;
    let cancelled = false;
    setSegments(null);
    // A compound reference ("Omni 1:24; Mormon 1:13-14") spans multiple
    // chapters/books — split it into segments and render each. Each segment is
    // canonicalized on its own; a bare chapter number after ";" ("Alma 5; 7")
    // inherits the previous book.
    let lastBook = "";
    const segRefs = ref
      .split(/\s*;\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((seg) => {
        const withBook = /^[0-9]+\s*[:.]/.test(seg) && lastBook ? `${lastBook} ${seg}` : seg;
        const bookMatch = /^(.+?)\s+\d/.exec(withBook);
        if (bookMatch) lastBook = bookMatch[1];
        return canonical(withBook);
      });
    // fetch each segment's chapter, keeping segment order
    Promise.all(
      segRefs.map((seg) => {
        const ch = chapterRef(seg);
        const wanted = targetVerseIds(seg);
        return BoMOnlineAPI({ read: [ch] }, { useCache: false })
          .then((r) => {
            const chapter = r?.read?.[ch] || (r?.read && Object.values(r.read)[0]) || null;
            const kept = (chapter?.sections || [])
              .map((s) => {
                const blocks = (s.blocks || [])
                  .map((b) => ({ ...b, lines: (b.lines || []).filter((l) => !wanted.size || wanted.has(l.verse_id)) }))
                  .filter((b) => b.lines.length);
                if (!blocks.length) return null;
                const firstShown = blocks[0].lines[0]?.verse_id;
                const sectionFirst = s.blocks?.[0]?.lines?.[0]?.verse_id;
                return { heading: s.heading, ref: s.ref, blocks, partial: firstShown != null && sectionFirst != null && firstShown !== sectionFirst };
              })
              .filter(Boolean);
            if (kept.length) return { sections: kept };
            // Bible / cross-ref segment → plain passages
            return BoMOnlineAPI({ scripture: [seg] }, { useCache: false }).then((sr) => {
              const raw = sr?.scripture;
              const val = raw?.[seg] || (raw && Object.values(raw)[0]) || null;
              return { passages: val?.passages || [] };
            });
          })
          .catch(() => ({ passages: [] }));
      }),
    ).then((results) => {
      if (cancelled) return;
      setSegments(results);
    });
    return () => { cancelled = true; };
  }, [ref]);

  if (!ref) return null;
  if (!segments) return <div className="samplerScriptureLoading">…</div>;
  const hasAny = segments.some((s) => (s.sections?.length || s.passages?.length));
  if (!hasAny) return <div className="samplerScriptureLoading">{label("rp_error_loading")}</div>;

  const renderSection = (s, key) => (
    <div key={key} className="read-section">
      <div className="read-section-header">
        {cleanHeading(s.heading) ? <h4>{cleanHeading(s.heading)}</h4> : null}
        {s.ref ? (
          <p>
            {refAsPopup ? (
              // inside a tile: the ref opens the app-wide scripture popup (same
              // samplerScripture event as RefPill/openScripture) rather than
              // navigating away. Dispatched inline to avoid a circular import.
              <span
                className="scripture_link"
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("samplerScripture", { detail: canonical(s.ref) }));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent("samplerScripture", { detail: canonical(s.ref) }));
                  }
                }}
              >
                {s.ref}
              </span>
            ) : (
              <Link to={`/study/${slugify(getEnglishReference(s.ref))}`} onClick={onNavigate}>
                {s.ref}
                {hideStudy ? null : <button className="btn btn-sm btn-outline-secondary">{label("study_button")}</button>}
              </Link>
            )}
          </p>
        ) : null}
      </div>
      {s.blocks.map((b, i) => (
        <div key={i} className="read-block">
          <div className="left-gutter">
            {b.person_slug ? (
              <img alt={b.voice} src={`${assetUrl}/people/${b.person_slug}`} onError={(e) => (e.target.style.visibility = "hidden")} />
            ) : null}
            {b.voice ? <div className="read-voice">{label(b.voice)}</div> : null}
          </div>
          <div className="main-content">
            <p className="read-scripture">
              {i === 0 && s.partial ? <span className="samplerScriptureEllipsis">… </span> : null}
              {b.lines.map((l) => (
                <span key={l.verse_id} className={`verse_${l.verse_id}`}>
                  <sup>{l.verse_num}</sup>{highlightPhrase(l.text, anchor)}{" "}
                </span>
              ))}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  const renderPassages = (passages, key) => (
    <div key={key} className="read-section">
      {passages.map((p, i) => (
        <div key={i} className="read-block">
          <div className="main-content">
            {p.heading ? <div className="samplerScriptureHeading">{p.heading}</div> : null}
            <p className="read-scripture">
              {(p.verses || []).map((v) => (
                <span key={v.verse_id}><sup>{v.verse}</sup>{v.text}{" "}</span>
              ))}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  // Render every segment in the ORIGINAL order, mixing Read sections and Bible
  // passages as they came.
  return segments.flatMap((seg, si) => {
    if (seg.sections?.length) return seg.sections.map((s, i) => renderSection(s, `s-${si}-${i}`));
    if (seg.passages?.length) return [renderPassages(seg.passages, `p-${si}`)];
    return [];
  });
}
