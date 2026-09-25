'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import RequireAuth from '@/components/RequireAuth';
import ImageUploader from '@/components/ImageUploader';
import api from '@/lib/api';
import { apiError } from '@/lib/format';

function DentalCardForm() {
  const [form, setForm] = useState({ doctorName: '', specialty: '', phone: '', address: '', email: '', logoUrl: '', colors: '', requestedText: '', requestedTemplate: '', attachments: [] }); const [loading, setLoading] = useState(false);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => { event.preventDefault(); setLoading(true); try { const response = await api.post('/dental-cards/requests', { ...form, logoUrl: form.logoUrl || null }); toast.success(response.message); setForm({ doctorName: '', specialty: '', phone: '', address: '', email: '', logoUrl: '', colors: '', requestedText: '', requestedTemplate: '', attachments: [] }); } catch (error) { toast.error(apiError(error)); } finally { setLoading(false); } };
  return <form onSubmit={submit} className="mt-8 space-y-5"><div className="grid gap-4 sm:grid-cols-2">{[['doctorName', 'اسم الطبيب'], ['specialty', 'الاختصاص'], ['phone', 'رقم الهاتف'], ['address', 'العنوان'], ['email', 'البريد الإلكتروني'], ['colors', 'الألوان المطلوبة'], ['requestedTemplate', 'النموذج المطلوب']].map(([name, label]) => <label key={name} className="text-sm font-bold">{label}<input required={name === 'doctorName' || name === 'phone'} type={name === 'email' ? 'email' : 'text'} name={name} value={form[name]} onChange={update} className="input-base mt-2" /></label>)}</div><label className="block text-sm font-bold">النص المطلوب على الكرت<textarea name="requestedText" value={form.requestedText} onChange={update} className="input-base mt-2 min-h-28" /></label><section><h2 className="font-black">ملفات وشعار الطلب</h2><p className="mt-2 text-sm text-secondary-600">ارفع الشعار أو ملفات مرجعية. تُحفظ الملفات بشكل دائم وتظهر في لوحة إدارة الطلب.</p><div className="mt-4"><ImageUploader value={form.attachments} onChange={(attachments) => setForm((current) => ({ ...current, attachments, logoUrl: current.logoUrl || attachments[0] || '' }))} /></div></section><button disabled={loading} className="btn-primary">{loading ? 'جارٍ الإرسال...' : 'إرسال طلب التصميم'}</button></form>;
}
export default function DentalCardPage() { return <RequireAuth><div className="min-h-screen bg-secondary-50 py-8"><div className="container-main"><div className="max-w-3xl rounded-2xl bg-white p-6 shadow-card sm:p-8"><p className="font-bold text-primary-700">خدمة تصميم</p><h1 className="mt-2 text-3xl font-black">طلب تصميم كرت طبيب أسنان</h1><p className="mt-3 leading-7 text-secondary-600">هذه خدمة طلب متكاملة وليست محرراً وهمياً. تراجع الإدارة البيانات، تعرض السعر ومدة التنفيذ وعدد التعديلات، ثم تتابع الحالة من لوحة حسابك.</p><DentalCardForm /></div></div></div></RequireAuth>; }
