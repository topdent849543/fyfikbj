import { Suspense } from 'react';
import AuthForm from '@/components/AuthForm';

export default function MerchantRegisterPage() {
  return <Suspense fallback={<div className="container-main py-20 text-center">جارٍ تحميل تسجيل الشركة...</div>}><AuthForm mode="register" role="merchant" /></Suspense>;
}
