'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { apiError } from '@/lib/format';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (event) => { event.preventDefault(); setLoading(true); setError(''); try { const response = await api.post('/auth/forgot-password', { email }); setMessage(response.message); } catch (err) { setError(apiError(err)); } finally { setLoading(false); } };
  return <div className="min-h-screen bg-secondary-50 px-4 py-16"><div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-card"><h1 className="text-3xl font-black">استعادة كلمة المرور</h1><p className="mt-3 leading-7 text-secondary-600">أدخل بريدك الإلكتروني وسنرسل رابطاً آمناً صالحاً لمدة ساعة، بعد تهيئة خدمة البريد في إعدادات النشر.</p>{message && <div className="mt-5 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}{error && <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}<form onSubmit={submit} className="mt-6 space-y-4"><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="البريد الإلكتروني" className="input-base" /><button disabled={loading} className="btn-primary w-full">{loading ? 'جارٍ الإرسال...' : 'إرسال رابط الاستعادة'}</button></form><Link className="mt-5 block text-center text-sm font-bold text-primary-700" href="/auth/login">العودة إلى تسجيل الدخول</Link></div></div>;
}
