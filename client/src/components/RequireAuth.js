'use client';

import Link from 'next/link';
import { FiLock } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';

export default function RequireAuth({ children, role }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <div className="container-main py-20 text-center text-secondary-600">جارٍ التحقق من الحساب...</div>;
  if (!isAuthenticated) {
    return (
      <div className="container-main py-20">
        <div className="mx-auto max-w-lg rounded-2xl border border-secondary-100 bg-white p-10 text-center shadow-card">
          <FiLock className="mx-auto mb-4 text-4xl text-primary-600" />
          <h1 className="mb-3 text-2xl font-bold">يلزم تسجيل الدخول</h1>
          <p className="mb-6 text-secondary-600">سجّل الدخول للوصول إلى هذه الصفحة وإدارة حسابك بأمان.</p>
          <Link href="/auth/login" className="btn-primary">تسجيل الدخول</Link>
        </div>
      </div>
    );
  }
  if (role && user?.role !== role) {
    return (
      <div className="container-main py-20">
        <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center">
          <h1 className="mb-3 text-2xl font-bold text-amber-900">هذه الصفحة مخصصة للبائعين</h1>
          <p className="mb-6 text-amber-800">أنشئ حساب بائع لعرض المنتجات الجديدة أو المستعملة على المنصة.</p>
          <Link href="/merchant/register" className="btn-primary">إنشاء حساب بائع</Link>
        </div>
      </div>
    );
  }
  return children;
}
