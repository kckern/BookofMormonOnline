/**
 * Maps each of Skousen's 22 witness sigla to a renderable fax edition (or none).
 *
 * A siglum earns a crop only when it has both a scanned fax `version` AND verse
 * `geometry` in that scan. The three ways a siglum falls short:
 *   - siglum `0` (Original Manuscript) is label-only — its reading is attested,
 *     but there is no page scan to crop, so it never yields an image;
 *   - the 11 editions `E,F,G,H,K,L,M,N,P,Q,S` have scans but no verse geometry,
 *     so we cannot locate the verse on the page → no crop;
 *   - `J` and `O` are PLACEHOLDERS: we have no scan of Skousen's own edition, so
 *     we stand in a contemporaneous Deseret News printing (`1888d` for the 1888
 *     Juvenile Instructor edition, `1907` for the 1907 vest-pocket edition).
 *     Their `exact:false` and `scanTitle` carries the SCAN's real name; the UI
 *     must caption these with `scanTitle`, never with Skousen's edition name.
 *
 * `1` maps to `printer`, NEVER `1829` — that edition's geometry is retired.
 */
import { WITNESSES, SIGLA_ORDER } from "./apparatus";

const entry = (version, hasGeometry, exact, scanTitle = undefined) =>
  Object.freeze(
    scanTitle === undefined
      ? { version, hasGeometry, exact }
      : { version, hasGeometry, exact, scanTitle }
  );

/** siglum → { version, hasGeometry, exact, scanTitle? }. Frozen. */
export const FAX_FOR_SIGLUM = Object.freeze({
  "0": entry(null, false, true),
  "1": entry("printer", true, true),
  A: entry("1830", true, true),
  B: entry("1837", true, true),
  C: entry("1840", true, true),
  D: entry("1841", true, true),
  E: entry(null, false, true),
  F: entry(null, false, true),
  G: entry(null, false, true),
  H: entry(null, false, true),
  I: entry("1879", true, true),
  J: entry("1888d", true, false, "1888 Deseret News printing"),
  K: entry(null, false, true),
  L: entry(null, false, true),
  M: entry(null, false, true),
  N: entry(null, false, true),
  O: entry("1907", true, false, "1907 Deseret News"),
  P: entry(null, false, true),
  Q: entry(null, false, true),
  R: entry("1920", true, true),
  S: entry(null, false, true),
  T: entry("1981", true, true),
});

/**
 * For the geometry-bearing sigla in `sigla`, return the crop candidates
 * `{ siglum, version, exact, scanTitle, label }` sorted by chronological
 * SIGLA_ORDER. Sigla without geometry (including `0`) are dropped.
 */
export function faxCandidates(sigla) {
  return sigla
    .filter((s) => FAX_FOR_SIGLUM[s] && FAX_FOR_SIGLUM[s].hasGeometry)
    .sort((a, b) => SIGLA_ORDER.indexOf(a) - SIGLA_ORDER.indexOf(b))
    .map((siglum) => {
      const { version, exact, scanTitle } = FAX_FOR_SIGLUM[siglum];
      return { siglum, version, exact, scanTitle, label: WITNESSES[siglum].label };
    });
}
