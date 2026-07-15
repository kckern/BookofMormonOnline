// Idempotent DDL for custom reading plans (spec D6, D10).
// Creates bom_readingplan_program; adds status/config/enddate to bom_readingplan.
// Safe to run repeatedly: checks information_schema before every change.
import 'dotenv/config';
import mysql from 'mysql2/promise';

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || process.env.MYSQL_HOST,
    port: process.env.DB_PORT || process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_WRITE_USER || process.env.DB_USER || process.env.MYSQL_USER,
    password: process.env.MYSQL_WRITE_PASSWORD || process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD,
    database: process.env.DB_NAME || process.env.MYSQL_DB || 'bom_prd',
  });

  const db = (process.env.DB_NAME || process.env.MYSQL_DB || 'bom_prd');

  async function hasColumn(table, column) {
    const [rows] = await conn.query(
      `SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
      [db, table, column],
    );
    return rows.length > 0;
  }
  async function hasTable(table) {
    const [rows] = await conn.query(
      `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`,
      [db, table],
    );
    return rows.length > 0;
  }
  async function hasIndex(table, index) {
    const [rows] = await conn.query(
      `SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND INDEX_NAME=?`,
      [db, table, index],
    );
    return rows.length > 0;
  }

  if (!(await hasTable('bom_readingplan_program'))) {
    await conn.query(`CREATE TABLE bom_readingplan_program (
    guid        varchar(32)  NOT NULL,
    slug        varchar(128) NOT NULL,
    title       varchar(256) NOT NULL,
    description text         NULL,
    config      json         NOT NULL,
    sort        int          NOT NULL DEFAULT 0,
    active      tinyint(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (guid),
    UNIQUE KEY uq_program_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    console.log('created bom_readingplan_program');
  } else console.log('bom_readingplan_program exists — skip');

  if (!(await hasColumn('bom_readingplan', 'status'))) {
    await conn.query(`ALTER TABLE bom_readingplan ADD COLUMN status ENUM('active','completed','abandoned') NULL DEFAULT NULL`);
    console.log('added bom_readingplan.status');
  } else console.log('status exists — skip');

  if (!(await hasColumn('bom_readingplan', 'config'))) {
    await conn.query(`ALTER TABLE bom_readingplan ADD COLUMN config json NULL`);
    console.log('added bom_readingplan.config');
  } else console.log('config exists — skip');

  if (!(await hasColumn('bom_readingplan', 'enddate'))) {
    await conn.query(`ALTER TABLE bom_readingplan ADD COLUMN enddate date NULL`);
    console.log('added bom_readingplan.enddate');
  } else console.log('enddate exists — skip');

  if (!(await hasIndex('bom_readingplan', 'idx_owner_status'))) {
    await conn.query(`ALTER TABLE bom_readingplan ADD INDEX idx_owner_status (owner, status)`);
    console.log('added idx_owner_status');
  } else console.log('idx_owner_status exists — skip');

  await conn.end();
  console.log('migration complete');
})().catch((err) => { console.error('migration failed:', err.message); process.exit(1); });
