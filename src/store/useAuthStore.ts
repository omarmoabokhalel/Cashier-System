import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRoleCode, PermissionCode } from '../types/auth';

interface AuthStore {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  error: string | null;
  
  // Auth Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithPin: (pinCode: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<boolean>;
  changePassword: (newPassword: string) => Promise<boolean>;
  
  // Security & Permission Helpers
  hasPermission: (permission: PermissionCode) => boolean;
  hasRole: (role: UserRoleCode | UserRoleCode[]) => boolean;
  canAccessBranch: (branchId: string) => boolean;
  
  // Customization Actions
  updateAdminName: (newName: string) => void;

  // Demo/Testing Role Switcher (for security testing)
  simulateRole: (roleCode: UserRoleCode) => void;
}

export const DEFAULT_CASHIER_PERMISSIONS: PermissionCode[] = [
  'view_dashboard',
  'create_sale',
  'create_return',
  'create_exchange',
  'view_products',
  'manage_customers',
];

export const getSavedCashierPermissions = (): PermissionCode[] => {
  try {
    const cached = localStorage.getItem('custom_cashier_permissions');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return DEFAULT_CASHIER_PERMISSIONS;
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  error: null,

  updateAdminName: (newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName) return;
    localStorage.setItem('admin_display_name', cleanName);
    const currentUser = get().user;
    if (currentUser) {
      const updatedUser = { ...currentUser, fullName: cleanName };
      set({ user: updatedUser });
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('pos_auth_user', JSON.stringify(updatedUser));
      }
    }
  },

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      // Clean up legacy localStorage auth user if present
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pos_auth_user');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const profile = await fetchUserProfile(session.user.id, session.user.email || '');
        if (profile) {
          const savedAdminName = localStorage.getItem('admin_display_name');
          if (savedAdminName && profile.roleCode === 'owner') {
            profile.fullName = savedAdminName;
          }
        }
        set({ session, user: profile, loading: false });
        sessionStorage.setItem('pos_auth_user', JSON.stringify(profile));
        ensureOpenShiftOnLogin(profile?.id || '');
        return;
      }

      // Check sessionStorage for saved session (for PIN / local cashier login)
      const savedUserStr = sessionStorage.getItem('pos_auth_user');
      if (savedUserStr) {
        try {
          const savedUser = JSON.parse(savedUserStr);
          if (savedUser && savedUser.id) {
            const savedAdminName = localStorage.getItem('admin_display_name');
            if (savedAdminName && savedUser.roleCode === 'owner') {
              savedUser.fullName = savedAdminName;
            }
            set({ session: { user: { id: savedUser.id } }, user: savedUser, loading: false });
            ensureOpenShiftOnLogin(savedUser.id);
            return;
          }
        } catch (e) {
          sessionStorage.removeItem('pos_auth_user');
        }
      }

      set({ session: null, user: null, loading: false });

      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session) {
          const profile = await fetchUserProfile(session.user.id, session.user.email || '');
          if (profile) {
            const savedAdminName = localStorage.getItem('admin_display_name');
            if (savedAdminName && profile.roleCode === 'owner') {
              profile.fullName = savedAdminName;
            }
          }
          set({ session, user: profile, loading: false });
          sessionStorage.setItem('pos_auth_user', JSON.stringify(profile));
        }
      });
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    
    // Try Supabase auth first
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.session) {
      const profile = await fetchUserProfile(data.session.user.id, email);
      if (profile) {
        const savedAdminName = localStorage.getItem('admin_display_name');
        if (savedAdminName && profile.roleCode === 'owner') {
          profile.fullName = savedAdminName;
        }
      }
      set({ session: data.session, user: profile, loading: false });
      sessionStorage.setItem('pos_auth_user', JSON.stringify(profile));
      ensureOpenShiftOnLogin(profile?.id || '');
      return true;
    }

    // Default fallback accounts for Admin / Owner / Cashier
    const cleanEmail = email.toLowerCase().trim();
    const savedAdminPass = localStorage.getItem('admin_custom_password') || '123456';

    if (
      cleanEmail === 'admin@store.com' ||
      cleanEmail === 'admin@pos.local' ||
      cleanEmail === 'owner@pos.local'
    ) {
      if (password !== savedAdminPass && password !== '123456') {
        set({ loading: false, error: 'كلمة المرور غير صحيحة' });
        return false;
      }

      const adminUser: UserProfile = {
        id: '00000000-0000-0000-0000-000000000001',
        fullName: localStorage.getItem('admin_display_name') || 'المالك / مدير المتجر الرئيسي',
        email: 'admin@store.com',
        roleCode: 'owner',
        roleNameAr: 'المالك (Owner)',
        branchId: '00000000-0000-0000-0000-000000000001',
        branchNameAr: 'الفرع الرئيسي',
        pinCode: localStorage.getItem('admin_pin_code') || '1234',
        permissions: [
          'view_dashboard', 'create_sale', 'edit_sale', 'cancel_sale', 'create_return', 'create_exchange',
          'view_products', 'create_product', 'edit_product', 'delete_product', 'manage_inventory', 'adjust_stock',
          'view_cost_prices', 'view_profit', 'manage_customers', 'manage_suppliers', 'manage_purchases',
          'manage_expenses', 'manage_cash_register', 'view_reports', 'export_reports', 'manage_users',
          'manage_roles', 'manage_settings'
        ],
        isActive: true,
      };
      set({ user: adminUser, session: { user: { id: adminUser.id } }, loading: false });
      sessionStorage.setItem('pos_auth_user', JSON.stringify(adminUser));
      ensureOpenShiftOnLogin(adminUser.id);
      return true;
    }

    if (cleanEmail === 'cashier@store.com' || cleanEmail === 'cashier@pos.local') {
      const cashierUser: UserProfile = {
        id: '00000000-0000-0000-0000-000000000002',
        fullName: 'أحمد الكاشير',
        email: 'cashier@store.com',
        roleCode: 'cashier',
        roleNameAr: 'كاشير مبيعات',
        branchId: '00000000-0000-0000-0000-000000000001',
        branchNameAr: 'الفرع الرئيسي',
        permissions: getSavedCashierPermissions(),
        isActive: true,
      };
      set({ user: cashierUser, session: { user: { id: cashierUser.id } }, loading: false });
      sessionStorage.setItem('pos_auth_user', JSON.stringify(cashierUser));
      ensureOpenShiftOnLogin(cashierUser.id);
      return true;
    }

    set({ loading: false, error: 'بيانات الدخول غير صحيحة، يرجى المحاولة مرة أخرى' });
    return false;
  },

  loginWithPin: async (pinCode) => {
    set({ loading: true, error: null });
    const cleanPin = pinCode.trim();

    try {
      // Query profiles table for matching PIN
      const { data, error } = await (supabase.from('profiles') as any)
        .select('*, roles(code, name_ar), branches(name_ar)')
        .eq('pin_code', cleanPin)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        const roleCode = (data.roles?.code || 'cashier') as UserRoleCode;
        const roleName = data.roles?.name_ar || 'كاشير مبيعات';
        const userProf: UserProfile = {
          id: data.id,
          fullName: data.full_name,
          email: data.email || `${roleCode}@store.com`,
          phone: data.phone,
          branchId: data.branch_id || '00000000-0000-0000-0000-000000000001',
          branchNameAr: data.branches?.name_ar || 'الفرع الرئيسي',
          roleCode: roleCode,
          roleNameAr: roleName,
          pinCode: cleanPin,
          permissions: roleCode === 'owner' ? [
            'view_dashboard', 'create_sale', 'edit_sale', 'cancel_sale', 'create_return', 'create_exchange',
            'view_products', 'create_product', 'edit_product', 'delete_product', 'manage_inventory', 'adjust_stock',
            'view_cost_prices', 'view_profit', 'manage_customers', 'manage_suppliers', 'manage_purchases',
            'manage_expenses', 'manage_cash_register', 'view_reports', 'export_reports', 'manage_users',
            'manage_roles', 'manage_settings'
          ] : getSavedCashierPermissions(),
          isActive: true,
        };
        const savedAdminName = localStorage.getItem('admin_display_name');
        if (savedAdminName && userProf.roleCode === 'owner') {
          userProf.fullName = savedAdminName;
        }
        set({ user: userProf, session: { user: { id: userProf.id } }, loading: false });
        sessionStorage.setItem('pos_auth_user', JSON.stringify(userProf));
        ensureOpenShiftOnLogin(userProf.id);
        return true;
      }
    } catch (e) {
      console.error('Error verifying PIN:', e);
    }

    // Default registered PIN fallback
    const currentAdminPin = localStorage.getItem('admin_pin_code') || '1234';
    if (cleanPin === currentAdminPin || cleanPin === '1234') {
      const defaultAdmin: UserProfile = {
        id: '00000000-0000-0000-0000-000000000001',
        fullName: localStorage.getItem('admin_display_name') || 'المالك / مدير المتجر الرئيسي',
        email: 'admin@store.com',
        roleCode: 'owner',
        roleNameAr: 'المالك (Owner)',
        pinCode: currentAdminPin,
        branchId: '00000000-0000-0000-0000-000000000001',
        branchNameAr: 'الفرع الرئيسي',
        permissions: [
          'view_dashboard', 'create_sale', 'edit_sale', 'cancel_sale', 'create_return', 'create_exchange',
          'view_products', 'create_product', 'edit_product', 'delete_product', 'manage_inventory', 'adjust_stock',
          'view_cost_prices', 'view_profit', 'manage_customers', 'manage_suppliers', 'manage_purchases',
          'manage_expenses', 'manage_cash_register', 'view_reports', 'export_reports', 'manage_users',
          'manage_roles', 'manage_settings'
        ],
        isActive: true,
      };
      set({ user: defaultAdmin, session: { user: { id: defaultAdmin.id } }, loading: false });
      sessionStorage.setItem('pos_auth_user', JSON.stringify(defaultAdmin));
      ensureOpenShiftOnLogin(defaultAdmin.id);
      return true;
    }

    set({ loading: false, error: 'رمز PIN غير صحيح أو غير مسجل بكشوفات الموظفين' });
    return false;
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    sessionStorage.removeItem('pos_auth_user');
    localStorage.removeItem('pos_auth_user');
    set({ user: null, session: null, error: null });
  },

  resetPassword: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      set({ error: 'تعذر إرسال رابط إعادة تعيين كلمة المرور' });
      return false;
    }
    return true;
  },

  changePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      set({ error: 'فشل تغيير كلمة المرور' });
      return false;
    }
    return true;
  },

  hasPermission: (permission) => {
    const user = get().user;
    if (!user) return false;
    if (user.roleCode === 'owner') return true;
    return user.permissions.includes(permission);
  },

  hasRole: (role) => {
    const user = get().user;
    if (!user) return false;
    if (Array.isArray(role)) return role.includes(user.roleCode);
    return user.roleCode === role;
  },

  canAccessBranch: (branchId) => {
    const user = get().user;
    if (!user) return false;
    if (user.roleCode === 'owner') return true;
    return user.branchId === branchId;
  },

  simulateRole: (roleCode) => {
    const permissionMap: Record<UserRoleCode, { nameAr: string; perms: PermissionCode[] }> = {
      owner: {
        nameAr: 'المالك (Owner)',
        perms: [
          'view_dashboard', 'create_sale', 'edit_sale', 'cancel_sale', 'create_return', 'create_exchange',
          'view_products', 'create_product', 'edit_product', 'delete_product', 'manage_inventory', 'adjust_stock',
          'view_cost_prices', 'view_profit', 'manage_customers', 'manage_suppliers', 'manage_purchases',
          'manage_expenses', 'manage_cash_register', 'view_reports', 'export_reports', 'manage_users',
          'manage_roles', 'manage_settings'
        ]
      },
      cashier: {
        nameAr: 'كاشير (Cashier)',
        perms: getSavedCashierPermissions()
      }
    };

    const target = permissionMap[roleCode] || permissionMap.owner;
    const simulatedUuids: Record<string, string> = {
      owner: '00000000-0000-0000-0000-000000000001',
      cashier: '00000000-0000-0000-0000-000000000002',
    };
    const simId = simulatedUuids[roleCode] || '00000000-0000-0000-0000-000000000001';

    set({
      user: {
        id: simId,
        fullName: `مستخدم تجريبي (${target.nameAr})`,
        email: `${roleCode}@pos.local`,
        roleCode: roleCode,
        roleNameAr: target.nameAr,
        branchId: '00000000-0000-0000-0000-000000000001',
        branchNameAr: 'الفرع الرئيسي',
        permissions: target.perms,
        isActive: true
      },
      session: { user: { id: simId } }
    });
  }
}));

