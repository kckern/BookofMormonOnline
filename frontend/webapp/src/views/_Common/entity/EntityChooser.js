import React from "react";
import { assetUrl } from "src/models/BoMOnlineAPI";
import { label, processName, replaceNumbers } from "src/models/Utils";
import "./EntityChooser.css";

// label() returns " " before global.dictionary loads and echoes the key when the
// dictionary lacks it (models/Utils.js:99-101), so `label(k) || fallback` never
// falls back.
function text(key, fallback) {
  const value = label(key);
  if (!value || !String(value).trim() || value === key) return fallback;
  return value;
}

// 'noahs-priests' -> "Noahs Priests"; the bare name the visitor typed.
function humanize(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Disambiguation list for an ambiguous bare slug (/people/noah → noah1, noah2,
 * noah3). Candidates are resolved by models/slugVariants, so loose prefix
 * matches such as noahs-priests never reach here.
 *
 * Rendered in BOTH contexts — inside the popup card and as a standalone page —
 * so it carries its own styles rather than borrowing the popup's
 * `.related_row`, which is sized for the modal's narrow two-up sidebar
 * (width: calc(50% - 1ex), text-align: right) and staircased badly on a page.
 *
 * Items are real <a href> links: middle-click and "open in new tab" work, and a
 * crawler that reaches the CRA still sees the variants. onEntityClick handles
 * the in-app navigation and preventDefault keeps it from reloading the shell.
 */
export default function EntityChooser({ requested, candidates, onEntityClick, mediaType, base }) {
  const name = humanize(requested);
  const list = candidates || [];

  if (!list.length) {
    return (
      <div className="entity-chooser">
        <h1 className="entity-chooser-title">{name}</h1>
        <p className="entity-chooser-lede">{text("not_found", "Not found")}</p>
      </div>
    );
  }

  return (
    <div className="entity-chooser">
      <h1 className="entity-chooser-title">{name}</h1>
      <p className="entity-chooser-lede">
        {list.length} {text("entries_share_this_name", "entries share this name. Choose which one you mean:")}
      </p>
      <ul className="entity-chooser-list">
        {list.map((c) => {
          const sub = c.title || c.info || c.subtitle || null;
          return (
            <li key={c.slug}>
              <a
                className="entity-chooser-item"
                href={`${base}/${c.slug}`}
                onClick={(e) => {
                  // Let modified clicks (new tab, new window) behave natively.
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onEntityClick(c.slug);
                }}
              >
                <img
                  className="entity-chooser-thumb"
                  src={`${assetUrl}/${mediaType}/${c.slug}`}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.visibility = "hidden";
                  }}
                />
                <span className="entity-chooser-text">
                  <strong className="entity-chooser-name">{processName(c.name)}</strong>
                  {sub && <small className="entity-chooser-sub">{replaceNumbers(sub)}</small>}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
