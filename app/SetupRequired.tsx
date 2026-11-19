// The page shown while the portal is not set up (PROJECT_ID or API_KEY is
// missing). A server component: it names the variable to fix and never shows
// a value. See app/lib/portalSetup.ts.
import type { SetupProblem } from './lib/portalSetup';

export default function SetupRequired({
  problems,
}: {
  problems: SetupProblem[];
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-app px-4 text-center">
      <h1 className="text-xl font-semibold text-fg">
        This portal is not set up yet
      </h1>
      <p className="mt-2 max-w-md text-sm text-fg-muted">
        The server that runs this portal is missing a setting. If you are the
        owner, fix the list below and restart the portal.
      </p>
      <ul className="mt-4 max-w-md space-y-2 text-left text-sm text-fg">
        {problems.map((problem) => (
          <li key={problem.variable} data-setup-missing={problem.variable}>
            <code className="font-semibold">{problem.variable}</code>
            {' — '}
            {problem.message}
          </li>
        ))}
      </ul>
      <p className="mt-4 max-w-md text-sm text-fg-muted">
        Both values are in Norbix Cloud, under Project Settings → Admin Portal.
        The steps are in the <code>README.md</code> of the portal, “Quick
        start”.
      </p>
    </main>
  );
}
