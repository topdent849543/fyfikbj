'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function AuthForm({ mode = 'login', role = 'customer' }) {
  const router = useRouter();
  const { login } = useAuth();
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = isRegister
        ? { ...form, role }
        : { email: form.email, password: form.password };
      const response = await api.post(isRegister ? '/auth/register' : '/auth/login', payload);
      login(response.user, response.token);
      router.push('/');
    } catch (err) {
      setError(err?.error || err?.message || 'حدث خطأ، يرجى المحاولة مرة أخرى');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-50 py-16 px-4">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-card">
        <h1 className="mb-2 text-center text-3xl font-bold text-secondary-900">
          {isRegister ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
        </h1>
        <p className="mb-8 text-center text-secondary-600">أهلاً بك في منصة TopDent</p>
        {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-4">
          {isRegister && <input required name="fullName" value={form.fullName} onChange={update} placeholder="الاسم الكامل" className="input-base w-full" />}
          <input required type="email" name="email" value={form.email} onChange={update} placeholder="البريد الإلكتروني" className="input-base w-full" />
          {isRegister && <input name="phone" value={form.phone} onChange={update} placeholder="رقم الهاتف (اختياري)" className="input-base w-full" />}
          <input required minLength={6} type="password" name="password" value={form.password} onChange={update} placeholder="كلمة المرور" className="input-base w-full" />
          <button disabled={loading} className="btn-primary w-full disabled:opacity-60">{loading ? 'جارٍ التنفيذ...' : isRegister ? 'إنشاء الحساب' : 'دخول'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-secondary-600">
          {isRegister ? 'لديك حساب؟ ' : 'ليس لديك حساب؟ '}
          <Link className="font-medium text-primary-600" href={isRegister ? '/auth/login' : '/auth/register'}>{isRegister ? 'تسجيل الدخول' : 'إنشاء حساب'}</Link>
        </p>
      </div>
    </div>
  );
}
