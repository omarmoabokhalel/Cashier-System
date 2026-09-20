import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { PermissionCode, UserRoleCode } from '../../types/auth';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission?: PermissionCode;
  role?: UserRoleCode | UserRoleCode[];
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  role,
  fallback = null,
}) => {
  const { hasPermission, hasRole } = useAuthStore();

  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  if (role && !hasRole(role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
