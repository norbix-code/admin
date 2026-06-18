# Admin Portal — features

All authenticated features are **end-user-scoped** and call the **API**
gateway (never Hub). Each maps to one Redux slice + one API service + one or
more screens.

## 1. Auth management

The signed-in user manages their own credentials and account security.

- **Change password** — old + new password.
- **Reset password** — request a reset email; confirm with the token from the
  link. Also reachable unauthenticated from the login screen.
- **Two-factor (2FA)** — enroll (TOTP: show secret + QR, verify a code),
  view status, disable (re-auth required).
- **Sessions / sign-out** — sign out of the current session. (Listing/revoking
  other sessions is a later enhancement if the API exposes it.)

Screens: `/security` (overview), `/security/password`, `/security/2fa`.
Unauth: `/sign-in`, `/sign-in/reset`, `/sign-in/reset/confirm`.

## 2. Profile / contact info

Edit the end-user `UserDto` profile fields — display name, given/family name,
email (where editable), phone, locale, etc. Read + update via the API profile
endpoints.

Screen: `/profile`.

## 3. Marketing preferences

The user controls what messages they receive: which marketing topics they are
subscribed to, and which transactional vs. marketing channels are enabled.
Backed by the API marketing-state endpoints (per channel / per subscription),
the same domain concept Cloud's contacts/marketing-state uses on the Hub side.

- List subscriptions / topics with on-off toggles.
- Per-channel marketing opt-in/opt-out (email, SMS, push, ...).
- Clear distinction between **transactional** (cannot fully opt out of
  essential service messages) and **marketing** (freely opt out).

Screen: `/preferences`.

## 4. Compliance / privacy

Self-service data rights:

- **Data export** — "what data do you hold about me" → request an export;
  show request status / download when ready.
- **Account removal** — request account deletion (with the project's
  configured grace/confirmation flow).
- **Data-usage / consent** — show what categories of data are collected and
  the consents on record.
- **Public terms & policies** — read the project's published terms and
  privacy policy. These are also reachable **publicly** (no auth) at
  `/legal/terms` and `/legal/privacy`, so the URLs can be used in app-store
  listings.

Screens: `/privacy` (authed hub for export/deletion/consent),
`/legal/terms`, `/legal/privacy` (public).

## 5. (Later) Own records

Not in the MVP. The user sees database records that belong to them and, gated
by their permissions, can CRUD their own records. Reuses the existing API
data-plane endpoints exposed through the SDKs. Tracked in
`implementation-plan.md` as a post-MVP phase.

## Route map (MVP)

```
PUBLIC (unauth)
  /                      → if authed: dashboard; else: redirect to /sign-in
  /sign-in               → dynamic/static login screen
  /sign-in/reset         → request password reset
  /sign-in/reset/confirm → confirm reset with token
  /oauth/callback        → social login return
  /legal/terms           → published terms (public)
  /legal/privacy         → published privacy policy (public)
  (no project in host)   → blank placeholder

AUTHED
  /            → dashboard (cards linking to the four areas)
  /security    /security/password   /security/2fa
  /profile
  /preferences
  /privacy
```
