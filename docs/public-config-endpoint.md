# Public project config

How the portal learns a project's **brand** and **sign-in options** before
anyone signs in.

## The endpoint

```
GET /{version}/public/projects/{id}/config        (public, no sign-in)
```

It returns only what a sign-in page shows anyway. There are no switches: every
project returns all of it (since 2026-11-19).

```jsonc
{
  "displayName": "Acme",
  "branding": {
    "displayName": "Acme",
    "mainColor": "#0A558C",
    "accentColor": "#2680C2",
    "logoUrl": "https://…",
    "iconUrl": "https://…"
  },
  "auth": {
    "socialProviders": ["facebook", "google"],
    "socialSignIn": [
      { "provider": "google", "displayName": "Google",
        "startPath": "/v3/membership/auth/social/google?projectId=pr_…" }
    ],
    "passkey": true,
    "methods": ["email", "phone", "username"],
    "passwordPolicy": { "minLength": 8, "minNumbers": 1 }
  },
  "aiChat": { "enabled": true, "assistants": [{ "id": "…", "name": "Support", "welcome": "Hi!" }] }
}
```

A field that is missing (a project with no password flow, an older gateway)
keeps the portal's defaults: **email** sign-in and a **minLength-6** password
policy. The code is `loadProjectConfig` in `src/config/projectConfig.ts`.

## Legal documents

`GET /{version}/public/projects/{id}/legal/{terms|privacy}` returns a document
once the project has written it (Norbix Cloud → Project Settings → Admin
Portal → Legal documents). Not written → `available: false`. The portal shows
them at `/legal/terms` and `/legal/privacy`.

## Social sign-in

A social button is just a link the gateway owns. The portal sends the browser
to `{API host}{startPath}&returnUrl=…`. All redirects, client ids and secrets
stay in the gateway. More in [`social-sign-in.md`](./social-sign-in.md).

## Why public is fine

The answer is readable by anyone who knows the project id. That is fine
because it holds nothing a visitor of the sign-in page could not see: name,
colours, logo, which buttons exist, the password rules the form checks. It
never holds secrets, ids of integrations or the AI system prompt.

**CORS does not protect this** — it only limits which web pages may read an
answer in a browser; `curl` and scripts ignore it. The shape of the answer is
what keeps it safe.
