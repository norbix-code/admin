# Admin Portal — features

All authenticated features are **end-user-scoped** and call the **API**
gateway (never Hub). Each maps to one Redux slice + one API service + one or
more screens.

## 1. Auth management

The signed-in user manages their own credentials and account security.

- **Change password** — old + new password.
- **Reset password** — request a reset email; confirm with the token from the
  link. Also reachable unauthenticated from the login screen.
- **Passkeys** — add, rename, revoke (behind email verification).
- **Two-factor (2FA)** — not built yet (Membership task); the portal does not
  show or mention it.
- **Sessions / sign-out** — sign out of the current session. (Listing/revoking
  other sessions is a later enhancement if the API exposes it.)

Screens: `/security` (password + passkeys).
Unauth: `/sign-in`, `/sign-in/reset`, `/sign-in/reset/confirm`.

## 2. Profile / contact info

Edit the end-user `UserDto` profile fields — display name, given/family name,
email (where editable), phone, locale, etc. Read + update via the API profile
endpoints.

Screen: `/profile`.

## 3. Communication preferences

Cloud defines the communication structure for the whole project (Project
Settings → Communication Preferences): per communication channel (Marketing,
Transactional) a list of **groups**, each with **tags**; every tag says on
which delivery channels it sends (`defaultDelivery`: Email, Sms, Push, …).
Tags in no group are Cloud's "orphaned tags". The portal renders exactly that:

- A tab per channel (Marketing, Service messages); System is never optional.
- Each group as a card (translated title / description), each tag with one
  switch per delivery channel it sends on.
- Tags in no group under **Other options**.
- The global **All marketing messages** switch (`blockAllMarketingMessages`);
  when off, the marketing tag switches are disabled.

A switch writes `blockedTags[<delivery channel>]` (full replacement) through
`UpdateUserPreferences` — the gateway checks it per delivery channel
(`Campaign.cs`). The structure comes from `/api/bootstrap`, read server-side
with the service-user key; without a key only the global switch shows.

Screen: `/preferences`.

## 4. Compliance / privacy

**Hidden for now** (`PRIVACY_PAGE_ENABLED = false` in `src/config/structure.ts`):
the page called `/me/compliance`, `/me/compliance/export` and
`/me/compliance/delete`, which the gateway does not have. Cloud defines the
privacy flows first (Project Settings → Access / legal documents, Compliance
settings); the portal then renders what Cloud defines. The public
`/legal/terms` and `/legal/privacy` pages stay, and the sign-in screen links
them when the project published the document.

Planned self-service data rights:

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
