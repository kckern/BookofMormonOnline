import React, { useEffect, useState } from "react";
import BoMOnlineAPI from "src/models/BoMOnlineAPI";
import HistoryBody, { historyMeta, historyDocTitle } from "./entity/HistoryBody";
import { label } from "src/models/Utils";

/**
 * Phone drawer for a history-archive document — the same field-adaptive body as
 * the desktop modal (entity/HistoryBody: title once, quote, citation, transcript,
 * facsimiles only when they exist), under a sticky header carrying the meta line
 * and a 44px close control (blind audit archive witness-D1: the old drawer
 * printed the title twice, led with a dangling "• date", showed a broken
 * facsimile image for witness rows and had no visible way out).
 */
export default function HistoryDrawer({ slug, onClose }) {
  const [doc, setDoc] = useState(null);
  useEffect(() => {
    let live = true;
    setDoc(null);
    if (!slug) return undefined;
    BoMOnlineAPI({ history: slug }).then((r) => {
      if (live) setDoc(r?.history?.[slug] || null);
    });
    return () => { live = false; };
  }, [slug]);
  useEffect(() => {
    if (doc) document.title = `${historyDocTitle(doc)} | ${label("home_title")}`;
  }, [doc]);
  const meta = historyMeta(doc);
  return (
    <div className="historyDrawer">
      <div className="historyDrawerHead">
        <span className="historyDrawerMeta">{meta.join(" · ")}</span>
        <button type="button" className="historyDrawerClose" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="historyDrawerBody">{doc ? <HistoryBody data={doc} /> : null}</div>
    </div>
  );
}
