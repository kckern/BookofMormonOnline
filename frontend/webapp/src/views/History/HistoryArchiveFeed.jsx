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
export default function HistoryArchiveFeed({ archive, sectionKey }) {
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

  const options = useMemo(() => principalOptions(docs), [docs]);
  const visible = useMemo(
    () => (docs || []).filter((d) => !principal || d.principal === principal),
    [docs, principal]
  );
  const buckets = useMemo(() => groupByYearAscending(visible), [visible]);
  const packed = useMemo(() => shouldPackFeed(buckets), [buckets]);
  // Wide/sparse archives group by decade; dense ones stay per-year.
  const groups = useMemo(
    () => (packed ? groupByDecadeAscending(visible) : buckets),
    [packed, visible, buckets]
  );

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
                  <span>Voice</span>
                  <select value={principal} onChange={(e) => setPrincipal(e.target.value)}>
                    <option value="">All voices ({docs.length})</option>
                    {options.map(([p, n]) => (
                      <option key={p} value={p}>
                        {p} ({n})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {visible.length === 0 ? (
              <div className="archiveEmpty">
                No accounts for this voice.{" "}
                <button type="button" className="archiveClear" onClick={() => setPrincipal("")}>
                  Show all
                </button>
              </div>
            ) : (
              groups.map((bucket) => {
                const key = packed ? bucket.decade ?? "undated" : bucket.year ?? "undated";
                const heading = packed
                  ? bucket.decade != null
                    ? `${bucket.decade}s`
                    : "Undated"
                  : bucket.year ?? "Undated";
                return (
                  <section key={key} className="archiveYearGroup">
                    <h4 className="archiveYear">{heading}</h4>
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
