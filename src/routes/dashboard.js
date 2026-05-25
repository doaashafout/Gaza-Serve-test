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
<style>
* { margin: 0; padding: 0; box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; }
body { background: #0f0f23; color: #e0e0e0; min-height: 100vh; }
.header { background: linear-gradient(135deg, #1a1a3e, #2a1a5e); padding: 20px 30px; border-bottom: 1px solid #3a3a6e; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.header h1 { font-size: 24px; background: linear-gradient(90deg, #00d4ff, #7b2ff7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.header-actions { display: flex; gap: 10px; align-items: center; }
.header-actions .badge { background: #2a2a5e; padding: 6px 14px; border-radius: 20px; color: #88ff88; font-size: 12px; }
.container { max-width: 1300px; margin: 0 auto; padding: 20px; }
.btn { background: #2a2a5e; color: #e0e0e0; border: 1px solid #4a4a8e; padding: 8px 18px; border-radius: 8px; cursor: pointer; font-size: 13px; }
.btn:hover { background: #3a3a7e; }
.btn-primary { background: linear-gradient(135deg, #00d4ff, #7b2ff7); border: none; color: #fff; font-weight: 600; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
.card { background: #1a1a3e; border-radius: 12px; padding: 18px; border: 1px solid #2a2a5e; }
.card-icon { font-size: 22px; margin-bottom: 6px; }
.card h3 { font-size: 11px; color: #8888aa; letter-spacing: 0.5px; margin-bottom: 4px; }
.card .num { font-size: 26px; font-weight: 700; color: #fff; }
.card .sub { font-size: 11px; color: #6666aa; margin-top: 3px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
@media (max-width: 768px) { .grid2 { grid-template-columns: 1fr; } }
.panel { background: #1a1a3e; border-radius: 12px; padding: 20px; border: 1px solid #2a2a5e; }
.panel h3 { font-size: 14px; margin-bottom: 14px; color: #ccc; display: flex; align-items: center; gap: 8px; }
.bar-chart { display: flex; flex-direction: column; gap: 10px; }
.bar-row { display: flex; align-items: center; gap: 10px; }
.bar-label { width: 90px; font-size: 12px; color: #aaa; text-align: left; flex-shrink: 0; }
.bar-track { flex: 1; height: 22px; background: #0f0f23; border-radius: 11px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 11px; transition: width 0.6s ease; display: flex; align-items: center; padding-right: 10px; font-size: 11px; font-weight: 600; color: #fff; }
.bar-val { width: 40px; font-size: 13px; font-weight: 700; color: #ddd; text-align: center; flex-shrink: 0; }
.table-wrap { background: #1a1a3e; border-radius: 12px; padding: 20px; border: 1px solid #2a2a5e; overflow-x: auto; margin-bottom: 16px; }
.table-wrap h3 { font-size: 14px; margin-bottom: 14px; color: #ccc; display: flex; align-items: center; gap: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: right; padding: 10px 12px; border-bottom: 2px solid #2a2a5e; color: #8888aa; font-weight: 600; font-size: 11px; letter-spacing: 0.5px; }
td { padding: 10px 12px; border-bottom: 1px solid #1f1f4e; color: #ccc; }
.status { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; display: inline-block; }
.pending { background: #3a3a1a; color: #ffd700; }
.completed { background: #1a3a2a; color: #00ff88; }
.canceled { background: #3a1a1a; color: #ff4444; }
.accepted { background: #1a2a4a; color: #4488ff; }
.on_the_way { background: #1a3a3a; color: #00dddd; }
.in_progress { background: #2a1a4a; color: #bb66ff; }
.open { background: #3a3a1a; color: #ffd700; }
.replied { background: #1a2a4a; color: #4488ff; }
.closed { background: #1a3a2a; color: #00ff88; }
.auth-overlay { position: fixed; inset: 0; background: #0f0f23; display: flex; align-items: center; justify-content: center; z-index: 100; }
.auth-box { background: #1a1a3e; padding: 40px; border-radius: 16px; border: 1px solid #2a2a5e; text-align: center; max-width: 400px; width: 90%; }
.auth-box h2 { color: #fff; margin-bottom: 8px; }
.auth-box p { color: #8888aa; margin-bottom: 22px; font-size: 14px; }
.auth-box input { width: 100%; padding: 14px; font-size: 16px; background: #0f0f23; border: 2px solid #2a2a5e; border-radius: 10px; color: #fff; margin-bottom: 14px; text-align: center; direction: ltr; }
.auth-box input:focus { border-color: #7b2ff7; outline: none; }
.auth-error { color: #ff4444; margin-top: 10px; font-size: 13px; display: none; }
.hidden { display: none !important; }
.loading { text-align: center; padding: 40px; color: #6666aa; }
.loading .spinner { display: inline-block; width: 30px; height: 30px; border: 3px solid #2a2a5e; border-top-color: #7b2ff7; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 12px; }
@keyframes spin { to { transform: rotate(360deg); } }
.footer { text-align: center; padding: 16px; color: #3a3a6e; font-size: 12px; }
.tech-list { display: flex; flex-direction: column; gap: 6px; }
.tech-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #1f1f4e; font-size: 13px; }
.tech-item:last-child { border-bottom: none; }
.tech-item .stars { color: #ffd700; font-size: 12px; }
</style>
</head>
<body>
<div class="header">
  <div><h1>🛠️ GazaServe</h1></div>
  <div class="header-actions">
    <span class="badge">🟢 متصل</span>
    <button class="btn" onclick="ld()">🔄 تحديث</button>
  </div>
</div>

<div id="authOverlay" class="auth-overlay ${isAuth ? 'hidden' : ''}">
  <div class="auth-box">
    <div style="font-size:48px;margin-bottom:12px">🛠️</div>
    <h2>لوحة تحكم GazaServe</h2>
    <p>أدخل معرف تيليغرام الخاص بالأدمن</p>
    <input type="password" id="tokenInput" placeholder="معرف تيليغرام" onkeydown="if(event.key==='Enter'){document.getElementById('authError').style.display='none';auth()}">
    <button class="btn btn-primary" onclick="auth()" style="width:100%;padding:14px;font-size:15px">🔓 دخول</button>
    <div id="authError" class="auth-error">❌ المعرف غير صحيح</div>
  </div>
</div>

<div id="dash" class="container ${isAuth ? '' : 'hidden'}">
  <div id="loading" class="loading"><div class="spinner"></div><div>جاري تحميل البيانات...</div></div>
  <div id="content" class="hidden">
    <div class="stats-grid" id="cards"></div>
    <div class="grid2">
      <div class="panel"><h3>📊 حالة الطلبات</h3><div id="reqBars"></div></div>
      <div class="panel"><h3>⭐ أفضل الفنيين</h3><div id="topTechs"></div></div>
    </div>
    <div class="table-wrap"><h3>📋 آخر الطلبات</h3><table><thead><tr><th>#</th><th>التخصص</th><th>المنطقة</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody id="reqTbl"></tbody></table></div>
    <div class="grid2">
      <div class="panel"><h3>📞 تذاكر الدعم</h3><div id="tickets"></div></div>
      <div class="panel"><h3>📈 إحصائيات سريعة</h3><div id="quickStats"></div></div>
    </div>
    <div style="text-align:center;padding:10px;color:#4a4a7e;font-size:12px" id="updateTime"></div>
  </div>
</div>
<div class="footer">GazaServe &copy; 2026</div>

<script>
const TOKEN = ${JSON.stringify(isAuth ? req.query.token : '')};
if (TOKEN) { ld(); setInterval(ld, 30000); }

function auth() {
  const t = document.getElementById('tokenInput').value.trim();
  if (t) window.location.href = '/dashboard?token=' + encodeURIComponent(t);
}

function $(id) { return document.getElementById(id); }

async function ld() {
  if (!TOKEN) return;
  try {
    const r = await fetch('/api/stats?token=' + TOKEN + '&_=' + Date.now());
    if (!r.ok) throw new Error('x');
    const d = await r.json();
    render(d);
  } catch (e) {
    $('loading').classList.add('hidden');
    $('content').classList.remove('hidden');
    $('cards').innerHTML = '<div class="card" style="grid-column:1/-1;text-align:center;padding:30px"><div style="font-size:32px;margin-bottom:10px">⚠️</div><div style="color:#ff6666">تعذر تحميل البيانات</div><div style="color:#666;font-size:12px;margin-top:6px">تأكد من صحة المعرف أو أعد تحميل الصفحة</div></div>';
  }
}

function render(d) {
  $('loading').classList.add('hidden');
  $('content').classList.remove('hidden');

  $('cards').innerHTML = \`
    <div class="card"><div class="card-icon">👥</div><h3>المستخدمين</h3><div class="num">\${d.users}</div></div>
    <div class="card"><div class="card-icon">👨‍🔧</div><h3>الفنيين</h3><div class="num">\${d.technicians.approved}</div><div class="sub">\${d.technicians.pending} pending</div></div>
    <div class="card"><div class="card-icon">📋</div><h3>الطلبات</h3><div class="num">\${d.requests.total}</div><div class="sub">\${d.requests.completed} ✔️ مكتمل</div></div>
    <div class="card"><div class="card-icon">⏳</div><h3>قيد الانتظار</h3><div class="num">\${d.requests.pending}</div></div>
    <div class="card"><div class="card-icon">🔄</div><h3>جاري التنفيذ</h3><div class="num">\${d.requests.on_the_way + d.requests.in_progress}</div><div class="sub">\${d.requests.accepted} تم القبول</div></div>
    <div class="card"><div class="card-icon">📞</div><h3>تذاكر الدعم</h3><div class="num">\${d.tickets.total}</div><div class="sub">\${d.tickets.open} مفتوحة</div></div>
  \`;

  const total = Math.max(d.requests.total, 1);
  const bars = [
    { label: '⏳ قيد الانتظار', val: d.requests.pending, color: '#ffd700' },
    { label: '✅ تم القبول', val: d.requests.accepted, color: '#4488ff' },
    { label: '🚗 في الطريق', val: d.requests.on_the_way, color: '#00dddd' },
    { label: '🔧 قيد التنفيذ', val: d.requests.in_progress, color: '#bb66ff' },
    { label: '✔️ مكتمل', val: d.requests.completed, color: '#00ff88' },
    { label: '❌ ملغي', val: d.requests.canceled, color: '#ff4444' },
  ];
  $('reqBars').innerHTML = bars.map(b => \`<div class="bar-row"><span class="bar-label">\${b.label}</span><div class="bar-track"><div class="bar-fill" style="width:\${(b.val/total*100).toFixed(1)}%;background:\${b.color}">\${b.val > 0 ? b.val : ''}</div></div><span class="bar-val">\${b.val}</span></div>\`).join('');

  if (d.topTechs.length > 0) {
    $('topTechs').innerHTML = d.topTechs.map(t => \`<div class="tech-item"><span>\${t.name.substring(0,16)}</span><span class="stars">\${'★'.repeat(Math.round(t.rating))}\${'☆'.repeat(5-Math.round(t.rating))} \${t.rating.toFixed(1)}</span></div>\`).join('');
  } else {
    $('topTechs').innerHTML = '<div style="color:#6666aa;font-size:13px;padding:10px 0">لا توجد تقييمات بعد</div>';
  }

  const sl = { pending:'⏳ قيد الانتظار', accepted:'✅ تم القبول', on_the_way:'🚗 في الطريق', in_progress:'🔧 قيد التنفيذ', completed:'✔️ مكتمل', canceled:'❌ ملغي' };
  $('reqTbl').innerHTML = d.recentRequests.map(r => \`<tr><td>\${r.id}</td><td>\${r.category}</td><td>\${r.location||'-'}</td><td><span class="status \${r.status}">\${sl[r.status]||r.status}</span></td><td>\${new Date(r.created).toLocaleDateString('ar-EG')}</td></tr>\`).join('');

  $('tickets').innerHTML = [
    { s:'open', l:'⏳ مفتوحة', c:'open' },
    { s:'replied', l:'✉️ تم الرد', c:'replied' },
    { s:'closed', l:'✅ مغلقة', c:'closed' }
  ].map(t => \`<div class="bar-row"><span class="bar-label">\${t.l}</span><div class="bar-track"><div class="bar-fill" style="width:\${(d.tickets[t.s]/Math.max(d.tickets.total,1)*100).toFixed(1)}%;background:\${t.s==='open'?'#ffd700':t.s==='replied'?'#4488ff':'#00ff88'}">\${d.tickets[t.s] > 0 ? d.tickets[t.s] : ''}</div></div><span class="bar-val">\${d.tickets[t.s]}</span></div>\`).join('');

  const pct = total > 0 ? ((d.requests.completed / total) * 100).toFixed(0) : 0;
  $('quickStats').innerHTML = \`
    <div class="tech-item"><span>📊 نسبة الإنجاز</span><span style="color:#00ff88;font-size:20px;font-weight:700">\${pct}%</span></div>
    <div class="tech-item"><span>👥 إجمالي المستخدمين</span><span style="font-size:18px;font-weight:700">\${d.users}</span></div>
    <div class="tech-item"><span>👨‍🔧 الفنيين النشطين</span><span style="font-size:18px;font-weight:700">\${d.technicians.approved}</span></div>
    <div class="tech-item"><span>📞 تذاكر مفتوحة</span><span style="font-size:18px;font-weight:700">\${d.tickets.open}</span></div>
  \`;

  $('updateTime').textContent = 'آخر تحديث: ' + new Date().toLocaleString('ar-EG');
}
</script>
</body>
</html>`;
  res.send(html);
});

module.exports = router;
