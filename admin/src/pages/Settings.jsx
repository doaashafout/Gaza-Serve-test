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

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-lg">جاري التحميل...</div>;
  if (error) return <div className="bg-red-900/30 border border-red-800 text-red-400 p-4 rounded-xl">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">الإعدادات</h1>

      <form onSubmit={handleSave} className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6 max-w-2xl">
        <div>
          <label className="block text-sm text-gray-400 mb-2">Bot Token</label>
          <div className="relative">
            <input
              type={tokenVisible ? 'text' : 'password'}
              value={form.bot_token}
              onChange={e => setForm({ ...form, bot_token: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all ltr text-left"
              placeholder="********************"
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setTokenVisible(!tokenVisible)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-sm"
            >
              {tokenVisible ? '🔒' : '👁️'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">وقت بدء العمل</label>
            <input
              type="time"
              value={form.business_hours_start}
              onChange={e => setForm({ ...form, business_hours_start: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all"
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-2">وقت انتهاء العمل</label>
            <input
              type="time"
              value={form.business_hours_end}
              onChange={e => setForm({ ...form, business_hours_end: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all"
              dir="ltr"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-2">أنواع الخدمات</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {form.service_types.map((s, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 text-sm border border-gray-700">
                {s}
                <button type="button" onClick={() => removeService(i)} className="text-red-400 hover:text-red-300 text-xs">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newService} onChange={e => setNewService(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addService(); } }}
              placeholder="أضف خدمة جديدة..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 focus:border-cyan-500 outline-none text-sm transition-all"
            />
            <button type="button" onClick={addService} className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm transition-all">إضافة</button>
          </div>
        </div>

        <div className="pt-2">
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-gradient-to-l from-cyan-500 to-purple-600 hover:opacity-90 disabled:opacity-50 transition-all">
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </button>
        </div>
      </form>
    </div>
  );
}
