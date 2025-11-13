import express from 'express';
import { assertDb } from './db.js';
import userRoutes from './routes/user-routes.js';
import enrollmentRoutes from './routes/enrollment-routes.js';
import { skipAuthForPublic } from './middleware/auth-middleware.js';

async function main() {
  console.log('[server] booting…');

  // 1) DB ping (will throw if DATABASE_URL is wrong)
  await assertDb();

  // 2) Express app
  const app = express();
  app.use(express.json());

  // 3) Authentication middleware (with public path exceptions)
  app.use(skipAuthForPublic);

  // Health check endpoint
  app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
  
  // API routes
  app.use('/users', userRoutes);
  app.use('/enrollments', enrollmentRoutes);

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error('[server] fatal:', err);
  process.exit(1);
});

