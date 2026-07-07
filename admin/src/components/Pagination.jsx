export default function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  const pages = [];
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) {
    pages.push(i);
  }
  return (
    <div className="pagination">
      <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="page-btn">
        السابق
      </button>
      {pages.map(p => (
        <button key={p} onClick={() => onPageChange(p)} className={`page-btn ${p === page ? 'active' : ''}`}>
          {p}
        </button>
      ))}
      <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="page-btn">
        التالي
      </button>
    </div>
  );
}
