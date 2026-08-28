/** @format */
// The lost manuscript's narrative spine, in manuscript order — the order the
// Book of Lehi itself ran, not the order the sources were written. Drives the
// group order and headings on /history/lost-116-pages.
export const LOST_PAGES_NARRATIVES = [
  { key: "lehi-exodus-passover", title: "A Passover setting for Lehi's exodus" },
  { key: "lehi-tabernacle", title: "Lehi's tabernacle in the wilderness" },
  { key: "tribal-lineages", title: "The tribes of Lehi: Ishmael and Zoram of Ephraim" },
  { key: "nephi-conquest", title: "Nephi's conquest and the sword of Laban" },
  { key: "nephi-temple", title: "Nephi's temple, the relics, and the ark" },
  { key: "lost-middle-period", title: "The lost middle period and Aminadi", gap: "No external source records this period. Everything known of Aminadi comes from a single backward reference in Alma 10:2." },
  { key: "mosiah-interpreters", title: "Mosiah₁ and the Jaredite interpreters" },
  { key: "people-of-muloch", title: "The people of Muloch" },
  { key: "book-of-benjamin", title: "The Book of Benjamin" },
  { key: "manuscript-scale", title: "How much was lost" },
];

export const narrativeOrder = (key) => {
  const i = LOST_PAGES_NARRATIVES.findIndex((n) => n.key === key);
  return i === -1 ? LOST_PAGES_NARRATIVES.length : i;
};

export const getNarrative = (key) =>
  LOST_PAGES_NARRATIVES.find((n) => n.key === key) || null;
