-- =====================================================================
-- Clothing Store POS System - Seed Data (بيانات البداية مع الصلاحيات)
-- =====================================================================

-- 1. ROLES (الأدوار الـ 5 المعتمدة)
INSERT INTO roles (id, name_ar, name_en, code, description, is_system) VALUES
('00000000-0000-0000-0000-000000000001', 'المالك (Owner)', 'Owner', 'owner', 'صلاحيات كاملة لكل الفروع والأنظمة والتقارير والبيانات المالية', true),
('00000000-0000-0000-0000-000000000002', 'مدير أدمن (Admin)', 'Admin', 'admin', 'صلاحيات إدارية شاملة للنظام والمستخدمين', true),
('00000000-0000-0000-0000-000000000003', 'مدير فرع (Branch Manager)', 'Branch Manager', 'branch_manager', 'إدارة الفرع المحدد والمخزون والورديات والتقارير الخاصة بالفرع', true),
('00000000-0000-0000-0000-000000000004', 'مدير مخزون (Inventory Manager)', 'Inventory Manager', 'inventory_manager', 'إدارة المنتجات والمخزون والموردين وأوامر الشراء والجرد', true),
('00000000-0000-0000-0000-000000000005', 'كاشير (Cashier)', 'Cashier', 'cashier', 'عمليات البيع والإرجاع والاستبدال وإدارة وردية الصندوق الخاصة به فقط', true)
ON CONFLICT (code) DO UPDATE 
SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en, description = EXCLUDED.description;

-- 2. PERMISSIONS (قائمة الصلاحيات التفصيلية الـ 24)
INSERT INTO permissions (id, code, category, description_ar, description_en) VALUES
-- Dashboard & Core
('p0000000-0000-0000-0000-000000000001', 'view_dashboard', 'dashboard', 'عرض لوحة التحكم الرئيسية', 'View Dashboard'),
-- Sales & POS
('p0000000-0000-0000-0000-000000000002', 'create_sale', 'pos', 'إجراء عملية بيع إصدار فاتورة', 'Create Sale'),
('p0000000-0000-0000-0000-000000000003', 'edit_sale', 'pos', 'تعديل الفواتير', 'Edit Sale'),
('p0000000-0000-0000-0000-000000000004', 'cancel_sale', 'pos', 'إلغاء الفواتير', 'Cancel Sale'),
('p0000000-0000-0000-0000-000000000005', 'create_return', 'pos', 'إجراء عملية إرجاع منتج', 'Create Return'),
('p0000000-0000-0000-0000-000000000006', 'create_exchange', 'pos', 'إجراء عملية استبدال منتج', 'Create Exchange'),
-- Products & Catalog
('p0000000-0000-0000-0000-000000000007', 'view_products', 'catalog', 'عرض قائمة المنتجات والأسعار', 'View Products'),
('p0000000-0000-0000-0000-000000000008', 'create_product', 'catalog', 'إضافة منتجات جديدة', 'Create Product'),
('p0000000-0000-0000-0000-000000000009', 'edit_product', 'catalog', 'تعديل بيانات المنتجات والأسعار', 'Edit Product'),
('p0000000-0000-0000-0000-000000000010', 'delete_product', 'catalog', 'حذف المنتجات', 'Delete Product'),
-- Inventory & Costing
('p0000000-0000-0000-0000-000000000011', 'manage_inventory', 'inventory', 'إدارة كميات المخزون والتحويلات', 'Manage Inventory'),
('p0000000-0000-0000-0000-000000000012', 'adjust_stock', 'inventory', 'تسوية الجرد وتعديل الكميات يدوياً', 'Adjust Stock'),
('p0000000-0000-0000-0000-000000000013', 'view_cost_prices', 'inventory', 'عرض أسعار التكلفة الحقيقية', 'View Cost Prices'),
('p0000000-0000-0000-0000-000000000014', 'view_profit', 'finance', 'عرض أرباح المنتجات والهوامش المالية', 'View Profit Margin'),
-- Business Management
('p0000000-0000-0000-0000-000000000015', 'manage_customers', 'crm', 'إدارة بيانات العملاء والولاء', 'Manage Customers'),
('p0000000-0000-0000-0000-000000000016', 'manage_suppliers', 'purchasing', 'إدارة الموردين', 'Manage Suppliers'),
('p0000000-0000-0000-0000-000000000017', 'manage_purchases', 'purchasing', 'إدارة أوامر الشراء واستلام البضاعة', 'Manage Purchases'),
('p0000000-0000-0000-0000-000000000018', 'manage_expenses', 'finance', 'إدراج وإدارة المصروفات اليومية', 'Manage Expenses'),
('p0000000-0000-0000-0000-000000000019', 'manage_cash_register', 'pos', 'فتح وإغلاق وإدارة الصناديق والورديات', 'Manage Cash Register'),
-- Reports & Admin
('p0000000-0000-0000-0000-000000000020', 'view_reports', 'reports', 'عرض التقارير المالية وإحصائيات المبيعات', 'View Reports'),
('p0000000-0000-0000-0000-000000000021', 'export_reports', 'reports', 'تصدير التقارير إلى PDF و Excel', 'Export Reports'),
('p0000000-0000-0000-0000-000000000022', 'manage_users', 'admin', 'إدارة المستخدمين وحسابات الموظفين', 'Manage Users'),
('p0000000-0000-0000-0000-000000000023', 'manage_roles', 'admin', 'إدارة الأدوار والصلاحيات', 'Manage Roles'),
('p0000000-0000-0000-0000-000000000024', 'manage_settings', 'admin', 'إدارة إعدادات النظام والفروع', 'Manage Settings')
ON CONFLICT (code) DO NOTHING;

