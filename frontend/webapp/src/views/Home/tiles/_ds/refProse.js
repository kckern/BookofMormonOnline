import React from "react";
import Parser from "html-react-parser";
import { getDetectedScripturesHtml } from "src/views/_Common/ViewUtils";
import RefPill from "../RefPill";

const PILL = '<a className="scripture_link">[^<]*</a>';
// "(<pill>)" or "(<pill>; <pill>)": the pill already marks a reference, so the
// literal parentheses are redundant — and they wrap away from the pill,
// orphaning "(" at a line end and ")" at the next line start (audit A3).
const WRAPPED = new RegExp(`\\(\\s*((?:${PILL}[\\s,;]*)+?)\\s*\\)`, "g");

/** Detected-scripture HTML with the parentheses around bare refs removed. */
export const detectedRefsHtml = (text) =>
  getDetectedScripturesHtml(text || "").replace(WRAPPED, (m, inner) => inner.replace(/[\s,;]+$/, ""));

// html-react-parser keeps `className` in Node but the browser DOM parser
// lowercases it — match every spelling (see _Common/scriptureLinkReplacer.js).
const replace = (node) => {
  const cls = node?.attribs?.className ?? node?.attribs?.classname ?? node?.attribs?.class;
  if (node?.name !== "a" || cls !== "scripture_link") return undefined;
  return <RefPill refText={node.children?.[0]?.data ?? ""} />;
};

/**
 * Plain prose → React nodes with every detected scripture reference rendered
 * as the one RefPill <button> (keyboard-reachable, opens the ScripturePopup).
 * Never place the result inside a <Link>/<a>.
 */
export default function refProse(text) {
  if (!text) return null;
  return Parser(detectedRefsHtml(text), { replace });
}
