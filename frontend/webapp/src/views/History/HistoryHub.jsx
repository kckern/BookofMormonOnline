/** @format */
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import BoMOnlineAPI, { assetUrl } from "src/models/BoMOnlineAPI";
import { label } from "../../models/Utils";
import { HISTORY_SECTIONS, pickRandom } from "./sections";
import { deriveSignal, formatSignal } from "./historySignal";
import "./HistoryHub.css";

// Section key -> archive name to fetch a live list for (count + date range).
// josephSmith's archive name differs from its key (see JosephSmith.js).
const ARCHIVE_BY_KEY = {
  josephSmith: "joseph-smith-statements",
  translation: "translation",
  reception: "reception",
};

const thumbUrl = (id) => `${assetUrl}/history/thumbs/${String(id).padStart(4, "0")}`;

// Fetch each document archive once; expose { list } per section key.
function useArchiveLists() {
  const [lists, setLists] = useState({});
  useEffect(() => {
    let alive = true;
    Object.entries(ARCHIVE_BY_KEY).forEach(([key, archive]) => {
      BoMOnlineAPI({ history: { archive } }).then((r) => {
        if (alive) setLists((prev) => ({ ...prev, [key]: (r && r.history) || [] }));
      });
    });
    return () => { alive = false; };
  }, []);
  return lists;
}

function HeroImage({ src }) {
  return (
    <div className="historyHero">
      <img src={src} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
    </div>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function HeroWitnesses({ three, eight }) {
  // Top third: the Three (triptych). Bottom two-thirds: the Eight (4×2 grid).
  // Shuffle within each group once per load so the arrangement varies.
  const t = useMemo(() => shuffle(three), [three]);
  const e = useMemo(() => shuffle(eight), [eight]);
  const cell = (src, i) => <div key={i} className="wCell" style={{ backgroundImage: `url("${src}")` }} />;
  return (
    <div className="historyHero historyHero--witnesses">
      <div className="wThree">{t.map(cell)}</div>
      <div className="wEight">{e.map(cell)}</div>
    </div>
  );
}

function HeroPlaceholder({ icon }) {
  return (
    <div className="historyHero historyHero--placeholder">
      <img src={icon} alt="" />
    </div>
  );
}

function Hero({ section, list }) {
  const { hero } = section;
  if (hero.type === "image") return <HeroImage src={hero.src} />;
  if (hero.type === "witnesses") return <HeroWitnesses three={hero.three} eight={hero.eight} />;
  if (hero.type === "placeholder") return <HeroPlaceholder icon={hero.icon} />;
  if (hero.type === "randomThumb") {
    const pick = pickRandom(list);
    return pick && pick.id != null
      ? <HeroImage src={thumbUrl(pick.id)} />
      : <HeroPlaceholder icon={section.icon} />;
  }
  return <HeroPlaceholder icon={section.icon} />;
}

function Card({ section, list }) {
  const signal = useMemo(() => {
    if (section.signal) return section.signal; // static (Witnesses)
    if (!list) return null; // still loading — omit line, never gape
    const { count, minYear, maxYear } = deriveSignal(list);
    return formatSignal(count, section.unit, minYear, maxYear);
  }, [section, list]);

  return (
    <Link className="historyCard" to={section.path}>
      <Hero section={section} list={list} />
      <div className="historyCard-body">
        <div className="historyCard-name">{section.title}</div>
        {signal ? <div className="historyCard-sig">{signal}</div> : null}
        <div className="historyCard-blurb">{section.blurb}</div>
      </div>
    </Link>
  );
}

export default function HistoryHub() {
  useEffect(() => {
    document.title = label("menu_history") + " | " + label("home_title");
  }, []);
  const lists = useArchiveLists();
  return (
    <div className="container" style={{ display: "block" }}>
      <div id="page">
        <div className="historyHub">
          <div className="historyHub-masthead">
            <div className="historyHub-kicker">The Book of Mormon in History</div>
            <h1 className="historyHub-title">Historical Sources</h1>
            <p className="historyHub-lede">
              Four collections tracing the record from its coming forth to its reception in the world.
            </p>
            <div className="historyHub-rule" />
          </div>
          <div className="historyHub-grid">
            {HISTORY_SECTIONS.map((s) => (
              <Card key={s.key} section={s} list={lists[s.key]} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
