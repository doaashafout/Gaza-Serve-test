export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'تأكيد', danger = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className="text-4xl mb-4">{danger ? '⚠️' : '❓'}</div>
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <p className="text-gray-400 text-sm mb-6">{message}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={onClose} className="px-6 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-all">إلغاء</button>
            <button onClick={onConfirm} className={`px-6 py-2 rounded-lg text-sm text-white transition-all ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-cyan-600 hover:bg-cyan-700'
            }`}>{confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
