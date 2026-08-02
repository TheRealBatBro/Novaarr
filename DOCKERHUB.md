![Novaarr logo](https://raw.githubusercontent.com/TheRealBatBro/Novaarr/main/docs/screenshots/logo.png)

# Novaarr

A self-hosted, all-in-one web dashboard for your media and download stack. One
container, works from any browser on your phone, tablet, or desktop — no native app
required.

Novaarr talks to the services already running on your network (Sonarr, Radarr,
SABnzbd, Plex, Seerr, Tautulli, and more) through a small backend proxy. Your
browser never talks to those services directly — which means **Novaarr can be the
only thing you expose to the internet.** Put it behind a reverse proxy or VPN and
everything else stays bound to your local network.

Full source, issue tracker, and detailed docs (reverse-proxy setup, backups, etc.):
**https://github.com/TheRealBatBro/Novaarr**

## Screenshots

![Dashboard overview](https://raw.githubusercontent.com/TheRealBatBro/Novaarr/main/docs/screenshots/dashboard.png)

![Movie detail page](https://raw.githubusercontent.com/TheRealBatBro/Novaarr/main/docs/screenshots/detail-page.png)

![Services configuration](https://raw.githubusercontent.com/TheRealBatBro/Novaarr/main/docs/screenshots/services.png)

![Mobile dashboard](https://raw.githubusercontent.com/TheRealBatBro/Novaarr/main/docs/screenshots/mobile.png)

## Quick start

```yaml
services:
  novaarr:
    image: therealbatbro/novaarr:latest
    container_name: novaarr
    restart: unless-stopped
    ports:
      - "3210:3000"           # remove/change if using a reverse proxy
    volumes:
      - novaarr-data:/data   # SQLite database (your PIN + service configs) persists here
    environment:
      NODE_ENV: production
      PORT: 3000
      BASE_PATH: ""           # set to a sub-path if reverse-proxying at e.g. /novaarr
      DB_PATH: /data/novaarr.db
      SHOW_ALL_SERVICES: "true"   # see the table below

volumes:
  novaarr-data:
```

```bash
docker compose up -d
```

Or without Compose:

```bash
docker run -d \
  --name novaarr \
  --restart unless-stopped \
  -p 3210:3000 \
  -v novaarr-data:/data \
  -e SHOW_ALL_SERVICES=true \
  therealbatbro/novaarr:latest
```

Then open `http://<that machine's IP>:3210`.

1. On first load you'll be asked to set a **PIN** or **password** — a convenience lock
   for the dashboard itself, not a security boundary.
2. Go to **Settings → Services** and add whatever you actually run: give each one its
   local URL and API key/credentials, and it appears in the menu.

That's it — everything lives in the `novaarr-data` volume, so it survives restarts
and image updates.

## Updating

```bash
docker compose pull && docker compose up -d
```

Your services, dashboard layout, and sign-in credential all persist across updates —
they live in the volume, not the image.

## Supported services

- **Download clients**: SABnzbd, NZBGet, µTorrent, Deluge, Transmission,
  qBittorrent, rTorrent/ruTorrent
- **_arr suite**: Sonarr, Radarr, Lidarr, Readarr, Bazarr (subtitles), Sick Beard
- **Indexers**: Prowlarr, NZBHydra2, Jackett
- **Media servers**: Plex, Emby, Jellyfin
- **Other**: Seerr, Ombi, Tautulli, Tracearr, Trakt, MDBList, Unraid
- **Coming soon**: NEWZnab

Every service is optional — add only what you run. Anything left unconfigured is
simply hidden from the menu. Any service can be configured more than once (e.g. two
Sonarr instances).

## Multi-user mode

Opt in from Settings → Security to give each household member their own login instead
of one shared PIN/password, with Admin/Member roles and named **access roles** that
restrict a Member to specific services, dashboard widgets, and Calendar sources. See
the [full README](https://github.com/TheRealBatBro/Novaarr#multi-user-mode--access-roles)
for details.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the app listens on *inside* the container. |
| `BASE_PATH` | `""` (root) | Set to a sub-path (e.g. `/novaarr`) if hosting behind a reverse proxy at a non-root path. |
| `DB_PATH` | `/data/novaarr.db` | Where the SQLite database lives. Leave as-is unless you've customized the volume mount. |
| `SHOW_ALL_SERVICES` | `true` | `true` shows every supported service in the menu regardless of whether it's configured yet. Set to `false` once you're done configuring, so the menu only shows services you've actually enabled. |
| `DISABLE_AUTH` | unset | **Danger.** Skips the sign-in lock entirely — only for local backend hacking. |
| `CLOUDFLARE_TUNNEL_HOSTNAME` | unset | Cosmetic link shown in Settings → Security if you're using the optional `cloudflared` sidecar — see the [full README](https://github.com/TheRealBatBro/Novaarr#cloudflare-tunnel). |

## Feature requests & support

Both go through GitHub Issues:

- **Feature request**: https://github.com/TheRealBatBro/Novaarr/issues/new?labels=enhancement
- **Support**: https://github.com/TheRealBatBro/Novaarr/issues/new?labels=question

Both links are also available in-app under **Settings → About**, which also lists
what's changed in each version.

## Tech stack

React, TypeScript, Vite, Tailwind, shadcn/ui, TanStack Router/Query on the frontend;
Express and better-sqlite3 on the backend — one container, no separate services to
coordinate.
