# syntax=docker/dockerfile:1.7
#
# Production Dockerfile for the Norbix Admin Portal (React + Vite + TS).
#
# Flavor is selected at build time via VITE_ADMIN_RELEASE. The same Dockerfile
# builds all flavors — the difference is runtime UI behavior gated on the flag.
#
#   docker build --build-arg VITE_ADMIN_RELEASE=ManagedService -t admin:managed .
#   docker build --build-arg VITE_ADMIN_RELEASE=SelfHosted \
#                --build-arg VITE_ADMIN_PROJECT_ID=7Hk2 -t admin:selfhosted .
#
# Multi-arch via buildx in CI. Build stage pins to $BUILDPLATFORM so node
# tooling runs native; runtime is a multi-arch nginx:alpine manifest.

ARG NODE_VERSION=22
ARG NGINX_VERSION=1.27

# ─────────────────────────────────────────────────────────────────
# 1) Build stage
# ─────────────────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

ARG VITE_ADMIN_RELEASE=ManagedService
ARG VITE_ADMIN_HUB_BASE_URL
ARG VITE_ADMIN_HUB_VERSION=v3
ARG VITE_ADMIN_API_BASE_URL
ARG VITE_ADMIN_API_VERSION=v3
ARG VITE_ADMIN_PROJECT_ID
ENV VITE_ADMIN_RELEASE=${VITE_ADMIN_RELEASE} \
    VITE_ADMIN_HUB_BASE_URL=${VITE_ADMIN_HUB_BASE_URL} \
    VITE_ADMIN_HUB_VERSION=${VITE_ADMIN_HUB_VERSION} \
    VITE_ADMIN_API_BASE_URL=${VITE_ADMIN_API_BASE_URL} \
    VITE_ADMIN_API_VERSION=${VITE_ADMIN_API_VERSION} \
    VITE_ADMIN_PROJECT_ID=${VITE_ADMIN_PROJECT_ID} \
    NODE_ENV=production \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

# Lockfile first for layer caching.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    (npm ci --prefer-offline || npm install)

COPY . .

# `npm run build` runs `tsc && vite build` — typecheck failure fails the image.
RUN npm run build

# ─────────────────────────────────────────────────────────────────
# 2) Runtime stage
# ─────────────────────────────────────────────────────────────────
FROM nginx:${NGINX_VERSION}-alpine AS runtime

RUN rm /etc/nginx/conf.d/default.conf
COPY deployments/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

USER nginx
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null --spider http://127.0.0.1:8080/healthz || exit 1
