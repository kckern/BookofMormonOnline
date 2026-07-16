// URL codec for the cross-reference view. The URL is the single source of
// truth: components never hold navigation state, they parse it from here.
//
// Shapes:
//   /analysis/bible                          overview
//   /analysis/bible/bom/2-nephi[/12]         anchored (canon, book, chapter?)
//   /analysis/bible/kjv/isaiah               anchored on the Bible side
//   /analysis/bible/bom/2-nephi[/12]~isaiah  reader (always serialized BoM-first)
// Legacy "<bom-book>~<bible-book>" URLs parse to a reader state; anything
// unresolvable degrades to the overview, never to a broken screen.

import { bookBySlug, slugify } from "./canon";

const OVERVIEW = { view: "overview" };

// value is useRouteMatch().params.value, e.g. "bible/bom/2-nephi/12~isaiah"
export const parseValue = (value) => {
  if (!value) return OVERVIEW;
  const rest = value.replace(/^bible\/?/, "").replace(/\/+$/, "");
  if (!rest) return OVERVIEW;

  const [left, right] = rest.split("~");
  const seg = left.split("/").filter(Boolean);

  if (right !== undefined) {
    const bible = bookBySlug("kjv", right);
    if (!bible) return OVERVIEW;
    if (seg[0] === "bom") {
      const bom = bookBySlug("bom", seg[1]);
      if (!bom) return OVERVIEW;
      const chapter = seg[2] && /^\d+$/.test(seg[2]) ? Number(seg[2]) : undefined;
      const state = { view: "reader", bomBook: bom.name, bibleBook: bible.name };
      if (chapter >= 1 && chapter <= bom.chapters) state.bomChapter = chapter;
      return state;
    }
    // legacy: "<bom-book>~<bible-book>"
    const bom = bookBySlug("bom", seg[0]);
    if (seg.length === 1 && bom)
      return { view: "reader", bomBook: bom.name, bibleBook: bible.name };
    return OVERVIEW;
  }

  if (seg[0] === "bom" || seg[0] === "kjv") {
    const book = bookBySlug(seg[0], seg[1]);
    if (!book) return OVERVIEW;
    const state = { view: "anchor", canon: seg[0], book: book.name };
    const chapter = seg[2] && /^\d+$/.test(seg[2]) ? Number(seg[2]) : undefined;
    if (chapter >= 1 && chapter <= book.chapters) state.chapter = chapter;
    return state;
  }
  return OVERVIEW;
};

export const serialize = (state) => {
  const base = "/analysis/bible";
  if (!state || state.view === "overview") return base;
  if (state.view === "anchor")
    return `${base}/${state.canon}/${slugify(state.book)}${
      state.chapter ? `/${state.chapter}` : ""
    }`;
  if (state.view === "reader")
    return `${base}/bom/${slugify(state.bomBook)}${
      state.bomChapter ? `/${state.bomChapter}` : ""
    }~${slugify(state.bibleBook)}`;
  return base;
};
