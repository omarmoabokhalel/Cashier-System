import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { LoginPage } from './pages/auth/LoginPage';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ToastProvider } from './components/ui/Toast';

// Module Shells
import { DashboardShell } from './pages/dashboard/DashboardShell';
import { POSShell } from './pages/pos/POSShell';
import { ProductsShell } from './pages/products/ProductsShell';
import { InventoryShell } from './pages/inventory/InventoryShell';
import { SalesShell } from './pages/sales/SalesShell';
import { ReturnsShell } from './pages/returns/ReturnsShell';
import { ExchangesShell } from './pages/exchanges/ExchangesShell';
import { CustomersShell } from './pages/customers/CustomersShell';
import { SuppliersShell } from './pages/suppliers/SuppliersShell';
import { PurchasesShell } from './pages/purchases/PurchasesShell';
import { RegisterShell } from './pages/register/RegisterShell';
import { ExpensesShell } from './pages/expenses/ExpensesShell';
import { ReportsShell } from './pages/reports/ReportsShell';
import { UsersShell } from './pages/users/UsersShell';
import { NotificationsShell } from './pages/notifications/NotificationsShell';
import { SettingsShell } from './pages/settings/SettingsShell';

import { checkAndAutoCloseCairoMidnightShift } from './utils/shiftAutoScheduler';

export const App: React.FC = () => {
  const { user, initialize } = useAuthStore();
  const [activeNav, setActiveNav] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (user) {
      checkAndAutoCloseCairoMidnightShift();
      const interval = setInterval(() => {
        checkAndAutoCloseCairoMidnightShift();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!user) {
    return <LoginPage />;
  }

  const navTitles: Record<string, string> = {
    dashboard: 'الرئيسية',
    pos: 'الكاشير (POS)',
    products: 'المنتجات والأصناف',
    inventory: 'المخزون والجرد',
    sales: 'الفواتير والمبيعات',
    returns: 'المرتجعات',
    exchanges: 'الاستبدال',
    customers: 'العملاء والولاء',
    suppliers: 'الموردين',
    purchases: 'المشتريات والشحنات',
    register: 'الخزنة والوردية',
    expenses: 'المصروفات',
    reports: 'التقارير والإحصائيات',
    users: 'المستخدمون والأدوار',
    notifications: 'الإشعارات والتنبيهات',
    settings: 'إعدادات النظام',
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white" dir="rtl">
        {/* Main Application Layout */}

        {/* Main Application Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Navigation */}
          <Sidebar
            activeNav={activeNav}
            onSelectNav={(id) => setActiveNav(id)}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />

          {/* Right Main Body Content */}
          <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
            {/* Navbar */}
            <Navbar
              pageTitle={navTitles[activeNav] || 'الرئيسية'}
              onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            {/* Dynamic View Render */}
            <main className="flex-1">
              {activeNav === 'dashboard' && (
                <ProtectedRoute requiredPermission="view_dashboard">
                  <DashboardShell onNavigate={(nav) => setActiveNav(nav)} />
                </ProtectedRoute>
              )}

              {activeNav === 'pos' && (
                <ProtectedRoute requiredPermission="create_sale">
                  <POSShell />
                </ProtectedRoute>
              )}

              {activeNav === 'products' && (
                <ProtectedRoute requiredPermission="view_products">
                  <ProductsShell />
                </ProtectedRoute>
              )}

              {activeNav === 'inventory' && (
                <ProtectedRoute requiredPermission="manage_inventory">
                  <InventoryShell />
                </ProtectedRoute>
              )}

              {activeNav === 'sales' && (
                <ProtectedRoute requiredPermission="create_sale">
                  <SalesShell onNavigate={(page) => setActiveNav(page)} />
                </ProtectedRoute>
              )}

              {activeNav === 'returns' && (
                <ProtectedRoute requiredPermission="create_return">
                  <ReturnsShell />
                </ProtectedRoute>
              )}

              {activeNav === 'exchanges' && (
                <ProtectedRoute requiredPermission="create_exchange">
                  <ExchangesShell />
                </ProtectedRoute>
              )}

              {activeNav === 'customers' && (
                <ProtectedRoute requiredPermission="manage_customers">
                  <CustomersShell />
                </ProtectedRoute>
              )}

              {activeNav === 'suppliers' && (
                <ProtectedRoute requiredPermission="manage_suppliers">
                  <PurchasesShell initialTab="suppliers" />
                </ProtectedRoute>
              )}

              {activeNav === 'purchases' && (
                <ProtectedRoute requiredPermission="manage_purchases">
                  <PurchasesShell initialTab="orders" />
                </ProtectedRoute>
              )}

              {activeNav === 'register' && (
                <ProtectedRoute requiredPermission="manage_cash_register">
                  <RegisterShell />
                </ProtectedRoute>
              )}

              {activeNav === 'expenses' && (
                <ProtectedRoute requiredPermission="manage_expenses">
                  <ExpensesShell />
                </ProtectedRoute>
              )}

              {activeNav === 'reports' && (
                <ProtectedRoute requiredPermission="view_reports">
                  <ReportsShell />
                </ProtectedRoute>
              )}

              {activeNav === 'users' && (
                <ProtectedRoute requiredPermission="manage_users">
                  <UsersShell />
                </ProtectedRoute>
              )}

              {activeNav === 'notifications' && (
                <NotificationsShell />
              )}

              {activeNav === 'settings' && (
                <ProtectedRoute requiredPermission="manage_settings">
                  <SettingsShell />
                </ProtectedRoute>
              )}
            </main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
};
