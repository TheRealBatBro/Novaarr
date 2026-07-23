# Remotarr

A self-hosted, NZB360-style web dashboard for your media and download stack. One app,
one Docker container, works from any browser on your phone, tablet, or desktop — no
native app required.

Remotarr talks to the services already running on your network (Sonarr, Radarr,
SABnzbd, qBittorrent, Overseerr, Tautulli, and more) through a small backend proxy, so
it works around browser CORS restrictions and can send Wake-on-LAN packets to boot a
sleeping server before waking up its services.

## Supported services

- **Download clients**: SABnzbd, NZBGet, qBittorrent, Transmission, Deluge
- **_arr suite**: Sonarr, Radarr, Lidarr, Readarr, Bazarr (subtitles)
- **Indexers**: NEWZnab, Jackett, NZBHydra2
- **Other**: Overseerr / Seerr, Tautulli, Tracearr, Trakt, Unraid (deep link)
- **Coming soon**: µTorrent, rTorrent/ruTorrent, Sick Beard, Prowlarr — registered but
  not yet given a full screen; see Settings > Services for what's live today.

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
they live in the `mediaremote-data` volume, not the container image.

## Configuration (`docker-compose.yml`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the app listens on *inside* the container — change the left side of the `ports:` mapping to use a different port on the host. |
| `BASE_PATH` | `""` (root) | Set to a sub-path (e.g. `/remotarr`) if hosting behind a reverse proxy at a non-root path. |
| `DB_PATH` | `/data/mediaremote.db` | Where the SQLite database lives. Leave as-is unless you've customized the volume mount. |
| `SHOW_ALL_SERVICES` | `true` | `true` shows every supported service in the menu regardless of whether it's configured yet (handy while you're still setting things up). Set to `false` once you're done configuring, so the menu only shows services you've actually enabled. |

The included `docker-compose.yml` maps container port `3000` to host port `3210`
(`http://<host>:3210`) and mounts a named volume, `mediaremote-data`, at `/data` for
the SQLite database — this single file holds your sign-in credential and every service
you configure (URLs, API keys, Wake-on-LAN settings, dashboard layout).

### Reverse proxy

If you're putting Remotarr behind Nginx/Traefik/Caddy instead of exposing the port
directly, remove the `ports:` section, attach the container to your proxy's Docker
network, and point your proxy at `mediaremote:3000` (or whatever `BASE_PATH` you set).

## Sign-in: PIN or password

Settings > Security lets you change your sign-in credential at any time, and switch
between a PIN code and a password whenever you like — you're never locked into the
choice made during first-run setup. Changing it takes effect immediately; it doesn't
log out other already-signed-in devices.

## Data & backups

Everything Remotarr needs to remember — your sign-in credential, every configured
service (including API keys and Wake-on-LAN details), and your dashboard layout —
lives in one SQLite file inside the `mediaremote-data` Docker volume. Back up that
volume (or the file at `DB_PATH`) to back up your whole setup.

```bash
# Example: copy the DB out of the named volume for a backup
docker cp mediaremote:/data/mediaremote.db ./mediaremote-backup.db
```

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
