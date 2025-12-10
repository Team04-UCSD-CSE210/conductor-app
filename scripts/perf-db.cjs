// Node: CommonJS to avoid ESM quirks on Windows
// Run: node scripts/perf-db.js
require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 2_000,
});

function now() { return process.hrtime.bigint(); }
function ms(s, e){ return Number(e - s) / 1e6; }

(async () => {
  console.log('== DB microbench ==');
  const client = await pool.connect();
  try {
    // ensure table exists
    await client.query('SELECT 1 FROM users LIMIT 1');

    // clean slate for fair timing
    await client.query('TRUNCATE TABLE users RESTART IDENTITY CASCADE;');

    // 1) bulk creates in a single transaction with a prepared statement
    const total = 1000;
    const t0 = now();
    await client.query('BEGIN');
    for (let i = 1; i <= total; i++) {
      const name = `User ${i}`;
      const email = `user${i}@test.com`;
      const role = (i % 3 === 0) ? 'admin' : 'user';
      const status = 'active';
      await client.query(
        `INSERT INTO users (name, email, role, status)
         VALUES ($1, $2::citext, $3::user_role, $4::user_status)
         ON CONFLICT (email) DO NOTHING`,
        [name, email, role, status]
      );
    }
    await client.query('COMMIT');
    const t1 = now();
    console.log(`create ${total}: ${ms(t0,t1).toFixed(1)} ms  (${(ms(t0,t1)/total).toFixed(2)} ms/user)`);

    // pick a known email to fetch
    const probeEmail = 'user500@test.com';
    const { rows: [probe] } = await client.query(
      'SELECT id FROM users WHERE email = $1::citext',
      [probeEmail]
    );

    // 2) paged read
    const r0 = now();
    await client.query(
      `SELECT id,name,email,role,status,created_at
       FROM users
       ORDER BY created_at ASC, email ASC
       LIMIT 50 OFFSET 0`
    );
    const r1 = now();
    console.log(`read page(50): ${ms(r0,r1).toFixed(1)} ms`);

    // 3) filtered read
    const f0 = now();
    const admins = await client.query(
      `SELECT id FROM users WHERE role = 'admin'::user_role LIMIT 100`
    );
    const f1 = now();
    console.log(`filter role=admin (100 cap): ${ms(f0,f1).toFixed(1)} ms (returned ${admins.rowCount})`);

    // 4) lookup by id
    if (probe?.id) {
      const l0 = now();
      await client.query('SELECT id,name,email FROM users WHERE id = $1::uuid', [probe.id]);
      const l1 = now();
      console.log(`lookup by id: ${ms(l0,l1).toFixed(1)} ms`);
    } else {
      console.log('lookup by id: skipped (probe not found)');
    }

    // 5) count
    const c0 = now();
    const { rows: [{ count }] } = await client.query('SELECT COUNT(*)::int AS count FROM users');
    const c1 = now();
    console.log(`count(${count}): ${ms(c0,c1).toFixed(1)} ms`);
  } catch (e) {
    console.error('perf-db error:', e.message);
    try { await client.query('ROLLBACK'); } catch {
      // Ignore rollback errors
    }
  } finally {
    client.release();
    await pool.end();
  }
})();
