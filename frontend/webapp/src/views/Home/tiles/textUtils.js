/** Shared sampler text hygiene: one implementation, every tile. */

// Re-exported so tiles can keep importing translate-with-fallback from here.
export { tr } from "src/models/Utils";

const SUPS = { 1: "¹", 2: "²", 3: "³", 4: "⁴" };
const SUBS = { "₁": "¹", "₂": "²", "₃": "³", "₄": "⁴" };

/**
 * Name-attached disambiguation digits → the app's superscript convention.
 * Source data occasionally uses subscript digits ("Nephi₂'s Trial"); those
 * normalize to superscripts too, so one convention shows everywhere.
 */
export const supDigits = (str) =>
  (str || "")
    .replace(/([A-Za-z])([1-4])\b/g, (m, a, d) => a + SUPS[d])
    .replace(/[₁-₄]/g, (d) => SUBS[d]);

/**
 * Flatten app markup for plain-text contexts: {Name|slug} / [Name|slug] links
 * → display names, HTML stripped, digits superscripted, paren spacing tight.
 */
export const flatten = (html) =>
  supDigits(
    (html || "")
      .replace(/{(.*?)\|(.*?)}/g, "$1")
      .replace(/\[(.*?)\|(.*?)\]/g, "$1")
      // Name<sup>2</sup> → Name² BEFORE tags become spaces; otherwise it flattens
      // to "Alma 2", which scripture detection then reads as a chapter.
      .replace(/<sup>\s*([1-4])\s*<\/sup>/gi, (m, d) => SUPS[d])
      .replace(/<[^>]*>/gi, " ")
      .replace(/\s+/g, " "),
  )
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();

// Editor's working notes left at the end of an index line ("Workmen labor in
// temple metals (paraphrastic)") — never reader-facing (audit matters-07).
const EDITOR_NOTE = /\s*\((?:paraphras\w*|sic|summar\w*|implied|inferred|implicit|approx\w*|loosely|cf\.?)\)\s*$/i;
export const stripEditorNote = (s) => (s || "").replace(EDITOR_NOTE, "").trim();

/** Typographic verse ranges: hyphens between digits render as en-dashes. */
export const enDash = (s) => (s || "").replace(/(\d)\s*-\s*(\d)/g, "$1–$2");

// Function words a word-budget cut must not end on ("Son of Joseph¹, father of…").
const DANGLING = /^(of|and|the|a|an|to|by|in|on|at|for|from|with|or|as|who|whose|which|that)$/i;

/**
 * Word-budget truncation that prefers a sentence boundary in the back half,
 * NEVER cuts mid-word, never strands an open parenthetical, and never ends on
 * a dangling function word.
 */
const isDangling = (w) => DANGLING.test((w || "").replace(/[,;:]$/, ""));
// Phrase mode also refuses to end on a copula or time/relation word: "Land
// established by Nephi, later…", "Lamanites in Shimnilom are…" (audit places-H3).
// …nor on a conjunction or preposition that opens what was cut: "…rejoice
// because…", "…followers under…", "…march past…" (blind audit r4 places-H3).
const PHRASE_DANGLING = /^(is|are|was|were|has|have|had|later|currently|now|then|between|after|before|when|where|while|into|upon|near|until|also|because|since|but|if|than|not|so|under|past|toward|towards|against|through|without|across|over|around|beyond|behind|during|via)$/i;
const isPhraseDangling = (w) => isDangling(w) || PHRASE_DANGLING.test((w || "").replace(/[,;:]$/, ""));

// A ". " after an initial ("in I. Woodbury") or a citation abbreviation
// ("no. 119", "rep. Saints' Herald") is not a sentence end; cutting there left
// '…Missouri, in I.' with no ellipsis (blind audit witness-H3).
const NOT_SENTENCE_END = /(?:^|[\s(])(?:[A-Z]|no|nos|vol|vols|ed|eds|rep|repr|p|pp|ch|chap|n|ca|c|cf|esp|St|Mr|Mrs|Dr|Jr|Sr|Rev|Gen|Col|Capt|Hon|Prof|Mt|Ft)$/;
const lastSentenceEnd = (cut) => {
  for (let i = cut.lastIndexOf(". "); i > 0; i = cut.lastIndexOf(". ", i - 1)) {
    if (!NOT_SENTENCE_END.test(cut.slice(0, i))) return i;
  }
  return -1;
};

/**
 * `phrase: true` (short labels such as person titles) also drops a trailing
 * fragment that a function word opened within the last three words — "…assisted
 * Giddonah² in dealing…" → "…assisted Giddonah²…", "…Zeniff to the Land…" →
 * "…Zeniff…" — as long as at least three words remain.
 */
export const clampWords = (text, words, { phrase = false } = {}) => {
  const parts = (text || "").split(" ");
  if (parts.length <= words) return text || "";
  let cut = parts.slice(0, words).join(" ");
  const lastEnd = Math.max(lastSentenceEnd(cut), cut.lastIndexOf("; "));
  if (lastEnd > cut.length * 0.5) return cut.slice(0, lastEnd + 1).trim();
  cut = cut.replace(/\s*\([^)]*$/, "").replace(/[,;:—-]$/, "").trim();
  let kept = cut.split(" ");
  const popDangling = () => {
    while (kept.length > 1 && isDangling(kept[kept.length - 1])) kept.pop();
  };
  popDangling();
  if (phrase) {
    while (kept.length > 3 && isPhraseDangling(kept[kept.length - 1])) kept.pop();
    for (let j = kept.length - 1; j >= Math.max(3, kept.length - 3); j--) {
      if (isPhraseDangling(kept[j])) {
        kept = kept.slice(0, j);
        popDangling();
        while (kept.length > 3 && isPhraseDangling(kept[kept.length - 1])) kept.pop();
        break;
      }
    }
  }
  // a quote opened in the last few kept words and never closed leaves a
  // dangling fragment ('"the genealogy of my…'): cut back before it
  for (let j = kept.length - 1; j >= Math.max(1, kept.length - 3); j--) {
    if (/^[“"‘]/.test(kept[j]) && !/[”"’]$/.test(kept.slice(j).join(" ").slice(1))) {
      kept = kept.slice(0, j);
      popDangling();
      break;
    }
  }
  return kept.join(" ").replace(/[\s,;:—–\-“"‘(]+$/, "") + "…";
};

/** Display hygiene for data strings: typographic apostrophes, trimmed. */
export const tidy = (s) => (s || "").replace(/(\w)'(\w)/g, "$1’$2").trim();
