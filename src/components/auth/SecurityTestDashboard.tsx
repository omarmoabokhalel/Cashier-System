import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { PermissionGuard } from './PermissionGuard';
import { ShieldCheck, Lock, CheckCircle2, XCircle, AlertTriangle, DollarSign, Users, Package, Sliders } from 'lucide-react';

export const SecurityTestDashboard: React.FC = () => {
  const { user, hasPermission, canAccessBranch } = useAuthStore();

  if (!user) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 font-sans text-slate-100" dir="rtl">
      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">{user.fullName}</h2>
            <span className="px-3 py-1 bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 rounded-full text-xs font-semibold">
              {user.roleNameAr}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">الفرع الحالي: {user.branchNameAr || 'الفرع الرئيسي'}</p>
        </div>

        <div className="flex items-center gap-3 text-xs bg-slate-950 p-3 rounded-xl border border-slate-800">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>إجمالي الصلاحيات الفعالة للحساب: <strong className="text-emerald-400">{user.permissions.length}</strong> صلاحية</span>
        </div>
      </div>

      {/* Security Rule Matrix Verification */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Test Rule 1: View Cost Prices */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <h4 className="font-bold text-sm">عرض أسعار التكلفة</h4>
            </div>
            {hasPermission('view_cost_prices') ? (
              <span className="text-emerald-400 flex items-center gap-1 text-xs bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800"><CheckCircle2 className="w-4 h-4" /> متاح</span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1 text-xs bg-rose-950/60 px-2 py-1 rounded border border-rose-800"><XCircle className="w-4 h-4" /> محظور</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">قاعدة الأمان: يُحظر على الكاشير الاطلاع على سعر تكلفة المنتج.</p>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <PermissionGuard permission="view_cost_prices" fallback={<span className="text-rose-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> بيانات التكلفة مخصصة للمدراء فقط (سعر التكلفة: ***)</span>}>
              <span className="text-emerald-300 font-mono">سعر التكلفة: 35.00 جنيه (ظاهر للمصرح لهم)</span>
            </PermissionGuard>
          </div>
        </div>

        {/* Test Rule 2: Stock Modification */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-400" />
              <h4 className="font-bold text-sm">تعديل المخزون المباشر</h4>
            </div>
            {hasPermission('adjust_stock') ? (
              <span className="text-emerald-400 flex items-center gap-1 text-xs bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800"><CheckCircle2 className="w-4 h-4" /> متاح</span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1 text-xs bg-rose-950/60 px-2 py-1 rounded border border-rose-800"><XCircle className="w-4 h-4" /> محظور</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">قاعدة الأمان: الكاشير لا يمكنه تسوية المخزون يدوياً.</p>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <PermissionGuard permission="adjust_stock" fallback={<span className="text-rose-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> زر التعديل المباشر مخفي وغير مفعّل</span>}>
              <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded font-semibold">تعديل كمية المخزون (مسموح)</button>
            </PermissionGuard>
          </div>
        </div>

        {/* Test Rule 3: User & Permission Management */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <h4 className="font-bold text-sm">إدارة المستخدمين والأدوار</h4>
            </div>
            {hasPermission('manage_users') ? (
              <span className="text-emerald-400 flex items-center gap-1 text-xs bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800"><CheckCircle2 className="w-4 h-4" /> متاح</span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1 text-xs bg-rose-950/60 px-2 py-1 rounded border border-rose-800"><XCircle className="w-4 h-4" /> محظور</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">قاعدة الأمان: يقتصر على الأدمن والمالك فقط.</p>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <PermissionGuard permission="manage_users" fallback={<span className="text-rose-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> قسم إدارة الموظفين محجوب بالكامل</span>}>
              <span className="text-purple-300 font-semibold">شاشة إضافة موظف وتعديل الصلاحيات مفعّلة</span>
            </PermissionGuard>
          </div>
        </div>

        {/* Test Rule 4: View Profit Margins */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-emerald-400" />
              <h4 className="font-bold text-sm">عرض الأرباح المالية</h4>
            </div>
            {hasPermission('view_profit') ? (
              <span className="text-emerald-400 flex items-center gap-1 text-xs bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800"><CheckCircle2 className="w-4 h-4" /> متاح</span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1 text-xs bg-rose-950/60 px-2 py-1 rounded border border-rose-800"><XCircle className="w-4 h-4" /> محظور</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">قاعدة الأمان: حظر الاطلاع على صافي الربح للموظفين العاديين.</p>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <PermissionGuard permission="view_profit" fallback={<span className="text-rose-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> مؤشرات صافي الربح مخفية</span>}>
              <span className="text-emerald-400 font-bold">صافي الربح الشهري: +54,200.00 جنيه</span>
            </PermissionGuard>
          </div>
        </div>

        {/* Test Rule 5: Multi-Branch Access Verification */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-400" />
              <h4 className="font-bold text-sm">صلاحية الوصول للفروع الأُخرى</h4>
            </div>
            {canAccessBranch('br-other-branch-id') ? (
              <span className="text-emerald-400 flex items-center gap-1 text-xs bg-emerald-950/60 px-2 py-1 rounded border border-emerald-800"><CheckCircle2 className="w-4 h-4" /> وصول شامل</span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1 text-xs bg-amber-950/60 px-2 py-1 rounded border border-amber-800"><Lock className="w-4 h-4" /> مقيد بالفرع</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mb-3">المالك والأدمن يمكنهم التبديل بين كل الفروع، بينما مدير الفرع والكاشير مقيدون بفرعهم فقط.</p>
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            {user.roleCode === 'owner' ? (
              <span className="text-emerald-400">حساب المالك: مسموح بالاطلاع على جميع فروع الشركة.</span>
            ) : (
              <span className="text-amber-300">مستخدم فرعي: البيانات المكتسبة مفلترة بفرع ({user.branchNameAr}) فقط.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
