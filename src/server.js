import express from 'express';
import cors from 'cors';
import { assertDb } from './db.js';
import userRoutes from './routes/user-routes.js';
import roleRoutes from './routes/role-routes.js';
import courseRoutes from './routes/course-routes.js';
import { performanceCheck } from './middleware/auth-middleware.js';

async function main() {
  console.log('[server] booting…');

  // 1) DB ping (will throw if DATABASE_URL is wrong)
  await assertDb();

  // 2) Express app
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(performanceCheck);

  // Health check
  app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  // API routes
  app.use('/api/users', userRoutes);
  app.use('/api/roles', roleRoutes);
  app.use('/api/courses', courseRoutes);

  // Serve static files for role management UI
  app.use('/role-manager', express.static('src/components'));

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
    console.log(`[server] role manager UI: http://localhost:${port}/role-manager/role-manager.html`);
  });
}

main().catch((err) => {
  console.error('[server] fatal:', err);
  process.exit(1);
});

