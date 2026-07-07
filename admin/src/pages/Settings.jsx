import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../api';
import { useToast } from '../context/ToastContext';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    bot_token: '',
    business_hours_start: '09:00',
    business_hours_end: '17:00',
    service_types: [],
  });
  const [tokenVisible, setTokenVisible] = useState(false);
  const [newService, setNewService] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await getSettings();
        const s = data?.settings ?? data?.data ?? data;
        if (s) {
          setForm({
            bot_token: s.bot_token || '',
            business_hours_start: s.business_hours_start || '09:00',
            business_hours_end: s.business_hours_end || '17:00',
            service_types: s.service_types || [],
          });
        }
      } catch (e) {
        setError(e.response?.data?.message || 'فشل في تحميل الإعدادات');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const addService = () => {
    const val = newService.trim();
    if (!val) return;
    if (form.service_types.includes(val)) { addToast('الخدمة موجودة بالفعل', 'error'); return; }
    setForm({ ...form, service_types: [...form.service_types, val] });
    setNewService('');
  };

  const removeService = (index) => {
    setForm({ ...form, service_types: form.service_types.filter((_, i) => i !== index) });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings(form);
      addToast('تم حفظ الإعدادات بنجاح', 'success');
    } catch (e) {
      addToast(e.response?.data?.message || 'حدث خطأ في الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-container"><span className="loading-text">جاري التحميل...</span></div>;
  if (error) return <div className="error-box">{error}</div>;

  return (
    <div>
      <h1 className="page-title" style={{ marginBottom: 24 }}>الإعدادات</h1>

      <form onSubmit={handleSave} className="form-section" style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 20 }}>
          <label>Bot Token</label>
          <div style={{ position: 'relative' }}>
            <input
              type={tokenVisible ? 'text' : 'password'}
              value={form.bot_token}
              onChange={e => setForm({ ...form, bot_token: e.target.value })}
              className="input"
              placeholder="********************"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setTokenVisible(!tokenVisible)}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}
            >
              {tokenVisible ? '🔒' : '👁️'}
            </button>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div>
            <label>وقت بدء العمل</label>
            <input type="time" value={form.business_hours_start} onChange={e => setForm({ ...form, business_hours_start: e.target.value })} className="input" dir="ltr" />
          </div>
          <div>
            <label>وقت انتهاء العمل</label>
            <input type="time" value={form.business_hours_end} onChange={e => setForm({ ...form, business_hours_end: e.target.value })} className="input" dir="ltr" />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label>أنواع الخدمات</label>
          <div className="flex-wrap" style={{ gap: 6, marginBottom: 10 }}>
            {form.service_types.map((s, i) => (
              <span key={i} className="tag">
                {s}
                <button type="button" onClick={() => removeService(i)} className="tag-remove">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex-row" style={{ gap: 8 }}>
            <input
              value={newService} onChange={e => setNewService(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addService(); } }}
              placeholder="أضف خدمة جديدة..."
              className="input"
            />
            <button type="button" onClick={addService} className="btn btn-outline">إضافة</button>
          </div>
        </div>

        <div className="form-actions" style={{ paddingTop: 8 }}>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </form>
    </div>
  );
}
