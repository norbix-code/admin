# Social sign-in and the passkey recovery link

The sign-in page shows one "Continue with …" button per entry of the public
config's `auth.socialSignIn` (the enabled social sign-in integrations of the
env: `provider`, `displayName`, `startPath`). No entries, no buttons.

1. **Start.** The button sends the browser to
   `{API host}{startPath}&returnUrl={portal}/oauth/callback?via={provider}`.
   The API host is the origin of `apiUrl` from `/echo`, **not** the
   same-origin proxy. The gateway sets a short-lived HttpOnly cookie on that
   host and checks it when the provider calls back, so a start through the
   proxy would put the cookie on the portal host and end in `state_mismatch`.
   `startPath` already carries the project and the env (the portal's SDK
   client knows neither the API host nor the env, so the SDK's
   `socialSignInUrl` is not used for this one URL). The portal adds
   `&codeChallenge=…` (PKCE, below).
2. **Return.** The gateway sends the browser to `/oauth/callback` with a
   one-time `code` and `provider` (plus `intent=link` for a link), or with
   `error=<reason>`. No token is ever in the URL. The page takes the code
   out of the address bar, exchanges it through the proxy with no
   credentials and with the PKCE verifier (`api.auth.exchangeSocialCode`,
   2 minutes, once) and stores the bearer JWT exactly like a password
   sign-in.
3. **Link (Security → Sign-in methods).** "Link {provider}" calls
   `api.membership.startLinkIdentity` (with a PKCE challenge) as the
   signed-in user and sends the
   browser to the `authorizeUrl` it answers. The return page finishes the
   link (`finishLinkIdentity`, with the verifier) and goes back to Security with "Linked …", or
   "This {provider} account belongs to someone else." (409,
   CM-ERRORS-MEMBERSHIP-055). The page does not list the accounts already
   linked: the API host has no read of a user's other logins.

**PKCE.** Every sign-in start and link start makes a fresh verifier
(`createPkcePair`, 32 random bytes) and sends its S256 challenge; the
exchange and the link finish send the verifier. The verifier is kept in
`sessionStorage` (this tab only) under `norbix:pkce:<signIn|link>:<provider>`
and is removed when it is read, used or not, and when a start fails. The
gateway binds the one-time code to the challenge, so a code URL opened in
another browser or tab is refused (CM-ERRORS-MEMBERSHIP-058: "This sign-in
link was started in another browser or tab. Please start again."); a failed
check uses the code up. Without `sessionStorage` the start goes without a
challenge, which the gateway still accepts.

**The portal's origin must be allowed.** The gateway accepts `returnUrl` only
when it is absolute https (plain http only for `localhost`) and its origin is
in the project's allowed origins: the saved Allowed Origins plus the origin of
the project's Admin portal URL. So **save your portal's address as the
project's "Admin portal URL" in Norbix Cloud** (README, step 6); for local
development add `http://localhost:3100` to the Allowed Origins. A refused
sign-in start comes back to the mode's failure page with
`error=return_url_not_allowed` ("This portal's address is not allowed for
sign-in. Ask the project owner to add it to Allowed origins."); with no
failure page, and for the other start refusals (049 / 050 / 053 / 059), it is
a JSON answer on the API host's page.

**At the provider**, register the callback
`{API host}/v3/membership/auth/social/{provider}/callback/{projectId}`, where
the API host is the one `/echo` reports. The gateway builds the provider's
`redirect_uri` from that public address for the sign-in start and the link
start (sent through the proxy) alike; a start opened on another host name
hops once to it.

## Passkey recovery link

The gateway's passkey recovery e-mail links to
`{portal}/oauth/callback#token=…` (`MembershipPortalLinks.MagicLink`), where
`{portal}` is the project's Admin portal URL. The
same page handles it:

- the token is read from the fragment (then the query), taken out of the
  address bar and redeemed once with
  `api.membership.consumeMagicLink({ token })` on a client with **no**
  credentials (a recovering user often still has an old token);
- the answer is a **restricted** recovery session (`amr=MagicLink`, a
  15-minute access token, no refresh in the portal). Only its `accessToken`
  is stored, marked as a recovery; the link token and the refresh token never
  are;
- the user lands on Security with "You signed in with a recovery link": add a
  new passkey (the card asks for the e-mail, which this session cannot read,
  and proves it with the e-mailed code), or set a new password by e-mail
  (`/sign-in/reset`). Change password (needs the current one) and linking
  (needs the login id) are hidden for this session. Adding a passkey ends the
  recovery mark;
- refusals in plain words: expired or used (CM-ERRORS-PASSKEY-016), turned
  off for the project (-015), another environment
  (CM-ERRORS-MEMBERSHIP-USERS-049), too many attempts (429), and a link with
  no token.

The portal leads to a new passkey; it does not lock the other pages (the
gateway does not restrict the session either).
