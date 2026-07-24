# Remotarr

A self-hosted, all-in-one web dashboard for your media and download stack. One app,
one Docker container, works from any browser on your phone, tablet, or desktop — no
native app required.

Remotarr talks to the services already running on your network (Sonarr, Radarr,
SABnzbd, Overseerr, Tautulli, and more) through a small backend proxy, so it works
around browser CORS restrictions and can send Wake-on-LAN packets to boot a sleeping
server before waking up its services.

**Remotarr can be the only thing you expose to the internet.** Every request to a
configured service — Sonarr, Radarr, SABnzbd, whatever you've added — is relayed
server-side through that same proxy; your browser never talks to those services
directly, and they never need a port of their own opened up. Put Remotarr behind your
reverse proxy or VPN and everything else can stay bound to your local network only.

## Supported services

- **Download clients**: SABnzbd
- **_arr suite**: Sonarr, Radarr, Bazarr (subtitles)
- **Indexers**: Prowlarr
- **Other**: Overseerr / Seerr, Tautulli, Tracearr, Trakt
- **Coming soon**: NZBGet, Deluge, Transmission, µTorrent, qBittorrent,
  rTorrent/ruTorrent, Lidarr, Readarr, Sick Beard, NEWZnab, Jackett, NZBHydra2, Unraid —
  see Settings > Services for what's live today.

Every service is optional. Add only what you run — anything left unconfigured is
simply hidden from the menu.

## Quick start

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

1. Clone or copy this repository onto the machine (server, NAS, etc.) where you want
   Remotarr to run.
2. From the project root:

   ```bash
   docker compose up --build -d
   ```

3. Open `http://<that machine's IP>:3210` in a browser.
4. On first load you'll be asked to choose how to lock the app — a **PIN code** (4-8
   digits) or a **password** — and set it. This is a convenience lock for the
   dashboard itself, not a security boundary; anyone with access to the underlying
   services could bypass it, same as the services themselves usually have no auth
   guarding your home network.
5. Go to **Settings > Services** and add the services you actually run: give each one
   its local URL (and API key/credentials, where required) and it'll appear in the
   menu.

That's it — configuration lives in a small SQLite database inside the container
(persisted via a Docker volume), so it survives restarts and rebuilds.

## Updating

Pull the latest code, then rebuild and redeploy:

```bash
docker compose up --build -d
```

Your services, dashboard layout, and sign-in credential all persist across rebuilds —
they live in the `remotarr-data` volume, not the container image.

## Configuration (`docker-compose.yml`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the app listens on *inside* the container — change the left side of the `ports:` mapping to use a different port on the host. |
| `BASE_PATH` | `""` (root) | Set to a sub-path (e.g. `/remotarr`) if hosting behind a reverse proxy at a non-root path — see [Running behind a reverse proxy](#running-behind-a-reverse-proxy). |
| `DB_PATH` | `/data/remotarr.db` | Where the SQLite database lives. Leave as-is unless you've customized the volume mount. |
| `SHOW_ALL_SERVICES` | `true` | `true` shows every supported service in the menu regardless of whether it's configured yet (handy while you're still setting things up). Set to `false` once you're done configuring, so the menu only shows services you've actually enabled. |

The included `docker-compose.yml` maps container port `3000` to host port `3210`
(`http://<host>:3210`) and mounts a named volume, `remotarr-data`, at `/data` for
the SQLite database — this single file holds your sign-in credential and every service
you configure (URLs, API keys, Wake-on-LAN settings, dashboard layout).

## Running behind a reverse proxy

Remotarr works behind Nginx, Caddy, or Traefik out of the box — no separate "proxy
mode" to turn on. There are two ways to expose it; pick whichever fits how you already
organize your other self-hosted apps.

**Option A — a dedicated subdomain (recommended).** Point `remotarr.yourdomain.com` at
the container with no path prefix. This is the simpler setup and matches how most
self-hosted dashboards (Sonarr, Radarr, Overseerr, etc.) are usually run. `BASE_PATH`
stays empty.

**Option B — a sub-path on an existing domain.** Mount Remotarr at
`https://yourdomain.com/remotarr/` alongside other apps on the same host. Set
`BASE_PATH=/remotarr` (matching whatever path segment you choose) — the app adjusts
every asset path, API call, and service-worker registration to that prefix
automatically.

Either way, first stop publishing the port directly — remove the `ports:` section from
`docker-compose.yml` and put the container on the same Docker network as your proxy so
it can reach `remotarr:3000` by container name:

```yaml
services:
  remotarr:
    build: .
    container_name: remotarr
    restart: unless-stopped
    # ports: section removed — the proxy reaches this container directly
    volumes:
      - remotarr-data:/data
    environment:
      NODE_ENV: production
      PORT: 3000
      BASE_PATH: "" # or "/remotarr" for Option B
      DB_PATH: /data/remotarr.db
      SHOW_ALL_SERVICES: "false"
    networks:
      - proxy

volumes:
  remotarr-data:

networks:
  proxy:
    external: true
```

Whatever proxy you use, it must forward two headers so Remotarr can tell it's being
accessed over HTTPS (this determines whether the sign-in cookie gets the `Secure`
flag) and pass along the real client IP:

- `X-Forwarded-Proto` — set to `https` when the proxy terminates TLS
- `X-Forwarded-For` — the original client IP

The app already trusts exactly one upstream hop (`app.set('trust proxy', 1)` in
`server.js`), which is correct as long as Remotarr's proxy is the *only* layer in
front of it. If you're chaining proxies (e.g. Cloudflare in front of your own Nginx),
only the outermost hop's TLS termination matters for the `Secure` cookie — the chain
just needs to forward the headers through unmodified.