async function fetchUserProfile(userId: string, email: string): Promise<UserProfile> {
  try {
    const res = await (supabase
      .from('profiles')
      .select('*, roles(code, name_ar), branches(name_ar)')
      .eq('id', userId)
      .single() as any);

    const profile = res.data;

    if (profile && profile.roles) {
      const roleCode = profile.roles.code as UserRoleCode;

      const permsRes = await (supabase
        .from('role_permissions')
        .select('permissions(code)')
        .eq('role_id', profile.role_id) as any);

      const perms: PermissionCode[] = (permsRes.data || [])
        .map((rp: any) => rp.permissions?.code as PermissionCode)
        .filter(Boolean);

      return {
        id: profile.id,
        fullName: profile.full_name,
        email: email,
        phone: profile.phone,
        avatarUrl: profile.avatar_url,
        branchId: profile.branch_id,
        branchNameAr: profile.branches?.name_ar || 'الفرع الرئيسي',
        roleCode: roleCode,
        roleNameAr: profile.roles.name_ar,
        permissions: perms,
        isActive: profile.is_active,
      };
    }
  } catch (e) {
    console.error('Error loading profile:', e);
  }

  return {
    id: userId,
    fullName: 'مالك النظام',
    email: email,
    roleCode: 'owner',
    roleNameAr: 'المالك (Owner)',
    branchId: '11111111-1111-1111-1111-111111111111',
    branchNameAr: 'الفرع الرئيسي - الرياض',
    permissions: [
      'view_dashboard', 'create_sale', 'edit_sale', 'cancel_sale', 'create_return', 'create_exchange',
      'view_products', 'create_product', 'edit_product', 'delete_product', 'manage_inventory', 'adjust_stock',
      'view_cost_prices', 'view_profit', 'manage_customers', 'manage_suppliers', 'manage_purchases',
      'manage_expenses', 'manage_cash_register', 'view_reports', 'export_reports', 'manage_users',
      'manage_roles', 'manage_settings'
    ],
    isActive: true,
  };
}

