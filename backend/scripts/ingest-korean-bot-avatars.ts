/** One-off reviewed Wikimedia Commons avatar ingest. Run inside prod with --apply. */
import 'dotenv/config';
import { closeDb, getDb } from '../src/data/db.js';
import { uploadProfileImage } from '../src/media/s3.js';

const sources = [
  ['6de3f57d56265dd7e323c6f22a21bc70', 'Portrait of King Sejong 1965.jpg'],
  ['16ca5a390531114d4203f2b55e2ab527', '충무공도 - 조선민화박물관.jpg'],
  ['928abeabf0c0b6c89ea108ef3052f4a9', '원효대사 영정.JPG'],
  ['07e0a9c9de8c3be3e6590e1bf7d8cbad', 'Princess Bari holding the flower of resurrection.jpg'],
  ['f54cff64a872f64a255532dbd2062d55', 'Vénérable André Kim, photographie d’une peinture à l’huile de Tjyang Louis - 1920.jpg'],
  ['f2923f105ddea768091355433d4df689', '明东学校创始人著名的教育家反日运动组织者金跃渊.jpg'],
  ['0372c201c46b45b95143efba6fdefef6', 'Jeong Yak-yong.jpg'],
  ['ed144a33d24c7361edfa52d1e5c87df5', 'Korean scientist-Jang Yeongsil-01.jpg'],
  ['bf27142bcefd60b87c22fd9fbadfd6a0', 'Ryu Gwan-sun.jpg'],
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
