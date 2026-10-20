import React from "react";
import Parser from "html-react-parser";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { renderMoneyQuote } from "../moneyQuote";
import { displayDate } from "./displayDate";

/**
 * The content of a history archive document — moved verbatim out of PopUp.js's
 * History(), together with the field-adaptive locals it depends on.
 *
 * Field-adaptive across all four archives (reception / translation / witnesses /
 * joseph-smith): every part renders only when its data is present, so a doc
 * missing a source, date, quote, teaser, or facsimile never shows a broken or
 * dangling element.
 *
 * historyMeta() is exported separately because the modal renders those parts in
 * its HEADER, above the body — so both need the same computation.
 */
export function historyMeta(doc) {
  if (!doc) return [];
  const rawDate = displayDate(doc.date);
  const dateText = rawDate && rawDate !== "Invalid date" ? rawDate : "";
  return [...new Set([doc.source, doc.principal, doc.author, dateText].filter(Boolean))];
}

/** Tab title for a history doc: "Document (Source)", without "(undefined)". */
export function historyDocTitle(doc) {
  if (!doc) return "";
  const title = doc.document || doc.slug || "";
  return doc.source ? `${title} (${doc.source})` : title;
}

/**
 * The modal's heading. Witness records title themselves "Witness — Reporter",
 * which reads "Martin Harris — Martin Harris" for a first-hand statement: say
 * the name once, with its source when that adds something (blind audit R5
 * witness-D5).
 */
export function historyHeading(doc) {
  const title = String(doc?.document || "").trim();
  const m = /^(.+?)\s+[—–-]\s+(.+)$/.exec(title);
  if (!m || m[1].trim() !== m[2].trim()) return title;
  const name = m[1].trim();
  const source = String(doc.source || "").trim();
  return source && source !== name ? `${name} — ${source}` : name;
}

/**
 * Light Markdown emphasis (*x* / _x_) in a transcript, outside HTML tags only
 * (an href's underscores stay as they are). A plain-text interview whose turns
 * are marked "*Speaker:* …" gets one paragraph per turn; it rendered as one run
 * of raw asterisks (blind audit R5 witness-D5).
 */
const EMPH_RE = /(?<![\w*])([*_])(?=\S)([^*_\n]+?)(?<=\S)\1(?![\w*])/g;
export function transcriptHtml(text) {
  let src = String(text || "");
  const isHtml = /<[a-z][^>]*>/i.test(src);
  if (!isHtml) {
    const turns = src.split(/(?=\*[^*\n]{1,60}:\*)/).map((t) => t.trim()).filter(Boolean);
    if (turns.length > 1) src = turns.map((t) => `<p>${t}</p>`).join("");
  }
  return src
    .split(/(<[^>]+>)/)
    .map((part) => (part.startsWith("<") ? part : part.replace(EMPH_RE, "<em>$2</em>")))
    .join("");
}

export default function HistoryBody({ data }) {
  const doc = data;
  if (!doc) return null;

  // Field-adaptive across all four archives (reception / translation / witnesses
  // / joseph-smith): every part renders only when its data is present, so a doc
  // missing a source, date, quote, teaser, or facsimile never shows a broken/
  // dangling element (cf. Home/tiles ArchiveDocTile's filtered-field approach).
  const rawDate = displayDate(doc.date);
  const dateText = rawDate && rawDate !== "Invalid date" ? rawDate : "";
  const metaParts = [...new Set([doc.source, doc.principal, doc.author, dateText].filter(Boolean))];
  const hasQuote = !!(doc.money_quote || doc.mini_quote);
  const teaserText = typeof doc.teaser === "string" ? doc.teaser : "";
  const strip = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
  const titleStripped = strip(doc.document);
  const teaserStripped = strip(teaserText);
  const quoteStripped = strip(doc.money_quote || doc.mini_quote);
  const transcriptStripped = strip(doc.transcript);
  const teaserDupesTitle = !!teaserStripped && teaserStripped === titleStripped;
  // Short statements (e.g. witnesses) store the same text as BOTH money_quote and
  // transcript — don't render it twice. Keep the transcript only when it adds
  // materially more than the quote (reception clippings: short quote, long text).
  const transcriptDupesQuote =
    !!quoteStripped && !!transcriptStripped &&
    (transcriptStripped === quoteStripped ||
      (transcriptStripped.includes(quoteStripped) &&
        transcriptStripped.length < quoteStripped.length * 1.15));
  const pageCount = Number(doc.pages) || 0;
  // Reception transcripts open with the citation as their first paragraph;
  // the citation already renders above, so drop that leading repeat.
  // Compared letters-and-digits only, entities dropped: the transcript copy is
  // often typed slightly differently ("10 February1838", &rsquo; vs ’) and
  // printed twice in a row (blind audit history-D5).
  const compact = (h) => String(h || "").replace(/<[^>]+>/g, "").replace(/&[a-z0-9#]+;/gi, "").replace(/[^a-z0-9]+/gi, "").toLowerCase();
  const citationCompact = compact(doc.citation);
  let transcript = doc.transcript || "";
  const firstPara = /^\s*<p[^>]*>([\s\S]*?)<\/p>\s*/i.exec(transcript);
  if (citationCompact && firstPara && compact(firstPara[1]) === citationCompact) {
    transcript = transcript.slice(firstPara[0].length);
  }

  return (
      <div id="my-tab-content" className="tab-content">
        <div className="tab-pane active" id="home" role="tabpanel">
          {doc.document ? <h3>{historyHeading(doc)}</h3> : null}

          {hasQuote ? (
            <blockquote className="historyPopupQuote">
              {doc.quote_speaker && !doc.quote_is_witness_voice ? (
                <span className="historyPopupQuoteBy prefix">{doc.quote_speaker}:</span>
              ) : null}{" "}
              &ldquo;{doc.money_quote
                ? renderMoneyQuote(doc.money_quote, doc.mini_quote)
                : doc.mini_quote}&rdquo;
              {doc.quote_speaker && doc.quote_is_witness_voice ? (
                <cite className="historyPopupQuoteBy">&mdash; {doc.quote_speaker}</cite>
              ) : null}
            </blockquote>
          ) : null}

          {teaserText && !teaserDupesTitle ? (
            <div className="teaser">{Parser(teaserText)}</div>
          ) : null}

          {doc.citation ? (
            <div className="historyPopupCitation">{Parser(String(doc.citation))}</div>
          ) : null}

          {transcript.trim() && !transcriptDupesQuote ? (
            <div className="transcript">{Parser(transcriptHtml(transcript))}</div>
          ) : null}

          {doc.id && pageCount > 0 ? (
            <div className="history_fax">
              {[...Array(pageCount).keys()].map((i) => (
                <img
                  key={i}
                  src={`${assetUrl}/history/fax/${String(doc.id).padStart(4, "0")}.${String(i + 1).padStart(3, "0")}.jpg`}
                  alt={doc.document || ""}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
  );
}
