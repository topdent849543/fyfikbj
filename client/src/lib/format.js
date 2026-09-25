import api from '@/lib/api';

const apiBase = api.defaults.baseURL || '';
const apiOrigin = apiBase.replace(/\/api\/?$/, '');

export function mediaUrl(value) {
  if (!value) return '/placeholder.svg';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${apiOrigin}${value.startsWith('/') ? '' : '/'}${value}`;
}

export function formatMoney(value, currency = 'SYP') {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('ar-SY', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'SYP' ? 0 : 2,
  }).format(amount);
}

export function formatDate(value, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ar-SY', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(new Date(value));
}

export function apiError(error, fallback = 'تعذر إتمام العملية، يرجى المحاولة مجدداً') {
  const message = error?.error || error?.message;
  const translations = {
    'Requested quantity exceeds available stock': 'الكمية المطلوبة أكبر من المخزون المتاح.',
    'Product is no longer available': 'هذا المنتج لم يعد متاحاً.',
    'All products in an order must belong to one merchant': 'يجب أن تكون منتجات الطلب من متجر واحد.',
    'All products in an order must use one currency': 'يجب أن تستخدم منتجات الطلب عملة واحدة.',
    'Delivery is not configured for the selected speed': 'خدمة التوصيل المختارة غير متاحة لهذا المتجر.',
    'Delivery rate not found': 'لا يتوفر سعر توصيل لهذا الخيار.',
    'Invalid discount code': 'رمز الخصم غير صالح.',
    'Discount code has expired': 'انتهت صلاحية رمز الخصم.',
    'Merchant not found': 'لم يكتمل إعداد حساب البائع بعد. تواصل مع الدعم.',
    Unauthorized: 'ليس لديك صلاحية لتنفيذ هذا الإجراء.',
  };
  return translations[message] || message || fallback;
}

export const orderStatuses = {
  new: 'طلب جديد',
  pending_review: 'قيد المراجعة',
  approved: 'تمت الموافقة',
  preparing: 'قيد التجهيز',
  in_delivery: 'قيد التوصيل',
  arrived: 'وصل إلى الوجهة',
  delivered: 'تم التسليم',
  awaiting_payment: 'بانتظار الدفع',
  payment_received: 'تم استلام الدفع',
  rejected: 'مرفوض',
  cancelled: 'ملغى',
  completed: 'مكتمل',
};

export const paymentStatuses = {
  pending: 'بانتظار الدفع',
  received: 'تم الدفع',
  failed: 'فشل الدفع',
  cancelled: 'ملغى',
};

export const deliverySpeeds = {
  normal: 'عادي',
  urgent: 'مستعجل',
  very_urgent: 'مستعجل جداً',
};

export const categories = [
  { value: 'أدوات', label: 'أدوات طب الأسنان', icon: '🦷', description: 'أدوات التشخيص والفحص والعلاج اليومي.' },
  { value: 'أجهزة', label: 'أجهزة طب الأسنان', icon: '⚙️', description: 'أجهزة العيادات والمختبرات وملحقاتها.' },
  { value: 'مواد', label: 'مواد طب الأسنان', icon: '🧪', description: 'مواد الترميم والطباعة والتعقيم.' },
  { value: 'طلاب', label: 'مستلزمات الطلاب', icon: '📚', description: 'احتياجات التدريب العملي والدراسة.' },
  { value: 'عيادات', label: 'مستلزمات العيادات', icon: '🏥', description: 'المستهلكات والتنظيم والتجهيز.' },
  { value: 'وقاية', label: 'معدات الوقاية', icon: '🛡️', description: 'منتجات السلامة والحماية الشخصية.' },
];
