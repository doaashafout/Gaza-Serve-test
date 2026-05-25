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
      <h1 className="text-2xl font-bold mb-6">الإشعارات الجماعية</h1>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">المستهدف</label>
          <div className="flex gap-2 flex-wrap">
            {targets.map((t) => (
              <button
                key={t.value}
                onClick={() => setTarget(t.value)}
                className={`px-4 py-2 rounded-xl text-sm transition-all ${target === t.value ? 'bg-gradient-to-l from-cyan-500 to-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">محتوى الإشعار</label>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)}
            rows={5}
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all resize-none"
            placeholder="اكتب نص الإشعار هنا..."
          />
        </div>

        <button
          onClick={handleSend}
          disabled={sending}
          className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-l from-cyan-500 to-purple-600 hover:opacity-90 disabled:opacity-50 transition-all"
        >
          {sending ? 'جاري الإرسال...' : 'إرسال الإشعار'}
        </button>
      </div>

      <h2 className="text-lg font-semibold mb-4">سجل الإشعارات</h2>

      {historyLoading ? (
        <div className="text-center text-gray-500 py-8">جاري التحميل...</div>
      ) : history.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <div className="text-5xl mb-4">🔔</div>
          <p className="text-gray-500 text-lg">لا توجد إشعارات سابقة</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">التوقيت</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">المستهدف</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">المحتوى</th>
              </tr>
            </thead>
            <tbody>
              {history.map((log, i) => (
                <tr key={log.id || i} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50 whitespace-nowrap">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50">{log.target || log.action}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50 max-w-xs truncate">{log.message || log.details}</td>
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
