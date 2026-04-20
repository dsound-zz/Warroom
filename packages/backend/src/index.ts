import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { env } from './env.js';
import { logger } from './logger.js';
import { startScheduler } from './scheduler.js';
import { healthRouter } from './routes/health.js';
import { signalsRouter } from './routes/signals.js';
import { companiesRouter } from './routes/companies.js';
import { applicationsRouter } from './routes/applications.js';
import { dnaRouter } from './routes/dna.js';

const app = new Hono();

// Middleware
app.use('*', cors({ origin: ['http://localhost:5173', 'http://localhost:5174'] }));
app.use('*', honoLogger());

// Routes
app.route('/api/health', healthRouter);
app.route('/api/signals', signalsRouter);
app.route('/api/companies', companiesRouter);
app.route('/api/applications', applicationsRouter);
app.route('/api/dna', dnaRouter);

// 404 fallback
app.notFound((c) => c.json({ error: 'Not found' }, 404));

// Error handler
app.onError((err, c) => {
  logger.error({ err }, 'unhandled error');
  return c.json({ error: 'Internal server error' }, 500);
});

// Start
startScheduler();

serve({ fetch: app.fetch, port: env.BACKEND_PORT }, () => {
  logger.info({ port: env.BACKEND_PORT }, 'warroom backend started');
});

export { app };
