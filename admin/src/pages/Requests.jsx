import { useState, useEffect } from 'react';
import { getRequests, getRequest, getAvailableTechs, reassignRequest } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import Pagination from '../components/Pagination';

const STATUS_LABELS = {
  pending: 'قيد الانتظار',
  accepted: 'تم القبول',
  on_the_way: 'في الطريق',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  canceled: 'ملغي',
};

const STATUS_BADGE = {
  pending: 'bg-yellow-900/50 text-yellow-400',
  accepted: 'bg-blue-900/50 text-blue-400',
  on_the_way: 'bg-cyan-900/50 text-cyan-400',
  in_progress: 'bg-purple-900/50 text-purple-400',
  completed: 'bg-emerald-900/50 text-emerald-400',
  canceled: 'bg-red-900/50 text-red-400',
};

const STATUS_ORDER = ['pending', 'accepted', 'on_the_way', 'in_progress', 'completed', 'canceled'];

export default function Requests() {
  const { addToast } = useToast();

  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('DESC');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [detailModal, setDetailModal] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [reassignModal, setReassignModal] = useState(false);
  const [reassignRequestId, setReassignRequestId] = useState(null);
  const [availableTechs, setAvailableTechs] = useState([]);
  const [selectedTech, setSelectedTech] = useState(null);
  const [techsLoading, setTechsLoading] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 15, sortField, sortDir };
      if (statusFilter) params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const { data } = await getRequests(params);
      setRequests(data.data || []);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      setError(err.response?.data?.message || 'فشل في تحميل الطلبات');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [page, statusFilter, sortField, sortDir]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRequests();
  };

  const handleFilterChange = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  const openDetail = async (id) => {
    setDetailModal(true);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const { data } = await getRequest(id);
      setDetailData(data);
    } catch (err) {
      addToast(err.response?.data?.message || 'فشل في تحميل تفاصيل الطلب', 'error');
      setDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const openReassign = async (id) => {
    setReassignRequestId(id);
    setReassignModal(true);
    setSelectedTech(null);
    setTechsLoading(true);
    setAvailableTechs([]);
    try {
      const { data } = await getAvailableTechs(id);
      setAvailableTechs(data || []);
    } catch (err) {
      addToast(err.response?.data?.message || 'فشل في تحميل الفنيين المتاحين', 'error');
      setReassignModal(false);
    } finally {
      setTechsLoading(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedTech || !reassignRequestId) return;
    setReassigning(true);
    try {
      await reassignRequest(reassignRequestId, selectedTech);
      addToast('تم إعادة التعيين بنجاح', 'success');
      setReassignModal(false);
      setReassignRequestId(null);
      setSelectedTech(null);
      fetchRequests();
    } catch (err) {
      addToast(err.response?.data?.message || 'فشل في إعادة التعيين', 'error');
    } finally {
      setReassigning(false);
    }
  };

  const filters = ['', 'pending', 'accepted', 'on_the_way', 'in_progress', 'completed', 'canceled'];

  return (
    <div dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">إدارة الطلبات</h1>
      </div>

       {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 بحث برقم الطلب أو اسم العميل..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all"
          />
          <button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm transition-all">
            بحث
          </button>
        </div>
      </form>

      {/* Status Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
              statusFilter === f
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {f ? STATUS_LABELS[f] : 'الكل'}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="text-center py-20">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchRequests}
            className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-sm transition-all"
          >
            إعادة المحاولة
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && requests.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500">لا توجد طلبات{statusFilter ? ` ${STATUS_LABELS[statusFilter]}` : ''}</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && requests.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gray-900 text-gray-400">
                  <th className="text-right p-3">رقم الطلب</th>
                  <th className="text-right p-3">العميل</th>
                  <th className="text-right p-3">الفني</th>
                  <th className="text-right p-3">التصنيف</th>
                  <th className="text-right p-3">
                    <select
                      value={statusFilter}
                      onChange={e => handleFilterChange(e.target.value)}
                      className="bg-transparent text-gray-400 text-sm cursor-pointer focus:outline-none"
                    >
                      <option value="">الحالة</option>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <option key={k} value={k} className="bg-gray-900">{v}</option>
                      ))}
                    </select>
                  </th>
                  <th className="text-right p-3 cursor-pointer hover:text-gray-200" onClick={() => { setSortDir(d => d === 'DESC' ? 'ASC' : 'DESC'); setPage(1); }}>
                    التاريخ {sortDir === 'DESC' ? '▼' : '▲'}
                  </th>
                  <th className="text-center p-3">العمليات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {requests.map((req) => (
                  <tr key={req.request_id} className="hover:bg-gray-900/50 transition-all">
                    <td className="p-3 text-gray-200">#{req.request_id}</td>
                    <td className="p-3 text-gray-200">{req.client_name || '—'}</td>
                    <td className="p-3 text-gray-200">{req.technician_name || '—'}</td>
                    <td className="p-3 text-gray-200">{req.extracted_category || '—'}</td>
                    <td className="p-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[req.status] || 'bg-gray-800 text-gray-400'}`}>
                        {STATUS_LABELS[req.status] || req.status}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400 text-xs" dir="ltr">
                      {new Date(req.created_at).toLocaleDateString('ar-SA', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openDetail(req.request_id)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 text-xs transition-all"
                        >
                          عرض
                        </button>
                        <button
                          onClick={() => openReassign(req.request_id)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 text-xs transition-all"
                        >
                          إعادة تعيين
                        </button>
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

      {/* Request Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title="تفاصيل الطلب" size="lg">
        {detailLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : detailData ? (
          <div className="space-y-6">
            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">رقم الطلب</p>
                <p className="text-gray-200 font-medium">#{detailData.request_id}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">العميل</p>
                <p className="text-gray-200 font-medium">{detailData.client_name || '—'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">رقم العميل</p>
                <p className="text-gray-200 font-medium" dir="ltr">{detailData.client_phone || '—'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">الفني المسند</p>
                <p className="text-gray-200 font-medium">{detailData.technician_name || 'غير مسند'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">التصنيف</p>
                <p className="text-gray-200 font-medium">{detailData.extracted_category || '—'}</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">الحالة</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[detailData.status] || 'bg-gray-800 text-gray-400'}`}>
                  {STATUS_LABELS[detailData.status] || detailData.status}
                </span>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">تاريخ الإنشاء</p>
                <p className="text-gray-200 font-medium" dir="ltr">
                  {new Date(detailData.created_at).toLocaleDateString('ar-SA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4 md:col-span-2">
                <p className="text-xs text-gray-500 mb-1">الموقع</p>
                <p className="text-gray-200 font-medium">{detailData.location || '—'}</p>
              </div>
            </div>

            {/* Description */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-2">وصف الطلب</p>
              <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                {detailData.description || 'لا يوجد وصف'}
              </p>
            </div>

            {/* Photo */}
            {detailData.photo_file_id && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-2">صورة الطلب</p>
                <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
                  <p className="text-gray-400 text-xs mb-2 font-mono break-all" dir="ltr">
                    {detailData.photo_file_id}
                  </p>
                  <div className="bg-gray-800 rounded-lg overflow-hidden max-w-sm">
                    <img
                      src={`https://api.telegram.org/file/bot/placeholder_${detailData.photo_file_id}`}
                      alt="صورة الطلب"
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="hidden items-center justify-center h-48 bg-gray-800 text-gray-500 text-sm">
                      الصورة غير متاحة حالياً
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Status Timeline */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-3">مسار الحالة</p>
              <div className="space-y-1">
                {STATUS_ORDER.map((s, idx) => {
                  const currentIdx = STATUS_ORDER.indexOf(detailData.status);
                  const isPast = idx <= currentIdx && detailData.status !== 'canceled';
                  const isCurrent = s === detailData.status;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isCurrent ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-gray-900 bg-cyan-500' :
                        isPast ? 'bg-emerald-500' : 'bg-gray-700'
                      }`} />
                      <span className={`text-sm ${
                        isCurrent ? 'text-cyan-400 font-medium' :
                        isPast ? 'text-gray-300' : 'text-gray-600'
                      }`}>
                        {STATUS_LABELS[s]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Reassign Modal */}
      <Modal open={reassignModal} onClose={() => setReassignModal(false)} title="إعادة تعيين فني" size="lg">
        {techsLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : availableTechs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">👨‍🔧</div>
            <p className="text-gray-500">لا يوجد فنيون متاحون حالياً</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {availableTechs.map((tech) => (
              <label
                key={tech.tech_id}
                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedTech === tech.tech_id
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <input
                  type="radio"
                  name="tech"
                  value={tech.tech_id}
                  checked={selectedTech === tech.tech_id}
                  onChange={() => setSelectedTech(tech.tech_id)}
                  className="accent-cyan-500 w-4 h-4 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-200 font-medium">{tech.name}</span>
                    {tech.rating && (
                      <span className="text-yellow-400 text-xs shrink-0">⭐ {tech.rating}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {tech.category && <span>{tech.category}</span>}
                    {tech.location && (
                      <>
                        <span className="text-gray-700">|</span>
                        <span>{tech.location}</span>
                      </>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {availableTechs.length > 0 && (
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
            <button
              onClick={() => setReassignModal(false)}
              className="px-6 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm transition-all"
            >
              إلغاء
            </button>
            <button
              onClick={handleReassign}
              disabled={!selectedTech || reassigning}
              className="px-6 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm transition-all"
            >
              {reassigning ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  جاري الإعادة...
                </span>
              ) : (
                'تأكيد إعادة التعيين'
              )}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
