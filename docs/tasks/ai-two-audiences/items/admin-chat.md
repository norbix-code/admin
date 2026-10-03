# Item admin-chat — end-user AI chat in the Admin Portal
This file: /Users/djovaisas/Projects/norbix/worktrees/admin/ai/two-audiences/admin-chat/docs/tasks/ai-two-audiences/items/admin-chat.md (branch ai/two-audiences-admin-chat)

```
item worktree:  /Users/djovaisas/Projects/norbix/worktrees/admin/ai/two-audiences/admin-chat  (branch ai/two-audiences-admin-chat, made from admin ai/two-audiences at c6c4977)
campaign root:  /Users/djovaisas/Projects/norbix/worktrees/gateway/agitated-liskov-4feccf  (gateway, branch ai/two-audiences)   ← tracker docs/tasks/ai-two-audiences.md lives here
admin campaign: /Users/djovaisas/Projects/norbix/admin  (branch ai/two-audiences)
cloud source:   /Users/djovaisas/Projects/norbix/worktrees/cloud/ai/two-audiences/_campaign/src/features/aiChat  (read only)
tracker steps:  27 — feat(admin:chat): drawer, full screen, sessions, output factory, toolbar, memory, EventSource through the BFF proxy
                28 — fix(admin:proxy:headers): the proxy forwards the project header the API host reads, and streams SSE
```

## Goal
An end user of a tenant app chats with the project's assistant inside the Admin Portal, through the BFF proxy to the API-host `/{v}/ai/chat/*` endpoints, with streamed answers and the same output quality as the dashboard chat.
Not in scope: the AI settings UI (item T, cloud), RAG citation rendering (wave 4 adds a `citation` block kind), attachments upload UI, question / plan / run-step cards (developer-only entry kinds).

## Plan
1. [done] docs(admin:chat): this item file — plan and decisions before any code
2. [done] feat(admin:chat:output): output factory ported from the dashboard chat — markdown, code, mjml as code, norbix-view tree / table / json / yaml — with the cloud test fixtures as vitest + component tests   ref: tracker 27
3. [done] fix(admin:proxy:headers): the BFF proxy forwards the project header the API host reads, and streams server-sent events without buffering   ref: tracker 28
4. [done] feat(admin:config:ai-chat): read `aiChat` (enabled + assistants) from the public project config, so the launcher shows only when the project turned the chat on   ref: tracker 27, item N
5. [done] feat(admin:chat:state): RTK Query endpoints for `/ai/chat/*`, a chat slice, and a `fetch`-based stream reader (not `EventSource` — see Findings) that stops on 401 / 403 and reconnects only on network errors / 5xx   ref: tracker 27, prompt line 6
6. [done] feat(admin:chat:ui): launcher, drawer, full screen with session list (pin / archive / delete), entry toolbar (copy, like / dislike → feedback), memory panel, assistant picker when more than one assistant; icons inline   ref: tracker 27
7. [done] test(admin:chat:e2e): Playwright smoke — open the drawer, send a turn to a fake API host behind the real BFF proxy, see the answer stream in; like → feedback; full screen + memory; 403 → "chat unavailable", one stream request; two goldens, stable over two compare runs   ref: tracker 27
8. [done] test(admin:build): `npm run build`, `npm test`, lint and format check green; results recorded here
    `npm run build` → exit 0 (with one SDK copy linked, see Findings). `npm test` → 12 files, 79 tests passed. `npm run lint` → exit 0.
    `npm run test:e2e` → 3 passed, run 3 times after the goldens were last blessed (all 3 passed, 0 pixel diffs).
    `npm run format:check` → 9 files flagged, all already unformatted on the base commit c6c4977 (none is a file this item created; `projectConfig.ts` keeps its old lines) — see Findings.

