'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

function SelectField({ label, value, onChange, options, placeholder, required = false, disabled = false }) {
  return <label className="block text-sm font-bold">{label}{required && <span className="text-red-600"> *</span>}<select required={required} disabled={disabled} value={value || ''} onChange={(event) => onChange(event.target.value)} className="input-base mt-2"><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}</select></label>;
}

export function ProvinceSelect({ label = 'المحافظة', value, onChange, required = false, disabled = false }) {
  const [provinces, setProvinces] = useState([]);
  useEffect(() => { api.get('/delivery-rates/provinces').then((response) => setProvinces(response.provinces || [])).catch(() => setProvinces([])); }, []);
  return <SelectField label={label} value={value} onChange={onChange} options={provinces} placeholder="اختر المحافظة" required={required} disabled={disabled} />;
}

export function UniversitySelect({ label = 'الجامعة', value, onChange, province = '', required = false, disabled = false, optional = true }) {
  const [universities, setUniversities] = useState([]);
  useEffect(() => { const params = province ? `?province=${encodeURIComponent(province)}` : ''; api.get(`/catalog/universities${params}`).then((response) => setUniversities(response.universities || [])).catch(() => setUniversities([])); }, [province]);
  return <SelectField label={label} value={value} onChange={onChange} options={universities} placeholder={optional ? 'اختر الجامعة (اختياري)' : 'اختر الجامعة'} required={required} disabled={disabled || (!universities.length && Boolean(province))} />;
}
