const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db');
const { version } = require('./package.json');
const authRouter = require('./routes/auth');
const backupRouter = require('./routes/backup');
const servicesRouter = require('./routes/services');
const proxyRouter = require('./routes/proxy');
const dashboardRouter = require('./routes/dashboard');
const sabnzbdRouter = require('./routes/sabnzbd');
const torrentUploadRouter = require('./routes/torrentUpload');
const tautulliRouter = require('./routes/tautulli');
const tracearrRouter = require('./routes/tracearr');
const plexRouter = require('./routes/plex');
const embyfinRouter = require('./routes/embyfin');
const usersRouter = require('./routes/users');
const accessRolesRouter = require('./routes/accessRoles');
const cloudflareTunnelRouter = require('./routes/cloudflareTunnel');

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Normalise BASE_PATH: strip trailing slash, ensure leading slash or empty string.
const RAW_BASE = (process.env.BASE_PATH || '').replace(/\/$/, '');
const BASE = RAW_BASE.startsWith('/') || RAW_BASE === '' ? RAW_BASE : '/' + RAW_BASE;

// Docker is this app's only real "environment" for most users — there's no separate dev
// server most people run — so "show every service regardless of enabled" is a runtime
// flag, not a Vite build-time DEV check, so it actually works from a normal deployment.
const SHOW_ALL_SERVICES = process.env.SHOW_ALL_SERVICES === 'true';

// Separate from SHOW_ALL_SERVICES on purpose — see middleware/auth.js's DEV_BYPASS comment.
// Unset/false by default; only for local `vite dev`/backend hacking.
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

app.set('trust proxy', 1);

// A few high-value headers by hand rather than pulling in helmet — helmet's default CSP would
// need every proxied service's asset origins allowlisted to avoid breaking things, which isn't
// worth the fragility here.
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Plain-text, unconditional — registered ahead of the SPA catch-all below so these two don't
// fall through to it and get served the app shell as their "content" (that's what happened
// before: a scanner requesting /robots.txt got Cloudflare's injected bot rules followed by raw
// index.html markup, since nothing more specific matched first).
// Remotarr is a private, login-gated dashboard, not public content — there's no upside to
// being indexed and a small downside (search results surfacing that the URL exists at all).
app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});
app.get('/.well-known/security.txt', (req, res) => {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const canonical = `${req.protocol}://${req.get('host')}/.well-known/security.txt`;
  res.type('text/plain').send(
    [
      'Contact: https://github.com/TheRealBatBro/Remotarr/issues/new?labels=security',
      `Expires: ${expires}`,
      'Preferred-Languages: en',
      `Canonical: ${canonical}`,
    ].join('\n') + '\n',
  );
});

const PUBLIC = path.join(__dirname, 'public');
app.use(BASE + '/', express.static(PUBLIC, { index: false }));

app.use(BASE + '/api/auth', authRouter);
app.use(BASE + '/api/backup', backupRouter);
app.use(BASE + '/api/services', servicesRouter);
app.use(BASE + '/api/proxy', proxyRouter);
app.use(BASE + '/api/dashboard', dashboardRouter);
app.use(BASE + '/api/sabnzbd', sabnzbdRouter);
app.use(BASE + '/api/torrent-upload', torrentUploadRouter);
app.use(BASE + '/api/tautulli', tautulliRouter);
app.use(BASE + '/api/tracearr', tracearrRouter);
app.use(BASE + '/api/plex', plexRouter);
app.use(BASE + '/api/embyfin', embyfinRouter);
app.use(BASE + '/api/users', usersRouter);
app.use(BASE + '/api/access-roles', accessRolesRouter);
app.use(BASE + '/api/cloudflare-tunnel', cloudflareTunnelRouter);
app.get(BASE + '/api/health', (_req, res) => res.json({ ok: true }));

// SPA fallback: serve index.html with __BASE__/__SHOW_ALL_SERVICES__ injected. The raw file read
// is cached (cheap, doesn't vary per-request), but the actual response is re-rendered every time
// so each page load gets its own CSP nonce — a nonce baked into a cached response would be the
// same value forever, which an attacker could just read from the page source, defeating the
// point of it.
let cachedRaw = null;
function serveIndex(_req, res) {
  if (!cachedRaw || process.env.NODE_ENV !== 'production') {
    cachedRaw = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  }
  const nonce = crypto.randomBytes(16).toString('base64');
  const html = cachedRaw
    .replace(/__BASE__/g, BASE)
    .replace(/__BASE_HREF__/g, (BASE || '') + '/')
    .replace(/__VERSION__/g, version)
    .replace(/__SHOW_ALL_SERVICES_VALUE__/g, String(SHOW_ALL_SERVICES))
    .replace(/__DISABLE_AUTH_VALUE__/g, String(DISABLE_AUTH))
    .replace('<script>', `<script nonce="${nonce}">`);

  // img-src stays broad (any HTTPS host, plus same-origin/data URIs) rather than an allowlist —
  // Sonarr/Radarr/Bazarr art comes from whatever metadata provider each one is configured with
  // (TheTVDB, Fanart, etc.), which isn't fixed or predictable, unlike TMDB/YouTube which are
  // hardcoded in this app's own source and can be pinned exactly.
  res.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' https: data:",
      "connect-src 'self'",
      'frame-src https://www.youtube-nocookie.com',
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  res.type('html').send(html);
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
