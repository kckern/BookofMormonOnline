import React from "react";
import { Link } from "react-router-dom";
import { label } from "src/models/Utils";
import { flatten, clampWords } from "./textUtils";
import { RevealProvider } from "./_ds/Reveal";
import TileDeepLink from "./_ds/TileDeepLink";
import TileImage from "./_ds/TileImage";
import ExpandableText from "./ExpandableText";

/**
 * The witness a payload features: its first row with an editorially prepared
 * money quote (NEVER a teaser/transcript — that would fabricate an attribution).
 * A pure function of the rows, so a payload restored from the Home session on
 * Back features the same witness (blind audit witness-E2: a module-level "last
 * featured" guard plus a WeakMap on the payload object picked a different
 * witness after every Back). Variety down the feed is arranged on the batch
 * payload instead (archiveFeed.arrangeWitnesses).
 */
export const featuredWitness = (rows) =>
  (Array.isArray(rows) ? rows : []).find((x) => x?.principal && x?.moneyQuote) || null;

const initials = (name) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

// Editorial marks in a money quote — [Name] (supplied referent) and [...] (elision)
// — are set apart from the quoted words: rendered in grey Roboto, not scripture.
const BRACKET_RE = /(\[[^\]]*\])/g;
const withBrackets = (text) =>
  String(text || "")
    .split(BRACKET_RE)
    .map((part, i) =>
      part.startsWith("[") && part.endsWith("]")
        ? <span key={i} className="editorialMark">{part}</span>
        : part
    );

// Source lines carry light Markdown (publication titles in _italics_). Render
// _x_ / *x* as <em>; an underscore inside a word (snake_case) is left alone.
const MD_RE = /(?<![\w*])([_*])(?=\S)([^_*]+?)(?<=\S)\1(?![\w*])/g;
// Source lines also carry Markdown backslash escapes ("(April 12, 1875): \\[3\\]");
// unescape them so the reader sees "[3]" (blind audit witness-A7).
const unescapeMd = (t) => t.replace(/\\([\\`*_{}[\]()#+\-.!|])/g, "$1");
export const inlineMarkdown = (text) => {
  const s = unescapeMd(String(text || ""));
  const out = [];
  let last = 0;
  let m;
  MD_RE.lastIndex = 0;
  while ((m = MD_RE.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    out.push(<em key={m.index}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
};

/**
 * Clamp a Markdown source line to `n` words without breaking its emphasis: a
 * cut inside an _italic_ span closes the span before the ellipsis, so the
 * reader never sees a literal "_" (blind audit R5 witness-A7).
 */
export const clampMarkdownWords = (text, n) => {
  const cut = clampWords(text, n);
  if (cut === text) return cut;
  const m = /^(.*?)(\s*…)?$/s.exec(cut);
  let body = m[1];
  const tail = m[2] || "";
  const open = /(?<![\w*])([_*])(?=\S)[^_*]*$/.exec(body);
  if (open) body = body.replace(/\s+$/, "") + open[1];
  return body + tail;
};

/**
 * A single featured Book of Mormon witness — Harris, the Cowderys, the Whitmers,
 * Hyrum & Samuel Smith — from the 'witnesses' history archive. Large portrait,
 * name, their statement (money quote), and source. A third-party account names
 * its reporter as a meta line above the quote (not inside the clamp, where it
 * ate the first line); a long quote clamps with a reversible Layer-1 reveal.
 * The portrait goes to the witness page; the CTA lands on the quoted statement
 * (/history/witnesses/<witness>/<source>, which opens that source).
 * (A monogram stands in if a portrait fails to load.)
 */
export default function WitnessTile({ data }) {
  const w = featuredWitness(data);
  if (!w) return null;
  const quote = flatten(w.moneyQuote);
  // flatten() strips HTML but keeps Markdown marks; clamp on words, then render.
  const source = w.source ? clampMarkdownWords(flatten(w.source), 18) : null;
  const page = w.witnessSlug ? `/history/witnesses/${w.witnessSlug}` : "/history/witnesses";
  const to = w.witnessSlug && w.slug ? `${page}/${w.slug}` : page;
  const reporter = !w.isWitnessVoice && w.speaker ? w.speaker : null;
  return (
    <RevealProvider>
      <div className="samplerTileInner witnessTile">
        <h3 className="tileHeading">
          <Link to="/history/witnesses">{label("witnesses")}</Link>
        </h3>
        <div className="witnessFeatured">
          <Link to={page} className="witnessLeft">
            <span className="witnessHero">
              {w.witnessSlug ? (
                <TileImage
                  path={`history/witnesses/people/${w.witnessSlug}.jpg`}
                  sizes="56px"
                  alt=""
                  onError={(e) => { e.target.style.display = "none"; e.target.parentNode.classList.add("mono"); }}
                />
              ) : null}
              <span className="witnessMono" aria-hidden="true">{initials(w.principal)}</span>
            </span>
            <span className="witnessName">{w.principal}</span>
          </Link>
          <span className="witnessBody">
            {reporter ? <span className="witnessSpeaker">{reporter}:</span> : null}
            <ExpandableText className="witnessStatementWrap" lines={4} fade persistKey={w.slug ? `witness:${w.slug}` : undefined}>
              <span className="witnessStatement">&ldquo;{withBrackets(quote)}&rdquo;</span>
            </ExpandableText>
            {source ? <span className="witnessSource">{inlineMarkdown(source)}</span> : null}
          </span>
        </div>
        <TileDeepLink to={to} verb="seeInContext" />
      </div>
    </RevealProvider>
  );
}
