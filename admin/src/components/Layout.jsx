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
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setOpen(false)} />
      )}
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 right-0 z-30 w-64 bg-gray-900 border-l border-gray-800 transform transition-transform duration-200 ${
        open ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-gray-800">
            <h1 className="text-lg font-bold bg-gradient-to-l from-cyan-400 to-purple-500 bg-clip-text text-transparent">
              🛠️ GazaServe
            </h1>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {links.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all ${
                    isActive
                      ? 'bg-gradient-to-l from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`
                }
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="p-3 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-900/20 w-full transition-all"
            >
              <span>🚪</span>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>
      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur-sm border-b border-gray-800 lg:hidden">
          <button onClick={() => setOpen(true)} className="p-4 text-gray-400 text-xl">
            ☰
          </button>
        </div>
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
