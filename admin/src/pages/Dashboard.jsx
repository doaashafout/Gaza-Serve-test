import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { getStats } from '../api';
import StatsCard from '../components/StatsCard';

const STATUS_LABELS = { pending: 'قيد الانتظار', accepted: 'تم القبول', on_the_way: 'في الطريق', in_progress: 'قيد التنفيذ', completed: 'مكتمل', canceled: 'ملغي' };
const STATUS_COLORS = { pending: 'var(--status-pending)', accepted: 'var(--status-accepted)', on_the_way: 'var(--status-progress)', in_progress: 'var(--status-progress)', completed: 'var(--status-completed)', canceled: 'var(--status-rejected)' };
const PIE_COLORS = ['#13964F', '#3B82F6', '#F59E0B', '#059669', '#EF4444', '#8B5CF6', '#14B8A6'];
const STATUS_KEYS = ['pending', 'accepted', 'on_the_way', 'in_progress', 'completed', 'canceled'];

function formatMonth(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async (isInitial = false) => {
    try {
      setError('');
      const res = await getStats();
      setStats(res.data);
    } catch (err) {
      if (isInitial) setError('فشل تحميل البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      if (isInitial) setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadStats(true);
    const interval = setInterval(() => loadStats(false), 30000);
    return () => clearInterval(interval);
  }, []);

  if (initialLoading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-error)', marginBottom: 16 }}>{error}</p>
        <button onClick={() => { setInitialLoading(true); loadStats(true); }} className="btn btn-primary">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const barData = STATUS_KEYS.map(key => ({
    name: STATUS_LABELS[key],
    value: stats.requests?.[key] ?? 0,
    fill: STATUS_COLORS[key]
  }));

  const pieData = Object.entries(stats.requests?.by_category || {}).map(([name, value]) => ({ name, value }));

  const monthData = Object.entries(stats.requestsByMonth || {}).map(([month, count]) => ({
    month: formatMonth(month),
    count,
  }));

  const recentActivity = stats.recentActivity || [];

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stats Cards */}
      <div className="grid-6">
        <StatsCard icon="👥" label="المستخدمون" value={stats.users ?? 0} color="blue" />
        <StatsCard icon="✅" label="الفنيون المعتمدون" value={stats.technicians?.approved ?? 0} sub={`من أصل ${stats.technicians?.total ?? 0}`} color="green" />
        <StatsCard icon="📋" label="إجمالي الطلبات" value={stats.requests?.total ?? 0} color="purple" />
        <StatsCard icon="✔️" label="الطلبات المكتملة" value={stats.requests?.completed ?? 0} color="teal" />
        <StatsCard icon="⏳" label="الطلبات المعلقة" value={stats.requests?.pending ?? 0} color="yellow" />
        <StatsCard icon="🎫" label="التذاكر المفتوحة" value={stats.tickets?.open ?? 0} color="red" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid-2">
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>حالة الطلبات</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" stroke="#6B7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6B7280" allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#1F2937' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>أكثر التخصصات طلباً</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#1F2937' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted" style={{ padding: '48px 0' }}>لا توجد بيانات</p>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid-2">
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>الطلبات حسب الشهر</h3>
          {monthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" tick={{ fontSize: 11 }} />
                <YAxis stroke="#6B7280" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', color: '#1F2937' }} />
                <Line type="monotone" dataKey="count" stroke="#13964F" strokeWidth={2} dot={{ fill: '#13964F', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted" style={{ padding: '48px 0' }}>لا توجد بيانات كافية</p>
          )}
        </div>

        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>آخر النشاطات</h3>
          {recentActivity.length > 0 ? (
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentActivity.map((act) => (
                <div key={act.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: '#F9FAFB', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ width: 8, height: 8, marginTop: 5, borderRadius: '50%', background: 'var(--green-primary)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: 13, margin: 0, lineHeight: 1.4 }}>{act.details || act.action}</p>
                    <p className="text-small text-muted" style={{ marginTop: 3 }}>{act.admin} · {new Date(act.time).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted" style={{ padding: '48px 0' }}>لا توجد نشاطات حديثة</p>
          )}
        </div>
      </div>

      {/* Recent Requests + Top Techs */}
      <div className="grid-2">
        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>آخر الطلبات</h3>
          {stats.recentRequests?.length > 0 ? (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>العميل</th>
                    <th>التصنيف</th>
                    <th>الحالة</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentRequests.map(r => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.client_name || '—'}</td>
                      <td>{r.category || '—'}</td>
                      <td>
                        <span className={`badge badge-${r.status}`}>{STATUS_LABELS[r.status] || r.status}</span>
                      </td>
                      <td className="text-small text-muted">{new Date(r.created).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-muted" style={{ padding: '32px 0' }}>لا توجد طلبات حديثة</p>
          )}
        </div>

        <div className="chart-card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>أفضل الفنيين</h3>
          {stats.topTechs?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.topTechs.map((tech, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#F9FAFB', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{tech.name}</p>
                    <p className="text-small text-muted" style={{ margin: '2px 0 0' }}>{tech.category} · {tech.location}</p>
                  </div>
                  <div className="flex-row" style={{ color: '#F59E0B' }}>
                    <span>⭐</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{tech.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted" style={{ padding: '32px 0' }}>لا يوجد فنيون</p>
          )}
        </div>
      </div>
    </div>
  );
}
