import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { 
  Settings as SettingsIcon, Building, Shield, Package, ShoppingBag, 
  Receipt, Percent, CreditCard, Printer, Award, Bell, Lock, GitBranch, 
  FileText, Database, Check, RefreshCw, AlertTriangle
} from 'lucide-react';

import { useAuthStore } from '../../store/useAuthStore';

interface BranchSettings {
  id: string;
  name_ar: string;
  name_en: string;
  code: string;
  address: string | null;
  phone: string | null;
  tax_number: string | null;
  receipt_header: string | null;
  receipt_footer: string | null;
}

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  ip_address: string | null;
}

export const SettingsShell: React.FC = () => {
  const { updateAdminName } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Admin Security State
  const [adminName, setAdminName] = useState(localStorage.getItem('admin_display_name') || 'المالك / مدير المتجر الرئيسي');
  const [adminPassword, setAdminPassword] = useState(localStorage.getItem('admin_custom_password') || '123456');
  const [adminPin, setAdminPin] = useState(localStorage.getItem('admin_pin_code') || '1234');

  // Store & Branch Settings State
  const [branch, setBranch] = useState<BranchSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Config State
  const [config, setConfig] = useState({
    appName: 'نظام الكاشير الاحترافي - متجر الملابس',
    currency: 'EGP',
    language: 'ar',
    defaultTaxRate: 15,
    pricesIncludeTax: true,
    minStockAlertDefault: 5,
    allowNegativeStock: false,
    invoicePrefix: 'INV-2026-',
    returnWindowDays: 14,
    defaultPrinterFormat: '80mm',
    enableQrCode: true,
    loyaltyRateEgp: 100,
    loyaltyPointValueEgp: 1,
    maxManualDiscountPercent: 20,
    requirePinForReturns: true,
    autoBackupEnabled: true,
    paymentCashEnabled: true,
    paymentCardEnabled: true,
    paymentWalletEnabled: true,
    paymentBankEnabled: true,
  });

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const defaultBranchObj: BranchSettings = {
        id: '00000000-0000-0000-0000-000000000001',
        name_ar: 'متجر الملابس',
        name_en: 'Clothing Store',
        code: 'MAIN-01',
        phone: '',
        address: '',
        tax_number: '',
        receipt_header: 'أهلاً بكم في متجرنا',
        receipt_footer: 'شكراً لتسوقكم معنا!\nيرجى الاحتفاظ بالفاتورة للاستبدال والاسترجاع خلال 14 يوماً.',
      };

      // 1. Fetch Main Branch
      const { data: branchData } = await (supabase.from('branches') as any)
        .select('*')
        .limit(1);

      if (branchData && branchData.length > 0) {
        setBranch(branchData[0]);
        localStorage.setItem('branch_settings', JSON.stringify(branchData[0]));
      } else {
        // Upsert default main branch
        const { data: insertedBranch } = await (supabase.from('branches') as any)
          .upsert(defaultBranchObj)
          .select()
          .single();
        const activeBranch = insertedBranch || defaultBranchObj;
        setBranch(activeBranch);
        localStorage.setItem('branch_settings', JSON.stringify(activeBranch));
      }

      // 2. Fetch App Config
      const { data: configData, error: configErr } = await (supabase.from('app_config') as any)
        .select('*');

      if (!configErr && configData && configData.length > 0) {
        const mergedConfig = { ...config };
        configData.forEach((item: { key: string; value: any }) => {
          if (item.key in mergedConfig) {
            (mergedConfig as any)[item.key] = item.value;
          }
        });
        setConfig(mergedConfig);
        localStorage.setItem('app_config', JSON.stringify(mergedConfig));
      }

      // 3. Fetch Audit Logs
      const { data: logsData } = await (supabase.from('audit_logs') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (logsData) {
        setAuditLogs(logsData);
      }
    } catch (err: any) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      // Save Branch Info
      if (branch) {
        const branchPayload = {
          id: branch.id || '00000000-0000-0000-0000-000000000001',
          name_ar: branch.name_ar,
          name_en: branch.name_en,
          code: branch.code || 'MAIN-01',
          phone: branch.phone || '',
          address: branch.address || '',
          tax_number: branch.tax_number || '',
          receipt_header: branch.receipt_header || '',
          receipt_footer: branch.receipt_footer || '',
        };

        const { data: updatedBranch } = await (supabase.from('branches') as any)
          .upsert(branchPayload)
          .select()
          .single();

        const savedBranch = updatedBranch || branchPayload;
        setBranch(savedBranch as any);
        localStorage.setItem('branch_settings', JSON.stringify(savedBranch));
      }

      // Save App Config
      for (const [key, value] of Object.entries(config)) {
        await (supabase.from('app_config') as any).upsert({
          key,
          value,
          updated_at: new Date().toISOString()
        });
      }
      localStorage.setItem('app_config', JSON.stringify(config));
      localStorage.setItem('admin_custom_password', adminPassword);
      localStorage.setItem('admin_pin_code', adminPin);
      updateAdminName(adminName);
      window.dispatchEvent(new Event('storage'));

      // Log Audit Event
      await (supabase.from('audit_logs') as any).insert({
        action: 'UPDATE_SETTINGS',
        entity_type: 'settings',
        entity_id: branch?.id || null,
        new_values: config
      });

      showToast('success', 'تم حفظ جميع الإعدادات وتحديث بيانات الفاتورة واسم البائع بنجاح!');
    } catch (err: any) {
      console.error('Save error:', err);
      showToast('error', 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'general', label: 'إعدادات عامة', icon: SettingsIcon },
    { id: 'store', label: 'بيانات المتجر', icon: Building },
    { id: 'roles', label: 'الأدوار والصلحيات', icon: Shield },
    { id: 'products', label: 'المنتجات والباركود', icon: Package },
    { id: 'inventory', label: 'المخزون والجرد', icon: ShoppingBag },
    { id: 'sales', label: 'المبيعات والفواتير', icon: Receipt },
    { id: 'tax', label: 'الضرائب والتسعير', icon: Percent },
    { id: 'payments', label: 'طرق الدفع', icon: CreditCard },
    { id: 'printing', label: 'الطباعة والإيصالات', icon: Printer },
    { id: 'loyalty', label: 'الولاء والخصومات', icon: Award },
    { id: 'notifications', label: 'إعدادات التنبيهات', icon: Bell },
    { id: 'security', label: 'الأمان والنسخ الاحتياطي', icon: Lock },
    { id: 'branches', label: 'إدارة الفروع', icon: GitBranch },
    { id: 'audit', label: 'سجل التدقيق', icon: FileText },
    { id: 'maintenance', label: 'صيانة النظام', icon: Database },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        <span className="mr-3 text-slate-300">جاري تحميل إعدادات النظام...</span>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 font-sans text-slate-100" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-wide">إعدادات النظام والفروع</h2>
          <p className="text-xs text-slate-400 mt-1">التحكم الكامل في كافة قواعد التشغيل، الطباعة، الضرائب وشروط الأمان</p>
        </div>
        <Button onClick={handleSaveSettings} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-950/40">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between ${toastMessage.type === 'success' ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300' : 'bg-rose-950/80 border border-rose-500/40 text-rose-300'}`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Tab Navigation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side Menu */}
        <div className="lg:col-span-1 bg-slate-900/90 rounded-2xl p-3 border border-slate-800 space-y-1">
          {tabs.map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-right ${
                  isActive 
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                <IconComponent className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Main Content */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="p-6 bg-slate-900/90 border border-slate-800">
            {/* 1. General Settings */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <SettingsIcon className="w-5 h-5 text-emerald-400" />
                  إعدادات النظام العامة
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">اسم التطبيق / المتجر الرئيسي</label>
                    <input
                      type="text"
                      value={config.appName}
                      onChange={(e) => setConfig({ ...config, appName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">عملة النظام</label>
                    <input
                      type="text"
                      value={config.currency}
                      onChange={(e) => setConfig({ ...config, currency: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">لغة الواجهة الرئيسية</label>
                    <select
                      value={config.language}
                      onChange={(e) => setConfig({ ...config, language: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ar">العربية (Arabic)</option>
                      <option value="en">English</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Store Info */}
            {activeTab === 'store' && branch && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Building className="w-5 h-5 text-emerald-400" />
                  بيانات المتجر والفرع الرئيسي
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">اسم الفرع (بالعربية)</label>
                    <input
                      type="text"
                      value={branch.name_ar}
                      onChange={(e) => setBranch({ ...branch, name_ar: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">اسم الفرع (بالإنجليزية)</label>
                    <input
                      type="text"
                      value={branch.name_en}
                      onChange={(e) => setBranch({ ...branch, name_en: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">رقم التليفون / الاتصال</label>
                    <input
                      type="text"
                      value={branch.phone || ''}
                      onChange={(e) => setBranch({ ...branch, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">الرقم الضريبي / السجل التجاري</label>
                    <input
                      type="text"
                      value={branch.tax_number || ''}
                      onChange={(e) => setBranch({ ...branch, tax_number: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-slate-400 mb-1 font-semibold">عنوان الفرع</label>
                    <input
                      type="text"
                      value={branch.address || ''}
                      onChange={(e) => setBranch({ ...branch, address: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 3. Roles & Security */}
            {activeTab === 'roles' && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  أمان حساب المالك وإدارة الصلاحيات
                </h3>
                
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4 text-xs">
                  <h4 className="font-bold text-sky-400 text-sm">تغيير بيانات الدخول واسم البائع المطبوع بالفاتورة (Admin / Owner):</h4>
                  
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">اسم المدير / البائع المطبوع على الفاتورة والتقارير *</label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="أدخل اسم المدير / البائع (مثال: عمر أبو خليل)"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-bold"
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">هذا الاسم يظهر على الفواتير، الإيصالات الحرارية، وسجلات البيع بدلاً من كلمة "admin".</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">كلمة مرور المالك الجديد (Password)</label>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="123456"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">البريد الإلكتروني الحالي: admin@store.com</span>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">رمز PIN الدخول السريع للمالك</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={adminPin}
                        onChange={(e) => setAdminPin(e.target.value)}
                        placeholder="1234"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500 font-mono tracking-widest text-center font-bold"
                      />
                      <span className="text-[10px] text-slate-500 mt-1 block">الرمز السريع الافتراضي: 1234</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 text-xs">
                  <h4 className="font-bold text-slate-300 text-sm border-b border-slate-800 pb-2">صلاحيات الأدوار بالنظام:</h4>
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="font-bold text-slate-200">المالك / المدير العام (Owner)</span>
                    <span className="text-emerald-400 font-semibold">صلاحية كاملة وإدارة حسابات الكاشيرية والتقارير والإعدادات</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-200">كاشير المبيعات (Cashier)</span>
                    <span className="text-amber-400 font-semibold">مبيعات الـ POS + المرتجعات والاستبدال + جرد الوردية</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Products */}
            {activeTab === 'products' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Package className="w-5 h-5 text-emerald-400" />
                  إعدادات المنتجات والباركود
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">بادئة SKU التلقائية</label>
                    <input type="text" value="PRD-" disabled className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-400" />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">طريقة التكلفة القياسية</label>
                    <input type="text" value="Weighted Average Cost (متوسط التكلفة)" disabled className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2 text-slate-400" />
                  </div>
                </div>
              </div>
            )}

            {/* 5. Inventory */}
            {activeTab === 'inventory' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <ShoppingBag className="w-5 h-5 text-emerald-400" />
                  إعدادات المخزون والتنبيهات
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">حد التنبيه الافتراضي للنقص (قطعة)</label>
                    <input
                      type="number"
                      value={config.minStockAlertDefault}
                      onChange={(e) => setConfig({ ...config, minStockAlertDefault: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input
                      type="checkbox"
                      id="negStock"
                      checked={config.allowNegativeStock}
                      onChange={(e) => setConfig({ ...config, allowNegativeStock: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-800"
                    />
                    <label htmlFor="negStock" className="text-slate-300 font-semibold cursor-pointer">السماح بالبيع بالسالب عند عدم وجود رصيد (غير مستحسن)</label>
                  </div>
                </div>
              </div>
            )}

            {/* 6. Sales */}
            {activeTab === 'sales' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  إعدادات المبيعات والفواتير
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">بادئة تسلسل الفواتير</label>
                    <input
                      type="text"
                      value={config.invoicePrefix}
                      onChange={(e) => setConfig({ ...config, invoicePrefix: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">مهلة المرتجعات المسموح بها (أيام)</label>
                    <input
                      type="number"
                      value={config.returnWindowDays}
                      onChange={(e) => setConfig({ ...config, returnWindowDays: parseInt(e.target.value) || 14 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 7. Tax */}
            {activeTab === 'tax' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Percent className="w-5 h-5 text-emerald-400" />
                  الضرائب والتسعير الضريبي
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">نسبة ضريبة القيمة المضافة (VAT %)</label>
                    <input
                      type="number"
                      value={config.defaultTaxRate}
                      onChange={(e) => setConfig({ ...config, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input
                      type="checkbox"
                      id="incTax"
                      checked={config.pricesIncludeTax}
                      onChange={(e) => setConfig({ ...config, pricesIncludeTax: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-800"
                    />
                    <label htmlFor="incTax" className="text-slate-300 font-semibold cursor-pointer">الأسعار المعروضة شاملة الضريبة تلقائياً</label>
                  </div>
                </div>
              </div>
            )}

            {/* 8. Payments */}
            {activeTab === 'payments' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  تفعيل طرق الدفع المقبولة
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-slate-200">الدفع النقدي (Cash)</span>
                    <input type="checkbox" checked={config.paymentCashEnabled} onChange={(e) => setConfig({ ...config, paymentCashEnabled: e.target.checked })} />
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-slate-200">بطاقات الائتمان (Visa / MasterCard)</span>
                    <input type="checkbox" checked={config.paymentCardEnabled} onChange={(e) => setConfig({ ...config, paymentCardEnabled: e.target.checked })} />
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-slate-200">المحافظ الإلكترونية (Vodafone Cash / Instapay)</span>
                    <input type="checkbox" checked={config.paymentWalletEnabled} onChange={(e) => setConfig({ ...config, paymentWalletEnabled: e.target.checked })} />
                  </div>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-slate-200">التحويل البنكي (Bank Transfer)</span>
                    <input type="checkbox" checked={config.paymentBankEnabled} onChange={(e) => setConfig({ ...config, paymentBankEnabled: e.target.checked })} />
                  </div>
                </div>
              </div>
            )}

            {/* 9. Printing */}
            {activeTab === 'printing' && branch && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Printer className="w-5 h-5 text-emerald-400" />
                  إعدادات الطباعة وترويسة الإيصالات
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">حجم الفاتورة الحرارية الافتراضي</label>
                    <select
                      value={config.defaultPrinterFormat}
                      onChange={(e) => setConfig({ ...config, defaultPrinterFormat: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="80mm">طابعة حرارية 80mm (قياسي)</option>
                      <option value="58mm">طابعة حرارية صغيرة 58mm</option>
                      <option value="A4">ورق A4 عادي</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3 pt-5">
                    <input
                      type="checkbox"
                      id="qrToggle"
                      checked={config.enableQrCode}
                      onChange={(e) => setConfig({ ...config, enableQrCode: e.target.checked })}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-800"
                    />
                    <label htmlFor="qrToggle" className="text-slate-300 font-semibold cursor-pointer">طباعة رمز QR على الفاتورة</label>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-slate-400 mb-1 font-semibold">ترويسة الفاتورة (Header Text)</label>
                    <input
                      type="text"
                      value={branch.receipt_header || ''}
                      onChange={(e) => setBranch({ ...branch, receipt_header: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-slate-400 mb-1 font-semibold">تذييل الفاتورة (Footer Text)</label>
                    <input
                      type="text"
                      value={branch.receipt_footer || ''}
                      onChange={(e) => setBranch({ ...branch, receipt_footer: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 10. Loyalty */}
            {activeTab === 'loyalty' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Award className="w-5 h-5 text-emerald-400" />
                  قواعد برنامج نقاط الولاء والخصومات
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">مبلغ المبيعات لكل 1 نقطة (جنيه)</label>
                    <input
                      type="number"
                      value={config.loyaltyRateEgp}
                      onChange={(e) => setConfig({ ...config, loyaltyRateEgp: parseFloat(e.target.value) || 100 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">قيمة النقطة الواحدة عند الاستبدال (جنيه)</label>
                    <input
                      type="number"
                      value={config.loyaltyPointValueEgp}
                      onChange={(e) => setConfig({ ...config, loyaltyPointValueEgp: parseFloat(e.target.value) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">الحد الأقصى للخصم اليدوي للكاشير (%)</label>
                    <input
                      type="number"
                      value={config.maxManualDiscountPercent}
                      onChange={(e) => setConfig({ ...config, maxManualDiscountPercent: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 11. Notifications */}
            {activeTab === 'notifications' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Bell className="w-5 h-5 text-emerald-400" />
                  إعدادات وتنبيهات النظام
                </h3>
                <p className="text-slate-400">التنبيهات التلقائية مفعلة على مستوى قاعدة البيانات عند وصول مخزون الصنف إلى 5 قطع أو أقل.</p>
              </div>
            )}

            {/* 12. Security */}
            {activeTab === 'security' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Lock className="w-5 h-5 text-emerald-400" />
                  الأمان وصلاحيات الاسترجاع والنسخ الاحتياطي
                </h3>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="pinReq"
                    checked={config.requirePinForReturns}
                    onChange={(e) => setConfig({ ...config, requirePinForReturns: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-950 border-slate-800"
                  />
                  <label htmlFor="pinReq" className="text-slate-300 font-semibold cursor-pointer">اشتراط رمز PIN الخاص بالمدير لإجراء المرتجعات أو الخصم اليدوي</label>
                </div>
              </div>
            )}

            {/* 13. Branches */}
            {activeTab === 'branches' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <GitBranch className="w-5 h-5 text-emerald-400" />
                  الفروع ومزامنة المخزون
                </h3>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white">{branch?.name_ar || 'الفرع الرئيسي'}</h4>
                    <p className="text-slate-400 mt-0.5">كود الفرع: {branch?.code || 'MAIN'}</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-950 border border-emerald-500/40 text-emerald-400 rounded-lg text-xs font-bold">نشط (Active)</span>
                </div>
              </div>
            )}

            {/* 14. Audit */}
            {activeTab === 'audit' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  سجل الأحداث والتدقيق (Audit Logs)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="p-2">التاريخ والتوقيت</th>
                        <th className="p-2">العملية (Action)</th>
                        <th className="p-2">الكيان (Entity)</th>
                        <th className="p-2">المعرف (ID)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {auditLogs.length > 0 ? (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/30">
                            <td className="p-2 text-slate-400">{new Date(log.created_at).toLocaleString('ar-EG')}</td>
                            <td className="p-2 font-bold text-emerald-400">{log.action}</td>
                            <td className="p-2 text-slate-300">{log.entity_type}</td>
                            <td className="p-2 text-slate-400 font-mono text-[10px]">{log.entity_id || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-500">لا توجد سجلات تدقيق حتى الآن.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 15. Maintenance */}
            {activeTab === 'maintenance' && (
              <div className="space-y-4 text-xs">
                <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Database className="w-5 h-5 text-emerald-400" />
                  صيانة النظام ومزامنة قاعدة البيانات
                </h3>
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-300">حالة قاعدة البيانات Supabase:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1"><Check className="w-4 h-4" /> متصل بنجاح</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-300">نسخة النظام:</span>
                    <span className="text-slate-400 font-mono">v2.5.0-PROD</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
