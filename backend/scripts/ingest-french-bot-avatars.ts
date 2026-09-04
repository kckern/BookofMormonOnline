/** One-off reviewed Wikimedia Commons avatar ingest. Run inside prod with --apply. */
import 'dotenv/config';
import { closeDb, getDb } from '../src/data/db.js';
import { uploadProfileImage } from '../src/media/s3.js';

const sources = [
  ['3a2664b32361a0d6b7a11a176cdc11e6', 'Carolus Magnus. Charlemagne.jpg'],
  ['ba6dca8377fa52f07e0dbdaa08852184', "Portrait de Jeanne d'Arc, à cheval - estampe - btv1b8400162h.jpg"],
  ['93a0ea91770abe88b5912d35dcf91e9e', 'Louis XIV.jpg'],
  ['70e1b2821a6f0029aef74f03725b13e9', 'Olympe de Gouges.png'],
  ['ccc8eaeb17df63e1721adc30bbab9d97', 'Robespierre.jpg'],
  ['9f7e7a68ddbc342d18d3e1f00441ead3', 'Moliere.jpg'],
  ['b495e2da6866a5563837086526e7963f', 'Portrait de Voltaire (1694-1778), philosophe, S1854.jpg'],
  ['a6a85ed454759de4de9905c6b9d09e0f', 'Portrait de Victor Hugo 1802-1885, écrivain., PH14102.jpg'],
  ['f9c208bdb07b72696d519b45917d7947', 'Félix Nadar 1820-1910 portraits Jules Verne.jpg'],
  ['e571e37db3e612fd3e79584980afb7f3', 'Louis-Auguste Bertrand2.jpg'],
] as const;

const apply = process.argv.includes('--apply');
if (apply && process.env['SANDBOX'] !== '0') throw new Error('Apply requires SANDBOX=0');
const db = getDb();
try {
  for (const [botId, filename] of sources) {
    const source = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}`;
    console.log(`${apply ? 'INGEST' : 'WOULD INGEST'} ${botId} <- ${source}`);
    if (!apply) continue;
    const response = await fetch(source, { redirect: 'follow', headers: { 'user-agent': 'BookofMormonOnline/1.0 avatar-ingest' } });
    if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
    const url = await uploadProfileImage(Buffer.from(await response.arrayBuffer()).toString('base64'), botId);
    await db.updateTable('messenger_users').set({ profile_url: url }).where('user_id', '=', botId).execute();
    console.log(`UPDATED ${botId} ${url}`);
  }
} finally { await closeDb(); }
