'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { apiError, formatMoney, orderStatuses } from '@/lib/format';
import DashboardShell from './DashboardShell';
import DeliveryIssueDialog from './DeliveryIssueDialog';
import StatsCard from './StatsCard';

const call = async (request) => { try { return await request(); } catch (error) { toast.error(apiError(error)); return null; } };

export default function DriverDashboard({ title, eyebrow }) {
  const [orders, setOrders] = useState([]);
  const [issueOrder, setIssueOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); const response = await call(() => api.get('/orders/driver/assignments')); setOrders(response?.orders || []); setLoading(false); };
  useEffect(() => { load(); }, []);
  const status = async (order, nextStatus) => { const response = await call(() => api.patch(`/platform/orders/${order.id}/status`, { status: nextStatus })); if (response) { toast.success('تم تحديث مهمة التوصيل'); load(); } };
  const reportIssue = async (body) => { const response = await call(() => api.post(`/platform/orders/${issueOrder.id}/issues`, body)); if (response) { toast.success('تم تسجيل المشكلة'); setIssueOrder(null); load(); } };
  const items = [{ id: 'tasks', label: 'مهام التوصيل' }, { id: 'history', label: 'المهام النشطة' }];
  return <DashboardShell title={title} eyebrow={eyebrow} items={items} active="tasks" onSelect={() => {}}>
    {loading ? <div className="rounded-2xl bg-white p-10 text-center text-secondary-600 shadow-card">جارٍ تحميل المهام…</div> : <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatsCard label="المهام المعينة" value={orders.length} /><StatsCard label="قيد التوصيل" value={orders.filter((order) => order.status === 'in_delivery').length} /><StatsCard label="تم الوصول" value={orders.filter((order) => order.status === 'arrived').length} /></div><div className="space-y-4">{orders.map((order) => <article key={order.id} className="rounded-2xl bg-white p-5 shadow-card"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-black">{order.order_number} — {order.merchant?.company_name}</p><p className="mt-2 text-sm leading-6 text-secondary-700">{order.customer?.full_name}<br />{order.customer?.phone} · {order.customer?.whatsapp}<br />{order.customer?.province} · {order.customer?.address}</p><p className="mt-2 font-bold">{formatMoney(order.total, order.currency)}</p></div><span className="rounded-full bg-secondary-100 px-3 py-1 text-xs font-bold">{orderStatuses[order.status] || order.status}</span></div><div className="mt-5 flex flex-wrap gap-2">{order.status === 'assigned_to_driver' && <button onClick={() => status(order, 'in_delivery')} className="btn-primary">بدء التوصيل</button>}{order.status === 'in_delivery' && <button onClick={() => status(order, 'arrived')} className="btn-primary">تم الوصول</button>}{order.status === 'arrived' && <button onClick={() => status(order, 'delivered')} className="btn-primary">تم التسليم</button>}{order.status === 'delivered' && <button onClick={() => status(order, 'final_review')} className="btn-primary">رفع للمراجعة النهائية</button>}<button onClick={() => setIssueOrder(order)} className="btn-secondary text-red-700">تسجيل مشكلة</button></div></article>)}{!orders.length && <div className="rounded-2xl bg-white p-10 text-center text-secondary-600 shadow-card">لا توجد مهام توصيل نشطة.</div>}</div></div>}
    <DeliveryIssueDialog open={Boolean(issueOrder)} onSubmit={reportIssue} onClose={() => setIssueOrder(null)} />
  </DashboardShell>;
}
