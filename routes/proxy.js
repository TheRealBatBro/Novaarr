const express = require('express');
const { XMLParser } = require('fast-xml-parser');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { buildMethodCall, parseMethodResponse } = require('../rtorrentXmlRpc');

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

// `instance` is optional (some internal calls, like qBittorrent's login step, don't need it) —
// when present, its per-instance custom headers (e.g. a Tailscale/reverse-proxy auth header) are
// merged in ahead of the adapter's own headers, so a real auth header always wins on collision.
async function fetchWithTimeout(url, opts, timeoutMs, instance) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Math.min(timeoutMs || TIMEOUT_DEFAULT, TIMEOUT_MAX));
  try {
    return await fetch(url, {
      ...opts,
      headers: { 'User-Agent': DEFAULT_USER_AGENT, ...(instance?.custom_headers || {}), ...opts.headers },
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
    }, timeoutMs, instance);
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
    }, timeoutMs, instance);
  },

  // Ombi's auth middleware looks for a literal `ApiKey` header — confirmed in its own source
  // (RequestController.cs's GetApiAlias()) — not the X-Api-Key most other services use.
  'ombi-apikey': (instance, { path, method = 'GET', query = {}, body }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, query);
    return fetchWithTimeout(url, {
      method,
      headers: { ApiKey: instance.credentials.apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }, timeoutMs, instance);
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
    }, timeoutMs, instance);
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
    }, timeoutMs, instance);
  },

  // Plex's own REST API — token passed as a query param (also valid as a header; query is
  // simpler here since every adapter already funnels through buildUrl's query merging), and
  // `Accept: application/json` since Plex defaults to XML without it.
  'plex-token': (instance, { path, method = 'GET', query = {}, body }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, { ...query, 'X-Plex-Token': instance.credentials.apiKey });
    return fetchWithTimeout(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }, timeoutMs, instance);
  },

  // Torznab/Newznab manual search — the response is XML, parsed to JSON by the route handler below.
  torznab: (instance, { path = '', method = 'GET', query = {} }, timeoutMs) => {
    const url = buildUrl(instance.local_url, path, { ...query, apikey: instance.credentials.apiKey });
    return fetchWithTimeout(url, { method }, timeoutMs, instance);
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
    }, timeoutMs, instance);
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
    }, timeoutMs, instance);
  },

  // ruTorrent's httprpc plugin (plugins/httprpc/action.php) forwards a genuine XML-RPC POST body
  // straight to the rTorrent daemon over SCGI when it isn't ruTorrent's own private urlencoded UI
  // protocol — confirmed directly in ruTorrent's source (Novik/ruTorrent). ruTorrent has no login
  // system of its own; auth is plain HTTP Basic Auth at the webserver/directory level, same as its
  // documented .htaccess example. The frontend sends `{ method, params }`; "start" is special-cased
  // into 3 sequential rTorrent calls (d.open/d.start/d.resume, mirroring ruTorrent's own UI) since
  // this adapter doesn't implement XML-RPC structs — no other rTorrent call here needs them, so
  // system.multicall batching isn't used.
  'rutorrent-xmlrpc': async (instance, { body }, timeoutMs) => {
    const { username, password } = instance.credentials || {};
    const authHeader = { Authorization: 'Basic ' + Buffer.from(`${username || ''}:${password || ''}`).toString('base64') };
    const url = buildUrl(instance.local_url, 'plugins/httprpc/action.php', {});

    async function call(methodName, params) {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { ...authHeader, 'Content-Type': 'text/xml' },
        body: buildMethodCall(methodName, params),
      }, timeoutMs, instance);
      const text = await res.text();
      if (!res.ok) return { ok: false, status: res.status, value: null, faultMessage: null };
      const parsed = parseMethodResponse(text);
      return { ok: !parsed.fault, status: res.status, value: parsed.value, faultMessage: parsed.fault?.message };
    }

    const { method, params = [] } = body || {};
    let result;
    if (method === '__start__') {
      const [hash] = params;
      for (const m of ['d.open', 'd.start', 'd.resume']) {
        result = await call(m, [hash]);
        if (!result.ok) break;
      }
    } else {
      result = await call(method, params);
    }

    return {
      ok: result.ok,
      status: result.status,
      text: async () => JSON.stringify(result.ok ? result.value : { error: result.faultMessage || 'Request failed' }),
    };
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
    }, timeoutMs, instance);

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
      }, timeoutMs, instance);
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
      }, timeoutMs, instance);
    }

    let cookie = instance.session_token || (await login());
    let res = await call(cookie);
    if (res.status === 403) {
      cookie = await login();
      res = await call(cookie);
    }
    return res;
  },

  // µTorrent's classic WebUI: GET /gui/token.html (Basic Auth) returns an HTML snippet with a
  // token that must ride along as `?token=` on every /gui/ call afterward. A stale/invalid token
  // comes back as an unusual HTTP 300 with body "invalid request" (the doc author's own wording,
  // github.com/bittorrent/webui/wiki/TokenSystem) rather than a normal 401/403 — treated here as
  // the refresh signal, one retry, same shape as qBittorrent's 403-triggers-relogin above. Some
  // builds also set a GUID cookie alongside the token; it isn't part of the documented contract,
  // but is captured and replayed defensively since at least one real build appears to expect it
  // back. Cached token+cookie are packed as JSON into the existing session_token column. No
  // request-body support here — the WebUI API is pure query-params (add-url/pause/etc.); the one
  // action that needs a real multipart body (add-file, uploading a .torrent) isn't wired up.
  'utorrent-token': async (instance, { path = '/gui/', method = 'GET', query = {} }, timeoutMs) => {
    const { username, password } = instance.credentials || {};
    const authHeader = { Authorization: 'Basic ' + Buffer.from(`${username || ''}:${password || ''}`).toString('base64') };

    async function fetchToken() {
      const url = buildUrl(instance.local_url, '/gui/token.html', {});
      const res = await fetchWithTimeout(url, { method: 'GET', headers: authHeader }, timeoutMs, instance);
      const text = await res.text();
      const match = text.match(/id=['"]token['"][^>]*>([^<]+)</);
      const token = match ? match[1] : null;
      const cookie = extractSetCookie(res);
      if (token) db.setServiceSessionToken(instance.id, JSON.stringify({ token, cookie }));
      return { token, cookie };
    }

    function call(token, cookie) {
      const url = buildUrl(instance.local_url, path, { ...query, token: token || '' });
      return fetchWithTimeout(url, { method, headers: { ...authHeader, ...cookieHeader(cookie) } }, timeoutMs, instance);
    }

    let cached = null;
    try { cached = instance.session_token ? JSON.parse(instance.session_token) : null; } catch { cached = null; }
    let { token, cookie } = cached || (await fetchToken());
    let res = await call(token, cookie);
    if (res.status === 300 || res.status === 401) {
      ({ token, cookie } = await fetchToken());
      res = await call(token, cookie);
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
      }, timeoutMs, instance);
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
    // Torznab/Newznab services are usually pure XML feeds, but NZBHydra2 also exposes JSON REST
    // endpoints (e.g. /api/stats/indexers) under that same instance/auth type — sniff the real
    // response instead of assuming XML, so both shapes work through the one configured instance.
    if (instance.auth_type === 'torznab' && !(upstream.headers.get('content-type') || '').includes('json')) {
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
