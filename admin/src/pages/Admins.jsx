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
        await updateAdmin(editing.id, form);
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

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-lg">جاري التحميل...</div>;
  if (error) return <div className="bg-red-900/30 border border-red-800 text-red-400 p-4 rounded-xl">{error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">المشرفين</h1>
        <button onClick={openAdd} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-l from-cyan-500 to-purple-600 hover:opacity-90 transition-all">
          + إضافة مشرف
        </button>
      </div>

      {admins.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <div className="text-5xl mb-4">🛡️</div>
          <p className="text-gray-500 text-lg">لا يوجد مشرفين</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">المعرف</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">اسم المشرف</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">الدور</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">الحالة</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">العمليات</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50">{admin.id}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50">{admin.name}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50">
                    <span className="px-2.5 py-1 rounded-lg bg-gray-800 text-xs">{roleLabels[admin.role] || admin.role}</span>
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${admin.is_active ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                      {admin.is_active ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(admin)} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs transition-all">تعديل</button>
                      <button onClick={() => confirmDelete(admin.id)} className="px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs transition-all">حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل مشرف' : 'إضافة مشرف'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">الاسم</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all" placeholder="اسم المشرف" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">رقم التيليجرام</label>
            <input value={form.telegram_id} onChange={e => setForm({ ...form, telegram_id: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all" placeholder="معرف التيليجرام" dir="ltr" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">الدور</label>
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all">
              {roles.map((r) => (
                <option key={r} value={r}>{roleLabels[r]}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm transition-all">إلغاء</button>
            <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-l from-cyan-500 to-purple-600 hover:opacity-90 disabled:opacity-50 transition-all">
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
