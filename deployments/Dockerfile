# syntax=docker/dockerfile:1.7
#
# The image of the Norbix Admin Portal (Next.js, app router). You host it.
#
# One container serves BOTH the React UI and the server route handlers
# (app/api/*) from one Node process — no separate static server.
# Built from Next's `output: 'standalone'`.
#
# Configuration is RUNTIME (read by the Node server), not baked into the
# bundle. Pass it at `docker run` / in your orchestrator:
#   PROJECT_ID     — required. The project this portal serves (pr_…).
#   API_KEY        — required. The API key of the project's Admin Portal
#                    service user (server-only; never shipped to the browser).
#   ENV            — optional project environment (staging/test); unset = PROD
#   HUB_BASE_URL   — optional, default https://hub.norbix.ai
#   API_BASE_URL   — optional, default https://api.norbix.ai
#
# Without PROJECT_ID or API_KEY the portal starts and shows a setup page that
# names the missing variable.
#
# One browser value is a build arg, because Next inlines NEXT_PUBLIC_* into the
# bundle at BUILD time:
#   NEXT_PUBLIC_ADMIN_CONFIG_MODE  — 'dynamic' (default) or 'static'
#                                    (see docs/login-resolution.md)
#
#   docker build -f deployments/Dockerfile -t my-admin-portal .
#   docker run -p 3100:3100 -e PROJECT_ID=pr_xxxx -e API_KEY=... my-admin-portal

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
# Inlined into the browser bundle by `next build` (see the header).
ARG NEXT_PUBLIC_ADMIN_CONFIG_MODE=""
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_ADMIN_CONFIG_MODE=${NEXT_PUBLIC_ADMIN_CONFIG_MODE}
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
