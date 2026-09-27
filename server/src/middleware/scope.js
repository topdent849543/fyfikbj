import { AppError } from '../lib/http.js';
import { canAccessCompany } from '../services/permissionService.js';

export const requireScope = (scopeType) => (req, res, next) => {
  if (scopeType === 'global' && !req.user?.hasGlobalScope) {
    return res.status(403).json({ error: 'هذه العملية تتطلب نطاق المنصة العام', code: 'GLOBAL_SCOPE_REQUIRED' });
  }
  return next();
};

export const requireCompanyScope = (getCompanyId) => (req, res, next) => {
  const companyId = typeof getCompanyId === 'function' ? getCompanyId(req) : req.params.companyId || req.params.id || req.body?.companyId;
  if (!companyId || !canAccessCompany(req.user, companyId)) {
    return res.status(403).json({ error: 'لا تملك صلاحية الوصول إلى بيانات هذه الشركة', code: 'COMPANY_SCOPE_FORBIDDEN' });
  }
  return next();
};

export function assertCompanyScope(actor, companyId) {
  if (!canAccessCompany(actor, companyId)) throw new AppError(403, 'لا تملك صلاحية الوصول إلى بيانات هذه الشركة', 'COMPANY_SCOPE_FORBIDDEN');
}

export function applyCompanyScope(query, actor, column = 'merchant_id') {
  if (actor?.isPlatformOwner || actor?.hasGlobalScope) return query;
  if (!actor?.companyIds?.length) return query.in(column, ['00000000-0000-0000-0000-000000000000']);
  return query.in(column, actor.companyIds);
}
