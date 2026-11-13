import { APIRequestContext, Page, expect, request } from '@playwright/test';
import {
  Developer,
  Json,
  Reply,
  call,
  ensurePortalEnabled,
  ensureServiceUser,
  env,
  must,
  projectHeaders,
  publicConfig,
  signInDeveloper,
  succeeded,
  until,
} from './stack-lib';

/**
 * Shared set-up for the Membership stack specs (password-change-required,
 * security-password, recovery-link, social-sign-in): the real gateway in a
 * running stack, the portal's real BFF proxy. Each spec prepares its own data
 * through REST, like chat-stack.spec.ts; every step is safe to repeat.
 *
 * Routes (gateway worktree, `[Route(` grep):
 *   PUT  /v3/membership/authorization/password-complexity          UpdatePasswordComplexity (Hub)
 *   GET  /v3/membership/authorization                              passwordComplexity (Hub)
 *   POST /v3/membership/auth/register/email                        the end user (Api host)
 *   POST /v3/auth                                                  project password sign-in (Api host)
 *   POST /v3/membership/userauth/password/change                   own password (Api host)
 *   GET  /v3/membership/auth/{id}                                  own record (Api host)
 */

/** A fresh suffix per run: the stack database is disposable, a rerun never meets old users. */
export const RUN = Date.now().toString(36);

/** The developer signed in, the service user assigned and the portal on. */
export async function preparePortal(): Promise<Developer> {
  const dev = await signInDeveloper();
  await ensureServiceUser(dev);
  await ensurePortalEnabled(dev);
  await until('the public config says the portal is on', async () => (await publicConfig(dev.ctx, dev.projectId)).adminPortalEnabled === true);
  return dev;
}

/** The project's stored password rule (GET /membership/authorization). */
export async function storedMinLength(dev: Developer): Promise<number | undefined> {
  const r = must(await dev.hub('GET', '/membership/authorization'), 'GET authorization');
  return ((r.result as Json | undefined)?.passwordComplexity as Json | undefined)?.minLength as number | undefined;
}

/** Store MinLength `n` (nothing else) and wait until the Hub reads it back. */
export async function setMinLength(dev: Developer, n: number): Promise<void> {
  must(await dev.hub('PUT', '/membership/authorization/password-complexity', { minLength: n }), `UpdatePasswordComplexity minLength=${n}`);
  await until(`the stored password rule minLength=${n}`, async () => (await storedMinLength(dev)) === n);
}

/** Anonymous Api-host call with the project headers. */
export async function apiCall(method: 'GET' | 'POST', path: string, data?: Json, headers?: Record<string, string>): Promise<Reply> {
  const ctx = await request.newContext();
  try {
    return await call(ctx, method, `${env.api}${path}`, data, { ...projectHeaders(env.projectId), ...(headers ?? {}) });
  } finally {
    await ctx.dispose();
  }
}

/** Project password sign-in on the Api host (what the portal's proxy forwards). */
export const apiSignIn = (userName: string, password: string) =>
  apiCall('POST', '/auth', { provider: 'credentials', userName, password });

export interface EndUser {
  email: string;
  password: string;
  id: string;
}

/**
 * The end user, from the membership API (`/membership/auth/register/email`,
 * never a contact). Sent as the developer: the same route and command
 * (RegisterUserCommand) as a public sign-up, but outside the anonymous
 * sign-up limit (10 an hour per caller, `PasskeyRateLimit(AnonymousOnly)`),
 * which a few reruns would use up. Waits until the login can sign in (the
 * auth store is filled through a projection).
 */
export async function registerEndUser(dev: Developer, email: string, password: string): Promise<EndUser> {
  const reg = must(await dev.api('POST', '/membership/auth/register/email', { email, password }), `register ${email}`);
  await until(`${email} can sign in`, async () => {
    const r = await apiSignIn(email, password);
    return succeeded(r) && r.json.bearerToken ? r : null;
  });
  return { email, password, id: String(reg.id) };
}

/** A bearer token's claims (no signature check — the gateway already checked it). */
export function claimsOf(token: string): Json {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as Json;
}

/** The portal's own sign-in form (email + password through the BFF proxy). */
export async function fillPortalSignIn(page: Page, userName: string, password: string): Promise<void> {
  await page.goto('/');
  await page.locator('input[name="userName"]').fill(userName);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
}

/** The persisted auth slice of the portal (redux-persist, key `persist:norbix-admin`). */
export async function portalAuth(page: Page): Promise<Json> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('persist:norbix-admin');
    if (!raw) return {};
    const root = JSON.parse(raw) as Record<string, string>;
    return root.auth ? (JSON.parse(root.auth) as Record<string, unknown>) : {};
  });
}

/** Wait until the portal has persisted a token different from `previous`. */
export async function waitForPortalToken(page: Page, previous?: string | null): Promise<string> {
  let token = '';
  await expect
    .poll(async () => {
      token = String((await portalAuth(page)).token ?? '');
      return token !== '' && token !== 'null' && token !== previous;
    }, { message: 'the portal stored a (new) session token', timeout: 30_000 })
    .toBe(true);
  return token;
}

/** Every value the page keeps in localStorage and sessionStorage, as one string. */
export async function allBrowserStorage(page: Page): Promise<string> {
  return page.evaluate(() => {
    const dump = (s: Storage) => {
      const out: string[] = [];
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i)!;
        out.push(`${k}=${s.getItem(k)}`);
      }
      return out.join('\n');
    };
    return `${dump(window.localStorage)}\n${dump(window.sessionStorage)}`;
  });
}

/** The error code of a refused gateway answer. */
export const errorCodeOf = (r: Reply): string | undefined =>
  (((r.json.responseStatus as Json | undefined)?.errors as Json[] | undefined)?.[0]?.errorCode as string | undefined) ?? undefined;

export type { APIRequestContext, Developer, Json, Reply };
