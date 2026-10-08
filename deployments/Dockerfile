# syntax=docker/dockerfile:1.7
#
# Single self-hostable image for the Norbix Admin Portal (Next.js, app router).
#
# One container serves BOTH the React UI and the server route handlers
# (app/api/*) from one Node process — no separate static server, no Vercel.
# Built from Next's `output: 'standalone'`.
#
# Unlike the old Vite image, configuration is RUNTIME (read by the Node server),
# not baked into the bundle. Pass env at `docker run` / in k8s:
#   API_KEY        — service-user API key (server-only; never shipped to the browser)
#   HUB_BASE_URL   — e.g. https://hub.norbix.ai
#   API_BASE_URL   — e.g. https://api.norbix.ai
#   ENV            — optional Norbix environment (staging/test); unset = PROD
#   PROJECT_ID     — self-hosted: the project this portal serves (pr_{base62}
#                    or pr-{32 hex}). Emitted per request as a meta tag, so one
#                    public image works for any customer on any domain.
#
# There is NO edition build arg: Community / ManagedService / Enterprise is
# decided at RUNTIME (the Hub's /echo `release`, and API_KEY present =
# self-hosted). The same build is published as admin, enterprise-admin and
# community-admin.
#
# Browser values (NEXT_PUBLIC_*) are the exception: Next inlines them into the
# bundle at BUILD time, so they are build args, not runtime env. Leave them
# EMPTY for any published image (they would pin every user of the image):
#   NEXT_PUBLIC_ADMIN_PROJECT_ID   — private single-project builds only;
#                                    prefer the runtime PROJECT_ID
#   NEXT_PUBLIC_ADMIN_CONFIG_MODE  — 'dynamic' (default) or 'static'
#
#   docker build -f deployments/Dockerfile -t norbix/community-admin .
#   docker run -p 3100:3100 -e PROJECT_ID=pr_xxxx -e API_KEY=... \
#     -e HUB_BASE_URL=https://hub.example.com \
#     -e API_BASE_URL=https://api.example.com norbix/community-admin

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
# Inlined into the browser bundle by `next build` (see the header). Empty =
# not pinned: the project comes from the host label / custom-domain lookup.
ARG NEXT_PUBLIC_ADMIN_PROJECT_ID=""
ARG NEXT_PUBLIC_ADMIN_CONFIG_MODE=""
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_ADMIN_PROJECT_ID=${NEXT_PUBLIC_ADMIN_PROJECT_ID} \
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
