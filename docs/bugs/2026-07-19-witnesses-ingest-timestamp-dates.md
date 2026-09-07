# Witnesses archive: ingest timestamps written into `date` and `event_date`

**Date:** 2026-07-19
**Status:** Frontend impact neutralized in code; **source data still wrong** and needs a migration.
**Scope:** `bom_xtras_history`, `archive='witnesses'` — 15 rows with modern timestamps in
`event_date`, 34 rows with post-1950 values in `date`, 2 rows with impossible years.

---

## Symptom

An 1830 document displayed with a February 2023 date. Before the fix, the Witnesses heatmap axis ran
**1829–2023** and placed 19th-century documents in 21st-century cells.

## Root cause

Rows entered without a known source date took the ingest date as a default, and that default was
written into **three** fields at once — the slug, `date`, and `event_date`. The slug makes it
self-evident:

| slug | year | event_year | event_date | date |
|---|---|---|---|---|
| `2021-08-11-joseph-smith-jr` | 1832 | 1832 | 2021-08-11 | 2021-08-11 |
| `2022-11-02-eight-witnesses` | 1830 | 1830 | 2022-11-02 | 2022-11-02 |
| `2023-02-13-three-witnesses` | 1830 | 1830 | 2023-02-13 | 2023-02-13 |
| `2023-02-13-lucy-mack-smith` | 1845 | 1845 | 2023-02-13 | 2023-02-13 |

The values cluster on a handful of exact repeated dates — 7 rows on `2021-08-11`, 5 on `2023-02-13`,
1 each on `2022-11-02`, `2022-12-20`, `2023-01-03` — which is the signature of batch edits, not of
recorded dates.

**`year` and `event_year` are correct on all 15 rows.** The real dating information survives; only
the day-precision fields are junk. That is why the fix below is lossless.

### Full list (15 rows)

```
2021-08-11-joseph-smith-jr                            year=1832
2021-08-11-joseph-smith-jr-2                          year=1832
2021-08-11-joseph-smith-jr-4                          year=1835
2021-08-11-joseph-smith-jr-3                          year=1838
2021-08-11-lucy-mack-smith-eight-witnesses            year=1845  event_year=1829
2021-08-11-lucy-mack-smith                            year=1845
2021-08-11-lucy-mack-smith-2                          year=1845
2022-11-02-eight-witnesses                            year=1830
2022-12-20-manuscript-history-of-the-church-hyrum-smith  year=1855
2023-01-03-lucy-mack-smith                            year=1845
2023-02-13-three-witnesses                            year=1830
2023-02-13-joseph-smith-jr                            year=1834
2023-02-13-john-whitmer                               year=1835
2023-02-13-john-corrill-three-witnesses               year=1839
2023-02-13-lucy-mack-smith                            year=1845
```

### Related corruption in the same archive

- **`date` post-1950: 34 rows.** Includes the 15 above plus reprint/publication years
  (`2003` ×3, `1991`, `2014`) recorded as if they were the source's date.
- **`date` impossible: 2 rows** — `8795` and `4806`, transpositions.
- **`date` vs `year` disagree: 76 rows** total.
- **`reception` archive is clean** — 0 of 580 rows diverge, 0 post-1950. This is confined to
  `witnesses`.

## Frontend impact — already neutralized

`frontend/webapp/src/views/History/witnessSources.js` derives display dates from `year`, taking
month precision from `event_date` **only when `event_date`'s own year matches `year`**. All 15 rows
fail that gate and degrade to year precision, which is correct and is exactly what the data supports.
`date` is never read for this archive at all.

Measured effect on the David Whitmer view:

```
before   1829–2023 · 109 of 152 sources placed · 4 undated
after    1829–1945 · 125 of 152 sources placed · 27 year-only
```

Regression coverage lives in `frontend/webapp/src/views/History/__tests__/witnessSources.test.js`
(the "never reads the corrupt date column" mutation test, and the out-of-range/mismatched-year
gate tests) and `__tests__/WitnessLifeHeatmap.test.js` (axis and meta-strip assertions).

**No frontend change is needed.** The remaining work is data hygiene.

## Recommended fix (data)

Run in the private workspace repo, where write credentials and migrations live. Null the junk rather
than guessing a day — `year` already carries everything that is known:

```sql
UPDATE bom_xtras_history
   SET event_date = NULL
 WHERE archive = 'witnesses'
   AND event_date IS NOT NULL
   AND CAST(LEFT(event_date, 4) AS UNSIGNED) <> year;

UPDATE bom_xtras_history
   SET date = NULL
 WHERE archive = 'witnesses'
   AND date IS NOT NULL
   AND CAST(LEFT(date, 4) AS UNSIGNED) <> year;
```

Verify no row loses real information first — every row these touch should have a trustworthy `year`:

```sql
SELECT COUNT(*) FROM bom_xtras_history
 WHERE archive='witnesses' AND (year IS NULL OR year = 0);   -- expect 0
```

The frontend output will not change; the module already computes the post-fix answer. The benefit is
for anything else querying the table directly.

### Do not rename the slugs

The timestamp is also embedded in the slug (`2023-02-13-three-witnesses`), which is ugly but
**user-visible in deep links** — `Witnesses.js` routes `/history/witnesses/:witness/:source` and
opens a source popup by slug. Renaming would break existing shared URLs. Leave them, or add a
redirect map if it ever matters.

## Prevention

The ingest path should refuse to default a source date to the current date. If a source's day is
unknown, `date`/`event_date` should be `NULL` and `year` alone should carry the dating — the display
layer already handles year-only precision as a first-class case rather than an error.
