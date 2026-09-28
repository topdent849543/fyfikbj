'use client';

import { useMemo } from 'react';
import { formatDate, formatMoney } from '@/lib/format';

const labels = {
  id: 'المعرّف', order_number: 'رقم الطلب', invoice_number: 'رقم الفاتورة', company_name: 'اسم الشركة', full_name: 'الاسم', email: 'البريد الإلكتروني', phone: 'الهاتف', status: 'الحالة', approval_status: 'حالة الاعتماد', account_status: 'حالة الحساب', is_active: 'نشط', is_available: 'متاح', driver_type: 'نوع السائق', plate_number: 'رقم اللوحة', province: 'المحافظة', area: 'المنطقة', address: 'العنوان', total: 'الإجمالي', subtotal: 'المجموع الفرعي', discount_amount: 'الخصم', delivery_cost: 'التوصيل', price: 'السعر', stock_quantity: 'المخزون', currency: 'العملة', created_at: 'تاريخ الإنشاء', updated_at: 'آخر تعديل', issued_at: 'تاريخ الإصدار', description: 'الوصف', category: 'التصنيف', condition: 'الحالة', notes: 'ملاحظات'
};
const moneyKeys = new Set(['total', 'subtotal', 'discount_amount', 'delivery_cost', 'price', 'amount', 'line_total', 'unit_price']);
const dateKeys = new Set(['created_at', 'updated_at', 'issued_at', 'confirmed_at', 'resolved_at']);

function valueFor(key, value, currency = 'SYP') {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا';
  if (moneyKeys.has(key) && Number.isFinite(Number(value))) return formatMoney(value, currency);
  if (dateKeys.has(key)) return formatDate(value, true);
  if (typeof value === 'object') return null;
  return String(value);
}

function ObjectSection({ title, data, currency }) {
  const entries = Object.entries(data || {}).filter(([key, value]) => !['password', 'password_hash', 'images', 'items', 'team', 'orders', 'products', 'assignments', 'role_permissions', 'reports', 'order_items'].includes(key) && typeof value !== 'object');
  if (!entries.length) return null;
  return <section className="rounded-xl border border-secondary-100 bg-secondary-50 p-4"><h3 className="mb-3 font-black">{title}</h3><div className="grid gap-3 sm:grid-cols-2">{entries.map(([key, value]) => <div key={key}><p className="text-xs font-bold text-secondary-500">{labels[key] || key}</p><p className="mt-1 break-words font-semibold">{valueFor(key, value, currency) ?? '—'}</p></div>)}</div></section>;
}

export default function DetailPanel({ open, title, data, loading, onClose }) {
  const sections = useMemo(() => {
    if (!data) return [];
    return Object.entries(data).filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value)).map(([key, value]) => [key, value]);
  }, [data]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-secondary-950/50 p-4 sm:p-8" role="dialog" aria-modal="true">
    <div className="w-full max-w-5xl rounded-2xl bg-white shadow-2xl" dir="rtl">
      <div className="sticky top-0 flex items-center justify-between border-b bg-white p-5"><div><p className="text-xs font-bold text-primary-700">تفاصيل كاملة</p><h2 className="text-xl font-black">{title}</h2></div><button className="btn-secondary" onClick={onClose}>إغلاق</button></div>
      {loading ? <div className="p-10 text-center text-secondary-600">جارٍ تحميل التفاصيل…</div> : <div className="space-y-5 p-5"><ObjectSection title="البيانات الأساسية" data={data} currency={data?.currency} />{sections.filter(([key]) => key !== 'data').map(([key, value]) => <ObjectSection key={key} title={labels[key] || key} data={value} currency={data?.currency} />)}{Object.entries(data || {}).filter(([, value]) => Array.isArray(value)).map(([key, rows]) => <section key={key} className="rounded-xl border border-secondary-100 p-4"><h3 className="mb-3 font-black">{labels[key] || key} ({rows.length})</h3><div className="space-y-2">{rows.map((row, index) => <pre key={row.id || index} className="overflow-x-auto rounded-lg bg-secondary-50 p-3 text-xs leading-6">{JSON.stringify(row, null, 2)}</pre>)}</div></section>)}</div>}
    </div>
  </div>;
}
