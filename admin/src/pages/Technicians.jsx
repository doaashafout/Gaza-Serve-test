import { useState, useEffect } from 'react';
import { getTechnicians, getTechnician, createTechnician, updateTechnician, deleteTechnician, approveTechnician, rejectTechnician, getCategories } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';

const statusLabels = { pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض' };
const locations = ['غزة - المدينة', 'غزة - الوسطى', 'غزة - الجنوب', 'رفح', 'خان يونس', 'جباليا', 'بيت لاهيا', 'بيت حانون', 'دير البلح', 'النصيرات', 'البريج', 'المغازي'];

const emptyForm = { full_name: '', phone: '', category: '', location: '', password: '', tech_id: '' };

export default function Technicians() {
  const { addToast } = useToast();

  const [technicians, setTechnicians] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [photoView, setPhotoView] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = { page, per_page: 15 };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (statusFilter) params.status = statusFilter;
      const [techRes, catRes] = await Promise.all([getTechnicians(params), getCategories()]);
      const data = techRes.data.data || techRes.data.technicians || [];
      setTechnicians(data);
      setTotalPages(techRes.data.totalPages || techRes.data.last_page || 1);
      setCategories(catRes.data.data || catRes.data || []);
    } catch {
      addToast('فشل تحميل الفنيين', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, categoryFilter, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); fetchData(); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = async (techId) => {
    try {
      const res = await getTechnician(techId);
      const t = res.data.data || res.data;
      setEditingId(techId);
      setForm({ full_name: t.full_name, phone: t.phone_number || t.phone, category: t.category, location: t.location, password: '' });
      setFormOpen(true);
    } catch {
      addToast('فشل تحميل بيانات الفني', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.full_name || !form.phone || !form.category || !form.location || (!editingId && !form.password)) {
      addToast('يرجى ملء جميع الحقول المطلوبة', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        const payload = { full_name: form.full_name, phone: form.phone, category: form.category, location: form.location };
        if (form.password) payload.password = form.password;
        await updateTechnician(editingId, payload);
        addToast('تم تحديث الفني بنجاح', 'success');
      } else {
        await createTechnician(form);
        addToast('تم إضافة الفني بنجاح', 'success');
      }
      setFormOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      fetchData();
    } catch {
      addToast('فشل حفظ بيانات الفني', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (techId) => { setDeletingId(techId); setDeleteOpen(true); };

  const handleDelete = async () => {
    try {
      await deleteTechnician(deletingId);
      addToast('تم حذف الفني بنجاح', 'success');
      setDeleteOpen(false);
      setDeletingId(null);
      fetchData();
    } catch {
      addToast('فشل حذف الفني', 'error');
    }
  };

  const handleApprove = async (id) => {
    try {
      await approveTechnician(id);
      addToast('تم قبول الفني', 'success');
      fetchData();
    } catch {
      addToast('فشل قبول الفني', 'error');
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectTechnician(id);
      addToast('تم رفض الفني', 'success');
      fetchData();
    } catch {
      addToast('فشل رفض الفني', 'error');
    }
  };

  const handleFormChange = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div dir="rtl">
      <div className="page-header">
        <h1 className="page-title">إدارة الفنيين</h1>
        <button onClick={openAdd} className="btn btn-primary">
          + إضافة فني
        </button>
      </div>

      <div className="flex-wrap" style={{ marginBottom: 20 }}>
        <input
          type="text"
          placeholder="بحث بالاسم أو رقم الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ minWidth: 200, maxWidth: 320 }}
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="input"
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="">كل التخصصات</option>
          {categories.map(cat => (
            <option key={cat.category_id || cat} value={cat.name_ar || cat}>{cat.name_ar || cat}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input"
          style={{ width: 'auto', minWidth: 140 }}
        >
          <option value="">الكل</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">مقبول</option>
          <option value="rejected">مرفوض</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-container"><span className="loading-text">جاري التحميل...</span></div>
      ) : technicians.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👨‍🔧</div>
          <p className="empty-state-text">لا يوجد فنيين</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  {['الاسم', 'التخصص', 'الموقع', 'التقييم', 'الحالة', 'الهوية', 'العمليات'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {technicians.map(t => (
                  <tr key={t.tech_id}>
                    <td>{t.full_name}</td>
                    <td>{t.category}</td>
                    <td>{t.location}</td>
                    <td>
                      {Number(t.rating_avg) > 0 ? (
                        <span className="flex-row" style={{ gap: 4 }}>
                          {Number(t.rating_avg).toFixed(1)}
                          <span style={{ color: '#F59E0B', fontSize: 12 }}>★</span>
                        </span>
                      ) : '—'}
                    </td>
                    <td>
                      <span className={`badge badge-${t.status === 'pending' ? 'pending' : t.status === 'approved' ? 'accepted' : 'rejected'}`}>
                        {statusLabels[t.status] || t.status}
                      </span>
                    </td>
                    <td>
                      {t.national_id_url ? (
                        <button onClick={() => setPhotoView(t.national_id_url)} className="btn btn-ghost btn-xs">�id</button>
                      ) : '—'}
                    </td>
                    <td>
                      <div className="flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                        <button onClick={() => openEdit(t.tech_id)} className="btn btn-ghost btn-xs">تعديل</button>
                        <button onClick={() => confirmDelete(t.tech_id)} className="btn btn-danger btn-xs">حذف</button>
                        {t.status === 'pending' && (
                          <>
                            <button onClick={() => handleApprove(t.tech_id)} className="btn btn-primary btn-xs">قبول</button>
                            <button onClick={() => handleReject(t.tech_id)} className="btn btn-danger btn-xs">رفض</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'تعديل فني' : 'إضافة فني'} size="lg">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label>الاسم</label>
            <input type="text" value={form.full_name} onChange={handleFormChange('full_name')} required className="input" />
          </div>
          <div>
            <label>رقم الهاتف</label>
            <input type="text" value={form.phone} onChange={handleFormChange('phone')} required className="input" />
          </div>
          {!editingId && (
          <div>
            <label>معرف تليغرام (tech_id)</label>
            <input type="text" value={form.tech_id} onChange={handleFormChange('tech_id')} required placeholder="أدخل معرف التليغرام الرقمي للفني" className="input" />
            <p className="text-small text-muted" style={{ marginTop: 4 }}>يمكن للفني معرفة معرفه عبر إرسال /myid في البوت</p>
          </div>
          )}
          <div>
            <label>التخصص</label>
            <select value={form.category} onChange={handleFormChange('category')} required className="input">
              <option value="">اختر التخصص</option>
              {categories.map(cat => (
                <option key={cat.category_id || cat} value={cat.name_ar || cat}>{cat.name_ar || cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label>الموقع</label>
            <select value={form.location} onChange={handleFormChange('location')} required className="input">
              <option value="">اختر الموقع</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
          {!editingId && (
            <div>
              <label>كلمة المرور</label>
              <input type="password" value={form.password} onChange={handleFormChange('password')} required className="input" />
            </div>
          )}
          <div className="form-actions">
            <button type="button" onClick={() => setFormOpen(false)} className="btn btn-outline">إلغاء</button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'جاري الحفظ...' : editingId ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!photoView} onClose={() => setPhotoView(null)} title="صورة الهوية" size="md">
        {photoView && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
            <img src={photoView} alt="ID" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }} />
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="حذف فني"
        message="هل أنت متأكد من حذف هذا الفني؟"
        confirmText="حذف"
        danger
      />
    </div>
  );
}
