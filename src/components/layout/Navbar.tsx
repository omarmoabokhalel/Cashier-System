import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { supabase } from '../../lib/supabase';
import { Menu, LogOut, Clock, ShieldCheck, User } from 'lucide-react';
import { Badge } from '../ui/Badge';

export interface NavbarProps {
  pageTitle: string;
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ pageTitle, onToggleSidebar }) => {
  const { user, logout } = useAuthStore();
  const [isShiftOpen, setIsShiftOpen] = useState(true);
  const [storeName, setStoreName] = useState('متجر الملابس');

  useEffect(() => {
    async function checkShift() {
      try {
        const { data } = await (supabase.from('cashier_shifts') as any)
          .select('id')
          .eq('status', 'open')
          .limit(1);
        setIsShiftOpen(!!(data && data.length > 0));

        // Load store name
        const cachedBranch = localStorage.getItem('branch_settings');
        const cachedConfig = localStorage.getItem('app_config');
        const branchObj = cachedBranch ? JSON.parse(cachedBranch) : null;
        const configObj = cachedConfig ? JSON.parse(cachedConfig) : null;
        if (branchObj?.name_ar || configObj?.appName) {
          setStoreName(branchObj?.name_ar || configObj?.appName);
        }
      } catch (e) {
        // ignore
      }
    }
    checkShift();

    const handleStorageChange = () => {
      const cachedBranch = localStorage.getItem('branch_settings');
      const cachedConfig = localStorage.getItem('app_config');
      const branchObj = cachedBranch ? JSON.parse(cachedBranch) : null;
      const configObj = cachedConfig ? JSON.parse(cachedConfig) : null;
      if (branchObj?.name_ar || configObj?.appName) {
        setStoreName(branchObj?.name_ar || configObj?.appName);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  if (!user) return null;

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between gap-4 select-none" dir="rtl">
      {/* Right Side: Toggle & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-bold text-white leading-tight">{pageTitle}</h1>
          <span className="text-[11px] text-slate-400">نظام إدارة {storeName}</span>
        </div>
      </div>

      {/* Left Side: Shift Indicator, User Info & Actions */}
      <div className="flex items-center gap-3">
        {/* Active Cashier Shift Indicator */}
        <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs ${
          isShiftOpen
            ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300'
            : 'bg-rose-950/60 border border-rose-800/80 text-rose-300'
        }`}>
          <Clock className={`w-3.5 h-3.5 ${isShiftOpen ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
          <span className="font-semibold">
            الوردية الحالية: {isShiftOpen ? 'مفتوحة' : 'مغلقة'}
          </span>
        </div>

        {/* Role Badge */}
        <Badge variant="primary" size="sm" className="hidden md:inline-flex">
          {user.roleNameAr}
        </Badge>

        {/* User Account Menu */}
        <div className="flex items-center gap-3 border-r border-slate-800 pr-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden sm:block text-right">
            <div className="text-xs font-bold text-slate-200">{user.fullName}</div>
            <div className="text-[10px] text-slate-400">{user.email}</div>
          </div>
          <button
            onClick={logout}
            className="p-2 text-rose-400 hover:bg-rose-950/60 hover:text-rose-300 rounded-xl border border-rose-900/40 transition-all text-xs font-semibold flex items-center gap-1.5"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
