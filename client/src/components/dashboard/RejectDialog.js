'use client';

import { useState } from 'react';

export default function RejectDialog({ open, title = 'سبب الرفض أو الإلغاء', busy = false, onSubmit, onClose }) {
  const [reason, setReason] = useState('');
  if (!open) return null;
  const submit = (event) => { event.preventDefault(); if (reason.trim()) onSubmit(reason.trim()); };
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-secondary-950/50 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">{title}</h2><textarea required value={reason} onChange={(event) => setReason(event.target.value)} className="input-base mt-4 min-h-28" placeholder="اكتب سبباً واضحاً يظهر في سجل الطلب…" /><div className="mt-6 flex flex-wrap gap-3"><button disabled={busy} className="btn-primary">{busy ? 'جارٍ الحفظ…' : 'حفظ السبب'}</button><button type="button" disabled={busy} onClick={onClose} className="btn-secondary">إلغاء</button></div></form></div>;
}
