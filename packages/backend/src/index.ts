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
import { doNotApplyRouter } from './routes/doNotApply.js';

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
app.route('/api/do-not-apply', doNotApplyRouter);

const BOOKMARKLET = `javascript:(function(){var domain=window.location.hostname.replace(/^www\\./,'');var reason=prompt('DNA reason?','other');if(!reason)return;fetch('http://localhost:8000/api/do-not-apply/quick-add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:domain,reasonCategory:reason})}).then(function(r){return r.json();}).then(function(d){alert(d.error||'Added '+domain+' to Do Not Apply');}).catch(function(){alert('Failed to add');});})();`;

app.get('/api/bookmarklet', (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Do Not Apply Bookmarklet</title>
<style>body{font-family:system-ui,sans-serif;max-width:600px;margin:60px auto;padding:0 20px;background:#0f0f0f;color:#e8e8e8}h1{font-size:1.5rem;margin-bottom:8px}p{color:#888;margin-bottom:24px}.bookmarklet{display:inline-block;padding:10px 20px;background:#c94545;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:1rem;cursor:grab}.bookmarklet:hover{background:#a83535}ol{color:#888;line-height:2}</style>
</head>
<body>
<h1>Do Not Apply Bookmarklet</h1>
<p>Drag this link to your bookmarks bar. Click it on any company website to add the domain to your Do Not Apply list.</p>
<a class="bookmarklet" href="${BOOKMARKLET}">&#x1F6AB; Add to DNA</a>
<ol>
<li>Drag the button above to your bookmarks bar</li>
<li>Navigate to any company's website</li>
<li>Click the bookmark — enter a reason when prompted</li>
<li>The domain is added to your Do Not Apply list</li>
</ol>
</body>
</html>`;
  return c.html(html);
});

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
