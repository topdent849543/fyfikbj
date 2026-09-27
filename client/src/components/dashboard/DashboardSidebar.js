'use client';

import PermissionGate from './PermissionGate';

export default function DashboardSidebar({ items, active, onSelect }) {
  return <aside className="w-full shrink-0 rounded-2xl bg-white p-3 shadow-card lg:sticky lg:top-24 lg:w-64 lg:self-start">
    <nav aria-label="أقسام لوحة التحكم" className="flex gap-1 overflow-x-auto lg:flex-col">
      {items.map((item) => <PermissionGate key={item.id} permission={item.permission} anyOf={item.anyOf}>
        <button type="button" onClick={() => onSelect(item.id)} className={`whitespace-nowrap rounded-xl px-4 py-3 text-right text-sm font-bold transition ${active === item.id ? 'bg-primary-700 text-white' : 'text-secondary-700 hover:bg-secondary-50'}`}>
          {item.label}
        </button>
      </PermissionGate>)}
    </nav>
  </aside>;
}
