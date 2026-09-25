import { supabaseAdmin } from '../config/supabase.js';
import { AppError, audit, notify } from './http.js';

export const ORDER_TRANSITIONS = {
  new: ['pending_review', 'cancelled'],
  pending_review: ['approved', 'rejected', 'cancelled'],
  approved: ['preparing', 'cancelled'],
  preparing: ['assigned_to_driver', 'cancelled'],
  assigned_to_driver: ['in_delivery', 'cancelled'],
  in_delivery: ['arrived', 'cancelled'],
  arrived: ['delivered'],
  delivered: ['awaiting_payment', 'payment_received'],
  awaiting_payment: ['payment_received'],
  payment_received: ['completed'],
  completed: ['archive'],
  rejected: [],
  cancelled: [],
  archive: []
};

export const ROLE_TRANSITIONS = {
  customer: { new: ['cancelled'], pending_review: ['cancelled'] },
  merchant: { approved: ['preparing'] },
  manager: {
    new: ['pending_review'], pending_review: ['approved', 'rejected'], preparing: ['assigned_to_driver'],
    delivered: ['awaiting_payment', 'payment_received'], awaiting_payment: ['payment_received'], payment_received: ['completed'], completed: ['archive']
  },
  admin: {
    new: ['pending_review', 'cancelled'], pending_review: ['approved', 'rejected', 'cancelled'], approved: ['preparing', 'cancelled'],
    preparing: ['assigned_to_driver', 'cancelled'], delivered: ['awaiting_payment', 'payment_received'], awaiting_payment: ['payment_received'],
    payment_received: ['completed'], completed: ['archive']
  },
  driver: { assigned_to_driver: ['in_delivery'], in_delivery: ['arrived'], arrived: ['delivered'] }
};

export function roleCanTransition(role, from, to) {
  return Boolean(ORDER_TRANSITIONS[from]?.includes(to) && ROLE_TRANSITIONS[role]?.[from]?.includes(to));
}

export async function getOrderWithRelations(orderId) {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select('*, items:order_items(*), merchant:merchants(*), customer:users(id, full_name, email, phone, whatsapp, province, address), driver:driver_profiles(id, user:users(full_name, phone, whatsapp))')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(404, 'الطلب غير موجود', 'ORDER_NOT_FOUND');
  return data;
}

export async function transitionOrder({ order, actor, toStatus, reason, extra = {} }) {
  if (!roleCanTransition(actor.role, order.status, toStatus)) {
    throw new AppError(409, 'لا يمكن تنفيذ هذا الانتقال في حالة الطلب الحالية', 'INVALID_ORDER_TRANSITION');
  }
  const updates = { status: toStatus, updated_at: new Date().toISOString(), ...extra };
  if (toStatus === 'archive') updates.archived_at = new Date().toISOString();
  if (toStatus === 'completed') updates.completed_at = new Date().toISOString();
  if (toStatus === 'delivered') updates.delivered_at = new Date().toISOString();
  if (toStatus === 'rejected') updates.cancelled_reason = reason || null;

  const { error } = await supabaseAdmin.from('orders').update(updates).eq('id', order.id).eq('status', order.status);
  if (error) throw error;

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
      const { error: stockError } = await supabaseAdmin.rpc('release_product_stock', {
        product_uuid: item.product_id,
        released_quantity: item.quantity
      });
      if (stockError) throw stockError;
    }
  }

  await audit(actor.id, 'order_status_changed', 'order', order.id, { from: order.status, to: toStatus, reason: reason || null });
  await notify(order.user_id, 'order_status', 'تحديث حالة الطلب', `تم تحديث الطلب ${order.order_number} إلى: ${toStatus}`, order.id);
  return { ...order, ...updates };
}

export async function assertOrderAccess(order, actor) {
  if (['admin', 'manager'].includes(actor.role)) return;
  if (actor.role === 'customer' && order.user_id === actor.id) return;
  if (actor.role === 'merchant') {
    const { data, error } = await supabaseAdmin.from('merchants').select('id').eq('user_id', actor.id).maybeSingle();
    if (error) throw error;
    if (data?.id === order.merchant_id) return;
  }
  if (actor.role === 'driver' && order.assigned_driver_id) {
    const { data, error } = await supabaseAdmin.from('driver_profiles').select('id').eq('user_id', actor.id).maybeSingle();
    if (error) throw error;
    if (data?.id === order.assigned_driver_id) return;
  }
  throw new AppError(403, 'ليس لديك صلاحية للوصول إلى هذا الطلب', 'ORDER_ACCESS_DENIED');
}
