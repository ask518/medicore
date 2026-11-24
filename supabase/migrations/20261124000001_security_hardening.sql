-- Security hardening for production authentication and tenant data access.
-- Existing authenticated users keep their profiles; new signups receive an
-- inactive, unassigned profile until secure onboarding or staff invitation completes.

CREATE OR REPLACE FUNCTION public.current_user_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.organization_id
  FROM public.users AS u
  WHERE u.id = auth.uid() AND u.is_active
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_uid()
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_platform_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS u
    WHERE u.id = auth.uid() AND u.role = 'super_admin' AND u.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.role::TEXT
  FROM public.users AS u
  WHERE u.id = auth.uid() AND u.is_active
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_super_admin()
    OR COALESCE(public.current_user_role() = ANY(allowed_roles), false);
$$;

CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.users AS u
      LEFT JOIN public.user_branch_access AS uba
        ON uba.user_id = u.id AND uba.branch_id = p_branch_id
      WHERE u.id = auth.uid()
        AND u.is_active
        AND u.organization_id = (
          SELECT b.organization_id FROM public.branches AS b WHERE b.id = p_branch_id
        )
        AND (u.role IN ('org_owner', 'general_manager') OR uba.user_id IS NOT NULL)
    );
$$;

-- A profile is created by a trusted database trigger, never by a client role field.
CREATE OR REPLACE FUNCTION public.create_user_profile_for_auth_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.users (
    id, email, name_ar, name_en, role, is_active, created_at, updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name_ar', ''), 'مستخدم جديد'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name_en', ''), NULLIF(NEW.raw_user_meta_data->>'name_ar', ''), 'New user'),
    'patient',
    false,
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Safe self-service onboarding: a newly verified account may create exactly
-- one tenant, and the database assigns all ownership and tenant identifiers.
CREATE OR REPLACE FUNCTION public.create_initial_organization(
  p_name_ar TEXT,
  p_name_en TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_city TEXT,
  p_address TEXT,
  p_facility_type TEXT DEFAULT 'private_clinic'
)
RETURNS TABLE (organization_id UUID, branch_id UUID)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_org_id UUID;
  v_branch_id UUID;
  v_plan_id UUID;
  v_plan_amount NUMERIC;
  v_plan_currency TEXT;
  v_slug TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR v_user.role <> 'patient' OR v_user.organization_id IS NOT NULL THEN
    RAISE EXCEPTION 'This account is not eligible to create a new organization';
  END IF;
  IF NULLIF(BTRIM(p_name_ar), '') IS NULL OR NULLIF(BTRIM(p_name_en), '') IS NULL
     OR NULLIF(BTRIM(p_email), '') IS NULL OR NULLIF(BTRIM(p_phone), '') IS NULL
     OR NULLIF(BTRIM(p_city), '') IS NULL OR NULLIF(BTRIM(p_address), '') IS NULL THEN
    RAISE EXCEPTION 'All organization and main branch fields are required';
  END IF;
  IF p_facility_type NOT IN ('private_clinic', 'poly_clinic', 'medical_center', 'specialized_center', 'complex', 'hospital') THEN
    RAISE EXCEPTION 'Unsupported facility type';
  END IF;

  SELECT id, price_monthly, currency INTO v_plan_id, v_plan_amount, v_plan_currency
  FROM public.subscription_plans WHERE slug = 'starter' AND is_active LIMIT 1;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Starter subscription plan is not configured';
  END IF;

  v_org_id := gen_random_uuid();
  v_branch_id := gen_random_uuid();
  v_slug := 'clinic-' || REPLACE(v_org_id::TEXT, '-', '');

  INSERT INTO public.organizations (
    id, name_ar, name_en, slug, facility_type, status, email, phone, country,
    city, address, timezone, default_currency
  ) VALUES (
    v_org_id, BTRIM(p_name_ar), BTRIM(p_name_en), v_slug, p_facility_type::public.facility_type,
    'active', LOWER(BTRIM(p_email)), BTRIM(p_phone), 'Egypt', BTRIM(p_city),
    BTRIM(p_address), 'Africa/Cairo', COALESCE(v_plan_currency, 'EGP')
  );

  INSERT INTO public.branches (
    id, organization_id, name_ar, name_en, code, phone, email, address, city, is_main_branch
  ) VALUES (
    v_branch_id, v_org_id, BTRIM(p_name_ar), BTRIM(p_name_en), 'MAIN', BTRIM(p_phone),
    LOWER(BTRIM(p_email)), BTRIM(p_address), BTRIM(p_city), true
  );

  INSERT INTO public.cashboxes (organization_id, branch_id, name, current_balance, assigned_user_id)
  VALUES (v_org_id, v_branch_id, 'الخزينة الرئيسية', 0, auth.uid());
  INSERT INTO public.subscriptions (
    organization_id, plan_id, status, cycle, amount, currency, trial_ends_at
  ) VALUES (
    v_org_id, v_plan_id, 'trialing', 'monthly', v_plan_amount, v_plan_currency, NOW() + INTERVAL '14 days'
  );

  UPDATE public.users
  SET organization_id = v_org_id, primary_branch_id = v_branch_id,
      role = 'org_owner', is_active = true, updated_at = NOW()
  WHERE id = auth.uid();

  RETURN QUERY SELECT v_org_id, v_branch_id;
