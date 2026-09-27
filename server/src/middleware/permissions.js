import { can, canAll, canAny } from '../services/permissionService.js';

const denied = (res, code = 'PERMISSION_FORBIDDEN') => res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء', code });

export const requirePermission = (permission) => (req, res, next) => {
  if (!can(req.user, permission)) return denied(res);
  return next();
};

export const requireAnyPermission = (permissions) => (req, res, next) => {
  if (!canAny(req.user, permissions)) return denied(res, 'ANY_PERMISSION_REQUIRED');
  return next();
};

export const requireAllPermissions = (permissions) => (req, res, next) => {
  if (!canAll(req.user, permissions)) return denied(res, 'ALL_PERMISSIONS_REQUIRED');
  return next();
};
