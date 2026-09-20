import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { ShoppingBag, Lock, Mail, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginWithPin, loading, error } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'password' | 'pin'>('password');
  const [storeName, setStoreName] = useState('متجر الملابس');
  
  // Password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // PIN state
  const [pin, setPin] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    try {
      const cachedBranch = localStorage.getItem('branch_settings');
      const cachedConfig = localStorage.getItem('app_config');
      const branchObj = cachedBranch ? JSON.parse(cachedBranch) : null;
      const configObj = cachedConfig ? JSON.parse(cachedConfig) : null;
      if (branchObj?.name_ar || configObj?.appName) {
        setStoreName(branchObj?.name_ar || configObj?.appName);
      }
    } catch (e) {}
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    const ok = await login(email, password);
    if (ok) {
      setSuccessMsg('تم تسجيل الدخول بنجاح!');
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    const ok = await loginWithPin(pin);
    if (ok) {
      setSuccessMsg('تم تسجيل دخول الكاشير عبر PIN بنجاح!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-slate-900 p-6 text-center border-b border-slate-800">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-3 shadow-inner">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">نظام إدارة ونقطة بيع {storeName}</h1>
          <p className="text-xs text-indigo-200/80 mt-1">تسجيل الدخول الآمن للنظام والورديات</p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-900/50 p-1">
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'password'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>البريد وكلمة المرور</span>
          </button>
          <button
            onClick={() => setActiveTab('pin')}
            className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              activeTab === 'pin'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>رمز PIN السريع (للكاشير)</span>
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@store.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    required
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">كلمة المرور</label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    required
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 text-sm mt-2"
              >
                {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">أدخل رمز PIN للكاشير (4 أرقام)</label>
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="1234"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-center text-2xl tracking-[0.5em] font-mono text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-amber-600/20 disabled:opacity-50 text-sm mt-2"
              >
                {loading ? 'جاري الدخول...' : 'دخول الكاشير السريع'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
