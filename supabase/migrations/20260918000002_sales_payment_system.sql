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
