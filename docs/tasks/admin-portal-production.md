# Admin Portal on Managed Service production (Virginia + Frankfurt)
This file: /Users/djovaisas/Projects/norbix/admin/docs/tasks/admin-portal-production.md (branch main)

## Goal
An end user of a Managed Service project can open the project's Admin Portal and sign in, whether the project is processed in Virginia or in Frankfurt.
Not in scope: a second admin deployment per region, custom domains for the portal, social sign-in for a project of another region, the communication structure on the managed Preferences page, any deploy (the owner runs every deploy).

## What exists today (checked 2026-11-19, read-only)

| Thing | State | How it was checked |
|---|---|---|
| Admin image | built from `admin/deployments/Dockerfile` (one Next.js Node server, port 3100) by `devops/release/deploy-release.sh eks <version>`, from the `ms-v*` tag of this repo | `devops/staging/local-deploy.py:283`, `devops/production/eks-versions.yaml` (admin e11058dd7, ms-v2.6.16) |
| Admin pod | one `admin` Deployment, control region only (Virginia). Frankfurt runs `api` and `mq` only, by design | `devops/aws_cdk/lib/deployments/kubernetesManifests.ts:27` (`REGION_WORKLOADS`) |
| DNS + certificate | `admin.norbix.ai` and `*.admin.norbix.ai` resolve to the Virginia load balancer, the certificate covers both | `dig`, `curl https://pr-…​.admin.norbix.ai/` → 200; `devops/aws_cdk/lib/stacks/norbix/norbixBuilder.ts:496` |
| Ingress | `*.admin.norbix.ai` → Service `admin` | `devops/k8s/ingress/managed-service/production.yaml` |
| Portal address of a project | `https://pr-<32 hex>.admin.norbix.ai/` (`canonicalAdminUrl`), already in the project's allowed origins | `norbix project pr_Igqs1AfB4AZIwIJ7K9xgs --profile norbix-ai --prod --json` |
| Portal config | `HUB_BASE_URL=https://hub.norbix.ai`, `API_BASE_URL=https://api.norbix.ai`, no `API_KEY` | `devops/aws_cdk/lib/deployments/kubernetesManifests.ts:766`, `/api/bootstrap` answers `service-key-missing` |
| Hub `/echo` | announces `apiUrlTemplate: https://{projectHostLabel}.api.norbix.ai/v3` and `adminUrlTemplate` | `curl https://hub.norbix.ai/v3/echo` |
| Project API host | `pr-75af6526cea04a7486d4be6198c6e709.api.norbix.ai` is a DNS alias of `nb-eu-germany.api.norbix.ai` (Frankfurt) | `dig` |
| Gateway flags | `adminPortalEnabled` on the project and in the public config; the portal shows "unavailable" when it is false | `curl …/v3/public/projects/<id>/config`, `admin/src/App.tsx:111` |
| Production projects of the `norbix-ai` account | one: Class Fund, Frankfurt (`nb-eu-germany`), Admin Portal **off**. No Virginia project | `norbix account projects --profile norbix-ai --json` |

## Plan
1. [done] docs(admin:production): real state of the portal on production written down from code and read-only checks
2. [done] fix(admin:proxy): the portal backend calls a project's own API host on an install with regions, so a Frankfurt project can sign in
3. [done] chore(admin:proxy): the debug line that printed every proxied address to the pod log is removed
4. [done] docs(admin): backend.md, devops.md and README describe the per-project API host and what production really runs
5. [done] release(admin): pull request merged with nbx-ship — https://github.com/norbix-code/admin/pull/24 (squash, main)
6. [todo] release(production): the owner releases the admin image (commands under "Needs you")

