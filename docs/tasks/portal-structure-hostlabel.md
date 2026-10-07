# Admin portal — communication structure, privacy page, managed host label, F37–F40
This file: /Users/djovaisas/Projects/norbix/admin/docs/tasks/portal-structure-hostlabel.md (branch main, after the merge; worked on in branch fix/portal-structure-hostlabel)

## Goal
Make the end-user portal render what Cloud defines (communication structure, legal docs), stop calling endpoints that do not exist, and resolve the managed `pr-<hex>` host.
Not in scope: gateway changes (the canonical admin URL builder, a compliance API, 2FA, end-user `membership:update`) and the public docs repo — listed under Findings / Needs you.

## Plan
1. [done] feat(admin:preferences): render the project's channels → groups → tags (Cloud's Communication Preferences) with per-delivery switches, not one marketing switch
2. [done] fix(admin:privacy): hide the Privacy & data page and nav until /me/compliance* exist; drop "two-factor" from the Home Security card
3. [done] fix(admin:project): read the managed host label pr-<32 hex> (ProjectId.HostLabel) and turn it into the pr_<base62> id the gateway expects
4. [done] fix(admin:auth): use the usr_ login id (JWT claim cm_auth_id) for Profile, Preferences and Passkeys   ref: F37
5. [done] fix(admin:auth): no empty "or continue with"; Terms / Privacy links filled; reset form says "sent" only on success   ref: F38
6. [done] chore(admin:docker): ARG NEXT_PUBLIC_ADMIN_PROJECT_ID (and CONFIG_MODE) in the build stage, checked with a real docker build   ref: F39
7. [done] fix(admin:structure): self-hosted backend calls /v3/account/projects/{projectId}/admin-portal/structure with the service-user key   ref: F40
8. [done] docs(admin): README + docs/README, login-resolution, features, devops, backend updated for the host label, hidden privacy page, preferences
9. [doing] release(admin): pull request merged with nbx-ship

## Changes
| file (absolute, branch main after merge) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/admin/src/features/preferences/communication.ts | new: Cloud structure → view model; blockedTags helpers | 1 |
| /Users/djovaisas/Projects/norbix/admin/src/features/preferences/communication.test.ts | new: 7 tests | 1 |
| /Users/djovaisas/Projects/norbix/admin/src/features/preferences/preferences.tsx | tabs, groups, tags, per-delivery switches, Other options, global switch | 1 |
| /Users/djovaisas/Projects/norbix/admin/src/services/portalApi.ts | getBootstrap endpoint (/api/bootstrap) | 1 |
| /Users/djovaisas/Projects/norbix/admin/src/config/structure.ts | PRIVACY_PAGE_ENABLED=false; Security card "Password and passkeys." | 2 |
| /Users/djovaisas/Projects/norbix/admin/src/config/structure.test.ts | new: 3 tests | 2 |
| /Users/djovaisas/Projects/norbix/admin/src/components/layouts.tsx | Privacy nav item behind the flag | 2 |
| /Users/djovaisas/Projects/norbix/admin/src/App.tsx | /privacy route behind the flag; comment | 2, 3 |
| /Users/djovaisas/Projects/norbix/admin/src/config/project.ts | pr-<hex> host label → pr_<base62> (viewIdFromHex) | 3 |
| /Users/djovaisas/Projects/norbix/admin/src/config/project.test.ts | .NET reference pairs + host cases (10 tests) | 3 |
| /Users/djovaisas/Projects/norbix/admin/src/features/dashboard/dashboard.tsx | placeholder text shows pr-<id> | 3 |
| /Users/djovaisas/Projects/norbix/admin/src/features/auth/loginId.ts | new: cm_auth_id claim → usr_ id | 4 |
| /Users/djovaisas/Projects/norbix/admin/src/features/auth/loginId.test.ts | new: 6 tests | 4 |
| /Users/djovaisas/Projects/norbix/admin/src/features/auth/slice.ts | signedIn / selectUserId use resolveLoginId | 4 |
| /Users/djovaisas/Projects/norbix/admin/src/features/profile/profile.tsx | skip the user query until a usr_ id exists | 4 |
| /Users/djovaisas/Projects/norbix/admin/src/features/auth/passkeys.tsx | same | 4 |
| /Users/djovaisas/Projects/norbix/admin/src/features/auth/login.tsx | showPasskey needs WebAuthn; useLegalLinks | 5 |
| /Users/djovaisas/Projects/norbix/admin/src/features/auth/passwordReset.tsx | "sent" only on success, error alert | 5 |
| /Users/djovaisas/Projects/norbix/admin/src/features/auth/signInScreens.test.tsx | new: 5 component tests | 5 |
| /Users/djovaisas/Projects/norbix/admin/src/services/publicApi.ts | project id from the store (custom domains) | 5 |
| /Users/djovaisas/Projects/norbix/admin/deployments/Dockerfile | build args NEXT_PUBLIC_ADMIN_PROJECT_ID / CONFIG_MODE | 6 |
| /Users/djovaisas/Projects/norbix/admin/app/api/structure/route.ts | self-hosted path via SDK getAdminPortalStructure | 7 |
| /Users/djovaisas/Projects/norbix/admin/app/api/structure/route.test.ts | new: local Hub server checks path + bearer | 7 |
| /Users/djovaisas/Projects/norbix/admin/README.md, docs/{README,login-resolution,features,devops,backend}.md | host label, preferences, hidden privacy, Next build args | 8 |

