'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/lib/format';

const initialAccount = { fullName: '', email: '', password: '', passwordConfirmation: '', phone: '', whatsapp: '', province: '', area: '', address: '', universityClinic: '', acceptTerms: false, acceptPrivacy: false };

export default function AuthForm({ mode = 'login', role = 'customer' }) {
  const router = useRouter();
  const search = useSearchParams();
  const { login } = useAuth();
  const isRegister = mode === 'register';
  const isMerchant = isRegister && role === 'merchant';
  const [account, setAccount] = useState(initialAccount);
  const [company, setCompany] = useState({ companyName: '', companyDescription: '', logoUrl: '', contactEmail: '', websiteUrl: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const updateAccount = (event) => setAccount((current) => ({ ...current, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const updateCompany = (event) => setCompany((current) => ({ ...current, [event.target.name]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError(''); setLoading(true);
    try {
      const response = isRegister
        ? await api.post(isMerchant ? '/auth/register-merchant' : '/auth/register', isMerchant ? { account, ...company, logoUrl: company.logoUrl || null, contactEmail: company.contactEmail || null, websiteUrl: company.websiteUrl || null, companyDescription: company.companyDescription || null } : account)
        : await api.post('/auth/login', { email: account.email, password: account.password });
      login(response.user, response.token);
      toast.success(response.message || 'تم تسجيل الدخول بنجاح');
      router.push(search.get('next') || (isMerchant ? '/dashboard' : '/'));
    } catch (err) {
      setError(apiError(err));
    } finally { setLoading(false); }
  };

  const field = (name, label, props = {}) => <label className="block text-sm font-medium text-secondary-800"><span className="mb-1.5 block">{label}{props.required !== false && <span className="text-red-600"> *</span>}</span><input name={name} value={account[name] || ''} onChange={updateAccount} className="input-base" {...props} /></label>;

  return <div className="min-h-screen bg-secondary-50 px-4 py-12"><div className={`mx-auto rounded-2xl bg-white p-6 shadow-card sm:p-9 ${isRegister ? 'max-w-3xl' : 'max-w-md'}`}>
    <div className="mb-8 text-center"><p className="text-sm font-bold text-primary-700">TopDent</p><h1 className="mt-2 text-3xl font-black">{isMerchant ? 'تسجيل شركة أو متجر' : isRegister ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</h1><p className="mt-2 text-secondary-600">{isMerchant ? 'سيُرسل طلبك إلى الإدارة للمراجعة قبل تفعيل الشركة.' : 'أهلاً بك في منصة أدوات طب الأسنان.'}</p></div>
    {error && <div role="alert" className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <form onSubmit={submit} className="space-y-5">
      {isRegister ? <>
        <section><h2 className="mb-4 font-bold text-secondary-900">بيانات الحساب</h2><div className="grid gap-4 sm:grid-cols-2">{field('fullName', 'الاسم الثلاثي', { minLength: 6, required: true })}{field('email', 'البريد الإلكتروني', { type: 'email', required: true })}{field('phone', 'رقم الهاتف', { type: 'tel', required: true })}{field('whatsapp', 'رقم واتساب', { type: 'tel', required: false })}{field('province', 'المحافظة', { required: true })}{field('area', 'المنطقة / مكان السكن', { required: true })}{field('universityClinic', 'الجامعة أو العيادة', { required: false })}{field('address', 'العنوان التفصيلي', { required: false })}{field('password', 'كلمة المرور', { type: 'password', minLength: 8, required: true })}{field('passwordConfirmation', 'تأكيد كلمة المرور', { type: 'password', minLength: 8, required: true })}</div></section>
        {isMerchant && <section className="border-t border-secondary-100 pt-5"><h2 className="mb-4 font-bold text-secondary-900">بيانات الشركة</h2><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium"><span className="mb-1.5 block">اسم الشركة <span className="text-red-600">*</span></span><input required minLength="2" name="companyName" value={company.companyName} onChange={updateCompany} className="input-base" /></label><label className="block text-sm font-medium"><span className="mb-1.5 block">بريد التواصل</span><input type="email" name="contactEmail" value={company.contactEmail} onChange={updateCompany} className="input-base" /></label><label className="block text-sm font-medium"><span className="mb-1.5 block">رابط الشعار في التخزين</span><input type="url" name="logoUrl" value={company.logoUrl} onChange={updateCompany} className="input-base" /></label><label className="block text-sm font-medium"><span className="mb-1.5 block">الموقع الإلكتروني</span><input type="url" name="websiteUrl" value={company.websiteUrl} onChange={updateCompany} className="input-base" /></label></div><label className="mt-4 block text-sm font-medium"><span className="mb-1.5 block">وصف الشركة</span><textarea name="companyDescription" value={company.companyDescription} onChange={updateCompany} className="input-base min-h-28" /></label></section>}
        <div className="space-y-3 rounded-xl bg-secondary-50 p-4 text-sm"><label className="flex items-start gap-3"><input required name="acceptTerms" checked={account.acceptTerms} onChange={updateAccount} type="checkbox" className="mt-1" /><span>أوافق على <Link href="/terms" className="font-bold text-primary-700">الشروط والأحكام</Link>.</span></label><label className="flex items-start gap-3"><input required name="acceptPrivacy" checked={account.acceptPrivacy} onChange={updateAccount} type="checkbox" className="mt-1" /><span>أوافق على <Link href="/policy" className="font-bold text-primary-700">سياسة الخصوصية</Link>.</span></label></div>
      </> : <>
        {field('email', 'البريد الإلكتروني', { type: 'email', required: true })}{field('password', 'كلمة المرور', { type: 'password', required: true })}<div className="text-left"><Link href="/auth/forgot-password" className="text-sm font-medium text-primary-700 hover:underline">نسيت كلمة المرور؟</Link></div>
      </>}
      <button disabled={loading} className="btn-primary w-full disabled:cursor-wait disabled:opacity-60">{loading ? 'جارٍ الحفظ...' : isMerchant ? 'إرسال طلب الشركة' : isRegister ? 'إنشاء الحساب' : 'دخول آمن'}</button>
    </form>
    <p className="mt-6 text-center text-sm text-secondary-600">{isRegister ? 'لديك حساب؟ ' : 'ليس لديك حساب؟ '}<Link className="font-bold text-primary-700 hover:underline" href={isRegister ? '/auth/login' : '/auth/register'}>{isRegister ? 'تسجيل الدخول' : 'إنشاء حساب'}</Link>{!isRegister && <><span className="mx-2">·</span><Link className="font-bold text-primary-700 hover:underline" href="/merchant/register">تسجيل شركة</Link></>}</p>
  </div></div>;
}
