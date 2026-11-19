// What the portal needs before it can run: PROJECT_ID and API_KEY.
//
// Both come from the server environment and from nowhere else. There is no
// fallback: not the address the portal is opened at, not a header, not a
// query value. When one is missing the page shows the setup screen
// (app/SetupRequired.tsx), the backend routes answer 503, and the server logs
// one line.
import { runtimeProjectId } from './runtimeProject';

export interface SetupProblem {
  /** The environment variable to fix. */
  variable: 'PROJECT_ID' | 'API_KEY';
  /** What is wrong with it, in plain words. Never holds the value. */
  message: string;
}

export interface PortalSetup {
  /** The configured project (`pr_…`), or null when PROJECT_ID is missing or wrong. */
  projectId: string | null;
  /** The service user's API key, or null when API_KEY is missing. Server only. */
  apiKey: string | null;
  /** Empty when the portal is set up. */
  problems: SetupProblem[];
}

type Env = Record<string, string | undefined>;

/** Pure: the setup an environment gives. */
export function readPortalSetup(env: Env): PortalSetup {
  const problems: SetupProblem[] = [];

  const rawProjectId = env.PROJECT_ID?.trim() ?? '';
  const projectId = runtimeProjectId(rawProjectId);
  if (!rawProjectId) {
    problems.push({
      variable: 'PROJECT_ID',
      message: 'PROJECT_ID is not set. Set it to the id of your project.',
    });
  } else if (!projectId) {
    problems.push({
      variable: 'PROJECT_ID',
      message:
        'PROJECT_ID is not a project id. It starts with "pr_", for example pr_5R4dlqJeXx943tOzSDEwbS.',
    });
  }

  const apiKey = env.API_KEY?.trim() || null;
  if (!apiKey) {
    problems.push({
      variable: 'API_KEY',
      message:
        'API_KEY is not set. Set it to the API key of the Admin Portal service user.',
    });
  }

  return { projectId, apiKey, problems };
}

let logged = false;

/** The setup of this server. Logs the problems once per process. */
export function portalSetup(): PortalSetup {
  const setup = readPortalSetup(process.env);
  // Not while `next build` renders its static pages: a build has no settings.
  const building = process.env.NEXT_PHASE === 'phase-production-build';
  if (setup.problems.length > 0 && !logged && !building) {
    logged = true;
    console.error(
      `[admin-portal] Not set up: ${setup.problems
        .map((p) => p.message)
        .join(' ')} See README.md, "Quick start".`,
    );
  }
  return setup;
}

/** The setup when it is complete; null (after the log line) when it is not. */
export function readyPortalSetup(): {
  projectId: string;
  apiKey: string;
} | null {
  const { projectId, apiKey, problems } = portalSetup();
  if (problems.length > 0 || !projectId || !apiKey) return null;
  return { projectId, apiKey };
}

/** What a backend route answers while the portal is not set up. */
export function notSetUpResponse(): Response {
  const { problems } = readPortalSetup(process.env);
  return Response.json(
    {
      error: 'portal-not-set-up',
      missing: problems.map((p) => p.variable),
      message: problems.map((p) => p.message).join(' '),
    },
    { status: 503, headers: { 'cache-control': 'no-store' } },
  );
}

/** Tests only: let the log line be written again. */
export function resetSetupLogForTests(): void {
  logged = false;
}
