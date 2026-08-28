/** @format */
import React, { useEffect, useMemo, useState } from "react";
import Masonry from "react-masonry-css";
import moment from "moment";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import { isMobile, label } from "src/models/Utils";
import { Spinner } from "../_Common/Loader";
import { useAppController } from "src/contexts/AppControllerContext";
import HistoryBreadcrumb from "./HistoryBreadcrumb";
import HistorySourceCard from "./HistorySourceCard";
import { getSection } from "./sections";
import { LOST_PAGES_NARRATIVES } from "./narratives";
import { JSNY_PLACES } from "./places";
import "./HistoryArchiveFeed.css";

const breakpointColumnsObj = { default: 4, 1600: 3, 1200: 2, 700: 1 };

const yearOf = (d) => {
  const y = Number(d.event_year || d.year);
  return Number.isFinite(y) && y > 0 ? y : null;
};

// Chronological sort; undated docs last; seq breaks ties within a year.
function sortChronologically(docs) {
  return [...(docs || [])].sort((a, b) => {
    const ya = yearOf(a);
    const yb = yearOf(b);
    if (ya === null && yb === null) return (a.seq || 0) - (b.seq || 0);
    if (ya === null) return 1;
    if (yb === null) return -1;
    return ya - yb || (a.seq || 0) - (b.seq || 0);
  });
}

// Ascending year buckets; items ordered by seq within a year; undated docs last.
export function groupByYearAscending(docs) {
  const buckets = [];
  let cur = null;
  for (const d of sortChronologically(docs)) {
    const y = yearOf(d);
    if (!cur || cur.year !== y) {
      cur = { year: y, items: [] };
      buckets.push(cur);
    }
    cur.items.push(d);
  }
  return buckets;
}

// Ascending decade buckets (1830s, 1840s, …); undated docs last.
export function groupByDecadeAscending(docs) {
  const buckets = [];
  let cur = null;
  for (const d of sortChronologically(docs)) {
    const y = yearOf(d);
    const decade = y === null ? null : Math.floor(y / 10) * 10;
    if (!cur || cur.decade !== decade) {
      cur = { decade, items: [] };
      buckets.push(cur);
    }
    cur.items.push(d);
  }
  return buckets;
}

// Group by an ordered editorial key (lost-pages narrative, JSNY place, …) rather
// than chronologically. Chronology is meaningless for archives whose sources span
// a century but all describe the same short period. `table` is the ordered list of
// {key, title, gap?, blurb?}; entries declaring a `gap` survive with no items so a
// hole in the record still renders. Unknown keys collect last.
export function groupByOrderedKey(docs, field, table) {
  const byKey = new Map();
  for (const d of docs || []) {
    const k = d[field] || "";
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(d);
  }
  const bySeq = (a, b) => (a.seq || 0) - (b.seq || 0);
  const buckets = table.map((n) => ({
    key: n.key,
    heading: n.title,
    blurb: n.blurb || null,
    gap: n.gap || null,
    items: (byKey.get(n.key) || []).sort(bySeq),
  }));
  const known = new Set(table.map((n) => n.key));
  const rest = [...byKey.entries()]
    .filter(([k]) => !known.has(k))
    .flatMap(([, v]) => v)
    .sort(bySeq);
  if (rest.length) buckets.push({ key: null, heading: "Other", blurb: null, gap: null, items: rest });
  return buckets.filter((b) => b.items.length || b.gap);
}

// Distinct keys present in the data, in table order, with counts.
export function orderedKeyOptions(docs, field, table) {
  const counts = new Map();
  for (const d of docs || []) {
    if (d[field]) counts.set(d[field], (counts.get(d[field]) || 0) + 1);
  }
  return table.filter((n) => counts.has(n.key)).map((n) => [n.key, n.title, counts.get(n.key)]);
}

// Back-compat wrappers — the lost-116-pages archive and its tests use these.
export const groupByNarrative = (docs) =>
  groupByOrderedKey(docs, "narrative", LOST_PAGES_NARRATIVES).map((b) => ({ ...b, narrative: b.key }));
export const narrativeOptions = (docs) =>
  orderedKeyOptions(docs, "narrative", LOST_PAGES_NARRATIVES);

// Wide, sparse archives (e.g. Translation spans 1827–1998) group by decade
// instead of dozens of single-item year sections. Threshold: >40yr span.
export function shouldPackFeed(buckets) {
  const years = (buckets || []).map((b) => b.year).filter((y) => y != null);
  if (years.length < 2) return false;
  return years[years.length - 1] - years[0] > 40;
}

