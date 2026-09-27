'use client';

export default function ConfirmDialog({ open, title = 'تأكيد العملية', message, confirmLabel = 'تأكيد', busy = false, onConfirm, onClose }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-secondary-950/50 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 id="confirm-title" className="text-xl font-black">{title}</h2><p className="mt-3 leading-7 text-secondary-600">{message}</p><div className="mt-6 flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={onConfirm} className="btn-primary">{busy ? 'جارٍ الحفظ…' : confirmLabel}</button><button type="button" disabled={busy} onClick={onClose} className="btn-secondary">إلغاء</button></div></div></div>;
}
