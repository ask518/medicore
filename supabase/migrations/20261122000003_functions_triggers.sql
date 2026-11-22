-- ============================================================================
-- MEDICORE HEALTHCARE PLATFORM – DATABASE SCHEMA MIGRATION 03
-- Triggers, Automatic Balancing, Audit Logging & Integrity Functions
-- ============================================================================

-- ============================================================================
-- 1. AUTOMATIC INVOICE TOTAL & BALANCE RECALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_invoice_financials() RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID;
    v_subtotal DECIMAL(12, 2);
    v_total_paid DECIMAL(12, 2);
    v_discount DECIMAL(12, 2);
    v_tax DECIMAL(12, 2);
    v_net DECIMAL(12, 2);
    v_balance DECIMAL(12, 2);
    v_new_status invoice_status;
BEGIN
    IF (TG_TABLE_NAME = 'invoice_items') THEN
        v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
    ELSIF (TG_TABLE_NAME = 'payments') THEN
        v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
    ELSE
        v_invoice_id := NEW.id;
    END IF;

    -- Calculate subtotal from line items
    SELECT COALESCE(SUM(total_price), 0.00) INTO v_subtotal
    FROM invoice_items WHERE invoice_id = v_invoice_id;

    -- Calculate total paid from non-reversed payments
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid
    FROM payments WHERE invoice_id = v_invoice_id AND is_reversal = false;

    -- Fetch invoice discount and tax
    SELECT discount_amount, tax_amount INTO v_discount, v_tax
    FROM invoices WHERE id = v_invoice_id;

    v_net := GREATEST(0.00, v_subtotal - COALESCE(v_discount, 0.00) + COALESCE(v_tax, 0.00));
    v_balance := GREATEST(0.00, v_net - v_total_paid);

    IF v_net = 0.00 AND v_total_paid = 0.00 THEN
        v_new_status := 'draft';
    ELSIF v_balance = 0.00 AND v_total_paid > 0.00 THEN
        v_new_status := 'paid';
    ELSIF v_total_paid > 0.00 AND v_balance > 0.00 THEN
        v_new_status := 'partially_paid';
    ELSE
        v_new_status := 'unpaid';
    END IF;

    UPDATE invoices
    SET subtotal = v_subtotal,
        total_amount = v_net,
        paid_amount = v_total_paid,
        balance_due = v_balance,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_items_financials
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION update_invoice_financials();

CREATE TRIGGER trg_payments_financials
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION update_invoice_financials();

-- ============================================================================
-- 2. CASHBOX BALANCE UPDATE ON PAYMENT OR EXPENSE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cashbox_balance() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_TABLE_NAME = 'payments') THEN
        IF (NEW.cashbox_id IS NOT NULL) THEN
            IF (NEW.is_reversal) THEN
                UPDATE cashboxes SET current_balance = current_balance - NEW.amount WHERE id = NEW.cashbox_id;
            ELSE
                UPDATE cashboxes SET current_balance = current_balance + NEW.amount WHERE id = NEW.cashbox_id;
            END IF;
        END IF;
    ELSIF (TG_TABLE_NAME = 'expenses') THEN
        IF (NEW.cashbox_id IS NOT NULL) THEN
            UPDATE cashboxes SET current_balance = current_balance - NEW.amount WHERE id = NEW.cashbox_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_cashbox_update
AFTER INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION update_cashbox_balance();

CREATE TRIGGER trg_expense_cashbox_update
AFTER INSERT ON expenses
FOR EACH ROW EXECUTE FUNCTION update_cashbox_balance();

-- ============================================================================
-- 3. AUDIT TRAIL LOGGING TRIGGER FOR CLINICAL & FINANCIAL RECORDS
-- ============================================================================

CREATE OR REPLACE FUNCTION log_record_audit() RETURNS TRIGGER AS $$
DECLARE
    v_action VARCHAR(50);
    v_org_id UUID;
    v_user_id UUID;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        v_action := 'CREATE';
        v_org_id := NEW.organization_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'UPDATE';
        v_org_id := NEW.organization_id;
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE';
        v_org_id := OLD.organization_id;
    END IF;

    v_user_id := auth_uid();

    INSERT INTO audit_logs (
        organization_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        created_at
    ) VALUES (
        v_org_id,
        v_user_id,
        v_action,
        TG_TABLE_NAME,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        NOW()
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_patients AFTER INSERT OR UPDATE OR DELETE ON patients
FOR EACH ROW EXECUTE FUNCTION log_record_audit();

CREATE TRIGGER trg_audit_consultations AFTER INSERT OR UPDATE OR DELETE ON consultations
FOR EACH ROW EXECUTE FUNCTION log_record_audit();

CREATE TRIGGER trg_audit_prescriptions AFTER INSERT OR UPDATE OR DELETE ON prescriptions
FOR EACH ROW EXECUTE FUNCTION log_record_audit();

CREATE TRIGGER trg_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION log_record_audit();

CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION log_record_audit();
