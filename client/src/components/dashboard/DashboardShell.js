'use client';

import DashboardSidebar from './DashboardSidebar';

export default function DashboardShell({ title, eyebrow, items, active, onSelect, children }) {
  return <main className="min-h-screen bg-secondary-50 py-6 sm:py-8">
    <div className="container-main">
      <div className="mb-6 rounded-2xl bg-gradient-to-l from-primary-800 to-primary-600 p-6 text-white shadow-card">
        <p className="text-sm font-bold text-primary-100">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-primary-100">الرئيسية / لوحة التحكم / {title}</p>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <DashboardSidebar items={items} active={active} onSelect={onSelect} />
        <section className="min-w-0 flex-1">{children}</section>
      </div>
    </div>
  </main>;
}