// Distinct principals with counts, most frequent first.
export function principalOptions(docs) {
  const counts = new Map();
  for (const d of docs || []) {
    if (d.principal) counts.set(d.principal, (counts.get(d.principal) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// Date formatter reception/witnesses use (year / month / full by string length).
const displayDate = (date) => {
  if (!date) return "";
  const len = String(date).length;
  return moment(date, [len === 4 ? "YYYY" : "YYYY-MM-DD"]).format(
    len === 4
      ? label("history_date_format_year")
      : len === 7
      ? label("history_date_format_month")
      : label("history_date_format_full")
  );
};

// A chronological, year-grouped feed of one history archive's accounts, each an
// attributed money-quote card. Reused by /history/translation and
// /history/joseph-smith. archive = the DB archive key; sectionKey = the
// sections.js key (drives title / blurb / breadcrumb / popup underSlug).
const DIMENSIONS = {
  narrative: { field: "narrative", table: LOST_PAGES_NARRATIVES, label: "Narrative", all: "All narratives", empty: "narrative" },
  place: { field: "place", table: JSNY_PLACES, label: "Place", all: "All places", empty: "place" },
};

export default function HistoryArchiveFeed({ archive, sectionKey, groupBy = "chronological" }) {
  const dim = DIMENSIONS[groupBy] || null;
  const byNarrative = !!dim;
  const appController = useAppController();
  const section = getSection(sectionKey) || {};
  const underSlug = (section.path || "/history").replace(/^\//, "");

  const [docs, setDocs] = useState(null);
  const [principal, setPrincipal] = useState("");

  useEffect(() => {
    document.title = (section.title || "History") + " | " + label("home_title");
  }, [section.title]);

  useEffect(() => {
    let alive = true;
    setDocs(null);
    setPrincipal("");
    BoMOnlineAPI({ history: { archive } }).then((r) => {
      if (alive) setDocs((r && r.history) || []);
    });
    return () => {
      alive = false;
    };
  }, [archive]);

  // `filter` holds a principal on chronological archives, a narrative key on
  // narrative ones — one control, two meanings, so the markup stays shared.
  const options = useMemo(
    () =>
      byNarrative
        ? orderedKeyOptions(docs, dim.field, dim.table).map(([key, title, n]) => [key, n, title])
        : principalOptions(docs).map(([p, n]) => [p, n, p]),
    [docs, byNarrative, dim]
  );
  const visible = useMemo(
    () =>
      (docs || []).filter((d) =>
        !principal ? true : byNarrative ? d[dim.field] === principal : d.principal === principal
      ),
    [docs, principal, byNarrative, dim]
  );
  const buckets = useMemo(
    () => (byNarrative ? [] : groupByYearAscending(visible)),
    [visible, byNarrative]
  );
  const packed = useMemo(() => (byNarrative ? false : shouldPackFeed(buckets)), [buckets, byNarrative]);
  // Narrative archives group by manuscript order; wide/sparse chronological
  // archives group by decade; dense ones stay per-year.
  const groups = useMemo(() => {
    if (!byNarrative) return packed ? groupByDecadeAscending(visible) : buckets;
    const all = groupByOrderedKey(visible, dim.field, dim.table);
    // A sourceless narrative survives grouping on its `gap` alone, so when the
    // reader has filtered to one narrative it would otherwise tag along.
    return principal ? all.filter((b) => b.key === principal) : all;
  }, [byNarrative, packed, visible, buckets, principal, dim]);

  const openDoc = (doc) =>
    appController.functions.setPopUp({
      type: "history",
      ids: [doc.slug],
      popUpData: doc,
      underSlug,
      vhtop: 10,
    });

  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page" className="historyArchiveFeed">
        <HistoryBreadcrumb sectionKey={sectionKey} />
        <h3 className="title lg-4 text-center">{section.title || "History"}</h3>
        {section.blurb ? <p className="archiveIntro">{section.blurb}</p> : null}

        {docs === null ? (
          <Spinner top={isMobile() ? "50vh" : "40vh"} />
        ) : (
          <>
            {options.length > 1 ? (
              <div className="archiveControls">
                <label className="archiveFilter">
                  <span>{byNarrative ? dim.label : "Voice"}</span>
                  <select value={principal} onChange={(e) => setPrincipal(e.target.value)}>
                    <option value="">
                      {byNarrative ? dim.all : "All voices"} ({docs.length})
                    </option>
                    {options.map(([value, n, text]) => (
                      <option key={value} value={value}>
                        {text} ({n})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {visible.length === 0 ? (
              <div className="archiveEmpty">
                No accounts for this {byNarrative ? dim.empty : "voice"}.{" "}
                <button type="button" className="archiveClear" onClick={() => setPrincipal("")}>
                  Show all
                </button>
              </div>
            ) : (
              groups.map((bucket) => {
                const key = byNarrative
                  ? bucket.key ?? "other"
                  : packed
                  ? bucket.decade ?? "undated"
                  : bucket.year ?? "undated";
                const heading = byNarrative
                  ? bucket.heading
                  : packed
                  ? bucket.decade != null
                    ? `${bucket.decade}s`
                    : "Undated"
                  : bucket.year ?? "Undated";
                // A declared narrative with no sources renders the gap itself —
                // a stated hole in the record is content, not an empty section.
                if (byNarrative && !bucket.items.length) {
                  return (
                    <section key={key} className="archiveYearGroup archiveNarrativeGroup">
                      <h4 className="archiveYear archiveNarrative">{heading}</h4>
                      <p className="archiveNarrativeGap">{bucket.gap}</p>
                    </section>
                  );
                }
                return (
                  <section
                    key={key}
                    className={"archiveYearGroup" + (byNarrative ? " archiveNarrativeGroup" : "")}
                  >
                    <h4 className={"archiveYear" + (byNarrative ? " archiveNarrative" : "")}>
                      {heading}
                    </h4>
                    {byNarrative && bucket.blurb ? (
                      <p className="archiveGroupBlurb">{bucket.blurb}</p>
                    ) : null}
                    <Masonry
                      breakpointCols={breakpointColumnsObj}
                      className="my-masonry-grid"
                      columnClassName="my-masonry-grid_column"
                    >
                      {bucket.items.map((doc) => (
                        <HistorySourceCard
                          key={doc.slug}
                          doc={doc}
                          variant="reception"
                          displayDate={displayDate}
                          onOpen={openDoc}
                        />
                      ))}
                    </Masonry>
                  </section>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
