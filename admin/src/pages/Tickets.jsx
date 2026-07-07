import { useState, useEffect } from 'react';
import { getTickets, replyTicket } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';

const statusLabels = { open: 'مفتوحة', replied: 'تم الرد', closed: 'مغلقة' };

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [replyOpen, setReplyOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [closingId, setClosingId] = useState(null);
  const { addToast } = useToast();

  const fetch = async (p = page, f = filter) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page: p };
      if (f !== 'all') params.status = f;
      const { data } = await getTickets(params);
      setTickets(data?.tickets ?? data?.data ?? []);
      setTotalPages(data?.totalPages ?? data?.last_page ?? 1);
    } catch (e) {
      setError(e.response?.data?.message || 'فشل في تحميل التذاكر');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleFilterChange = (f) => {
    setFilter(f);
    setPage(1);
    fetch(1, f);
  };

  const handlePageChange = (p) => {
    setPage(p);
    fetch(p, filter);
  };

  const openReply = (ticket) => {
    setSelectedTicket(ticket);
    setReplyText('');
    setReplyOpen(true);
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) { addToast('يرجى كتابة الرد', 'error'); return; }
    setReplying(true);
    try {
      await replyTicket(selectedTicket.ticket_id, replyText);
      addToast('تم إرسال الرد بنجاح', 'success');
      setReplyOpen(false);
      fetch(page, filter);
    } catch (e) {
      addToast(e.response?.data?.message || 'حدث خطأ', 'error');
    } finally {
      setReplying(false);
    }
  };

  const confirmClose = (id) => {
    setClosingId(id);
    setConfirmOpen(true);
  };

  const handleClose = async () => {
    try {
      await replyTicket(closingId, '__close__');
      addToast('تم إغلاق التذكرة', 'success');
      setConfirmOpen(false);
      fetch(page, filter);
    } catch (e) {
      addToast(e.response?.data?.message || 'حدث خطأ', 'error');
      setConfirmOpen(false);
    }
  };

  const filters = [
    { value: 'all', label: 'الكل' },
    { value: 'open', label: 'مفتوحة' },
    { value: 'replied', label: 'تم الرد' },
    { value: 'closed', label: 'مغلقة' },
  ];

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>الدعم الفني</h1>

      <div className="filter-group" style={{ marginBottom: 20 }}>
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`filter-btn ${filter === f.value ? 'active' : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-container"><span className="loading-text">جاري التحميل...</span></div>
      ) : error ? (
        <div className="error-box">{error}</div>
      ) : tickets.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📞</div>
          <p className="empty-state-text">لا توجد تذاكر</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم التذكرة</th>
                  <th>المستخدم</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                  <th>العمليات</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.ticket_id}>
                    <td>#{t.ticket_id}</td>
                    <td>{t.user?.full_name || t.user?.name || t.user_name || t.telegram_id}</td>
                    <td>
                      <span className={`badge badge-${t.status}`}>{statusLabels[t.status] || t.status}</span>
                    </td>
                    <td className="text-small text-muted">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                    <td>
                      <div className="flex-row" style={{ gap: 6 }}>
                        {t.status !== 'closed' && (
                          <>
                            {t.status === 'open' && (
                              <button onClick={() => openReply(t)} className="btn btn-primary btn-xs">رد</button>
                            )}
                            <button onClick={() => confirmClose(t.ticket_id)} className="btn btn-danger btn-xs">إغلاق</button>
                          </>
                        )}
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

      <Modal open={replyOpen} onClose={() => setReplyOpen(false)} title="الرد على التذكرة">
        <form onSubmit={handleReply} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label>الرسالة</label>
            <textarea
              value={replyText} onChange={e => setReplyText(e.target.value)}
              rows={5}
              className="input"
              placeholder="اكتب ردك هنا..."
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => setReplyOpen(false)} className="btn btn-outline">إلغاء</button>
            <button type="submit" disabled={replying} className="btn btn-primary">
              {replying ? 'جاري الإرسال...' : 'إرسال الرد'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleClose}
        title="إغلاق التذكرة"
        message="هل أنت متأكد من إغلاق هذه التذكرة؟"
        confirmText="إغلاق"
        danger
      />
    </div>
  );
}
