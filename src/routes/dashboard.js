const express = require('express');
const router = express.Router();
const { User, Technician, Request, Rating, SupportTicket } = require('../Models');
const { Op } = require('sequelize');
const apiConfig = require('../config/api');

function requireAdmin(req, res, next) {
  if (String(req.query.token) === String(apiConfig.ADMIN_ID)) return next();
  if (req.path === '/dashboard') return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

router.get('/api/stats', requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.count();
    const totalTechs = await Technician.count();
    const approvedTechs = await Technician.count({ where: { status: 'approved' } });
    const pendingTechs = await Technician.count({ where: { status: 'pending' } });

    const totalRequests = await Request.count();
    const pendingReqs = await Request.count({ where: { status: 'pending' } });
    const acceptedReqs = await Request.count({ where: { status: 'accepted' } });
    const onWayReqs = await Request.count({ where: { status: 'on_the_way' } });
    const inProgressReqs = await Request.count({ where: { status: 'in_progress' } });
    const completedReqs = await Request.count({ where: { status: 'completed' } });
    const canceledReqs = await Request.count({ where: { status: 'canceled' } });

    const totalTickets = await SupportTicket.count();
    const openTickets = await SupportTicket.count({ where: { status: 'open' } });
    const repliedTickets = await SupportTicket.count({ where: { status: 'replied' } });
    const closedTickets = await SupportTicket.count({ where: { status: 'closed' } });

    const topTechs = await Technician.findAll({
      where: { status: 'approved', rating_avg: { [Op.gt]: 0 } },
      order: [['rating_avg', 'DESC']],
      limit: 5,
    });

    const recentRequests = await Request.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
    });

    res.json({
      users: totalUsers,
      technicians: { total: totalTechs, approved: approvedTechs, pending: pendingTechs },
      requests: { total: totalRequests, pending: pendingReqs, accepted: acceptedReqs, on_the_way: onWayReqs, in_progress: inProgressReqs, completed: completedReqs, canceled: canceledReqs },
      tickets: { total: totalTickets, open: openTickets, replied: repliedTickets, closed: closedTickets },
      topTechs: topTechs.map(t => ({ name: t.full_name, category: t.category, rating: t.rating_avg, location: t.location })),
      recentRequests: recentRequests.map(r => ({ id: r.request_id, category: r.extracted_category, status: r.status, location: r.location, created: r.created_at })),
    });
  } catch (err) {
    console.error('[Dashboard] Stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/dashboard', (req, res) => {
  const isAuth = String(req.query.token) === String(apiConfig.ADMIN_ID);
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GazaServe - لوحة التحكم</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
body { background: #f0f2f5; color: #1a1a2e; padding: 20px; }
.header { background: linear-gradient(135deg, #1a1a2e, #16213e); color: white; padding: 25px 30px; border-radius: 16px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
.header h1 { font-size: 24px; }
.header span { opacity: 0.8; font-size: 14px; }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 25px; }
.card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.card h3 { font-size: 13px; color: #666; margin-bottom: 6px; }
.card .num { font-size: 32px; font-weight: bold; color: #1a1a2e; }
.card .sub { font-size: 12px; color: #999; margin-top: 4px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
@media (max-width: 768px) { .grid2 { grid-template-columns: 1fr; } }
.chart-box { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.chart-box h3 { margin-bottom: 12px; font-size: 16px; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: right; padding: 10px 12px; border-bottom: 2px solid #eee; color: #666; font-weight: 600; }
td { padding: 10px 12px; border-bottom: 1px solid #f5f5f5; }
.status { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
.pending { background: #fff3cd; color: #856404; }
.approved, .completed { background: #d4edda; color: #155724; }
.rejected, .canceled { background: #f8d7da; color: #721c24; }
.accepted { background: #cce5ff; color: #004085; }
.on_the_way { background: #d1ecf1; color: #0c5460; }
.in_progress { background: #e8d4f8; color: #5a2d82; }
.open { background: #fff3cd; color: #856404; }
.replied { background: #cce5ff; color: #004085; }
.closed { background: #d4edda; color: #155724; }
.auth-bar { background: white; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin-bottom: 25px; }
.auth-bar input { padding: 12px 20px; font-size: 16px; border: 2px solid #ddd; border-radius: 8px; width: 300px; max-width: 90%; margin-left: 10px; }
.auth-bar button { padding: 12px 30px; font-size: 16px; background: #1a1a2e; color: white; border: none; border-radius: 8px; cursor: pointer; }
.auth-bar button:hover { background: #16213e; }
.hidden { display: none; }
.refresh-btn { background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.refresh-btn:hover { background: rgba(255,255,255,0.25); }
</style>
</head>
<body>
<div class="header">
  <div><h1>🛠️ GazaServe</h1><span>لوحة تحكم الأدمن</span></div>
  <button class="refresh-btn" onclick="loadStats()">🔄 تحديث</button>
</div>

<div id="authBox" class="auth-bar ${isAuth ? 'hidden' : ''}">
  <h2>🔐 دخول لوحة التحكم</h2>
  <p style="margin:10px 0 20px;color:#666">أدخل معرف تيليغرام الخاص بالأدمن</p>
  <input type="password" id="tokenInput" placeholder="معرف تيليغرام" onkeydown="if(event.key==='Enter')auth()">
  <button onclick="auth()">دخول</button>
  <p id="authError" style="color:#dc3545;margin-top:10px;display:none">❌ المعرف غير صحيح</p>
</div>

<div id="dashboardContent" class="${isAuth ? '' : 'hidden'}">
  <div class="stats" id="statsCards"></div>

  <div class="grid2">
    <div class="chart-box"><h3>📊 حالة الطلبات</h3><canvas id="requestsChart" height="200"></canvas></div>
    <div class="chart-box"><h3>⭐ أفضل الفنيين</h3><canvas id="techsChart" height="200"></canvas></div>
  </div>

  <div class="chart-box" style="margin-bottom:25px">
    <h3>📋 آخر الطلبات</h3>
    <table><thead><tr><th>#</th><th>التخصص</th><th>المنطقة</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody id="requestsTable"></tbody></table>
  </div>

  <div class="chart-box">
    <h3>📞 تذاكر الدعم</h3>
    <table><thead><tr><th>الحالة</th><th>العدد</th></tr></thead><tbody id="ticketsTable"></tbody></table>
  </div>
</div>

<script>
const token = ${JSON.stringify(isAuth ? req.query.token : '')};
if (token) loadStats();

function auth() {
  const t = document.getElementById('tokenInput').value;
  if (!t) return;
  window.location.href = '/dashboard?token=' + encodeURIComponent(t);
}

async function loadStats() {
  try {
    const res = await fetch('/api/stats?token=' + token);
    if (!res.ok) throw new Error('Unauthorized');
    const d = await res.json();
    renderStats(d);
  } catch (e) {
    document.getElementById('statsCards').innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;color:#dc3545">❌ فشل تحميل البيانات. تأكد من صحة المعرف.</div>';
  }
}

function renderStats(d) {
  document.getElementById('statsCards').innerHTML = \`
    <div class="card"><h3>👥 المستخدمين</h3><div class="num">\${d.users}</div></div>
    <div class="card"><h3>👨‍🔧 الفنيين</h3><div class="num">\${d.technicians.approved}</div><div class="sub">\${d.technicians.pending} قيد المراجعة</div></div>
    <div class="card"><h3>📋 إجمالي الطلبات</h3><div class="num">\${d.requests.total}</div><div class="sub">\${d.requests.completed} مكتمل</div></div>
    <div class="card"><h3>⏳ قيد الانتظار</h3><div class="num">\${d.requests.pending}</div></div>
    <div class="card"><h3>🔄 قيد التنفيذ</h3><div class="num">\${d.requests.on_the_way + d.requests.in_progress}</div><div class="sub">\${d.requests.accepted} تم القبول</div></div>
    <div class="card"><h3>📞 تذاكر الدعم</h3><div class="num">\${d.tickets.total}</div><div class="sub">\${d.tickets.open} مفتوحة</div></div>
  \`;

  try {
    new Chart(document.getElementById('requestsChart'), {
      type: 'doughnut',
      data: {
        labels: ['قيد الانتظار', 'تم القبول', 'في الطريق', 'قيد التنفيذ', 'مكتمل', 'ملغي'],
        datasets: [{ data: [d.requests.pending, d.requests.accepted, d.requests.on_the_way, d.requests.in_progress, d.requests.completed, d.requests.canceled], backgroundColor: ['#ffc107','#007bff','#17a2b8','#6f42c1','#28a745','#dc3545'] }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
    });
  } catch(e) {}

  if (d.topTechs.length > 0) {
    try {
      new Chart(document.getElementById('techsChart'), {
        type: 'bar',
        data: {
          labels: d.topTechs.map(t => t.name.substring(0, 10) + '...'),
          datasets: [{ label: 'التقييم', data: d.topTechs.map(t => parseFloat(t.rating) || 0), backgroundColor: '#1a1a2e', borderRadius: 6 }]
        },
        options: { responsive: true, scales: { y: { min: 0, max: 5 } }, plugins: { legend: { display: false } } }
      });
    } catch(e) {}
  }

  const statusLabels = { pending: '⏳ قيد الانتظار', accepted: '✅ تم القبول', on_the_way: '🚗 في الطريق', in_progress: '🔧 قيد التنفيذ', completed: '✔️ مكتمل', canceled: '❌ ملغي' };
  document.getElementById('requestsTable').innerHTML = d.recentRequests.map(r => \`<tr><td>\${r.id}</td><td>\${r.category}</td><td>\${r.location || '-'}</td><td><span class="status \${r.status}">\${statusLabels[r.status] || r.status}</span></td><td>\${new Date(r.created).toLocaleDateString('ar-EG')}</td></tr>\`).join('');

  const ticketLabels = { open: '⏳ مفتوحة', replied: '✉️ تم الرد', closed: '✅ مغلقة' };
  const ticketColors = { open: 'open', replied: 'replied', closed: 'closed' };
  document.getElementById('ticketsTable').innerHTML = ['open','replied','closed'].map(s => \`<tr><td><span class="status \${ticketColors[s]}">\${ticketLabels[s]}</span></td><td>\${d.tickets[s]}</td></tr>\`).join('');
}

setInterval(loadStats, 30000);
</script>
</body>
</html>`;
  res.send(html);
});

module.exports = router;
