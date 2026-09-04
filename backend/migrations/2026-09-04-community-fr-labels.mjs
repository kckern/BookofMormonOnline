/** Seed compact French overlays for community UI labels. Dry by default. */
import 'dotenv/config';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const copy = {
  bot: 'Bot',
  audience: 'Invité',
  likes: 'J’aime',
  unlike: 'Retirer',
  finished: 'Terminé',
  load: 'Chargement…',
  members_only: 'Membres',
  members_only_detail: 'Rejoignez le groupe pour participer.',
};
const apply = process.argv.includes('--apply');
if (!apply) {
  console.log(JSON.stringify(copy, null, 2));
  console.log('DRY RUN: pass --apply with SANDBOX=0');
  process.exit(0);
}
if (process.env.SANDBOX !== '0') throw new Error('Apply requires SANDBOX=0');
const required = (key) => process.env[key] || (() => { throw new Error(`${key} required`); })();
const db = await mysql.createConnection({
  host: required('MYSQL_HOST'), port: Number(process.env.MYSQL_PORT || 3306),
  user: required('MYSQL_USER'), password: required('MYSQL_PASSWORD'),
  database: process.env.MYSQL_DB || 'bom_prd',
});
try {
  await db.beginTransaction();
  for (const [key, fr] of Object.entries(copy)) {
    const guid = crypto.createHash('sha256').update(`community-label:${key}`).digest('hex').slice(0, 13);
    const [[label]] = await db.query('SELECT guid FROM bom_label WHERE label_id=?', [key]);
    const labelGuid = label?.guid || guid;
    if (!label) {
      await db.query("INSERT INTO bom_label (guid,label_id,label_text,type) VALUES (?,?,?,'community')", [labelGuid, key, key]);
    }
    await db.query(`INSERT INTO bom_translation (guid,lang,refkey,value,contributor,auditor,time)
      VALUES (?,'fr','label_text',?,'migration:community-fr-labels','',NOW())
      ON DUPLICATE KEY UPDATE value=VALUES(value), contributor=VALUES(contributor), time=VALUES(time)`,
    [labelGuid, fr]);
  }
  await db.commit();
  console.log(`APPLIED ${Object.keys(copy).length} French community labels`);
} catch (error) {
  await db.rollback();
  throw error;
} finally { await db.end(); }
