import { useState, useEffect } from 'react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name_ar: '', name_en: '' });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { addToast } = useToast();

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getCategories();
      setCategories(data?.categories ?? data ?? []);
    } catch (e) {
      setError(e.response?.data?.message || 'فشل في تحميل التصنيفات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name_ar: '', name_en: '' });
    setModalOpen(true);
  };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({ name_ar: cat.name_ar, name_en: cat.name_en });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name_ar.trim() || !form.name_en.trim()) {
      addToast('يرجى ملء جميع الحقول', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateCategory(editing.id, form);
        addToast('تم تحديث التصنيف بنجاح', 'success');
      } else {
        await createCategory(form);
        addToast('تم إضافة التصنيف بنجاح', 'success');
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
      await deleteCategory(deletingId);
      addToast('تم حذف التصنيف بنجاح', 'success');
      setConfirmOpen(false);
      fetch();
    } catch (e) {
      addToast(e.response?.data?.message || 'لا يمكن حذف التصنيف', 'error');
      setConfirmOpen(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-lg">جاري التحميل...</div>;
  if (error) return <div className="bg-red-900/30 border border-red-800 text-red-400 p-4 rounded-xl">{error}</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">التصنيفات</h1>
        <button onClick={openAdd} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-l from-cyan-500 to-purple-600 hover:opacity-90 transition-all">
          + إضافة تصنيف
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <div className="text-5xl mb-4">📂</div>
          <p className="text-gray-500 text-lg">لا توجد تصنيفات بعد</p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">المعرف</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">الاسم (عربي)</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">الاسم (إنجليزي)</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">العمليات</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50">{cat.id}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50">{cat.name_ar}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50">{cat.name_en}</td>
                  <td className="px-4 py-3 text-sm border-b border-gray-800/50">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(cat)} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs transition-all">تعديل</button>
                      <button onClick={() => confirmDelete(cat.id)} className="px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs transition-all">حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل تصنيف' : 'إضافة تصنيف'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">الاسم (عربي)</label>
            <input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all" placeholder="اسم التصنيف بالعربية" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">الاسم (إنجليزي)</label>
            <input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all" placeholder="Category name in English" dir="ltr" />
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
        title="حذف التصنيف"
        message="هل أنت متأكد من حذف هذا التصنيف؟"
        confirmText="حذف"
        danger
      />
    </div>
  );
}
