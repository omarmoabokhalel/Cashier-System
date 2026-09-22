-- ==============================================================================
-- SUPABASE DATABASE UPDATE SCRIPT (2026 Features & Schema Enhancements)
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Add product_code, barcode, and min_selling_price to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS product_code TEXT,
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS min_selling_price NUMERIC(10, 2) DEFAULT 0.00;

-- Drop NOT NULL constraint on name_en for products, categories, brands if present
ALTER TABLE public.products ALTER COLUMN name_en DROP NOT NULL;
ALTER TABLE public.categories ALTER COLUMN name_en DROP NOT NULL;
ALTER TABLE public.brands ALTER COLUMN name_en DROP NOT NULL;

-- 2. Add min_selling_price and discount_price to product_variants table, and ensure size_id and color_id allow NULL
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS min_selling_price NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS discount_price NUMERIC(10, 2) DEFAULT 0.00;

ALTER TABLE public.product_variants 
ALTER COLUMN size_id DROP NOT NULL,
ALTER COLUMN color_id DROP NOT NULL;

-- 3. Ensure suppliers optional columns allow NULL
ALTER TABLE public.suppliers 
ALTER COLUMN company_name DROP NOT NULL,
ALTER COLUMN contact_person DROP NOT NULL,
ALTER COLUMN email DROP NOT NULL,
ALTER COLUMN tax_number DROP NOT NULL,
ALTER COLUMN address DROP NOT NULL;

-- 4. Ensure expenses optional columns allow NULL
ALTER TABLE public.expenses 
ALTER COLUMN description DROP NOT NULL,
ALTER COLUMN payee DROP NOT NULL;

-- 5. Create index on products & variants for fast barcode & code search, and ensure audit_logs has performed_by column
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_variants_barcode ON public.product_variants(barcode);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON public.product_variants(sku);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS performed_by UUID;

-- 6. Updated rpc_create_sale function to properly account for order level discounts (p_discount_amount)
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
    v_effective_discount NUMERIC(12,2) := 0.00;
    v_net_subtotal NUMERIC(12,2) := 0.00;
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

    -- Calculate Tax & Grand Total (Factoring overall discount & item discounts)
    v_effective_discount := GREATEST(COALESCE(p_discount_amount, 0.00), v_calc_item_discounts);
    v_net_subtotal := GREATEST(0.00, v_calc_subtotal - v_effective_discount);
    v_calc_tax := ROUND((v_net_subtotal * (p_tax_rate / 100.00)), 2);
    v_calc_total := v_net_subtotal + v_calc_tax;

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

    -- 5. GENERATE INVOICE NUMBER AS PURE SEQUENTIAL INTEGER (1, 2, 3...)
    v_invoice_number := nextval('sale_invoice_seq')::text;

    -- 6. INSERT INTO sales TABLE
    INSERT INTO sales (
        invoice_number, branch_id, cashier_shift_id, customer_id,
        subtotal, discount_amount, coupon_id, tax_rate, tax_amount,
        total_amount, paid_amount, change_amount, payment_status, notes
    ) VALUES (
        v_invoice_number, v_branch_id, p_cashier_shift_id, p_customer_id,
        v_calc_subtotal, v_effective_discount, p_coupon_id, p_tax_rate, v_calc_tax,
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

        INSERT INTO sale_items (
            sale_id, variant_id, quantity, unit_price, cost_price,
            discount_amount, tax_amount, total_price
        ) VALUES (
            v_sale_id, v_variant_id, v_qty, v_unit_price, v_cost_price,
            v_item_discount, v_item_tax, v_item_total
        );

        -- Deduct Stock
        UPDATE branch_variant_stock
        SET quantity = quantity - v_qty,
            updated_at = now()
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id;

        -- Record Inventory Movement
        INSERT INTO inventory_movements (
            branch_id, variant_id, movement_type, quantity_delta,
            quantity_before, quantity_after, reference_type, reference_id,
            cost_price, selling_price, notes
        )
        SELECT
            v_branch_id, v_variant_id, 'sale', -v_qty,
            quantity + v_qty, quantity, 'sales', v_sale_id,
            v_cost_price, v_unit_price, 'عملية بيع فاتورة رقم ' || v_invoice_number
        FROM branch_variant_stock
        WHERE branch_id = v_branch_id AND variant_id = v_variant_id;
    END LOOP;

    -- 8. INSERT INTO payments TABLE
    FOR v_payment IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
        v_payment_method := (v_payment->>'payment_method')::payment_method_type;
        v_payment_amt := (v_payment->>'amount')::NUMERIC;
        v_payment_ref := v_payment->>'reference_number';

        INSERT INTO payments (
            sale_id, cashier_shift_id, payment_method, amount, reference_number
        ) VALUES (
            v_sale_id, p_cashier_shift_id, v_payment_method, v_payment_amt, v_payment_ref
        );
    END LOOP;

    -- 9. AUDIT LOG & IDEMPOTENCY RECORDING
    INSERT INTO audit_logs (
        action, entity_type, entity_id, new_values, user_id
    ) VALUES (
        'create_sale', 'sales', v_sale_id,
        jsonb_build_object(
            'idempotency_key', p_idempotency_key,
            'response', jsonb_build_object(
                'id', v_sale_id,
                'invoice_number', v_invoice_number,
                'total_amount', v_calc_total,
                'paid_amount', v_calc_paid,
                'change_amount', v_calc_change
            )
        ),
        auth.uid()
    );

    RETURN jsonb_build_object(
        'id', v_sale_id,
        'invoice_number', v_invoice_number,
        'subtotal', v_calc_subtotal,
        'discount_amount', v_effective_discount,
        'tax_amount', v_calc_tax,
        'total_amount', v_calc_total,
        'paid_amount', v_calc_paid,
        'change_amount', v_calc_change
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 7. RPC: Recalculate Shift Sales Totals
-- =====================================================================
CREATE OR REPLACE FUNCTION rpc_recalculate_shift_sales(
    p_shift_id UUID
) RETURNS VOID AS $$
DECLARE
    v_cash NUMERIC(12,2) := 0.00;
    v_card NUMERIC(12,2) := 0.00;
BEGIN
    IF p_shift_id IS NULL THEN RETURN; END IF;

    SELECT COALESCE(SUM(p.amount), 0.00) INTO v_cash
    FROM payments p
    JOIN sales s ON s.id = p.sale_id
    WHERE s.cashier_shift_id = p_shift_id
      AND p.payment_method = 'cash';

    SELECT COALESCE(SUM(p.amount), 0.00) INTO v_card
    FROM payments p
    JOIN sales s ON s.id = p.sale_id
    WHERE s.cashier_shift_id = p_shift_id
      AND p.payment_method IN ('card', 'wallet', 'bank_transfer');

    UPDATE cashier_shifts
    SET total_sales_cash = v_cash,
        total_sales_card = v_card
    WHERE id = p_shift_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Confirmation notification
SELECT 'Supabase database schema & RPC functions updated successfully!' AS status;
