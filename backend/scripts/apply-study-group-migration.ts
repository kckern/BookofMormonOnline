/** Apply the additive study-group schema with an explicit production-write opt in. */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createConnection } from 'mysql2/promise';

const apply = process.argv.includes('--apply');
const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../migrations/2026-08-29-study-group-public-beta.sql',
);
const expectedTables = [
  'messenger_channel_policy', 'messenger_thread_state', 'messenger_content_report',
  'bom_ai_discussion_config', 'bom_ai_topic', 'bom_ai_discussion_turn',
  'bom_ai_corpus', 'bom_ai_bot_corpus', 'bom_ai_evidence', 'bom_ai_audience_bot',
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main(): Promise<void> {
  const migration = await readFile(migrationPath, 'utf8');
  console.log(`READY: ${migrationPath} (${expectedTables.length} additive tables)`);
  if (!apply) {
    console.log('DRY RUN: no database writes; pass --apply with SANDBOX=0');
    return;
  }
  if (process.env['SANDBOX'] !== '0') {
    throw new Error('refusing schema writes unless SANDBOX=0 is explicit');
  }

  const database = process.env['MYSQL_DB'] || 'bom_prd';
  const connection = await createConnection({
    host: required('MYSQL_HOST'), port: Number(process.env['MYSQL_PORT'] || 3306),
    user: required('MYSQL_USER'), password: required('MYSQL_PASSWORD'), database,
    timezone: 'Z', multipleStatements: true,
  });
  try {
    await connection.query(migration);
    const placeholders = expectedTables.map(() => '?').join(',');
    const [rows] = await connection.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_name IN (${placeholders})`,
      [database, ...expectedTables],
    );
    const found = new Set((rows as Array<{ table_name?: string; TABLE_NAME?: string }>)
      .map((row) => row.table_name ?? row.TABLE_NAME).filter((name): name is string => !!name));
    const missing = expectedTables.filter((table) => !found.has(table));
    if (missing.length) throw new Error(`migration verification failed; missing: ${missing.join(', ')}`);
    console.log(`APPLIED: verified ${found.size}/${expectedTables.length} study-group tables`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
