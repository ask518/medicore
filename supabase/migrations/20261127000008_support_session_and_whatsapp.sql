-- ============================================================================
-- MEDICORE – Audited Platform Support Sessions (All Active Facilities)
-- & Patient WhatsApp / Call Notifications Log
-- ============================================================================

-- 1. Allow super_admin to enter an audited 15-minute support workspace for any
-- active organization (test or live), while keeping every action attributed to
-- the authenticated super_admin in audit_logs and platform_support_sessions.
CREATE OR REPLACE FUNCTION public.platform_start_support_session(p_organization_id UUID)
RETURNS TABLE(session_id UUID, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_org_status TEXT;
  v_session_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_actor_name TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'An active platform super admin is required' USING ERRCODE = '42501';
  END IF;

  SELECT o.status::TEXT INTO v_org_status
  FROM public.organizations o WHERE o.id = p_organization_id;
  IF v_org_status IS NULL OR v_org_status <> 'active' THEN
    RAISE EXCEPTION 'Support entry requires an active organization' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.platform_support_sessions (organization_id, platform_user_id)
  VALUES (p_organization_id, v_actor)
  RETURNING id, platform_support_sessions.expires_at INTO v_session_id, v_expires_at;

  SELECT COALESCE(u.name_en, u.email) INTO v_actor_name FROM public.users u WHERE u.id = v_actor;
  INSERT INTO public.audit_logs (organization_id, user_id, user_name, action, entity_type, entity_id, new_values)
  VALUES (
    p_organization_id, v_actor, v_actor_name, 'PLATFORM_SUPPORT_START',
    'platform_support_session', v_session_id::TEXT,
    jsonb_build_object('expires_at', v_expires_at, 'actor_role', 'super_admin')
  );

  RETURN QUERY SELECT v_session_id, v_expires_at;
END;
$$;

-- Helper: check whether current super_admin has an active, unexpired support session for p_org_id
CREATE OR REPLACE FUNCTION public.has_active_support_session(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_support_sessions s
    WHERE s.platform_user_id = auth.uid()
      AND s.organization_id = p_org_id
      AND s.ended_at IS NULL
      AND s.expires_at > NOW()
  );
$$;

-- 2. Allow super_admin during an active support session to manage appointments
CREATE OR REPLACE FUNCTION public.validate_appointment_scope()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_doctor_user_id UUID;
  v_actor_role TEXT;
BEGIN
  SELECT u.role::TEXT INTO v_actor_role FROM public.users u WHERE u.id = auth.uid() AND u.is_active;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'New appointments must begin pending or confirmed'; END IF;
  ELSE
    IF OLD.status IN ('completed', 'cancelled', 'no_show') THEN RAISE EXCEPTION 'A closed appointment cannot be changed'; END IF;
    IF ROW(NEW.organization_id, NEW.branch_id, NEW.doctor_id, NEW.patient_id, NEW.appointment_number, NEW.appointment_date, NEW.start_time, NEW.end_time, NEW.type)
       IS DISTINCT FROM ROW(OLD.organization_id, OLD.branch_id, OLD.doctor_id, OLD.patient_id, OLD.appointment_number, OLD.appointment_date, OLD.start_time, OLD.end_time, OLD.type) THEN
      RAISE EXCEPTION 'Appointment identity and schedule cannot be edited';
    END IF;
    IF v_actor_role NOT IN ('super_admin', 'org_owner', 'general_manager') AND NOT (
      (OLD.status = 'pending' AND NEW.status IN ('confirmed', 'cancelled')) OR
      (OLD.status = 'confirmed' AND NEW.status IN ('checked_in', 'cancelled', 'no_show')) OR
      (OLD.status = 'checked_in' AND NEW.status IN ('waiting', 'in_consultation', 'cancelled', 'no_show')) OR
      (OLD.status = 'waiting' AND NEW.status IN ('in_consultation', 'cancelled', 'no_show')) OR
      (OLD.status = 'in_consultation' AND NEW.status = 'completed') OR NEW.status = OLD.status
    ) THEN RAISE EXCEPTION 'Invalid appointment status transition'; END IF;
    NEW.created_by := OLD.created_by;
    NEW.updated_at := NOW();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id AND b.organization_id = NEW.organization_id AND b.is_active
  ) THEN
    RAISE EXCEPTION 'Appointment branch is not active in this organization';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id AND p.organization_id = NEW.organization_id AND p.is_active
  ) THEN
    RAISE EXCEPTION 'Appointment patient is not active in this organization';
  END IF;
  SELECT d.user_id INTO v_doctor_user_id
  FROM public.doctors d
  JOIN public.users u ON u.id = d.user_id AND u.is_active
  WHERE d.id = NEW.doctor_id AND d.organization_id = NEW.organization_id AND d.is_active;
  IF v_doctor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_branch_access uba
    WHERE uba.user_id = v_doctor_user_id AND uba.branch_id = NEW.branch_id
      AND uba.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Doctor is not active or assigned to this appointment branch';
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END;
$$;