END;
$$;

-- Price-authoritative invoice creation. The browser supplies identifiers and
-- quantity; the database reads the current service price and writes the
-- invoice and its line item in one transaction.
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
  v_service public.services%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_invoice UUID := gen_random_uuid();
  v_number TEXT := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
  v_subtotal NUMERIC;
  v_doctor_user_id UUID;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND OR v_user.role NOT IN ('org_owner', 'general_manager', 'accountant', 'receptionist') THEN RAISE EXCEPTION 'Insufficient billing permissions'; END IF;
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 100 THEN RAISE EXCEPTION 'Invalid invoice quantity'; END IF;
  IF NOT public.user_has_branch_access(p_branch_id) THEN RAISE EXCEPTION 'No access to invoice branch'; END IF;
  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id AND organization_id = v_user.organization_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Patient is unavailable'; END IF;
  SELECT * INTO v_service FROM public.services WHERE id = p_service_id AND organization_id = v_user.organization_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Service is unavailable'; END IF;
  IF p_doctor_id IS NOT NULL THEN
    SELECT d.user_id INTO v_doctor_user_id FROM public.doctors d JOIN public.users u ON u.id = d.user_id AND u.is_active
    WHERE d.id = p_doctor_id AND d.organization_id = v_user.organization_id AND d.is_active;
    IF v_doctor_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_branch_access uba WHERE uba.user_id = v_doctor_user_id AND uba.branch_id = p_branch_id AND uba.organization_id = v_user.organization_id) THEN RAISE EXCEPTION 'Doctor is not assigned to this branch'; END IF;
  END IF;
  v_subtotal := v_service.standard_price * p_quantity;
  IF p_discount IS NULL OR p_discount < 0 OR p_discount > v_subtotal THEN RAISE EXCEPTION 'Invalid discount'; END IF;

  INSERT INTO public.invoices (id, organization_id, branch_id, patient_id, doctor_id, invoice_number, issue_date, subtotal, discount_amount, total_amount, paid_amount, balance_due, status, notes, created_by)
  VALUES (v_invoice, v_user.organization_id, p_branch_id, p_patient_id, p_doctor_id, v_number, CURRENT_DATE, v_subtotal, p_discount, GREATEST(0, v_subtotal - p_discount), 0, GREATEST(0, v_subtotal - p_discount), CASE WHEN v_subtotal = p_discount THEN 'paid'::public.invoice_status ELSE 'unpaid'::public.invoice_status END, p_notes, auth.uid());
  INSERT INTO public.invoice_items (organization_id, invoice_id, service_id, description, quantity, unit_price, discount, total_price)
  VALUES (v_user.organization_id, v_invoice, v_service.id, v_service.name_en, p_quantity, v_service.standard_price, p_discount, v_subtotal);
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
  IF NOT FOUND OR v_user.role NOT IN ('org_owner', 'general_manager', 'accountant', 'receptionist') THEN RAISE EXCEPTION 'Insufficient billing permissions'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_payment_mode NOT IN ('cash','credit_card','bank_transfer','insurance','vodafone_cash','fawry') THEN RAISE EXCEPTION 'Invalid payment details'; END IF;
  IF p_cashbox_id IS NULL THEN RAISE EXCEPTION 'Select a cashbox for this payment'; END IF;
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id AND organization_id = v_user.organization_id FOR UPDATE;
  IF NOT FOUND OR NOT public.user_has_branch_access(v_invoice.branch_id) THEN RAISE EXCEPTION 'Invoice is unavailable'; END IF;
  IF p_amount > v_invoice.balance_due THEN RAISE EXCEPTION 'Payment exceeds the invoice balance'; END IF;
  IF p_cashbox_id IS NOT NULL THEN
    SELECT * INTO v_cashbox FROM public.cashboxes WHERE id = p_cashbox_id AND organization_id = v_user.organization_id AND branch_id = v_invoice.branch_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cashbox is unavailable for this branch'; END IF;
  END IF;
  INSERT INTO public.payments (id, organization_id, branch_id, invoice_id, patient_id, cashbox_id, receipt_number, payment_date, amount, payment_mode, transaction_reference, received_by)
  VALUES (v_payment, v_user.organization_id, v_invoice.branch_id, v_invoice.id, v_invoice.patient_id, p_cashbox_id, v_receipt, NOW(), p_amount, p_payment_mode::public.payment_mode, NULLIF(BTRIM(p_transaction_reference), ''), auth.uid());
  RETURN QUERY SELECT v_payment, v_receipt;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_service(
  p_code TEXT, p_name_ar TEXT, p_name_en TEXT, p_category TEXT, p_price NUMERIC, p_cost NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_service_id UUID;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND OR v_user.role NOT IN ('org_owner', 'general_manager') THEN RAISE EXCEPTION 'Only facility managers may change the service catalog'; END IF;
  IF NULLIF(BTRIM(p_code), '') IS NULL OR NULLIF(BTRIM(p_name_ar), '') IS NULL OR NULLIF(BTRIM(p_name_en), '') IS NULL OR NULLIF(BTRIM(p_category), '') IS NULL OR p_price < 0 OR p_cost < 0 OR p_cost > p_price THEN RAISE EXCEPTION 'Invalid service details'; END IF;
  INSERT INTO public.services (organization_id, code, name_ar, name_en, category, standard_price, cost, is_active)
  VALUES (v_user.organization_id, UPPER(BTRIM(p_code)), BTRIM(p_name_ar), BTRIM(p_name_en), BTRIM(p_category), p_price, p_cost, true)
  ON CONFLICT (organization_id, code) DO UPDATE SET name_ar = EXCLUDED.name_ar, name_en = EXCLUDED.name_en, category = EXCLUDED.category, standard_price = EXCLUDED.standard_price, cost = EXCLUDED.cost, is_active = true
  RETURNING id INTO v_service_id;
  RETURN v_service_id;
END;
$$;

-- Issue prescriptions only against an already signed consultation. The
-- browser cannot forge the doctor, patient, branch, or prescription number.
CREATE OR REPLACE FUNCTION public.issue_prescription(
  p_consultation_id UUID,
  p_items JSONB,
  p_diagnosis_summary TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (prescription_id UUID, prescription_number TEXT)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_consultation public.consultations%ROWTYPE;
  v_prescription UUID := gen_random_uuid();
  v_number TEXT := 'RX-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
  v_item JSONB;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND OR v_user.role NOT IN ('org_owner', 'general_manager', 'doctor', 'assistant_doctor') THEN
    RAISE EXCEPTION 'Insufficient clinical permissions';
  END IF;
  SELECT * INTO v_consultation FROM public.consultations
  WHERE id = p_consultation_id AND organization_id = v_user.organization_id AND status = 'finalized';
  IF NOT FOUND OR NOT public.user_has_branch_access(v_consultation.branch_id) THEN
    RAISE EXCEPTION 'Signed consultation is unavailable';
  END IF;
  IF v_user.role IN ('doctor', 'assistant_doctor') AND NOT EXISTS (
    SELECT 1 FROM public.doctors d WHERE d.id = v_consultation.doctor_id AND d.user_id = auth.uid()
  ) THEN RAISE EXCEPTION 'Clinicians may prescribe only for their own consultations'; END IF;
  IF COALESCE(jsonb_typeof(p_items), '') <> 'array' OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION 'A prescription must contain between 1 and 30 items';
  END IF;
  INSERT INTO public.prescriptions (id, organization_id, branch_id, consultation_id, patient_id, doctor_id, prescription_number, issued_date, diagnosis_summary, notes)
  VALUES (v_prescription, v_user.organization_id, v_consultation.branch_id, v_consultation.id, v_consultation.patient_id, v_consultation.doctor_id, v_number, CURRENT_DATE, NULLIF(BTRIM(p_diagnosis_summary), ''), NULLIF(BTRIM(p_notes), ''));
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(BTRIM(v_item->>'drug_name'), '') IS NULL OR NULLIF(BTRIM(v_item->>'dosage'), '') IS NULL
      OR NULLIF(BTRIM(v_item->>'frequency'), '') IS NULL OR NULLIF(BTRIM(v_item->>'duration'), '') IS NULL
      OR COALESCE((v_item->>'quantity')::INTEGER, 0) < 1 OR COALESCE((v_item->>'quantity')::INTEGER, 0) > 10000 THEN
      RAISE EXCEPTION 'Each prescription item needs a medication, dose, frequency, duration, and valid quantity';
    END IF;
    INSERT INTO public.prescription_items (organization_id, prescription_id, drug_name, dosage, frequency, duration, quantity, instructions)
    VALUES (v_user.organization_id, v_prescription, LEFT(BTRIM(v_item->>'drug_name'), 255), LEFT(BTRIM(v_item->>'dosage'), 100), LEFT(BTRIM(v_item->>'frequency'), 100), LEFT(BTRIM(v_item->>'duration'), 100), (v_item->>'quantity')::INTEGER, NULLIF(LEFT(BTRIM(v_item->>'instructions'), 2000), ''));
    v_count := v_count + 1;
  END LOOP;
  RETURN QUERY SELECT v_prescription, v_number;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS prescriptions_org_number_unique
  ON public.prescriptions (organization_id, prescription_number);

-- Keep appointment tenant, branch, doctor assignment, and patient references
-- consistent even when requests bypass the user interface.
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
    IF v_actor_role NOT IN ('org_owner', 'general_manager') AND NOT (
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

DROP TRIGGER IF EXISTS trg_validate_appointment_scope ON public.appointments;
CREATE TRIGGER trg_validate_appointment_scope
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_scope();

-- A finalized consultation is signed by the authenticated clinician and is
-- immutable through the browser API. Corrections must be recorded as a new,
-- explicitly linked amendment in a later workflow.
CREATE OR REPLACE FUNCTION public.validate_consultation_signature()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_doctor_user_id UUID;
  v_actor_role TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Signed consultations cannot be edited; create an amendment';
  END IF;
  IF NEW.status <> 'finalized' THEN
    RAISE EXCEPTION 'Consultations must be finalized when recorded';
  END IF;
  SELECT d.user_id INTO v_doctor_user_id
  FROM public.doctors d
  JOIN public.users u ON u.id = d.user_id AND u.is_active
  WHERE d.id = NEW.doctor_id AND d.organization_id = NEW.organization_id AND d.is_active;
  SELECT u.role::TEXT INTO v_actor_role FROM public.users u WHERE u.id = auth.uid() AND u.is_active;
  IF v_doctor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id AND p.organization_id = NEW.organization_id AND p.is_active
  ) OR NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id AND b.organization_id = NEW.organization_id AND b.is_active
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_branch_access uba
    WHERE uba.user_id = v_doctor_user_id AND uba.branch_id = NEW.branch_id AND uba.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Consultation patient, doctor, or branch is invalid';
  END IF;
  IF NOT (v_actor_role IN ('org_owner', 'general_manager') OR (v_actor_role IN ('doctor', 'assistant_doctor') AND v_doctor_user_id = auth.uid())) THEN
    RAISE EXCEPTION 'Only the treating doctor or facility manager can sign this consultation';
  END IF;
  NEW.signed_by := auth.uid();
  NEW.signed_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_consultation_signature ON public.consultations;
CREATE TRIGGER trg_validate_consultation_signature
  BEFORE INSERT OR UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.validate_consultation_signature();

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_profile_for_auth_user();

-- Audit triggers write immutable rows on behalf of the actor.
ALTER FUNCTION public.log_record_audit() SECURITY DEFINER;
ALTER FUNCTION public.log_record_audit() SET search_path = public;

-- Constrain clinical intake values at the database boundary as well as in the UI.
ALTER TABLE public.patient_allergies
  ADD CONSTRAINT patient_allergies_severity_valid
  CHECK (severity IN ('mild', 'moderate', 'severe', 'anaphylactic')) NOT VALID;
ALTER TABLE public.medical_histories
  ADD CONSTRAINT medical_histories_type_valid
  CHECK (condition_type IN ('chronic_disease', 'past_surgery', 'family_history', 'lifestyle')) NOT VALID;
ALTER TABLE public.medical_histories
  ADD CONSTRAINT medical_histories_onset_year_positive
  CHECK (onset_year IS NULL OR onset_year > 0) NOT VALID;

-- Authenticated users can read their own pending profile. Organization access
-- remains governed by the tenant policies below and requires an active profile.
DROP POLICY IF EXISTS users_read_own_profile ON public.users;
CREATE POLICY users_read_own_profile ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS tenant_isolation_select_audit_logs ON public.audit_logs;
CREATE POLICY tenant_isolation_select_audit_logs ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager'])
      AND (branch_id IS NULL OR public.user_has_branch_access(branch_id))
    )
  );

