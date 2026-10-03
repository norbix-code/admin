import { APIRequestContext, expect, request } from '@playwright/test';

/**
 * REST helpers for the stack spec (chat-stack.spec.ts): everything a
 * developer does on the dashboard before an end user can chat, done through
 * the Hub and Api routes of the gateway (ai/two-audiences), as the stack's
 * throwaway developer account. Every step is safe to repeat — a second run
 * finds what the first one made.
 *
 * Routes (gateway worktree, found with grep on `[Route(`):
 *   POST /v3/auth                                              Hub + Api sign-in (provider credentials)
 *   GET  /v3/account/projects/{id}                              ProjectDto (adminPortalServiceUserId, aiChat)
 *   POST /v3/ai/integrations/llms/                              SaveLlmIntegration { integration: { provider: "OpenAI", … } }
 *   GET  /v3/ai/integrations/llms/integrations                  the list (projection)
 *   GET/PUT /v3/account/projects/{id}/ai/settings               ProjectAiSettingsDto / UpdateProjectAiSettings — "Show AI chat"
 *   POST /v3/account/projects/{id}/ai/assistants                CreateProjectAiAssistant
 *   GET  /v3/membership/roles                                   the role list (name of "Admin Portal Manager")
 *   POST /v3/membership/auth/register/service                   a service-login user with roles (Api host)
 *   PUT  /v3/account/projects/{id}/settings/admin-portal/service-user   AssignAdminPortalServiceUser
 *   PUT  /v3/account/projects/{id}/admin-portal/enabled         SetAdminPortalEnabled
 *   POST /v3/membership/auth/register/email                     the end user (Api host)
 *   GET  /v3/public/projects/{id}/config                        what the portal reads at boot
 *   GET  /v3/account/projects/{id}/ai/usage                     tokens per user / assistant
 */

export const env = {
  base: process.env.E2E_BASE_URL ?? 'http://localhost:3100',
  hub: (process.env.E2E_HUB_URL ?? 'http://localhost:5001/v3').replace(/\/+$/, ''),
  api: (process.env.E2E_API_URL ?? 'http://localhost:5002/v3').replace(/\/+$/, ''),
  llm: (process.env.E2E_LLM_URL ?? 'http://llm.local.norbix.test:4010/v1').replace(/\/+$/, ''),
  user: process.env.E2E_USER ?? '',
  pass: process.env.E2E_PASS ?? '',
  projectId: process.env.E2E_PROJECT_ID ?? '',
};

export const ASSISTANT_NAME = 'Support';
export const LLM_NAME = 'Fake OpenAI (stack)';
export const LLM_MODEL = 'fake-model';
const SERVICE_USER_NAME = 'admin-portal-service';

/**
 * The end user of the test: a fresh identity per run (the stack database is
 * disposable anyway), so the usage test sees only this run's tokens and a
 * rerun never inherits a user registered with other roles.
 */
const RUN = Date.now().toString(36);
export const endUser = {
  email: `ada.${RUN}@example.test`,
  password: `Ada-${RUN}-2026!`,
  displayName: 'Ada Lovelace',
  firstName: 'Ada',
  lastName: 'Lovelace',
};

type Json = Record<string, unknown>;
type Reply = { status: number; json: Json };

const projectHeaders = (projectId: string) => ({
  'nb-project-id': projectId,
  'norbix-project-id': projectId,
  'x-cm-projectid': projectId,
});

/** One HTTP call; the body is parsed as JSON when it is JSON. */
async function call(
  ctx: APIRequestContext,
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  data?: unknown,
  headers?: Record<string, string>,
): Promise<Reply> {
  const res = await ctx.fetch(url, {
    method,
    headers: { accept: 'application/json', ...(data !== undefined ? { 'content-type': 'application/json' } : {}), ...(headers ?? {}) },
    ...(data !== undefined ? { data } : {}),
  });
  const text = await res.text();
  let json: Json = {};
  try {
    json = text ? (JSON.parse(text) as Json) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status(), json };
}

