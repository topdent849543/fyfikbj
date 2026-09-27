import { supabaseAdmin } from '../config/supabase.js';
import { AppError, audit, notify } from './http.js';
import { can, canAny, canAccessCompany } from '../services/permissionService.js';
import { ensureInvoiceForOrder } from '../services/invoiceService.js';

export const ORDER_TRANSITIONS = Object.freeze({
  new: ['pending_review', 'cancelled'],
  pending_review: ['approved', 'rejected', 'cancelled'],
  approved: ['preparing', 'cancelled'],
  preparing: ['ready_for_delivery', 'cancelled'],
  ready_for_delivery: ['assigned_to_driver', 'cancelled'],
  assigned_to_driver: ['in_delivery', 'failed_delivery', 'needs_follow_up', 'cancelled'],
  in_delivery: ['arrived', 'failed_delivery', 'needs_follow_up'],
  arrived: ['delivered', 'failed_delivery', 'needs_follow_up'],
  delivered: ['final_review', 'needs_follow_up', 'awaiting_payment'],
  final_review: ['completed', 'needs_follow_up'],
  needs_follow_up: ['ready_for_delivery', 'failed_delivery', 'final_review', 'cancelled'],
  failed_delivery: ['needs_follow_up', 'ready_for_delivery', 'cancelled'],
  completed: ['archive'],
  // Existing orders may still be in these states; retain safe bridge transitions.
  awaiting_payment: ['payment_received', 'final_review'],
  payment_received: ['completed', 'final_review'],
  rejected: [],
  cancelled: [],
  archive: []
});

const LEGACY_ROLE_TRANSITIONS = Object.freeze({
  customer: { new: ['cancelled'], pending_review: ['cancelled'] },
  merchant: { approved: ['preparing'], preparing: ['ready_for_delivery'] },
  manager: { new: ['pending_review'], pending_review: ['approved', 'rejected'], preparing: ['ready_for_delivery'], ready_for_delivery: ['assigned_to_driver'], awaiting_payment: ['payment_received'], payment_received: ['completed'], final_review: ['completed'], completed: ['archive'] },
  admin: Object.fromEntries(Object.entries(ORDER_TRANSITIONS).map(([from, next]) => [from, next])),
  driver: { assigned_to_driver: ['in_delivery'], in_delivery: ['arrived'], arrived: ['delivered'], delivered: ['final_review'] }
});

const TRANSITION_PERMISSIONS = Object.freeze({
  pending_review: ['orders.review'],
  approved: ['orders.approve'],
  rejected: ['orders.reject'],
  cancelled: ['orders.cancel'],
  preparing: ['orders.change_status'],
  ready_for_delivery: ['orders.change_status'],
  assigned_to_driver: ['orders.assign_driver'],
  in_delivery: ['orders.confirm_delivery'],
  arrived: ['orders.confirm_delivery'],
  delivered: ['orders.confirm_delivery'],
  final_review: ['orders.confirm_delivery', 'orders.final_review'],
  completed: ['orders.final_review'],
  archive: ['orders.archive'],
  failed_delivery: ['orders.change_status', 'orders.confirm_delivery'],
  needs_follow_up: ['orders.change_status', 'orders.confirm_delivery'],
  awaiting_payment: ['orders.confirm_payment'],
  payment_received: ['orders.confirm_payment']
});

export function roleCanTransition(role, from, to) {
  return Boolean(ORDER_TRANSITIONS[from]?.includes(to) && LEGACY_ROLE_TRANSITIONS[role]?.[from]?.includes(to));
}

export function actorCanTransition(actor, from, to) {
  if (!ORDER_TRANSITIONS[from]?.includes(to)) return false;
  if (actor?.isPlatformOwner) return true;
  const allowed = TRANSITION_PERMISSIONS[to] || [];
  if (allowed.some((permission) => can(actor, permission))) return true;
  return roleCanTransition(actor?.role, from, to);
}

