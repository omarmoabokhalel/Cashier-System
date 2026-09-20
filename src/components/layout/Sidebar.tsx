import React from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { PermissionCode } from '../../types/auth';
import {
  Home,
  ShoppingCart,
  Package,
  BarChart3,
  Receipt,
  RotateCcw,
  RefreshCw,
  Users,
  Truck,
  ShoppingBag,
  Landmark,
  CircleDollarSign,
  TrendingUp,
  UserCheck,
  Bell,
  Settings,
  X
} from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  permission?: PermissionCode;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: <Home className="w-4 h-4" />, permission: 'view_dashboard' },
  { id: 'pos', label: 'الكاشير', icon: <ShoppingCart className="w-4 h-4" />, permission: 'create_sale' },
  { id: 'products', label: 'المنتجات', icon: <Package className="w-4 h-4" />, permission: 'view_products' },
  { id: 'inventory', label: 'المخزون', icon: <BarChart3 className="w-4 h-4" />, permission: 'manage_inventory' },
  { id: 'sales', label: 'الفواتير', icon: <Receipt className="w-4 h-4" />, permission: 'create_sale' },
  { id: 'returns', label: 'المرتجعات', icon: <RotateCcw className="w-4 h-4" />, permission: 'create_return' },
  { id: 'exchanges', label: 'الاستبدال', icon: <RefreshCw className="w-4 h-4" />, permission: 'create_exchange' },
  { id: 'customers', label: 'العملاء', icon: <Users className="w-4 h-4" />, permission: 'manage_customers' },
  { id: 'suppliers', label: 'الموردين', icon: <Truck className="w-4 h-4" />, permission: 'manage_suppliers' },
  { id: 'purchases', label: 'المشتريات', icon: <ShoppingBag className="w-4 h-4" />, permission: 'manage_purchases' },
  { id: 'register', label: 'الخزنة', icon: <Landmark className="w-4 h-4" />, permission: 'manage_cash_register' },
  { id: 'expenses', label: 'المصروفات', icon: <CircleDollarSign className="w-4 h-4" />, permission: 'manage_expenses' },
  { id: 'reports', label: 'التقارير', icon: <TrendingUp className="w-4 h-4" />, permission: 'view_reports' },
  { id: 'users', label: 'المستخدمون', icon: <UserCheck className="w-4 h-4" />, permission: 'manage_users' },
  { id: 'notifications', label: 'الإشعارات', icon: <Bell className="w-4 h-4" /> },
  { id: 'settings', label: 'الإعدادات', icon: <Settings className="w-4 h-4" />, permission: 'manage_settings' },
];

export interface SidebarProps {
  activeNav: string;
  onSelectNav: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeNav,
  onSelectNav,
  isOpen,
  onClose,
}) => {
  const { user, hasPermission } = useAuthStore();

  if (!user) return null;

  // Filter items based on active permissions
  const filteredNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={twMerge(
          "fixed lg:static inset-y-0 right-0 z-40 w-64 bg-slate-900 border-l border-slate-800 flex flex-col transition-all duration-300 select-none shadow-2xl font-sans",
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
        dir="rtl"
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">متجر الملابس POS</h2>
              <span className="text-[10px] text-indigo-400 font-medium">نقطة بيع متكاملة</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {filteredNavItems.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectNav(item.id);
                  onClose();
                }}
                className={twMerge(
                  "w-full px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-3 group text-right",
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                    : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                )}
              >
                <span className={twMerge(
                  "transition-colors",
                  isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-400"
                )}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Branch Footer Badge */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>الفرع النشط:</span>
            <span className="font-bold text-indigo-400">{user.branchNameAr || 'الفرع الرئيسي'}</span>
          </div>
        </div>
      </aside>
    </>
  );
};