## Changes
| file (absolute, branch main) | what changed | step |
|------|--------------|------|
| /Users/djovaisas/Projects/norbix/admin/app/lib/projectApi.ts | new: reads `apiUrlTemplate` from the Hub's `/echo` (kept 5 minutes), picks the project of a call, answers the API base for it | 2 |
| /Users/djovaisas/Projects/norbix/admin/src/config/projectApiHost.ts | new: builds `https://pr-<hex>.api.<domain>` from the template and a project id; null for anything else | 2 |
| /Users/djovaisas/Projects/norbix/admin/src/config/project.ts | new `hostLabelFromViewId`: `pr_<base62>` → `pr-<32 hex>` | 2 |
| /Users/djovaisas/Projects/norbix/admin/app/api/proxy/[target]/[...path]/route.ts | API calls use the project's host; debug log line removed | 2, 3 |
| /Users/djovaisas/Projects/norbix/admin/app/api/proxy/[target]/[...path]/route.projectHost.test.ts | new: 5 tests on an install with per-project hosts | 2 |
| /Users/djovaisas/Projects/norbix/admin/app/api/proxy/[target]/[...path]/route.internalApi.test.ts | new: a portal pointed at the API by an in-network address keeps that address | 2 |
| /Users/djovaisas/Projects/norbix/admin/app/api/proxy/[target]/[...path]/route.test.ts | the stand-in also answers `/echo` (no template), so the old tests make no call to the real Hub | 2 |
| /Users/djovaisas/Projects/norbix/admin/src/config/projectApiHost.test.ts, project.test.ts | new tests: .NET reference pairs both ways, the production project id, refusals | 2 |
| /Users/djovaisas/Projects/norbix/admin/docs/backend.md, docs/devops.md, README.md | per-project API host; what production runs | 4 |

## Findings

### Fixed

fix(admin:proxy): the portal backend sent every API call to the shared host, which refuses a Frankfurt project, so no end user of a Frankfurt project could sign in — done
    where: /Users/djovaisas/Projects/norbix/admin/app/api/proxy/[target]/[...path]/route.ts:81 (branch main)

```ts
// before — admin/app/api/proxy/[target]/[...path]/route.ts:24-27, 76-80 (main, e11058d)
const API_BASE = (process.env.API_BASE_URL ?? NORBIX_API_URL).replace(
  /\/$/,
  '',
);
function baseFor(target: string): string | null {
  if (target === 'api') return API_BASE;     // <-- here: always api.norbix.ai, whatever the project's region
  if (target === 'hub') return HUB_BASE;
  return null;
}
```
```ts
// after — same file:77-84
async function baseFor(
  target: string,
  req: NextRequest,
): Promise<string | null> {
  if (target === 'api') return apiBaseForProject(projectIdOf(req.headers));   // <-- the project's own host
  if (target === 'hub') return HUB_BASE;
  return null;
}
```
```ts
// admin/app/lib/projectApi.ts:101-108 — when the install does not fit, API_BASE_URL, as before
export async function apiBaseForProject(
  projectId: string | null | undefined,
): Promise<string> {
  if (!projectId) return API_BASE;
  const template = await apiUrlTemplate();
  if (!template || sharedApiHostOf(template) !== ownApiHost()) return API_BASE;   // <-- no template, or the portal reaches the API by another address
  return projectApiBase(template, projectId) ?? API_BASE;
}
```

The project host is used only when both are true: the Hub's `/echo` announces `apiUrlTemplate`, and `API_BASE_URL` is the shared host that template stands on (`api.norbix.ai` and `{label}.api.norbix.ai`). So:

| Install | `/echo` template | Portal's `API_BASE_URL` | After this change |
|---|---|---|---|
| production (norbix.ai) | yes | `https://api.norbix.ai` | project host |
| staging (norbix.io) | no (checked with `curl https://hub.norbix.io/v3/echo`) | — | unchanged |
| gateway Docker stack | no (`NORBIX_PROJECT_API_HOSTS` is not set anywhere in `gateway/deployments`) and an in-network address | `http://<item>.norbix.test:5002` | unchanged |
| a single-box install with the wildcard certificate (`devops/terraform/hostinger`, `NORBIX_PROJECT_API_HOSTS=on`) | yes | `https://api.<domain>` | project host, same public route the portal already uses |