-- 3. Update billing RPCs to support active super_admin support sessions safely
CREATE OR REPLACE FUNCTION public.create_invoice(
  p_branch_id UUID,
  p_patient_id UUID,
  p_service_id UUID,
  p_quantity INTEGER DEFAULT 1,
  p_discount NUMERIC DEFAULT 0,
  p_doctor_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (invoice_id UUID, invoice_number TEXT)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_target_org UUID;
  v_service public.services%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_invoice UUID := gen_random_uuid();
  v_number TEXT := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
  v_subtotal NUMERIC;
  v_doctor_user_id UUID;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive user'; END IF;
  SELECT b.organization_id INTO v_target_org FROM public.branches b WHERE b.id = p_branch_id AND b.is_active;
  IF v_target_org IS NULL THEN RAISE EXCEPTION 'Branch not found'; END IF;

  IF v_user.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_target_org) THEN
      RAISE EXCEPTION 'Active support session required for super admin billing';
    END IF;
  ELSIF v_user.organization_id IS DISTINCT FROM v_target_org OR v_user.role NOT IN ('org_owner', 'general_manager', 'accountant', 'receptionist') THEN
    RAISE EXCEPTION 'Insufficient billing permissions';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 100 THEN RAISE EXCEPTION 'Invalid invoice quantity'; END IF;
  IF NOT public.user_has_branch_access(p_branch_id) THEN RAISE EXCEPTION 'No access to invoice branch'; END IF;
  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id AND organization_id = v_target_org AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Patient is unavailable'; END IF;
  SELECT * INTO v_service FROM public.services WHERE id = p_service_id AND organization_id = v_target_org AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service is unavailable'; END IF;
  IF p_doctor_id IS NOT NULL THEN
    SELECT d.user_id INTO v_doctor_user_id FROM public.doctors d JOIN public.users u ON u.id = d.user_id AND u.is_active
    WHERE d.id = p_doctor_id AND d.organization_id = v_target_org AND d.is_active;
    IF v_doctor_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_branch_access uba WHERE uba.user_id = v_doctor_user_id AND uba.branch_id = p_branch_id AND uba.organization_id = v_target_org) THEN RAISE EXCEPTION 'Doctor is not assigned to this branch'; END IF;
  END IF;
  v_subtotal := v_service.standard_price * p_quantity;
  IF p_discount IS NULL OR p_discount < 0 OR p_discount > v_subtotal THEN RAISE EXCEPTION 'Invalid discount'; END IF;

  INSERT INTO public.invoices (id, organization_id, branch_id, patient_id, doctor_id, invoice_number, issue_date, subtotal, discount_amount, total_amount, paid_amount, balance_due, status, notes, created_by)
  VALUES (v_invoice, v_target_org, p_branch_id, p_patient_id, p_doctor_id, v_number, CURRENT_DATE, v_subtotal, p_discount, GREATEST(0, v_subtotal - p_discount), 0, GREATEST(0, v_subtotal - p_discount), CASE WHEN v_subtotal = p_discount THEN 'paid'::public.invoice_status ELSE 'unpaid'::public.invoice_status END, p_notes, auth.uid());
  INSERT INTO public.invoice_items (organization_id, invoice_id, service_id, description, quantity, unit_price, discount, total_price)
  VALUES (v_target_org, v_invoice, v_service.id, v_service.name_en, p_quantity, v_service.standard_price, p_discount, v_subtotal);
  RETURN QUERY SELECT v_invoice, v_number;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_payment_mode TEXT,
  p_cashbox_id UUID DEFAULT NULL,
  p_transaction_reference TEXT DEFAULT NULL
)
RETURNS TABLE (payment_id UUID, receipt_number TEXT)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_invoice public.invoices%ROWTYPE;
  v_cashbox public.cashboxes%ROWTYPE;
  v_payment UUID := gen_random_uuid();
  v_receipt TEXT := 'RCP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive user'; END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice is unavailable'; END IF;

  IF v_user.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_invoice.organization_id) THEN
      RAISE EXCEPTION 'Active support session required for super admin payment';
    END IF;
  ELSIF v_user.organization_id IS DISTINCT FROM v_invoice.organization_id OR v_user.role NOT IN ('org_owner', 'general_manager', 'accountant', 'receptionist') THEN
    RAISE EXCEPTION 'Insufficient billing permissions';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 OR p_payment_mode NOT IN ('cash','credit_card','bank_transfer','insurance','vodafone_cash','fawry') THEN RAISE EXCEPTION 'Invalid payment details'; END IF;
  IF p_cashbox_id IS NULL THEN RAISE EXCEPTION 'Select a cashbox for this payment'; END IF;
  IF NOT public.user_has_branch_access(v_invoice.branch_id) THEN RAISE EXCEPTION 'Invoice branch unavailable'; END IF;
  IF p_amount > v_invoice.balance_due THEN RAISE EXCEPTION 'Payment exceeds the invoice balance'; END IF;
  SELECT * INTO v_cashbox FROM public.cashboxes WHERE id = p_cashbox_id AND organization_id = v_invoice.organization_id AND branch_id = v_invoice.branch_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cashbox is unavailable for this branch'; END IF;

  INSERT INTO public.payments (id, organization_id, branch_id, invoice_id, patient_id, cashbox_id, receipt_number, payment_date, amount, payment_mode, transaction_reference, received_by)
  VALUES (v_payment, v_invoice.organization_id, v_invoice.branch_id, v_invoice.id, v_invoice.patient_id, p_cashbox_id, v_receipt, NOW(), p_amount, p_payment_mode::public.payment_mode, NULLIF(BTRIM(p_transaction_reference), ''), auth.uid());
  RETURN QUERY SELECT v_payment, v_receipt;
END;
$$;

-- 4. Patient Communication & WhatsApp Notifications Log
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL CHECK (channel IN ('whatsapp', 'call', 'sms', 'email')),
  template_key VARCHAR(80),
  recipient_phone VARCHAR(50) NOT NULL,
  message_body TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'dispatched' CHECK (status IN ('queued', 'dispatched', 'sent', 'failed')),
  external_message_id VARCHAR(150),
  sent_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org_patient ON public.notifications(organization_id, patient_id, created_at DESC);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation on notifications" ON public.notifications;
CREATE POLICY "Tenant isolation on notifications"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse', 'receptionist'])
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse', 'receptionist'])
    )
  );

REVOKE ALL ON FUNCTION public.has_active_support_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_active_support_session(UUID) TO authenticated;
GRANT SELECT, INSERT ON public.notifications TO authenticated;
