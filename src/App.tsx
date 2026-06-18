import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NorbixProvider } from '@norbix/react-redux';
import { ROUTES } from '@/routes';
import { resolveProjectIdAsync } from '@/config/project';
import { loadProjectConfig, applyBranding } from '@/config/projectConfig';
import type { ProjectConfig } from '@/types/projectConfig';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { hub } from '@/services/hub';
import { echoResolved } from '@/config/slice';
import {
  projectConfigResolved,
  projectResolved,
} from '@/features/project/slice';
import { setRuntimeApiRoot } from '@/config/runtimeApi';
import {
  getNorbixClient,
  setNorbixApiBase,
  setNorbixToken,
  setNorbixProjectId,
} from '@/services/norbix';
import { Spinner } from '@/components/ui';
import { AppLayout } from '@/components/layouts';
import { RequireAuth } from '@/features/auth/requireAuth';
import { Login } from '@/features/auth/login';
import {
  PasswordResetRequest,
  PasswordResetConfirm,
} from '@/features/auth/passwordReset';
import { OAuthCallback } from '@/features/auth/callback';
import { SecurityOverview } from '@/features/auth/security';
import { Profile } from '@/features/profile/profile';
import { Preferences } from '@/features/preferences/preferences';
import { Privacy } from '@/features/compliance/compliance';
import { LegalDocumentPage } from '@/features/compliance/legal';
import { Dashboard, Placeholder } from '@/features/dashboard/dashboard';

type BootState =
  | { status: 'loading' }
  | { status: 'no-project' }
  | { status: 'echo-failed' }
  | { status: 'ready'; config: ProjectConfig };

export default function App() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);

  // Keep the SDK client's bearer token in sync with the auth slice.
  useEffect(() => {
    setNorbixToken(token ?? undefined);
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      // Resolve the project: pin → pr_ subdomain → meta → custom-domain host
      // lookup against the managed service. Async because the custom-domain
      // path calls hub.norbix.ai/admin-portal-id.
      const projectId = await resolveProjectIdAsync();
      if (cancelled) return;
      if (!projectId) {
        setBoot({ status: 'no-project' });
        return;
      }
      dispatch(projectResolved(projectId));
      // Let the SDK client be built for this project on first use.
      setNorbixProjectId(projectId);

      // Discover endpoints/regions/release from the Hub's /echo. This is
      // REQUIRED — the API base comes only from echo (no env fallback), so if
      // echo fails the portal cannot make API calls and shows an error rather
      // than a broken half-loaded UI.
      try {
        const echo = await dispatch(hub.endpoints.echo.initiate()).unwrap();
        if (cancelled) return;
        dispatch(echoResolved(echo));
        setRuntimeApiRoot(echo);
        if (!echo.apiUrl) {
          setBoot({ status: 'echo-failed' });
          return;
        }
        setNorbixApiBase(echo.apiUrl, echo.apiVersion);
      } catch {
        if (!cancelled) setBoot({ status: 'echo-failed' });
        return;
      }
      if (cancelled) return;

      // Resolve brand + auth config (defaults → endpoint override, or
      // static-only per CONFIG_MODE). Always returns a usable config.
      const config = await loadProjectConfig(projectId);
      if (cancelled) return;
      applyBranding(config);
      dispatch(projectConfigResolved(config));
      setBoot({ status: 'ready', config });
    };

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  if (boot.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    );
  }

  if (boot.status === 'no-project') {
    return <Placeholder />;
  }

  if (boot.status === 'echo-failed') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-lg font-medium text-fg">Service unavailable</p>
        <p className="text-sm text-fg-muted">
          Could not reach the service to load this portal. Please try again
          shortly.
        </p>
      </div>
    );
  }

  const { config } = boot;

  return (
    // Re-key the provider on the token so `useNorbix()` consumers always see a
    // client carrying the current bearer token. RTK Query reads the client
    // lazily (getNorbixClient) so it's always current regardless.
    <NorbixProvider key={token ?? 'anon'} client={getNorbixClient()}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path={ROUTES.SIGN_IN} element={<Login config={config} />} />
          <Route
            path={ROUTES.PASSWORD_RESET}
            element={<PasswordResetRequest />}
          />
          <Route
            path={ROUTES.PASSWORD_RESET_CONFIRM}
            element={<PasswordResetConfirm />}
          />
          <Route path={ROUTES.OAUTH_CALLBACK} element={<OAuthCallback />} />
          <Route
            path={ROUTES.LEGAL_TERMS}
            element={<LegalDocumentPage kind="terms" />}
          />
          <Route
            path={ROUTES.LEGAL_PRIVACY}
            element={<LegalDocumentPage kind="privacy" />}
          />
          {/* Short public aliases → canonical /legal/* routes. */}
          <Route
            path={ROUTES.TERMS_ALIAS}
            element={<Navigate to={ROUTES.LEGAL_TERMS} replace />}
          />
          <Route
            path={ROUTES.POLICIES_ALIAS}
            element={<Navigate to={ROUTES.LEGAL_PRIVACY} replace />}
          />

          {/* Authed */}
          <Route
            path={ROUTES.HOME}
            element={
              <RequireAuth>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path={ROUTES.PROFILE}
            element={
              <RequireAuth>
                <AppLayout>
                  <Profile />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path={ROUTES.SECURITY}
            element={
              <RequireAuth>
                <AppLayout>
                  <SecurityOverview />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path={ROUTES.PREFERENCES}
            element={
              <RequireAuth>
                <AppLayout>
                  <Preferences />
                </AppLayout>
              </RequireAuth>
            }
          />
          <Route
            path={ROUTES.PRIVACY}
            element={
              <RequireAuth>
                <AppLayout>
                  <Privacy />
                </AppLayout>
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
        </Routes>
      </BrowserRouter>
    </NorbixProvider>
  );
}
