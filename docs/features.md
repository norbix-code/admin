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
with the service-user key; when that read fails only the global switch shows.

Screen: `/preferences`.

## 4. Legal pages

The project's published terms and privacy policy, readable with **no
sign-in** at `/legal/terms` and `/legal/privacy` (short aliases `/terms` and
`/policies`). The addresses are stable, so they can be used in app-store
listings. The sign-in screen links them when the project published the
document.

## Route map

```
PUBLIC
  /sign-in               → sign-in (password, social, passkey)
  /sign-in/reset         → ask for a password reset e-mail
  /sign-in/reset/confirm → set a new password with the token from the e-mail
  /sign-up               → a visitor creates an account (when the project allows it)
  /sign-up/invitation    → an invited user finishes registration
  /oauth/callback        → social sign-in return, account link return,
                           passkey recovery link
  /legal/terms           → published terms
  /legal/privacy         → published privacy policy

SIGNED IN (anything else redirects to /sign-in)
  /                      → home: cards linking to the pages below
  /profile
  /security              → password, passkeys, linked sign-in methods
  /security/password     → forced password change after sign-in
  /preferences

Not set up (PROJECT_ID or API_KEY missing) → the setup screen on every path
```

## AI chat (optional)

When the project turns on the end-user AI chat (Norbix Cloud → Project
Settings → AI → "Show AI chat"), a signed-in user sees a chat button in the
corner. The chat opens in a side panel or full screen, streams the answer as
it is written, lists earlier chats and shows what the assistant remembers.
When the chat is off, nothing about it is shown. The code is in
`src/features/aiChat/`.

