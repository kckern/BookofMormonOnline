/** @format */
import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import Masonry from "react-masonry-css";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "../../models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import HistoryBreadcrumb from "./HistoryBreadcrumb";
import HistorySourceCard from "./HistorySourceCard";
import WitnessLifeHeatmap, { matchesYearMonth } from "./WitnessLifeHeatmap";
import "./Witnesses.css";

// The translator himself — a single-subject page in the Witnesses format
// (portrait hero + a life-timeline heatmap + a column of money-quote source
// cards), driven by the 'joseph-smith-statements' history archive.
const breakpointColumnsObj = { default: 4, 1600: 3, 1200: 2, 700: 1 };

const JOSEPH = {
  slug: "joseph-smith",
  name: "Joseph Smith",
  birthday: "1805-12-23",
  deathday: "1844-06-27",
};

// A statement is "reported" (non-direct) when its author is someone other than
// Joseph himself — a contemporary recording what Joseph said or did. Those
// follow the witnesses pattern: attribute the quote to the reporter. Joseph's
// own statements (author is Joseph) stay unattributed (the whole page is his).
const isReported = (doc) =>
  !!doc.author && doc.author !== doc.principal && !/joseph\s*smith/i.test(doc.author);
const attributeReporter = (doc) =>
  isReported(doc)
    ? {
        ...doc,
        quote_speaker: doc.quote_speaker || doc.author,
        quote_is_witness_voice: doc.quote_is_witness_voice ?? true,
      }
    : doc;

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

export default function JosephSmith() {
  const appController = useAppController();
  const [sources, setSources] = useState(null);
  const [selectedYearMonth, setSelectedYearMonth] = useState(null);

  useEffect(() => {
    document.title = "Joseph Smith | " + label("home_title");
  }, []);

  useEffect(() => {
    let alive = true;
    BoMOnlineAPI({ history: { archive: "joseph-smith-statements" } }).then((r) => {
      if (!alive) return;
      const list = (r && r.history) || [];
      list.sort(
        (a, b) =>
          Number(a.event_year || a.year || 0) - Number(b.event_year || b.year || 0) ||
          (a.seq || 0) - (b.seq || 0)
      );
      setSources(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const visibleSources = useMemo(() => {
    if (!sources) return sources;
    if (!selectedYearMonth) return sources;
    return sources.filter((s) => matchesYearMonth(s, selectedYearMonth));
  }, [sources, selectedYearMonth]);

  const openSource = (doc) => {
    if (!doc) return;
    appController.functions.setPopUp({
      type: "history",
      ids: [doc.slug],
      popUpData: doc,
      underSlug: "history/joseph-smith",
      vhtop: 10,
    });
  };

  const ageIn1829 = moment("1829-06-28").diff(moment(JOSEPH.birthday), "years");

  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page" className="single-witnesses">
        <HistoryBreadcrumb sectionKey="josephSmith" />
        <div className="witness-layout">
          <aside className="witness-rail">
            <div className="witness-hero">
              <div className="witness-hero-portrait">
                <img
                  src={`${assetUrl}/history/witnesses/people/joseph-smith.jpg`}
                  alt="Joseph Smith"
                />
              </div>
              <div className="witness-hero-bio">
                <dl className="witness-hero-facts">
                  <div className="witness-fact"><dt>Born</dt><dd>{displayDate(JOSEPH.birthday)}</dd></div>
                  <div className="witness-fact"><dt>Age in 1829</dt><dd>{ageIn1829}</dd></div>
                  <div className="witness-fact"><dt>Died</dt><dd>{displayDate(JOSEPH.deathday)}</dd></div>
                </dl>
                <div className="witness-bio">
                  <span className="witness-bio-placeholder">
                    The translator's own statements on the coming forth of the Book of Mormon.
                  </span>
                </div>
              </div>
            </div>
          </aside>

          <main className="witness-sources">
            {sources && sources.length > 0 && (
              <WitnessLifeHeatmap
                witness={JOSEPH}
                sources={sources}
                selectedYearMonth={selectedYearMonth}
                onSelectYearMonth={setSelectedYearMonth}
              />
            )}
            {selectedYearMonth && (
              <div className="witness-sources-head">
                <button
                  type="button"
                  className="witness-filter-chip"
                  onClick={() => setSelectedYearMonth(null)}
                >
                  {selectedYearMonth} <span aria-hidden="true">✕</span>
                </button>
              </div>
            )}
            {sources === null && <div className="witness-sources-loading">Loading sources…</div>}
            {sources && sources.length === 0 && (
              <div className="witness-sources-empty">No statements available.</div>
            )}
            {visibleSources && visibleSources.length === 0 && sources && sources.length > 0 && (
              <div className="witness-sources-empty">No statements in this month.</div>
            )}
            {visibleSources && visibleSources.length > 0 && (
              <Masonry
                breakpointCols={breakpointColumnsObj}
                className="my-masonry-grid"
                columnClassName="my-masonry-grid_column"
              >
                {visibleSources.map((doc) => (
                  <HistorySourceCard
                    key={doc.slug}
                    doc={attributeReporter(doc)}
                    variant="witness"
                    displayDate={displayDate}
                    onOpen={openSource}
                  />
                ))}
              </Masonry>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
