import express from 'express';
import { assertDb } from './db.js';
import userRoutes from './routes/user-routes.js';

async function main() {
  console.log('[server] booting…');

  // 1) DB ping (will throw if DATABASE_URL is wrong)
  await assertDb();

  // 2) Express app
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
  app.use('/users', userRoutes);

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error('[server] fatal:', err);
  process.exit(1);
});

