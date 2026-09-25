'use client';

import Link from 'next/link';
import { FiLock } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { roleLabels } from '@/lib/format';

export default function RequireAuth({ children, role, roles }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const allowedRoles = roles || (role ? [role] : null);
  if (isLoading) return <div className="container-main py-20 text-center text-secondary-600">جارٍ التحقق من الحساب...</div>;
  if (!isAuthenticated) return <div className="container-main py-20"><div className="mx-auto max-w-lg rounded-2xl border border-secondary-100 bg-white p-10 text-center shadow-card"><FiLock className="mx-auto mb-4 text-4xl text-primary-600" /><h1 className="mb-3 text-2xl font-black">يلزم تسجيل الدخول</h1><p className="mb-6 text-secondary-600">سجّل الدخول للوصول إلى هذه الصفحة وإدارة حسابك بأمان.</p><Link href="/auth/login" className="btn-primary">تسجيل الدخول</Link></div></div>;
  if (allowedRoles && !allowedRoles.includes(user?.role)) return <div className="container-main py-20"><div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center"><h1 className="mb-3 text-2xl font-black text-amber-900">هذه الصفحة مخصصة لدور مختلف</h1><p className="mb-6 text-amber-800">هذه العملية متاحة لـ {allowedRoles.map((item) => roleLabels[item] || item).join(' أو ')}.</p><Link href="/dashboard" className="btn-primary">العودة إلى لوحتي</Link></div></div>;
  return children;
}
