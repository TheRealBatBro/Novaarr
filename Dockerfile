# Google's distroless nodejs20-debian12 is the hardened final target: no shell, no package
# manager, no libc/toolchain beyond what running Node itself needs — a drastically smaller attack
# surface than a full node:20 image, and unlike Chainguard's equivalent, its version-pinned tags
# (nodejs20-debian12, not just "latest") are public with no paid registry subscription required,
# which matters for a project anyone needs to be able to build themselves. It's build-output only
# though — nothing to build WITH (no npm, no compiler) — so both build stages below still use the
# full node:20-bookworm image (same Debian 12 glibc base as the distroless target, so
# better-sqlite3's native binary is guaranteed ABI-compatible between build and runtime) and only
# their output gets copied into the real, shipped final stage.
FROM node:20-bookworm AS web-build
WORKDIR /web
COPY web/package.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM node:20-bookworm AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# /data (the SQLite volume mount point) needs to exist with the right ownership before the final
# stage, which has no shell to create or chown it itself — prepared here and copied across with
# --chown instead, which the builder applies without needing anything in the destination image.
# 65532 is the "nonroot" convention's uid/gid, which the runner stage's :nonroot tag runs as.
RUN mkdir -p /data && chown 65532:65532 /data

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=web-build /web/dist ./public
COPY --from=deps --chown=65532:65532 /data /data
VOLUME ["/data"]

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/novaarr.db \
    BASE_PATH=""

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD ["/nodejs/bin/node", "-e", "require('http').get('http://localhost:'+process.env.PORT+'/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"]

# This image's own ENTRYPOINT is already the node binary — CMD is just its argument.
CMD ["server.js"]
