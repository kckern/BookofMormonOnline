import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI.js";
import { lookup, generateReference } from "scripture-guide";
import { label } from "src/models/Utils";
import { slugify, getEnglishReference, verseIdToSlug } from "src/utils/scriptureUtils";
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

/**
 * "Alma 17:7" → /read/alma.17/7 (first verse for ranges); "Alma 17" →
 * /read/alma.17. Emits the SAME slug Read canonicalizes to (verseIdToSlug /
 * slugify, see useCanonicalReadSlug), so a deeplink never re-navigates on
 * arrival. Falls back to the legacy book-ch/v shape (which Read still parses
 * and canonicalizes with replace) when the ref can't be resolved.
 */
export const readPath = (ref) => {
  const m = /^(.+?)\s+(\d+)(?::(\d+))?/.exec(ref || "");
  if (!m) return null;
  try {
    const head = canonical(`${m[1]} ${m[2]}${m[3] ? `:${m[3]}` : ""}`);
    if (m[3]) {
      const id = lookup(head)?.verse_ids?.[0];
      const slug = id ? verseIdToSlug([id]) : null;
      if (slug) return `/read/${slug}`;
    } else if (lookup(head)?.verse_ids?.length) {
      const slug = slugify(head);
      if (slug) return `/read/${slug}`;
    }
  } catch {
    /* fall through to the legacy shape */
  }
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

// Chapters ("Alma 6", "Alma 7") a segment's verses span, in order. Falls back
// to the segment's own chapter when lookup can't resolve verse ids, and caps
// the per-verse walk so a whole-book ref doesn't generate thousands of refs.
const chaptersOf = (seg, wanted) => {
  const own = chapterRef(seg);
  if (!wanted.size || wanted.size > 400) return own ? [own] : [];
  const out = [];
  wanted.forEach((id) => {
    let ch = null;
    try { ch = chapterRef(generateReference([id])); } catch { ch = null; }
    if (ch && !out.includes(ch)) out.push(ch);
  });
  return out.length ? out : own ? [own] : [];
};

// Filter a `read` chapter to the wanted verses. The API sometimes returns a
// verse's line twice with identical text (Helaman 1:1, Alma 6:8 — seen live);
// drop exact (verse_id, text) repeats. Distinct lines of one verse (a verse
// split across paragraphs, a book superscription/intro) are kept.
const keepSections = (chapter, wanted) => {
  const seen = new Set();
  return (chapter?.sections || [])
    .map((s) => {
      const blocks = (s.blocks || [])
        .map((b) => ({
          ...b,
          lines: (b.lines || []).filter((l) => {
            if (wanted.size && !wanted.has(l.verse_id)) return false;
            const k = `${l.verse_id}\u0000${(l.text || "").trim()}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          }),
        }))
        .filter((b) => b.lines.length);
      if (!blocks.length) return null;
      const firstShown = blocks[0].lines[0]?.verse_id;
      const sectionFirst = s.blocks?.[0]?.lines?.[0]?.verse_id;
      return { heading: s.heading, ref: s.ref, blocks, partial: firstShown != null && sectionFirst != null && firstShown !== sectionFirst };
    })
    .filter(Boolean);
};

// Book superscriptions (§) and italic intros (format contains "i") are part of
// verse 1's record but aren't the verse itself — they render without a verse
// number, so the verse number shows once, on the verse text.
const isFrontMatter = (l) => /§/.test(l.format || "") || /i/.test(l.format || "");

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
// Matching is case-, punctuation- and whitespace-insensitive, and an elided
// anchor ("My soul was rent…the slain") is matched fragment by fragment.
const normWithMap = (s) => {
  let out = "";
  const map = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/[\p{L}\p{N}]/u.test(c)) {
      out += c.toLowerCase();
      map.push(i);
    } else if (out && out[out.length - 1] !== " ") {
      out += " ";
      map.push(i);
    }
  }
  return { out, map };
};
export const highlightPhrase = (text, phrase) => {
  if (!phrase || !text) return text;
  const { out, map } = normWithMap(text);
  const ranges = [];
  phrase
    .split(/…|\.\.\./)
    .map((f) => normWithMap(f).out.trim())
    .filter((f) => f.length >= 3)
    .forEach((f) => {
      const at = out.indexOf(f);
      if (at < 0) return;
      const start = map[at];
      const end = map[at + f.length - 1] + 1;
      if (!ranges.some(([a, b]) => start < b && end > a)) ranges.push([start, end]);
    });
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const parts = [];
  let pos = 0;
  ranges.forEach(([a, b], i) => {
    parts.push(text.slice(pos, a));
    parts.push(<mark key={`anchor-${i}`} className="scriptureAnchorMark">{text.slice(a, b)}</mark>);
    pos = b;
  });
  parts.push(text.slice(pos));
  return parts;
};

export default function ScriptureExcerpt({ refText, onNavigate, hideStudy = false, refAsPopup = false, highlight = null, onBoMSections = null }) {
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
    // Expand each segment to the chapters its verses span (a cross-chapter
    // range like "Alma 6:7-7:1" needs both Alma 6 and Alma 7), and fold
    // adjacent segments in the same chapter ("Alma 32:21; 32:27") into one, so
    // the section renders once with both verses rather than twice.
    const units = [];
    for (const seg of segRefs) {
      const wanted = targetVerseIds(seg);
      const chapters = chaptersOf(seg, wanted);
      const prev = units[units.length - 1];
      if (prev && chapters.length === 1 && prev.chapters.length === 1 && prev.chapters[0] === chapters[0] && wanted.size && prev.wanted.size) {
        wanted.forEach((id) => prev.wanted.add(id));
        prev.segs.push(seg);
        continue;
      }
      units.push({ segs: [seg], chapters, wanted });
    }
    // fetch each unit's chapters, keeping order
    Promise.all(
      units.map(({ segs, chapters, wanted }) =>
        Promise.all(chapters.map((ch) => BoMOnlineAPI({ read: [ch] }, { useCache: false })
          .then((r) => r?.read?.[ch] || (r?.read && Object.values(r.read)[0]) || null)
          .catch(() => null)))
          .then((chs) => {
            const kept = chs.flatMap((chapter) => keepSections(chapter, wanted));
            if (kept.length) return { sections: kept };
            // Bible / cross-ref segment → plain passages
            return Promise.all(segs.map((seg) => BoMOnlineAPI({ scripture: [seg] }, { useCache: false }).then((sr) => {
              const raw = sr?.scripture;
              const val = raw?.[seg] || (raw && Object.values(raw)[0]) || null;
              return val?.passages || [];
            }))).then((ps) => ({ passages: ps.flat() }));
          })
          .catch(() => ({ passages: [] })),
      ),
    ).then((results) => {
      if (cancelled) return;
      setSegments(results);
      // Report whether any segment resolved to actual Book of Mormon content
      // (a Read `sections` result, not a Bible `passages` fallback). The Read
      // experience only serves BoM, so callers use this to hide a "Read" CTA
      // for Bible-only references.
      if (onBoMSections) onBoMSections(results.some((s) => s.sections?.length > 0));
    });
    return () => { cancelled = true; };
  }, [ref]);

  if (!ref) return null;
  if (!segments) return <div className="samplerScriptureLoading isLoading" aria-busy="true">…</div>;
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
              {b.lines.map((l, li) => {
                const prev = b.lines[li - 1];
                const front = isFrontMatter(l);
                // number a verse once: on its first non-front-matter line
                const numbered = !front && !b.lines.slice(0, li).some((p) => p.verse_id === l.verse_id && !isFrontMatter(p));
                const gap = prev && l.verse_id - prev.verse_id > 1;
                return (
                  <span key={`${l.verse_id}-${li}`} className={`verse_${l.verse_id}${/§/.test(l.format || "") ? " heading" : front ? " italic" : ""}`}>
                    {gap ? <span className="samplerScriptureEllipsis">… </span> : null}
                    {numbered ? <sup>{l.verse_num}</sup> : null}{highlightPhrase(l.text, anchor)}{" "}
                  </span>
                );
              })}
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
