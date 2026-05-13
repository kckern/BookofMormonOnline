import { sequelize, SQLQueryTypes } from '../src/config/database';

const TABLE = 'bom_xtras_history';

(async () => {
  try {
    const cols: any[] = await sequelize.query(`SHOW COLUMNS FROM \`${TABLE}\``, {
      type: SQLQueryTypes.SELECT,
    });
    console.log(`\n=== Columns of ${TABLE} ===`);
    for (const c of cols) {
      console.log(
        `${c.Field.padEnd(24)} ${String(c.Type).padEnd(30)} ` +
        `null=${c.Null} key=${c.Key || '-'} default=${c.Default === null ? 'NULL' : c.Default}`
      );
    }

    const idx: any[] = await sequelize.query(`SHOW INDEX FROM \`${TABLE}\``, {
      type: SQLQueryTypes.SELECT,
    });
    console.log(`\n=== Indexes ===`);
    for (const i of idx) {
      console.log(`${(i.Key_name || '').padEnd(24)} col=${i.Column_name} seq=${i.Seq_in_index} unique=${i.Non_unique === 0}`);
    }

    const archives: any[] = await sequelize.query(
      `SELECT archive, COUNT(*) AS n FROM \`${TABLE}\` GROUP BY archive ORDER BY n DESC`,
      { type: SQLQueryTypes.SELECT }
    ).catch((e) => {
      console.log(`\n(no \`archive\` column or query failed: ${e.message})`);
      return [];
    });
    if (archives.length) {
      console.log(`\n=== Distinct archive values ===`);
      for (const a of archives) console.log(`${String(a.archive ?? 'NULL').padEnd(24)} ${a.n}`);
    }

    const principals: any[] = await sequelize.query(
      `SELECT principal, COUNT(*) AS n FROM \`${TABLE}\` WHERE archive = 'witnesses' GROUP BY principal ORDER BY principal`,
      { type: SQLQueryTypes.SELECT }
    ).catch((e) => {
      console.log(`\n(principal query failed: ${e.message})`);
      return [];
    });
    if (principals.length) {
      console.log(`\n=== Witnesses-archive principal slugs ===`);
      for (const p of principals) console.log(`${String(p.principal ?? 'NULL').padEnd(28)} ${p.n}`);
    }

    const sample: any[] = await sequelize.query(
      `SELECT * FROM \`${TABLE}\` WHERE archive = 'witnesses' LIMIT 1`,
      { type: SQLQueryTypes.SELECT }
    ).catch(() => []);
    if (sample.length) {
      console.log(`\n=== Sample witnesses row (truncated) ===`);
      const row = sample[0];
      for (const [k, v] of Object.entries(row)) {
        const sv = v === null ? 'NULL' : String(v);
        console.log(`${k.padEnd(20)} ${sv.length > 120 ? sv.slice(0, 120) + '…' : sv}`);
      }
    }
  } catch (e: any) {
    console.error('ERROR:', e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
