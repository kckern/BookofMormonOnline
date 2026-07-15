// The deterministic generator (spec §Segment generator): config → SegmentDrafts.
// Used by BOTH previewReadingPlan (dry-run) and startReadingPlan (persist) so
// preview and reality can never disagree (spec acceptance #7). It also validates
// calendar due dates here (the pure assignPacing has no warning channel): a due
// on/before startdate is INVALID_DUE (hard — callers reject), a window shorter
// than the segment count is DUE_TOO_SOON (soft — the plan extends past the date).
import type { Kysely } from 'kysely';
import type { DB } from '../../codegen/db.js';
import { resolveScope } from './scope.js';
import { sliceSections } from './slice.js';
import { assignPacing, daysBetween } from './pace.js';
import type { GenWarning, PlanConfig, SegmentDraft } from './types.js';

export interface GenerateResult { segments: SegmentDraft[]; warnings: GenWarning[] }

export async function generatePlanSegments(
  db: Kysely<DB>,
  config: PlanConfig,
  startdate: string,
): Promise<GenerateResult> {
  const sections = await resolveScope(db, config.scope);
  const { chunks, warnings } = sliceSections(sections, config.segmentation);
  if (!chunks.length) return { segments: [], warnings };

  if (config.pacing.type === 'calendar') {
    const room = daysBetween(startdate, config.pacing.due);
    if (room <= 0) warnings.push({ code: 'INVALID_DUE' });
    else if (room < chunks.length) warnings.push({ code: 'DUE_TOO_SOON', detail: chunks.length });
  }

  return { segments: assignPacing(chunks, config.pacing, startdate), warnings };
}
