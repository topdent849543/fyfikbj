'use client';

import { useMemo } from 'react';

export default function RolePermissionMatrix({ roles = [] }) {
  const modules = useMemo(() => {
    const grouped = new Map();
    roles.forEach((role) => (role.role_permissions || []).forEach((entry) => {
      const permission = entry.permission;
      if (!permission) return;
      if (!grouped.has(permission.module)) grouped.set(permission.module, []);
      if (!grouped.get(permission.module).some((item) => item.id === permission.id)) grouped.get(permission.module).push(permission);
    }));
    return [...grouped.entries()];
  }, [roles]);
  if (!roles.length) return <div className="rounded-2xl bg-white p-8 text-secondary-600 shadow-card">لا توجد أدوار متاحة.</div>;
  return <div className="space-y-5">{modules.map(([module, permissions]) => <section key={module} className="overflow-x-auto rounded-2xl bg-white shadow-card"><h3 className="border-b p-4 font-black">{module}</h3><table className="min-w-full text-sm"><thead><tr className="border-b bg-secondary-50 text-right"><th className="p-3">الصلاحية</th>{roles.map((role) => <th key={role.id} className="p-3">{role.name_ar}</th>)}</tr></thead><tbody>{permissions.map((permission) => <tr key={permission.id} className="border-b last:border-0"><td className="p-3 font-bold">{permission.name_ar}</td>{roles.map((role) => <td key={role.id} className="p-3 text-center">{(role.role_permissions || []).some((entry) => entry.permission?.id === permission.id) ? '✓' : '—'}</td>)}</tr>)}</tbody></table></section>)}</div>;
}
