export default function DataTable({ columns, rows, empty = 'لا توجد بيانات لعرضها.' }) {
  if (!rows?.length) return <div className="rounded-2xl bg-white p-10 text-center text-secondary-600 shadow-card">{empty}</div>;
  return <div className="overflow-x-auto rounded-2xl bg-white shadow-card"><table className="min-w-full text-sm"><thead><tr className="border-b bg-secondary-50 text-right">{columns.map((column) => <th key={column.key} className="p-4 font-black">{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id || index} className="border-b last:border-0">{columns.map((column) => <td key={column.key} className="p-4 align-top">{typeof column.render === 'function' ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}
