// The config vocabulary (spec "Config JSON vocabulary"). This is the single
// definition — resolvers, generator, and seeds all speak these shapes.
export type ScopeConfig =
  | { type: 'range'; start: number; end: number }
  | { type: 'pages'; slugs: string[] }
  | { type: 'sections'; guids: string[] };

export type PacingConfig =
  | { type: 'cadence'; unit: 'day' | 'week'; count: number }
  | { type: 'calendar'; due: string } // YYYY-MM-DD
  | { type: 'selfpaced' };

export type SegmentationConfig =
  | { type: 'even'; parts: number }
  | { type: 'section' }
  | { type: 'page' };

export interface PlanConfig {
  scope: ScopeConfig;
  pacing: PacingConfig;
  segmentation: SegmentationConfig;
  credit: 'fresh' | 'alltime';
}

/** A whole section resolved from scope — the atomic unit of composition (spec D9). */
export interface ScopedSection {
  guid: string;
  pageGuid: string;
  blocks: number;   // atomic units of MEASUREMENT — used for weighting
  minVerse: number;
  maxVerse: number;
}

export interface SegmentDraft {
  period: string | null;
  ref: string;
  duedate: string | null; // YYYY-MM-DD or null (selfpaced)
  start: number;
  end: number;
  sectionGuids: string[];
}

export interface GenWarning { code: 'PARTS_CLAMPED' | 'EMPTY_SCOPE'; detail?: number }

export function parsePlanConfig(raw: string): PlanConfig | null {
  try {
    const c = JSON.parse(raw) as PlanConfig;
    if (!c?.scope?.type || !c?.pacing?.type || !c?.segmentation?.type) return null;
    if (c.credit !== 'fresh' && c.credit !== 'alltime') return null;
    if (
      c.segmentation.type === 'even' &&
      (!Number.isInteger(c.segmentation.parts) || c.segmentation.parts < 1)
    ) return null;
    return c;
  } catch { return null; }
}
