/**
 * studylog loader — the user's study history + summary, aggregated from bom_log.
 *
 * Port of the legacy src/resolvers/_common.ts helpers (getLoggedTextItems →
 * sessionsFromTextItems → summaryFromSessions / completedFromTextItems). Feeds the
 * /user dashboard's "date started / study time / study sessions" stat widgets and
 * the study-history list. Read-only (sandbox-safe).
 *
 * Sessions: bom_log rows for the user (newest first), grouped into sessions where
 * a gap > 30 min starts a new one; sessions shorter than 10s are dropped.
 */
import type { Kysely } from 'kysely';
import type { DB } from '../../../codegen/db.js';

const SESSION_GAP_SECONDS = 60 * 30; // a >30min gap starts a new session
const MIN_SESSION_SECONDS = 10; // drop sub-10s "sessions"

interface LogItem { timestamp: number; type: string; value: string }

export interface StudySummary {
  first: number;
  duration: number;
  count: number;
  finished: number[];
}
export interface StudySession {
  timestamp: number;
  datetime: string;
  duration: number;
  description: string;
  slug: string;
}
export interface StudyLogResult {
  summary: StudySummary;
  sessions: StudySession[];
}

/** Group DESC-ordered log items into sessions (by the 30-min gap rule). */
function sessionsFromItems(items: LogItem[]): LogItem[][] {
  const sessions: LogItem[][] = [];
  let lastTs: number | null = null;
  let idx = -1;
  for (const item of items) {
    const ts = Number(item.timestamp);
    if (lastTs === null || lastTs - ts > SESSION_GAP_SECONDS) idx++;
    (sessions[idx] ??= []).push(item);
    lastTs = ts;
  }
  // session[0] is newest, session[last] is oldest → duration = newest - oldest.
  return sessions.filter((s) => Number(s[0]!.timestamp) - Number(s[s.length - 1]!.timestamp) > MIN_SESSION_SECONDS);
}

function summaryFromSessions(sessions: LogItem[][], finished: number[]): StudySummary {
  let duration = 0;
  let first = 0;
  for (const s of sessions) {
    const start = Number(s[s.length - 1]!.timestamp); // oldest in session
    const end = Number(s[0]!.timestamp); // newest in session
    duration += end - start;
    first = start; // ends as the oldest session's start = the user's first study
  }
  return { first, duration, count: sessions.length, finished };
}

const emptyResult = (): StudyLogResult => ({
  summary: { first: Math.round(Date.now() / 1000), duration: 0, count: 0, finished: [] },
  sessions: [],
});

/**
 * Build the study log for a session token. Returns the legacy "empty" shape
 * (first = now, zero counts) when the token is unknown or the user has no log —
 * matching what the frontend expects so the stat widgets resolve instead of
 * spinning forever.
 */
export async function getStudyLog(db: Kysely<DB>, token: string | null | undefined): Promise<StudyLogResult> {
  if (!token) return emptyResult();

  const tokenRow = await db
    .selectFrom('bom_user_token')
    .select('user')
    .where('token', '=', token)
    .executeTakeFirst();
  if (!tokenRow) return emptyResult();

  const items = (await db
    .selectFrom('bom_log')
    .select(['timestamp', 'type', 'value'])
    .where('user', '=', tokenRow.user)
    .where('type', '!=', 'referral')
    .orderBy('timestamp', 'desc')
    .execute()) as LogItem[];
  if (!items.length) return emptyResult();

  const finished = items.filter((i) => i.type === 'finished').map((i) => Number(i.timestamp));
  const sessions = sessionsFromItems(items);
  const summary = summaryFromSessions(sessions, finished);

  const sessionDtos: StudySession[] = sessions.map((s) => {
    const start = Number(s[s.length - 1]!.timestamp);
    const end = Number(s[0]!.timestamp);
    return {
      timestamp: start,
      datetime: new Date(start * 1000).toISOString(),
      duration: end - start,
      description: '',
      slug: '',
    };
  });

  return { summary, sessions: sessionDtos };
}
