import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4" dir="rtl">
          <div className="bg-gray-900 rounded-2xl border border-red-800 p-8 max-w-lg text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-red-400 mb-2">حدث خطأ في تحميل لوحة التحكم</h2>
            <p className="text-gray-400 text-sm mb-4">{this.state.error?.message || 'خطأ غير معروف'}</p>
            <p className="text-gray-500 text-xs mb-6">حاول تحديث الصفحة أو استخدم متصفح آخر</p>
            <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-l from-cyan-500 to-purple-600 text-white font-medium text-sm hover:opacity-90 transition-all">
              🔄 إعادة تحميل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
