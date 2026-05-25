import { useState, useEffect } from 'react';
import { getTickets, replyTicket } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';

const statusColors = {
  open: 'bg-yellow-900/30 text-yellow-400',
  replied: 'bg-blue-900/30 text-blue-400',
  closed: 'bg-emerald-900/30 text-emerald-400',
};

const statusLabels = {
  open: 'مفتوحة',
  replied: 'تم الرد',
  closed: 'مغلقة',
};

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
      <h1 className="text-2xl font-bold mb-6">الدعم الفني</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`px-4 py-2 rounded-xl text-sm transition-all ${filter === f.value ? 'bg-gradient-to-l from-cyan-500 to-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400 text-lg">جاري التحميل...</div>
      ) : error ? (
        <div className="bg-red-900/30 border border-red-800 text-red-400 p-4 rounded-xl">{error}</div>
      ) : tickets.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <div className="text-5xl mb-4">📞</div>
          <p className="text-gray-500 text-lg">لا توجد تذاكر</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">رقم التذكرة</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">المستخدم</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">الحالة</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">التاريخ</th>
                  <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">العمليات</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.ticket_id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">#{t.ticket_id}</td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">{t.user?.full_name || t.user?.name || t.user_name || t.telegram_id}</td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusColors[t.status] || 'bg-gray-800 text-gray-400'}`}>
                        {statusLabels[t.status] || t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">{new Date(t.created_at).toLocaleDateString('ar-EG')}</td>
                    <td className="px-4 py-3 text-sm border-b border-gray-800/50">
                      <div className="flex gap-2">
                        {t.status !== 'closed' && (
                          <>
                            {t.status === 'open' && (
                              <button onClick={() => openReply(t)} className="px-3 py-1.5 rounded-lg bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 text-xs transition-all">رد</button>
                            )}
                            <button onClick={() => confirmClose(t.ticket_id)} className="px-3 py-1.5 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 text-xs transition-all">إغلاق</button>
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
        <form onSubmit={handleReply} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">الرسالة</label>
            <textarea
              value={replyText} onChange={e => setReplyText(e.target.value)}
              rows={5}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all resize-none"
              placeholder="اكتب ردك هنا..."
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setReplyOpen(false)} className="px-5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm transition-all">إلغاء</button>
            <button type="submit" disabled={replying} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-l from-cyan-500 to-purple-600 hover:opacity-90 disabled:opacity-50 transition-all">
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
