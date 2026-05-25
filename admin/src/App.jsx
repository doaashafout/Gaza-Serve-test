import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Technicians from './pages/Technicians';
import Requests from './pages/Requests';
import Categories from './pages/Categories';
import Users from './pages/Users';
import Tickets from './pages/Tickets';
import Notifications from './pages/Notifications';
import ActivityLogs from './pages/ActivityLogs';
import Settings from './pages/Settings';
import Admins from './pages/Admins';

function ProtectedRoute({ children }) {
  const { isAuth } = useAuth();
  const hasToken = isAuth || !!localStorage.getItem('admin_token');
  if (!hasToken) return <Navigate to="/admin/" replace />;
  return children;
}

function AppRoutes() {
  const { isAuth } = useAuth();

  return (
    <Routes>
      <Route path="/admin/" element={isAuth ? <Navigate to="/admin/dashboard" replace /> : <Login />} />
      <Route path="/admin/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/admin/technicians" element={<ProtectedRoute><Layout><Technicians /></Layout></ProtectedRoute>} />
      <Route path="/admin/requests" element={<ProtectedRoute><Layout><Requests /></Layout></ProtectedRoute>} />
      <Route path="/admin/categories" element={<ProtectedRoute><Layout><Categories /></Layout></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute><Layout><Users /></Layout></ProtectedRoute>} />
      <Route path="/admin/tickets" element={<ProtectedRoute><Layout><Tickets /></Layout></ProtectedRoute>} />
      <Route path="/admin/notifications" element={<ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>} />
      <Route path="/admin/logs" element={<ProtectedRoute><Layout><ActivityLogs /></Layout></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
      <Route path="/admin/admins" element={<ProtectedRoute><Layout><Admins /></Layout></ProtectedRoute>} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
