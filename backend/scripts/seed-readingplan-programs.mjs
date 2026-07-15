// Seeds the program catalog + readingplan UI labels. Idempotent
// (INSERT ... ON DUPLICATE KEY UPDATE, deterministic md5 guids). Verse ranges
// come from scripture-guide chapter endpoints (bare book names return empty).
import 'dotenv/config';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { lookup } from 'scripture-guide';

const md5_8 = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);
const md5_32 = (s) => crypto.createHash('md5').update(s).digest('hex');

// Chapter-endpoint ranges (bare book names resolve to []; must use chapters).
const chapterRange = (fromRef, toRef) => ({
  start: Math.min(...lookup(fromRef).verse_ids),
  end: Math.max(...lookup(toRef).verse_ids),
});
const wholeBook = chapterRange('1 Nephi 1', 'Moroni 10'); // { start: 31103, end: 37706 }
const mosiah = chapterRange('Mosiah 1', 'Mosiah 29');      // { start: 32793, end: 33577 }

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || process.env.MYSQL_HOST,
    port: process.env.DB_PORT || process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_WRITE_USER || process.env.DB_USER || process.env.MYSQL_USER,
    password: process.env.MYSQL_WRITE_PASSWORD || process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQL_DB || 'bom_prd',
  });

  const programs = [
    { slug: 'bom-in-a-year', title: 'Book of Mormon in a Year', description: 'A steady weekly walk through the whole book.',
      sort: 1, config: { scope: { type: 'range', ...wholeBook }, pacing: { type: 'cadence', unit: 'week', count: 52 }, segmentation: { type: 'even', parts: 52 }, credit: 'fresh' } },
    { slug: '90-day-challenge', title: '90-Day Challenge', description: 'The whole Book of Mormon in three focused months.',
      sort: 2, config: { scope: { type: 'range', ...wholeBook }, pacing: { type: 'cadence', unit: 'day', count: 90 }, segmentation: { type: 'even', parts: 90 }, credit: 'fresh' } },
    { slug: 'one-page-at-a-time', title: 'One Page at a Time', description: 'No dates, no pressure — one narrative page per sitting.',
      sort: 3, config: { scope: { type: 'range', ...wholeBook }, pacing: { type: 'selfpaced' }, segmentation: { type: 'page' }, credit: 'alltime' } },
    { slug: 'mosiah-in-30-days', title: 'Mosiah in 30 Days', description: 'A daily sprint through the book of Mosiah.',
      sort: 4, config: { scope: { type: 'range', ...mosiah }, pacing: { type: 'cadence', unit: 'day', count: 30 }, segmentation: { type: 'even', parts: 30 }, credit: 'fresh' } },
  ];

  // Pages-scope example — only if the slug exists on this DB.
  const [mm] = await conn.query(`SELECT slug FROM bom_slug WHERE slug = 'messianic-ministry' LIMIT 1`);
  if (mm.length) {
    programs.push({ slug: 'messianic-ministry-deep-dive', title: 'Messianic Ministry Deep Dive',
      description: 'Self-paced study of the Messianic Ministry, section by section.', sort: 5,
      config: { scope: { type: 'pages', slugs: ['messianic-ministry'] }, pacing: { type: 'selfpaced' }, segmentation: { type: 'section' }, credit: 'alltime' } });
  } else console.warn('WARN: slug messianic-ministry not found — skipping pages-scope program');

  for (const p of programs) {
    await conn.query(
      `INSERT INTO bom_readingplan_program (guid, slug, title, description, config, sort, active)
       VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, 1)
       ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), config=VALUES(config), sort=VALUES(sort)`,
      [md5_32(`rp-program-${p.slug}`), p.slug, p.title, p.description, JSON.stringify(p.config), p.sort],
    );
    console.log('seeded program:', p.slug);
  }

  const labels = {
    rp_start_a_plan: 'Start a Reading Plan', rp_build_your_own: 'Build your own',
    rp_choose_program: 'Choose a program', rp_start_plan: 'Start plan', rp_starting: 'Starting…',
    rp_start_date: 'Start date', rp_count_past_reading: 'Count reading I have already done',
    rp_start_fresh: 'Start fresh', rp_wizard_what: 'What will you read?',
    rp_wizard_pace: 'How fast?', rp_wizard_confirm: 'Your plan', rp_tab_guide: 'Our Guide',
    rp_tab_books: 'Books', rp_pace_daily: 'Daily portions', rp_pace_weekly: 'Weekly portions',
    rp_pace_bydate: 'Finish by a date', rp_pace_selfpaced: 'My own pace — no dates',
    rp_parts: 'portions', rp_sections: 'sections', rp_clamped: 'This selection supports up to $1 portions',
    rp_plan_complete: 'Plan complete!', rp_start_another: 'Start another plan',
    rp_abandon_plan: 'Abandon plan', rp_abandon_confirm: 'Abandon this plan? Your reading history is kept.',
    rp_active_exists: 'You already have an active plan. Finish or abandon it first.',
    rp_error_loading: 'Could not load your reading plan.', rp_retry: 'Retry',
    rp_ends: 'Ends', rp_next: 'Next', rp_back: 'Back', rp_empty_scope: 'Pick at least one thing to read.',
  };
  for (const [label_id, label_text] of Object.entries(labels)) {
    await conn.query(
      `INSERT INTO bom_label (guid, label_id, label_text, type) VALUES (?, ?, ?, 'readingplan')
       ON DUPLICATE KEY UPDATE label_text=VALUES(label_text)`,
      [md5_8(`rp-label-${label_id}`), label_id, label_text],
    );
  }
  console.log('seeded', Object.keys(labels).length, 'labels');
  await conn.end();
})().catch((err) => { console.error('seed failed:', err.message); process.exit(1); });
