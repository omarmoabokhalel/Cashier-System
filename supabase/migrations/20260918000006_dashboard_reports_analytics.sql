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