const errorsOf = (r: Reply): string =>
  JSON.stringify((r.json.responseStatus as Json | undefined) ?? r.json).slice(0, 600);

/** The gateway answers a refused command with HTTP 200 and isSuccess: false. */
const succeeded = (r: Reply): boolean =>
  r.status >= 200 && r.status < 300 && (r.json.responseStatus as Json | undefined)?.isSuccess !== false;

function must(r: Reply, what: string): Json {
  if (!succeeded(r)) throw new Error(`${what} failed: HTTP ${r.status} ${errorsOf(r)}`);
  return r.json;
}

/** Repeat `probe` until it returns a value (read models fill through projections). */
async function until<T>(what: string, probe: () => Promise<T | null | undefined | false>, timeoutMs = 45_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const v = await probe();
      if (v) return v;
      last = v;
    } catch (e) {
      last = e;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`timed out after ${timeoutMs / 1000}s waiting for ${what} (last: ${String(last)})`);
}

/** Every array of objects anywhere in a JSON body, flattened (list shapes differ per route). */
function rows(json: unknown): Json[] {
  const out: Json[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      for (const x of v) {
        if (x && typeof x === 'object' && !Array.isArray(x)) out.push(x as Json);
        walk(x);
      }
    } else if (v && typeof v === 'object') {
      for (const x of Object.values(v as Json)) walk(x);
    }
  };
  walk(json);
  return out;
}

export interface Developer {
  ctx: APIRequestContext;
  projectId: string;
  /** Hub call as the developer, project in the body / query (CodeMashRequestBase.ProjectId). */
  hub: (method: 'GET' | 'POST' | 'PUT', path: string, data?: Json) => Promise<Reply>;
  /** Api-host call as the developer, project in the headers (the Api host's global filter). */
  api: (method: 'GET' | 'POST' | 'PUT', path: string, data?: Json) => Promise<Reply>;
}

/** Sign the stack's developer account in on the Hub (cookie + bearer). */
export async function signInDeveloper(): Promise<Developer> {
  if (!env.user || !env.pass || !env.projectId) {
    throw new Error('E2E_USER, E2E_PASS and E2E_PROJECT_ID are required (the stack passes them — run `stack up` first)');
  }
  const anon = await request.newContext();
  const signIn = await until('the developer sign-in', async () => {
    const r = await call(anon, 'POST', `${env.hub}/auth`, { provider: 'credentials', userName: env.user, password: env.pass });
    return succeeded(r) && r.json.bearerToken ? r : null;
  });
  const bearer = String(signIn.json.bearerToken);
  const ctx = await request.newContext({
    extraHTTPHeaders: { authorization: `Bearer ${bearer}` },
    storageState: await anon.storageState(),
  });
  await anon.dispose();
  const projectId = env.projectId;
  return {
    ctx,
    projectId,
    hub: (method, path, data) =>
      call(
        ctx,
        method,
        method === 'GET' ? `${env.hub}${path}${path.includes('?') ? '&' : '?'}projectId=${projectId}` : `${env.hub}${path}`,
        data === undefined ? undefined : { projectId, ...data },
        projectHeaders(projectId),
      ),
    api: (method, path, data) => call(ctx, method, `${env.api}${path}`, data, projectHeaders(projectId)),
  };
}

export interface Prepared {
  projectId: string;
  llmIntegrationId: string;
  assistantId: string;
  serviceUserId: string;
  endUserId: string;
}

/** The project read model as the developer sees it. */
async function project(dev: Developer): Promise<Json> {
  return (must(await dev.hub('GET', `/account/projects/${dev.projectId}`), 'GET project').item as Json) ?? {};
}

async function aiSettings(dev: Developer): Promise<Json> {
  return (must(await dev.hub('GET', `/account/projects/${dev.projectId}/ai/settings`), 'GET ai settings').result as Json) ?? {};
}

