export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pages.push(i);
  }
  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1}
        className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-40 text-sm hover:bg-gray-700 transition-all">
        السابق
      </button>
      {pages.map(p => (
        <button key={p} onClick={() => onPageChange(p)}
          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
            p === page ? 'bg-cyan-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}>{p}</button>
      ))}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 disabled:opacity-40 text-sm hover:bg-gray-700 transition-all">
        التالي
      </button>
    </div>
  );
}