export async function getOrderWithRelations(orderId) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, items:order_items(*), merchant:merchants(id, company_name, user_id, is_active), customer:users(id, full_name, email, phone, whatsapp, province, address), driver:driver_profiles(id, user_id, driver_type, company_id, user:users(full_name, phone, whatsapp))')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'الطلب غير موجود', 'ORDER_NOT_FOUND');
  return data;
}

export async function transitionOrder({ order, actor, toStatus, reason, extra = {} }) {
  if (!actorCanTransition(actor, order.status, toStatus)) {
    throw new AppError(409, 'لا يمكن تنفيذ هذا الانتقال في حالة الطلب الحالية أو ضمن صلاحياتك', 'INVALID_ORDER_TRANSITION');
  }
  if (['rejected', 'cancelled'].includes(toStatus) && !reason?.trim()) {
    throw new AppError(400, 'أدخل سبب الرفض أو الإلغاء', 'ORDER_REASON_REQUIRED');
  }
  const updates = { status: toStatus, updated_at: new Date().toISOString(), ...extra };
  if (toStatus === 'archive') updates.archived_at = new Date().toISOString();
  if (toStatus === 'completed') updates.completed_at = new Date().toISOString();
  if (toStatus === 'delivered') updates.delivered_at = new Date().toISOString();
  if (['rejected', 'cancelled'].includes(toStatus)) updates.cancelled_reason = reason.trim();

  const { data: updatedRow, error } = await supabaseAdmin.from('orders').update(updates).eq('id', order.id).eq('status', order.status).select().maybeSingle();
  if (error) throw error;
  if (!updatedRow) throw new AppError(409, 'تغيرت حالة الطلب في جلسة أخرى، أعد المحاولة', 'ORDER_CONFLICT');

  const { error: historyError } = await supabaseAdmin.from('order_status_history').insert({
    order_id: order.id,
    from_status: order.status,
    to_status: toStatus,
    changed_by: actor.id,
    reason: reason || null
  });
  if (historyError) throw historyError;

  if (order.order_type === 'merchant' && ['rejected', 'cancelled'].includes(toStatus)) {
    for (const item of order.items || []) {
      const { error: stockError } = await supabaseAdmin.rpc('release_product_stock', { product_uuid: item.product_id, released_quantity: item.quantity });
      if (stockError) throw stockError;
    }
  }

  const updated = { ...order, ...updatedRow, ...updates };
  if (toStatus === 'completed' && order.order_type === 'merchant') await ensureInvoiceForOrder(updated);
  await audit(actor.id, 'order_status_changed', 'order', order.id, { from: order.status, to: toStatus, reason: reason || null }, order.merchant_id, { status: order.status }, { status: toStatus });
  await notify(order.user_id, 'order_status', 'تحديث حالة الطلب', `تم تحديث الطلب ${order.order_number} إلى: ${toStatus}`, order.id);
  return updated;
}

export async function assertOrderAccess(order, actor) {
  if (actor?.isPlatformOwner) return;
  if (actor?.role === 'customer' && order.user_id === actor.id) return;
  if (actor?.roles?.includes('customer') && order.user_id === actor.id && !order.merchant_id) return;
  if (order.merchant_id && canAccessCompany(actor, order.merchant_id) && can(actor, 'orders.view')) return;

  const isDriver = actor?.roles?.some((role) => ['platform_driver', 'company_driver'].includes(role)) || actor?.role === 'driver';
  if (isDriver && order.assigned_driver_id) {
    const { data, error } = await supabaseAdmin.from('driver_profiles').select('id').eq('user_id', actor.id).maybeSingle();
    if (error) throw error;
    if (data?.id === order.assigned_driver_id) return;
  }
  throw new AppError(403, 'ليس لديك صلاحية للوصول إلى هذا الطلب', 'ORDER_ACCESS_DENIED');
}

export function actorCanConfirmPayment(actor) {
  return canAny(actor, ['orders.confirm_payment', 'finance.confirm_payment']);
}
