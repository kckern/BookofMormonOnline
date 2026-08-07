// URL codec for the cross-reference view. The URL is the single source of
// truth: components never hold navigation state, they parse it from here.
//
// Path shapes (unchanged; legacy URLs all still parse):
//   /analysis/bible                          overview
//   /analysis/bible/bom/2-nephi[/12]         anchored (canon, book, chapter?)
//   /analysis/bible/kjv/isaiah               anchored on the Bible side
//   /analysis/bible/bom/2-nephi[/12]~isaiah  reader (always serialized BoM-first)
// Query params (all optional, all additive):
//   ?hl=<book-or-division-slug>   anchor: emphasized partner
//   ?from=kjv                     reader: which canon anchored it (back target)
//   ?view=table                   overview: table twin instead of the chart
//   ?expand=<division-slug>       overview: expanded Bible division
// Anything unresolvable degrades to the overview, never to a broken screen.

import { canons, bookBySlug, slugify } from "./canon";

const divisionBySlug = (slug) =>
  canons.kjv.groups.find((g) => g.slug === slugify(slug));

// value is useRouteMatch().params.value; search is location.search ("?a=b")
export const parseValue = (value, search = "") => {
  const params = new URLSearchParams(search || "");
  const overview = () => {
    const state = { view: "overview" };
    if (params.get("view") === "table") state.mode = "table";
    const expand = params.get("expand");
    const group = expand && divisionBySlug(expand);
    if (group) state.expanded = group.name;
    return state;
  };

  if (!value) return overview();
  const rest = value.replace(/^bible\/?/, "").replace(/\/+$/, "");
  if (!rest) return overview();

  const [left, right] = rest.split("~");
  const seg = left.split("/").filter(Boolean);

  if (right !== undefined) {
    const bible = bookBySlug("kjv", right);
    if (!bible) return overview();
    const finish = (state) => {
      if (params.get("from") === "kjv") state.anchorCanon = "kjv";
      const bch = params.get("bch");
      if (bch && /^\d+$/.test(bch)) {
        const n = Number(bch);
        if (n >= 1 && n <= bible.chapters) state.bibleChapter = n;
      }
      return state;
    };
    if (seg[0] === "bom") {
      const bom = bookBySlug("bom", seg[1]);
      if (!bom) return overview();
      const chapter = seg[2] && /^\d+$/.test(seg[2]) ? Number(seg[2]) : undefined;
      const state = { view: "reader", bomBook: bom.name, bibleBook: bible.name };
      if (chapter >= 1 && chapter <= bom.chapters) state.bomChapter = chapter;
      return finish(state);
    }
    // legacy: "<bom-book>~<bible-book>"
    const bom = bookBySlug("bom", seg[0]);
    if (seg.length === 1 && bom)
      return finish({ view: "reader", bomBook: bom.name, bibleBook: bible.name });
    return overview();
  }

  if (seg[0] === "bom" || seg[0] === "kjv") {
    const book = bookBySlug(seg[0], seg[1]);
    if (!book) return overview();
    const state = { view: "anchor", canon: seg[0], book: book.name };
    const chapter = seg[2] && /^\d+$/.test(seg[2]) ? Number(seg[2]) : undefined;
    if (chapter >= 1 && chapter <= book.chapters) state.chapter = chapter;
    const hl = params.get("hl");
    if (hl) {
      const partnerCanon = seg[0] === "bom" ? "kjv" : "bom";
      const partner = bookBySlug(partnerCanon, hl);
      const group = seg[0] === "bom" ? divisionBySlug(hl) : null;
      if (partner) state.highlight = partner.name;
      else if (group) state.highlight = group.name;
    }
    return state;
  }
  return overview();
};

export const serialize = (state) => {
  const base = "/analysis/bible";
  if (!state || state.view === "overview" || !["anchor", "reader"].includes(state.view)) {
    const q = new URLSearchParams();
    if (state?.mode === "table") q.set("view", "table");
    if (state?.expanded) q.set("expand", slugify(state.expanded));
    const qs = q.toString();
    return qs ? `${base}?${qs}` : base;
  }
  if (state.view === "anchor") {
    const path = `${base}/${state.canon}/${slugify(state.book)}${
      state.chapter ? `/${state.chapter}` : ""
    }`;
    return state.highlight
      ? `${path}?hl=${encodeURIComponent(slugify(state.highlight))}`
      : path;
  }
  const path = `${base}/bom/${slugify(state.bomBook)}${
    state.bomChapter ? `/${state.bomChapter}` : ""
  }~${slugify(state.bibleBook)}`;
  const q = new URLSearchParams();
  if (state.anchorCanon === "kjv") q.set("from", "kjv");
  if (state.bibleChapter) q.set("bch", String(state.bibleChapter));
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
};