## Findings

fix(admin:project): the portal read `pr_<base62>` from the host; browsers lower-case it, so the id was wrong and the portal showed "Portal unavailable" — done
    where: /Users/djovaisas/Projects/norbix/admin/src/config/project.ts (branch main after merge)
```ts
// before — admin/src/config/project.ts:19,44-48 (main before)
const PR_PREFIX = /^pr_([0-9A-Za-z]+)$/;          // <-- here: '_' + mixed case, not a DNS label
export function parseProjectIdFromHost(host: string): string | null {
  const firstLabel = host.split('.')[0] ?? '';
  const match = PR_PREFIX.exec(firstLabel);
  return match ? match[1] : null;
}
```
```csharp
// the gateway contract — gateway/src/Isidos.CodeMash.Domain/BoundContext/Project/ValueObjects/ProjectId.cs:76-77 (refactoringV2)
public string HostLabel =>
    $"{HostLabelPrefix}-{Value.ToString("N").ToLowerInvariant()}";   // pr-<32 hex>
```
```ts
// after — admin/src/config/project.ts (fix/portal-structure-hostlabel)
const HOST_LABEL = /^pr-([0-9a-f]{32})$/i;
export function parseProjectIdFromHost(host: string): string | null {
  const firstLabel = host.split(':')[0].split('.')[0] ?? '';
  const match = HOST_LABEL.exec(firstLabel);
  return match ? viewIdFromHex(match[1]) : null;   // <-- same steps as Base62Converter; tested vs .NET output
}
```

fix(admin:auth): Profile, Preferences and Passkeys used the numeric /auth userId ("2"); /membership/auth/{id} needs the usr_ login id — done   ref: F37
    where: /Users/djovaisas/Projects/norbix/admin/src/features/auth/loginId.ts (branch main after merge)
```ts
// before — admin/src/features/auth/login.tsx:76-79 (main before)
if (res.bearerToken) {
  dispatch(
    signedIn({ token: res.bearerToken, userId: res.userId ?? '' }),   // <-- here: ServiceStack UserAuthId "2"
  );
}
```
```csharp
// where the real id is — gateway/src/Isidos.CodeMash.Services.Api/Configure/Plugins/Auth/Gateway/GatewayAuth.cs:85-90 (refactoringV2)
CreatePayloadFilter = (payload, session) =>
{
    if (session is CodeMashUserSession { CodeMashUserAuth: { } userAuth })
    {
        if (!string.IsNullOrEmpty(userAuth.AuthId))
            payload["cm_auth_id"] = userAuth.AuthId;               // <-- usr_… login id in the JWT
```

fix(admin:auth): the reset form said "a reset link is on its way" even when the call failed — done   ref: F38
    where: /Users/djovaisas/Projects/norbix/admin/src/features/auth/passwordReset.tsx (branch main after merge)
```tsx
// before — admin/src/features/auth/passwordReset.tsx:25-31 (main before)
const onSubmit = async (values: { email: string }) => {
  try {
    await request({ email: values.email }).unwrap();
  } finally {
    setSent(true);              // <-- here: runs on failure too
  }
};
```

fix(admin:structure): the self-hosted backend called a route that does not exist — done   ref: F40
    where: /Users/djovaisas/Projects/norbix/admin/app/api/structure/route.ts (branch main after merge)
