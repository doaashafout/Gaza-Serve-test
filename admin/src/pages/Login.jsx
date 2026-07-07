import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const { login, isAuth } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl && !isAuth) {
      login(tokenFromUrl);
      navigate('/admin/dashboard', { replace: true });
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!token.trim()) { setError('الرجاء إدخال معرف المشرف'); return; }
    login(token.trim());
    navigate('/admin/dashboard');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green-primary)', padding: 16 }} dir="rtl">
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--green-primary)', margin: '0 0 4px' }}>
            GazaServe
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>لوحة تحكم المشرفين</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={token}
            onChange={e => { setToken(e.target.value); setError(''); }}
            placeholder="أدخل معرف المشرف"
            className="input"
            style={{ marginBottom: 16 }}
            autoFocus
          />
          {error && <p style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px 0', justifyContent: 'center', fontSize: 15 }}>
            🔓 دخول
          </button>
        </form>
      </div>
    </div>
  );
}
