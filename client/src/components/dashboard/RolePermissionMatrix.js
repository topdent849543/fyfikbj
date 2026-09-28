'use client';

import { useMemo, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { apiError } from '@/lib/format';

export default function RolePermissionMatrix({ roles = [], permissions = [], canEdit = false, onSaved }) {
  const [selectedRole, setSelectedRole] = useState(roles[0]?.id || '');
  const [saving, setSaving] = useState(false);
  const role = roles.find((item) => item.id === selectedRole) || roles[0];
  const assigned = useMemo(() => new Set((role?.role_permissions || []).map((entry) => entry.permission?.id).filter(Boolean)), [role]);
  const modules = useMemo(() => [...permissions.reduce((map, permission) => { if (!map.has(permission.module)) map.set(permission.module, []); map.get(permission.module).push(permission); return map; }, new Map())], [permissions]);
  const [draft, setDraft] = useState(null);
  const active = draft || assigned;
  const toggle = (id) => setDraft((current) => { const next = new Set(current || assigned); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const save = async () => { if (!role || role.key === 'platform_owner') return; setSaving(true); try { await api.put(`/platform/roles/${role.id}/permissions`, { permissionIds: [...active] }); toast.success('تم حفظ صلاحيات الدور'); setDraft(null); onSaved?.(); } catch (error) { toast.error(apiError(error)); } finally { setSaving(false); } };
  if (!roles.length) return <div className="rounded-2xl bg-white p-8 text-secondary-600 shadow-card">لا توجد أدوار متاحة.</div>;
  return <div className="space-y-5"><div className="rounded-2xl bg-white p-5 shadow-card"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">تعديل صلاحيات الأدوار</h2><p className="mt-1 text-sm text-secondary-500">اختر الدور ثم فعّل أو أوقف الصلاحيات بشكل كامل. دور المدير العام محمي.</p></div><select className="input-base max-w-xs" value={role?.id || ''} onChange={(event) => { setSelectedRole(event.target.value); setDraft(null); }}>{roles.map((item) => <option key={item.id} value={item.id}>{item.name_ar} — {item.key}</option>)}</select></div><div className="mt-4 flex flex-wrap gap-2">{canEdit && role?.key !== 'platform_owner' && <><button className="btn-primary" disabled={saving} onClick={save}>{saving ? 'جارٍ الحفظ…' : 'حفظ الصلاحيات'}</button><button className="btn-secondary" onClick={() => setDraft(new Set())}>إلغاء كل الصلاحيات</button><button className="btn-secondary" onClick={() => setDraft(new Set(permissions.map((item) => item.id)))}>منح الكل</button></>}</div></div><div className="grid gap-5 md:grid-cols-2">{modules.map(([module, items]) => <section key={module} className="rounded-2xl bg-white p-5 shadow-card"><h3 className="mb-4 border-b pb-3 font-black">{module}</h3><div className="space-y-3">{items.map((permission) => <label key={permission.id} className="flex cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4" checked={active.has(permission.id)} disabled={!canEdit || role?.key === 'platform_owner'} onChange={() => toggle(permission.id)} /><span><span className="block font-bold">{permission.name_ar}</span><span className="text-xs text-secondary-500">{permission.key} — {permission.description || 'بدون وصف'}</span></span></label>)}</div></section>)}</div></div>;
}
