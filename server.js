const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db');
const { version } = require('./package.json');
const authRouter = require('./routes/auth');
const servicesRouter = require('./routes/services');
const proxyRouter = require('./routes/proxy');
const wolRouter = require('./routes/wol');
const dashboardRouter = require('./routes/dashboard');
const sabnzbdRouter = require('./routes/sabnzbd');
const tautulliRouter = require('./routes/tautulli');
const tracearrRouter = require('./routes/tracearr');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Normalise BASE_PATH: strip trailing slash, ensure leading slash or empty string.
const RAW_BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const BASE = RAW_BASE.startsWith('/') || RAW_BASE === '' ? RAW_BASE : '/' + RAW_BASE;

// Docker is this app's only real "environment" for most users — there's no separate dev
// server most people run — so "show every service regardless of enabled" is a runtime
// flag, not a Vite build-time DEV check, so it actually works from a normal deployment.
const SHOW_ALL_SERVICES = process.env.SHOW_ALL_SERVICES === 'true';

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

const PUBLIC = path.join(__dirname, 'public');
app.use(BASE + '/', express.static(PUBLIC, { index: false }));

app.use(BASE + '/api/auth', authRouter);
app.use(BASE + '/api/services', servicesRouter);
app.use(BASE + '/api/proxy', proxyRouter);
app.use(BASE + '/api/wol', wolRouter);
app.use(BASE + '/api/dashboard', dashboardRouter);
app.use(BASE + '/api/sabnzbd', sabnzbdRouter);
app.use(BASE + '/api/tautulli', tautulliRouter);
app.use(BASE + '/api/tracearr', tracearrRouter);
app.get(BASE + '/api/health', (_req, res) => res.json({ ok: true }));

// SPA fallback: serve index.html with __BASE__/__SHOW_ALL_SERVICES__ injected
let cachedHtml = null;
function serveIndex(_req, res) {
  if (!cachedHtml || process.env.NODE_ENV !== 'production') {
    const raw = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
    cachedHtml = raw
      .replace(/__BASE__/g, BASE)
      .replace(/__VERSION__/g, version)
      .replace(/__SHOW_ALL_SERVICES_VALUE__/g, String(SHOW_ALL_SERVICES));
  }
  res.type('html').send(cachedHtml);
}

app.get(BASE === '' ? '/' : BASE, serveIndex);
app.get(BASE + '/*', serveIndex);

if (BASE !== '') {
  app.get('/', (_req, res) => res.redirect(301, BASE + '/'));
}

initDb();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Remotarr listening on port ${PORT} (base path: "${BASE || '/'}")`);
});
