import { useState, useEffect } from 'react';
import { sendBroadcast, getLogs } from '../api';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ConfirmModal';

const targets = [
  { value: 'all', label: 'جميع المستخدمين' },
  { value: 'all_technicians', label: 'جميع الفنيين' },
  { value: 'available_technicians', label: 'فنيين متاحين' },
];

export default function Notifications() {
  const [target, setTarget] = useState('all');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const { data } = await getLogs({ type: 'notification', limit: 50 });
        setHistory(data?.logs ?? data?.data ?? []);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleSend = () => {
    if (!message.trim()) { addToast('يرجى كتابة محتوى الإشعار', 'error'); return; }
    setConfirmOpen(true);
  };

  const confirmSend = async () => {
    setSending(true);
    setConfirmOpen(false);
    try {
      await sendBroadcast({ target, message });
      addToast('تم إرسال الإشعار بنجاح', 'success');
      setMessage('');
      const { data } = await getLogs({ type: 'notification', limit: 50 });
      setHistory(data?.logs ?? data?.data ?? []);
    } catch (e) {
      addToast(e.response?.data?.message || 'حدث خطأ في الإرسال', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>الإشعارات الجماعية</h1>

      <div className="form-section" style={{ marginBottom: 32 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ marginBottom: 8 }}>المستهدف</label>
          <div className="filter-group">
            {targets.map((t) => (
              <button
                key={t.value}
                onClick={() => setTarget(t.value)}
                className={`filter-btn ${target === t.value ? 'active' : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ marginBottom: 8 }}>محتوى الإشعار</label>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            rows={5}
            className="input"
            placeholder="اكتب نص الإشعار هنا..."
          />
        </div>

        <button onClick={handleSend} disabled={sending} className="btn btn-primary">
          {sending ? 'جاري الإرسال...' : 'إرسال الإشعار'}
        </button>
      </div>

      <h2 className="section-title">سجل الإشعارات</h2>

      {historyLoading ? (
        <div className="loading-container"><span className="loading-text">جاري التحميل...</span></div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔔</div>
          <p className="empty-state-text">لا توجد إشعارات سابقة</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>التوقيت</th>
                <th>المستهدف</th>
                <th>المحتوى</th>
              </tr>
            </thead>
            <tbody>
              {history.map((log, i) => (
                <tr key={log.id || i}>
                  <td className="text-small text-muted" style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                  <td>{log.target || log.action}</td>
                  <td className="truncate max-w-xs">{log.message || log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmSend}
        title="إرسال إشعار"
        message={`هل أنت متأكد من إرسال هذا الإشعار إلى ${targets.find(t => t.value === target)?.label}؟`}
        confirmText="إرسال"
      />
    </div>
  );
}
