# syntax=docker/dockerfile:1.7
#
# Single self-hostable image for the Norbix Admin Portal (Next.js, app router).
#
# One container serves BOTH the React UI and the BFF route handlers (app/api/*)
# from one Node process — no separate static server, no Vercel. Built from
# Next's `output: 'standalone'`.
#
# Unlike the old Vite image, configuration is RUNTIME (read by the Node server),
# not baked into the bundle. Pass env at `docker run` / in k8s:
#   ADMIN_BFF_API_KEY        — service-user API key (server-only; never shipped to the browser)
#   ADMIN_BFF_HUB_BASE_URL   — e.g. https://hub.norbix.ai
#   ADMIN_BFF_API_BASE_URL   — e.g. https://api.norbix.ai
#   NEXT_PUBLIC_*            — anything the browser needs (config mode, etc.)
#
#   docker build -f deployments/Dockerfile -t norbix-admin .
#   docker run -p 3100:3100 -e ADMIN_BFF_API_KEY=... norbix-admin

ARG NODE_VERSION=22

# ─────────────────────────────────────────────────────────────────
# 1) Dependencies
# ─────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    (npm ci --prefer-offline || npm install)

# ─────────────────────────────────────────────────────────────────
# 2) Build (produces .next/standalone)
# ─────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────
# 3) Runtime — minimal standalone server
# ─────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100 HOSTNAME=0.0.0.0

# Non-root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone bundle + static assets + public dir.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3100
CMD ["node", "server.js"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null --spider http://127.0.0.1:3100/ || exit 1
