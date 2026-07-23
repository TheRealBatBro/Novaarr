const express = require('express');
const { XMLParser } = require('fast-xml-parser');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'item',
});

const TIMEOUT_DEFAULT = 10_000;
const TIMEOUT_MAX = 30_000;

function buildUrl(base, reqPath, query) {
  const normalizedBase = base.endsWith('/') ? base : base + '/';
  const url = new URL(reqPath.replace(/^\//, ''), normalizedBase);
  // Build the query string with encodeURIComponent (spaces -> %20) instead of URLSearchParams
  // (spaces -> +) — some upstream APIs (e.g. Overseerr's OpenAPI validator) reject a literal
  // '+' as an unencoded reserved character in the raw query string.
  if (query) {
    const parts = Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    url.search = parts.length ? `?${parts.join('&')}` : '';
  }
  return url;
}

// Node's fetch (undici) sends no User-Agent by default, which Cloudflare's bot-management WAF
// treats as a strong bot signal and hard-blocks with a 403 "Sorry, you have been blocked" page —
// seen live against Trakt's API, before its own app logic ever runs. A normal browser UA is
// enough to pass that check for any Cloudflare-fronted upstream (Trakt, Overseerr, etc.);
// per-adapter headers still win if an adapter ever needs to set its own.
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.min(timeoutMs || TIMEOUT_DEFAULT, TIMEOUT_MAX));
  try {
    return await fetch(url, {
      ...opts,
      headers: { 'User-Agent': DEFAULT_USER_AGENT, ...opts.headers },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

function extractSetCookie(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    const cookies = res.headers.getSetCookie();
    return cookies.length ? cookies.map((c) => c.split(';')[0]).join('; ') : null;
  }
  const raw = res.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : null;
}

function cookieHeader(cookie) {
  return cookie ? { Cookie: cookie } : {};
}

// Each adapter takes (instance, { path, method, query, body }, timeoutMs) and returns a fetch Response.
const adapters = {
  'apikey-query': (instance, { path, method = 'GET', query = {}, body }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, { ...query, apikey: instance.credentials.apiKey });
    return fetchWithTimeout(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }, timeoutMs);
  },
  'apikey-header': (instance, { path, method = 'GET', query = {}, body }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, query);
    return fetchWithTimeout(url, {
      method,
      headers: {
        'X-Api-Key': instance.credentials.apiKey,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }, timeoutMs);
  },

  // Bearer-token APIs (e.g. Tracearr's public API key) — confirmed live: its endpoints reject
  // X-Api-Key with "Missing or invalid Authorization header" and expect `Authorization: Bearer`.
  'bearer-token': (instance, { path, method = 'GET', query = {}, body }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, query);
    return fetchWithTimeout(url, {
      method,
      headers: {
        Authorization: `Bearer ${instance.credentials.apiKey}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }, timeoutMs);
  },

  // Trakt's public discovery lists (trending/anticipated) just need a Client ID, not full OAuth.
  trakt: (instance, { path, method = 'GET', query = {}, body }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, query);
    return fetchWithTimeout(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': instance.credentials.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    }, timeoutMs);
  },

  // Torznab/Newznab manual search — the response is XML, parsed to JSON by the route handler below.
  torznab: (instance, { path = '', method = 'GET', query = {} }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, { ...query, apikey: instance.credentials.apiKey });
    return fetchWithTimeout(url, { method }, timeoutMs);
  },

  // NZBGet's Basic-Auth JSON-RPC, classic µTorrent WebUI, and ruTorrent's action.php all sit
  // behind plain HTTP Basic Auth — the frontend builds whatever path/method/body each needs.
  'basic-auth': (instance, { path, method = 'GET', query = {}, body }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, query);
    const { username, password } = instance.credentials || {};
    return fetchWithTimeout(url, {
      method,
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${username || ''}:${password || ''}`).toString('base64'),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }, timeoutMs);
  },

  // Sick Beard's legacy API embeds the key as a URL path segment rather than a header/query param.
  'apikey-url-segment': (instance, { path = '', method = 'GET', query = {}, body }, timeoutMs) => {
    const base = instance.local_url.endsWith('/') ? instance.local_url : instance.local_url + '/';
    const url = new URL(`api/${instance.credentials.apiKey}/${path.replace(/^\//, '')}`, base);
    Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
    return fetchWithTimeout(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }, timeoutMs);
  },

  // Transmission requires X-Transmission-Session-Id; the first call typically 409s with the id
  // in the response header. Cheap enough to redo on every proxy call — no token needs to persist.
  'transmission-rpc': async (instance, { path = '/transmission/rpc', method = 'POST', query, body }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, query);
    const { username, password } = instance.credentials || {};
    const authHeader = username ? { Authorization: 'Basic ' + Buffer.from(`${username}:${password || ''}`).toString('base64') } : {};

    const doRequest = (sessionId) => fetchWithTimeout(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...(sessionId ? { 'X-Transmission-Session-Id': sessionId } : {}),
      },
      body: JSON.stringify(body ?? {}),
    }, timeoutMs);

    let res = await doRequest();
    if (res.status === 409) {
      res = await doRequest(res.headers.get('x-transmission-session-id'));
    }
    return res;
  },

  // qBittorrent: POST /api/v2/auth/login -> Set-Cookie SID, reused on later calls. The SID is
  // cached on the DB row (not round-tripped through the browser) and refreshed on a 403.
  'qbittorrent-session': async (instance, { path, method = 'GET', query = {}, body }, timeoutMs) => {
    const { username, password } = instance.credentials || {};

    async function login() {
      const loginUrl = buildUrl(instance.local_url, '/api/v2/auth/login', {});
      const res = await fetchWithTimeout(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: username || '', password: password || '' }).toString(),
      }, timeoutMs);
      const cookie = extractSetCookie(res);
      if (cookie) db.setServiceSessionToken(instance.id, cookie);
      return cookie;
    }

    function call(cookie) {
      // qBittorrent's mutation endpoints (pause/resume/delete/...) expect form-encoded bodies, not JSON.
      const url = buildUrl(instance.local_url, path, query);
      return fetchWithTimeout(url, {
        method,
        headers: { ...cookieHeader(cookie), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: body ? new URLSearchParams(body).toString() : undefined,
      }, timeoutMs);
    }

    let cookie = instance.session_token || (await login());
    let res = await call(cookie);
    if (res.status === 403) {
      cookie = await login();
      res = await call(cookie);
    }
    return res;
  },

  // Deluge's JSON-RPC at /json: auth.login -> session cookie, same caching approach as qBittorrent.
  // The web.connect daemon-attach step is best-effort and unverified against a live instance.
  'deluge-jsonrpc': async (instance, { path = '/json', body }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, {});
    const { password } = instance.credentials || {};
    let idCounter = 1;

    async function rpcCall(method, params, cookie) {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...cookieHeader(cookie) },
        body: JSON.stringify({ method, params, id: idCounter++ }),
      }, timeoutMs);
      return { res, cookie: extractSetCookie(res) || cookie };
    }

    async function login() {
      const { cookie } = await rpcCall('auth.login', [password || '']);
      if (cookie) db.setServiceSessionToken(instance.id, cookie);
      try {
        const { res: connectedRes, cookie: c2 } = await rpcCall('web.connected', [], cookie);
        const connected = await connectedRes.clone().json().catch(() => null);
        if (connected && connected.result === false) await rpcCall('web.connect', [], c2);
      } catch { /* best-effort daemon connect, ignore failures */ }
      return cookie;
    }

    let cookie = instance.session_token || (await login());
    let { res, cookie: newCookie } = await rpcCall(body?.method, body?.params ?? [], cookie);
    if (newCookie && newCookie !== cookie) db.setServiceSessionToken(instance.id, newCookie);

    const parsed = await res.clone().json().catch(() => null);
    if (parsed?.error && /not authenticated/i.test(parsed.error.message || '')) {
      cookie = await login();
      ({ res } = await rpcCall(body?.method, body?.params ?? [], cookie));
    }
    return res;
  },
};

