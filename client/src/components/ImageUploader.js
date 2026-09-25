'use client';

import { useRef, useState } from 'react';
import { FiImage, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { apiError } from '@/lib/format';

export default function ImageUploader({ value = [], onChange, min = 0 }) {
  const inputRef = useRef(null); const [uploading, setUploading] = useState(false);
  const upload = async (event) => { const files = Array.from(event.target.files || []); if (!files.length) return; if (value.length + files.length > 10) return toast.error('يمكن رفع 10 صور كحد أقصى'); const data = new FormData(); files.forEach((file) => data.append('files', file)); setUploading(true); try { const response = await api.post('/upload/images', data, { headers: { 'Content-Type': 'multipart/form-data' } }); onChange([...value, ...(response.files || []).map((file) => file.url)]); toast.success('تم رفع الصور وحفظها بشكل دائم'); } catch (error) { toast.error(apiError(error)); } finally { setUploading(false); event.target.value = ''; } };
  return <div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{value.map((url) => <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-secondary-200"><img src={url} alt="صورة مرفوعة" className="h-full w-full object-cover" /><button type="button" onClick={() => onChange(value.filter((item) => item !== url))} className="absolute left-2 top-2 rounded-lg bg-white/90 p-2 text-red-600 opacity-0 shadow group-hover:opacity-100"><FiTrash2 /></button></div>)}<button type="button" disabled={uploading || value.length >= 10} onClick={() => inputRef.current?.click()} className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-secondary-300 p-3 text-center text-sm text-secondary-600 hover:border-primary-500 hover:text-primary-700 disabled:opacity-50"><FiUploadCloud className="mb-2 text-2xl" />{uploading ? 'جارٍ الرفع...' : 'رفع صور'}</button></div><input ref={inputRef} onChange={upload} accept="image/jpeg,image/png,image/webp" multiple type="file" className="hidden" /><p className="mt-2 text-xs text-secondary-500">JPEG أو PNG أو WebP فقط، حتى 8MB للصورة. تُحوّل الصور وتُخزن في Supabase Storage. {min ? `مطلوب ${min} صور على الأقل.` : ''}</p></div>;
}