Decisions (made, not open):
- decision(admin:deps): test tools only as dev dependencies — `@playwright/test` 1.61.1 (same as cloud, browsers already cached), `jsdom`, `@testing-library/react` + `/dom`. No new runtime dependency (README "Minimal by design").
- decision(admin:chat:ui): the chat reads the assistants from the public config (`aiChat`, id / name / welcome) and the default one from `GET /ai/chat/availability`; a pick in the assistant picker starts a new chat with that assistant (a session keeps the assistant it was opened with).
- decision(admin:chat:ui): end-user entry kinds only — `user.message`, `assistant.text` (through the output factory, with a typing cursor while it streams), `notice`; every other kind renders nothing. No attachments UI (the endpoint exists; not asked for).
- decision(admin:chat:e2e): the smoke uses a fake API host (a small Node server) BEHIND the real BFF proxy, not `page.route` mocks — `page.route` cannot stream a body, and this way the test also proves step 28 (the fake refuses any chat call without `nb-project-id` + bearer). Mutation check: with `nb-project-id` removed from the proxy list the first test fails (no reply).
- decision(admin:chat:output): the factory keeps the cloud file names and contracts (`blocks.ts`, `markdown.ts`, `OutputBlocks.tsx`) so wave 4 adds the `citation` kind the same way in both repos; the YAML dump moved to `yaml.ts` so it is testable alone and the component file exports components only.

