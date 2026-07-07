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
        await updateCategory(editing.category_id, form);
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

  if (loading) return <div className="loading-container"><span className="loading-text">جاري التحميل...</span></div>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">التصنيفات</h1>
        <button onClick={openAdd} className="btn btn-primary">+ إضافة تصنيف</button>
      </div>

      {categories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          <p className="empty-state-text">لا توجد تصنيفات بعد</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>المعرف</th>
                <th>الاسم (عربي)</th>
                <th>الاسم (إنجليزي)</th>
                <th>العمليات</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.category_id}>
                  <td>{cat.category_id}</td>
                  <td>{cat.name_ar}</td>
                  <td>{cat.name_en}</td>
                  <td>
                    <div className="flex-row" style={{ gap: 6 }}>
                      <button onClick={() => openEdit(cat)} className="btn btn-ghost btn-xs">تعديل</button>
                      <button onClick={() => confirmDelete(cat.category_id)} className="btn btn-danger btn-xs">حذف</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل تصنيف' : 'إضافة تصنيف'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label>الاسم (عربي)</label>
            <input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} className="input" placeholder="اسم التصنيف بالعربية" />
          </div>
          <div>
            <label>الاسم (إنجليزي)</label>
            <input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} className="input" placeholder="Category name in English" dir="ltr" />
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
        title="حذف التصنيف"
        message="هل أنت متأكد من حذف هذا التصنيف؟"
        confirmText="حذف"
        danger
      />
    </div>
  );
}