Proof on production (a sign-in with a made-up user and a wrong password, nothing is changed by it):

```text
# before — the live portal, https://pr-75af6526cea04a7486d4be6198c6e709.admin.norbix.ai/api/proxy/api/v3/auth/credentials
[400] "Project 'pr_Igqs1AfB4AZIwIJ7K9xgs' is processed in region 'nb-eu-germany', not here.
       Send its requests to https://pr-75af6526cea04a7486d4be6198c6e709.api.norbix.ai."   errorCode CM-ERRORS-PROJECTS-040

# after — this branch built and run on the Mac with production's own settings
#         (HUB_BASE_URL=https://hub.norbix.ai API_BASE_URL=https://api.norbix.ai), the same call
[401] "Invalid Username or Password"        <-- Frankfurt now checks the password
```

Tests: `npx vitest run` → 33 files, 254 tests passed (13 new). `npm run typecheck`, `npm run lint`, `npm run build` passed.

chore(admin:proxy): a "temporary" debug line printed every proxied address, with its query string, to the production pod log — done
    where: /Users/djovaisas/Projects/norbix/admin/app/api/proxy/[target]/[...path]/route.ts:97 (branch main)

```ts
// before — admin/app/api/proxy/[target]/[...path]/route.ts:96-99 (main, e11058d); removed
  // TEMP DIAGNOSTIC (remove after debugging): prove which host the proxy
  // forwards to. ...
  console.log(`[PROXY-DEBUG] ${req.method} ${target} -> ${upstreamUrl}`);   // <-- here: every call, in production
```

### Found, not fixed

blocked(production:projects): the portal cannot be seen working for any project yet: the only project of the account is in Frankfurt and has the Admin Portal off, and there is no Virginia project — needs you
    where: `norbix account projects --profile norbix-ai --json` (one row: Class Fund, nb-eu-germany, adminPortalEnabled false)

decision(admin:regions): the end user of a Frankfurt project reaches Frankfurt through the portal pod in Virginia (browser → Virginia → Frankfurt), passwords included — needs you
    where: /Users/djovaisas/Projects/norbix/admin/docs/devops.md:20 (branch main)
    The other shape is an admin deployment in every region (pods, a certificate and a DNS name per region, more cost). Not built without a yes.

fix(gateway:brand): the project logo of Class Fund answers 404, so the portal shows the name without the picture — todo
    where: /Users/djovaisas/Projects/norbix/gateway/src/Application.Layer/Queries/Project/FetchPublicProjectBrandAssetQuery.cs:75 (branch refactoringV2)

```csharp
// gateway/src/Application.Layer/Queries/Project/FetchPublicProjectBrandAssetQuery.cs:72-78 (refactoringV2)
        var integrationId = IntegrationId.Parse(asset.IntegrationId);
        if (integrationId is null)
            return NotFound();

        var client = await filesClientAccessor.GetClient(request.ProjectId, integrationId, ct);   // <-- here: the anonymous call has no env, so PROD
        if (client.IsFailed)
            return NotFound();
```
```text
# the logo's integration int_6GznTSobAqVCzAOfYh15yR exists only in TEST
norbix files integrations --profile norbix-ai --project pr_Igqs1AfB4AZIwIJ7K9xgs --env PROD --json   → no integration
norbix files integrations --profile norbix-ai --project pr_Igqs1AfB4AZIwIJ7K9xgs --env TEST --json   → int_6GznTSobAqVCzAOfYh15yR (AwsS3)
curl https://pr-75af6526cea04a7486d4be6198c6e709.api.norbix.ai/v3/public/projects/pr_Igqs1AfB4AZIwIJ7K9xgs/brand/logo → 404 "This project has no public brand picture here."
```
    Quick way out for this project: upload the logo again with a PROD files integration. The rule for a brand picture kept in a TEST integration is a gateway decision. The logo address is also built on the shared host (`api.norbix.ai`), which answers the public config of a Frankfurt project today but was not proven for the picture.