```ts
// before — admin/app/api/structure/route.ts:80-84 (main before)
if (isSelfHosted) {
  headers.authorization = `Bearer ${API_KEY}`;
  headers['x-cm-projectid'] = projectId;
  url = `${HUB_BASE}/${HUB_VERSION}/admin-portal/structure`;   // <-- here: no such route
```
```csharp
// gateway/src/Isidos.CodeMash.Gateway.Hub.Account/Project/Settings/AdminPortalStructure.cs:27-29 (refactoringV2)
[Authenticate]
[Route("/{version}/account/projects/{projectId}/admin-portal/structure", "GET",
    Summary = "Admin Portal layout/structure for the project's service user")]
```

fix(admin:legal): publicApi read the project with resolveProjectId(), which misses custom domains (their id comes from the async host lookup) — done
    where: /Users/djovaisas/Projects/norbix/admin/src/services/publicApi.ts (branch main after merge)
```ts
// before — admin/src/services/publicApi.ts:41-44 (main before)
getLegalDocument: builder.query<LegalDocument, 'terms' | 'privacy'>({
  query: (kind) => ({
    url: `/public/projects/${resolveProjectId()}/legal/${kind}`,   // <-- here: null on a custom domain
```

blocked(gateway:project:admin-url): the gateway still builds the canonical admin URL with the pr_ ViewId, so Cloud, emails (@Model.Project.AdminUrl) and the CORS seed hand out an address a browser cannot use — needs you
    where: /Users/djovaisas/Projects/norbix/gateway/src/Isidos.CodeMash.Domain/ValueObjects/DomainUrl.cs:204 (branch refactoringV2)   action: use projectId.HostLabel there (and fix the comment in Hub.Account.Persistent/Project.cs:46)
```csharp
// gateway/src/Isidos.CodeMash.Domain/ValueObjects/DomainUrl.cs:203-204 (refactoringV2)
var safeScheme = string.IsNullOrWhiteSpace(scheme) ? Uri.UriSchemeHttps : scheme;
return Create($"{safeScheme}://{projectId.ViewId}.{suffix}");   // <-- here: pr_<base62>, should be HostLabel
```

blocked(admin:preferences): on the managed service the backend has no API_KEY, so /api/bootstrap returns no structure and the page falls back to the global marketing switch — needs you
    where: /Users/djovaisas/Projects/norbix/admin/app/api/bootstrap/route.ts:91 (branch main)   action: gateway — carry NotificationSettingsDto in AdminPortalStructureDto / the internal structure endpoint
```ts
// admin/app/api/bootstrap/route.ts:91-97 (main)
try {
  // The marketing-preference STRUCTURE rides on the project read model
  // (NotificationSettings). We return only the catalog, never any user's
  // values.
  const projectResp = await client.hub.account.getProject({ projectId });   // <-- only with the service key
  out.marketingPreferences = projectResp.item?.notificationSettings ?? null;
```

## Rejected / moved out
- decision(admin:privacy): hide the page behind PRIVACY_PAGE_ENABLED instead of deleting compliance.tsx / complianceService.ts — rejected (delete) — reason: the screen comes back once Cloud + gateway define the flows — new ticket: none
- decision(admin:docs): docs/architecture.md and docs/agreements.md still describe the canonical `pr_{id}.admin.{host}` — moved out — reason: they describe the gateway's current URL builder (blocked line above); change them with that gateway fix
- not mine, untouched: /Users/djovaisas/Projects/norbix/admin/node_modules points @norbix.ai/ts at ../sdks/norbix-js and has no @norbix.ai/react-redux, so `npm run typecheck` fails in the main checkout; the worktree used a clean `npm ci`

## Needs you
- [ ] blocked(gateway:project:admin-url): canonical admin URL must use ProjectId.HostLabel — needs you · action: gateway task (DomainUrl.cs:204)
- [ ] blocked(gateway:admin-portal:structure): add the communication structure to the managed structure endpoint — needs you · action: gateway task
- [ ] blocked(gateway:compliance): /me/compliance, /export, /delete do not exist; Cloud must define the privacy flows first — needs you · action: product decision + gateway task, then set PRIVACY_PAGE_ENABLED = true
- [ ] docs(codemash-docs:admin): the public admin/* pages describe the old behaviour — needs you · action: see the list in the final report

## Open questions
- none
