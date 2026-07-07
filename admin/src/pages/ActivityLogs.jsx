import { useState, useEffect } from 'react';
import { getLogs } from '../api';
import Pagination from '../components/Pagination';

export default function ActivityLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actions, setActions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetch = async (p = page, q = search, action = actionFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: p };
      if (q) params.search = q;
      if (action) params.action = action;
      const { data } = await getLogs(params);
      const items = data?.logs ?? data?.data ?? [];
      setLogs(items);
      setTotalPages(data?.totalPages ?? data?.last_page ?? 1);
      if (items.length && !actions.length) {
        const unique = [...new Set(items.map(l => l.action).filter(Boolean))];
        setActions(unique);
      }
    } catch (e) {
      setError(e.response?.data?.message || 'فشل في تحميل السجلات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetch(1, search, actionFilter);
  };

  const handleActionFilter = (action) => {
    setActionFilter(action);
    setPage(1);
    fetch(1, search, action);
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetch(p, search, actionFilter);
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>سجل النشاطات</h1>

      <div className="flex-wrap" style={{ marginBottom: 20 }}>
        <form onSubmit={handleSearch}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث عن مستخدم أو تفاصيل..."
            className="input"
            style={{ width: 280 }}
          />
        </form>

        {actions.length > 0 && (
          <select
            value={actionFilter}
            onChange={e => handleActionFilter(e.target.value)}
            className="input"
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="">جميع الإجراءات</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="loading-container"><span className="loading-text">جاري التحميل...</span></div>
      ) : error ? (
        <div className="error-box">{error}</div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📜</div>
          <p className="empty-state-text">لا توجد سجلات</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>التوقيت</th>
                  <th>المستخدم</th>
                  <th>الإجراء</th>
                  <th>التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id || i}>
                    <td className="text-small text-muted" style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                    <td>{log.admin_name || log.user_name || log.user?.name || '—'}</td>
                    <td>
                      <span className="tag">{log.action}</span>
                    </td>
                    <td className="truncate max-w-xs">{log.details || log.message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}
    </div>
  );
}