function isBlockedTarget(urlStr) {
  try {
    const u = new URL(urlStr);
    if (u.hostname === '169.254.169.254') return true;
    const ownPort = String(process.env.PORT || '3000');
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(u.hostname) && (u.port || '80') === ownPort) return true;
    return false;
  } catch {
    return true;
  }
}

router.post('/:instanceId', async (req, res) => {
  const instance = db.getServiceInstance(req.params.instanceId);
  if (!instance) return res.status(404).json({ ok: false, error: 'Service instance not found' });

  const adapter = adapters[instance.auth_type];
  if (!adapter) return res.status(501).json({ ok: false, error: `Auth type "${instance.auth_type}" not yet supported` });

  const primary = instance.preferred_mode === 'remote' && instance.remote_url ? instance.remote_url : instance.local_url;
  if (!primary) return res.status(400).json({ ok: false, error: 'No URL configured for this service' });

  // Auto mode: only fall back to remote on a genuine connection failure (unreachable/timeout/blocked),
  // never on an HTTP-level error response — a bad API key shouldn't get silently retried elsewhere.
  const fallbackUrl =
    instance.preferred_mode === 'auto' && instance.remote_url && instance.remote_url !== instance.local_url
      ? instance.remote_url
      : null;

  const { path = '/', method, query, body, timeoutMs } = req.body || {};

  async function attempt(baseUrl) {
    if (isBlockedTarget(baseUrl)) throw new Error('Target not allowed');
    const upstream = await adapter({ ...instance, local_url: baseUrl }, { path, method, query, body }, timeoutMs);
    const text = await upstream.text();
    let data;
    if (instance.auth_type === 'torznab') {
      try { data = xmlParser.parse(text); } catch { data = text; }
    } else {
      try { data = JSON.parse(text); } catch { data = text; }
    }
    return { ok: upstream.ok, status: upstream.status, data };
  }

  function errorResponse(e) {
    const timedOut = e.name === 'AbortError';
    return { ok: false, status: 0, error: timedOut ? 'Request timed out' : e.message };
  }

  try {
    res.json(await attempt(primary));
  } catch (e) {
    if (!fallbackUrl) return res.json(errorResponse(e));
    try {
      res.json(await attempt(fallbackUrl));
    } catch (e2) {
      res.json(errorResponse(e2));
    }
  }
});

module.exports = router;
module.exports.isBlockedTarget = isBlockedTarget;
