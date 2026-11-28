-- ============================================================================
-- MEDICORE – Owner-Controlled Granular Staff Permissions, Solo/Physiotherapy
-- Doctor Self-Activation & Onboarding Branch Access Fix
-- ============================================================================

-- 1. Granular per-employee permission overrides controlled strictly by facility owner/GM
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS custom_permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_perm_key TEXT,
  p_default_roles TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
  v_perms JSONB;
BEGIN
  IF public.is_platform_super_admin() THEN
    RETURN true;
  END IF;

  SELECT u.role::TEXT, COALESCE(u.custom_permissions, '{}'::jsonb)
  INTO v_role, v_perms
  FROM public.users u
  WHERE u.id = auth.uid() AND u.is_active
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;

  -- Facility Owner always retains sovereign access inside their organization
  IF v_role = 'org_owner' THEN
    RETURN true;
  END IF;

  IF p_perm_key IS NOT NULL
     AND (v_perms ? p_perm_key)
     AND jsonb_typeof(v_perms -> p_perm_key) = 'boolean' THEN
    RETURN (v_perms ->> p_perm_key)::BOOLEAN;
  END IF;

  RETURN v_role = ANY(COALESCE(p_default_roles, ARRAY[]::TEXT[]));
END;
$$;

REVOKE ALL ON FUNCTION public.user_has_permission(TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_permission(TEXT, TEXT[]) TO authenticated;

-- 2. Facility Owner / GM RPC to manage staff role, active state, and custom permissions
CREATE OR REPLACE FUNCTION public.update_organization_member_access(
  p_target_user_id UUID,
  p_role TEXT,
  p_is_active BOOLEAN,
  p_custom_permissions JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (user_id UUID, role TEXT, is_active BOOLEAN, custom_permissions JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_target public.users%ROWTYPE;
  v_org public.organizations%ROWTYPE;
  v_allowed_roles TEXT[] := ARRAY[
    'general_manager', 'branch_manager', 'medical_director', 'doctor',
    'assistant_doctor', 'nurse', 'receptionist', 'accountant',
    'lab_technician', 'radiology_technician', 'pharmacist',
    'insurance_officer', 'inventory_manager', 'records_officer'
  ];
  v_allowed_keys TEXT[] := ARRAY[
    'billing_view', 'billing_create', 'billing_collect',
    'patient_balances_manage', 'expenses_manage', 'payroll_manage',
    'reports_view', 'patients_manage', 'appointments_manage',
    'clinical_manage', 'inventory_manage', 'staff_manage'
  ];
  v_clean_perms JSONB := '{}'::jsonb;
  v_key TEXT;
  v_default_spec TEXT := 'general_practice';
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactive user';
  END IF;

  SELECT * INTO v_target FROM public.users WHERE id = p_target_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff account not found';
  END IF;

  IF v_target.role IN ('super_admin', 'platform_admin', 'platform_support', 'billing_admin', 'patient') THEN
    RAISE EXCEPTION 'Platform and patient portal roles cannot be edited from clinic staff permissions';
  END IF;

  IF v_target.role = 'org_owner' THEN
    RAISE EXCEPTION 'Organization owner authority cannot be revoked or demoted here';
  END IF;

  IF v_actor.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_target.organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_actor.organization_id IS DISTINCT FROM v_target.organization_id
     OR v_actor.role NOT IN ('org_owner', 'general_manager') THEN
    RAISE EXCEPTION 'Only the facility owner or general manager may update staff permissions';
  END IF;

  IF v_target.id = v_actor.id AND (NOT COALESCE(p_is_active, true) OR p_role <> v_actor.role::TEXT) THEN
    RAISE EXCEPTION 'You cannot deactivate or demote your own account';
  END IF;

  IF p_role IS NULL OR NOT (p_role = ANY(v_allowed_roles)) THEN
    RAISE EXCEPTION 'Unsupported clinic staff role';
  END IF;

  IF p_role = 'general_manager' AND v_actor.role NOT IN ('org_owner', 'super_admin') THEN
    RAISE EXCEPTION 'Only the facility owner can assign the general manager role';
  END IF;

  IF p_custom_permissions IS NOT NULL AND jsonb_typeof(p_custom_permissions) = 'object' THEN
    FOREACH v_key IN ARRAY v_allowed_keys LOOP
      IF (p_custom_permissions ? v_key) AND jsonb_typeof(p_custom_permissions -> v_key) = 'boolean' THEN
        v_clean_perms := v_clean_perms || jsonb_build_object(v_key, (p_custom_permissions -> v_key)::BOOLEAN);
      END IF;
    END LOOP;
  END IF;

  UPDATE public.users
  SET role = p_role::public.app_role,
      is_active = COALESCE(p_is_active, true),
      custom_permissions = v_clean_perms,
      updated_at = NOW()
  WHERE id = v_target.id;

  IF v_target.primary_branch_id IS NOT NULL THEN
    INSERT INTO public.user_branch_access (organization_id, user_id, branch_id, is_default)
    VALUES (v_target.organization_id, v_target.id, v_target.primary_branch_id, true)
    ON CONFLICT (user_id, branch_id) DO NOTHING;
  END IF;

  IF p_role IN ('doctor', 'assistant_doctor')
     AND NOT EXISTS (
       SELECT 1 FROM public.doctors d
       WHERE d.user_id = v_target.id AND d.organization_id = v_target.organization_id
     ) THEN
    SELECT * INTO v_org FROM public.organizations WHERE id = v_target.organization_id;
    IF v_org.specialties IS NOT NULL AND jsonb_typeof(v_org.specialties) = 'array' AND jsonb_array_length(v_org.specialties) > 0 THEN
      v_default_spec := COALESCE(NULLIF(BTRIM(v_org.specialties ->> 0), ''), 'general_practice');
    END IF;
    INSERT INTO public.doctors (
      organization_id, user_id, specialty_code, specialty_title_ar, specialty_title_en,
      consultation_fee, follow_up_fee, commission_rate, is_active
    ) VALUES (
      v_target.organization_id, v_target.id, v_default_spec,
      CASE WHEN v_default_spec = 'physiotherapy' THEN 'العلاج الطبيعي والتأهيل البدني' ELSE 'طب عام' END,
      CASE WHEN v_default_spec = 'physiotherapy' THEN 'Physiotherapy & Physical Therapy' ELSE 'General Practice' END,
      0, 0, 0, true
    );
  END IF;

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, user_name, action, entity_type, entity_id, old_values, new_values
  ) VALUES (
    v_target.organization_id,
    v_target.primary_branch_id,
    v_actor.id,
    COALESCE(v_actor.name_en, v_actor.email),
    'UPDATE',
    'users',
    v_target.id::TEXT,
    jsonb_build_object('role', v_target.role, 'is_active', v_target.is_active, 'custom_permissions', v_target.custom_permissions),
    jsonb_build_object('role', p_role, 'is_active', COALESCE(p_is_active, true), 'custom_permissions', v_clean_perms)
  );

  RETURN QUERY SELECT v_target.id, p_role, COALESCE(p_is_active, true), v_clean_perms;
END;
$$;

REVOKE ALL ON FUNCTION public.update_organization_member_access(UUID, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_organization_member_access(UUID, TEXT, BOOLEAN, JSONB) TO authenticated;

-- 3. Self-activate clinic owner / manager as a treating clinician (e.g. Solo Physiotherapy Doctor)
CREATE OR REPLACE FUNCTION public.register_self_as_doctor(
  p_specialty_code TEXT DEFAULT 'general_practice',
  p_specialty_title_ar TEXT DEFAULT 'طب عام',
  p_specialty_title_en TEXT DEFAULT 'General Practice',
  p_consultation_fee NUMERIC DEFAULT 0,
  p_follow_up_fee NUMERIC DEFAULT 0,
  p_commission_rate NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_doctor_id UUID;
  v_branch RECORD;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactive user';
  END IF;

  IF v_user.organization_id IS NULL
     OR v_user.role NOT IN ('org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor') THEN
    RAISE EXCEPTION 'Only clinic administrators or clinicians can activate a treating clinician profile';
  END IF;

  IF COALESCE(p_consultation_fee, 0) < 0 OR COALESCE(p_follow_up_fee, 0) < 0
     OR COALESCE(p_commission_rate, 0) < 0 OR COALESCE(p_commission_rate, 0) > 100 THEN
    RAISE EXCEPTION 'Invalid clinician fee or commission settings';
  END IF;

  FOR v_branch IN
    SELECT id, is_main_branch FROM public.branches
    WHERE organization_id = v_user.organization_id AND is_active = true
  LOOP
    INSERT INTO public.user_branch_access (organization_id, user_id, branch_id, is_default)
    VALUES (v_user.organization_id, v_user.id, v_branch.id, COALESCE(v_branch.is_main_branch, false))
    ON CONFLICT (user_id, branch_id) DO NOTHING;
  END LOOP;

  SELECT id INTO v_doctor_id
  FROM public.doctors
  WHERE organization_id = v_user.organization_id AND user_id = v_user.id
  LIMIT 1;

  IF v_doctor_id IS NOT NULL THEN
    UPDATE public.doctors
    SET specialty_code = COALESCE(NULLIF(BTRIM(p_specialty_code), ''), specialty_code),
        specialty_title_ar = COALESCE(NULLIF(BTRIM(p_specialty_title_ar), ''), specialty_title_ar),
        specialty_title_en = COALESCE(NULLIF(BTRIM(p_specialty_title_en), ''), specialty_title_en),
        consultation_fee = COALESCE(p_consultation_fee, consultation_fee),
        follow_up_fee = COALESCE(p_follow_up_fee, follow_up_fee),
        commission_rate = COALESCE(p_commission_rate, commission_rate),
        is_active = true
    WHERE id = v_doctor_id;
  ELSE
    INSERT INTO public.doctors (
      organization_id, user_id, specialty_code, specialty_title_ar, specialty_title_en,
      consultation_fee, follow_up_fee, commission_rate, is_active
    ) VALUES (
      v_user.organization_id,
      v_user.id,
      COALESCE(NULLIF(BTRIM(p_specialty_code), ''), 'general_practice'),
      COALESCE(NULLIF(BTRIM(p_specialty_title_ar), ''), 'طب عام'),
      COALESCE(NULLIF(BTRIM(p_specialty_title_en), ''), 'General Practice'),
      COALESCE(p_consultation_fee, 0),
      COALESCE(p_follow_up_fee, 0),
      COALESCE(p_commission_rate, 0),
      true
    )
    RETURNING id INTO v_doctor_id;
  END IF;

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, user_name, action, entity_type, entity_id, new_values
  ) VALUES (
    v_user.organization_id,
    v_user.primary_branch_id,
    v_user.id,
    COALESCE(v_user.name_en, v_user.email),
    'CREATE',
    'doctors',
    v_doctor_id::TEXT,
    jsonb_build_object(
      'specialty_code', COALESCE(NULLIF(BTRIM(p_specialty_code), ''), 'general_practice'),
      'consultation_fee', COALESCE(p_consultation_fee, 0),
      'self_activated', true
    )
  );

  RETURN v_doctor_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_self_as_doctor(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_self_as_doctor(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

-- 4. Fix create_initial_organization so self-onboarded clinics also receive user_branch_access
CREATE OR REPLACE FUNCTION public.create_initial_organization(
  p_name_ar TEXT,
  p_name_en TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_city TEXT,
  p_address TEXT,
  p_facility_type TEXT DEFAULT 'private_clinic',
  p_specialties JSONB DEFAULT '["general_practice"]'::jsonb
)
RETURNS TABLE (organization_id UUID, branch_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_org_id UUID;
  v_branch_id UUID;
  v_sub_id UUID;
  v_plan_id UUID;
  v_plan_name_ar TEXT;
  v_plan_amount NUMERIC;
  v_plan_currency TEXT;
  v_slug TEXT;
  v_specialties JSONB;
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

  v_specialties := CASE
    WHEN jsonb_typeof(p_specialties) = 'array' AND jsonb_array_length(p_specialties) > 0
      THEN p_specialties
    ELSE '["general_practice"]'::jsonb
  END;

  SELECT id, name_ar, price_monthly, currency INTO v_plan_id, v_plan_name_ar, v_plan_amount, v_plan_currency
  FROM public.subscription_plans WHERE slug = 'starter' AND is_active LIMIT 1;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Starter subscription plan is not configured';
  END IF;

  v_org_id := gen_random_uuid();
  v_branch_id := gen_random_uuid();
  v_slug := 'clinic-' || REPLACE(v_org_id::TEXT, '-', '');

  INSERT INTO public.organizations (
    id, name_ar, name_en, slug, facility_type, status, email, phone, country,
    city, address, timezone, default_currency, specialties
  ) VALUES (
    v_org_id, BTRIM(p_name_ar), BTRIM(p_name_en), v_slug, p_facility_type::public.facility_type,
    'active', LOWER(BTRIM(p_email)), BTRIM(p_phone), 'Egypt', BTRIM(p_city),
    BTRIM(p_address), 'Africa/Cairo', COALESCE(v_plan_currency, 'EGP'), v_specialties
  );

  INSERT INTO public.branches (
    id, organization_id, name_ar, name_en, code, phone, email, address, city, is_main_branch, specialties
  ) VALUES (
    v_branch_id, v_org_id, BTRIM(p_name_ar), BTRIM(p_name_en), 'MAIN', BTRIM(p_phone),
    LOWER(BTRIM(p_email)), BTRIM(p_address), BTRIM(p_city), true, v_specialties
  );

  INSERT INTO public.cashboxes (organization_id, branch_id, name, current_balance, assigned_user_id)
  VALUES (v_org_id, v_branch_id, 'الخزينة الرئيسية', 0, auth.uid());

  INSERT INTO public.subscriptions (
    organization_id, plan_id, status, cycle, amount, currency, trial_ends_at
  ) VALUES (
    v_org_id, v_plan_id, 'trialing', 'monthly', v_plan_amount, v_plan_currency, NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_sub_id;

  IF COALESCE(v_plan_amount, 0) > 0 THEN
    INSERT INTO public.platform_transactions (
      transaction_type, status, payment_method, category, title, amount, currency,
      transaction_date, organization_id, subscription_id, notes, created_by
    ) VALUES (
      'subscription_income',
      'pending',
      NULL,
      'Facility Onboarding',
      format('اشتراك منشأة: %s (%s)', BTRIM(p_name_ar), COALESCE(v_plan_name_ar, 'الباقة الأساسية')),
      v_plan_amount,
      COALESCE(v_plan_currency, 'EGP'),
      CURRENT_DATE,
      v_org_id,
      v_sub_id,
      format('تسجيل تلقائي قيد السداد عند تسجيل المنشأة ذاتياً — %s', BTRIM(p_name_en)),
      auth.uid()
    );
  END IF;

  UPDATE public.users
  SET organization_id = v_org_id, primary_branch_id = v_branch_id,
      role = 'org_owner', is_active = true, updated_at = NOW()
  WHERE id = auth.uid();

  INSERT INTO public.user_branch_access (organization_id, user_id, branch_id, is_default)
  VALUES (v_org_id, auth.uid(), v_branch_id, true)
  ON CONFLICT (user_id, branch_id) DO NOTHING;

  RETURN QUERY SELECT v_org_id, v_branch_id;
END;
$$;

-- 5. Enforce granular custom_permissions in Financial RPCs & RLS
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
  ELSIF v_user.organization_id IS DISTINCT FROM v_target_org
     OR NOT public.user_has_permission('billing_create', ARRAY['org_owner', 'general_manager', 'accountant', 'receptionist']) THEN
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
  ELSIF v_user.organization_id IS DISTINCT FROM v_invoice.organization_id
     OR NOT public.user_has_permission('billing_collect', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist']) THEN
    RAISE EXCEPTION 'Insufficient payment collection permissions';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0
     OR p_payment_mode NOT IN ('cash','instapay','wallet','credit_card','bank_transfer','insurance','vodafone_cash','fawry') THEN
    RAISE EXCEPTION 'Invalid payment details';
  END IF;
  IF p_cashbox_id IS NULL THEN RAISE EXCEPTION 'Select a cashbox for this payment'; END IF;
  IF NOT public.user_has_branch_access(v_invoice.branch_id) THEN RAISE EXCEPTION 'Invoice branch unavailable'; END IF;
  IF p_amount > v_invoice.balance_due THEN RAISE EXCEPTION 'Payment exceeds the invoice balance'; END IF;
  SELECT * INTO v_cashbox FROM public.cashboxes WHERE id = p_cashbox_id AND organization_id = v_invoice.organization_id AND branch_id = v_invoice.branch_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cashbox is unavailable for this branch'; END IF;

  INSERT INTO public.payments (
    id, organization_id, branch_id, invoice_id, patient_id, cashbox_id,
    receipt_number, payment_date, amount, payment_mode, transaction_reference, received_by
  )
  VALUES (
    v_payment, v_invoice.organization_id, v_invoice.branch_id, v_invoice.id,
    v_invoice.patient_id, p_cashbox_id, v_receipt, NOW(), p_amount,
    p_payment_mode::public.payment_mode, NULLIF(BTRIM(p_transaction_reference), ''), auth.uid()
  );

  RETURN QUERY SELECT v_payment, v_receipt;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_patient_balance_entry(
  p_patient_id UUID,
  p_entry_type TEXT,
  p_amount NUMERIC,
  p_description TEXT,
  p_entry_date DATE DEFAULT CURRENT_DATE,
  p_payment_mode TEXT DEFAULT NULL,
  p_cashbox_id UUID DEFAULT NULL,
  p_is_legacy BOOLEAN DEFAULT true,
  p_reference_no TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_entry_id UUID;
  v_cashbox public.cashboxes%ROWTYPE;
  v_method TEXT := NULLIF(BTRIM(p_payment_mode), '');
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive user'; END IF;

  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Patient not found'; END IF;

  IF p_entry_type NOT IN ('legacy_debit', 'legacy_credit', 'debit_payment', 'credit_usage', 'credit_refund')
     OR p_amount IS NULL OR p_amount <= 0
     OR NULLIF(BTRIM(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid patient balance entry details';
  END IF;

  IF v_user.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_patient.organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_user.organization_id IS DISTINCT FROM v_patient.organization_id THEN
    RAISE EXCEPTION 'Insufficient permission to modify patient account balance';
  ELSIF p_entry_type IN ('debit_payment', 'credit_refund') THEN
    IF NOT public.user_has_permission('billing_collect', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist']) THEN
      RAISE EXCEPTION 'Insufficient payment collection permission';
    END IF;
  ELSIF NOT public.user_has_permission('patient_balances_manage', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist', 'records_officer']) THEN
    RAISE EXCEPTION 'Insufficient permission to modify patient account balance';
  END IF;

  IF v_method IS NOT NULL AND v_method NOT IN ('cash', 'instapay', 'wallet', 'vodafone_cash', 'fawry', 'credit_card', 'bank_transfer', 'insurance') THEN
    RAISE EXCEPTION 'Unsupported payment mode';
  END IF;

  IF NOT COALESCE(p_is_legacy, true) AND p_cashbox_id IS NOT NULL THEN
    SELECT * INTO v_cashbox FROM public.cashboxes
    WHERE id = p_cashbox_id AND organization_id = v_patient.organization_id AND is_active
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cashbox not found'; END IF;

    IF p_entry_type = 'debit_payment' THEN
      UPDATE public.cashboxes SET current_balance = current_balance + p_amount WHERE id = v_cashbox.id;
    ELSIF p_entry_type = 'credit_refund' THEN
      UPDATE public.cashboxes SET current_balance = GREATEST(0, current_balance - p_amount) WHERE id = v_cashbox.id;
    END IF;
  END IF;

  INSERT INTO public.patient_balance_entries (
    organization_id, branch_id, patient_id, entry_type, amount,
    payment_mode, description, entry_date, is_legacy, reference_no, created_by
  ) VALUES (
    v_patient.organization_id,
    v_patient.primary_branch_id,
    v_patient.id,
    p_entry_type,
    p_amount,
    v_method,
    BTRIM(p_description),
    COALESCE(p_entry_date, CURRENT_DATE),
    COALESCE(p_is_legacy, true),
    NULLIF(BTRIM(p_reference_no), ''),
    v_user.id
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, user_name, action, entity_type, entity_id, new_values
  ) VALUES (
    v_patient.organization_id,
    v_patient.primary_branch_id,
    v_user.id,
    COALESCE(v_user.name_en, v_user.email),
    'CREATE',
    'patient_balance_entries',
    v_entry_id::TEXT,
    jsonb_build_object(
      'patient_id', v_patient.id,
      'entry_type', p_entry_type,
      'amount', p_amount,
      'payment_mode', v_method,
      'is_legacy', COALESCE(p_is_legacy, true)
    )
  );

  RETURN v_entry_id;
END;
$$;

-- 6. Align pay_payroll_slip & Financial SELECT/INSERT RLS with custom_permissions
CREATE OR REPLACE FUNCTION public.pay_payroll_slip(
  p_slip_id UUID,
  p_payment_method TEXT,
  p_cashbox_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_slip public.payroll_slips%ROWTYPE;
  v_emp_name TEXT;
  v_expense_id UUID := gen_random_uuid();
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive user'; END IF;

  IF p_payment_method NOT IN ('cash', 'bank_transfer', 'cheque') THEN
    RAISE EXCEPTION 'Invalid payroll payment method';
  END IF;

  SELECT * INTO v_slip FROM public.payroll_slips WHERE id = p_slip_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll slip not found'; END IF;

  IF v_actor.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_slip.organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_actor.organization_id IS DISTINCT FROM v_slip.organization_id
     OR NOT public.user_has_permission('payroll_manage', ARRAY['org_owner', 'general_manager', 'accountant'])
     OR NOT public.user_has_branch_access(v_slip.branch_id) THEN
    RAISE EXCEPTION 'Insufficient permission to disburse payroll';
  END IF;

  IF v_slip.payment_status <> 'approved' THEN
    RAISE EXCEPTION 'Payroll slip must be approved before payout';
  END IF;

  IF p_payment_method = 'cash' AND p_cashbox_id IS NULL THEN
    RAISE EXCEPTION 'Cashbox is required for cash payroll disbursement';
  END IF;

  IF p_cashbox_id IS NOT NULL THEN
    PERFORM 1 FROM public.cashboxes
    WHERE id = p_cashbox_id AND organization_id = v_slip.organization_id AND branch_id = v_slip.branch_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cashbox is unavailable for this branch'; END IF;
  END IF;

  SELECT COALESCE(name_ar, name_en, email) INTO v_emp_name FROM public.users WHERE id = v_slip.user_id;

  INSERT INTO public.expenses (
    id, organization_id, branch_id, category, title, amount, expense_date,
    payment_method, cashbox_id, notes, recorded_by
  ) VALUES (
    v_expense_id, v_slip.organization_id, v_slip.branch_id, 'Salaries',
    format('راتب شهر %s — %s', v_slip.month, COALESCE(v_emp_name, 'موظف')),
    v_slip.net_salary, CURRENT_DATE, p_payment_method, p_cashbox_id, v_slip.notes, v_actor.id
  );

  IF p_cashbox_id IS NOT NULL THEN
    UPDATE public.cashboxes
    SET current_balance = current_balance - v_slip.net_salary
    WHERE id = p_cashbox_id;
  END IF;

  UPDATE public.payroll_slips
  SET payment_status = 'paid',
      payment_date = CURRENT_DATE,
      payment_method = p_payment_method,
      cashbox_id = p_cashbox_id,
      expense_id = v_expense_id,
      updated_at = NOW()
  WHERE id = v_slip.id;

  RETURN v_expense_id;
END;
$$;

-- Tighten financial table SELECT/WRITE RLS to honor owner-revoked financial visibility
DROP POLICY IF EXISTS "tenant_isolation_select_cashboxes" ON public.cashboxes;
CREATE POLICY "tenant_isolation_select_cashboxes"
  ON public.cashboxes FOR SELECT TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.user_has_branch_access(branch_id)
      AND (
        public.user_has_permission('billing_view', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist', 'insurance_officer'])
        OR public.user_has_permission('billing_collect', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist'])
        OR public.user_has_permission('expenses_manage', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant'])
        OR public.user_has_permission('payroll_manage', ARRAY['org_owner', 'general_manager', 'accountant'])
      )
    )
  );

DROP POLICY IF EXISTS "tenant_isolation_select_payments" ON public.payments;
CREATE POLICY "tenant_isolation_select_payments"
  ON public.payments FOR SELECT TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.user_has_branch_access(branch_id)
      AND (
        public.user_has_permission('billing_view', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist', 'insurance_officer'])
        OR public.user_has_permission('billing_collect', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist'])
      )
    )
  );

DROP POLICY IF EXISTS "tenant_isolation_select_expenses" ON public.expenses;
CREATE POLICY "tenant_isolation_select_expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.user_has_branch_access(branch_id)
      AND (
        public.user_has_permission('billing_view', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant'])
        OR public.user_has_permission('expenses_manage', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant'])
        OR public.user_has_permission('payroll_manage', ARRAY['org_owner', 'general_manager', 'accountant'])
      )
    )
  );

DROP POLICY IF EXISTS "tenant_isolation_insert_expenses" ON public.expenses;
CREATE POLICY "tenant_isolation_insert_expenses"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.user_has_branch_access(branch_id)
      AND public.user_has_permission('expenses_manage', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant'])
    )
  );

DROP POLICY IF EXISTS "tenant_isolation_update_expenses" ON public.expenses;
CREATE POLICY "tenant_isolation_update_expenses"
  ON public.expenses FOR UPDATE TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.user_has_branch_access(branch_id)
      AND public.user_has_permission('expenses_manage', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant'])
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.user_has_branch_access(branch_id)
      AND public.user_has_permission('expenses_manage', ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant'])
    )
  );

-- Allow facility owner/GM (or users with staff_manage permission) to list staff in their org
DROP POLICY IF EXISTS "tenant_isolation_select_users" ON public.users;
CREATE POLICY "tenant_isolation_select_users"
  ON public.users FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.user_has_permission('staff_manage', ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'accountant'])
    )
  );

-- 7. Auto-provision a default cashbox whenever a new branch is created so collections & HR work immediately
CREATE OR REPLACE FUNCTION public.auto_cashbox_on_branch_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cashboxes WHERE branch_id = NEW.id) THEN
    INSERT INTO public.cashboxes (organization_id, branch_id, name, current_balance)
    VALUES (
      NEW.organization_id,
      NEW.id,
      CASE WHEN COALESCE(NEW.is_main_branch, false) THEN 'الخزينة الرئيسية' ELSE format('خزينة %s', COALESCE(NULLIF(BTRIM(NEW.name_ar), ''), NEW.code, 'الفرع')) END,
      0
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_cashbox_on_branch_insert ON public.branches;
CREATE TRIGGER trg_auto_cashbox_on_branch_insert
  AFTER INSERT ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.auto_cashbox_on_branch_insert();