DROP POLICY IF EXISTS "Medications catalog manage" ON public.medications;
CREATE POLICY "Medications catalog manage" ON public.medications
  FOR ALL TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'pharmacist'])
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND organization_id IS NOT NULL
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'pharmacist'])
    )
  );

-- Remove the previous blanket write policies and replace them with role checks.
DO $$
DECLARE
  tbl TEXT;
  admin_tables TEXT[] := ARRAY[
    'branches', 'departments', 'examination_rooms', 'user_branch_access',
    'doctors', 'doctor_schedules', 'users', 'organization_settings',
    'subscriptions', 'subscription_events', 'insurance_companies',
    'laboratory_tests', 'inventory_items', 'inventory_movements', 'support_tickets'
  ];
  clinical_tables TEXT[] := ARRAY[
    'patients', 'patient_allergies', 'medical_histories', 'appointments',
    'consultations', 'anatomical_findings', 'prescriptions', 'prescription_items',
    'laboratory_orders', 'laboratory_results', 'radiology_orders', 'medical_attachments'
  ];
  financial_tables TEXT[] := ARRAY[
    'services', 'cashboxes', 'invoices', 'invoice_items', 'payments',
    'expenses', 'doctor_commissions', 'insurance_claims'
  ];
  tbl_role TEXT[];
  branch_column TEXT;
  branch_access TEXT;
  write_branch_access TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'branches', 'departments', 'examination_rooms', 'user_branch_access', 'doctors',
    'doctor_schedules', 'users', 'organization_settings', 'subscriptions',
    'subscription_events', 'insurance_companies', 'inventory_items', 'inventory_movements',
    'laboratory_tests', 'insurance_claims',
    'support_tickets', 'audit_logs', 'patients', 'patient_allergies', 'medical_histories',
    'appointments', 'consultations', 'anatomical_findings', 'prescriptions',
    'prescription_items', 'laboratory_orders', 'laboratory_results', 'radiology_orders',
    'medical_attachments', 'services', 'cashboxes', 'invoices', 'invoice_items',
    'payments', 'expenses', 'doctor_commissions'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_isolation_select_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_isolation_insert_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_isolation_update_' || tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'tenant_isolation_delete_' || tbl, tbl);

    IF tbl = ANY(admin_tables) THEN
      tbl_role := ARRAY['org_owner', 'general_manager'];
    ELSIF tbl IN ('patient_allergies', 'medical_histories') THEN
      tbl_role := ARRAY['org_owner', 'general_manager', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse'];
    ELSIF tbl = 'consultations' THEN
      tbl_role := ARRAY['org_owner', 'general_manager', 'doctor', 'assistant_doctor'];
    ELSIF tbl = ANY(clinical_tables) THEN
      tbl_role := ARRAY['org_owner', 'general_manager', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse', 'receptionist', 'lab_technician', 'radiology_technician', 'records_officer'];
    ELSIF tbl = ANY(financial_tables) THEN
      tbl_role := ARRAY['org_owner', 'general_manager', 'accountant', 'receptionist'];
    ELSE
      tbl_role := ARRAY['org_owner', 'general_manager'];
    END IF;

    branch_column := CASE
      WHEN tbl = 'branches' THEN 'id'
      WHEN tbl = 'patients' THEN 'primary_branch_id'
      WHEN tbl = ANY(ARRAY[
        'examination_rooms', 'user_branch_access', 'doctor_schedules', 'appointments',
        'consultations', 'prescriptions', 'laboratory_orders', 'radiology_orders',
        'cashboxes', 'invoices', 'payments', 'expenses', 'doctor_commissions',
        'insurance_claims', 'inventory_items', 'audit_logs'
      ]) THEN 'branch_id'
      ELSE NULL
    END;
    branch_access := CASE
      WHEN tbl = 'patients' THEN '(primary_branch_id IS NULL AND public.has_any_role(ARRAY[''org_owner'', ''general_manager''])) OR public.user_has_branch_access(primary_branch_id)'
      WHEN tbl = 'doctors' THEN format('EXISTS (SELECT 1 FROM public.user_branch_access uba WHERE uba.user_id = public.%I.user_id AND public.user_has_branch_access(uba.branch_id))', tbl)
      WHEN branch_column IS NOT NULL THEN format('public.user_has_branch_access(%I)', branch_column)
      WHEN tbl IN ('patient_allergies', 'medical_histories', 'anatomical_findings', 'medical_attachments') THEN format('EXISTS (SELECT 1 FROM public.patients p WHERE p.id = public.%I.patient_id AND public.user_has_branch_access(p.primary_branch_id))', tbl)
      WHEN tbl = 'prescription_items' THEN format('EXISTS (SELECT 1 FROM public.prescriptions p WHERE p.id = public.%I.prescription_id AND public.user_has_branch_access(p.branch_id))', tbl)
      WHEN tbl = 'laboratory_results' THEN format('EXISTS (SELECT 1 FROM public.laboratory_orders o WHERE o.id = public.%I.order_id AND public.user_has_branch_access(o.branch_id))', tbl)
      WHEN tbl = 'invoice_items' THEN format('EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = public.%I.invoice_id AND public.user_has_branch_access(i.branch_id))', tbl)
      WHEN tbl = 'inventory_movements' THEN format('EXISTS (SELECT 1 FROM public.inventory_items i WHERE i.id = public.%I.item_id AND public.user_has_branch_access(i.branch_id))', tbl)
      ELSE 'true'
    END;
    write_branch_access := CASE WHEN tbl = 'branches' THEN 'true' ELSE branch_access END;

    IF tbl = 'users' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(ARRAY[''org_owner'', ''general_manager''])))', 'tenant_isolation_select_' || tbl, tbl);
    ELSIF tbl = 'audit_logs' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(ARRAY[''org_owner'', ''general_manager'']) AND (%s)))', 'tenant_isolation_select_' || tbl, tbl, branch_access);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND (%s)))', 'tenant_isolation_select_' || tbl, tbl, branch_access);
    END IF;

    IF tbl IN ('subscriptions', 'subscription_events', 'audit_logs') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin())', 'tenant_isolation_insert_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_platform_super_admin()) WITH CHECK (public.is_platform_super_admin())', 'tenant_isolation_update_' || tbl, tbl);
    ELSIF tbl = 'users' THEN
      -- Staff identities and role changes are provisioned only by trusted
      -- server code; never allow client REST calls to forge auth profiles.
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin())', 'tenant_isolation_insert_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_platform_super_admin()) WITH CHECK (public.is_platform_super_admin())', 'tenant_isolation_update_' || tbl, tbl);
    ELSIF tbl IN ('invoices', 'invoice_items', 'payments', 'cashboxes') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin())', 'tenant_isolation_insert_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_platform_super_admin()) WITH CHECK (public.is_platform_super_admin())', 'tenant_isolation_update_' || tbl, tbl);
    ELSIF tbl = 'services' THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(ARRAY[''org_owner'', ''general_manager''])))', 'tenant_isolation_insert_' || tbl, tbl);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(ARRAY[''org_owner'', ''general_manager'']))) WITH CHECK (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(ARRAY[''org_owner'', ''general_manager''])))', 'tenant_isolation_update_' || tbl, tbl);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(%L::TEXT[]) AND (%s)))', 'tenant_isolation_insert_' || tbl, tbl, tbl_role, write_branch_access);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(%L::TEXT[]) AND (%s))) WITH CHECK (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(%L::TEXT[]) AND (%s)))', 'tenant_isolation_update_' || tbl, tbl, tbl_role, write_branch_access, tbl_role, write_branch_access);
    END IF;

    -- Medical and financial records are corrected through audited amendments,
    -- not hard-deleted through the browser API.
    IF tbl IN ('branches', 'users', 'doctors', 'patients', 'patient_allergies', 'medical_histories', 'appointments', 'consultations', 'anatomical_findings', 'prescriptions', 'prescription_items', 'laboratory_orders', 'laboratory_results', 'radiology_orders', 'medical_attachments', 'invoices', 'invoice_items', 'payments', 'expenses', 'doctor_commissions', 'insurance_claims', 'cashboxes', 'audit_logs', 'subscriptions', 'subscription_events') THEN
      -- Prevent browser deletes from cascading into staff, visit, or ledger data.
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (false)', 'tenant_isolation_delete_' || tbl, tbl);
    ELSE
      EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_platform_super_admin() OR (organization_id = public.current_user_organization_id() AND public.has_any_role(ARRAY[''org_owner'', ''general_manager'']) AND (%s)))', 'tenant_isolation_delete_' || tbl, tbl, write_branch_access);
    END IF;
  END LOOP;
