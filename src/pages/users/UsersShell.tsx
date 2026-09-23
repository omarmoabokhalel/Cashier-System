import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Dialog } from '../../components/ui/Dialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { PermissionGuard } from '../../components/auth/PermissionGuard';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Mail,
  Phone,
  Building,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  Lock,
} from 'lucide-react';
import { useAuthStore, getSavedCashierPermissions, DEFAULT_CASHIER_PERMISSIONS } from '../../store/useAuthStore';
import { PermissionCode, UserRoleCode } from '../../types/auth';

interface UserProfileRecord {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  pin_code: string | null;
  branch_id: string | null;
  role_id: string | null;
  is_active: boolean;
  created_at: string;
  roles?: { id: string; code: string; name_ar: string };
  branches?: { id: string; name_ar: string };
}

const ALL_SYSTEM_PERMISSIONS: { key: PermissionCode; label: string; desc: string; category: string }[] = [
  // Sales & POS
  { key: 'create_sale', label: 'إجراء فواتير مبيعات بالكاشير (POS)', desc: 'إنشاء وفلترة فواتير البيع واحتساب الخصومات', category: 'المبيعات والـ POS' },
  { key: 'create_return', label: 'إجراء مرتجعات المبيعات', desc: 'استرجاع الأصناف وإرجاع المبالغ للعميل', category: 'المبيعات والـ POS' },
  { key: 'create_exchange', label: 'إجراء استبدال المنتجات', desc: 'تبديل أصناف الفواتير واستكمال الفرق', category: 'المبيعات والـ POS' },
  { key: 'edit_sale', label: 'تعديل الفواتير المطبوعة', desc: 'القدرة على تعديل الفواتير الصادرة مسبقاً', category: 'المبيعات والـ POS' },
  { key: 'cancel_sale', label: 'إلغاء وحذف الفواتير', desc: 'إلغاء أمر شراء أو إرجاع عهدة الفاتورة بالكامل', category: 'المبيعات والـ POS' },

  // Products & Inventory
  { key: 'view_products', label: 'استعراض قائمة المنتجات والأصناف', desc: 'رؤية كتالوج الملابس والألوان والمقاسات', category: 'المنتجات والمخزون' },
  { key: 'create_product', label: 'إضافة منتجات وأصناف جديدة', desc: 'إنشاء كروت منتجات جديدة وتوليد الباركود', category: 'المنتجات والمخزون' },
  { key: 'edit_product', label: 'تعديل بيانات المنتجات والأسعار', desc: 'تعديل مسميات وأسعار وتصنيفات المنتجات', category: 'المنتجات والمخزون' },
  { key: 'delete_product', label: 'حذف المنتجات من الكتالوج', desc: 'إزالة الأصناف نهائياً من المخزون', category: 'المنتجات والمخزون' },
  { key: 'manage_inventory', label: 'إدارة المخزون والتنبيهات', desc: 'متابعة أرصدة المخازن ونواقص البضاعة', category: 'المنتجات والمخزون' },
  { key: 'adjust_stock', label: 'إجراء تسوية وتسوية الجرد (Stocktake)', desc: 'تعديل الأرصدة الحقيقية وإثبات العجز والزيادة', category: 'المنتجات والمخزون' },

  // Financials & Privacy (Crucial Cost & Profit Guards)
  { key: 'view_cost_prices', label: 'رؤية أسعار التكلفة والجملة (COGS)', desc: 'سعر تكلفة الشراء للجملة للأصناف والمنتجات', category: 'السرية والمالية' },
  { key: 'view_profit', label: 'رؤية صافي الأرباح والتقارير المالية', desc: 'استعراض صافي أرباح الفواتير والورديات', category: 'السرية والمالية' },
  { key: 'manage_purchases', label: 'إدارة المشتريات والشحنات الواردة', desc: 'إصدار أوامر الشراء واستلام بضائع الموردين', category: 'السرية والمالية' },
  { key: 'manage_expenses', label: 'إدارة المصروفات التشغيلية', desc: 'تسجيل خصم النثريات والمصروفات اليومية', category: 'السرية والمالية' },
  { key: 'manage_cash_register', label: 'إدارة الخزنة والورديات (Cash In/Out)', desc: 'السحب والإيداع النقدي وإغلاق وردية الكاشير', category: 'السرية والمالية' },

  // Customers, Reports & Management
  { key: 'view_dashboard', label: 'عرض لوحة التحكم الرئيسية', desc: 'متابعة ملخص مبيعات الوردية اليومية', category: 'الإدارة والتقارير' },
  { key: 'manage_customers', label: 'إدارة بيانات العملاء والولاء', desc: 'إضافة عملاء واحتساب نقاط المكافآت', category: 'الإدارة والتقارير' },
  { key: 'manage_suppliers', label: 'إدارة الموردين وكشوف الحساب', desc: 'إضافة الموردين ومتابعة الديون والمدفوعات', category: 'الإدارة والتقارير' },
  { key: 'view_reports', label: 'عرض التقارير والتحليلات', desc: 'استعراض تقارير المبيعات والمخزون', category: 'الإدارة والتقارير' },
  { key: 'export_reports', label: 'تصدير التقارير (Excel / PDF)', desc: 'تحميل ملفات كشوفات البيانات', category: 'الإدارة والتقارير' },
  { key: 'manage_users', label: 'إدارة حسابات الموظفين والـ PIN', desc: 'إنشاء حسابات وتعيين الرموز السرية', category: 'الإدارة والتقارير' },
  { key: 'manage_settings', label: 'إعدادات النظام وطباعة الفواتير', desc: 'تخصيص ترويسة الفاتورة ونسب الضريبة', category: 'الإدارة والتقارير' },
];