/** 1. The LLM integration: OpenAI shape, endpoint = the stack's fake LLM, enabled, default. */
async function ensureLlm(dev: Developer): Promise<string> {
  const find = async () =>
    rows((await dev.hub('GET', '/ai/integrations/llms/integrations')).json).find(
      (x) => (x.integrationName ?? x.name) === LLM_NAME,
    );
  const existing = await find();
  if (existing) return String(existing.id ?? existing.viewId);
  const saved = must(
    await dev.hub('POST', '/ai/integrations/llms/', {
      integration: {
        provider: 'OpenAI',
        integrationName: LLM_NAME,
        isEnabled: true,
        isDefault: true,
        endpoint: env.llm,
        defaultModel: LLM_MODEL,
        apiKey: 'sk-fake-key-for-the-stack',
      },
    }),
    'SaveLlmIntegration',
  );
  const id = String(saved.id);
  await until('the LLM integration in the list', find);
  return id;
}

/** 2. The "Support" assistant with the own-data toolsets, default. */
async function ensureAssistant(dev: Developer): Promise<string> {
  const find = async () =>
    ((await aiSettings(dev)).assistants as Json[] | undefined)?.find((a) => a.name === ASSISTANT_NAME);
  const existing = await find();
  if (existing) return String(existing.id);
  const created = must(
    await dev.hub('POST', `/account/projects/${dev.projectId}/ai/assistants`, {
      name: ASSISTANT_NAME,
      welcomeMessage: 'Hi! Ask me about your account.',
      systemPrompt:
        'You help the signed-in user with their own account. For a question about the profile, call the profile tool and answer with the name and email it returns.',
      toolsets: ['own:records', 'own:profile'],
      isDefault: true,
      memoryEnabled: true,
    }),
    'CreateProjectAiAssistant',
  );
  await until('the Support assistant in the settings', find);
  return String(created.id);
}

/** 3. "Show AI chat" on (UpdateProjectAiSettings.Enabled) with the fake LLM as the project default. */
export async function setAiChat(dev: Developer, enabled: boolean, llmIntegrationId?: string): Promise<void> {
  const current = await aiSettings(dev);
  must(
    await dev.hub('PUT', `/account/projects/${dev.projectId}/ai/settings`, {
      enabled,
      defaultLlmIntegrationId: llmIntegrationId ?? current.defaultLlmIntegrationId ?? null,
      defaultModel: LLM_MODEL,
    }),
    `UpdateProjectAiSettings enabled=${enabled}`,
  );
  await until(`ai settings enabled=${enabled}`, async () => (await aiSettings(dev)).enabled === enabled);
  await until(`the public config aiChat.enabled=${enabled}`, async () => {
    const cfg = await publicConfig(dev.ctx, dev.projectId);
    return (cfg.aiChat as Json | undefined)?.enabled === enabled;
  });
}

/** 4. A service-login user holding the Admin Portal Manager role, assigned as the portal's service user. */
async function ensureServiceUser(dev: Developer): Promise<string> {
  const assigned = (await project(dev)).adminPortalServiceUserId;
  if (assigned) return String(assigned);
  const roles = rows((await dev.hub('GET', '/membership/roles')).json);
  const manager = roles.find((r) => r.displayName === 'Admin Portal Manager' || r.name === 'AdminPortalManager');
  if (!manager) throw new Error(`no "Admin Portal Manager" role in GET /membership/roles: ${JSON.stringify(roles.map((r) => r.name))}`);
  const created = must(
    await dev.api('POST', '/membership/auth/register/service', {
      userName: SERVICE_USER_NAME,
      password: `Svc-${dev.projectId.replace(/[^a-z0-9]/gi, '')}-2026!`,
      roles: [String(manager.name)],
      // CM-ERRORS-GENERIC-002 "Display name is not set" without it
      userGeneralInfo: { displayName: 'Admin Portal service' },
    }),
    'register the service user',
  );
  const serviceUserId = String(created.id);
  must(
    await dev.hub('PUT', `/account/projects/${dev.projectId}/settings/admin-portal/service-user`, { serviceUserId }),
    'AssignAdminPortalServiceUser',
  );
  await until('adminPortalServiceUserId on the project', async () => (await project(dev)).adminPortalServiceUserId === serviceUserId);
  return serviceUserId;
}

