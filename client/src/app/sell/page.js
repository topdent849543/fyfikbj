'use client';

import RequireAuth from '@/components/RequireAuth';
import ProductForm from '@/components/ProductForm';

export default function SellPage() {
  return <RequireAuth role="customer"><div className="min-h-screen bg-secondary-50 py-8"><div className="container-main"><div className="max-w-3xl rounded-2xl bg-white p-6 shadow-card sm:p-8"><p className="text-sm font-bold text-primary-700">عرض أدوات للبيع</p><h1 className="mt-2 text-3xl font-black">أضف منتجك المستعمل</h1><p className="mt-3 leading-7 text-secondary-600">تُراجع الإدارة كل منتج مستعمل قبل نشره. لا يمكن نشر العرض بدون صورتين ووصف للعيوب وإقرارات البائع.</p><div className="mt-8"><ProductForm endpoint="/users/listings" condition="used" /></div></div></div></div></RequireAuth>;
}