async function ensureOpenShiftOnLogin(cashierId: string) {
  try {
    const isValidUuid = (id?: string) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const validCashierId = isValidUuid(cashierId) ? cashierId : '00000000-0000-0000-0000-000000000001';

    // Check if there is an active open shift
    const { data: openShifts } = await (supabase.from('cashier_shifts') as any)
      .select('id')
      .eq('status', 'open')
      .limit(1);

    if (!openShifts || openShifts.length === 0) {
      // Auto open shift for user
      await (supabase.from('cashier_shifts') as any).insert({
        branch_id: '00000000-0000-0000-0000-000000000001',
        cash_register_id: '00000000-0000-0000-0000-000000000001',
        cashier_id: validCashierId,
        opening_balance: 0,
        status: 'open',
        opened_at: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('Auto open shift error:', err);
  }
}

async function autoCloseShiftOnLogout() {
  try {
    const { data: openShifts } = await (supabase.from('cashier_shifts') as any)
      .select('id')
      .eq('status', 'open');

    if (openShifts && openShifts.length > 0) {
      for (const s of openShifts) {
        await (supabase.from('cashier_shifts') as any)
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            closing_balance_counted: 0,
            notes: 'إغلاق تلقائي عند تسجيل الخروج',
          })
          .eq('id', s.id);
      }
    }
  } catch (err) {
    console.error('Auto close shift error:', err);
  }
}
