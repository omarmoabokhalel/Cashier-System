export type UserRoleCode = 'owner' | 'cashier';

export type PermissionCode =
  | 'view_dashboard'
  | 'create_sale'
  | 'edit_sale'
  | 'cancel_sale'
  | 'create_return'
  | 'create_exchange'
  | 'view_products'
  | 'create_product'
  | 'edit_product'
  | 'delete_product'
  | 'manage_inventory'
  | 'adjust_stock'
  | 'view_cost_prices'
  | 'view_profit'
  | 'manage_customers'
  | 'manage_suppliers'
  | 'manage_purchases'
  | 'manage_expenses'
  | 'manage_cash_register'
  | 'view_reports'
  | 'export_reports'
  | 'manage_users'
  | 'manage_roles'
  | 'manage_settings';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  branchId?: string;
  branchNameAr?: string;
  roleCode: UserRoleCode;
  roleNameAr: string;
  permissions: PermissionCode[];
  pinCode?: string;
  isActive: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  error: string | null;
}
