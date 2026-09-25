'use client';

import { useState } from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { apiError } from '@/lib/format';

function ResetPasswordContent() {
  const search = useSearchParams(); const token = search.get('token') || ''; const [password, setPassword] = useState(''); const [passwordConfirmation, setConfirmation] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const submit = async (event) => { event.preventDefault(); setError(''); try { const response = await api.post('/auth/reset-password', { token, password, passwordConfirmation }); setMessage(response.message); } catch (err) { setError(apiError(err)); } };
  return <div className="min-h-screen bg-secondary-50 px-4 py-16"><div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-card"><h1 className="text-3xl font-black">كلمة مرور جديدة</h1>{!token ? <p className="mt-4 text-red-700">رابط الاستعادة غير مكتمل. اطلب رابطاً جديداً.</p> : <form onSubmit={submit} className="mt-6 space-y-4"><input required minLength="8" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="كلمة المرور الجديدة" className="input-base" /><input required minLength="8" type="password" value={passwordConfirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="تأكيد كلمة المرور" className="input-base" />{error && <p className="text-sm text-red-700">{error}</p>}{message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : <button className="btn-primary w-full">حفظ كلمة المرور</button>}</form>}<Link className="mt-5 block text-center text-sm font-bold text-primary-700" href="/auth/login">تسجيل الدخول</Link></div></div>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="container-main py-20 text-center">جارٍ تحميل الاستعادة...</div>}><ResetPasswordContent /></Suspense>;
}
