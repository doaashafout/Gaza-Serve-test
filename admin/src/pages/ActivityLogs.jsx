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
      <h1 className="text-2xl font-bold mb-6">سجل النشاطات</h1>

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <form onSubmit={handleSearch}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث عن مستخدم أو تفاصيل..."
            className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all w-64"
          />
        </form>

        {actions.length > 0 && (
          <select
            value={actionFilter}
            onChange={e => handleActionFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all"
          >
            <option value="">جميع الإجراءات</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-lg">جاري التحميل...</div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-800 text-red-400 p-4 rounded-xl">{error}</div>
      ) : logs.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <div className="text-5xl mb-4">📜</div>
          <p className="text-gray-500 text-lg">لا توجد سجلات</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">التوقيت</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">المستخدم</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">الإجراء</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={log.id || i} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50 whitespace-nowrap">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">{log.admin_name || log.user_name || log.user?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">
                      <span className="px-2.5 py-1 rounded-lg bg-gray-800 text-xs">{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50 max-w-xs truncate">{log.details || log.message || '—'}</td>
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
