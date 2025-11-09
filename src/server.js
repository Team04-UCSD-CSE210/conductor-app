import express from 'express';
import { assertDb } from './db.js';
import userRoutes from './routes/user-routes.js';
import courseStaffRoutes from './routes/course-staff-routes.js';

async function main() {
  console.log('[server] booting…');

  // 1) DB ping (will throw if DATABASE_URL is wrong)
  await assertDb();

  // 2) Express app
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
  
  // API routes
  app.use('/users', userRoutes);
  app.use('/courses', courseStaffRoutes);

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error('[server] fatal:', err);
  process.exit(1);
});

