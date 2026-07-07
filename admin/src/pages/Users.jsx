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
      <h1 className="page-title" style={{ marginBottom: 24 }}>المستخدمين</h1>

      <form onSubmit={handleSearch} style={{ marginBottom: 20 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث عن مستخدم..."
          className="input"
          style={{ maxWidth: 400 }}
        />
      </form>

      {loading ? (
        <div className="loading-container"><span className="loading-text">جاري التحميل...</span></div>
      ) : error ? (
        <div className="error-box">{error}</div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👥</div>
          <p className="empty-state-text">لا يوجد مستخدمين</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>المعرف</th>
                  <th>الاسم</th>
                  <th>رقم التيليجرام</th>
                  <th>الحالة</th>
                  <th>عدد الطلبات</th>
                  <th>العمليات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id}>
                    <td>{u.user_id}</td>
                    <td>{u.full_name || u.name || u.username}</td>
                    <td dir="ltr">{u.telegram_id || u.phone}</td>
                    <td>
                      <span className={`badge ${u.is_blocked ? 'badge-blocked' : 'badge-active'}`}>
                        {u.is_blocked ? 'محظور' : 'نشط'}
                      </span>
                    </td>
                    <td>{u.requests_count ?? 0}</td>
                    <td>
                      <div className="flex-row" style={{ gap: 6 }}>
                        <button onClick={() => toggleBlock(u)} className={`btn btn-xs ${u.is_blocked ? 'btn-outline' : 'btn-danger'}`}>
                          {u.is_blocked ? 'إلغاء الحظر' : 'حظر'}
                        </button>
                        <button onClick={() => handleViewRequests(u)} className="btn btn-ghost btn-xs">عرض الطلبات</button>
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
          <div className="loading-container"><span className="loading-text">جاري التحميل...</span></div>
        ) : userRequests.length === 0 ? (
          <div className="empty-state"><p className="empty-state-text">لا توجد طلبات</p></div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>رقم</th>
                  <th>الوصف</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {userRequests.map((r) => (
                  <tr key={r.request_id}>
                    <td>{r.request_id}</td>
                    <td className="truncate max-w-xs">{r.description || r.title}</td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
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
