import { describe, expect, it } from 'vitest';
import {
  auditAbsoluteGeometry,
  auditDuplicatesAndOverlaps,
  auditFamilies,
  auditOrderingAndNotches,
  effectiveArea,
  robustDistanceOutlier,
  robustDistanceSummary,
  type EditionMeta,
  type GeometryRow,
} from '../../scripts/lib/fax-geometry-audit-core.js';

const row = (overrides: Partial<GeometryRow> = {}): GeometryRow => ({
  uid: 1,
  version: '1852',
  verseId: 31103,
  page: 1,
  imagePage: 1,
  pageWidth: 1400,
  pageScale: 700,
  X: 50,
  Y: 100,
  W: 280,
  H: 80,
  TLW: 0,
  TLH: 0,
  BRW: 0,
  BRH: 0,
  ...overrides,
});

const metas = new Map<string, EditionMeta>([
  ['1852', { version: '1852', pages: 600, pgfirstVerse: 1, format: 'png', imageOffset: 0 }],
]);

describe('fax structural geometry audit', () => {
  it('flags impossible dimensions, out-of-bounds notches, and disconnected polygons', () => {
    const findings = auditAbsoluteGeometry([
      row({ uid: 1, H: -2 }),
      row({ uid: 2, TLW: 281, TLH: 20 }),
      row({ uid: 3, W: 100, H: 40, TLW: 60, TLH: 25, BRW: 40, BRH: 20 }),
    ], metas);
    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'NON_POSITIVE_SIZE',
      'INVALID_TL_NOTCH_WIDTH',
      'DISCONNECTED_POLYGON',
    ]));
  });

  it('calculates effective polygon area after both corner cutouts', () => {
    expect(effectiveArea(row({ W: 100, H: 100, TLW: 20, TLH: 10, BRW: 30, BRH: 10 })))
      .toBe(9_500);
  });

  it('detects different verses claiming nearly identical rectangles', () => {
    const findings = auditDuplicatesAndOverlaps([
      row({ uid: 1, verseId: 33882, X: 76, Y: 68, W: 265, H: 120 }),
      row({ uid: 2, verseId: 33883, X: 77, Y: 68, W: 265, H: 120 }),
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('DIFFERENT_VERSE_NEAR_DUPLICATE');
  });

  it('flags notches at a page continuation for pixel/OCR validation without auto-repairing', () => {
    const findings = auditOrderingAndNotches([
      row({
        uid: 1,
        verseId: 34000,
        page: 10,
        imagePage: 10,
        Y: 700,
        BRW: 80,
        BRH: 20,
      }),
      row({
        uid: 2,
        verseId: 34000,
        page: 11,
        imagePage: 11,
        Y: 80,
        TLW: 60,
        TLH: 20,
      }),
    ]);
    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      'BR_NOTCH_AT_PAGE_CONTINUATION',
      'TL_NOTCH_AT_PAGE_CONTINUATION',
    ]));
    expect(findings.filter((finding) => finding.autoRepairEligible)).toHaveLength(0);
  });

  it('detects plate-family notch topology disagreement', () => {
    const rows = [
      row({ uid: 1, version: 'a', TLW: 0, TLH: 0 }),
      row({ uid: 2, version: 'b', TLW: 100, TLH: 20 }),
      row({ uid: 3, version: 'c', TLW: 100, TLH: 20 }),
    ];
    const findings = auditFamilies(rows, [{ id: 'test-family', members: ['a', 'b', 'c'], reference: 'a' }]);
    expect(findings.some((finding) =>
      finding.version === 'a' && finding.code === 'FAMILY_TL_TOPOLOGY_MISMATCH')).toBe(true);
  });

  it('flags a greedy snap distance against a tight robust distribution', () => {
    const distances = [...Array.from({ length: 18 }, () => 1), 2, 2];
    expect(robustDistanceSummary(distances)).toMatchObject({
      count: 20,
      median: 1,
      p99: 2,
    });
    const result = robustDistanceOutlier(18, distances);
    expect(result.outlier).toBe(true);
    expect(result.percentile).toBe(1);
  });

  it('does not call an ordinary p99 plateau an outlier when MAD is zero', () => {
    const distances = [...Array.from({ length: 15 }, () => 0), ...Array.from({ length: 5 }, () => 20)];
    const result = robustDistanceOutlier(20, distances);
    expect(result.robustZ).toBeNull();
    expect(result.classicZ).toBeLessThan(3);
    expect(result.outlier).toBe(false);
  });
});
