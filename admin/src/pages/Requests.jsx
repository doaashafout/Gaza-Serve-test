import { useState, useEffect } from 'react';
import { getRequests, getRequest, getAvailableTechs, reassignRequest } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const STATUS_LABELS = {
  pending: 'قيد الانتظار',
  accepted: 'تم القبول',
  on_the_way: 'في الطريق',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  canceled: 'ملغي',
  archived: 'مؤرشف',
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

  const filters = ['', 'pending', 'accepted', 'on_the_way', 'in_progress', 'completed', 'canceled', 'archived'];

  return (
    <div dir="rtl">
      <div className="page-header">
        <h1 className="page-title">إدارة الطلبات</h1>
      </div>

      <form onSubmit={handleSearch} style={{ marginBottom: 16 }}>
        <div className="flex-row" style={{ gap: 8 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 بحث برقم الطلب أو اسم العميل..."
            className="input"
            style={{ maxWidth: 360 }}
          />
          <button type="submit" className="btn btn-primary">بحث</button>
        </div>
      </form>

      <div className="filter-group" style={{ marginBottom: 20 }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={`filter-btn ${statusFilter === f ? 'active' : ''}`}
          >
            {f ? STATUS_LABELS[f] : 'الكل'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading-container"><div className="spinner" /></div>
      )}

      {!loading && error && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <p className="error-box" style={{ display: 'inline-block' }}>{error}</p>
          <br />
          <button onClick={fetchRequests} className="btn btn-primary" style={{ marginTop: 12 }}>إعادة المحاولة</button>
        </div>
      )}

      {!loading && !error && requests.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p className="empty-state-text">لا توجد طلبات{statusFilter ? ` ${STATUS_LABELS[statusFilter]}` : ''}</p>
        </div>
      )}

      {!loading && !error && requests.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="table" style={{ minWidth: 750 }}>
              <thead>
                <tr>
                  <th>رقم الطلب</th>
                  <th>العميل</th>
                  <th>الفني</th>
                  <th>التصنيف</th>
                  <th>الحالة</th>
                  <th className="sort-header" onClick={() => { setSortDir(d => d === 'DESC' ? 'ASC' : 'DESC'); setPage(1); }}>
                    التاريخ {sortDir === 'DESC' ? '▼' : '▲'}
                  </th>
                  <th style={{ textAlign: 'center' }}>العمليات</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.request_id}>
                    <td>#{req.request_id}</td>
                    <td>{req.client_name || '—'}</td>
                    <td>{req.technician_name || '—'}</td>
                    <td>{req.extracted_category || '—'}</td>
                    <td>
                      <span className={`badge badge-${req.status || 'pending'}`}>
                        {STATUS_LABELS[req.status] || req.status}
                      </span>
                    </td>
                    <td className="text-small text-muted" dir="ltr">
                      {new Date(req.created_at).toLocaleDateString('ar-SA', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="flex-row" style={{ justifyContent: 'center', gap: 6 }}>
                        <button onClick={() => openDetail(req.request_id)} className="btn btn-primary btn-xs">
                          عرض
                        </button>
                        <button onClick={() => openReassign(req.request_id)} className="btn btn-outline btn-xs">
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

      {/* Detail Modal */}
      <Modal open={detailModal} onClose={() => setDetailModal(false)} title="تفاصيل الطلب" size="lg">
        {detailLoading ? (
          <div className="loading-container"><div className="spinner" /></div>
        ) : detailData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="detail-grid">
              <div className="detail-item">
                <p className="detail-label">رقم الطلب</p>
                <p className="detail-value">#{detailData.request_id}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">العميل</p>
                <p className="detail-value">{detailData.client_name || '—'}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">رقم العميل</p>
                <p className="detail-value" dir="ltr">{detailData.client_phone || '—'}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">الفني المسند</p>
                <p className="detail-value">{detailData.technician_name || 'غير مسند'}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">التصنيف</p>
                <p className="detail-value">{detailData.extracted_category || '—'}</p>
              </div>
              <div className="detail-item">
                <p className="detail-label">الحالة</p>
                <span className={`badge badge-${detailData.status || 'pending'}`}>
                  {STATUS_LABELS[detailData.status] || detailData.status}
                </span>
              </div>
              <div className="detail-item">
                <p className="detail-label">تاريخ الإنشاء</p>
                <p className="detail-value" dir="ltr">
                  {new Date(detailData.created_at).toLocaleDateString('ar-SA', {
                    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="detail-item full">
                <p className="detail-label">الموقع</p>
                <p className="detail-value">{detailData.location || '—'}</p>
              </div>
            </div>

            <div className="desc-block">
              <p className="detail-label" style={{ marginBottom: 6 }}>وصف الطلب</p>
              <p>{detailData.description || 'لا يوجد وصف'}</p>
            </div>

            {(detailData.photo_url || detailData.photo_file_id) && (
              <div className="desc-block">
                <p className="detail-label" style={{ marginBottom: 6 }}>صورة الطلب</p>
                <div style={{ background: '#F3F4F6', borderRadius: 'var(--radius-sm)', padding: 12, border: '1px solid var(--border-light)' }}>
                  <div style={{ background: '#fff', borderRadius: 'var(--radius-sm)', overflow: 'hidden', maxWidth: 400 }}>
                    <img
                      src={detailData.photo_url || detailData.photo_file_id}
                      alt="صورة الطلب"
                      style={{ width: '100%', maxHeight: 280, objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div style={{ display: 'none', alignItems: 'center', justifyContent: 'center', height: 200, background: '#F9FAFB', color: 'var(--text-muted)', fontSize: 13 }}>
                      الصورة غير متاحة حالياً
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="timeline">
              <p className="detail-label" style={{ marginBottom: 8 }}>مسار الحالة</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {STATUS_ORDER.map((s) => {
                  const currentIdx = STATUS_ORDER.indexOf(detailData.status);
                  const idx = STATUS_ORDER.indexOf(s);
                  const isPast = idx <= currentIdx && detailData.status !== 'canceled';
                  const isCurrent = s === detailData.status;
                  const cls = isCurrent ? 'current' : isPast ? 'past' : 'future';
                  return (
                    <div key={s} className="timeline-item">
                      <div className={`timeline-dot ${cls}`} />
                      <span className={`timeline-label ${cls}`}>{STATUS_LABELS[s]}</span>
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
          <div className="loading-container"><div className="spinner" /></div>
        ) : availableTechs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👨‍🔧</div>
            <p className="empty-state-text">لا يوجد فنيون متاحون حالياً</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
            {availableTechs.map((tech) => (
              <label
                key={tech.tech_id}
                className={`radio-card ${selectedTech === tech.tech_id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="tech"
                  value={tech.tech_id}
                  checked={selectedTech === tech.tech_id}
                  onChange={() => setSelectedTech(tech.tech_id)}
                />
                <div className="radio-card-info">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="radio-card-name">{tech.name}</span>
                    {tech.rating && (
                      <span className="flex-row" style={{ color: '#F59E0B', fontSize: 12 }}>⭐ {tech.rating}</span>
                    )}
                  </div>
                  <div className="radio-card-meta">
                    {tech.category && <span>{tech.category}</span>}
                    {tech.location && <><span>|</span><span>{tech.location}</span></>}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        {availableTechs.length > 0 && (
          <div className="form-actions" style={{ borderTop: '1px solid var(--border-light)', marginTop: 16, paddingTop: 16 }}>
            <button onClick={() => setReassignModal(false)} className="btn btn-outline">إلغاء</button>
            <button
              onClick={handleReassign}
              disabled={!selectedTech || reassigning}
              className="btn btn-primary"
            >
              {reassigning ? 'جاري الإعادة...' : 'تأكيد إعادة التعيين'}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
