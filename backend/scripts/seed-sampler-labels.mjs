// Seeds the Home Sampler UI labels flagged "new/verify" in
// docs/reference/sampler-label-keys.md (the sampler shipped before these rows
// existed, so tiles rendered raw keys like `latest_activity`). Idempotent:
// deterministic md5 guids + ON DUPLICATE KEY UPDATE.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import crypto from 'crypto';

const md5_8 = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 8);

const labels = {
  people: 'People',
  places: 'Places',
  contents: 'Contents',
  latest_activity: 'Latest Activity',
  menu_community: 'Community',
  // legacy value was "Community" from when /home WAS the community view; the
  // sampler now owns /home, so the nav entry must say Home again.
  menu_home: 'Home',
  narration: 'Narration',
  view_all: 'View all',
  start_reading: 'Start Reading',
  resample: 'Show me something else',
  map: 'Map',
  sampler_value_prop:
    'Every person, place, and passage of the Book of Mormon — annotated, illustrated, and connected.',
  // Map-story tile (WCAG pause control, discontinuity marker, summary meta).
  mapstory_play: 'Play journey',
  mapstory_pause: 'Pause journey',
  mapstory_summary: 'Story summary',
  mapstory_move: 'Move $1',
  mapstory_detached: 'not continuous',
  mapstory_detached_title: 'This move does not continue from the previous one',
  mapstory_meta: '$1 moves · $2 places',
  // Two-layer CTA controls (Layer 1 read-more expand, Layer 2 deeplinks). Used
  // across the tiles; seeded here so they never render as raw keys.
  read_more: 'Read more',
  view_in_context: 'See in context',
  view_more: 'View more',
};

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || process.env.MYSQL_HOST,
    port: process.env.DB_PORT || process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_WRITE_USER || process.env.DB_USER || process.env.MYSQL_USER,
    password: process.env.MYSQL_WRITE_PASSWORD || process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQL_DB || 'bom_prd',
  });
  for (const [label_id, label_text] of Object.entries(labels)) {
    await conn.query(
      `INSERT INTO bom_label (guid, label_id, label_text, type) VALUES (?, ?, ?, 'home')
       ON DUPLICATE KEY UPDATE label_text=VALUES(label_text)`,
      [md5_8(`sampler-label-${label_id}`), label_id, label_text],
    );
    console.log('seeded label:', label_id);
  }
  await conn.end();
})().catch((err) => { console.error('seed failed:', err.message); process.exit(1); });
