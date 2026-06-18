import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/app/hooks';
import { selectIsAuthenticated } from './slice';
import { ROUTES } from '@/routes';

export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  if (!isAuthenticated) return <Navigate to={ROUTES.SIGN_IN} replace />;
  return <>{children}</>;
}
