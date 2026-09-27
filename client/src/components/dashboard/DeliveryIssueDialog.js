'use client';

import { useState } from 'react';

const issues = { customer_not_available: 'العميل غير موجود', customer_refused: 'رفض الاستلام', wrong_address: 'عنوان خاطئ', payment_problem: 'مشكلة بالمبلغ', missing_product: 'المنتج ناقص', other: 'مشكلة أخرى' };

export default function DeliveryIssueDialog({ open, busy = false, onSubmit, onClose }) {
  const [issueType, setIssueType] = useState('customer_not_available');
  const [notes, setNotes] = useState('');
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-secondary-950/50 p-4"><form onSubmit={(event) => { event.preventDefault(); onSubmit({ issueType, notes: notes || undefined }); }} role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">تسجيل مشكلة توصيل</h2><select value={issueType} onChange={(event) => setIssueType(event.target.value)} className="input-base mt-4">{Object.entries(issues).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="input-base mt-3 min-h-24" placeholder="ملاحظات إضافية…" /><div className="mt-6 flex flex-wrap gap-3"><button disabled={busy} className="btn-primary">{busy ? 'جارٍ الحفظ…' : 'تسجيل المشكلة'}</button><button type="button" disabled={busy} onClick={onClose} className="btn-secondary">إلغاء</button></div></form></div>;
}
