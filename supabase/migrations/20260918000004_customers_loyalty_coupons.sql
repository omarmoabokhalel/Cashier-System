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