## Changes
| file (absolute root: /Users/djovaisas/Projects/norbix/worktrees/admin/ai/two-audiences/admin-chat, branch ai/two-audiences-admin-chat) | what changed | step |
|------|--------------|------|
| docs/tasks/ai-two-audiences/items/admin-chat.md | this item file | 1, 8 |
| package.json, package-lock.json | dev dependencies `@playwright/test` 1.61.1, `jsdom`, `@testing-library/react` + `/dom`; scripts `test:e2e`, `test:e2e:update` | 2, 7 |
| vitest.config.ts | automatic JSX for component tests; `app/**/*.test.ts` included | 2, 3 |
| src/features/aiChat/output/blocks.ts, markdown.ts | ported as-is from cloud (comment: vitest) | 2 |
| src/features/aiChat/output/OutputBlocks.tsx, yaml.ts | renderer ported with `--admin-*` token classes, no `any`; YAML dump in its own module | 2 |
| src/features/aiChat/output/output.test.ts, OutputBlocks.test.tsx | cloud fixtures + view / yaml / XSS cases; component tests per block kind | 2 |
| app/api/proxy/[target]/[...path]/route.ts | forwards `nb-project-id` and `last-event-id`; aborts upstream when the browser leaves; SSE answers get `cache-control: no-cache, no-transform` + `x-accel-buffering: no` | 3 |
| app/api/proxy/[target]/[...path]/route.test.ts | proxy test against a real local upstream: headers forwarded / dropped, SSE streamed chunk by chunk | 3 |
| src/config/project.ts | `setProjectHeaders` — `nb-project-id` + `norbix-project-id` | 3 |
| src/services/api.ts, hub.ts, publicApi.ts | use `setProjectHeaders` instead of `X-Norbix-Project` | 3 |
| src/config/projectConfig.ts | header helper (3); `aiChat` read + `toAiChat` (4); public config fetched in dev builds too (7) | 3, 4, 7 |
| src/types/projectConfig.ts | `PublicAiChat`, `PublicAiAssistant`, `ProjectConfig.aiChat` | 4 |
| src/config/projectConfig.test.ts | `toAiChat` tests | 4 |
| src/features/project/slice.ts | `selectPublicAiChat` (off when absent) | 4, 6 |
| src/features/aiChat/types.ts | wire shapes of `/ai/chat/*` and the SSE envelope | 5 |
| src/features/aiChat/chatApi.ts | RTK Query endpoints injected into `api` (+ tags) | 5 |
| src/features/aiChat/slice.ts, slice.test.ts | transcript, turn, realtime status; late-token guard (7) | 5, 7 |
| src/features/aiChat/realtime.ts, realtime.test.ts | SSE parser + `ChatStream` (403 stop, backoff, heartbeat through the proxy) | 5 |
| src/features/aiChat/chatEffects.ts, useChatRealtime.ts | event routing, transcript load, send turn; stream lifecycle + offline polling | 5 |
| src/app/store.ts | `aiChat` reducer, not persisted | 5 |
| src/features/aiChat/icons.tsx | inline SVG icons | 6 |
| src/features/aiChat/entries/EntryView.tsx, EntryToolbar.tsx, copyText.ts, copyText.test.ts | message rows, copy / like / dislike with rollback | 6 |
| src/features/aiChat/chatPanel.tsx, chatDrawer.tsx, chatFullScreen.tsx, memoryPanel.tsx, launcher.tsx, hooks.ts, sortChatSessions.ts, launcher.test.tsx | drawer, full screen + sessions (pin / archive / delete with confirm), memory, assistant picker, launcher gate; active row colour (7) | 6, 7 |
| src/components/layouts.tsx | `<AiChatLauncher />` in the signed-in layout | 6 |
| tests/e2e/playwright.config.ts, fake-api-host.mjs, chat.spec.ts, chat.spec.ts-snapshots/*.png | Playwright smoke + 2 goldens | 7 |
| .gitignore | `test-results/`, `playwright-report/` | 7 |

## Findings
fix(admin:proxy:headers): the portal sends the project as `X-Norbix-Project`, a header the API host never reads — it reads `nb-project-id` (then host, query, body) — done in step 3
    where: /Users/djovaisas/Projects/norbix/worktrees/admin/ai/two-audiences/admin-chat/src/services/api.ts:31 (branch ai/two-audiences-admin-chat)   ref: tracker 28
```ts
// before — admin src/services/api.ts:28-34 (ai/two-audiences, c6c4977)
  const rawBaseQuery = fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers) => {
      if (projectId) headers.set('X-Norbix-Project', projectId);   // <-- here: no gateway code reads this name
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
```
```ts
// after — admin src/services/api.ts:28-33 + app/api/proxy/[target]/[...path]/route.ts:36-43 (ai/two-audiences-admin-chat)
  const rawBaseQuery = fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers) => {
      setProjectHeaders(headers, projectId);          // <-- nb-project-id + norbix-project-id (src/config/project.ts)
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
const FORWARD_REQUEST_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  …
  'nb-project-id',                                    // <-- added: the proxy dropped every header not on this list
```
```text
// the tests that prove it
// app/api/proxy/[target]/[...path]/route.test.ts — upstream sees nbProjectId 'pr_abc', authorization, last-event-id; no cookie, no x-norbix-project
// tests/e2e/chat.spec.ts — the fake API host refuses any /v3/ai/chat call without nb-project-id + bearer; badRequests: []
//   mutation check: 'nb-project-id' removed from FORWARD_REQUEST_HEADERS → "the drawer sends a turn…" fails (no reply)
```
```csharp
// gateway src/Isidos.CodeMash.Services.Api/CodeMashAppHostBase.cs:718-723 (ai/two-audiences, a563c8fe9)
            // 2️⃣ Request header (nb-project-id)
            if (!string.IsNullOrWhiteSpace(req.Headers[EventMetadataHeaderNames.ProjectId]))   // <-- the name the API host reads
            {
                var headerProjectIdResult =
                    req.Headers[EventMetadataHeaderNames.ProjectId]
                        .Required(ProjectIdMapper.Map, EventMetadataHeaderNames.ProjectId);
// src/Isidos.CodeMash.Domain/Statics/Modules.cs:21 — public const string ProjectId = "nb-project-id";
// `norbix-project-id` (AuthStatics.ProjectIdHeaderKey) is read only at sign-in (GatewayCredentialsAuthProvider.cs:136);
// `X-Norbix-Project` exists only as an OUTGOING webhook header (WebhookDeliveryClient.cs:38).
```

decision(admin:chat:realtime): the chat stream is read with `fetch` + a stream reader, not the browser `EventSource` — `EventSource` cannot send the bearer token, and the API host takes no token in the URL or a cookie; it also cannot see the 403 status the gateway answers for a refused channel — done in step 5   ref: prompt line 1 "native EventSource", line 6
    where: /Users/djovaisas/Projects/norbix/worktrees/gateway/agitated-liskov-4feccf/src/Isidos.CodeMash.Services.Api/Configure/Plugins/Auth/Gateway/GatewayAuth.cs:60 (branch ai/two-audiences)
```csharp
// gateway src/Isidos.CodeMash.Services.Api/Configure/Plugins/Auth/Gateway/GatewayAuth.cs:60-72 (ai/two-audiences, a563c8fe9)
                new AudienceScopedJwtAuthProvider() // JWT Token Authentication
                {
                        …
                        AuthKey = JwtAuthSecrets.From(jwtSettingsResult.Secrets).JwtKey,
                        Issuer = jwtSettingsResult.Integration.Issuer,
                        Audience = jwtSettingsResult.Integration.Audience,
                        RequireSecureConnection = generalSettings.General.IsProductionEnvironment,
                        UseTokenCookie = false,                                   // <-- no token cookie
                        // <-- missing: AllowInQueryString — so ?ss-tok= / ?access_token= are ignored
```
```csharp
// gateway src/Isidos.CodeMash.Services.Api/Configure/Plugins/ServerEvents.cs:42-50 (ai/two-audiences, a563c8fe9)
                StreamPath = "/event-stream", // The entry-point for Server Sent Events
                HeartbeatPath = "/event-heartbeat", // Where to send heartbeat pulses
                …
                LimitToAuthenticatedUsers = true,                                 // <-- the stream needs the bearer header
                // How long to wait for heartbeat before unsubscribing
                IdleTimeout = TimeSpan.FromSeconds(30),                           // <-- the client must POST heartbeats
```
```ts
// the reader — admin src/features/aiChat/realtime.ts:134 and :189-194 (ai/two-audiences-admin-chat)
const REFUSED = new Set([401, 403, 404]);
    if (REFUSED.has(res.status)) {
      // Pre-stream refusal (AiChatChannelRefused, expired login): stop.
      this.closed = true;                                  // <-- no retry
      this.opts.onStatus('refused');                       // <-- UI: "Chat unavailable. Reload the page to try again."
      return;
    }
// tests: realtime.test.ts "stops on 403" → statuses [connecting, refused], 1 request;
//        "reconnects after a 5xx and after a network error"; chat.spec.ts 403 case → streamRequests 1 after 3 s
```
The portal keeps the token in the Redux store (bearer), never in a cookie, so an `EventSource` would be refused. The reader in step 5 sends `Authorization`, reads the status (401 / 403 → stop and show "chat unavailable"; network error / 5xx → back off and reconnect), posts the ServiceStack heartbeat, and still goes through the BFF proxy.

fix(sdk-ts:sse): the SDK's realtime client reconnects forever on a 403 — it throws a plain `Error` for every non-2xx answer and the loop retries every error — not fixed here (SDK repo), moved out
    where: /Users/djovaisas/Projects/norbix/sdks/norbix-js/src/sse/client.ts:156 (branch main, bc3870c)
```ts
// sdks/norbix-js src/sse/stream.ts:50-52 (main, bc3870c)
  if (!res.ok) {
    throw new Error(`SSE connect failed: HTTP ${res.status} ${res.statusText}`);   // <-- here: the status is only in the text
  }
```
```ts
// sdks/norbix-js src/sse/client.ts:156-168 (main, bc3870c)
      } catch (err) {
        if (this.closed) break;
        this.errorHandler?.(err);
        …
      }

      if (this.closed || !this.reconnect.enabled) break;                              // <-- here: a 403 reconnects like a network drop
      await this.sleep(this.backoffMs());
      this.attempt += 1;
```
This is exactly the reconnect loop the gateway's pre-stream 403 (9bb1f360e) was made to stop, so the admin chat does not use this client (see the decision above).

fix(admin:config:public): in a dev build the portal never fetched the public project config, so brand, auth options and the AI chat switch were missing locally — the code does the opposite of its own comment — done in step 7 (found by the Playwright smoke: no chat button under `next dev`)
    where: /Users/djovaisas/Projects/norbix/worktrees/admin/ai/two-audiences/admin-chat/src/config/projectConfig.ts:263 (branch ai/two-audiences-admin-chat)
```ts
// before — admin src/config/projectConfig.ts:263-271 (ai/two-audiences-admin-chat, 45b8d35)
  const skipRemote = IS_DEV && !HAS_CUSTOM_HUB_BASE;   // <-- here: HAS_CUSTOM_HUB_BASE is always false → every dev build skips
  if (!skipRemote) {
    try {
      const remote = await loadDynamicConfig(projectId);
      if (remote) resolved = merge(resolved, remote);
```
```ts
// after — admin src/config/projectConfig.ts:262-268 (ai/two-audiences-admin-chat)
  // Always ask the endpoint, dev builds included: the same-origin proxy is
  // always there (env.ts). Skipping it in dev hid brand, auth and the AI chat.
  try {
    const remote = await loadDynamicConfig(projectId);
    if (remote) resolved = merge(resolved, remote);
```
```ts
// admin src/config/env.ts:94-96 — the stated intent
// Static-config skip-remote heuristic used `HAS_CUSTOM_HUB_BASE` before; with
// the proxy there is no custom hub base, so dynamic config always runs in dev.   // <-- intent: always fetch
export const HAS_CUSTOM_HUB_BASE = false;
```

chore(admin:build): `next build` fails type-checking on the base commit too — the admin links the local `norbix-js` (1.2.0) while the local `norbix-react-redux` resolves its own published `@norbix.ai/ts` 2.0.0, so two `Norbix` classes meet in `App.tsx` — not caused by this item; worked around locally, moved out
    where: /Users/djovaisas/Projects/norbix/worktrees/admin/ai/two-audiences/admin-chat/src/App.tsx:162 (branch ai/two-audiences-admin-chat)
```tsx
// admin src/App.tsx:158-162 (unchanged since c6c4977)
  return (
    // Re-key the provider on the token so `useNorbix()` consumers always see a
    // client carrying the current bearer token. RTK Query reads the client
    // lazily (getNorbixClient) so it's always current regardless.
    <NorbixProvider key={token ?? 'anon'} client={getNorbixClient()}>   // <-- here: TS2322, sdks/norbix-js/dist Norbix ≠ sdks/norbix-react-redux/node_modules/@norbix.ai/ts/dist Norbix
```
```text
// the same 4 errors with `tsc -p tsconfig.app.json` on a detached checkout of the base commit c6c4977 (scratchpad, removed after):
src/App.tsx(162,43): error TS2322 … norbix-js/dist/index").Norbix' is not assignable to … norbix-react-redux/node_modules/@norbix.ai/ts/dist/index").Norbix'
src/services/norbix.ts(101,48): error TS2322 … (same)
src/services/portalApi.ts(31,22) / (31,30): error TS6133 'result' / 'error' declared but never read   // tsc -b only; next build does not flag these
// local workaround (gitignored node_modules only): ln -sfn …/sdks/norbix-react-redux/node_modules/@norbix.ai/ts node_modules/@norbix.ai/ts → next build exit 0
```

chore(admin:ci): CI would fail before this item on two steps — `npm run typecheck` has no script, and `format:check` flags 9 files the base commit left unformatted — not fixed here (not this item's files), moved out
    where: /Users/djovaisas/Projects/norbix/worktrees/admin/ai/two-audiences/admin-chat/.github/workflows/ci.yml:38 (branch ai/two-audiences-admin-chat)
```yaml
# admin .github/workflows/ci.yml:37-38
      - name: Typecheck
        run: npm run typecheck        # <-- here: package.json has no "typecheck" script
```
```text
# npm run format:check on this branch — every flagged file is unchanged by this item except projectConfig.ts, whose flagged lines are the old ones
app/api/bootstrap/route.ts · app/api/structure/route.ts · src/components/forms/validators.test.ts · src/config/env.ts
src/config/projectConfig.ts · src/config/structure.ts · src/features/auth/passkeys.tsx · src/features/auth/passkeySignIn.tsx · src/features/auth/webauthn.ts
```

chore(admin:deps): `npm install` inside a worktree re-links the two local SDK packages (`file:../sdks/…`) to a folder that does not exist next to the worktree, so tests and the build cannot import `@norbix.ai/ts` — worked around locally, moved out
    where: /Users/djovaisas/Projects/norbix/worktrees/admin/ai/two-audiences/admin-chat/package.json:26 (branch ai/two-audiences-admin-chat)
```json
// admin package.json:26-27 (ai/two-audiences-admin-chat)
    "@norbix.ai/ts": "file:../sdks/norbix-js",                 // <-- here: ../sdks is /Users/…/worktrees/admin/ai/two-audiences/sdks from this worktree — missing
    "@norbix/react-redux": "file:../sdks/norbix-react-redux",
```
```text
// the error it gave (npx vitest run src/config) before the relink
Error: Cannot find package '@norbix.ai/ts' imported from …/admin-chat/src/config/project.ts
// local fix (gitignored node_modules only): ln -sfn /Users/djovaisas/Projects/norbix/sdks/norbix-js node_modules/@norbix.ai/ts
//                                           ln -sfn /Users/djovaisas/Projects/norbix/sdks/norbix-react-redux node_modules/@norbix/react-redux
```

## Rejected / moved out
- fix(sdk-ts:sse): stop the SDK realtime client on 401 / 403 (keep the status on the error) and send the ServiceStack heartbeat — moved out — reason: SDK repo, protected `main`, not this item — new ticket: none yet (tracker "Issues found" below)
- chore(admin:build): one `@norbix.ai/ts` for the admin and `norbix-react-redux` (link react-redux's dependency to the local `norbix-js`, or pin both to the published 2.0.0) — moved out — reason: SDK / workspace setup, fails on the base commit too — new ticket: none yet
- chore(admin:ci): add a `typecheck` script (`tsc -p tsconfig.app.json --noEmit`) and format the 9 old files — moved out — reason: not this item's files; a format-only commit would touch passkey / auth code other items own — new ticket: none yet
- chore(admin:proxy): the `[PROXY-DEBUG]` console line marked TEMP in the proxy route logs every upstream URL — not mine, untouched — new ticket: none yet
- gen(sdks:coverage): endpoint manifests + coverage matrix — not needed — reason: this item adds or changes no gateway endpoint (admin repo only)
- decision(admin:chat:ui): attachments upload, rename, citations (wave 4), settings UI (item T) — not in scope — new ticket: none
- chore(admin:deps): make `file:../sdks/…` resolve from a worktree (e.g. `worktrees/env/sync-env.sh` links `worktrees/admin/…/sdks` or the deps point at a published version) — moved out — reason: workspace tooling, not this item — new ticket: none yet

## Issues found (for the tracker, copy at merge)
- fix(sdk-ts:sse): the SDK realtime client reconnects forever on 403 and never posts heartbeats — todo — see Findings
- chore(admin:deps): `npm install` in an admin worktree breaks the local SDK links — todo — see Findings
- chore(admin:build): two `@norbix.ai/ts` copies break `next build` type-checking on the base commit — todo — see Findings
- chore(admin:ci): CI calls a missing `typecheck` script; 9 files fail `format:check` on the base commit — todo — see Findings
- fix(admin:config:public): dev builds never fetched the public project config — done in this item (step 7) — see Findings

## Needs you
- [ ] test(admin:chat): field test on a real API host — needs you · action: on the campaign gateway (ai/two-audiences) enable chat on project Test, add one assistant with the project LLM, run this worktree with `npm run dev` (NEXT_PUBLIC_ADMIN_PROJECT_ID = that project), sign in, open the chat, send "what is my profile?" and see the answer stream in
- [ ] chore(admin:build): pick one `@norbix.ai/ts` for admin + react-redux — needs you · action: until then `npm run build` needs `ln -sfn /Users/djovaisas/Projects/norbix/sdks/norbix-react-redux/node_modules/@norbix.ai/ts node_modules/@norbix.ai/ts` in the checkout that builds (the base commit fails the same way)
- [ ] docs(tracker): steps 27 and 28 → done at merge — needs you · action: copy this item's Done lines, Findings and "Issues found" into docs/tasks/ai-two-audiences.md on the gateway campaign branch

## Open questions
- none
