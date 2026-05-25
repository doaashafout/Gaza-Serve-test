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
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4" dir="rtl">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🛠️</div>
          <h1 className="text-2xl font-bold bg-gradient-to-l from-cyan-400 to-purple-500 bg-clip-text text-transparent">
            GazaServe
          </h1>
          <p className="text-gray-500 text-sm mt-2">لوحة تحكم المشرفين</p>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={token}
            onChange={e => { setToken(e.target.value); setError(''); }}
            placeholder="أدخل معرف المشرف"
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all mb-4"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}
          <button type="submit" className="w-full py-3 rounded-xl bg-gradient-to-l from-cyan-500 to-purple-600 text-white font-semibold hover:opacity-90 transition-all">
            🔓 دخول
          </button>
        </form>
      </div>
    </div>
  );
}
