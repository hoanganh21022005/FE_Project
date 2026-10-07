import React from 'react';
import { ForbiddenView } from '../views/ForbiddenView.js';

/**
 * G1.4: Guard for authentication state.
 * Prevents rendering protected content if authLoading is in progress or user is not logged in.
 */
export function RequireAuth({
  isAuthenticated,
  authLoading,
  children,
  fallback = null,
}) {
  if (authLoading) {
    return React.createElement(
      'div',
      { className: 'min-h-screen bg-stone-950 text-stone-200 flex flex-col items-center justify-center gap-3 text-sm' },
      React.createElement('div', { className: 'w-8 h-8 border-2 border-[#BA0000] border-t-transparent rounded-full animate-spin' }),
      React.createElement('p', { className: 'font-medium tracking-wide' }, 'Đang kiểm tra phiên đăng nhập...')
    );
  }

  if (!isAuthenticated) {
    return fallback;
  }

  return children;
}

/**
 * G1.4: Guard for role-based authorization.
 * If user does not possess one of the allowedRoles, blocks rendering of children
 * and displays ForbiddenView instead.
 */
export function RequireRole({
  allowedRoles = [],
  currentRole = '',
  attemptedPath = '',
  children,
  fallback = null,
  onForbidden = null,
}) {
  const allowed = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const hasAccess = Boolean(currentRole && allowed.includes(currentRole));

  if (!hasAccess) {
    if (fallback) {
      return fallback;
    }
    return React.createElement(ForbiddenView, {
      currentRole,
      allowedRoles: allowed,
      attemptedPath,
      onGoHome: onForbidden,
    });
  }

  return children;
}

/**
 * G1.4: Guard for specific granular permission check.
 */
export function RequirePermission({
  permission,
  authorities = [],
  children,
  fallback = null,
}) {
  const hasPermission = authorities.includes(permission) || authorities.includes('*');

  if (!hasPermission) {
    return fallback || React.createElement(ForbiddenView, {
      message: `Bạn thiếu quyền hạn yêu cầu (${permission}) để thực hiện thao tác này.`,
    });
  }

  return children;
}
