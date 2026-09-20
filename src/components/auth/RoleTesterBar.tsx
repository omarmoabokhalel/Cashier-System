import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { UserRoleCode } from '../../types/auth';
import { ShieldCheck, UserCheck, Eye, Lock } from 'lucide-react';

export const RoleTesterBar: React.FC = () => {
  const { user, simulateRole, hasPermission } = useAuthStore();

  const roles: { code: UserRoleCode; label: string; badgeColor: string }[] = [
    { code: 'owner', label: 'المالك (Owner)', badgeColor: 'bg-purple-600 text-white' },
    { code: 'cashier', label: 'كاشير (Cashier)', badgeColor: 'bg-amber-600 text-white' },
  ];

  if (!user) return null;

  return (
    <div className="bg-slate-900 border-b border-slate-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-sans shadow-md" dir="rtl">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span className="font-semibold text-slate-300">أداة فحص واختبار الصلاحيات الأمنية:</span>
        <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${roles.find(r => r.code === user.roleCode)?.badgeColor}`}>
          {user.roleNameAr}
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-slate-400 ml-1">تبديل الدور للتجربة:</span>
        {roles.map((r) => (
          <button
            key={r.code}
            onClick={() => simulateRole(r.code)}
            className={`px-2.5 py-1 rounded transition-all text-xs font-medium ${
              user.roleCode === r.code
                ? 'bg-white text-slate-900 font-bold shadow'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 border-r border-slate-800 pr-3">
        <span className="flex items-center gap-1">
          {hasPermission('view_cost_prices') ? (
            <span className="text-emerald-400 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> رؤية التكلفة: متاح</span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> رؤية التكلفة: محظور</span>
          )}
        </span>
        <span className="flex items-center gap-1">
          {hasPermission('adjust_stock') ? (
            <span className="text-emerald-400 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> التعديل المباشر: متاح</span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> التعديل المباشر: محظور</span>
          )}
        </span>
        <span className="flex items-center gap-1">
          {hasPermission('manage_users') ? (
            <span className="text-emerald-400 flex items-center gap-1"><UserCheck className="w-3.5 h-3.5" /> إدارة المستخدمين: متاح</span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> إدارة المستخدمين: محظور</span>
          )}
        </span>
      </div>
    </div>
  );
};
