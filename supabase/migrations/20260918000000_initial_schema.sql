-- =====================================================================
-- Clothing Store POS System - Initial Supabase Database Migration
-- Database Engine: PostgreSQL 15+
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. EXTENSIONS & SCHEMA SETUP
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 2. CUSTOM ENUM TYPES
-- ---------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role_code AS ENUM ('owner', 'admin', 'branch_manager', 'cashier', 'inventory_manager');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE movement_type AS ENUM (
        'purchase', 'sale', 'return', 'exchange_in', 'exchange_out', 
        'adjustment', 'damaged', 'lost', 'transfer', 'opening_stock'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_type AS ENUM (
        'cash', 'card', 'wallet', 'bank_transfer', 'store_credit', 'loyalty_points', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_type AS ENUM ('paid', 'partially_paid', 'refunded', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE shift_status_type AS ENUM ('open', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE purchase_status_type AS ENUM ('draft', 'ordered', 'received', 'partially_received', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE adjustment_status_type AS ENUM ('draft', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE loyalty_trans_type AS ENUM ('earned', 'redeemed', 'expired', 'adjusted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- 3. CORE TABLES
-- ---------------------------------------------------------------------

-- A. Branches (الفروع)
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    tax_number VARCHAR(50),
    receipt_header TEXT,
    receipt_footer TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B. Roles (الأدوار)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C. Permissions (الصلاحيات)
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description_ar TEXT NOT NULL,
    description_en TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- D. Role Permissions (ربط الأدوار بالصلاحيات)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- E. Profiles (ملفات المستخدمين والمرتبطة بـ Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    pin_code_hash VARCHAR(255),
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- F. Apparel Taxonomy (التصنيفات والماركات والمقاسات والألوان)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar VARCHAR(50) NOT NULL,
    name_en VARCHAR(50) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar VARCHAR(50) NOT NULL,
    name_en VARCHAR(50) NOT NULL,
    hex_code VARCHAR(10) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- G. Product Catalog & Variants (المنتجات والأنواع)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    base_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (base_price >= 0),
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (tax_rate >= 0),
    min_stock_alert INT NOT NULL DEFAULT 5 CHECK (min_stock_alert >= 0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    size_id UUID NOT NULL REFERENCES sizes(id) ON DELETE RESTRICT,
    color_id UUID NOT NULL REFERENCES colors(id) ON DELETE RESTRICT,
    sku VARCHAR(100) UNIQUE NOT NULL,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    qr_code TEXT,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (selling_price >= 0),
    discount_price NUMERIC(12,2) CHECK (discount_price IS NULL OR discount_price >= 0),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(product_id, size_id, color_id)
);

-- H. Multi-Branch Inventory Stock & Movements (المخزون وحركات المخزون)
CREATE TABLE IF NOT EXISTS branch_variant_stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    quantity INT NOT NULL DEFAULT 0,
    bin_location VARCHAR(50),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id, variant_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    movement_type movement_type NOT NULL,
    quantity_delta INT NOT NULL,
    quantity_before INT NOT NULL,
    quantity_after INT NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    selling_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- I. Stock Adjustments / Stocktake (الجرد وتسوية المخزون)
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_number VARCHAR(100) UNIQUE NOT NULL,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    status adjustment_status_type NOT NULL DEFAULT 'draft',
    reason TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adjustment_id UUID NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    expected_qty INT NOT NULL,
    counted_qty INT NOT NULL,
    variance_qty INT GENERATED ALWAYS AS (counted_qty - expected_qty) STORED,
    unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT
);

-- J. CRM & Suppliers (العملاء والموردون)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    gender VARCHAR(10),
    date_of_birth DATE,
    total_points INT NOT NULL DEFAULT 0 CHECK (total_points >= 0),
    store_credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (store_credit_balance >= 0),
    tier VARCHAR(50) NOT NULL DEFAULT 'bronze',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    contact_person VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    tax_number VARCHAR(50),
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- K. Cash Registers & Cashier Shifts (الصناديق والوردية)
CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(branch_id, code)
);

CREATE TABLE IF NOT EXISTS cashier_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cashier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    status shift_status_type NOT NULL DEFAULT 'open',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (opening_balance >= 0),
    closing_balance_counted NUMERIC(12,2) DEFAULT 0.00,
    total_sales_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_sales_card NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_returns_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_expenses NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_cash_in NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_cash_out NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    expected_closing_balance NUMERIC(12,2) DEFAULT 0.00,
    variance NUMERIC(12,2) DEFAULT 0.00,
    notes TEXT
);

-- L. Discounts & Coupons (خصومات وكوبونات)
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    type discount_type NOT NULL,
    value NUMERIC(12,2) NOT NULL CHECK (value > 0),
    min_spend NUMERIC(12,2) DEFAULT 0.00,
    max_discount NUMERIC(12,2),
    usage_limit INT,
    usage_count INT NOT NULL DEFAULT 0,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    type discount_type NOT NULL,
    value NUMERIC(12,2) NOT NULL CHECK (value > 0),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- M. Sales, Items & Payments (المبيعات والمدفوعات)
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cashier_shift_id UUID NOT NULL REFERENCES cashier_shifts(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 15.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    change_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (change_amount >= 0),
    payment_status payment_status_type NOT NULL DEFAULT 'paid',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    returned_quantity INT NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0 AND returned_quantity <= quantity),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    cost_price NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    total_price NUMERIC(12,2) NOT NULL CHECK (total_price >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    cashier_shift_id UUID REFERENCES cashier_shifts(id) ON DELETE SET NULL,
    payment_method payment_method_type NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    reference_number VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- N. Returns & Return Items (المرجعات)
CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number VARCHAR(100) UNIQUE NOT NULL,
    original_sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cashier_shift_id UUID NOT NULL REFERENCES cashier_shifts(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (refund_amount >= 0),
    refund_method payment_method_type NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE RESTRICT,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    total_refund NUMERIC(12,2) NOT NULL CHECK (total_refund >= 0)
);

-- O. Exchanges & Exchange Items (الاستبدال)
CREATE TABLE IF NOT EXISTS exchanges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_number VARCHAR(100) UNIQUE NOT NULL,
    return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
    new_sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cashier_shift_id UUID NOT NULL REFERENCES cashier_shifts(id) ON DELETE RESTRICT,
    price_difference NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exchange_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exchange_id UUID NOT NULL REFERENCES exchanges(id) ON DELETE CASCADE,
    returned_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    new_variant_id UUID REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    price_delta NUMERIC(12,2) NOT NULL DEFAULT 0.00
);

-- P. Purchases & Items (أوامر الشراء والموردين)
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    status purchase_status_type NOT NULL DEFAULT 'draft',
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
    quantity_ordered INT NOT NULL CHECK (quantity_ordered > 0),
    quantity_received INT NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_cost_price NUMERIC(12,2) NOT NULL CHECK (unit_cost_price >= 0),
    total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_cost >= 0)
);

-- Q. Cash Movements & Expenses (المصروفات والإيداعات/السحوبات)
CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cashier_shift_id UUID NOT NULL REFERENCES cashier_shifts(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('cash_in', 'cash_out')),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cashier_shift_id UUID REFERENCES cashier_shifts(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    payee VARCHAR(255),
    receipt_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- R. Loyalty Program (برنامج الولاء)
CREATE TABLE IF NOT EXISTS loyalty_accounts (
    customer_id UUID PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
    balance_points INT NOT NULL DEFAULT 0 CHECK (balance_points >= 0),
    lifetime_earned INT NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
    lifetime_spent INT NOT NULL DEFAULT 0 CHECK (lifetime_spent >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    points_delta INT NOT NULL,
    transaction_type loyalty_trans_type NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- S. Notifications, Audit Logs & System Settings (التنبيهات وسجلات التدقيق)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    target_role VARCHAR(50),
    title_ar VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    message_ar TEXT NOT NULL,
    message_en TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'system',
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    UNIQUE(branch_id, key)
);

CREATE TABLE IF NOT EXISTS app_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. INDEXES FOR MAXIMUM POS QUERY PERFORMANCE
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode);

CREATE INDEX IF NOT EXISTS idx_branch_stock ON branch_variant_stock(branch_id, variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_search ON inventory_movements(branch_id, variant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_branch_date ON sales(branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(cashier_shift_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id);

CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_sale ON returns(original_sale_id);
CREATE INDEX IF NOT EXISTS idx_shifts_branch_cashier ON cashier_shifts(branch_id, cashier_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) & HELPER FUNCTIONS
-- ---------------------------------------------------------------------

-- Enable RLS on all operational tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_variant_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashier_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Functions
CREATE OR REPLACE FUNCTION get_auth_branch_id()
RETURNS UUID AS $$
    SELECT branch_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_auth_role_code()
RETURNS TEXT AS $$
    SELECT r.code 
    FROM profiles p 
    JOIN roles r ON p.role_id = r.id 
    WHERE p.id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(get_auth_role_code() = 'owner', false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin_or_owner()
RETURNS BOOLEAN AS $$
    SELECT COALESCE(get_auth_role_code() IN ('owner', 'admin'), false);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_permission(p_code TEXT)
RETURNS BOOLEAN AS $$
    SELECT is_owner() OR EXISTS (
        SELECT 1 
        FROM profiles p
        JOIN role_permissions rp ON p.role_id = rp.role_id
        JOIN permissions perm ON rp.permission_id = perm.id
        WHERE p.id = auth.uid() AND perm.code = p_code
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS Policies Enforcing Role & Permission Boundaries
CREATE POLICY roles_read ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY permissions_read ON permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY role_permissions_read ON role_permissions FOR SELECT TO authenticated USING (true);

-- User Profiles Policy
CREATE POLICY profiles_read ON profiles FOR SELECT TO authenticated USING (
    is_admin_or_owner() OR branch_id = get_auth_branch_id() OR id = auth.uid()
);
CREATE POLICY profiles_manage ON profiles FOR ALL TO authenticated USING (
    has_permission('manage_users')
);

-- Catalog Policies
CREATE POLICY catalog_read_categories ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_read_brands ON brands FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_read_sizes ON sizes FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_read_colors ON colors FOR SELECT TO authenticated USING (true);
CREATE POLICY catalog_read_products ON products FOR SELECT TO authenticated USING (deleted_at IS NULL AND has_permission('view_products'));
CREATE POLICY catalog_read_variants ON product_variants FOR SELECT TO authenticated USING (deleted_at IS NULL AND has_permission('view_products'));

CREATE POLICY product_write_policy ON products FOR ALL TO authenticated 
USING (has_permission('create_product') OR has_permission('edit_product') OR has_permission('delete_product'));

CREATE POLICY variant_write_policy ON product_variants FOR ALL TO authenticated 
USING (has_permission('create_product') OR has_permission('edit_product'));

-- Branch Stock Policy (Cashier cannot directly manipulate stock)
CREATE POLICY branch_stock_read ON branch_variant_stock FOR SELECT TO authenticated
USING (is_admin_or_owner() OR branch_id = get_auth_branch_id());

CREATE POLICY branch_stock_write ON branch_variant_stock FOR ALL TO authenticated
USING (has_permission('manage_inventory') OR has_permission('adjust_stock'));

-- Sales Policy
CREATE POLICY sales_read ON sales FOR SELECT TO authenticated
USING (is_admin_or_owner() OR branch_id = get_auth_branch_id());

CREATE POLICY sales_create ON sales FOR INSERT TO authenticated
WITH CHECK ((is_admin_or_owner() OR branch_id = get_auth_branch_id()) AND has_permission('create_sale'));

CREATE POLICY sale_items_policy ON sale_items FOR ALL TO authenticated
USING (
    is_admin_or_owner() OR EXISTS (
        SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.branch_id = get_auth_branch_id()
    )
);

CREATE POLICY payments_policy ON payments FOR ALL TO authenticated
USING (
    is_admin_or_owner() OR EXISTS (
        SELECT 1 FROM sales s WHERE s.id = payments.sale_id AND s.branch_id = get_auth_branch_id()
    )
);

CREATE POLICY returns_policy ON returns FOR ALL TO authenticated
USING ((is_admin_or_owner() OR branch_id = get_auth_branch_id()) AND has_permission('create_return'));

CREATE POLICY shifts_policy ON cashier_shifts FOR ALL TO authenticated
USING (is_admin_or_owner() OR branch_id = get_auth_branch_id());

CREATE POLICY expenses_policy ON expenses FOR ALL TO authenticated
USING ((is_admin_or_owner() OR branch_id = get_auth_branch_id()) AND has_permission('manage_expenses'));

CREATE POLICY purchases_policy ON purchases FOR ALL TO authenticated
USING ((is_admin_or_owner() OR branch_id = get_auth_branch_id()) AND has_permission('manage_purchases'));

-- ---------------------------------------------------------------------
-- 6. TRANSACTIONAL RPC STORED PROCEDURES (SECURITY DEFINER)
-- ---------------------------------------------------------------------

-- RPC 1: CREATE SALE (إنشاء عملية بيع)
CREATE OR REPLACE FUNCTION rpc_create_sale(
    p_cashier_shift_id UUID,
    p_customer_id UUID,
    p_subtotal NUMERIC,
    p_discount_amount NUMERIC,
    p_coupon_id UUID,
    p_tax_rate NUMERIC,
    p_tax_amount NUMERIC,
    p_total_amount NUMERIC,
    p_paid_amount NUMERIC,
    p_change_amount NUMERIC,
    p_notes TEXT,
    p_items JSONB,
    p_payments JSONB
) RETURNS JSONB AS $$
DECLARE
    v_branch_id UUID;
    v_shift_status shift_status_type;
    v_sale_id UUID;
    v_invoice_number VARCHAR(100);
    v_item JSONB;
    v_payment JSONB;
    v_variant_id UUID;
    v_qty INT;
    v_unit_price NUMERIC;
    v_cost_price NUMERIC;
    v_disc_amount NUMERIC;
    v_item_tax NUMERIC;
    v_item_total NUMERIC;
    v_curr_stock INT;
    v_points_earned INT := 0;
BEGIN
    IF NOT has_permission('create_sale') THEN
        RAISE EXCEPTION 'ليس لديك صلاحية لإجراء عملية بيع';
    END IF;

    SELECT branch_id, status INTO v_branch_id, v_shift_status
    FROM cashier_shifts WHERE id = p_cashier_shift_id;

    IF v_shift_status IS NULL OR v_shift_status != 'open' THEN
        RAISE EXCEPTION 'الوردية غير مفتوحة أو غير موجودة';
    END IF;

    v_invoice_number := 'INV-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random()*100000)::text, 5, '0');

    INSERT INTO sales (
        invoice_number, branch_id, cashier_shift_id, customer_id,
        subtotal, discount_amount, coupon_id, tax_rate, tax_amount,
        total_amount, paid_amount, change_amount, payment_status, notes
    ) VALUES (
        v_invoice_number, v_branch_id, p_cashier_shift_id, p_customer_id,
        p_subtotal, p_discount_amount, p_coupon_id, p_tax_rate, p_tax_amount,
        p_total_amount, p_paid_amount, p_change_amount, 'paid', p_notes
    ) RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;
        v_unit_price := (v_item->>'unit_price')::NUMERIC;
        v_cost_price := COALESCE((v_item->>'cost_price')::NUMERIC, 0.00);
        v_disc_amount := COALESCE((v_item->>'discount_amount')::NUMERIC, 0.00);
        v_item_tax := COALESCE((v_item->>'tax_amount')::NUMERIC, 0.00);
        v_item_total := (v_item->>'total_price')::NUMERIC;

        SELECT quantity INTO v_curr_stock
        FROM branch_variant_stock
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id
        FOR UPDATE;

        IF v_curr_stock IS NULL OR v_curr_stock < v_qty THEN
            RAISE EXCEPTION 'المخزون غير كاف للرقم المرجعي: % (المتاح: %)', v_variant_id, COALESCE(v_curr_stock, 0);
        END IF;

        UPDATE branch_variant_stock
        SET quantity = quantity - v_qty, updated_at = now()
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id;

        INSERT INTO inventory_movements (
            branch_id, variant_id, movement_type, quantity_delta,
            quantity_before, quantity_after, reference_type, reference_id,
            cost_price, selling_price, performed_by
        ) VALUES (
            v_branch_id, v_variant_id, 'sale', -v_qty,
            v_curr_stock, v_curr_stock - v_qty, 'sale', v_sale_id,
            v_cost_price, v_unit_price, auth.uid()
        );

        INSERT INTO sale_items (
            sale_id, variant_id, quantity, unit_price, cost_price,
            discount_amount, tax_amount, total_price
        ) VALUES (
            v_sale_id, v_variant_id, v_qty, v_unit_price, v_cost_price,
            v_disc_amount, v_item_tax, v_item_total
        );
    END LOOP;

    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
        INSERT INTO payments (
            sale_id, cashier_shift_id, payment_method, amount, reference_number
        ) VALUES (
            v_sale_id, p_cashier_shift_id, (v_payment->>'payment_method')::payment_method_type,
            (v_payment->>'amount')::NUMERIC, v_payment->>'reference_number'
        );

        IF (v_payment->>'payment_method') = 'cash' THEN
            UPDATE cashier_shifts SET total_sales_cash = total_sales_cash + (v_payment->>'amount')::NUMERIC WHERE id = p_cashier_shift_id;
        ELSIF (v_payment->>'payment_method') = 'card' THEN
            UPDATE cashier_shifts SET total_sales_card = total_sales_card + (v_payment->>'amount')::NUMERIC WHERE id = p_cashier_shift_id;
        END IF;
    END LOOP;

    IF p_customer_id IS NOT NULL THEN
        v_points_earned := floor(p_total_amount / 10);
        IF v_points_earned > 0 THEN
            INSERT INTO loyalty_accounts (customer_id, balance_points, lifetime_earned)
            VALUES (p_customer_id, v_points_earned, v_points_earned)
            ON CONFLICT (customer_id) DO UPDATE
            SET balance_points = loyalty_accounts.balance_points + v_points_earned,
                lifetime_earned = loyalty_accounts.lifetime_earned + v_points_earned,
                updated_at = now();

            INSERT INTO loyalty_transactions (
                customer_id, sale_id, points_delta, transaction_type, description
            ) VALUES (
                p_customer_id, v_sale_id, v_points_earned, 'earned', 'نقاط مكتسبة من الفاتورة ' || v_invoice_number
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'invoice_number', v_invoice_number,
        'total_amount', p_total_amount,
        'points_earned', v_points_earned
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 2: PROCESS RETURN (إرجاع منتج)
CREATE OR REPLACE FUNCTION rpc_process_return(
    p_original_sale_id UUID,
    p_cashier_shift_id UUID,
    p_refund_method payment_method_type,
    p_reason TEXT,
    p_items JSONB
) RETURNS JSONB AS $$
DECLARE
    v_branch_id UUID;
    v_customer_id UUID;
    v_return_id UUID;
    v_return_number VARCHAR(100);
    v_total_refund NUMERIC := 0.00;
    v_item JSONB;
    v_sale_item_id UUID;
    v_variant_id UUID;
    v_qty INT;
    v_unit_price NUMERIC;
    v_orig_qty INT;
    v_orig_returned INT;
    v_curr_stock INT;
BEGIN
    IF NOT has_permission('create_return') THEN
        RAISE EXCEPTION 'ليس لديك صلاحية لإجراء إرجاع';
    END IF;

    SELECT branch_id INTO v_branch_id FROM cashier_shifts WHERE id = p_cashier_shift_id AND status = 'open';
    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'الوردية الحالية غير صالحة أو مغلقة';
    END IF;

    SELECT customer_id INTO v_customer_id FROM sales WHERE id = p_original_sale_id;
    v_return_number := 'RET-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random()*100000)::text, 5, '0');

    INSERT INTO returns (
        return_number, original_sale_id, branch_id, cashier_shift_id,
        customer_id, refund_amount, refund_method, reason
    ) VALUES (
        v_return_number, p_original_sale_id, v_branch_id, p_cashier_shift_id,
        v_customer_id, 0.00, p_refund_method, p_reason
    ) RETURNING id INTO v_return_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_sale_item_id := (v_item->>'sale_item_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;

        SELECT variant_id, quantity, returned_quantity, unit_price
        INTO v_variant_id, v_orig_qty, v_orig_returned, v_unit_price
        FROM sale_items WHERE id = v_sale_item_id FOR UPDATE;

        IF (v_orig_returned + v_qty) > v_orig_qty THEN
            RAISE EXCEPTION 'الكمية المراد إرجاعها تتجاوز الكمية المشتراة الأصلية';
        END IF;

        UPDATE sale_items SET returned_quantity = returned_quantity + v_qty WHERE id = v_sale_item_id;

        v_total_refund := v_total_refund + (v_qty * v_unit_price);

        INSERT INTO return_items (
            return_id, sale_item_id, variant_id, quantity, unit_price, total_refund
        ) VALUES (
            v_return_id, v_sale_item_id, v_variant_id, v_qty, v_unit_price, (v_qty * v_unit_price)
        );

        SELECT COALESCE(quantity, 0) INTO v_curr_stock FROM branch_variant_stock
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id FOR UPDATE;

        INSERT INTO branch_variant_stock (branch_id, variant_id, quantity)
        VALUES (v_branch_id, v_variant_id, v_qty)
        ON CONFLICT (branch_id, variant_id)
        DO UPDATE SET quantity = branch_variant_stock.quantity + v_qty, updated_at = now();

        INSERT INTO inventory_movements (
            branch_id, variant_id, movement_type, quantity_delta,
            quantity_before, quantity_after, reference_type, reference_id, selling_price, performed_by
        ) VALUES (
            v_branch_id, v_variant_id, 'return', v_qty,
            v_curr_stock, v_curr_stock + v_qty, 'return', v_return_id, v_unit_price, auth.uid()
        );
    END LOOP;

    UPDATE returns SET refund_amount = v_total_refund WHERE id = v_return_id;

    IF p_refund_method = 'cash' THEN
        UPDATE cashier_shifts SET total_returns_cash = total_returns_cash + v_total_refund WHERE id = p_cashier_shift_id;
    ELSIF p_refund_method = 'store_credit' AND v_customer_id IS NOT NULL THEN
        UPDATE customers SET store_credit_balance = store_credit_balance + v_total_refund WHERE id = v_customer_id;
    END IF;

    RETURN jsonb_build_object(
        'return_id', v_return_id,
        'return_number', v_return_number,
        'refund_amount', v_total_refund
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 3: PROCESS EXCHANGE (استبدال منتج)
CREATE OR REPLACE FUNCTION rpc_process_exchange(
    p_original_sale_id UUID,
    p_cashier_shift_id UUID,
    p_return_items JSONB,
    p_new_sale_payload JSONB
) RETURNS JSONB AS $$
DECLARE
    v_branch_id UUID;
    v_return_res JSONB;
    v_new_sale_res JSONB;
    v_return_id UUID;
    v_new_sale_id UUID;
    v_refund_amount NUMERIC;
    v_new_sale_total NUMERIC;
    v_price_diff NUMERIC;
    v_exchange_number VARCHAR(100);
    v_exchange_id UUID;
BEGIN
    IF NOT has_permission('create_exchange') THEN
        RAISE EXCEPTION 'ليس لديك صلاحية لإجراء استبدال';
    END IF;

    SELECT branch_id INTO v_branch_id FROM cashier_shifts WHERE id = p_cashier_shift_id AND status = 'open';

    v_return_res := rpc_process_return(
        p_original_sale_id, p_cashier_shift_id, 'store_credit', 'استبدال منتجات', p_return_items
    );
    v_return_id := (v_return_res->>'return_id')::UUID;
    v_refund_amount := (v_return_res->>'refund_amount')::NUMERIC;

    v_new_sale_res := rpc_create_sale(
        p_cashier_shift_id,
        (p_new_sale_payload->>'customer_id')::UUID,
        (p_new_sale_payload->>'subtotal')::NUMERIC,
        (p_new_sale_payload->>'discount_amount')::NUMERIC,
        (p_new_sale_payload->>'coupon_id')::UUID,
        (p_new_sale_payload->>'tax_rate')::NUMERIC,
        (p_new_sale_payload->>'tax_amount')::NUMERIC,
        (p_new_sale_payload->>'total_amount')::NUMERIC,
        (p_new_sale_payload->>'paid_amount')::NUMERIC,
        (p_new_sale_payload->>'change_amount')::NUMERIC,
        'عملية استبدال',
        p_new_sale_payload->'items',
        p_new_sale_payload->'payments'
    );
    v_new_sale_id := (v_new_sale_res->>'sale_id')::UUID;
    v_new_sale_total := (v_new_sale_res->>'total_amount')::NUMERIC;

    v_price_diff := v_new_sale_total - v_refund_amount;
    v_exchange_number := 'EXC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random()*100000)::text, 5, '0');

    INSERT INTO exchanges (
        exchange_number, return_id, new_sale_id, branch_id, cashier_shift_id, price_difference
    ) VALUES (
        v_exchange_number, v_return_id, v_new_sale_id, v_branch_id, p_cashier_shift_id, v_price_diff
    ) RETURNING id INTO v_exchange_id;

    RETURN jsonb_build_object(
        'exchange_id', v_exchange_id,
        'exchange_number', v_exchange_number,
        'return_id', v_return_id,
        'new_sale_id', v_new_sale_id,
        'price_difference', v_price_diff
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 4: RECEIVE PURCHASE (استلام شحنة/فاتورة شراء)
CREATE OR REPLACE FUNCTION rpc_receive_purchase(
    p_purchase_id UUID,
    p_received_items JSONB
) RETURNS JSONB AS $$
DECLARE
    v_branch_id UUID;
    v_item JSONB;
    v_variant_id UUID;
    v_qty_rec INT;
    v_unit_cost NUMERIC;
    v_curr_stock INT;
BEGIN
    IF NOT has_permission('manage_purchases') THEN
        RAISE EXCEPTION 'ليس لديك صلاحية لإدارة المشتريات';
    END IF;

    SELECT branch_id INTO v_branch_id FROM purchases WHERE id = p_purchase_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_received_items) LOOP
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_qty_rec := (v_item->>'quantity_received')::INT;
        v_unit_cost := (v_item->>'unit_cost_price')::NUMERIC;

        UPDATE purchase_items 
        SET quantity_received = quantity_received + v_qty_rec
        WHERE purchase_id = p_purchase_id AND variant_id = v_variant_id;

        SELECT COALESCE(quantity, 0) INTO v_curr_stock FROM branch_variant_stock
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id FOR UPDATE;

        INSERT INTO branch_variant_stock (branch_id, variant_id, quantity)
        VALUES (v_branch_id, v_variant_id, v_qty_rec)
        ON CONFLICT (branch_id, variant_id)
        DO UPDATE SET quantity = branch_variant_stock.quantity + v_qty_rec, updated_at = now();

        INSERT INTO inventory_movements (
            branch_id, variant_id, movement_type, quantity_delta,
            quantity_before, quantity_after, reference_type, reference_id, cost_price, performed_by
        ) VALUES (
            v_branch_id, v_variant_id, 'purchase', v_qty_rec,
            v_curr_stock, v_curr_stock + v_qty_rec, 'purchase', p_purchase_id, v_unit_cost, auth.uid()
        );

        UPDATE product_variants SET cost_price = v_unit_cost WHERE id = v_variant_id;
    END LOOP;

    UPDATE purchases SET status = 'received', updated_at = now() WHERE id = p_purchase_id;

    RETURN jsonb_build_object('success', true, 'purchase_id', p_purchase_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 5: ADJUST INVENTORY / STOCKTAKE (تسوية المخزون/الجرد)
CREATE OR REPLACE FUNCTION rpc_adjust_inventory(
    p_branch_id UUID,
    p_reason TEXT,
    p_items JSONB
) RETURNS JSONB AS $$
DECLARE
    v_adj_id UUID;
    v_adj_num VARCHAR(100);
    v_item JSONB;
    v_variant_id UUID;
    v_counted_qty INT;
    v_expected_qty INT;
    v_variance INT;
    v_m_type movement_type;
BEGIN
    IF NOT has_permission('adjust_stock') THEN
        RAISE EXCEPTION 'ليس لديك صلاحية لتسوية المخزون والجرد';
    END IF;

    v_adj_num := 'ADJ-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(floor(random()*100000)::text, 5, '0');

    INSERT INTO stock_adjustments (
        adjustment_number, branch_id, status, reason, created_by, approved_by
    ) VALUES (
        v_adj_num, p_branch_id, 'approved', p_reason, auth.uid(), auth.uid()
    ) RETURNING id INTO v_adj_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_counted_qty := (v_item->>'counted_qty')::INT;

        SELECT COALESCE(quantity, 0) INTO v_expected_qty FROM branch_variant_stock
        WHERE branch_id = p_branch_id AND variant_id = v_variant_id FOR UPDATE;

        v_variance := v_counted_qty - v_expected_qty;

        INSERT INTO stock_adjustment_items (
            adjustment_id, variant_id, expected_qty, counted_qty, notes
        ) VALUES (
            v_adj_id, v_variant_id, v_expected_qty, v_counted_qty, v_item->>'notes'
        );

        IF v_variance != 0 THEN
            UPDATE branch_variant_stock
            SET quantity = v_counted_qty, updated_at = now()
            WHERE branch_id = p_branch_id AND variant_id = v_variant_id;

            v_m_type := CASE WHEN v_variance > 0 THEN 'adjustment'::movement_type ELSE 'damaged'::movement_type END;

            INSERT INTO inventory_movements (
                branch_id, variant_id, movement_type, quantity_delta,
                quantity_before, quantity_after, reference_type, reference_id, performed_by, notes
            ) VALUES (
                p_branch_id, v_variant_id, v_m_type, v_variance,
                v_expected_qty, v_counted_qty, 'adjustment', v_adj_id, auth.uid(), p_reason
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object('adjustment_id', v_adj_id, 'adjustment_number', v_adj_num);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC 6: CLOSE CASHIER SHIFT (إغلاق وردية الكاشير)
CREATE OR REPLACE FUNCTION rpc_close_cashier_shift(
    p_shift_id UUID,
    p_closing_balance_counted NUMERIC,
    p_notes TEXT
) RETURNS JSONB AS $$
DECLARE
    v_shift RECORD;
    v_expected NUMERIC;
    v_variance NUMERIC;
BEGIN
    SELECT * INTO v_shift FROM cashier_shifts WHERE id = p_shift_id AND status = 'open' FOR UPDATE;

    IF v_shift.id IS NULL THEN
        RAISE EXCEPTION 'الوردية غير مفتوحة أو تم إغلاقها سابقاً';
    END IF;

    v_expected := v_shift.opening_balance + v_shift.total_sales_cash + v_shift.total_cash_in - v_shift.total_returns_cash - v_shift.total_expenses - v_shift.total_cash_out;
    v_variance := p_closing_balance_counted - v_expected;

    UPDATE cashier_shifts SET
        status = 'closed',
        closed_at = now(),
        closing_balance_counted = p_closing_balance_counted,
        expected_closing_balance = v_expected,
        variance = v_variance,
        notes = p_notes
    WHERE id = p_shift_id;

    IF v_variance != 0 THEN
        INSERT INTO notifications (
            branch_id, target_role, title_ar, title_en, message_ar, message_en, type
        ) VALUES (
            v_shift.branch_id, 'branch_manager',
            'فارق في إغلاق الوردية', 'Shift Closing Variance',
            'يوجد فارق في الوردية بمقدار ' || v_variance || ' جنيه',
            'Shift closed with variance of ' || v_variance,
            'shift_variance'
        );
    END IF;

    RETURN jsonb_build_object(
        'shift_id', p_shift_id,
        'expected_balance', v_expected,
        'counted_balance', p_closing_balance_counted,
        'variance', v_variance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