END $$;

-- Preserve the branch with each audit event so branch access also constrains
-- the audit trail. Patient records use primary_branch_id; most other audited
-- tables carry branch_id directly.
CREATE OR REPLACE FUNCTION public.log_record_audit()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
DECLARE
  v_row JSONB;
  v_old JSONB;
  v_action TEXT;
  v_org_id UUID;
  v_branch_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'CREATE'; v_row := to_jsonb(NEW); v_org_id := NEW.organization_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE'; v_row := to_jsonb(NEW); v_old := to_jsonb(OLD); v_org_id := NEW.organization_id;
  ELSE
    v_action := 'DELETE'; v_row := to_jsonb(OLD); v_old := to_jsonb(OLD); v_org_id := OLD.organization_id;
  END IF;
  v_branch_id := COALESCE(NULLIF(v_row->>'branch_id', '')::UUID, NULLIF(v_row->>'primary_branch_id', '')::UUID);
  INSERT INTO public.audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, old_values, new_values, created_at)
  VALUES (v_org_id, v_branch_id, v_user_id, v_action, TG_TABLE_NAME, v_row->>'id', v_old, CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_row END, NOW());
  RETURN NULL;
END;
$$;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'patient_allergies', 'medical_histories', 'appointments', 'prescription_items',
    'laboratory_orders', 'laboratory_results', 'radiology_orders', 'invoice_items', 'expenses', 'services', 'cashboxes'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_record_audit()', tbl, tbl);
  END LOOP;