-- 3. ROLE PERMISSIONS MAPPING
-- Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000002', id FROM permissions
ON CONFLICT DO NOTHING;

-- Branch Manager Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000003', id FROM permissions
WHERE code IN (
    'view_dashboard', 'create_sale', 'edit_sale', 'create_return', 'create_exchange',
    'view_products', 'create_product', 'edit_product', 'manage_inventory', 'adjust_stock',
    'view_cost_prices', 'manage_customers', 'manage_expenses', 'manage_cash_register',
    'view_reports', 'export_reports'
)
ON CONFLICT DO NOTHING;

-- Inventory Manager Permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000004', id FROM permissions
WHERE code IN (
    'view_dashboard', 'view_products', 'create_product', 'edit_product', 'delete_product',
    'manage_inventory', 'adjust_stock', 'view_cost_prices', 'manage_suppliers', 'manage_purchases'
)
ON CONFLICT DO NOTHING;

-- Cashier Permissions (Restricted: ONLY Sales/POS & Customer Lookup, NO Cost/Profit/Stock manipulation/Users)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000005', id FROM permissions
WHERE code IN (
    'view_dashboard', 'create_sale', 'create_return', 'create_exchange',
    'view_products', 'manage_customers'
)
ON CONFLICT DO NOTHING;

-- 4. BRANCHES & TAXONOMY SEED
INSERT INTO branches (id, name_ar, name_en, code, address, phone, tax_number, receipt_header, receipt_footer) VALUES
('11111111-1111-1111-1111-111111111111', 'الفرع الرئيسي - الرياض', 'Riyadh Main Branch', 'BR-RYD-01', 'طريق الملك فهد، الرياض', '+966500000001', '300012345600003', 'متجر الملابس العصرية', 'البضاعة المباعة ترجع خلال 14 يوماً')
ON CONFLICT (code) DO NOTHING;

INSERT INTO categories (id, name_ar, name_en, code) VALUES
('c0000000-0000-0000-0000-000000000001', 'تيشرتات', 'T-Shirts', 'CAT-TSHIRT'),
('c0000000-0000-0000-0000-000000000002', 'قمصان', 'Shirts', 'CAT-SHIRT'),
('c0000000-0000-0000-0000-000000000003', 'بنطال', 'Pants', 'CAT-PANTS'),
('c0000000-0000-0000-0000-000000000004', 'جينز', 'Jeans', 'CAT-JEANS'),
('c0000000-0000-0000-0000-000000000005', 'جاكيتات', 'Jackets', 'CAT-JACKET'),
('c0000000-0000-0000-0000-000000000006', 'هوديز', 'Hoodies', 'CAT-HOODIE'),
('c0000000-0000-0000-0000-000000000007', 'إكسسوارات', 'Accessories', 'CAT-ACCESSORIES')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sizes (id, name_ar, name_en, code, sort_order) VALUES
('s0000000-0000-0000-0000-000000000001', 'صغير جداً (XS)', 'XS', 'XS', 1),
('s0000000-0000-0000-0000-000000000002', 'صغير (S)', 'S', 'S', 2),
('s0000000-0000-0000-0000-000000000003', 'وسط (M)', 'M', 'M', 3),
('s0000000-0000-0000-0000-000000000004', 'كبير (L)', 'L', 'L', 4),
('s0000000-0000-0000-0000-000000000005', 'كبير جداً (XL)', 'XL', 'XL', 5),
('s0000000-0000-0000-0000-000000000006', 'كبير جداً مضاعف (XXL)', 'XXL', 'XXL', 6)
ON CONFLICT (code) DO NOTHING;

INSERT INTO colors (id, name_ar, name_en, hex_code, code) VALUES
('clr00000-0000-0000-0000-000000000001', 'أسود', 'Black', '#000000', 'BLK'),
('clr00000-0000-0000-0000-000000000002', 'أبيض', 'White', '#FFFFFF', 'WHT'),
('clr00000-0000-0000-0000-000000000003', 'أحمر', 'Red', '#FF0000', 'RED'),
('clr00000-0000-0000-0000-000000000004', 'أزرق', 'Blue', '#0000FF', 'BLU'),
('clr00000-0000-0000-0000-000000000005', 'أخضر', 'Green', '#008000', 'GRN'),
('clr00000-0000-0000-0000-000000000006', 'رمادي', 'Gray', '#808080', 'GRY'),
('clr00000-0000-0000-0000-000000000007', 'بيج', 'Beige', '#F5F5DC', 'BGE')
ON CONFLICT (code) DO NOTHING;
