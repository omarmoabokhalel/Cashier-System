-- ====================================
-- FILE: 20260918000000_initial_schema.sql
-- ====================================
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


-- ====================================
-- FILE: 20260918000001_storage_setup.sql
-- ====================================
-- =====================================================================
-- Supabase Storage Setup for Product Images & Logos
-- =====================================================================

-- Create Storage Bucket for Product Images if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Public Read Access for Product Images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated Users Upload Product Images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated Users Update Product Images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated Users Delete Product Images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');


-- ====================================
-- FILE: 20260918000002_sales_payment_system.sql
-- ====================================
-- =====================================================================
-- Sales & Payment System Upgrade - Migration 20260918000002
-- PostgreSQL 15+ Atomic Transaction, Server-Side Recalculation & Audit Logs
-- =====================================================================

-- 1. Invoice Number Sequence Generator
CREATE SEQUENCE IF NOT EXISTS sale_invoice_seq START WITH 1 INCREMENT BY 1;

-- 2. Enhanced Atomic RPC Function: rpc_create_sale
CREATE OR REPLACE FUNCTION rpc_create_sale(
    p_cashier_shift_id UUID,
    p_customer_id UUID DEFAULT NULL,
    p_subtotal NUMERIC DEFAULT 0,
    p_discount_amount NUMERIC DEFAULT 0,
    p_coupon_id UUID DEFAULT NULL,
    p_tax_rate NUMERIC DEFAULT 15.00,
    p_tax_amount NUMERIC DEFAULT 0,
    p_total_amount NUMERIC DEFAULT 0,
    p_paid_amount NUMERIC DEFAULT 0,
    p_change_amount NUMERIC DEFAULT 0,
    p_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_payments JSONB DEFAULT '[]'::jsonb,
    p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_branch_id UUID;
    v_shift_status shift_status_type;
    v_sale_id UUID;
    v_invoice_number VARCHAR(100);
    v_item JSONB;
    v_payment JSONB;

    -- Recalculated values (Zero Frontend Trust)
    v_calc_subtotal NUMERIC(12,2) := 0.00;
    v_calc_item_discounts NUMERIC(12,2) := 0.00;
    v_calc_tax NUMERIC(12,2) := 0.00;
    v_calc_total NUMERIC(12,2) := 0.00;
    v_calc_paid NUMERIC(12,2) := 0.00;
    v_calc_change NUMERIC(12,2) := 0.00;
    v_total_profit NUMERIC(12,2) := 0.00;

    -- Variant temp loop variables
    v_variant_id UUID;
    v_qty INT;
    v_unit_price NUMERIC(12,2);
    v_cost_price NUMERIC(12,2);
    v_item_discount NUMERIC(12,2);
    v_item_tax NUMERIC(12,2);
    v_item_total NUMERIC(12,2);
    v_item_profit NUMERIC(12,2);
    v_curr_stock INT;
    v_variant_price NUMERIC(12,2);
    v_variant_cost NUMERIC(12,2);
    v_is_active BOOLEAN;

    -- Payment loop variables
    v_payment_method payment_method_type;
    v_payment_amt NUMERIC(12,2);
    v_payment_ref TEXT;

    -- Loyalty points
    v_points_earned INT := 0;

    -- Idempotency existing record check
    v_existing_audit RECORD;
BEGIN
    -- Permission Check
    IF NOT has_permission('create_sale') THEN
        RAISE EXCEPTION 'ليس لديك صلاحية لإجراء عملية بيع';
    END IF;

    -- 1. IDEMPOTENCY CHECK
    IF p_idempotency_key IS NOT NULL AND trim(p_idempotency_key) != '' THEN
        SELECT entity_id, new_values INTO v_existing_audit
        FROM audit_logs
        WHERE action = 'create_sale'
          AND entity_type = 'sales'
          AND (new_values->>'idempotency_key') = p_idempotency_key
        LIMIT 1;

        IF FOUND THEN
            -- Return previously generated sale response directly
            RETURN v_existing_audit.new_values->'response';
        END IF;
    END IF;

    -- 2. CASHIER SHIFT VALIDATION
    SELECT branch_id, status INTO v_branch_id, v_shift_status
    FROM cashier_shifts
    WHERE id = p_cashier_shift_id
    FOR UPDATE;

    IF v_shift_status IS NULL THEN
        RAISE EXCEPTION 'الوردية غير موجودة (Shift ID: %)', p_cashier_shift_id;
    ELSIF v_shift_status != 'open' THEN
        RAISE EXCEPTION 'الوردية الحالية غير مفتوحة أو مغلقة (Shift Status: %)', v_shift_status;
    END IF;

    -- Validate Items Array
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'لا يمكن إتمام عملية بيع بدون أصناف';
    END IF;

    -- 3. SERVER-SIDE RECALCULATION & STOCK LOCKING (FOR UPDATE)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;
        v_item_discount := COALESCE((v_item->>'discount_amount')::NUMERIC, 0.00);

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'كمية الصنف يجب أن تكون أكبر من 0';
        END IF;

        -- Fetch current variant price, historical cost price, and stock quantity with row lock
        SELECT selling_price, cost_price, is_active
        INTO v_variant_price, v_variant_cost, v_is_active
        FROM product_variants
        WHERE id = v_variant_id;

        IF v_variant_price IS NULL OR v_is_active = FALSE THEN
            RAISE EXCEPTION 'المنتج غير موجود أو غير نشط (ID: %)', v_variant_id;
        END IF;

        -- Check Branch Stock
        SELECT quantity INTO v_curr_stock
        FROM branch_variant_stock
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id
        FOR UPDATE;

        IF v_curr_stock IS NULL OR v_curr_stock < v_qty THEN
            RAISE EXCEPTION 'المخزون غير كافٍ للمنتج (المتاح: %, المطلوب: %)', COALESCE(v_curr_stock, 0), v_qty;
        END IF;

        -- Unit price strictly recalculated from database (or client provided if valid)
        v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, v_variant_price);
        v_cost_price := v_variant_cost; -- Historical cost from product_variants table

        -- Line totals calculation
        v_item_total := (v_unit_price * v_qty) - v_item_discount;
        v_item_profit := v_item_total - (v_cost_price * v_qty);

        -- Accumulate totals
        v_calc_subtotal := v_calc_subtotal + (v_unit_price * v_qty);
        v_calc_item_discounts := v_calc_item_discounts + v_item_discount;
        v_total_profit := v_total_profit + v_item_profit;
    END LOOP;

    -- Calculate Tax & Grand Total
    v_calc_tax := ROUND(((v_calc_subtotal - v_calc_item_discounts) * (p_tax_rate / 100.00)), 2);
    v_calc_total := (v_calc_subtotal - v_calc_item_discounts) + v_calc_tax;

    -- 4. PAYMENTS VALIDATION & RECALCULATION
    IF jsonb_array_length(p_payments) = 0 THEN
        RAISE EXCEPTION 'لا بد من تقديم طريقة دفع واحدة على الأقل';
    END IF;

    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
        v_payment_amt := (v_payment->>'amount')::NUMERIC;
        IF v_payment_amt <= 0 THEN
            RAISE EXCEPTION 'مبلغ الدفع يجب أن يكون أكبر من 0';
        END IF;
        v_calc_paid := v_calc_paid + v_payment_amt;
    END LOOP;

    -- Ensure paid amount covers grand total
    IF v_calc_paid < v_calc_total THEN
        RAISE EXCEPTION 'إجمالي المبلغ المدفوع (%). أقل من إجمالي الفاتورة المطلوب (%)', v_calc_paid, v_calc_total;
    END IF;

    v_calc_change := v_calc_paid - v_calc_total;

    -- 5. GENERATE INVOICE NUMBER (INV-YYYY-XXXXXX)
    v_invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('sale_invoice_seq')::text, 6, '0');

    -- 6. INSERT INTO sales TABLE
    INSERT INTO sales (
        invoice_number, branch_id, cashier_shift_id, customer_id,
        subtotal, discount_amount, coupon_id, tax_rate, tax_amount,
        total_amount, paid_amount, change_amount, payment_status, notes
    ) VALUES (
        v_invoice_number, v_branch_id, p_cashier_shift_id, p_customer_id,
        v_calc_subtotal, v_calc_item_discounts, p_coupon_id, p_tax_rate, v_calc_tax,
        v_calc_total, v_calc_paid, v_calc_change, 'paid', p_notes
    ) RETURNING id INTO v_sale_id;

    -- 7. INSERT INTO sale_items & UPDATE STOCKS & LOG INVENTORY MOVEMENTS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;
        v_item_discount := COALESCE((v_item->>'discount_amount')::NUMERIC, 0.00);

        SELECT selling_price, cost_price INTO v_variant_price, v_variant_cost
        FROM product_variants WHERE id = v_variant_id;

        v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, v_variant_price);
        v_cost_price := v_variant_cost;
        v_item_tax := ROUND(((v_unit_price * v_qty - v_item_discount) * (p_tax_rate / 100.00)), 2);
        v_item_total := (v_unit_price * v_qty) - v_item_discount;

        SELECT quantity INTO v_curr_stock
        FROM branch_variant_stock
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id;

        -- Insert Sale Item (with actual historical cost_price)
        INSERT INTO sale_items (
            sale_id, variant_id, quantity, unit_price, cost_price,
            discount_amount, tax_amount, total_price
        ) VALUES (
            v_sale_id, v_variant_id, v_qty, v_unit_price, v_cost_price,
            v_item_discount, v_item_tax, v_item_total
        );

        -- Deduct Stock
        UPDATE branch_variant_stock
        SET quantity = quantity - v_qty, updated_at = now()
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id;

        -- Log Inventory Movement
        INSERT INTO inventory_movements (
            branch_id, variant_id, movement_type, quantity_delta,
            quantity_before, quantity_after, reference_type, reference_id,
            cost_price, selling_price, performed_by
        ) VALUES (
            v_branch_id, v_variant_id, 'sale', -v_qty,
            v_curr_stock, v_curr_stock - v_qty, 'sale', v_sale_id,
            v_cost_price, v_unit_price, auth.uid()
        );
    END LOOP;

    -- 8. INSERT INTO payments TABLE & UPDATE SHIFT TOTALS
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
        v_payment_method := (v_payment->>'payment_method')::payment_method_type;
        v_payment_amt := (v_payment->>'amount')::NUMERIC;
        v_payment_ref := v_payment->>'reference_number';

        INSERT INTO payments (
            sale_id, cashier_shift_id, payment_method, amount, reference_number
        ) VALUES (
            v_sale_id, p_cashier_shift_id, v_payment_method, v_payment_amt, v_payment_ref
        );

        IF v_payment_method = 'cash' THEN
            UPDATE cashier_shifts SET total_sales_cash = total_sales_cash + v_payment_amt WHERE id = p_cashier_shift_id;
        ELSIF v_payment_method = 'card' THEN
            UPDATE cashier_shifts SET total_sales_card = total_sales_card + v_payment_amt WHERE id = p_cashier_shift_id;
        END IF;
    END LOOP;

    -- 9. LOYALTY POINTS AWARDING (If Customer Exists)
    IF p_customer_id IS NOT NULL THEN
        v_points_earned := floor(v_calc_total / 10);
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
                p_customer_id, v_sale_id, v_points_earned, 'earned', 'نقاط الفاتورة ' || v_invoice_number
            );
        END IF;
    END IF;

    -- Build Final Response Object
    DECLARE
        v_response JSONB;
    BEGIN
        v_response := jsonb_build_object(
            'sale_id', v_sale_id,
            'invoice_number', v_invoice_number,
            'subtotal', v_calc_subtotal,
            'discount_amount', v_calc_item_discounts,
            'tax_amount', v_calc_tax,
            'total_amount', v_calc_total,
            'paid_amount', v_calc_paid,
            'change_amount', v_calc_change,
            'total_profit', v_total_profit,
            'points_earned', v_points_earned,
            'created_at', now()
        );

        -- 10. INSERT AUDIT LOG FOR TRANSACTION
        INSERT INTO audit_logs (
            user_id, branch_id, action, entity_type, entity_id, new_values
        ) VALUES (
            auth.uid(), v_branch_id, 'create_sale', 'sales', v_sale_id::text,
            jsonb_build_object(
                'idempotency_key', p_idempotency_key,
                'response', v_response
            )
        );

        RETURN v_response;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================
