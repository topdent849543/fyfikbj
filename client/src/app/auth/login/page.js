import { Suspense } from 'react';
import AuthForm from '@/components/AuthForm';

export default function LoginPage() {
  return <Suspense fallback={<div className="container-main py-20 text-center">جارٍ تحميل صفحة الدخول...</div>}><AuthForm mode="login" /></Suspense>;
}
