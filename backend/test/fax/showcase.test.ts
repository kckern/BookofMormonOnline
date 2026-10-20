/**
 * Live-DB + live-scan checks for the showcase crop validator (blind audit R7
 * faxVerse-A2). Read-only. Skips without DB credentials.
 */
import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';

const live = !!process.env.MYSQL_HOST;
const d = live ? describe : describe.skip;

d('verseCropOk (live)', async () => {
  const { verseCropOk } = await import('../../src/media/fax/showcase.js');
  const { closeDb } = await import('../../src/data/db.js');
  afterAll(async () => { await closeDb(); });

  it('rejects the 1907 Salt Lake crop of Alma 11:41 (box narrower than the column: "the ban|", "accordin|")', async () => {
    expect(await verseCropOk('1907s', 33931)).toBe(false);
  }, 60000);

  it('rejects a blank crop (1874, verse 34619)', async () => {
    expect(await verseCropOk('1874', 34619)).toBe(false);
  }, 60000);

  it('rejects a one-word box for a whole verse (1842, verse 32445: just "shall")', async () => {
    expect(await verseCropOk('1842', 32445)).toBe(false);
  }, 60000);

  it('accepts clean crops (1830 / 1879 / 2013, Alma 11:41)', async () => {
    for (const v of ['1830', '1879', '2013']) expect(await verseCropOk(v, 33931)).toBe(true);
  }, 60000);
});
