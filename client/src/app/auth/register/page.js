import { Suspense } from 'react';
import AuthForm from '@/components/AuthForm';

export default function RegisterPage() {
  return <Suspense fallback={<div className="container-main py-20 text-center">جارٍ تحميل صفحة التسجيل...</div>}><AuthForm mode="register" /></Suspense>;
}
