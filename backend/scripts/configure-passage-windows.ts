/** Validate (default) or replace a channel's dated passage windows. */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { lookupReference, type LanguageCode } from 'scripture-guide';
import { closeDb, getDb } from '../src/data/db.js';
import { BOM_FIRST_VERSE_ID, BOM_LAST_VERSE_ID } from '../src/bots/passagePicker.js';

type InputWindow = { key: string; label: string; startsOn: string; endsOn: string; enabled?: boolean; ranges: string[] };
type Input = { channelUrl: string; lang?: string; windows: InputWindow[] };
type Resolved = InputWindow & { sequence: number; bounds: Array<{ passageRef: string; min: number; max: number }> };
const args = process.argv.slice(2);
const file = args[args.indexOf('--file') + 1];
const apply = args.includes('--apply');
if (!file) throw new Error('pass --file <curriculum.json>');
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function resolve(input: Input): Resolved[] {
  if (!input.channelUrl?.trim()) throw new Error('channelUrl is required');
  if (!Array.isArray(input.windows)) throw new Error('windows must be an array');
  const keys = new Set<string>();
  const windows = input.windows.map((window, sequence) => {
    if (!/^[A-Za-z0-9_.:-]{1,96}$/.test(window.key || '')) throw new Error(`windows[${sequence}].key is invalid`);
    if (keys.has(window.key)) throw new Error(`duplicate window key ${window.key}`);
    keys.add(window.key);
    if (!window.label?.trim() || !datePattern.test(window.startsOn) || !datePattern.test(window.endsOn)
      || window.startsOn > window.endsOn) throw new Error(`window ${window.key} has invalid label/dates`);
    if (!window.ranges?.length) throw new Error(`window ${window.key} needs at least one range`);
    const bounds = window.ranges.map((passageRef) => {
      const ids = lookupReference(passageRef, (input.lang || 'en') as LanguageCode).verse_ids.map(Number).sort((a, b) => a - b);
      if (!ids.length || ids[0]! < BOM_FIRST_VERSE_ID || ids.at(-1)! > BOM_LAST_VERSE_ID) {
        throw new Error(`${window.key}: range is not wholly in the Book of Mormon: ${passageRef}`);
      }
      if (ids.some((id, index) => index > 0 && id !== ids[index - 1]! + 1)) {
        throw new Error(`${window.key}: use separate entries for a non-contiguous reference: ${passageRef}`);
      }
      return { passageRef, min: ids[0]!, max: ids.at(-1)! };
    });
    return { ...window, sequence, bounds };
  });
  const enabled = windows.filter((window) => window.enabled !== false).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  for (let index = 1; index < enabled.length; index++) {
    if (enabled[index]!.startsOn <= enabled[index - 1]!.endsOn) {
      throw new Error(`enabled windows overlap: ${enabled[index - 1]!.key} and ${enabled[index]!.key}`);
    }
  }
  return windows;
}

async function main() {
  const input = JSON.parse(await readFile(file as string, 'utf8')) as Input;
  const windows = resolve(input);
  console.log(`VALID: ${windows.length} windows, ${windows.reduce((sum, window) => sum + window.bounds.length, 0)} ranges for ${input.channelUrl}`);
  if (!apply) return console.log('DRY RUN: no database writes; pass --apply after review');
  if (process.env['SANDBOX'] !== '0') throw new Error('rerun with SANDBOX=0 when --apply is intended');
  const db = getDb();
  try {
    await db.transaction().execute(async (trx) => {
      await trx.deleteFrom('bom_ai_passage_window').where('channel_url', '=', input.channelUrl).execute();
      for (const window of windows) {
        await trx.insertInto('bom_ai_passage_window').values({
          window_key: window.key, channel_url: input.channelUrl, sequence_no: window.sequence,
          label: window.label, starts_on: new Date(`${window.startsOn}T00:00:00Z`),
          ends_on: new Date(`${window.endsOn}T00:00:00Z`), enabled: window.enabled === false ? 0 : 1,
        }).execute();
        await trx.insertInto('bom_ai_passage_range').values(window.bounds.map((range, ordinal) => ({
          window_key: window.key, ordinal, passage_ref: range.passageRef,
          min_verse_id: range.min, max_verse_id: range.max,
        }))).execute();
      }
    });
    console.log(`APPLIED: replaced passage windows for ${input.channelUrl}`);
  } finally { await closeDb(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
