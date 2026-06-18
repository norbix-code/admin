// Clean-room layouts. Original markup (see components/ui.tsx for the
// licensing note).

import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  HomeIcon,
  UserIcon,
  ShieldIcon,
  BellIcon,
  DocCheckIcon,
  SignOutIcon,
} from './icons';
import { DropdownMenu } from './ui';
import { ROUTES } from '@/routes';
import { useAppDispatch } from '@/app/hooks';
import { reset } from '@/features/auth/slice';
import { useLogoutMutation } from '@/services/norbix';

export function AuthLayout({
  children,
  brandName,
  logoUrl,
}: {
  children: ReactNode;
  brandName?: string;
  logoUrl?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-4">
      <div className="w-full max-w-md rounded-token-lg bg-surface p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center">
          {logoUrl ? (
            <img src={logoUrl} alt={brandName} className="h-10" />
          ) : (
            <span className="text-lg font-semibold text-brand">
              {brandName ?? 'Norbix'}
            </span>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

const NAV = [
  { to: ROUTES.HOME, label: 'Home', icon: HomeIcon },
  { to: ROUTES.PROFILE, label: 'Profile', icon: UserIcon },
  { to: ROUTES.SECURITY, label: 'Security', icon: ShieldIcon },
  { to: ROUTES.PREFERENCES, label: 'Preferences', icon: BellIcon },
  { to: ROUTES.PRIVACY, label: 'Privacy', icon: DocCheckIcon },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [logout] = useLogoutMutation();

  const handleSignOut = async () => {
    try {
      await logout().unwrap();
    } catch {
      /* ignore network errors on sign-out */
    }
    dispatch(reset());
    navigate(ROUTES.SIGN_IN);
  };

  return (
    <div className="flex min-h-screen bg-app">
      <aside className="flex w-60 flex-col border-r border-border-token bg-surface">
        <div className="px-6 py-5 text-lg font-semibold text-brand">
          Account
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === ROUTES.HOME}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-token px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-brand/10 text-brand'
                    : 'text-fg-muted hover:bg-app',
                ].join(' ')
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="m-3">
          <DropdownMenu
            actions={[{ label: 'Sign out', onSelect: handleSignOut }]}
            trigger={
              <span className="flex items-center gap-3 rounded-token px-3 py-2 text-sm font-medium text-fg-muted hover:bg-app">
                <SignOutIcon className="h-5 w-5" />
                Account
              </span>
            }
          />
        </div>
      </aside>
      <main className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
