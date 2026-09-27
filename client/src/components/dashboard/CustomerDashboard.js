'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { apiError, formatDate, formatMoney, orderStatuses } from '@/lib/format';
import DashboardShell from './DashboardShell';
import DataTable from './DataTable';
import StatsCard from './StatsCard';

export default function CustomerDashboard() {
  const [orders, setOrders] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [cards, setCards] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { Promise.all([api.get('/orders/customer/my-orders'), api.get('/rentals/my-requests'), api.get('/dental-cards/requests/mine')]).then(([orderData, rentalData, cardData]) => { setOrders(orderData.orders || []); setRentals(rentalData.requests || []); setCards(cardData.requests || []); }).catch((requestError) => setError(apiError(requestError))); }, []);
  return <DashboardShell title="لوحة العميل" eyebrow="مشترياتي وخدماتي" items={[{ id: 'overview', label: 'الرئيسية' }, { id: 'orders', label: 'طلباتي' }, { id: 'services', label: 'الخدمات' }]} active="overview" onSelect={() => {}}>
    {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{error}</div> : <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatsCard label="طلباتي" value={orders.length} /><StatsCard label="طلبات الإيجار" value={rentals.length} /><StatsCard label="طلبات تصميم الكرت" value={cards.length} /></div><section className="space-y-4"><h2 className="text-xl font-black">طلباتي</h2><DataTable rows={orders} empty="لا توجد طلبات بعد." columns={[{ key: 'order_number', label: 'رقم الطلب' }, { key: 'total', label: 'الإجمالي', render: (order) => formatMoney(order.total, order.currency) }, { key: 'created_at', label: 'التاريخ', render: (order) => formatDate(order.created_at) }, { key: 'children', label: 'حالات الشركات', render: (order) => order.children?.map((child) => <span key={child.id} className="ml-1 inline-block rounded-full bg-secondary-100 px-2 py-1 text-xs">{child.merchant?.company_name}: {orderStatuses[child.status] || child.status}</span>) }]} /></section><section className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl bg-white p-6 shadow-card"><h2 className="font-black">طلبات الإيجار</h2><div className="mt-4 space-y-3">{rentals.map((rental) => <div key={rental.id} className="rounded-xl bg-secondary-50 p-3"><b>{rental.rental?.product?.name}</b><p className="mt-1 text-sm">{orderStatuses[rental.status] || rental.status} · {formatMoney(rental.calculated_price, 'SYP')}</p></div>)}{!rentals.length && <p className="text-sm text-secondary-600">لا توجد طلبات إيجار.</p>}</div></div><div className="rounded-2xl bg-white p-6 shadow-card"><h2 className="font-black">طلبات تصميم الكرت</h2><div className="mt-4 space-y-3">{cards.map((card) => <div key={card.id} className="rounded-xl bg-secondary-50 p-3"><b>{card.doctor_name}</b><p className="mt-1 text-sm">{orderStatuses[card.status] || card.status}</p></div>)}{!cards.length && <p className="text-sm text-secondary-600">لا توجد طلبات تصميم.</p>}</div></div></section></div>}
  </DashboardShell>;
}
