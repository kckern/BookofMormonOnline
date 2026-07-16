import React, { useMemo, useState } from "react";
import { allPairs } from "./aggregate";

// Sortable table twin of the ribbon overview — the WCAG-clean equivalent.
export default function TableTwin() {
  const [sort, setSort] = useState({ key: "total", dir: -1 });
  const rows = useMemo(() => {
    const pairs = [...allPairs()];
    pairs.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return cmp * sort.dir;
    });
    return pairs;
  }, [sort]);

  const header = (key, label) => (
    <th>
      <button
        className="xref-sort"
        aria-pressed={sort.key === key}
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}
      >
        {label}
        <span aria-hidden="true">{sort.key === key ? (sort.dir === -1 ? " ▼" : " ▲") : ""}</span>
      </button>
    </th>
  );

  return (
    <table className="xref-tabletwin">
      <thead>
        <tr>
          {header("bomBookName", "Book of Mormon")}
          {header("bibleBookName", "Bible")}
          {header("total", "Refs")}
          {header("quotes", "Quotes")}
          {header("phrases", "Phrases")}
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={`${p.bomBookName}|${p.bibleBookName}`} data-testid="xref-pairrow">
            <td>{p.bomBookName}</td>
            <td>{p.bibleBookName}</td>
            <td className="num">{p.total}</td>
            <td className="num">{p.quotes}</td>
            <td className="num">{p.phrases}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