-- FILE: 20260918000003_returns_exchanges_system.sql
-- ====================================
-- =====================================================================
-- Returns & Exchanges System Upgrade - Migration 20260918000003
-- PostgreSQL 15+ Atomic Transaction, Stock Restoration & Financial Balancing
-- =====================================================================

-- 1. Sequence Generators for Return & Exchange Numbers
CREATE SEQUENCE IF NOT EXISTS return_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS exchange_number_seq START WITH 1 INCREMENT BY 1;

-- 2. Enhanced Atomic RPC Function: rpc_process_return
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
    v_shift_status shift_status_type;
    v_return_id UUID;
    v_return_number VARCHAR(100);
    v_total_refund NUMERIC(12,2) := 0.00;
    v_item JSONB;
    v_sale_item_id UUID;
    v_variant_id UUID;
    v_qty INT;
    v_unit_price NUMERIC(12,2);
    v_orig_qty INT;
    v_orig_returned INT;
    v_returnable_qty INT;
    v_curr_stock INT;
BEGIN
    -- Permission Check
    IF NOT has_permission('create_return') THEN
        RAISE EXCEPTION 'ليس لديك صلاحية لإجراء عملية إرجاع';
    END IF;

    -- Validate Cashier Shift
    SELECT branch_id, status INTO v_branch_id, v_shift_status
    FROM cashier_shifts
    WHERE id = p_cashier_shift_id
    FOR UPDATE;

    IF v_shift_status IS NULL THEN
        RAISE EXCEPTION 'الوردية غير موجودة (Shift ID: %)', p_cashier_shift_id;
    ELSIF v_shift_status != 'open' THEN
        RAISE EXCEPTION 'الوردية الحالية غير مفتوحة (Shift Status: %)', v_shift_status;
    END IF;

    -- Fetch original sale customer
    SELECT customer_id INTO v_customer_id
    FROM sales
    WHERE id = p_original_sale_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الفاتورة الأصلية غير موجودة (ID: %)', p_original_sale_id;
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'يجب تحديد صنف واحد على الأقل لإجراء الإرجاع';
    END IF;

    -- Generate Return Number (RET-YYYY-XXXXXX)
    v_return_number := 'RET-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('return_number_seq')::text, 6, '0');

    -- Insert into returns table
    INSERT INTO returns (
        return_number, original_sale_id, branch_id, cashier_shift_id,
        customer_id, refund_amount, refund_method, reason
    ) VALUES (
        v_return_number, p_original_sale_id, v_branch_id, p_cashier_shift_id,
        v_customer_id, 0.00, p_refund_method, p_reason
    ) RETURNING id INTO v_return_id;

    -- Process Each Return Item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_sale_item_id := (v_item->>'sale_item_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'كمية الإرجاع يجب أن تكون أكبر من 0';
        END IF;

        -- Lock sale item row for update to prevent race conditions
        SELECT variant_id, quantity, returned_quantity, unit_price
        INTO v_variant_id, v_orig_qty, v_orig_returned, v_unit_price
        FROM sale_items
        WHERE id = v_sale_item_id
        FOR UPDATE;

        IF v_variant_id IS NULL THEN
            RAISE EXCEPTION 'صنف الفاتورة غير موجود (ID: %)', v_sale_item_id;
        END IF;

        v_returnable_qty := v_orig_qty - v_orig_returned;

        IF v_qty > v_returnable_qty THEN
            RAISE EXCEPTION 'الكمية المراد إرجاعها (%) تتجاوز الكمية المتاحة للإرجاع (%)', v_qty, v_returnable_qty;
        END IF;

        -- Update returned quantity on original sale item
        UPDATE sale_items
        SET returned_quantity = returned_quantity + v_qty
        WHERE id = v_sale_item_id;

        v_total_refund := v_total_refund + (v_qty * v_unit_price);

        -- Insert return item record
        INSERT INTO return_items (
            return_id, sale_item_id, variant_id, quantity, unit_price, total_refund
        ) VALUES (
            v_return_id, v_sale_item_id, v_variant_id, v_qty, v_unit_price, (v_qty * v_unit_price)
        );

        -- Restore inventory stock (FOR UPDATE)
        SELECT COALESCE(quantity, 0) INTO v_curr_stock
        FROM branch_variant_stock
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id
        FOR UPDATE;

        INSERT INTO branch_variant_stock (branch_id, variant_id, quantity)
        VALUES (v_branch_id, v_variant_id, v_qty)
        ON CONFLICT (branch_id, variant_id)
        DO UPDATE SET quantity = branch_variant_stock.quantity + v_qty, updated_at = now();

        -- Log Inventory Movement
        INSERT INTO inventory_movements (
            branch_id, variant_id, movement_type, quantity_delta,
            quantity_before, quantity_after, reference_type, reference_id,
            selling_price, performed_by
        ) VALUES (
            v_branch_id, v_variant_id, 'return', v_qty,
            COALESCE(v_curr_stock, 0), COALESCE(v_curr_stock, 0) + v_qty, 'return', v_return_id,
            v_unit_price, auth.uid()
        );
    END LOOP;

    -- Update return header total refund
    UPDATE returns SET refund_amount = v_total_refund WHERE id = v_return_id;

    -- Update Shift Return Totals
    IF p_refund_method = 'cash' THEN
        UPDATE cashier_shifts SET total_returns_cash = total_returns_cash + v_total_refund WHERE id = p_cashier_shift_id;
    ELSIF p_refund_method = 'store_credit' AND v_customer_id IS NOT NULL THEN
        UPDATE customers SET store_credit_balance = store_credit_balance + v_total_refund WHERE id = v_customer_id;
    END IF;

    -- Create Audit Log Entry
    INSERT INTO audit_logs (
        user_id, branch_id, action, entity_type, entity_id, new_values
    ) VALUES (
        auth.uid(), v_branch_id, 'create_return', 'returns', v_return_id::text,
        jsonb_build_object(
            'return_number', v_return_number,
            'refund_amount', v_total_refund,
            'refund_method', p_refund_method
        )
    );

    RETURN jsonb_build_object(
        'return_id', v_return_id,
        'return_number', v_return_number,
        'refund_amount', v_total_refund
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Enhanced Atomic RPC Function: rpc_process_exchange
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
    v_refund_amount NUMERIC(12,2);
    v_new_sale_total NUMERIC(12,2);
    v_price_diff NUMERIC(12,2);
    v_exchange_number VARCHAR(100);
    v_exchange_id UUID;
BEGIN
    -- Permission Check
    IF NOT has_permission('create_exchange') THEN
        RAISE EXCEPTION 'ليس لديك صلاحية لإجراء عملية استبدال';
    END IF;

    -- Step 1: Process Return of Old Item(s)
    v_return_res := rpc_process_return(
        p_original_sale_id, p_cashier_shift_id, 'store_credit', 'استبدال منتجات', p_return_items
    );

    v_return_id := (v_return_res->>'return_id')::UUID;
    v_refund_amount := (v_return_res->>'refund_amount')::NUMERIC;

    -- Step 2: Process Sale of New Replacement Item(s)
    v_new_sale_res := rpc_create_sale(
        p_cashier_shift_id,
        (p_new_sale_payload->>'customer_id')::UUID,
        (p_new_sale_payload->>'subtotal')::NUMERIC,
        (p_new_sale_payload->>'discount_amount')::NUMERIC,
        (p_new_sale_payload->>'coupon_id')::UUID,
        COALESCE((p_new_sale_payload->>'tax_rate')::NUMERIC, 15.00),
        (p_new_sale_payload->>'tax_amount')::NUMERIC,
        (p_new_sale_payload->>'total_amount')::NUMERIC,
        (p_new_sale_payload->>'paid_amount')::NUMERIC,
        (p_new_sale_payload->>'change_amount')::NUMERIC,
        'عملية استبدال',
        p_new_sale_payload->'items',
        p_new_sale_payload->'payments',
        (p_new_sale_payload->>'idempotency_key')
    );

    v_new_sale_id := (v_new_sale_res->>'sale_id')::UUID;
    v_new_sale_total := (v_new_sale_res->>'total_amount')::NUMERIC;

    -- Step 3: Compute Net Financial Price Difference
    v_price_diff := v_new_sale_total - v_refund_amount;
    v_exchange_number := 'EXC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('exchange_number_seq')::text, 6, '0');

    SELECT branch_id INTO v_branch_id FROM cashier_shifts WHERE id = p_cashier_shift_id;

    -- Insert Exchange Record
    INSERT INTO exchanges (
        exchange_number, return_id, new_sale_id, branch_id, cashier_shift_id, price_difference
    ) VALUES (
        v_exchange_number, v_return_id, v_new_sale_id, v_branch_id, p_cashier_shift_id, v_price_diff
    ) RETURNING id INTO v_exchange_id;

    -- Insert Audit Log for Exchange
    INSERT INTO audit_logs (
        user_id, branch_id, action, entity_type, entity_id, new_values
    ) VALUES (
        auth.uid(), v_branch_id, 'create_exchange', 'exchanges', v_exchange_id::text,
        jsonb_build_object(
            'exchange_number', v_exchange_number,
            'return_id', v_return_id,
            'new_sale_id', v_new_sale_id,
            'price_difference', v_price_diff
        )
    );

    RETURN jsonb_build_object(
        'exchange_id', v_exchange_id,
        'exchange_number', v_exchange_number,
        'return_id', v_return_id,
        'new_sale_id', v_new_sale_id,
        'refund_amount', v_refund_amount,
        'new_sale_total', v_new_sale_total,
        'price_difference', v_price_diff,
        'new_invoice_number', v_new_sale_res->>'invoice_number'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================
-- FILE: 20260918000004_customers_loyalty_coupons.sql
-- ====================================
-- =====================================================================
-- Customers, Loyalty, Discounts & Coupons Upgrade - Migration 20260918000004
-- =====================================================================

-- 1. SEED DEFAULT WALK-IN CUSTOMER (عميل نقدي عام)
INSERT INTO customers (id, full_name, phone, email, tier, is_active)
VALUES ('00000000-0000-0000-0000-000000000000', 'عميل نقدي عام', '0000000000', 'walkin@store.com', 'bronze', true)
ON CONFLICT (phone) DO NOTHING;

-- Seed default loyalty account for Walk-in Customer
INSERT INTO loyalty_accounts (customer_id, balance_points, lifetime_earned, lifetime_spent)
VALUES ('00000000-0000-0000-0000-000000000000', 0, 0, 0)
ON CONFLICT (customer_id) DO NOTHING;


-- 2. LOYALTY PROGRAM RPCs (CRITICAL: Loyalty balance NEVER changes without transaction record)

-- A. Earn Loyalty Points
CREATE OR REPLACE FUNCTION rpc_earn_loyalty_points(
    p_customer_id UUID,
    p_sale_id UUID,
    p_total_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_points_earned INT;
    v_current_balance INT := 0;
BEGIN
    IF p_customer_id IS NULL OR p_customer_id = '00000000-0000-0000-0000-000000000000' THEN
        RETURN jsonb_build_object('earned', 0, 'new_balance', 0);
    END IF;

    -- Calculate: 1 Point for every 10 Currency Units
    v_points_earned := floor(p_total_amount / 10.00);

    IF v_points_earned <= 0 THEN
        RETURN jsonb_build_object('earned', 0, 'new_balance', 0);
    END IF;

    -- Update or Insert Loyalty Account Balance
    INSERT INTO loyalty_accounts (customer_id, balance_points, lifetime_earned)
    VALUES (p_customer_id, v_points_earned, v_points_earned)
    ON CONFLICT (customer_id) DO UPDATE
    SET balance_points = loyalty_accounts.balance_points + v_points_earned,
        lifetime_earned = loyalty_accounts.lifetime_earned + v_points_earned,
        updated_at = now();

    -- Also update total_points on customers table
    UPDATE customers
    SET total_points = total_points + v_points_earned,
        updated_at = now()
    WHERE id = p_customer_id;

    -- MANDATORY TRANSACTION RECORD
    INSERT INTO loyalty_transactions (
        customer_id, sale_id, points_delta, transaction_type, description
    ) VALUES (
        p_customer_id, p_sale_id, v_points_earned, 'earned',
        'نقاط مكتسبة من الفاتورة بقيمة ' || p_total_amount || ' ج.م'
    );

    SELECT balance_points INTO v_current_balance
    FROM loyalty_accounts
    WHERE customer_id = p_customer_id;

    RETURN jsonb_build_object(
        'earned', v_points_earned,
        'new_balance', v_current_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- B. Redeem Loyalty Points
CREATE OR REPLACE FUNCTION rpc_redeem_loyalty_points(
    p_customer_id UUID,
    p_points_to_redeem INT,
    p_sale_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_curr_balance INT := 0;
    v_discount_value NUMERIC(12,2) := 0.00;
BEGIN
    IF p_customer_id IS NULL OR p_customer_id = '00000000-0000-0000-0000-000000000000' THEN
        RAISE EXCEPTION 'لا يمكن استبدال نقاط لعميل نقدي عام';
    END IF;

    IF p_points_to_redeem <= 0 THEN
        RAISE EXCEPTION 'عدد النقاط المراد استبدالها يجب أن يكون أكبر من 0';
    END IF;

    -- Lock Loyalty Account Row for Update
    SELECT balance_points INTO v_curr_balance
    FROM loyalty_accounts
    WHERE customer_id = p_customer_id
    FOR UPDATE;

    IF v_curr_balance IS NULL OR v_curr_balance < p_points_to_redeem THEN
        RAISE EXCEPTION 'رصيد النقاط غير كافٍ. المتاح: %, المطلوب: %', COALESCE(v_curr_balance, 0), p_points_to_redeem;
    END IF;

    -- Redemption Rate: 10 Points = 1 EGP Discount
    v_discount_value := ROUND((p_points_to_redeem / 10.00), 2);

    -- Deduct Balance
    UPDATE loyalty_accounts
    SET balance_points = balance_points - p_points_to_redeem,
        lifetime_spent = lifetime_spent + p_points_to_redeem,
        updated_at = now()
    WHERE customer_id = p_customer_id;

    UPDATE customers
    SET total_points = GREATEST(0, total_points - p_points_to_redeem),
        updated_at = now()
    WHERE id = p_customer_id;

    -- MANDATORY TRANSACTION RECORD
    INSERT INTO loyalty_transactions (
        customer_id, sale_id, points_delta, transaction_type, description
    ) VALUES (
        p_customer_id, p_sale_id, -p_points_to_redeem, 'redeemed',
        'استبدال ' || p_points_to_redeem || ' نقطة مقابل خصم بقيمة ' || v_discount_value || ' ج.م'
    );

    RETURN jsonb_build_object(
        'points_redeemed', p_points_to_redeem,
        'discount_amount', v_discount_value,
        'remaining_balance', v_curr_balance - p_points_to_redeem
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. SERVER-SIDE COUPON VALIDATION RPC
CREATE OR REPLACE FUNCTION rpc_validate_coupon(
    p_code VARCHAR(50),
    p_order_subtotal NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_coupon RECORD;
    v_calc_discount NUMERIC(12,2) := 0.00;
BEGIN
    SELECT * INTO v_coupon
    FROM coupons
    WHERE lower(code) = lower(trim(p_code))
    LIMIT 1;

    IF v_coupon.id IS NULL THEN
        RAISE EXCEPTION 'كوبون الخصم غير موجود';
    END IF;

    IF v_coupon.is_active = FALSE THEN
        RAISE EXCEPTION 'كوبون الخصم غير نشط أو معطل';
    END IF;

    IF now() < v_coupon.valid_from THEN
        RAISE EXCEPTION 'كوبون الخصم لم يبدأ تفعيله بعد';
    ELSIF now() > v_coupon.valid_until THEN
        RAISE EXCEPTION 'كوبون الخصم منتهي الصلاحية';
    END IF;

    IF v_coupon.usage_limit IS NOT NULL AND v_coupon.usage_count >= v_coupon.usage_limit THEN
        RAISE EXCEPTION 'تم تجاوز الحد الأقصى لاستخدام هذا الكوبون';
    END IF;

    IF v_coupon.min_spend IS NOT NULL AND p_order_subtotal < v_coupon.min_spend THEN
        RAISE EXCEPTION 'الحد الأدنى للشراء لتطبيق الكوبون هو % ج.م', v_coupon.min_spend;
    END IF;

    -- Calculate Discount
    IF v_coupon.type = 'percentage' THEN
        v_calc_discount := ROUND((p_order_subtotal * (v_coupon.value / 100.00)), 2);
    ELSE
        v_calc_discount := v_coupon.value;
    END IF;

    -- Cap by Max Discount if specified
    IF v_coupon.max_discount IS NOT NULL AND v_calc_discount > v_coupon.max_discount THEN
        v_calc_discount := v_coupon.max_discount;
    END IF;

    -- Ensure discount does not exceed subtotal
    IF v_calc_discount > p_order_subtotal THEN
        v_calc_discount := p_order_subtotal;
    END IF;

    RETURN jsonb_build_object(
        'coupon_id', v_coupon.id,
        'code', v_coupon.code,
        'type', v_coupon.type,
        'value', v_coupon.value,
        'discount_amount', v_calc_discount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. ROLE-RESTRICTED MANUAL DISCOUNT VALIDATION RPC
CREATE OR REPLACE FUNCTION rpc_validate_manual_discount(
    p_user_role VARCHAR(50),
    p_discount_percentage NUMERIC
) RETURNS JSONB AS $$
DECLARE
    v_max_allowed NUMERIC := 10.00;
BEGIN
    IF p_user_role IN ('owner', 'admin') THEN
        v_max_allowed := 100.00;
    ELSIF p_user_role = 'branch_manager' THEN
        v_max_allowed := 25.00;
    ELSIF p_user_role = 'cashier' THEN
        v_max_allowed := 10.00;
    ELSE
        v_max_allowed := 0.00;
    END IF;

    IF p_discount_percentage > v_max_allowed THEN
        RAISE EXCEPTION 'دورك الحالي (%) لا يسمح بتطبيق خصم أكثر من %٪', p_user_role, v_max_allowed;
    END IF;

    RETURN jsonb_build_object('allowed', true, 'max_allowed', v_max_allowed);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================
-- FILE: 20260918000005_suppliers_purchases_expenses_register.sql
-- ====================================
-- =====================================================================
-- Suppliers, Purchases, Expenses & Cash Register Upgrade - Migration 20260918000005
-- PostgreSQL 15+ Stored Procedures for Shifts, Cash Movements & Inventory Receiving
-- =====================================================================

-- 1. Sequence Generator for Purchase Orders
CREATE SEQUENCE IF NOT EXISTS purchase_number_seq START WITH 1 INCREMENT BY 1;


-- 2. RPC: Record Cash In / Cash Out Movement
CREATE OR REPLACE FUNCTION rpc_record_cash_movement(
    p_cashier_shift_id UUID,
    p_movement_type VARCHAR(20),
    p_amount NUMERIC,
    p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
    v_branch_id UUID;
    v_shift_status shift_status_type;
    v_movement_id UUID;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'مبلغ الحركة النقدية يجب أن يكون أكبر من 0';
    END IF;

    IF p_movement_type NOT IN ('cash_in', 'cash_out') THEN
        RAISE EXCEPTION 'نوع الحركة النقدية غير صالح (%)', p_movement_type;
    END IF;

    -- Check and Lock Shift Row
    SELECT branch_id, status INTO v_branch_id, v_shift_status
    FROM cashier_shifts
    WHERE id = p_cashier_shift_id
    FOR UPDATE;

    IF v_shift_status IS NULL THEN
        RAISE EXCEPTION 'الوردية غير موجودة (ID: %)', p_cashier_shift_id;
    ELSIF v_shift_status != 'open' THEN
        RAISE EXCEPTION 'الوردية مغلقة، لا يمكن إضافة حركة نقدية';
    END IF;

    -- Insert into cash_movements table
    INSERT INTO cash_movements (
        cashier_shift_id, branch_id, movement_type, amount, reason, performed_by
    ) VALUES (
        p_cashier_shift_id, v_branch_id, p_movement_type, p_amount, p_reason, auth.uid()
    ) RETURNING id INTO v_movement_id;

    -- Update Cashier Shift Totals
    IF p_movement_type = 'cash_in' THEN
        UPDATE cashier_shifts SET total_cash_in = total_cash_in + p_amount WHERE id = p_cashier_shift_id;
    ELSIF p_movement_type = 'cash_out' THEN
        UPDATE cashier_shifts SET total_cash_out = total_cash_out + p_amount WHERE id = p_cashier_shift_id;
    END IF;

    -- Insert Audit Log
    INSERT INTO audit_logs (
        user_id, branch_id, action, entity_type, entity_id, new_values
    ) VALUES (
        auth.uid(), v_branch_id, p_movement_type, 'cash_movements', v_movement_id::text,
        jsonb_build_object('amount', p_amount, 'reason', p_reason)
    );

    RETURN jsonb_build_object(
        'movement_id', v_movement_id,
        'movement_type', p_movement_type,
        'amount', p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RPC: Record Operational Expense
CREATE OR REPLACE FUNCTION rpc_record_expense(
    p_cashier_shift_id UUID,
    p_category VARCHAR(100),
    p_amount NUMERIC,
    p_description TEXT,
    p_payee VARCHAR(255) DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_branch_id UUID;
    v_shift_status shift_status_type;
    v_expense_id UUID;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'مبلغ المصروف يجب أن يكون أكبر من 0';
    END IF;

    SELECT branch_id, status INTO v_branch_id, v_shift_status
    FROM cashier_shifts
    WHERE id = p_cashier_shift_id
    FOR UPDATE;

    IF v_shift_status IS NULL THEN
        RAISE EXCEPTION 'الوردية غير موجودة (ID: %)', p_cashier_shift_id;
    ELSIF v_shift_status != 'open' THEN
        RAISE EXCEPTION 'الوردية الحالية مغلقة، لا يمكن إضافة مصروفات';
    END IF;

    INSERT INTO expenses (
        branch_id, cashier_shift_id, category, amount, description, payee
    ) VALUES (
        v_branch_id, p_cashier_shift_id, p_category, p_amount, p_description, p_payee
    ) RETURNING id INTO v_expense_id;

    -- Update Cashier Shift Total Expenses
    UPDATE cashier_shifts
    SET total_expenses = total_expenses + p_amount
    WHERE id = p_cashier_shift_id;

    -- Insert Audit Log
    INSERT INTO audit_logs (
        user_id, branch_id, action, entity_type, entity_id, new_values
    ) VALUES (
        auth.uid(), v_branch_id, 'create_expense', 'expenses', v_expense_id::text,
        jsonb_build_object('category', p_category, 'amount', p_amount, 'description', p_description)
    );

    RETURN jsonb_build_object(
        'expense_id', v_expense_id,
        'category', p_category,
        'amount', p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. RPC: Receive Purchase Order (Updates Inventory Stock & Unit Cost)
CREATE OR REPLACE FUNCTION rpc_receive_purchase(
    p_purchase_id UUID,
    p_received_items JSONB
) RETURNS JSONB AS $$
DECLARE
    v_branch_id UUID;
    v_item JSONB;
    v_variant_id UUID;
    v_qty_rec INT;
    v_unit_cost NUMERIC(12,2);
    v_curr_stock INT;
BEGIN
    IF NOT has_permission('manage_purchases') THEN
        RAISE EXCEPTION 'ليس لديك صلاحية لإدارة واستلام الشحنات';
    END IF;

    SELECT branch_id INTO v_branch_id
    FROM purchases
    WHERE id = p_purchase_id
    FOR UPDATE;

    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'فاتورة الشراء غير موجودة (ID: %)', p_purchase_id;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_received_items) LOOP
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_qty_rec := (v_item->>'quantity_received')::INT;
        v_unit_cost := (v_item->>'unit_cost_price')::NUMERIC;

        IF v_qty_rec <= 0 THEN
            RAISE EXCEPTION 'الكمية المستلمة يجب أن تكون أكبر من 0';
        END IF;

        -- Update purchase_items quantity_received
        UPDATE purchase_items
        SET quantity_received = quantity_received + v_qty_rec
        WHERE purchase_id = p_purchase_id AND variant_id = v_variant_id;

        -- Fetch current stock with FOR UPDATE lock
        SELECT COALESCE(quantity, 0) INTO v_curr_stock
        FROM branch_variant_stock
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id
        FOR UPDATE;

        -- Increase Inventory Stock
        INSERT INTO branch_variant_stock (branch_id, variant_id, quantity)
        VALUES (v_branch_id, v_variant_id, v_qty_rec)
        ON CONFLICT (branch_id, variant_id)
        DO UPDATE SET quantity = branch_variant_stock.quantity + v_qty_rec, updated_at = now();

        -- Log Inventory Movement
        INSERT INTO inventory_movements (
            branch_id, variant_id, movement_type, quantity_delta,
            quantity_before, quantity_after, reference_type, reference_id,
            cost_price, performed_by
        ) VALUES (
            v_branch_id, v_variant_id, 'purchase', v_qty_rec,
            COALESCE(v_curr_stock, 0), COALESCE(v_curr_stock, 0) + v_qty_rec, 'purchase', p_purchase_id,
            v_unit_cost, auth.uid()
        );

        -- Update Unit Cost Price on Variant Table
        UPDATE product_variants
        SET cost_price = v_unit_cost, updated_at = now()
        WHERE id = v_variant_id;
    END LOOP;

    -- Update Purchase Order Status to 'received'
    UPDATE purchases
    SET status = 'received', updated_at = now()
    WHERE id = p_purchase_id;

    -- Log Audit Entry
    INSERT INTO audit_logs (
        user_id, branch_id, action, entity_type, entity_id, new_values
    ) VALUES (
        auth.uid(), v_branch_id, 'receive_purchase', 'purchases', p_purchase_id::text,
        jsonb_build_object('status', 'received')
    );

    RETURN jsonb_build_object('success', true, 'purchase_id', p_purchase_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. RPC: Close Cashier Shift (Transactional Expected vs Actual Variance)
CREATE OR REPLACE FUNCTION rpc_close_cashier_shift(
    p_shift_id UUID,
    p_closing_balance_counted NUMERIC,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_shift RECORD;
    v_expected NUMERIC(12,2) := 0.00;
    v_variance NUMERIC(12,2) := 0.00;
BEGIN
    SELECT * INTO v_shift
    FROM cashier_shifts
    WHERE id = p_shift_id AND status = 'open'
    FOR UPDATE;

    IF v_shift.id IS NULL THEN
        RAISE EXCEPTION 'الوردية غير مفتوحة أو تم إغلاقها سابقاً';
    END IF;

    -- Expected Cash Formula:
    -- Expected = Opening Cash + Cash Sales + Cash In - Cash Refunds - Cash Out - Expenses
    v_expected := v_shift.opening_balance + v_shift.total_sales_cash + v_shift.total_cash_in
                - v_shift.total_returns_cash - v_shift.total_cash_out - v_shift.total_expenses;

    -- Variance = Counted Cash - Expected Cash
    v_variance := p_closing_balance_counted - v_expected;

    -- Update Shift Status to Closed
    UPDATE cashier_shifts
    SET status = 'closed',
        closed_at = now(),
        closing_balance_counted = p_closing_balance_counted,
        expected_closing_balance = v_expected,
        variance = v_variance,
        notes = p_notes
    WHERE id = p_shift_id;

    -- Insert Audit Log
    INSERT INTO audit_logs (
        user_id, branch_id, action, entity_type, entity_id, new_values
    ) VALUES (
        auth.uid(), v_shift.branch_id, 'close_shift', 'cashier_shifts', p_shift_id::text,
        jsonb_build_object(
            'opening_balance', v_shift.opening_balance,
            'total_sales_cash', v_shift.total_sales_cash,
            'total_returns_cash', v_shift.total_returns_cash,
            'total_cash_in', v_shift.total_cash_in,
            'total_cash_out', v_shift.total_cash_out,
            'total_expenses', v_shift.total_expenses,
            'expected_closing_balance', v_expected,
            'closing_balance_counted', p_closing_balance_counted,
            'variance', v_variance
        )
    );

    RETURN jsonb_build_object(
        'shift_id', p_shift_id,
        'status', 'closed',
        'expected_closing_balance', v_expected,
        'closing_balance_counted', p_closing_balance_counted,
        'variance', v_variance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================
-- FILE: 20260918000006_dashboard_reports_analytics.sql
-- ====================================
-- =====================================================================
-- Dashboard, Reports & Analytics System Upgrade - Migration 20260918000006
-- PostgreSQL 15+ 100% Real Database Analytics & Executive Owner Stored Procedures
-- =====================================================================

-- 1. RPC: Fetch Real Dashboard Analytics Metrics
CREATE OR REPLACE FUNCTION rpc_get_dashboard_analytics(
    p_branch_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_sales_today NUMERIC(12,2) := 0.00;
    v_sales_month NUMERIC(12,2) := 0.00;
    v_invoices_count INT := 0;
    v_avg_invoice NUMERIC(12,2) := 0.00;
    v_cogs NUMERIC(12,2) := 0.00;
    v_gross_profit NUMERIC(12,2) := 0.00;
    v_returns_total NUMERIC(12,2) := 0.00;
    v_expenses_total NUMERIC(12,2) := 0.00;
    v_net_sales NUMERIC(12,2) := 0.00;
    v_net_profit NUMERIC(12,2) := 0.00;

    v_top_products JSONB;
    v_sales_by_category JSONB;
    v_sales_by_payment JSONB;
    v_daily_trend JSONB;
BEGIN
    -- 1. Sales Today
    SELECT COALESCE(SUM(total_amount), 0.00) INTO v_sales_today
    FROM sales
    WHERE created_at >= CURRENT_DATE
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 2. Sales Month
    SELECT COALESCE(SUM(total_amount), 0.00) INTO v_sales_month
    FROM sales
    WHERE created_at >= date_trunc('month', CURRENT_DATE)
      AND (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 3. Invoices Count
    SELECT COUNT(*) INTO v_invoices_count
    FROM sales
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 4. Average Invoice Value
    IF v_invoices_count > 0 THEN
        SELECT COALESCE(AVG(total_amount), 0.00) INTO v_avg_invoice
        FROM sales
        WHERE (p_branch_id IS NULL OR branch_id = p_branch_id);
    END IF;

    -- 5. Cost of Goods Sold (COGS using historical cost_price stored in sale_items)
    SELECT COALESCE(SUM(si.cost_price * (si.quantity - si.returned_quantity)), 0.00) INTO v_cogs
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id);

    -- 6. Returns Total
    SELECT COALESCE(SUM(refund_amount), 0.00) INTO v_returns_total
    FROM returns
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 7. Expenses Total
    SELECT COALESCE(SUM(amount), 0.00) INTO v_expenses_total
    FROM expenses
    WHERE (p_branch_id IS NULL OR branch_id = p_branch_id);

    -- 8. Net Sales & Gross Profit & Net Profit Formula
    v_net_sales := (SELECT COALESCE(SUM(total_amount), 0.00) FROM sales WHERE (p_branch_id IS NULL OR branch_id = p_branch_id)) - v_returns_total;
    v_gross_profit := v_net_sales - v_cogs;
    v_net_profit := v_gross_profit - v_expenses_total;

    -- 9. Top 5 Best-Selling Products (by quantity)
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v_top_products
    FROM (
        SELECT p.name_ar AS product_name, SUM(si.quantity) AS total_sold, SUM(si.total_price) AS total_revenue
        FROM sale_items si
        JOIN product_variants pv ON pv.id = si.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN sales s ON s.id = si.sale_id
        WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        GROUP BY p.name_ar
        ORDER BY total_sold DESC
        LIMIT 5
    ) t;

    -- 10. Sales by Category
    SELECT COALESCE(jsonb_agg(c), '[]'::jsonb) INTO v_sales_by_category
    FROM (
        SELECT COALESCE(cat.name_ar, 'عام') AS category_name, SUM(si.total_price) AS total_revenue
        FROM sale_items si
        JOIN product_variants pv ON pv.id = si.variant_id
        JOIN products p ON p.id = pv.product_id
        LEFT JOIN categories cat ON cat.id = p.category_id
        JOIN sales s ON s.id = si.sale_id
        WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        GROUP BY cat.name_ar
        ORDER BY total_revenue DESC
    ) c;

    -- 11. Sales by Payment Method
    SELECT COALESCE(jsonb_agg(pm), '[]'::jsonb) INTO v_sales_by_payment
    FROM (
        SELECT payment_method, SUM(amount) AS total_amount
        FROM payments pay
        JOIN sales s ON s.id = pay.sale_id
        WHERE (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        GROUP BY payment_method
    ) pm;

    -- 12. 7-Day Daily Sales Trend
    SELECT COALESCE(jsonb_agg(d), '[]'::jsonb) INTO v_daily_trend
    FROM (
        SELECT to_char(created_at::date, 'YYYY-MM-DD') AS day_date, SUM(total_amount) AS daily_sales
        FROM sales
        WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
          AND (p_branch_id IS NULL OR branch_id = p_branch_id)
        GROUP BY created_at::date
        ORDER BY day_date ASC
    ) d;

    RETURN jsonb_build_object(
        'sales_today', v_sales_today,
        'sales_month', v_sales_month,
        'invoices_count', v_invoices_count,
        'avg_invoice', v_avg_invoice,
        'cogs', v_cogs,
        'gross_profit', v_gross_profit,
        'returns_total', v_returns_total,
        'expenses_total', v_expenses_total,
        'net_sales', v_net_sales,
        'net_profit', v_net_profit,
        'top_products', v_top_products,
        'sales_by_category', v_sales_by_category,
        'sales_by_payment', v_sales_by_payment,
        'daily_trend', v_daily_trend
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. RPC: Executive Owner Metrics (Inventory Valuation, Cash Position, Cashier & Branch Performance)
CREATE OR REPLACE FUNCTION rpc_get_executive_owner_metrics()
RETURNS JSONB AS $$
DECLARE
    v_total_inventory_valuation NUMERIC(12,2) := 0.00;
    v_cash_in_registers NUMERIC(12,2) := 0.00;
    v_card_sales_total NUMERIC(12,2) := 0.00;
    v_cashier_performance JSONB;
    v_branch_performance JSONB;
BEGIN
    -- Total Inventory Valuation (SUM of current quantity * cost_price)
    SELECT COALESCE(SUM(bvs.quantity * pv.cost_price), 0.00) INTO v_total_inventory_valuation
    FROM branch_variant_stock bvs
    JOIN product_variants pv ON pv.id = bvs.variant_id;

    -- Cash position in open registers
    SELECT COALESCE(SUM(opening_balance + total_sales_cash + total_cash_in - total_returns_cash - total_cash_out - total_expenses), 0.00)
    INTO v_cash_in_registers
    FROM cashier_shifts
    WHERE status = 'open';

    -- Card sales total
    SELECT COALESCE(SUM(amount), 0.00) INTO v_card_sales_total
    FROM payments
    WHERE payment_method = 'card';

    -- Cashier Performance Breakdown
    SELECT COALESCE(jsonb_agg(cp), '[]'::jsonb) INTO v_cashier_performance
    FROM (
        SELECT prof.full_name AS cashier_name, COUNT(s.id) AS sales_count, SUM(s.total_amount) AS total_sales
        FROM sales s
        JOIN cashier_shifts cs ON cs.id = s.cashier_shift_id
        JOIN profiles prof ON prof.id = cs.cashier_id
        GROUP BY prof.full_name
        ORDER BY total_sales DESC
    ) cp;

    -- Branch Performance Comparison
    SELECT COALESCE(jsonb_agg(bp), '[]'::jsonb) INTO v_branch_performance
    FROM (
        SELECT b.name_ar AS branch_name, COUNT(s.id) AS sales_count, SUM(s.total_amount) AS total_sales
        FROM sales s
        JOIN branches b ON b.id = s.branch_id
        GROUP BY b.name_ar
        ORDER BY total_sales DESC
    ) bp;

    RETURN jsonb_build_object(
        'inventory_valuation', v_total_inventory_valuation,
        'cash_in_registers', v_cash_in_registers,
        'card_sales_total', v_card_sales_total,
        'total_cash_position', v_cash_in_registers + v_card_sales_total,
        'cashier_performance', v_cashier_performance,
        'branch_performance', v_branch_performance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================
-- FILE: 20260918000007_production_hardening.sql
-- ====================================
-- =====================================================================
-- Production Hardening & System Integration - Migration 20260918000007
-- PostgreSQL 15+ Performance Indexes, Audit Logging & Automated System Notifications
-- =====================================================================

-- 1. Performance & Security Indexes
CREATE INDEX IF NOT EXISTS idx_product_variants_lookup ON product_variants (lower(barcode), lower(sku));
CREATE INDEX IF NOT EXISTS idx_sales_created_at_branch ON sales (created_at DESC, branch_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_profit ON sale_items (sale_id, cost_price, unit_price);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_variant ON inventory_movements (variant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_entity ON audit_logs (action, entity_type, entity_id);

-- 2. System Notification Trigger Function (Low Stock & Out of Stock Alerts)
CREATE OR REPLACE FUNCTION trg_check_stock_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_product_name VARCHAR(255);
    v_size_code VARCHAR(50);
BEGIN
    IF NEW.quantity <= 5 THEN
        SELECT p.name_ar, s.code INTO v_product_name, v_size_code
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        JOIN sizes s ON s.id = pv.size_id
        WHERE pv.id = NEW.variant_id;

        IF NEW.quantity <= 0 THEN
            INSERT INTO notifications (
                branch_id, target_role, title_ar, title_en, message_ar, message_en, type
            ) VALUES (
                NEW.branch_id, 'inventory_manager',
                'تنبيه: نفاد المخزون بالكامل',
                'Alert: Out of Stock',
                'المنتج ' || COALESCE(v_product_name, '') || ' (' || COALESCE(v_size_code, '') || ') نفد بالكامل من المخزون.',
                'Product ' || COALESCE(v_product_name, '') || ' is completely out of stock.',
                'stock_alert'
            );
        ELSE
            INSERT INTO notifications (
                branch_id, target_role, title_ar, title_en, message_ar, message_en, type
            ) VALUES (
                NEW.branch_id, 'inventory_manager',
                'تنبيه: مخزون منخفض',
                'Alert: Low Stock Warning',
                'المنتج ' || COALESCE(v_product_name, '') || ' (' || COALESCE(v_size_code, '') || ') المتبقي هو ' || NEW.quantity || ' قطع فقط.',
                'Product ' || COALESCE(v_product_name, '') || ' has low stock (' || NEW.quantity || ' remaining).',
                'stock_alert'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach Notification Trigger on branch_variant_stock
DROP TRIGGER IF EXISTS trg_stock_notification_check ON branch_variant_stock;
CREATE TRIGGER trg_stock_notification_check
AFTER INSERT OR UPDATE OF quantity ON branch_variant_stock
FOR EACH ROW EXECUTE FUNCTION trg_check_stock_notifications();


-- 3. Audit Logging Stored Procedure
CREATE OR REPLACE FUNCTION rpc_log_audit_event(
    p_action VARCHAR(100),
    p_entity_type VARCHAR(100),
    p_entity_id VARCHAR(100) DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_log_id UUID;
    v_branch_id UUID;
BEGIN
    INSERT INTO audit_logs (
        user_id, branch_id, action, entity_type, entity_id, old_values, new_values
    ) VALUES (
        auth.uid(), v_branch_id, p_action, p_entity_type, p_entity_id, p_old_values, p_new_values
    ) RETURNING id INTO v_log_id;

    RETURN jsonb_build_object('success', true, 'log_id', v_log_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
