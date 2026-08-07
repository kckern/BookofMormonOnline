import React, { useMemo, useState } from "react";
import { allPairs } from "./aggregate";

// Sortable, filterable table twin of the ribbon overview — the WCAG-clean
// equivalent. Rows open the same reader the ribbons do.
export default function TableTwin({ navigate }) {
  const [sort, setSort] = useState({ key: "total", dir: -1 });
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const pairs = allPairs().filter(
      (p) =>
        !q ||
        p.bomBookName.toLowerCase().includes(q) ||
        p.bibleBookName.toLowerCase().includes(q)
    );
    pairs.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return cmp * sort.dir;
    });
    return pairs;
  }, [sort, filter]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, p) => ({
          total: a.total + p.total,
          quotes: a.quotes + p.quotes,
          phrases: a.phrases + p.phrases,
        }),
        { total: 0, quotes: 0, phrases: 0 }
      ),
    [rows]
  );

  const open = (p) =>
    navigate({ view: "reader", bomBook: p.bomBookName, bibleBook: p.bibleBookName });

  const header = (key, label) => (
    <th aria-sort={sort.key === key ? (sort.dir === -1 ? "descending" : "ascending") : "none"}>
      <button
        className="xref-sort"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? -s.dir : -1 }))}
      >
        {label}
        <span aria-hidden="true">{sort.key === key ? (sort.dir === -1 ? " ▼" : " ▲") : ""}</span>
      </button>
    </th>
  );

  return (
    <div className="xref-tabletwin-panel">
      <input
        className="xref-tablefilter"
        type="search"
        aria-label="Filter by book"
        placeholder="Filter by book…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="xref-tablewrap">
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
              <tr
                key={`${p.bomBookName}|${p.bibleBookName}`}
                data-testid="xref-pairrow"
                className="xref-pairrow"
                onClick={() => open(p)}
              >
                <td>
                  <button
                    className="xref-rowlink"
                    aria-label={`Open ${p.bomBookName} × ${p.bibleBookName} reader`}
                    onClick={(e) => {
                      e.stopPropagation();
                      open(p);
                    }}
                  >
                    {p.bomBookName}
                  </button>
                </td>
                <td>
                  <button
                    className="xref-rowlink"
                    aria-label={`Open ${p.bomBookName} × ${p.bibleBookName} reader — Bible side`}
                    onClick={(e) => {
                      e.stopPropagation();
                      open(p);
                    }}
                  >
                    {p.bibleBookName}
                  </button>
                </td>
                <td className="num">{p.total}</td>
                <td className="num">{p.quotes}</td>
                <td className="num">{p.phrases}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>{filter.trim() ? `${rows.length} shown` : "All books"}</td>
              <td className="num">{totals.total}</td>
              <td className="num">{totals.quotes}</td>
              <td className="num">{totals.phrases}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