/** 5. The managed portal on. */
async function ensurePortalEnabled(dev: Developer): Promise<void> {
  if ((await project(dev)).adminPortalEnabled === true) return;
  must(await dev.hub('PUT', `/account/projects/${dev.projectId}/admin-portal/enabled`, { enabled: true }), 'SetAdminPortalEnabled');
  await until('adminPortalEnabled on the project', async () => (await project(dev)).adminPortalEnabled === true);
}

/**
 * 6. The end user, registered through the membership API (never a contact —
 * contacts carry roles [null]) WITH the built-in Authenticated role named
 * explicitly: registered through /register/email (no roles) the user showed
 * roles [null] and every /ai/chat call was refused ("Caller is missing
 * required permission 'ai:readOwn on ai:chat:all'"), although a new project's
 * DefaultRoles hold Authenticated (gateway Membership.cs:40) — see the item
 * file's Findings.
 */
async function ensureEndUser(dev: Developer): Promise<string> {
  must(
    await dev.api('POST', '/membership/auth/register/email-with-permissions', {
      email: endUser.email,
      password: endUser.password,
      roles: ['Authenticated'],
      userGeneralInfo: { displayName: endUser.displayName, firstName: endUser.firstName, lastName: endUser.lastName },
    }),
    'register the end user',
  );
  // the new login reaches the auth store through a projection: sign in until it works
  const anon = await request.newContext();
  try {
    const signIn = await until('the end user sign-in on the Api host', async () => {
      const r = await call(
        anon,
        'POST',
        `${env.api}/auth`,
        { provider: 'credentials', userName: endUser.email, password: endUser.password },
        projectHeaders(dev.projectId),
      );
      return succeeded(r) && r.json.bearerToken ? r : null;
    });
    // `userId` on the auth response is the auth store's numeric id; the usage
    // rows and the chat channel carry the `usr_…` auth id, which the bearer
    // token holds as the `cm_auth_id` claim.
    const token = String(signIn.json.bearerToken);
    const claims = JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()) as {
      cm_auth_id?: string;
    };
    return String(claims.cm_auth_id ?? signIn.json.userId ?? '');
  } finally {
    await anon.dispose();
  }
}

export async function publicConfig(ctx: APIRequestContext, projectId: string): Promise<Json> {
  return (await call(ctx, 'GET', `${env.api}/public/projects/${projectId}/config`, undefined, projectHeaders(projectId))).json;
}

export async function usage(dev: Developer): Promise<Json> {
  return (must(await dev.hub('GET', `/account/projects/${dev.projectId}/ai/usage`), 'GET ai usage').result as Json) ?? {};
}

/** The whole set-up, in the order the dashboard needs it. */
export async function prepareProject(dev: Developer): Promise<Prepared> {
  const llmIntegrationId = await ensureLlm(dev);
  const assistantId = await ensureAssistant(dev);
  await setAiChat(dev, true, llmIntegrationId);
  const serviceUserId = await ensureServiceUser(dev);
  await ensurePortalEnabled(dev);
  const endUserId = await ensureEndUser(dev);
  await until('the public config: portal on, chat on, one assistant', async () => {
    const cfg = await publicConfig(dev.ctx, dev.projectId);
    const chat = cfg.aiChat as Json | undefined;
    return cfg.adminPortalEnabled === true && chat?.enabled === true && ((chat?.assistants as Json[]) ?? []).length > 0;
  });
  expect(endUserId, 'the end user sign-in must return a userId').not.toBe('');
  return { projectId: dev.projectId, llmIntegrationId, assistantId, serviceUserId, endUserId };
}
