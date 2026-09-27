'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { apiError, formatDate, formatMoney, orderStatuses } from '@/lib/format';
import ProductForm from '@/components/ProductForm';
import AssignDriverDialog from './AssignDriverDialog';
import DashboardShell from './DashboardShell';
import DataTable from './DataTable';
import RejectDialog from './RejectDialog';
import RolePermissionMatrix from './RolePermissionMatrix';
import StatsCard from './StatsCard';

const statusBadge = (status) => <span className="rounded-full bg-secondary-100 px-2.5 py-1 text-xs font-bold">{orderStatuses[status] || status}</span>;
const request = async (fn) => { try { return await fn(); } catch (error) { toast.error(apiError(error)); return null; } };

export default function OperationalDashboard({ title, eyebrow }) {
  const { can, user } = useAuth();
  const [active, setActive] = useState('overview');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);

  const items = useMemo(() => [
    { id: 'overview', label: 'الرئيسية', permission: 'dashboard.view' },
    { id: 'orders', label: 'الطلبات', permission: 'orders.view' },
    { id: 'companies', label: 'الشركات', permission: 'companies.view' },
    { id: 'products', label: 'المنتجات', permission: 'products.view' },
    { id: 'roles', label: 'الأدوار والصلاحيات', permission: 'roles.view' },
    { id: 'drivers', label: 'السائقون', permission: 'drivers.view' },
    { id: 'invoices', label: 'الفواتير والتحصيل', anyOf: ['invoices.view', 'finance.view'] },
    { id: 'audit', label: 'سجل النشاط', permission: 'audit.view' }
  ], []);

  const load = useCallback(async () => {
    setLoading(true);
    const sources = [
      ['dashboard', 'dashboard.view', '/platform/dashboard'], ['orders', 'orders.view', '/platform/orders'],
      ['companies', 'companies.view', '/platform/companies'], ['products', 'products.view', '/platform/products'], ['roles', 'roles.view', '/platform/roles'],
      ['drivers', 'drivers.view', '/platform/drivers'], ['invoices', 'invoices.view', '/platform/invoices'],
      ['audit', 'audit.view', '/platform/audit-log']
    ].filter(([, permission]) => can(permission));
    const values = await Promise.all(sources.map(async ([key, , url]) => [key, await request(() => api.get(url))]));
    setData(Object.fromEntries(values));
    setLoading(false);
  }, [can]);

  useEffect(() => { load(); }, [load]);

  const setOrderStatus = async (order, status, reason) => {
    const response = await request(() => api.patch(`/platform/orders/${order.id}/status`, { status, ...(reason ? { reason } : {}) }));
    if (response) { toast.success(response.message || 'تم تحديث الطلب'); setRejecting(null); load(); }
  };
  const assignDriver = async ({ driverId, note }) => {
    const response = await request(() => api.post(`/platform/orders/${assigning.id}/assign-driver`, { driverId, note: note || undefined }));
    if (response) { toast.success('تم تعيين السائق'); setAssigning(null); load(); }
  };

  const stats = data.dashboard?.stats || {};
  const content = active === 'overview' ? <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    <StatsCard label="إجمالي الطلبات" value={stats.orders || 0} onClick={() => setActive('orders')} />
    <StatsCard label="طلبات جديدة" value={stats.newOrders || 0} onClick={() => setActive('orders')} />
    <StatsCard label="قيد التوصيل" value={stats.inDelivery || 0} onClick={() => setActive('orders')} />
    <StatsCard label="المراجعة النهائية" value={stats.finalReview || 0} onClick={() => setActive('orders')} />
    <StatsCard label="المبيعات المكتملة" value={formatMoney(stats.totalSales, 'SYP')} onClick={() => setActive('invoices')} />
    <StatsCard label="غير المحصل" value={formatMoney(stats.uncollected, 'SYP')} onClick={() => setActive('invoices')} />
    <StatsCard label="الشركات" value={stats.companies || 0} onClick={() => setActive('companies')} />
    <StatsCard label="منتجات بانتظار الاعتماد" value={stats.pendingProducts || 0} />
  </div><div className="rounded-2xl bg-white p-6 shadow-card"><h2 className="text-xl font-black">تنبيه الصلاحيات</h2><p className="mt-3 leading-7 text-secondary-600">الواجهة تعرض الأقسام المتاحة فقط. تُعاد جميع عمليات التحقق من الصلاحية والنطاق داخل API قبل تنفيذ أي إجراء.</p></div></div>
    : active === 'orders' ? <div className="space-y-4"><h2 className="text-xl font-black">إدارة الطلبات</h2><DataTable rows={data.orders?.orders || []} empty="لا توجد طلبات ضمن نطاقك." columns={[
      { key: 'order_number', label: 'الطلب' }, { key: 'merchant', label: 'الشركة', render: (order) => order.merchant?.company_name || '—' },
      { key: 'status', label: 'الحالة', render: (order) => statusBadge(order.status) }, { key: 'total', label: 'الإجمالي', render: (order) => formatMoney(order.total, order.currency) },
      { key: 'actions', label: 'إجراءات', render: (order) => <div className="flex flex-wrap gap-2">
        {can('orders.review') && order.status === 'new' && <button onClick={() => setOrderStatus(order, 'pending_review')} className="btn-secondary text-xs">بدء المراجعة</button>}
        {can('orders.approve') && order.status === 'pending_review' && <button onClick={() => setOrderStatus(order, 'approved')} className="btn-primary text-xs">موافقة</button>}
        {can('orders.reject') && order.status === 'pending_review' && <button onClick={() => setRejecting({ order, status: 'rejected', title: 'سبب رفض الطلب' })} className="btn-secondary text-xs text-red-700">رفض</button>}
        {can('orders.change_status') && order.status === 'approved' && <button onClick={() => setOrderStatus(order, 'preparing')} className="btn-primary text-xs">بدء التجهيز</button>}
        {can('orders.change_status') && order.status === 'preparing' && <button onClick={() => setOrderStatus(order, 'ready_for_delivery')} className="btn-primary text-xs">جاهز للتوصيل</button>}
        {can('orders.assign_driver') && order.status === 'ready_for_delivery' && <button onClick={() => setAssigning(order)} className="btn-primary text-xs">تعيين سائق</button>}
        {can('orders.final_review') && order.status === 'final_review' && <button onClick={() => setOrderStatus(order, 'completed')} className="btn-primary text-xs">إكمال</button>}
        {can('orders.archive') && order.status === 'completed' && <button onClick={() => setOrderStatus(order, 'archive')} className="btn-secondary text-xs">أرشفة</button>}
      </div> }
    ]} /></div>
    : active === 'companies' ? <div className="space-y-4"><h2 className="text-xl font-black">الشركات</h2><DataTable rows={data.companies?.companies || []} empty="لا توجد شركات ضمن نطاقك." columns={[{ key: 'company_name', label: 'الشركة' }, { key: 'province', label: 'المحافظة' }, { key: 'approval_status', label: 'الاعتماد' }, { key: 'is_active', label: 'الحالة', render: (company) => company.is_active ? 'فعالة' : 'معطلة' }]} /></div>
    : active === 'products' ? <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">إدارة المنتجات</h2>{can('products.create') && user?.companyIds?.length === 1 && <button onClick={() => setShowProductForm((current) => !current)} className="btn-primary">{showProductForm ? 'إخفاء النموذج' : 'إضافة منتج'}</button>}</div>{showProductForm && <section className="rounded-2xl bg-white p-6 shadow-card"><ProductForm endpoint="/products" onSuccess={() => { setShowProductForm(false); load(); }} /></section>}<DataTable rows={data.products?.products || []} empty="لا توجد منتجات ضمن نطاقك." columns={[{ key: 'name', label: 'المنتج' }, { key: 'merchant', label: 'الشركة', render: (product) => product.merchant?.company_name || '—' }, { key: 'stock_quantity', label: 'المخزون' }, { key: 'status', label: 'الحالة', render: (product) => statusBadge(product.status) }, { key: 'actions', label: 'إجراءات', render: (product) => <div className="flex flex-wrap gap-2">{can('products.approve') && product.status === 'pending' && <button onClick={async () => { const response = await request(() => api.patch(`/platform/products/${product.id}/status`, { status: 'approved' })); if (response) { toast.success('تم اعتماد المنتج'); load(); } }} className="btn-primary text-xs">اعتماد</button>}{can('products.reject') && product.status === 'pending' && <button onClick={() => setRejecting({ product, status: 'rejected', title: 'سبب رفض المنتج' })} className="btn-secondary text-xs text-red-700">رفض</button>}{can('products.hide') && product.is_active && <button onClick={async () => { const response = await request(() => api.patch(`/platform/products/${product.id}/status`, { status: 'inactive' })); if (response) { toast.success('تم إخفاء المنتج'); load(); } }} className="btn-secondary text-xs">إخفاء</button>}</div> }]} /></div>
    : active === 'roles' ? <div className="space-y-4"><h2 className="text-xl font-black">مصفوفة الصلاحيات</h2><RolePermissionMatrix roles={data.roles?.roles || []} /></div>
    : active === 'drivers' ? <div className="space-y-4"><h2 className="text-xl font-black">السائقون</h2><DataTable rows={data.drivers?.drivers || []} empty="لا يوجد سائقون ضمن نطاقك." columns={[{ key: 'user', label: 'السائق', render: (driver) => driver.user?.full_name || '—' }, { key: 'driver_type', label: 'النوع' }, { key: 'plate_number', label: 'اللوحة' }, { key: 'is_available', label: 'التوفر', render: (driver) => driver.is_available ? 'متاح' : 'غير متاح' }]} /></div>
    : active === 'invoices' ? <div className="space-y-4"><h2 className="text-xl font-black">الفواتير</h2><DataTable rows={data.invoices?.invoices || []} empty="لا توجد فواتير ضمن نطاقك." columns={[{ key: 'invoice_number', label: 'رقم الفاتورة' }, { key: 'company', label: 'الشركة', render: (invoice) => invoice.company?.company_name || '—' }, { key: 'total', label: 'الإجمالي', render: (invoice) => formatMoney(invoice.total, invoice.currency) }, { key: 'issued_at', label: 'التاريخ', render: (invoice) => formatDate(invoice.issued_at, true) }]} /></div>
    : <div className="space-y-4"><h2 className="text-xl font-black">سجل النشاط</h2><DataTable rows={data.audit?.entries || []} empty="لا توجد عمليات ضمن نطاقك." columns={[{ key: 'created_at', label: 'الوقت', render: (entry) => formatDate(entry.created_at, true) }, { key: 'user', label: 'المستخدم', render: (entry) => entry.user?.full_name || 'النظام' }, { key: 'action', label: 'العملية' }, { key: 'company', label: 'الشركة', render: (entry) => entry.company?.company_name || '—' }]} /></div>;

  return <DashboardShell title={title} eyebrow={eyebrow} items={items} active={active} onSelect={setActive}>
    {loading ? <div className="rounded-2xl bg-white p-10 text-center text-secondary-600 shadow-card">جارٍ تحميل بيانات النطاق…</div> : content}
    <AssignDriverDialog open={Boolean(assigning)} drivers={data.drivers?.drivers?.filter((driver) => driver.is_available && driver.is_active) || []} onSubmit={assignDriver} onClose={() => setAssigning(null)} />
    <RejectDialog open={Boolean(rejecting)} title={rejecting?.title} onSubmit={async (reason) => { if (rejecting?.product) { const response = await request(() => api.patch(`/platform/products/${rejecting.product.id}/status`, { status: rejecting.status, reason })); if (response) { toast.success('تم رفض المنتج'); setRejecting(null); load(); } } else { setOrderStatus(rejecting.order, rejecting.status, reason); } }} onClose={() => setRejecting(null)} />
  </DashboardShell>;
}
