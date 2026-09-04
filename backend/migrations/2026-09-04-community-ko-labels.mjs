/** Seed compact community labels and Korean overlays. Dry by default. */
import 'dotenv/config';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';

const copy = {
  bot: ['Bot', '봇'],
  audience: ['Audience', '외부'],
  likes: ['Likes', '좋아요'],
  unlike: ['Unlike', '취소'],
  finished: ['Completed', '완료'],
  load: ['Loading…', '로딩…'],
  members_only: ['Members only', '회원 전용'],
  members_only_detail: ['Join this group to participate.', '참여하려면 그룹에 가입하세요.'],
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
  for (const [key, [en, ko]] of Object.entries(copy)) {
    const guid = crypto.createHash('sha256').update(`community-label:${key}`).digest('hex').slice(0, 13);
    await db.query(`INSERT INTO bom_label (guid,label_id,label_text,type) VALUES (?,?,?,'community')
      ON DUPLICATE KEY UPDATE label_text=VALUES(label_text)`, [guid, key, en]);
    const [[label]] = await db.query('SELECT guid FROM bom_label WHERE label_id=?', [key]);
    await db.query(`INSERT INTO bom_translation (guid,lang,refkey,value,contributor,auditor,time)
      VALUES (?,'ko','label_text',?,'migration:community-ko-labels','',NOW())
      ON DUPLICATE KEY UPDATE value=VALUES(value), contributor=VALUES(contributor), time=VALUES(time)`,
    [label.guid, ko]);
  }
  await db.commit();
  console.log(`APPLIED ${Object.keys(copy).length} English/Korean community labels`);
} catch (error) {
  await db.rollback();
  throw error;
} finally { await db.end(); }
