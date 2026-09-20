import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { PermissionCode, UserRoleCode } from '../../types/auth';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: PermissionCode;
  requiredRole?: UserRoleCode | UserRoleCode[];
  fallbackMessage?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  fallbackMessage = 'عفواً، لا تملك الصلاحية الكافية للوصول إلى هذه الصفحة',
}) => {
  const { user, loading, hasPermission, hasRole } = useAuthStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-500 font-sans" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium">جاري التحقق من الصلاحيات والجلوس...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-xl text-red-700 m-6" dir="rtl">
        <ShieldAlert className="w-12 h-12 mb-3 text-red-600" />
        <h3 className="text-lg font-bold">يتطلب تسجيل الدخول</h3>
        <p className="text-sm mt-1 text-red-600">يرجى تسجيل الدخول أولاً للوصول إلى هذا القسم.</p>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 m-6 text-center" dir="rtl">
        <ShieldAlert className="w-14 h-14 mb-3 text-amber-600" />
        <h3 className="text-xl font-bold">صلاحية غير كافية</h3>
        <p className="text-sm mt-2 text-amber-700 max-w-md">{fallbackMessage}</p>
        <span className="inline-block mt-4 px-3 py-1 bg-amber-200/60 text-amber-900 text-xs font-mono rounded-md">
          الصلاحية المطلوبة: {requiredPermission}
        </span>
      </div>
    );
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 m-6 text-center" dir="rtl">
        <ShieldAlert className="w-14 h-14 mb-3 text-amber-600" />
        <h3 className="text-xl font-bold">الدور الوظيفي غير مسموح</h3>
        <p className="text-sm mt-2 text-amber-700">هذا القسم مخصص لأدوار محددة فقط.</p>
      </div>
    );
  }

  return <>{children}</>;
};
