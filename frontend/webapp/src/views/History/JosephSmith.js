/** @format */
import React, { useEffect } from "react";
import "./Witnesses.css";
import { label } from "../../models/Utils";
import { assetUrl } from "src/models/BoMOnlineAPI";
import HistoryBreadcrumb from "./HistoryBreadcrumb";

export default function JosephSmith() {
  useEffect(() => {
    document.title = "Joseph Smith | " + label("home_title");
  }, []);
  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page" className="single-witnesses">
        <HistoryBreadcrumb sectionKey="josephSmith" />
        <h3 className="title lg-4 text-center">Joseph Smith</h3>
        <div className="witness-image">
          <img
            src={`${assetUrl}/history/witnesses/people/joseph-smith.jpg`}
            alt="Joseph Smith"
          />
        </div>
        <div className="historyComingSoon">More coming soon.</div>
      </div>
    </div>
  );
}
