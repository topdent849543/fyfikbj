'use client';

import { useState } from 'react';

export default function AssignDriverDialog({ open, drivers = [], busy = false, onSubmit, onClose }) {
  const [driverId, setDriverId] = useState('');
  const [note, setNote] = useState('');
  if (!open) return null;
  const submit = (event) => { event.preventDefault(); if (driverId) onSubmit({ driverId, note }); };
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-secondary-950/50 p-4"><form onSubmit={submit} role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-black">تعيين سائق</h2><label className="mt-4 block text-sm font-bold">السائق<select required value={driverId} onChange={(event) => setDriverId(event.target.value)} className="input-base mt-2"><option value="">اختر سائقاً متاحاً</option>{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.user?.full_name || driver.id}{driver.plate_number ? ` — ${driver.plate_number}` : ''}</option>)}</select></label><label className="mt-4 block text-sm font-bold">ملاحظة اختيارية<textarea value={note} onChange={(event) => setNote(event.target.value)} className="input-base mt-2 min-h-20" /></label><div className="mt-6 flex flex-wrap gap-3"><button disabled={busy} className="btn-primary">{busy ? 'جارٍ التعيين…' : 'تعيين السائق'}</button><button type="button" disabled={busy} onClick={onClose} className="btn-secondary">إلغاء</button></div></form></div>;
}