export const UsersShell: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'users' | 'cashier_permissions'>('users');
  const [cashierPermissions, setCashierPermissions] = useState<PermissionCode[]>(getSavedCashierPermissions());

  const [users, setUsers] = useState<UserProfileRecord[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Form Modal State
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfileRecord | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfileRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toggleCashierPermission = (permKey: PermissionCode) => {
    setCashierPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  const handleSaveCashierPermissions = () => {
    localStorage.setItem('custom_cashier_permissions', JSON.stringify(cashierPermissions));
    window.dispatchEvent(new Event('storage'));
    showToast('success', 'تم حفظ وتحديث صلاحيات الكاشير بنجاح!');
  };

  const fetchUsersData = async () => {
    setLoading(true);
    try {
      const [{ data: profilesData }, { data: rolesData }, { data: branchData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, roles(id, code, name_ar), branches(id, name_ar)')
          .order('created_at', { ascending: false }),
        supabase.from('roles').select('*'),
        supabase.from('branches').select('*'),
      ]);

      setUsers(profilesData || []);
      const filteredRoles = (rolesData || []).filter((r: any) => r.code === 'owner' || r.code === 'cashier');
      const finalRoles = filteredRoles.length > 0 ? filteredRoles : [
        { id: '11111111-1111-1111-1111-111111111111', code: 'owner', name_ar: 'المالك (Owner)' },
        { id: '22222222-2222-2222-2222-222222222222', code: 'cashier', name_ar: 'كاشير مبيعات' },
      ];
      setRoles(finalRoles);
      setBranches(branchData || []);
    } catch (e: any) {
      console.error('Error fetching users:', e);
      showToast('error', 'فشل تحميل كشوفات الموظفين', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setPinCode('');
    setPhone('');
    setSelectedRoleId(roles[0]?.id || '');
    setSelectedBranchId(branches[0]?.id || '00000000-0000-0000-0000-000000000001');
    setIsActive(true);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (u: UserProfileRecord) => {
    setEditingUser(u);
    setFullName(u.full_name || '');
    setEmail(u.email || '');
    setPinCode(u.pin_code || '');
    setPhone(u.phone || '');
    setSelectedRoleId(u.role_id || roles[0]?.id || '');
    setSelectedBranchId(u.branch_id || branches[0]?.id || '00000000-0000-0000-0000-000000000001');
    setIsActive(u.is_active);
    setIsFormModalOpen(true);
  };

  const generateUuid = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0').slice(-12)}`;

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('error', 'حقل اسم الموظف مطلوب');
      return;
    }
    if (!pinCode.trim() || pinCode.trim().length < 4) {
      showToast('error', 'رمز PIN يجب أن يتكون من 4 أرقام على الأقل');
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        full_name: fullName.trim(),
        pin_code: pinCode.trim(),
        phone: phone.trim() || null,
        role_id: selectedRoleId || null,
        branch_id: selectedBranchId || '00000000-0000-0000-0000-000000000001',
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (email.trim()) {
        payload.email = email.trim();
      }

      if (editingUser) {
        let { error } = await (supabase.from('profiles') as any)
          .update(payload)
          .eq('id', editingUser.id);

        if (error && error.message && error.message.toLowerCase().includes('email')) {
          delete payload.email;
          const retryRes = await (supabase.from('profiles') as any)
            .update(payload)
            .eq('id', editingUser.id);
          error = retryRes.error;
        }

        if (error) throw error;
        showToast('success', 'تم تحديث بيانات الموظف بنجاح!');
      } else {
        const newId = generateUuid();
        let { error } = await (supabase.from('profiles') as any).insert({
          id: newId,
          ...payload,
          created_at: new Date().toISOString(),
        });

        if (error && error.message && error.message.toLowerCase().includes('email')) {
          delete payload.email;
          const retryRes = await (supabase.from('profiles') as any).insert({
            id: newId,
            ...payload,
            created_at: new Date().toISOString(),
          });
          error = retryRes.error;
        }

        if (error) throw error;
        showToast('success', 'تم إضافة الموظف الجديد وحفظ رمز PIN بنجاح!');
      }

      setIsFormModalOpen(false);
      fetchUsersData();
    } catch (err: any) {
      console.error('Save user error:', err);
      showToast('error', 'تعذر حفظ بيانات الموظف', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      const { error } = await (supabase.from('profiles') as any)
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;
      showToast('success', 'تم حذف حساب الموظف بنجاح');
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      fetchUsersData();
    } catch (err: any) {
      showToast('error', 'فشل حذف الحساب', err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.pin_code?.includes(q) ||
      u.phone?.includes(q)
    );
  });

  return (
    <PermissionGuard permission="manage_users">
      <div className="p-6 space-y-6 font-sans text-slate-100" dir="rtl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-400" />
              <span>إدارة كشوفات المستخدمين وصلاحيات الكاشير</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              إنشاء حسابات الكاشيرية والمدراء، التحكم الكامل في صلاحيات الكاشير وتحديد رموز PIN للدخول
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'users' ? (
              <Button
                onClick={handleOpenAddModal}
                variant="primary"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 text-xs shadow-lg shadow-indigo-950/40"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة موظف / كاشير جديد</span>
              </Button>
            ) : (
              <Button
                onClick={handleSaveCashierPermissions}
                variant="primary"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 text-xs shadow-lg shadow-emerald-950/40"
              >
                <Shield className="w-4 h-4" />
                <span>حفظ وتطبيق صلاحيات الكاشير الحالية</span>
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 gap-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-950/30'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>كشوفات الموظفين والـ PIN ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('cashier_permissions')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'cashier_permissions'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/30'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>تحكم المالك الصارم بصلاحيات الكاشير ({cashierPermissions.length} صلاحية مفعّلة)</span>
          </button>
        </div>

        {activeTab === 'users' && (
          <>
            {/* Filter & Search Bar */}
            <Card className="p-4 bg-slate-900 border-slate-800">
              <div className="relative max-w-md">
                <Input
                  placeholder="ابحث باسم الموظف، البريد الإلكتروني، أو رمز PIN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<Search className="w-4 h-4 text-slate-400" />}
                />
              </div>
            </Card>

            {/* Users Table */}
        <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-bold">
                <tr>
                  <th className="p-3">اسم الموظف</th>
                  <th className="p-3">البريد الإلكتروني</th>
                  <th className="p-3">الدور / الصلاحية</th>
                  <th className="p-3">رمز PIN للدخول</th>
                  <th className="p-3">الفرع التابع</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      جاري تحميل كشوفات الحسابات...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">
                      لم يتم العثور على موظفين مسجلين بكشوفات النظام.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-950 border border-indigo-800 flex items-center justify-center text-indigo-300 font-mono text-xs shrink-0">
                          {u.full_name ? u.full_name.slice(0, 2) : 'US'}
                        </div>
                        <span>{u.full_name}</span>
                      </td>

                      <td className="p-3 font-mono text-slate-300">
                        {u.email || <span className="text-slate-500">غير محدد</span>}
                      </td>

                      <td className="p-3">
                        <Badge
                          variant={
                            u.roles?.code === 'owner' || u.roles?.code === 'admin'
                              ? 'primary'
                              : u.roles?.code === 'cashier'
                              ? 'warning'
                              : 'secondary'
                          }
                          size="sm"
                        >
                          {u.roles?.name_ar || 'كاشير مبيعات'}
                        </Badge>
                      </td>

                      <td className="p-3 font-mono text-emerald-400 font-bold tracking-widest">
                        {u.pin_code ? (
                          <span className="bg-slate-950 px-2 py-1 rounded-md border border-slate-800">
                            {u.pin_code}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal font-sans">بدون PIN</span>
                        )}
                      </td>

                      <td className="p-3 text-slate-300">
                        {u.branches?.name_ar || 'الفرع الرئيسي'}
                      </td>

                      <td className="p-3 text-center">
                        {u.is_active ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-bold">
                            <XCircle className="w-3.5 h-3.5" /> موقف
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg transition-colors"
                            title="تعديل الحساب"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setUserToDelete(u);
                              setIsDeleteDialogOpen(true);
                            }}
                            className="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-400 rounded-lg transition-colors"
                            title="حذف الحساب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </>
    )}

    {activeTab === 'cashier_permissions' && (
      <div className="space-y-6">
        <div className="p-4 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-400" />
              <span>مصفوفة التحكم الصارم بصلاحيات الكاشير (Owner Permissions Control)</span>
            </h3>
            <p className="text-xs text-slate-300">
              يمكنك كمالك للمتجر تمكين أو إلغاء أي صلاحية للكاشير. يتم تطبيق هذه الصلاحيات فوراً عند دخول أي كاشير للنظام.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setCashierPermissions(DEFAULT_CASHIER_PERMISSIONS)}
              variant="secondary"
              size="sm"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            >
              استعادة الصلاحيات الافتراضية
            </Button>
            <Button
              onClick={handleSaveCashierPermissions}
              variant="primary"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs"
            >
              حفظ التعديلات
            </Button>
          </div>
        </div>

        {/* Group Permissions by Category */}
        {Array.from(new Set(ALL_SYSTEM_PERMISSIONS.map((p) => p.category))).map((catName) => {
          const categoryPerms = ALL_SYSTEM_PERMISSIONS.filter((p) => p.category === catName);

          return (
            <Card key={catName} className="p-5 bg-slate-900 border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2.5">
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>صلاحيات: {catName}</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categoryPerms.map((perm) => {
                  const isChecked = cashierPermissions.includes(perm.key);
                  const isSensitive = perm.key === 'view_cost_prices' || perm.key === 'view_profit';

                  return (
                    <div
                      key={perm.key}
                      onClick={() => toggleCashierPermission(perm.key)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isChecked
                          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-md shadow-emerald-950/20'
                          : 'bg-slate-950 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold text-xs ${isChecked ? 'text-emerald-300' : 'text-slate-300'}`}>
                            {perm.label}
                          </span>
                          {isSensitive && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800/60">
                              سرية تامة
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">{perm.desc}</p>
                      </div>

                      <div className="pt-0.5 shrink-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by div click
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    )}

        {/* CREATE / EDIT STAFF USER MODAL */}
        <Dialog
          isOpen={isFormModalOpen}
          onClose={() => setIsFormModalOpen(false)}
          title={editingUser ? 'تعديل بيانات الموظف والـ PIN' : 'إضافة موظف / كاشير جديد'}
          maxWidth="md"
        >
          <form onSubmit={handleSubmitUser} className="space-y-4 font-sans text-xs" dir="rtl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">اسم الموظف الثلاثي *</label>
                <Input
                  placeholder="مثال: أحمد محمد الكاشير"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">رمز PIN السريع للدخول (4 أرقام) *</label>
                <Input
                  type="text"
                  maxLength={6}
                  placeholder="مثال: 1234"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  className="font-mono text-center tracking-widest text-emerald-400 font-bold text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">البريد الإلكتروني (اختياري للدخول)</label>
                <Input
                  type="email"
                  placeholder="cashier@pos.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">رقم الهاتف / الجوال</label>
                <Input
                  placeholder="01000000000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">الدور والصلاحية *</label>
                <Select
                  options={roles.map((r) => ({ value: r.id, label: `${r.name_ar} (${r.code})` }))}
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">الفرع التابع له الموظف *</label>
                <Select
                  options={branches.map((b) => ({ value: b.id, label: b.name_ar }))}
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="activeState"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800 cursor-pointer"
              />
              <label htmlFor="activeState" className="text-slate-300 font-semibold cursor-pointer">
                الحساب نشط ومسموح له بدخول النظام والورديات
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button type="button" variant="secondary" onClick={() => setIsFormModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" isLoading={saving} variant="primary">
                حفظ بيانات الموظف
              </Button>
            </div>
          </form>
        </Dialog>

        {/* DELETE CONFIRM DIALOG */}
        <ConfirmDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          onConfirm={handleDeleteUser}
          title="تأكيد حذف حساب الموظف"
          message={`هل أنت متأكد من حذف الموظف "${userToDelete?.full_name}"؟ لن يتمكن من تسجيل الدخول بعد الآن.`}
          confirmText="حذف الحساب"
          isLoading={deleting}
        />
      </div>
    </PermissionGuard>
  );
};