feat(admin:preferences): on the Managed Service the Preferences page shows only the one marketing switch, never the topics the project defined — todo
    where: /Users/djovaisas/Projects/norbix/admin/app/api/bootstrap/route.ts:54 (branch main)

```ts
// admin/app/api/bootstrap/route.ts:54-58 (main)
  if (!hasServiceKey()) {
    // Without the key the backend can still serve the public brand/auth
    // (below), but not the privileged catalogs — flag it rather than 500.
    warnings.push('service-key-missing');      // <-- here: a managed pod never has a key
  }
```
```text
curl "https://pr-75af6526cea04a7486d4be6198c6e709.admin.norbix.ai/api/bootstrap?projectId=pr_Igqs1AfB4AZIwIJ7K9xgs"
{"…","marketingPreferences":null,"warnings":["service-key-missing","config-unavailable"]}
```
    Needs a gateway read of the communication structure that a signed-in end user (or anybody) may call on the API host. Not built here.

fix(admin:structure): on the Managed Service the menu always comes from the built-in default, because the portal asks the Hub for a route the gateway does not have — todo
    where: /Users/djovaisas/Projects/norbix/admin/app/api/structure/route.ts:90 (branch main)

```ts
// admin/app/api/structure/route.ts:88-91 (main)
      const headers: Record<string, string> = { accept: 'application/json' };
      if (NORBIX_ENV) headers['norbix-env'] = NORBIX_ENV;
      const url = `${HUB_BASE}/internal/admin-portal/structure?projectId=${encodeURIComponent(projectId)}`;   // <-- here: no such route
      const res = await fetch(url, { headers, cache: 'no-store' });
```
```text
grep -rnE '"/internal' gateway/src → only /internal/oidc/image-pull-token and /internal/_typegen
curl "https://hub.norbix.ai/internal/admin-portal/structure?projectId=pr_x" → 404
curl "https://pr-75af….admin.norbix.ai/api/structure?projectId=pr_Igqs1AfB4AZIwIJ7K9xgs" → default menu, "warnings":["structure-unavailable"], "adminPortalEnabled":true
```
    No harm today: the default menu is the same list the gateway would build, and "portal off" is read from the public config, not from here. One wasted call per page load.

fix(gateway:social): social sign-in (Google and others) for a Frankfurt project starts and comes back on the shared API host in Virginia — todo, not tested
    where: /Users/djovaisas/Projects/norbix/gateway/src/Isidos.CodeMash.Gateway.Api.Membership/Users/SocialSignIn.cs:303 (branch refactoringV2)

```csharp
// gateway/src/Isidos.CodeMash.Gateway.Api.Membership/Users/SocialSignIn.cs:293-297 (refactoringV2)
/// The "hop" of a browser sign-in start (round 3, step 18). The <c>nb_social</c> cookie is host-only and the callback
/// always comes to the PUBLIC API address (<see cref="SocialCallbackUrl"/>), so the cookie must be set on that host. A
/// start opened on another name of the gateway — the tenant host <c>pr-&lt;hex&gt;.api.&lt;domain&gt;</c>, a regional
/// host <c>nb-&lt;region&gt;.api.&lt;domain&gt;</c>, an alias — is first sent (302) to the SAME start on the public   // <-- here: always Virginia
/// address. ...
```
    Read from the code only; Class Fund has no social sign-in set up, so nothing could be tried. Password and passkey sign-in go through the proxy and are covered by the fix. Changing the callback address changes what a project registers at Google / Apple / GitHub, so it is a decision first.

