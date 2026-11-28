-- ============================================================================
-- MEDICORE – Automatic Doctor Commission Generation & Audit Trail
-- Automatically creates doctor_commissions rows on valid non-reversal payments
-- when the linked invoice references an active doctor with commission_rate > 0.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_doctor_commission_on_payment()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doctor_id UUID;
  v_rate NUMERIC;
  v_commission NUMERIC;
BEGIN
  IF NEW.is_reversal THEN
    RETURN NEW;
  END IF;

  SELECT i.doctor_id INTO v_doctor_id
  FROM public.invoices i
  WHERE i.id = NEW.invoice_id;

  IF v_doctor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT d.commission_rate INTO v_rate
  FROM public.doctors d
  WHERE d.id = v_doctor_id AND d.organization_id = NEW.organization_id AND d.is_active = true;

  IF v_rate IS NULL OR v_rate <= 0 THEN
    RETURN NEW;
  END IF;

  v_commission := ROUND(NEW.amount * (v_rate / 100.0), 2);
  IF v_commission <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.doctor_commissions (
    organization_id, branch_id, doctor_id, invoice_id, payment_id,
    amount, commission_date, is_settled
  ) VALUES (
    NEW.organization_id, NEW.branch_id, v_doctor_id, NEW.invoice_id, NEW.id,
    v_commission, COALESCE(NEW.payment_date::DATE, CURRENT_DATE), false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_doctor_commission_on_payment ON public.payments;
CREATE TRIGGER trg_record_doctor_commission_on_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.record_doctor_commission_on_payment();

DROP TRIGGER IF EXISTS trg_audit_doctor_commissions ON public.doctor_commissions;
CREATE TRIGGER trg_audit_doctor_commissions
  AFTER INSERT OR UPDATE OR DELETE ON public.doctor_commissions
  FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();