### Nginx

```nginx
# Option A — subdomain
server {
    listen 443 ssl;
    server_name remotarr.yourdomain.com;

    location / {
        proxy_pass http://remotarr:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Option B — sub-path (BASE_PATH=/remotarr)
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location /remotarr/ {
        proxy_pass http://remotarr:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Caddy

Caddy sets the forwarded headers automatically — this is the entire config either way:

```caddy
# Option A — subdomain
remotarr.yourdomain.com {
    reverse_proxy remotarr:3000
}

# Option B — sub-path (BASE_PATH=/remotarr)
yourdomain.com {
    handle_path /remotarr/* {
        reverse_proxy remotarr:3000
    }
}
```

### Traefik (Docker labels)

```yaml
services:
  remotarr:
    # ...same as above...
    labels:
      traefik.enable: "true"
      # Option A — subdomain
      traefik.http.routers.remotarr.rule: Host(`remotarr.yourdomain.com`)
      traefik.http.routers.remotarr.tls.certresolver: letsencrypt
      traefik.http.services.remotarr.loadbalancer.server.port: "3000"

      # Option B — sub-path (BASE_PATH=/remotarr) — replace the router rule above with:
      # traefik.http.routers.remotarr.rule: Host(`yourdomain.com`) && PathPrefix(`/remotarr`)
```

Traefik forwards `X-Forwarded-Proto`/`X-Forwarded-For` by default, no extra config
needed.

### Security headers (optional)

Remotarr already sends its own security headers (HSTS, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, and a `Content-Security-Policy` tuned to what it
actually loads) — you don't need to configure anything at the proxy for Remotarr
itself. If you'd like the first four set at the Traefik layer too (handy if you're
running other services behind the same Traefik instance that don't set their own),
add a `headers` middleware:

```yaml
labels:
  # ...same router/service labels as above...
  traefik.http.routers.remotarr.middlewares: remotarr-headers

  traefik.http.middlewares.remotarr-headers.headers.stsSeconds: "15552000"
  traefik.http.middlewares.remotarr-headers.headers.stsIncludeSubdomains: "true"
  traefik.http.middlewares.remotarr-headers.headers.forceSTSHeader: "true"
  traefik.http.middlewares.remotarr-headers.headers.contentTypeNosniff: "true"
  traefik.http.middlewares.remotarr-headers.headers.customFrameOptionsValue: "DENY"
  traefik.http.middlewares.remotarr-headers.headers.referrerPolicy: "no-referrer"
```

Don't also set `contentSecurityPolicy` here. The app's own CSP is specifically tuned
(a per-request nonce for its one inline script, an allowance for the unpredictable
Sonarr/Radarr/Bazarr art hosts, the YouTube trailer frame, etc.) — a second, more
generic CSP from Traefik on top would have browsers enforce the *intersection* of
both policies, and the stricter parts of a generic policy would likely block things
the app's own policy correctly allows, breaking posters or the trailer modal.

## Sign-in: PIN or password

Settings > Security lets you change your sign-in credential at any time, and switch
between a PIN code and a password whenever you like — you're never locked into the
choice made during first-run setup. Changing it takes effect immediately; it doesn't
log out other already-signed-in devices.

## Data & backups

Everything Remotarr needs to remember — your sign-in credential, every configured
service (including API keys and Wake-on-LAN details), and your dashboard layout —
lives in one SQLite file inside the `remotarr-data` Docker volume. Back up that
volume (or the file at `DB_PATH`) to back up your whole setup.

```bash
# Example: copy the DB out of the named volume for a backup
docker cp remotarr:/data/remotarr.db ./remotarr-backup.db
```

## Feature requests & support

Both are handled through GitHub Issues on this repo:

- **Feature request**: [open one here](https://github.com/TheRealBatBro/Remotarr/issues/new?labels=enhancement&title=Feature%20request%3A%20)
- **Something broken or need help?**: [open a support issue here](https://github.com/TheRealBatBro/Remotarr/issues/new?labels=question&title=Support%3A%20)

Both links are also available from inside the app under **Settings > About**, which
also lists what's changed in each version.

## Tech stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Router/Query,
  Framer Motion
- **Backend**: Express, better-sqlite3, JWT-based session cookie
- **Single container**: the frontend is built to static files and served by the same
  Express process that runs the API — nothing else to deploy or coordinate.

## Development

The project is built and run as a single Docker image; that's the supported way to run
it. If you want to hack on the frontend with hot reload instead:

```bash
cd web
npm install
npm run dev
```

This starts a Vite dev server that proxies API calls to a Remotarr backend — run the
backend separately (`npm start` from the project root, after `npm install`) alongside
it.

## Publishing to Docker Hub

To push an update to `therealbatbro/remotarr`, build and push with Buildx directly
rather than `docker compose up --build` + `docker push`:

```bash
docker buildx build --provenance=false --sbom=false -t therealbatbro/remotarr:latest --push .
```

`--provenance=false --sbom=false` matters: without it, Buildx attaches a build
attestation as an extra entry in the pushed manifest list, tagged
`platform: unknown/unknown`. Many Docker clients — older Docker Engine versions, and
NAS/Docker-UI tools like Unraid, Synology, Portainer, and Watchtower — can't resolve a
manifest out of that shape and fail to pull with `manifest unknown`, even though the
tag exists and pulls fine with a fully up-to-date Docker CLI. Building with those two
flags produces a plain single-manifest image compatible with everything.
