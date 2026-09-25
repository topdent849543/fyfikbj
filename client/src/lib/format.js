import api from '@/lib/api';

const apiBase = api.defaults.baseURL || '';
const apiOrigin = apiBase.replace(/\/api\/?$/, '');

export function mediaUrl(value) {
  if (!value) return '/placeholder.svg';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${apiOrigin}${value.startsWith('/') ? '' : '/'}${value}`;
}

export function formatMoney(value, currency = 'SYP') {
  return new Intl.NumberFormat('ar-SY', { style: 'currency', currency, maximumFractionDigits: currency === 'SYP' ? 0 : 2 }).format(Number(value || 0));
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium', ...(withTime ? { timeStyle: 'short' } : {}) }).format(new Date(value));
}

export function apiError(error, fallback = 'تعذر إتمام العملية، يرجى المحاولة مجدداً') {
  return error?.error || error?.message || fallback;
}

export const orderStatuses = {
  new: 'طلب جديد', pending_review: 'قيد المراجعة', approved: 'تمت الموافقة', preparing: 'قيد التجهيز', assigned_to_driver: 'بانتظار السائق', in_delivery: 'قيد التوصيل', arrived: 'وصل إلى العنوان', delivered: 'تم التسليم', awaiting_payment: 'بانتظار تأكيد الأموال', payment_received: 'تم استلام الأموال', completed: 'مكتمل', archive: 'مؤرشف', rejected: 'مرفوض', cancelled: 'ملغى'
};
export const deliverySpeeds = { normal: 'عادي', urgent: 'مستعجل', very_urgent: 'فوري' };
export const roleLabels = { customer: 'عميل', merchant: 'شركة / تاجر', manager: 'مدير عمليات', driver: 'سائق', admin: 'مدير النظام' };
