export default function StatsCard({ label, value, caption, onClick }) {
  const content = <><p className="text-sm text-secondary-500">{label}</p><p className="mt-2 text-2xl font-black text-primary-700">{value ?? '—'}</p>{caption && <p className="mt-1 text-xs text-secondary-500">{caption}</p>}</>;
  return onClick ? <button type="button" onClick={onClick} className="rounded-2xl bg-white p-5 text-right shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">{content}</button> : <div className="rounded-2xl bg-white p-5 shadow-card">{content}</div>;
}
