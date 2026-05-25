import { useState, useEffect } from 'react';
import { getTechnicians, getTechnician, createTechnician, updateTechnician, deleteTechnician, approveTechnician, rejectTechnician, getCategories } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';

const statusColors = {
  pending: 'bg-yellow-900/50 text-yellow-400 border-yellow-700',
  approved: 'bg-emerald-900/50 text-emerald-400 border-emerald-700',
  rejected: 'bg-red-900/50 text-red-400 border-red-700',
};
const statusLabels = { pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض' };
const locations = ['غزة - المدينة', 'غزة - الوسطى', 'غزة - الجنوب', 'رفح', 'خان يونس', 'جباليا', 'بيت لاهيا', 'بيت حانون', 'دير البلح', 'النصيرات', 'البريج', 'المغازي'];

const emptyForm = { full_name: '', phone: '', category: '', location: '', password: '' };

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
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-bold">إدارة الفنيين</h1>
        <button onClick={openAdd} className="px-5 py-2.5 rounded-lg bg-gradient-to-l from-cyan-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 transition-all">
          + إضافة فني
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="بحث بالاسم أو رقم الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
        />
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
        >
          <option value="">كل التخصصات</option>
          {categories.map(cat => (
            <option key={cat.category_id || cat} value={cat.name_ar || cat}>{cat.name_ar || cat}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-800 text-gray-100 text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
        >
          <option value="">الكل</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">مقبول</option>
          <option value="rejected">مرفوض</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-20">جاري التحميل...</div>
      ) : technicians.length === 0 ? (
        <div className="text-center text-gray-400 py-20">لا يوجد فنيين</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900">
              <tr>
                {['الاسم', 'التخصص', 'الموقع', 'التقييم', 'الحالة', 'العمليات'].map(h => (
                  <th key={h} className="px-4 py-3 text-right text-gray-400 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {technicians.map(t => (
                <tr key={t.tech_id} className="hover:bg-gray-800/40 transition-all">
                  <td className="px-4 py-3 whitespace-nowrap">{t.full_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{t.category}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{t.location}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {Number(t.rating_avg) > 0 ? (
                      <span className="flex items-center gap-1">
                        {Number(t.rating_avg).toFixed(1)}
                        <span className="text-yellow-400 text-xs">★</span>
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${statusColors[t.status] || ''}`}>
                      {statusLabels[t.status] || t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button onClick={() => openEdit(t.tech_id)} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-cyan-400 text-xs transition-all">
                        تعديل
                      </button>
                      <button onClick={() => confirmDelete(t.tech_id)} className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-red-400 text-xs transition-all">
                        حذف
                      </button>
                      {t.status === 'pending' && (
                        <>
                          <button onClick={() => handleApprove(t.tech_id)} className="px-3 py-1.5 rounded-lg bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-400 text-xs border border-emerald-700/50 transition-all">
                            قبول
                          </button>
                          <button onClick={() => handleReject(t.tech_id)} className="px-3 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs border border-red-700/50 transition-all">
                            رفض
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? 'تعديل فني' : 'إضافة فني'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">الاسم</label>
            <input type="text" value={form.full_name} onChange={handleFormChange('full_name')} required
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm focus:outline-none focus:border-cyan-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">رقم الهاتف</label>
            <input type="text" value={form.phone} onChange={handleFormChange('phone')} required
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm focus:outline-none focus:border-cyan-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">التخصص</label>
            <select value={form.category} onChange={handleFormChange('category')} required
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm focus:outline-none focus:border-cyan-500/50 transition-all">
              <option value="">اختر التخصص</option>
              {categories.map(cat => (
                <option key={cat.category_id || cat} value={cat.name_ar || cat}>{cat.name_ar || cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">الموقع</label>
            <select value={form.location} onChange={handleFormChange('location')} required
              className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm focus:outline-none focus:border-cyan-500/50 transition-all">
              <option value="">اختر الموقع</option>
              {locations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
          {!editingId && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">كلمة المرور</label>
              <input type="password" value={form.password} onChange={handleFormChange('password')} required
                className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 text-sm focus:outline-none focus:border-cyan-500/50 transition-all" />
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setFormOpen(false)}
              className="px-6 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-all">إلغاء</button>
            <button type="submit" disabled={submitting}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-l from-cyan-500 to-purple-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all">
              {submitting ? 'جاري الحفظ...' : editingId ? 'تحديث' : 'إضافة'}
            </button>
          </div>
        </form>
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
