const express = require('express');
const router = express.Router();
const { User, Technician, Request, Rating, SupportTicket } = require('../Models');
const { Op } = require('sequelize');
const apiConfig = require('../config/api');

router.get('/api/stats', async (req, res) => {
  if (String(req.query.token) !== String(apiConfig.ADMIN_ID)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const [totalUsers, totalTechs, approvedTechs, pendingTechs,
      totalRequests, pendingReqs, acceptedReqs, onWayReqs, inProgReqs, completedReqs, canceledReqs,
      totalTickets, openTickets, repliedTickets, closedTickets] = await Promise.all([
      User.count(), Technician.count(), Technician.count({ where: { status: 'approved' } }), Technician.count({ where: { status: 'pending' } }),
      Request.count(), Request.count({ where: { status: 'pending' } }), Request.count({ where: { status: 'accepted' } }), Request.count({ where: { status: 'on_the_way' } }), Request.count({ where: { status: 'in_progress' } }), Request.count({ where: { status: 'completed' } }), Request.count({ where: { status: 'canceled' } }),
      SupportTicket.count(), SupportTicket.count({ where: { status: 'open' } }), SupportTicket.count({ where: { status: 'replied' } }), SupportTicket.count({ where: { status: 'closed' } }),
    ]);
    const topTechs = await Technician.findAll({ where: { status: 'approved', rating_avg: { [Op.gt]: 0 } }, order: [['rating_avg', 'DESC']], limit: 5 });
    const recentRequests = await Request.findAll({ order: [['created_at', 'DESC']], limit: 10 });

    res.json({
      users: totalUsers,
      technicians: { total: totalTechs, approved: approvedTechs, pending: pendingTechs },
      requests: { total: totalRequests, pending: pendingReqs, accepted: acceptedReqs, on_the_way: onWayReqs, in_progress: inProgReqs, completed: completedReqs, canceled: canceledReqs },
      tickets: { total: totalTickets, open: openTickets, replied: repliedTickets, closed: closedTickets },
      topTechs: topTechs.map(t => ({ name: t.full_name, category: t.category, rating: Number(t.rating_avg), location: t.location })),
      recentRequests: recentRequests.map(r => ({ id: r.request_id, category: r.extracted_category, status: r.status, location: r.location, created: r.created_at })),
    });
  } catch (err) {
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
<script src="/chart.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
body { background: #0f0f23; color: #e0e0e0; min-height: 100vh; }
.header { background: linear-gradient(135deg, #1a1a3e, #2a1a5e); padding: 30px; border-bottom: 1px solid #3a3a6e; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.header h1 { font-size: 26px; background: linear-gradient(90deg, #00d4ff, #7b2ff7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.header span { color: #8888aa; font-size: 14px; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.header-actions span { background: #2a2a5e; padding: 6px 14px; border-radius: 20px; -webkit-text-fill-color: #8888aa; font-size: 13px; }
.container { max-width: 1300px; margin: 0 auto; padding: 25px; }
.btn { background: #2a2a5e; color: #e0e0e0; border: 1px solid #4a4a8e; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: 0.2s; }
.btn:hover { background: #3a3a7e; }
.btn-primary { background: linear-gradient(135deg, #00d4ff, #7b2ff7); border: none; color: #fff; font-weight: 600; }
.btn-primary:hover { opacity: 0.9; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 25px; }
.card { background: #1a1a3e; border-radius: 12px; padding: 20px; border: 1px solid #2a2a5e; transition: 0.2s; }
.card:hover { border-color: #5a5aae; transform: translateY(-2px); }
.card-icon { font-size: 24px; margin-bottom: 8px; }
.card h3 { font-size: 12px; color: #8888aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
.card .num { font-size: 28px; font-weight: 700; color: #fff; }
.card .sub { font-size: 12px; color: #6666aa; margin-top: 4px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px; }
@media (max-width: 768px) { .grid2 { grid-template-columns: 1fr; } }
.chart-box { background: #1a1a3e; border-radius: 12px; padding: 20px; border: 1px solid #2a2a5e; }
.chart-box h3 { font-size: 15px; margin-bottom: 15px; color: #ccc; }
.table-box { background: #1a1a3e; border-radius: 12px; padding: 20px; border: 1px solid #2a2a5e; overflow-x: auto; }
.table-box h3 { font-size: 15px; margin-bottom: 15px; color: #ccc; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: right; padding: 10px 12px; border-bottom: 2px solid #2a2a5e; color: #8888aa; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
td { padding: 10px 12px; border-bottom: 1px solid #1f1f4e; color: #ccc; }
.status { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; display: inline-block; }
.pending { background: #3a3a1a; color: #ffd700; }
.approved, .completed { background: #1a3a2a; color: #00ff88; }
.rejected, .canceled { background: #3a1a1a; color: #ff4444; }
.accepted { background: #1a2a4a; color: #4488ff; }
.on_the_way { background: #1a3a3a; color: #00dddd; }
.in_progress { background: #2a1a4a; color: #bb66ff; }
.open { background: #3a3a1a; color: #ffd700; }
.replied { background: #1a2a4a; color: #4488ff; }
.closed { background: #1a3a2a; color: #00ff88; }
.auth-overlay { position: fixed; inset: 0; background: #0f0f23; display: flex; align-items: center; justify-content: center; z-index: 100; }
.auth-box { background: #1a1a3e; padding: 40px; border-radius: 16px; border: 1px solid #2a2a5e; text-align: center; max-width: 400px; width: 90%; }
.auth-box h2 { color: #fff; margin-bottom: 10px; }
.auth-box p { color: #8888aa; margin-bottom: 25px; font-size: 14px; }
.auth-box input { width: 100%; padding: 14px 16px; font-size: 16px; background: #0f0f23; border: 2px solid #2a2a5e; border-radius: 10px; color: #fff; margin-bottom: 16px; text-align: center; direction: ltr; }
.auth-box input:focus { border-color: #7b2ff7; outline: none; }
.auth-error { color: #ff4444; margin-top: 12px; font-size: 13px; display: none; }
.footer { text-align: center; padding: 20px; color: #4a4a7e; font-size: 12px; }
.hidden { display: none !important; }
.last-update { color: #4a4a7e; font-size: 11px; margin-top: 8px; }
</style>
</head>
<body>
<div class="header">
  <div><h1>🛠️ GazaServe</h1><span>لوحة تحكم الأدمن</span></div>
  <div class="header-actions">
    <span>🟢 متصل</span>
    <button class="btn" onclick="loadStats()">🔄 تحديث</button>
  </div>
</div>

<div id="authOverlay" class="auth-overlay ${isAuth ? 'hidden' : ''}">
  <div class="auth-box">
    <div style="font-size:48px;margin-bottom:16px">🛠️</div>
    <h2>لوحة تحكم GazaServe</h2>
    <p>أدخل معرف تيليغرام الخاص بالأدمن للدخول</p>
    <input type="password" id="tokenInput" placeholder="****" onkeydown="if(event.key==='Enter')auth()" autocomplete="off">
    <button class="btn btn-primary" onclick="auth()" style="width:100%;padding:14px;font-size:15px">🔓 دخول</button>
    <div id="authError" class="auth-error">❌ المعرف غير صحيح</div>
  </div>
</div>

<div id="dashboardContent" class="container ${isAuth ? '' : 'hidden'}">
  <div class="stats-grid" id="statsCards"></div>
  <div class="grid2">
    <div class="chart-box"><h3>📊 حالة الطلبات</h3><canvas id="requestsChart" height="200"></canvas></div>
    <div class="chart-box"><h3>⭐ أفضل الفنيين</h3><div id="topTechsList"></div><canvas id="techsChart" height="200" class="hidden"></canvas></div>
  </div>
  <div class="table-box" style="margin-bottom:25px">
    <h3>📋 آخر الطلبات</h3>
    <table><thead><tr><th>#</th><th>التخصص</th><th>المنطقة</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody id="requestsTable"></tbody></table>
  </div>
  <div class="table-box" style="margin-bottom:25px">
    <h3>📞 تذاكر الدعم</h3>
    <table style="max-width:400px"><thead><tr><th>الحالة</th><th>العدد</th></tr></thead><tbody id="ticketsTable"></tbody></table>
  </div>
  <div class="last-update" id="lastUpdate"></div>
</div>
<div class="footer">GazaServe &copy; 2026</div>

<script>
const token = ${JSON.stringify(isAuth ? req.query.token : '')};
if (token) { loadStats(); setInterval(loadStats, 30000); }

function auth() {
  const t = document.getElementById('tokenInput').value.trim();
  if (!t) return;
  window.location.href = '/dashboard?token=' + encodeURIComponent(t);
}

if (!token) {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  if (urlToken) {
    document.getElementById('authError').style.display = 'block';
  }
}

async function loadStats() {
  try {
    const ts = Date.now();
    const res = await fetch('/api/stats?token=' + token + '&_=' + ts);
    if (!res.ok) throw new Error('Unauthorized');
    const d = await res.json();
    renderStats(d);
    document.getElementById('lastUpdate').textContent = 'آخر تحديث: ' + new Date().toLocaleString('ar-EG');
  } catch (e) {
    document.getElementById('statsCards').innerHTML = '<div class="card" style="grid-column:1/-1"><div class="card-icon">⚠️</div><h3>خطأ</h3><div class="num" style="font-size:16px;color:#ff6666">تعذر تحميل البيانات</div><div class="sub">تأكد من صحة المعرف ثم أعد تحميل الصفحة</div></div>';
  }
}

function renderStats(d) {
  document.getElementById('statsCards').innerHTML = \`
    <div class="card"><div class="card-icon">👥</div><h3>المستخدمين</h3><div class="num">\${d.users}</div></div>
    <div class="card"><div class="card-icon">👨‍🔧</div><h3>الفنيين</h3><div class="num">\${d.technicians.approved}</div><div class="sub">\${d.technicians.pending} قيد المراجعة</div></div>
    <div class="card"><div class="card-icon">📋</div><h3>إجمالي الطلبات</h3><div class="num">\${d.requests.total}</div><div class="sub">\${d.requests.completed} مكتمل</div></div>
    <div class="card"><div class="card-icon">⏳</div><h3>قيد الانتظار</h3><div class="num">\${d.requests.pending}</div></div>
    <div class="card"><div class="card-icon">🔄</div><h3>قيد التنفيذ</h3><div class="num">\${d.requests.on_the_way + d.requests.in_progress}</div><div class="sub">\${d.requests.accepted} تم القبول</div></div>
    <div class="card"><div class="card-icon">📞</div><h3>تذاكر الدعم</h3><div class="num">\${d.tickets.total}</div><div class="sub">\${d.tickets.open} مفتوحة</div></div>
  \`;

  try {
    new Chart(document.getElementById('requestsChart'), {
      type: 'doughnut',
      data: { labels: ['قيد الانتظار','تم القبول','في الطريق','قيد التنفيذ','مكتمل','ملغي'], datasets: [{ data: [d.requests.pending,d.requests.accepted,d.requests.on_the_way,d.requests.in_progress,d.requests.completed,d.requests.canceled], backgroundColor: ['#ffd700','#4488ff','#00dddd','#bb66ff','#00ff88','#ff4444'], borderWidth: 0 }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#aaa', font: { size: 11 } } } } }
    });
  } catch(e) {}

  const techBox = document.getElementById('topTechsList');
  const techCanvas = document.getElementById('techsChart');
  if (d.topTechs.length > 0) {
    techBox.innerHTML = d.topTechs.map(t => \`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1f1f4e;font-size:13px"><span>\${t.name.substring(0,14)}</span><span style="color:#ffd700">\${'⭐'.repeat(Math.round(t.rating))} \${t.rating.toFixed(1)}</span></div>\`).join('');
    techCanvas.classList.remove('hidden');
    try {
      new Chart(techCanvas, {
        type: 'bar',
        data: { labels: d.topTechs.map(t => t.name.substring(0,10)), datasets: [{ label: 'التقييم', data: d.topTechs.map(t => t.rating || 0), backgroundColor: '#7b2ff7', borderRadius: 6 }] },
        options: { responsive: true, scales: { y: { min: 0, max: 5, grid: { color: '#2a2a5e' }, ticks: { color: '#666' } }, x: { ticks: { color: '#888' } } }, plugins: { legend: { display: false } } }
      });
    } catch(e) {}
  } else {
    techBox.innerHTML = '<div style="color:#6666aa;font-size:13px;padding:10px 0">لا يوجد تقييمات حتى الآن</div>';
  }

  const sl = { pending: '⏳ قيد الانتظار', accepted: '✅ تم القبول', on_the_way: '🚗 في الطريق', in_progress: '🔧 قيد التنفيذ', completed: '✔️ مكتمل', canceled: '❌ ملغي' };
  document.getElementById('requestsTable').innerHTML = d.recentRequests.map(r => \`<tr><td>\${r.id}</td><td>\${r.category}</td><td>\${r.location || '-'}</td><td><span class="status \${r.status}">\${sl[r.status] || r.status}</span></td><td>\${new Date(r.created).toLocaleDateString('ar-EG')}</td></tr>\`).join('');

  const tl = { open: '⏳ مفتوحة', replied: '✉️ تم الرد', closed: '✅ مغلقة' }, tc = { open: 'open', replied: 'replied', closed: 'closed' };
  document.getElementById('ticketsTable').innerHTML = ['open','replied','closed'].map(s => \`<tr><td><span class="status \${tc[s]}">\${tl[s]}</span></td><td>\${d.tickets[s]}</td></tr>\`).join('');
}
</script>
</body>
</html>`;
  res.send(html);
});

module.exports = router;
