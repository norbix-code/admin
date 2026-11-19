# Norbix Admin Portal — documentation

This folder documents the **Admin Portal** (the *end-user portal*): the
ready-made, self-service portal that a Norbix project's **end users** (the
developer's customers) sign in to. To get it running, start with the
[quick start in the root README](../README.md).

| Doc | What it covers |
| --- | --- |
| [`architecture.md`](./architecture.md) | The full picture: the four surfaces (Hub, API, Cloud, Admin), how Admin fits, who hosts it, where the project id comes from. |
| [`backend.md`](./backend.md) | The portal's own backend: the two required variables, the setup screen, `/api/bootstrap`, `/api/structure`, the proxy, the service user's key. |
| [`login-resolution.md`](./login-resolution.md) | How the sign-in screen is built — dynamic (public config) vs static (bundled JSON) config, the resolution order, and caching. |
| [`social-sign-in.md`](./social-sign-in.md) | Social sign-in, linking an account, PKCE, the passkey recovery link. |
| [`theming.md`](./theming.md) | Change colours, fonts and components. |
| [`features.md`](./features.md) | The feature areas: Auth management, Profile / contact info, Communication preferences (rendered from Cloud's structure), Compliance / privacy (hidden until the gateway has it). |
| [`devops.md`](./devops.md) | The Docker image, running on a Node host, what to put in front of it. |
| [`sdk-local-development.md`](./sdk-local-development.md) | Trying an SDK change before it is published. |
| [`implementation-plan.md`](./implementation-plan.md), [`agreements.md`](./agreements.md), [`public-config-endpoint.md`](./public-config-endpoint.md), [`tasks/`](./tasks) | History: the build plan, design agreements and task notes. Some describe earlier designs. |

## One-paragraph summary

The Admin Portal is one Next.js app, open source (MIT). **You host it** on
your own address (for example `admin.example.com`); Norbix does not host it.
One copy serves **one project**: the server variable `PROJECT_ID` names the
project and `API_KEY` holds the key of the project's Admin Portal service
user. The browser talks only to the portal's own backend, which calls the
Norbix Hub and API. The portal asks for the project's public settings and
renders the right sign-in screen (email/password, social sign-in, passkeys,
branding). Signed-in users manage their **auth** (password, passkeys),
**profile** (contact info) and **communication preferences**; the public terms
& policies pages need no sign-in. Compliance (data export, account deletion)
is hidden until the gateway has its endpoints.
