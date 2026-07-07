import { useState, useEffect } from 'react';
import { getAdmins, createAdmin, updateAdmin, deleteAdmin } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

const roles = ['Super Admin', 'Support Admin', 'Moderator'];
const roleLabels = {
  'Super Admin': 'مشرف عام',
  'Support Admin': 'مشرف دعم',
  'Moderator': 'مشرف',
};

export default function Admins() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', telegram_id: '', role: 'Support Admin' });
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const { addToast } = useToast();

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getAdmins();
      setAdmins(data?.admins ?? data?.data ?? []);
    } catch (e) {
      setError(e.response?.data?.message || 'فشل في تحميل المشرفين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', telegram_id: '', role: 'Support Admin' });
    setModalOpen(true);
  };

  const openEdit = (admin) => {
    setEditing(admin);
    setForm({ name: admin.name, telegram_id: admin.telegram_id, role: admin.role });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.telegram_id.trim()) {
      addToast('يرجى ملء جميع الحقول', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateAdmin(editing.admin_id, form);
        addToast('تم تحديث المشرف بنجاح', 'success');
      } else {
        await createAdmin(form);
        addToast('تم إضافة المشرف بنجاح', 'success');
      }
      setModalOpen(false);
      fetch();
    } catch (e) {
      addToast(e.response?.data?.message || 'حدث خطأ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (id) => {
    setDeletingId(id);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    try {
      await deleteAdmin(deletingId);
      addToast('تم حذف المشرف بنجاح', 'success');
      setConfirmOpen(false);
      fetch();
    } catch (e) {
      addToast(e.response?.data?.message || 'حدث خطأ', 'error');
      setConfirmOpen(false);
    }
  };

  if (loading) return <div className="loading-container"><span className="loading-text">جاري التحميل...</span></div>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">المشرفين</h1>
        <button onClick={openAdd} className="btn btn-primary">+ إضافة مشرف</button>
      </div>

      {admins.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🛡️</div>
          <p className="empty-state-text">لا يوجد مشرفين</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>المعرف</th>
                <th>اسم المشرف</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th>العمليات</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.admin_id}>
                  <td>{admin.admin_id}</td>
                  <td>{admin.name}</td>
                  <td><span className="tag">{roleLabels[admin.role] || admin.role}</span></td>
                  <td>
                    <span className={`badge ${admin.is_active ? 'badge-active' : 'badge-blocked'}`}>
                      {admin.is_active ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                  <td>
                    <div className="flex-row" style={{ gap: 6 }}>
                      <button onClick={() => openEdit(admin)} className="btn btn-ghost btn-xs">تعديل</button>
                      <button onClick={() => confirmDelete(admin.admin_id)} className="btn btn-danger btn-xs">حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل مشرف' : 'إضافة مشرف'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label>الاسم</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input" placeholder="اسم المشرف" />
          </div>
          <div>
            <label>رقم التيليجرام</label>
            <input value={form.telegram_id} onChange={e => setForm({ ...form, telegram_id: e.target.value })} className="input" placeholder="معرف التيليجرام" dir="ltr" />
          </div>
          <div>
            <label>الدور</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input">
              {roles.map((r) => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </select>
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-outline">إلغاء</button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'جاري الحفظ...' : editing ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="حذف مشرف"
        message="هل أنت متأكد من حذف هذا المشرف؟"
        confirmText="حذف"
        danger
      />
    </div>
  );
}
