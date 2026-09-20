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
