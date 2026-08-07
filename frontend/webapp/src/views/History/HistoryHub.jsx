/** @format */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "../../models/Utils";
import { HISTORY_SECTIONS, pickRandom } from "./sections";
import { WITNESSES } from "./Witnesses";
import "./HistoryHub.css";

// One featured preview per live section: { img, caption }.
function useFeatured() {
  const [receptionDoc, setReceptionDoc] = useState(null);
  useEffect(() => {
    let alive = true;
    BoMOnlineAPI({ history: { archive: "reception" } }).then((r) => {
      if (alive) setReceptionDoc(pickRandom(r && r.history));
    });
    return () => { alive = false; };
  }, []);
  const witness = useMemo(() => pickRandom(WITNESSES), []);
  return {
    reception: receptionDoc && {
      img: `${assetUrl}/history/thumbs/${String(receptionDoc.id).padStart(4, "0")}`,
      caption: receptionDoc.source,
    },
    witnesses: witness && {
      img: `${assetUrl}/history/witnesses/people/${witness.slug}.jpg`,
      caption: witness.name,
    },
  };
}

function Tile({ section, featured }) {
  return (
    <Link className="historyTile" to={section.path}>
      <img className="historyTile-icon" src={section.icon} alt="" />
      <div className="historyTile-title">{section.title}</div>
      <div className="historyTile-blurb">{section.blurb}</div>
      {section.status === "live" && featured ? (
        <div className="historyTile-featured">
          <img
            src={featured.img}
            alt=""
            onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }}
          />
          <span>{featured.caption}</span>
        </div>
      ) : (
        <div className="historyTile-soon">
          {section.status === "placeholder" ? "Coming soon" : ""}
        </div>
      )}
    </Link>
  );
}

export default function HistoryHub() {
  useEffect(() => {
    document.title = label("menu_history") + " | " + label("home_title");
  }, []);
  const featured = useFeatured();
  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page">
        <h3 className="title lg-4 text-center">{label("title_history")}</h3>
        <div className="historyHub">
          {HISTORY_SECTIONS.map((s) => (
            <Tile key={s.key} section={s} featured={featured[s.key]} />
          ))}
        </div>
      </div>
    </div>
  );
}
