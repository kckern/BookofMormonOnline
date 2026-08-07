/** @format */
import React, { useEffect, useState } from "react";
import moment from "moment";
import Masonry from "react-masonry-css";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "../../models/Utils";
import { useAppController } from "src/contexts/AppControllerContext";
import HistoryBreadcrumb from "./HistoryBreadcrumb";
import HistorySourceCard from "./HistorySourceCard";
import "./Witnesses.css";

// The translator himself — a single-subject page in the Witnesses format
// (portrait hero + a column of money-quote source cards), driven by the
// 'joseph-smith-statements' history archive.
const breakpointColumnsObj = { default: 4, 1600: 3, 1200: 2, 700: 1 };

const JOSEPH = { birthday: "1805-12-23", deathday: "1844-06-27" };

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
            {sources === null && <div className="witness-sources-loading">Loading sources…</div>}
            {sources && sources.length === 0 && (
              <div className="witness-sources-empty">No statements available.</div>
            )}
            {sources && sources.length > 0 && (
              <Masonry
                breakpointCols={breakpointColumnsObj}
                className="my-masonry-grid"
                columnClassName="my-masonry-grid_column"
              >
                {sources.map((doc) => (
                  <HistorySourceCard
                    key={doc.slug}
                    doc={doc}
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
