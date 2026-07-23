FROM node:20-alpine AS web-build
WORKDIR /web
COPY web/package.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup -S remotarr && adduser -S remotarr -G remotarr

COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY --from=web-build /web/dist ./public

# /data is where the SQLite database lives — mount a named volume here
RUN mkdir -p /data && chown remotarr:remotarr /data
VOLUME ["/data"]

ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/remotarr.db \
    BASE_PATH=""

EXPOSE 3000
USER remotarr

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT+'/api/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
