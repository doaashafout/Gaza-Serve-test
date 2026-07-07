export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmText = 'تأكيد', danger = false }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box sm" onClick={e => e.stopPropagation()}>
        <div className="confirm-body">
          <div className="confirm-icon">{danger ? '⚠️' : '❓'}</div>
          <h3 className="confirm-title">{title}</h3>
          <p className="confirm-message">{message}</p>
          <div className="confirm-actions">
            <button onClick={onClose} className="btn btn-outline">إلغاء</button>
            <button onClick={onConfirm} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}>{confirmText}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
