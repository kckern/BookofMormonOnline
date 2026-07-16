import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI.js";
import { lookup } from "scripture-guide";
import { label } from "src/models/Utils";
import { slugify, getEnglishReference } from "src/utils/scriptureUtils";
import "./ScripturePopup.css";
import "../Read/Read.scss";

/** Canonicalize abbreviated refs ("ps 67:2" → "Psalm 67:2") — index data uses
 * short forms the scripture query doesn't parse. */
const canonical = (ref) => {
  try {
    return lookup(ref)?.ref || ref;
  } catch {
    return ref;
  }
};

/** Any scripture_link / RefPill opens a ref via this — one popup instance lives
 * in Main, app-wide. */
export const openScripture = (ref) =>
  window.dispatchEvent(new CustomEvent("samplerScripture", { detail: canonical(ref) }));

/** /read deep link: "Alma 17:7" → /read/alma-17/7 (first verse for ranges). */
const readPath = (ref) => {
  const m = /^(.+?)\s+(\d+)(?::(\d+))?/.exec(ref || "");
  if (!m) return null;
  const bookCh = `${m[1].toLowerCase().replace(/\s+/g, "-")}-${m[2]}`;
  return `/read/${bookCh}${m[3] ? `/${m[3]}` : ""}`;
};

/** "Alma 17:7" / "1 Nephi 2:11-12" → chapter ref ("Alma 17") for the read query. */
const chapterRef = (ref) => (/^(.+?\s+\d+)(?::|\s*$)/.exec(ref || "")?.[1] || null);

// Section headings carry a name-disambiguation index as a UNICODE SUBSCRIPT
// ("Isaiah₁ Reassures…") plus a trailing parenthetical ref we already show in
// the header. Lift the index to a superscript (the site convention on People
// tiles) and drop the redundant parenthetical.
const SUB_TO_SUP = { "₀": "⁰", "₁": "¹", "₂": "²", "₃": "³", "₄": "⁴", "₅": "⁵", "₆": "⁶", "₇": "⁷", "₈": "⁸", "₉": "⁹" };
const cleanHeading = (h) =>
  (h || "")
    .replace(/｢\d+｣/g, "")
    .replace(/\s*\([^)]*\d+[.:]\d+[^)]*\)\s*$/, "") // trailing "(Isaiah 7.1–9)"
    .replace(/[₀-₉]/g, (c) => SUB_TO_SUP[c] || c)
    .trim();

/** The verse_ids covered by the requested ref (to filter the chapter blocks). */
const targetVerseIds = (ref) => {
  try {
    return new Set(lookup(ref)?.verse_ids || []);
  } catch {
    return new Set();
  }
};

/**
 * App-wide scripture reader popup. Renders in the exact Read experience —
 * speaker attribution, typography, line height — for Book of Mormon refs (via
 * the `read` query), and falls back to plain passages for Bible refs (which
 * the `read` query doesn't serve). Click-away / Esc dismissable.
 */
export default function ScripturePopup() {
  const [ref, setRef] = useState(null);
  const [sections, setSections] = useState(null); // Read-style [{heading, partial, blocks}]
  const [passages, setPassages] = useState(null); // Bible fallback
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const open = (e) => { setRef(e.detail); setSections(null); setPassages(null); };
    window.addEventListener("samplerScripture", open);
    return () => window.removeEventListener("samplerScripture", open);
  }, []);

  useEffect(() => {
    if (!ref) return undefined;
    let cancelled = false;
    setLoading(true);
    const ch = chapterRef(ref);
    const wanted = targetVerseIds(ref);
    // Try the Read data source first (BoM: full styling + speaker attribution).
    BoMOnlineAPI({ read: [ch] }, { useCache: false })
      .then((r) => {
        if (cancelled) return null;
        const chapter = r?.read?.[ch] || (r?.read && Object.values(r.read)[0]) || null;
        // Keep the SECTION structure so each excerpt carries its heading. Trim
        // blocks/lines to the requested verses; mark a section "partial" when
        // the excerpt starts after the section's first verse (→ leading ellipsis).
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
        if (kept.length) { setSections(kept); setLoading(false); return null; }
        // Not in the BoM read corpus (Bible / cross-ref) — fall back to scripture.
        return BoMOnlineAPI({ scripture: [ref] }, { useCache: false }).then((sr) => {
          if (cancelled) return;
          const raw = sr?.scripture;
          const val = raw?.[ref] || (raw && Object.values(raw)[0]) || null;
          setPassages(val?.passages || []);
          setLoading(false);
        });
      })
      .catch(() => { if (!cancelled) { setPassages([]); setLoading(false); } });
    const onKey = (e) => e.key === "Escape" && setRef(null);
    window.addEventListener("keydown", onKey);
    return () => { cancelled = true; window.removeEventListener("keydown", onKey); };
  }, [ref]);

  if (!ref) return null;
  const to = readPath(ref);
  const hasSections = sections && sections.length > 0;
  const hasPassages = passages && passages.length > 0;
  return (
    <div className="samplerScripturePopup" role="dialog" aria-modal="true" onClick={() => setRef(null)}>
      <div className="samplerScriptureCard" onClick={(e) => e.stopPropagation()}>
        <div className="samplerScriptureHead">
          <b>{ref}</b>
          <button aria-label="Close" onClick={() => setRef(null)}>×</button>
        </div>
        {/* .read-content .read-section scope makes the Read.scss styles apply */}
        <div className="samplerScriptureBody read-content">
          {loading && !hasSections && !hasPassages ? (
            <div className="samplerScriptureLoading">…</div>
          ) : hasSections ? (
            sections.map((s, si) => (
              <div key={si} className="read-section">
                {/* the excerpt's section heading always sits on top, with the
                    same Study button as the Read view */}
                <div className="read-section-header">
                  {cleanHeading(s.heading) ? <h4>{cleanHeading(s.heading)}</h4> : null}
                  {s.ref ? (
                    <p>
                      <Link to={`/study/${slugify(getEnglishReference(s.ref))}`} onClick={() => setRef(null)}>
                        {s.ref}
                        <button className="btn btn-sm btn-outline-secondary">{label("study_button")}</button>
                      </Link>
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
                        {/* leading ellipsis when the excerpt starts mid-section */}
                        {i === 0 && s.partial ? <span className="samplerScriptureEllipsis">… </span> : null}
                        {b.lines.map((l) => (
                          <span key={l.verse_id} className={`verse_${l.verse_id}`}>
                            <sup>{l.verse_num}</sup>{l.text}{" "}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : hasPassages ? (
            <div className="read-section">
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
          ) : (
            <div className="samplerScriptureLoading">{label("rp_error_loading")}</div>
          )}
        </div>
        {to ? (
          <div className="samplerScriptureFoot">
            <Link className="samplerScriptureReadLink tileMoreLink" to={to} onClick={() => setRef(null)}>
              {label("read")}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
