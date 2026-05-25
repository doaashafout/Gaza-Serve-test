import { useState, useEffect } from 'react';
import { getUsers, blockUser, unblockUser, getUserRequests } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [userRequests, setUserRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const { addToast } = useToast();

  const fetch = async (p = page, q = search) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getUsers({ page: p, search: q });
      setUsers(data?.users ?? data?.data ?? []);
      setTotalPages(data?.totalPages ?? data?.last_page ?? 1);
    } catch (e) {
      setError(e.response?.data?.message || 'فشل في تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetch(1, search);
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetch(p, search);
  };

  const toggleBlock = (user) => {
    setSelectedUser(user);
    setConfirmOpen(true);
  };

  const handleToggleBlock = async () => {
    try {
      if (selectedUser.is_blocked) {
        await unblockUser(selectedUser.user_id);
        addToast('تم إلغاء حظر المستخدم', 'success');
      } else {
        await blockUser(selectedUser.user_id);
        addToast('تم حظر المستخدم', 'success');
      }
      setConfirmOpen(false);
      fetch(page, search);
    } catch (e) {
      addToast(e.response?.data?.message || 'حدث خطأ', 'error');
      setConfirmOpen(false);
    }
  };

  const handleViewRequests = async (user) => {
    setSelectedUser(user);
    setRequestsOpen(true);
    setRequestsLoading(true);
    try {
      const { data } = await getUserRequests(user.user_id);
      setUserRequests(data?.requests ?? data?.data ?? data ?? []);
    } catch (e) {
      addToast('فشل في تحميل الطلبات', 'error');
      setUserRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">المستخدمين</h1>

      <form onSubmit={handleSearch} className="mb-6">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث عن مستخدم..."
          className="w-full max-w-md px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all"
        />
      </form>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-lg">جاري التحميل...</div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-800 text-red-400 p-4 rounded-xl">{error}</div>
      ) : users.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <div className="text-5xl mb-4">👥</div>
          <p className="text-gray-500 text-lg">لا يوجد مستخدمين</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">المعرف</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">الاسم</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">رقم التيليجرام</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">الحالة</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">عدد الطلبات</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">العمليات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">{u.user_id}</td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">{u.full_name || u.name || u.username}</td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50" dir="ltr">{u.telegram_id || u.phone}</td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${u.is_blocked ? 'bg-red-900/30 text-red-400' : 'bg-emerald-900/30 text-emerald-400'}`}>
                        {u.is_blocked ? 'محظور' : 'نشط'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">{u.requests_count ?? 0}</td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">
                      <div className="flex gap-2">
                        <button onClick={() => toggleBlock(u)} className={`px-3 py-1.5 rounded-lg text-xs transition-all ${u.is_blocked ? 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50' : 'bg-red-900/30 text-red-400 hover:bg-red-900/50'}`}>
                          {u.is_blocked ? 'إلغاء الحظر' : 'حظر'}
                        </button>
                        <button onClick={() => handleViewRequests(u)} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs transition-all">عرض الطلبات</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleToggleBlock}
        title={selectedUser?.is_blocked ? 'إلغاء حظر المستخدم' : 'حظر المستخدم'}
        message={`هل أنت متأكد من ${selectedUser?.is_blocked ? 'إلغاء حظر' : 'حظر'} هذا المستخدم؟`}
        confirmText={selectedUser?.is_blocked ? 'إلغاء الحظر' : 'حظر'}
        danger={!selectedUser?.is_blocked}
      />

      <Modal open={requestsOpen} onClose={() => setRequestsOpen(false)} title={`طلبات ${selectedUser?.full_name || selectedUser?.name || ''}`} size="lg">
        {requestsLoading ? (
          <div className="text-center text-gray-400 py-8">جاري التحميل...</div>
        ) : userRequests.length === 0 ? (
          <div className="text-center text-gray-500 py-8">لا توجد طلبات</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-right text-xs text-gray-500 border-b border-gray-800">رقم</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-500 border-b border-gray-800">الوصف</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-500 border-b border-gray-800">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {userRequests.map((r) => (
                  <tr key={r.request_id} className="hover:bg-gray-800/30">
                    <td className="px-3 py-2 text-sm border-b border-gray-800/50">{r.request_id}</td>
                    <td className="px-3 py-2 text-sm border-b border-gray-800/50 max-w-xs truncate">{r.description || r.title}</td>
                    <td className="px-3 py-2 text-sm border-b border-gray-800/50">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
