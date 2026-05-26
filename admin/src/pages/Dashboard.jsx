import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { getStats } from '../api';
import StatsCard from '../components/StatsCard';

const STATUS_LABELS = { pending: 'قيد الانتظار', accepted: 'تم القبول', on_the_way: 'في الطريق', in_progress: 'قيد التنفيذ', completed: 'مكتمل', canceled: 'ملغي' };
const STATUS_COLORS = { pending: '#ffd700', accepted: '#4488ff', on_the_way: '#00dddd', in_progress: '#bb66ff', completed: '#00ff88', canceled: '#ff4444' };
const PIE_COLORS = ['#00d4ff', '#7b2ff7', '#ffd700', '#00ff88', '#ff6666', '#ff8800', '#00ddaa'];
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => { setInitialLoading(true); loadStats(true); }} className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-all">
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
    <div className="space-y-6" dir="rtl">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard icon="👥" label="المستخدمون" value={stats.users ?? 0} color="from-blue-500 to-cyan-500" />
        <StatsCard icon="✅" label="الفنيون المعتمدون" value={stats.technicians?.approved ?? 0} sub={`من أصل ${stats.technicians?.total ?? 0}`} color="from-green-500 to-emerald-500" />
        <StatsCard icon="📋" label="إجمالي الطلبات" value={stats.requests?.total ?? 0} color="from-purple-500 to-pink-500" />
        <StatsCard icon="✔️" label="الطلبات المكتملة" value={stats.requests?.completed ?? 0} color="from-emerald-500 to-teal-500" />
        <StatsCard icon="⏳" label="الطلبات المعلقة" value={stats.requests?.pending ?? 0} color="from-yellow-500 to-orange-500" />
        <StatsCard icon="🎫" label="التذاكر المفتوحة" value={stats.tickets?.open ?? 0} color="from-red-500 to-rose-500" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">حالة الطلبات</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9ca3af" allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">أكثر التخصصات طلباً</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">لا توجد بيانات</p>
          )}
        </div>
      </div>

      {/* Charts Row 2: Monthly trend + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">الطلبات حسب الشهر</h3>
          {monthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <YAxis stroke="#9ca3af" allowDecimals={false} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#fff' }} />
                <Line type="monotone" dataKey="count" stroke="#00d4ff" strokeWidth={2} dot={{ fill: '#00d4ff', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-12">لا توجد بيانات كافية</p>
          )}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">آخر النشاطات</h3>
          {recentActivity.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {recentActivity.map((act) => (
                <div key={act.id} className="flex items-start gap-3 p-2.5 bg-gray-800/30 rounded-lg">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-cyan-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-300 text-sm leading-snug">{act.details || act.action}</p>
                    <p className="text-gray-600 text-xs mt-0.5">{act.admin} · {new Date(act.time).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-12">لا توجد نشاطات حديثة</p>
          )}
        </div>
      </div>

      {/* Recent Requests + Top Techs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">آخر الطلبات</h3>
          {stats.recentRequests?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-800">
                    <th className="text-right py-2 px-2">#</th>
                    <th className="text-right py-2 px-2">العميل</th>
                    <th className="text-right py-2 px-2">التصنيف</th>
                    <th className="text-right py-2 px-2">الحالة</th>
                    <th className="text-right py-2 px-2">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentRequests.map(r => (
                    <tr key={r.id} className="border-b border-gray-800/50 text-gray-300 hover:bg-gray-800/50">
                      <td className="py-2 px-2">{r.id}</td>
                      <td className="py-2 px-2">{r.client_name || '—'}</td>
                      <td className="py-2 px-2">{r.category || '—'}</td>
                      <td className="py-2 px-2">
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: STATUS_COLORS[r.status] + '30', color: STATUS_COLORS[r.status] }}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-gray-500 text-xs">{new Date(r.created).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">لا توجد طلبات حديثة</p>
          )}
        </div>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">أفضل الفنيين</h3>
          {stats.topTechs?.length > 0 ? (
            <div className="space-y-3">
              {stats.topTechs.map((tech, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{tech.name}</p>
                    <p className="text-gray-500 text-xs">{tech.category} · {tech.location}</p>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-400">
                    <span>⭐</span>
                    <span className="text-white text-sm font-semibold">{tech.rating}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">لا يوجد فنيون</p>
          )}
        </div>
      </div>
    </div>
  );
}
