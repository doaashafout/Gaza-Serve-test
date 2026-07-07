import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/admin/dashboard', label: 'لوحة التحكم', icon: '📊' },
  { to: '/admin/technicians', label: 'الفنيين', icon: '👨‍🔧' },
  { to: '/admin/requests', label: 'الطلبات', icon: '📋' },
  { to: '/admin/categories', label: 'التصنيفات', icon: '📂' },
  { to: '/admin/users', label: 'المستخدمين', icon: '👥' },
  { to: '/admin/tickets', label: 'الدعم الفني', icon: '📞' },
  { to: '/admin/notifications', label: 'الإشعارات', icon: '🔔' },
  { to: '/admin/logs', label: 'السجلات', icon: '📜' },
  { to: '/admin/settings', label: 'الإعدادات', icon: '⚙️' },
  { to: '/admin/admins', label: 'المشرفين', icon: '🛡️' },
];

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/');
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--bg-main)' }}>
      {/* Overlay */}
      <div className={`sidebar-overlay ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      {/* Sidebar */}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <h1>🛠️ <span>Gaza</span>Serve</h1>
        </div>
        <nav className="sidebar-nav">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{link.icon}</span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="sidebar-logout">
            <span>🚪</span>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-area">
        <div className="main-header-mobile">
          <button onClick={() => setOpen(true)} className="btn btn-ghost" style={{ fontSize: '20px', padding: '4px 8px' }}>
            ☰
          </button>
        </div>
        <div className="main-content">
          {children}
        </div>
      </div>
    </div>
  );
}
