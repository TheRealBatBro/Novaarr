# Novaarr

A self-hosted, all-in-one web dashboard for your media and download stack. One app,
one Docker container, works from any browser on your phone, tablet, or desktop — no
native app required.

**[🌐 See it in action →](https://therealbatbro.github.io/Novaarr/)** — screenshots and
a full feature rundown.

> **Coming from Remotarr?** Novaarr is the same project, renamed. Pulling the new
> `therealbatbro/novaarr` image and switching to the updated `docker-compose.yml`
> below is a drop-in upgrade — the app finds and migrates your existing database
> automatically on first start (same configured services, same sign-in credential).
> The only user-visible change is you'll need to sign in again once, since the
> session cookie's name changed along with everything else.

Novaarr talks to the services already running on your network (Sonarr, Radarr,
SABnzbd, Seerr, Tautulli, and more) through a small backend proxy, so it works
around browser CORS restrictions.

**Novaarr can be the only thing you expose to the internet.** Every request to a
configured service — Sonarr, Radarr, SABnzbd, whatever you've added — is relayed
server-side through that same proxy; your browser never talks to those services
directly, and they never need a port of their own opened up. Put Novaarr behind your
reverse proxy or VPN and everything else can stay bound to your local network only.

## Supported services

- **Download clients**: SABnzbd, NZBGet, µTorrent, Deluge, Transmission,
  qBittorrent, rTorrent/ruTorrent
- **_arr suite**: Sonarr, Radarr, Lidarr, Readarr, Bazarr (subtitles), Sick Beard
- **Indexers**: Prowlarr, NZBHydra2, Jackett
- **Media servers**: Plex, Emby, Jellyfin (dashboard widgets — recently added,
  collections, library stats)
- **Other**: Seerr, Ombi, Tautulli, Tracearr, Trakt, MDBList, Unraid, Maintainerr
- **Coming soon**: NEWZnab — see Settings > Services for what's live today.

Every service is optional. Add only what you run — anything left unconfigured is
simply hidden from the menu. Any service can be configured **more than once** (e.g.
two Sonarr instances) — Settings > Services groups each service's instances into one
card with an "Add another instance" action.

Trakt and MDBList both power the same Trending/Most Anticipated dashboard widgets —
configure whichever one's API you can reach; MDBList is a good fallback if Trakt's API
is blocked from your network.

## Quick start

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose.

1. Clone or copy this repository onto the machine (server, NAS, etc.) where you want
   Novaarr to run.
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
they live in the `novaarr-data` volume, not the container image.

## Configuration (`docker-compose.yml`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the app listens on *inside* the container — change the left side of the `ports:` mapping to use a different port on the host. |
| `BASE_PATH` | `""` (root) | Set to a sub-path (e.g. `/novaarr`) if hosting behind a reverse proxy at a non-root path — see [Running behind a reverse proxy](#running-behind-a-reverse-proxy). |
| `DB_PATH` | `/data/novaarr.db` | Where the SQLite database lives. Leave as-is unless you've customized the volume mount. |
| `SHOW_ALL_SERVICES` | `true` | `true` shows every supported service in the menu regardless of whether it's configured yet (handy while you're still setting things up). Set to `false` once you're done configuring, so the menu only shows services you've actually enabled. |
| `DISABLE_AUTH` | unset | **Danger.** Skips the sign-in lock (PIN/password or multi-user login) entirely. Leave unset in any deployment reachable by more than just you — only for local backend hacking. Deliberately a separate flag from `SHOW_ALL_SERVICES`, which only affects menu visibility. |
| `CLOUDFLARE_TUNNEL_HOSTNAME` | unset | Purely cosmetic — the public hostname shown as a link in Settings > Security's Cloudflare Tunnel status card. See [Cloudflare Tunnel](#cloudflare-tunnel) below. |
| `TAILSCALE_HOSTNAME` | unset | Cosmetic fallback for Settings > Security's Tailscale status card — only used if the sidecar's own reported hostname is unavailable. See [Tailscale](#tailscale) below. |

The included `docker-compose.yml` maps container port `3000` to host port `3210`
(`http://<host>:3210`) and mounts a named volume, `novaarr-data`, at `/data` for
the SQLite database — this single file holds your sign-in credential and every service
you configure (URLs, API keys, dashboard layout).

## Running behind a reverse proxy

Novaarr works behind Nginx, Caddy, or Traefik out of the box — no separate "proxy
mode" to turn on. There are two ways to expose it; pick whichever fits how you already
organize your other self-hosted apps.

**Option A — a dedicated subdomain (recommended).** Point `novaarr.yourdomain.com` at
the container with no path prefix. This is the simpler setup and matches how most
self-hosted dashboards (Sonarr, Radarr, Seerr, etc.) are usually run. `BASE_PATH`
stays empty.

**Option B — a sub-path on an existing domain.** Mount Novaarr at
`https://yourdomain.com/novaarr/` alongside other apps on the same host. Set
`BASE_PATH=/novaarr` (matching whatever path segment you choose) — the app adjusts
every asset path, API call, and service-worker registration to that prefix
automatically.

Either way, first stop publishing the port directly — remove the `ports:` section from
`docker-compose.yml` and put the container on the same Docker network as your proxy so
it can reach `novaarr:3000` by container name:

```yaml
services:
  novaarr:
    build: .
    container_name: novaarr
    restart: unless-stopped
    # ports: section removed — the proxy reaches this container directly
    volumes:
      - novaarr-data:/data
    environment:
      NODE_ENV: production
      PORT: 3000
      BASE_PATH: "" # or "/novaarr" for Option B
      DB_PATH: /data/novaarr.db
      SHOW_ALL_SERVICES: "false"
    networks:
      - proxy

volumes:
  novaarr-data:

networks:
  proxy:
    external: true
```

Whatever proxy you use, it must forward two headers so Novaarr can tell it's being
accessed over HTTPS (this determines whether the sign-in cookie gets the `Secure`
flag) and pass along the real client IP:

- `X-Forwarded-Proto` — set to `https` when the proxy terminates TLS
- `X-Forwarded-For` — the original client IP

The app already trusts exactly one upstream hop (`app.set('trust proxy', 1)` in
`server.js`), which is correct as long as Novaarr's proxy is the *only* layer in
front of it. If you're chaining proxies (e.g. Cloudflare in front of your own Nginx),
only the outermost hop's TLS termination matters for the `Secure` cookie — the chain
just needs to forward the headers through unmodified.

### Nginx

```nginx
# Option A — subdomain
server {
    listen 443 ssl;
    server_name novaarr.yourdomain.com;

    location / {
        proxy_pass http://novaarr:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# Option B — sub-path (BASE_PATH=/novaarr)
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location /novaarr/ {
        proxy_pass http://novaarr:3000;
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
novaarr.yourdomain.com {
    reverse_proxy novaarr:3000
}

# Option B — sub-path (BASE_PATH=/novaarr)
yourdomain.com {
    handle_path /novaarr/* {
        reverse_proxy novaarr:3000
    }
}
```

### Traefik (Docker labels)

```yaml
services:
  novaarr:
    # ...same as above...
    labels:
      traefik.enable: "true"
      # Option A — subdomain
      traefik.http.routers.novaarr.rule: Host(`novaarr.yourdomain.com`)
      traefik.http.routers.novaarr.tls.certresolver: letsencrypt
      traefik.http.services.novaarr.loadbalancer.server.port: "3000"

      # Option B — sub-path (BASE_PATH=/novaarr) — replace the router rule above with:
      # traefik.http.routers.novaarr.rule: Host(`yourdomain.com`) && PathPrefix(`/novaarr`)
```

Traefik forwards `X-Forwarded-Proto`/`X-Forwarded-For` by default, no extra config
needed.

### Security headers (optional)

Novaarr already sends its own security headers (HSTS, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, and a `Content-Security-Policy` tuned to what it
actually loads) — you don't need to configure anything at the proxy for Novaarr
itself. If you'd like the first four set at the Traefik layer too (handy if you're
running other services behind the same Traefik instance that don't set their own),
add a `headers` middleware:

```yaml
labels:
  # ...same router/service labels as above...
  traefik.http.routers.novaarr.middlewares: novaarr-headers

  traefik.http.middlewares.novaarr-headers.headers.stsSeconds: "15552000"
  traefik.http.middlewares.novaarr-headers.headers.stsIncludeSubdomains: "true"
  traefik.http.middlewares.novaarr-headers.headers.forceSTSHeader: "true"
  traefik.http.middlewares.novaarr-headers.headers.contentTypeNosniff: "true"
  traefik.http.middlewares.novaarr-headers.headers.customFrameOptionsValue: "DENY"
  traefik.http.middlewares.novaarr-headers.headers.referrerPolicy: "no-referrer"
```

Don't also set `contentSecurityPolicy` here. The app's own CSP is specifically tuned
(a per-request nonce for its one inline script, an allowance for the unpredictable
Sonarr/Radarr/Bazarr art hosts, the YouTube trailer frame, etc.) — a second, more
generic CSP from Traefik on top would have browsers enforce the *intersection* of
both policies, and the stricter parts of a generic policy would likely block things
the app's own policy correctly allows, breaking posters or the trailer modal.

## Cloudflare Tunnel

An alternative to a reverse proxy: expose Novaarr through a
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
without opening any port on your router. `docker-compose.yml` includes an optional,
commented-out `cloudflared` sidecar service:

1. Create a tunnel at [one.dash.cloudflare.com](https://one.dash.cloudflare.com) > Zero
   Trust > Networks > Tunnels, and add a public hostname pointing at
   `http://novaarr:3000` (this container, by its Compose service name).
2. Copy the tunnel token from the install step.
3. Uncomment the `cloudflared` service in `docker-compose.yml` and paste the token into
   its `command:` line. Optionally set `CLOUDFLARE_TUNNEL_HOSTNAME` in the `novaarr`
   service to the hostname from step 1.
4. `docker compose up -d`.

Settings > Security will then show a live status card (Connected / Not connected /
Not set up) by checking the sidecar's health across the Docker network — it's
read-only, the tunnel itself is still managed from Cloudflare's dashboard.

This runs as its own container deliberately, rather than being bundled inside the
Novaarr container — a tunnel token is a bearer credential with full control over
what's publicly exposed, and keeping it in a separate, minimal container (Cloudflare's
own official image) keeps that blast radius contained if the app itself is ever
compromised.

## Tailscale

An alternative (or complement) to a Cloudflare Tunnel: put Novaarr on your private
[Tailscale](https://tailscale.com/) network (a mesh VPN) instead of exposing it
publicly at all. `docker-compose.yml` includes an optional, commented-out
`tailscale` sidecar service:

1. Generate an auth key at
   [login.tailscale.com/admin/settings/keys](https://login.tailscale.com/admin/settings/keys).
2. Uncomment the `tailscale` service in `docker-compose.yml` and paste the key into
   `TS_AUTHKEY`.
3. `docker compose up -d`.

Unlike the `cloudflared` sidecar, this one shares the `novaarr` container's own
network namespace (`network_mode: service:novaarr`) — that's what actually makes
Novaarr itself reachable at your tailnet hostname/IP, and as a side effect lets
Novaarr query Tailscale's local status API over `localhost` for the status card in
Settings > Security. Change tailnet access itself from Tailscale's own admin console —
same read-only relationship the Cloudflare Tunnel card has to Cloudflare's dashboard.

## Cloudflare Access

If you're already tunneling Novaarr through Cloudflare (above), you can go a step
further and let [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
handle sign-in entirely — its own login (with whatever identity provider and 2FA
policy you configure there) becomes the auth boundary, instead of relying only on
Novaarr's own PIN/password.

1. In [one.dash.cloudflare.com](https://one.dash.cloudflare.com) > Zero Trust >
   Access > Applications, add an application for your Novaarr hostname, with
   whatever login/2FA policy you want.
2. Copy the application's **Audience (AUD) tag** from its Overview tab, and your
   **team domain** (`https://<team-name>.cloudflareaccess.com`).
3. Set `CF_ACCESS_TEAM_DOMAIN` and `CF_ACCESS_AUD` on the `novaarr` service in
   `docker-compose.yml` (both required together) and `docker compose up -d`.
4. **Simple mode**: any verified Access login now signs in as the shared identity —
   no linking needed, since there's only one.
5. **Multi-user mode**: each Novaarr account needs its Access email linked
   explicitly — edit the user in Settings > Users and set "Cloudflare Access email".
   An Access login with no linked account gets a clear "ask an admin to link it"
   message rather than silently failing.

This is additive, not a replacement: the app's own PIN/password/2FA sign-in still
works too (e.g. for LAN access that bypasses the tunnel entirely). Every Access JWT
is verified against Cloudflare's own public keys — nothing here trusts a header
value on its own.

## Sign-in: PIN or password

Settings > Security lets you change your sign-in credential at any time, and switch
between a PIN code and a password whenever you like — you're never locked into the
choice made during first-run setup. Changing it signs every device back out
(including this one, briefly — it reissues your own session right after), so a leaked
old credential can't be used to keep an existing session alive.

## Two-factor authentication (TOTP)

Settings > Security also has an optional "Two-factor authentication" card — scan the
QR code with an authenticator app (Google Authenticator, 1Password, Authy, …), confirm
with a 6-digit code, and save the one-time backup codes it gives you afterward. Once
enabled, signing in with your PIN/password is followed by a second step asking for a
code. This is per-identity: in multi-user mode, each member enables their own
independently; in simple mode, it applies to the one shared credential. It doesn't
apply to signing in via Cloudflare Access (below), which already has its own login
policy. **Save the backup codes somewhere safe** — there's no email/SMS recovery flow,
so losing both your authenticator app and your backup codes means recovering access
requires directly editing the database (clearing `totp_enabled`/`totp_secret` for the
relevant row).

## Passkeys

Settings > Security also has a **Passkeys** card — sign in with your device's
fingerprint, face, or a security key instead of typing your PIN/password. This is
additive, not a replacement: your existing credential keeps working, and you can add
more than one passkey (e.g. one per device). Passkeys require the page be loaded over
HTTPS or `localhost` — a browser-level rule, not something Novaarr can work around —
so if you're reaching Novaarr over plain `http://` on a LAN IP, set up a
[reverse proxy](#running-behind-a-reverse-proxy), [Cloudflare Tunnel](#cloudflare-tunnel),
or [Tailscale](#tailscale) first.

## Push notifications

Settings > Notifications lets you enable push notifications on that device/browser —
separate per device, same as any other app. Today's real trigger is a background
poller that watches every configured Overseerr/Jellyseerr instance's pending-request
count and notifies you when it goes up, so approvals don't just sit there until you
happen to open the app. A "Send test notification" button is there to confirm it's
wired up correctly on a given device.

## Alert channels

The same Settings > Notifications page also has **Alert channels** — send a message to
Telegram, [ntfy](https://ntfy.sh), Discord, Slack, Pushover, Gotify, or WhatsApp
(via your own [Twilio](https://www.twilio.com/docs/whatsapp/api) account — there's no
general-purpose, ToS-compliant way to send WhatsApp messages without one; the
unofficial approaches all require a persistent QR-scanned session tied to a real
personal number, not something to automate from a background service) whenever
something happens in Novaarr:

- Sign-ins, failed sign-in attempts, credential/2FA/passkey changes, sessions revoked
- Services, users, or access roles added/edited/removed
- A new pending Overseerr/Jellyseerr request (the same trigger push notifications use)

Each event can be switched on or off independently — the toggle applies to every
configured channel and to push notifications at once, so a noisy event can be muted
everywhere in one place instead of per-channel. Add a channel and use its "Send test"
button to confirm it's wired up correctly before relying on it.

## Appearance

Settings > Appearance lets you pick one of six accent colors and toggle an AMOLED
true-black dark mode — both stored per device/browser, not shared with other people
signed in to the same deployment.

## Multi-user mode & access roles

By default, everyone shares one PIN/password. If you'd rather give each household
member their own login, click **Switch to multi-user mode** in Settings > Security —
this creates the first Admin account and can't be undone from that page (the shared
credential stops being checked once you switch).

- **Admin vs. Member**: Admins manage services, users, and backups. Members can use
  the app but can't change shared settings.
- **Access roles** (Settings > Users): name a set of services, individual dashboard
  widgets, and Sonarr/Radarr Calendar sources a Member is restricted to — e.g. a "Kids"
  role that only shows Sonarr and Radarr, or a role that grants just one Plex widget
  without exposing anything else. A Member with no role assigned has full access.
- **Account linking**: an admin can connect a member's account to their Plex, Emby, or
  Jellyfin login (Settings > Users > Edit); Overseerr/Ombi accounts are then matched
  automatically by username. This personalizes things like the "Because you watched"
  recommendations widget to that person instead of everyone's combined history.

## Data & backups

Everything Novaarr needs to remember — your sign-in credential (or every user account
and access role, in multi-user mode), every configured service (API keys are encrypted
at rest), and each user's dashboard layout — lives in one SQLite file inside the
`novaarr-data` Docker volume. Back up that volume (or the file at `DB_PATH`) to back
up your whole setup. Settings > Backup also lets you export/import an encrypted
snapshot from inside the app itself.

```bash
# Example: copy the DB out of the named volume for a backup
docker cp novaarr:/data/novaarr.db ./novaarr-backup.db
```

## Security

A few things worth knowing about the security model:

- **Credentials at rest**: every service's API key/password is encrypted (AES-256-GCM)
  in the SQLite database, not stored as plain JSON.
- **Session revocation**: a leaked or stale session cookie doesn't have to wait out its
  full 30-day life — Settings > Security has a **Sign out everywhere else** action, a
  password/PIN change signs out every existing session automatically, and an admin
  resetting a member's password does the same for that member alone.
- **SSRF protections on the proxy**: every outbound request the backend makes on your
  behalf resolves DNS itself and refuses to connect to loopback, link-local, or cloud
  metadata addresses (e.g. `169.254.169.254`) — including through a redirect, since the
  same protected resolver is used for the whole redirect chain, not just the first hop.
  LAN addresses (10/8, 172.16/12, 192.168/16) stay allowed, since reaching your Sonarr/
  Radarr/etc. on your own network is the whole point.
- **Container hardening**: the shipped `docker-compose.yml` runs the container
  read-only (except `/data` and `/tmp`), drops all Linux capabilities, and sets
  `no-new-privileges` — on top of the image already running as a non-root user.
- **Brute-force lockout**: failed sign-ins trigger an exponentially growing lockout
  (capped at 24 hours, up from an earlier 15-minute cap) — a script hammering the
  login endpoint from the internet can no longer keep guessing at a steady drip
  forever. New/changed PINs require 6-8 digits, not 4, for the same reason.
- **CSRF**: the session cookie is `sameSite: lax` and no CORS is enabled anywhere, so a
  cross-site page can neither attach the cookie to a fetch/XHR request nor trigger a
  cookie-carrying state-changing request via a top-level form POST.
- **Optional Cloudflare Access SSO** and **optional TOTP two-factor authentication** —
  see below.
- Found something that should be hardened further? Please open a
  [security-labeled issue](https://github.com/TheRealBatBro/Novaarr/issues/new?labels=security&title=Security%3A%20)
  rather than a public one if it's a live exploit, and we'll follow up privately.

## Feature requests & support

Both are handled through GitHub Issues on this repo:

- **Feature request**: [open one here](https://github.com/TheRealBatBro/Novaarr/issues/new?labels=enhancement&title=Feature%20request%3A%20)
- **Something broken or need help?**: [open a support issue here](https://github.com/TheRealBatBro/Novaarr/issues/new?labels=question&title=Support%3A%20)

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

This starts a Vite dev server that proxies API calls to a Novaarr backend — run the
backend separately (`npm start` from the project root, after `npm install`) alongside
it.

## Publishing to Docker Hub

To push an update to `therealbatbro/novaarr`, build and push with Buildx directly
rather than `docker compose up --build` + `docker push`:

```bash
docker buildx build --provenance=false --sbom=false -t therealbatbro/novaarr:latest --push .
```

`--provenance=false --sbom=false` matters: without it, Buildx attaches a build
attestation as an extra entry in the pushed manifest list, tagged
`platform: unknown/unknown`. Many Docker clients — older Docker Engine versions, and
NAS/Docker-UI tools like Unraid, Synology, Portainer, and Watchtower — can't resolve a
manifest out of that shape and fail to pull with `manifest unknown`, even though the
tag exists and pulls fine with a fully up-to-date Docker CLI. Building with those two
flags produces a plain single-manifest image compatible with everything.
