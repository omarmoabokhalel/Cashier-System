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
