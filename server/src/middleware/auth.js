import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { hasCompatibleLegacyRole, loadUserAccess } from '../services/permissionService.js';

export const verifyToken = async (req, res, next) => {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'يلزم تسجيل الدخول', code: 'AUTH_REQUIRED' });

    const decoded = jwt.verify(token, getJwtSecret());
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, is_active, account_status, full_name')
      .eq('id', decoded.id)
      .maybeSingle();
    if (error) return next(error);
    if (!user || !user.is_active || user.account_status !== 'active') {
      return res.status(401).json({ error: 'الحساب غير متاح', code: 'ACCOUNT_DISABLED' });
    }

    req.user = await loadUserAccess(user);
    if (!req.user.isActive) return res.status(401).json({ error: 'الحساب غير متاح', code: 'ACCOUNT_DISABLED' });
    return next();
  } catch {
    return res.status(401).json({ error: 'انتهت صلاحية الجلسة أو التوكن غير صالح', code: 'INVALID_TOKEN' });
  }
};

// Compatibility bridge for routes that remain on the legacy role vocabulary.
export const requireRole = (roles) => (req, res, next) => {
  if (!hasCompatibleLegacyRole(req.user, roles)) {
    return res.status(403).json({ error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء', code: 'ROLE_FORBIDDEN' });
  }
  return next();
};

export const requireAuth = verifyToken;