END $$;

-- No unauthenticated API access to application data. RLS remains the tenant boundary.
-- Prevent overlapping active appointments for the same doctor, including
-- different start times whose durations overlap. Resolve existing conflicts
-- before applying this constraint to a database that already has appointments.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_no_doctor_time_overlap
  EXCLUDE USING gist (
    doctor_id WITH =,
    tsrange(appointment_date + start_time, appointment_date + end_time, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'no_show'));

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
REVOKE UPDATE ON public.organizations FROM authenticated;
GRANT UPDATE (name_ar, name_en, email, phone, tax_number, commercial_reg_no, city, address, website, timezone, default_currency) ON public.organizations TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.invoices, public.invoice_items, public.payments, public.cashboxes, public.audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.prescriptions, public.prescription_items FROM authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_branch_access(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.create_initial_organization(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_initial_organization(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.create_invoice(UUID, UUID, UUID, INTEGER, NUMERIC, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invoice(UUID, UUID, UUID, INTEGER, NUMERIC, UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.record_invoice_payment(UUID, NUMERIC, TEXT, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(UUID, NUMERIC, TEXT, UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.save_service(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_service(TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC) TO authenticated;
REVOKE ALL ON FUNCTION public.issue_prescription(UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_prescription(UUID, JSONB, TEXT, TEXT) TO authenticated;