docs(admin:proxy): every end user of every project reaches the API from the portal pod's few outgoing addresses, and the load balancer firewall limits requests per address — todo
    where: /Users/djovaisas/Projects/norbix/devops/aws_cdk/lib/deployments/webFirewall.ts:43 (branch main)
    The limit is 20 000 requests per 5 minutes per address (`NORBIX_WEB_FIREWALL_RATE_LIMIT`). Far away today; it becomes one shared budget for all portal users as traffic grows. It was the same before this change.

## Rejected / moved out
- decision(admin:social): the portal's social sign-in button keeps starting on the shared API host — rejected to change here — reason: the gateway sends any other host back to the shared one (finding above), so a portal change alone does nothing — new ticket: none yet
- decision(gateway:admin-portal-id): custom portal domains (`admin.customer.com`) need a Hub route `/v3/admin-portal-id` that the gateway does not have — moved out — reason: domains are the owner's call and not part of "works on production" — new ticket: none yet
- decision(devops:admin): no devops change — reason: pod, ingress, DNS and certificate already exist, the fix needs no new setting, and the pod may already call any public address (`devops/k8s/network-policies/managed-service/default-deny.yaml`, policy `allow-norbix-egress`)
- chore(admin:bootstrap): `/api/bootstrap` still asks the shared API host for the public config — left — reason: nothing reads that part of its answer, and without a key the call is not made

## Needs you
- [ ] release(production): put the fixed portal on production · action: run, in order, with the next free version (2.6.17 on 2026-11-19)
      `devops/release/deploy-release.sh tag 2.6.17` then `devops/release/deploy-release.sh eks 2.6.17`. No `stacks` run is needed for this fix.
      The admin image has no release of its own: a tag always takes gateway and cloud too. On 2026-11-19 that is 25 gateway and 12 cloud commits merged since ms-v2.6.16 (other sessions' work, some of it marked "not released" on purpose) — so this is your call on timing, not only a portal fix.
      `tag` refuses when staging does not run those gateway / cloud heads. Either run `devops/release/deploy-release.sh staging` first, or tag what staging already runs with `NORBIX_RELEASE_FROM_STAGING=1` in front, or tag heads staging never ran with `NORBIX_TAG_WITHOUT_STAGING=1` in front. The admin commit is always the newest `main`.
- [ ] blocked(production:projects): a project to look at · action: say which project may have its Admin Portal turned on (`norbix project admin-portal enable --profile norbix-ai --project <id>`; it makes a public sign-in page), or make a test project in Frankfurt and one in Virginia
- [ ] decision(admin:regions): Frankfurt end users go through the Virginia portal pod · action: say "fine" or ask for an admin deployment per region
- [ ] decision(gateway:social): social sign-in for projects outside Virginia · action: say if it is needed now

## How to check after the deploy
```bash
# 1. the image is the new one (the admin line shows the new commit)
grep -A3 "admin:" /Users/djovaisas/Projects/norbix/devops/production/eks-versions.yaml

# 2. a Frankfurt project: wrong password must answer 401 "Invalid Username or Password", not 400 CM-ERRORS-PROJECTS-040
curl -sS -X POST "https://pr-75af6526cea04a7486d4be6198c6e709.admin.norbix.ai/api/proxy/api/v3/auth/credentials" \
  -H 'content-type: application/json' -H 'norbix-project-id: pr_Igqs1AfB4AZIwIJ7K9xgs' \
  -d '{"userName":"nobody@example.com","password":"wrong-not-real"}'

# 3. the project's portal address, region and on/off switch
norbix project <project id> --profile norbix-ai --prod --json | grep -E '"(canonicalAdminUrl|apiHost|adminPortalEnabled)"|"id": "nb-'

# 4. a Virginia project: the same call as 2 with its own host label and id must answer 401 too
```
Then the browser walk (yours, or mine with your say and a test user): open `canonicalAdminUrl`, sign in, open Profile, Security, Preferences, sign out.

## Open questions
- none that block the merged work
