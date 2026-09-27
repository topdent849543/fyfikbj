import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../lib/http.js';

export const SYSTEM_ROLE_KEYS = Object.freeze([
  'platform_owner', 'platform_admin', 'company_manager', 'company_admin', 'platform_driver', 'company_driver', 'customer'
]);

export function normalizeAssignments(assignments = []) {
  return assignments
    .filter((assignment) => assignment?.is_active !== false && assignment?.role?.is_active !== false)
    .map((assignment) => ({
      id: assignment.id,
      roleId: assignment.role_id,
      roleKey: assignment.role?.key || assignment.role_key,
      roleNameAr: assignment.role?.name_ar || assignment.role_name_ar,
      companyId: assignment.company_id || null,
      scopeType: assignment.scope_type,
      permissions: (assignment.role?.role_permissions || assignment.permissions || [])
        .map((entry) => entry.permission?.key || entry.key)
        .filter(Boolean)
    }))
    .filter((assignment) => assignment.roleKey);
}

export function buildAccessContext(user, assignments = []) {
  const activeAssignments = normalizeAssignments(assignments);
  const roles = [...new Set(activeAssignments.map((assignment) => assignment.roleKey))];
  const permissions = [...new Set(activeAssignments.flatMap((assignment) => assignment.permissions))];
  const companyIds = [...new Set(activeAssignments.map((assignment) => assignment.companyId).filter(Boolean))];
  const isPlatformOwner = roles.includes('platform_owner');
  const hasGlobalScope = isPlatformOwner || activeAssignments.some((assignment) => assignment.scopeType === 'global');

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name || user.fullName,
    role: user.role || 'customer', // Legacy primary role kept for existing routes.
    roles,
    permissions,
    roleAssignments: activeAssignments.map(({ permissions: ignored, ...assignment }) => assignment),
    companyIds,
    scopeType: hasGlobalScope ? 'global' : 'company',
    accountStatus: user.account_status || (user.is_active ? 'active' : 'inactive'),
    isActive: Boolean(user.is_active) && (user.account_status || 'active') === 'active',
    isPlatformOwner,
    hasGlobalScope
  };
}

export async function loadUserAccess(user) {
  const { data, error } = await supabaseAdmin
    .from('user_role_assignments')
    .select('id, user_id, role_id, company_id, scope_type, is_active, role:roles(key, name_ar, is_active, role_permissions(permission:permissions(key)))')
    .eq('user_id', user.id)
    .eq('is_active', true);
  if (error) throw error;
  return buildAccessContext(user, data || []);
}

export function can(actor, permission) {
  return Boolean(actor?.isPlatformOwner || actor?.permissions?.includes(permission));
}

export function canAny(actor, permissions) {
  return Boolean(actor?.isPlatformOwner || permissions.some((permission) => actor?.permissions?.includes(permission)));
}

export function canAll(actor, permissions) {
  return Boolean(actor?.isPlatformOwner || permissions.every((permission) => actor?.permissions?.includes(permission)));
}

export function hasCompatibleLegacyRole(actor, expectedRoles) {
  if (!actor) return false;
  // Legacy routes preserve the original primary-role behavior only. New RBAC
  // assignments must use permission-protected routes and cannot inherit old APIs.
  return expectedRoles.includes(actor.role);
}

export function canAccessCompany(actor, companyId) {
  if (!actor || !companyId) return false;
  return Boolean(actor.isPlatformOwner || actor.hasGlobalScope || actor.companyIds?.includes(companyId));
}

export function assertCanAccessCompany(actor, companyId) {
  if (!canAccessCompany(actor, companyId)) {
    throw new AppError(403, 'لا تملك صلاحية الوصول إلى بيانات هذه الشركة', 'COMPANY_SCOPE_FORBIDDEN');
  }
}

export function assertAssignableScope({ roleKey, scopeType, companyId }) {
  const companyRoles = new Set(['company_manager', 'company_admin', 'company_driver']);
  const globalRoles = new Set(['platform_owner', 'platform_admin', 'platform_driver', 'legacy_platform_operator']);
  if (companyRoles.has(roleKey) && (scopeType !== 'company' || !companyId)) {
    throw new AppError(400, 'هذا الدور يجب أن يرتبط بشركة واحدة ونطاق شركة', 'COMPANY_ASSIGNMENT_REQUIRED');
  }
  if (globalRoles.has(roleKey) && (scopeType !== 'global' || companyId)) {
    throw new AppError(400, 'هذا الدور يجب أن يستخدم نطاق المنصة العام', 'GLOBAL_ASSIGNMENT_REQUIRED');
  }
}

export async function getRoleWithPermissions(roleId) {
  const { data, error } = await supabaseAdmin
    .from('roles')
    .select('id, key, name_ar, is_system, is_active, role_permissions(permission_id, permission:permissions(key))')
    .eq('id', roleId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'الدور غير موجود', 'ROLE_NOT_FOUND');
  return data;
}

export function assertCanGrantRole(actor, role) {
  if (role.key === 'platform_owner') {
    throw new AppError(403, 'لا يمكن إنشاء أو تعيين المدير العام عبر API. استخدم bootstrap الآمن.', 'PLATFORM_OWNER_PROTECTED');
  }
  if (actor?.isPlatformOwner) return;
  const requestedPermissions = (role.role_permissions || []).map((entry) => entry.permission?.key).filter(Boolean);
  if (!requestedPermissions.every((permission) => actor?.permissions?.includes(permission))) {
    throw new AppError(403, 'لا يمكنك منح دور يتضمن صلاحيات لا تملكها', 'ROLE_ESCALATION_BLOCKED');
  }
}
