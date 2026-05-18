import type { ReactNode } from 'react';
import { Navigate } from '@tanstack/react-router';
import { useAuthStore } from '../../stores/auth';
import { hasPermission, type Permission } from '../../lib/permissions';

interface RequirePermissionProps {
  perm: Permission;
  children: ReactNode;
}

export function RequirePermission({ perm, children }: RequirePermissionProps) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  if (!hasPermission(user?.role, perm)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
