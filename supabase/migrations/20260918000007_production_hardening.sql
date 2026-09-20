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
