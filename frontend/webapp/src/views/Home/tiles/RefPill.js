import React from "react";
import { openScripture } from "./ScripturePopup";
import { enDash } from "./textUtils";

/**
 * THE scripture-reference affordance for the whole sampler: one pill style,
 * one behavior — click opens the scripture popup. Safe inside card <Link>s
 * (prevents default + stops propagation).
 */
export default function RefPill({ refText, className = "" }) {
  if (!refText) return null;
  const open = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openScripture(refText);
  };
  return (
    <span
      className={`refChip ${className}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(e)}
    >
      {enDash(refText)}
    </span>
  );
}
