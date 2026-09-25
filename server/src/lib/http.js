import { supabaseAdmin } from '../config/supabase.js';

export class AppError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const asyncHandler = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

export function requireFields(payload, fields) {
  for (const field of fields) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      throw new AppError(400, `الحقل ${field} مطلوب`, 'REQUIRED_FIELD');
    }
  }
}

export function pageRange(page = 1, limit = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  return { page: safePage, limit: safeLimit, from: (safePage - 1) * safeLimit, to: safePage * safeLimit - 1 };
}

export async function audit(userId, action, entityType, entityId, details = {}) {
  const { error } = await supabaseAdmin.from('activity_log').insert({
    user_id: userId || null,
    action,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    details
  });
  if (error) console.error(JSON.stringify({ event: 'audit_write_failed', action, code: error.code }));
}

export async function notify(userId, type, title, message, relatedOrderId = null) {
  if (!userId) return;
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    related_order_id: relatedOrderId
  });
  if (error) console.error(JSON.stringify({ event: 'notification_write_failed', type, code: error.code }));
}

export function safeError(error) {
  if (error instanceof AppError) return error;
  console.error(JSON.stringify({
    event: 'unhandled_error',
    name: error?.name,
    code: error?.code,
    message: error?.message
  }));
  return new AppError(500, 'تعذر إتمام العملية حالياً. يرجى المحاولة لاحقاً.', 'INTERNAL_ERROR');
}

export function errorMiddleware(error, req, res, next) {
  const safe = safeError(error);
  res.status(safe.status).json({ error: safe.message, code: safe.code });
}

export function notFound(req, res) {
  res.status(404).json({ error: 'مسار API غير موجود', code: 'ROUTE_NOT_FOUND' });
}

export async function merchantForUser(userId) {
  const { data, error } = await supabaseAdmin
    .from('merchants')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const normalizeArabic = (value = '') => value.trim().toLocaleLowerCase('ar');
