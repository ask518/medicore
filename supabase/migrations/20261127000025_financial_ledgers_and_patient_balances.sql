-- ============================================================================
-- MEDICORE – Pending Facility Provisioning Transactions, Payment-Method
-- Reporting (Cash / InstaPay / Wallet), Appointment Auto-Invoicing &
-- Legacy Patient Financial Accounts (Debits / Credits / Physiotherapy Packages)
-- ============================================================================

-- 1. Enhance platform_transactions with payment collection status & payment method
ALTER TABLE public.platform_transactions
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'paid'
    CHECK (status IN ('pending', 'paid', 'cancelled')),
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('cash', 'instapay', 'wallet', 'vodafone_cash', 'fawry', 'credit_card', 'bank_transfer', 'other')),
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL;

UPDATE public.platform_transactions
SET
  paid_at = COALESCE(paid_at, created_at),
  payment_method = COALESCE(
    payment_method,
    CASE WHEN transaction_type = 'payroll_payout' THEN 'bank_transfer' ELSE 'cash' END
  )
WHERE status = 'paid' AND (paid_at IS NULL OR payment_method IS NULL);

DROP FUNCTION IF EXISTS public.platform_record_transaction(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.platform_record_transaction(
  p_type TEXT,
  p_category TEXT,
  p_title TEXT,
  p_amount NUMERIC,
  p_currency TEXT DEFAULT 'EGP',
  p_transaction_date DATE DEFAULT CURRENT_DATE,
  p_organization_id UUID DEFAULT NULL,
  p_reference_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'paid',
  p_payment_method TEXT DEFAULT 'cash'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_name TEXT;
  v_tx_id UUID;
  v_status TEXT := COALESCE(NULLIF(BTRIM(p_status), ''), 'paid');
  v_method TEXT := NULLIF(BTRIM(p_payment_method), '');
BEGIN
  IF v_actor IS NULL OR NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'An active platform super admin is required' USING ERRCODE = '42501';
  END IF;
  IF p_type NOT IN ('subscription_income', 'operating_expense', 'payroll_payout', 'adjustment')
     OR NULLIF(BTRIM(p_category), '') IS NULL
     OR NULLIF(BTRIM(p_title), '') IS NULL
     OR p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid transaction details';
  END IF;
  IF v_status NOT IN ('pending', 'paid') THEN
    RAISE EXCEPTION 'Invalid transaction status';
  END IF;
  IF v_status = 'paid' THEN
    v_method := COALESCE(v_method, 'cash');
    IF v_method NOT IN ('cash', 'instapay', 'wallet', 'vodafone_cash', 'fawry', 'credit_card', 'bank_transfer', 'other') THEN
      RAISE EXCEPTION 'Unsupported payment method';
    END IF;
  ELSE
    v_method := NULL;
  END IF;

  INSERT INTO public.platform_transactions (
    transaction_type, status, payment_method, paid_at,
    category, title, amount, currency, transaction_date,
    organization_id, reference_no, notes, created_by
  ) VALUES (
    p_type,
    v_status,
    v_method,
    CASE WHEN v_status = 'paid' THEN NOW() ELSE NULL END,
    BTRIM(p_category),
    BTRIM(p_title),
    p_amount,
    COALESCE(NULLIF(BTRIM(p_currency), ''), 'EGP'),
    COALESCE(p_transaction_date, CURRENT_DATE),
    p_organization_id,
    NULLIF(BTRIM(p_reference_no), ''),
    NULLIF(BTRIM(p_notes), ''),
    v_actor
  )
  RETURNING id INTO v_tx_id;

  SELECT COALESCE(name_en, email) INTO v_actor_name FROM public.users WHERE id = v_actor;
  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, new_values
  ) VALUES (
    NULL, v_actor, v_actor_name, 'PLATFORM_FINANCE_TX', 'platform_transactions', v_tx_id::TEXT,
    jsonb_build_object(
      'type', p_type, 'status', v_status, 'payment_method', v_method,
      'category', p_category, 'title', p_title, 'amount', p_amount, 'currency', p_currency
    )
  );

  RETURN v_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_record_transaction(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_record_transaction(TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_mark_transaction_paid(
  p_tx_id UUID,
  p_payment_method TEXT DEFAULT 'cash',
  p_reference_no TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_name TEXT;
  v_tx public.platform_transactions%ROWTYPE;
  v_method TEXT := COALESCE(NULLIF(BTRIM(p_payment_method), ''), 'cash');
BEGIN
  IF v_actor IS NULL OR NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'An active platform super admin is required' USING ERRCODE = '42501';
  END IF;
  IF v_method NOT IN ('cash', 'instapay', 'wallet', 'vodafone_cash', 'fawry', 'credit_card', 'bank_transfer', 'other') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  SELECT * INTO v_tx FROM public.platform_transactions WHERE id = p_tx_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Platform transaction not found';
  END IF;
  IF v_tx.status <> 'pending' THEN
    RAISE EXCEPTION 'Transaction is not pending collection';
  END IF;

  UPDATE public.platform_transactions
  SET
    status = 'paid',
    payment_method = v_method,
    paid_at = NOW(),
    reference_no = COALESCE(NULLIF(BTRIM(p_reference_no), ''), reference_no),
    notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes)
  WHERE id = p_tx_id;

  IF v_tx.subscription_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET status = 'active'::public.subscription_status, updated_at = NOW()
    WHERE id = v_tx.subscription_id
      AND status::TEXT IN ('trialing', 'past_due');
  END IF;

  SELECT COALESCE(name_en, email) INTO v_actor_name FROM public.users WHERE id = v_actor;
  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, old_values, new_values
  ) VALUES (
    v_tx.organization_id, v_actor, v_actor_name, 'PLATFORM_FINANCE_PAID', 'platform_transactions', p_tx_id::TEXT,
    jsonb_build_object('status', v_tx.status),
    jsonb_build_object('status', 'paid', 'payment_method', v_method, 'amount', v_tx.amount, 'reference_no', NULLIF(BTRIM(p_reference_no), ''))
  );

  RETURN p_tx_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_mark_transaction_paid(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_mark_transaction_paid(UUID, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_pay_payroll_slip(p_payroll_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_name TEXT;
  v_slip public.platform_staff_payroll%ROWTYPE;
  v_staff_name TEXT;
  v_tx_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'An active platform super admin is required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_slip FROM public.platform_staff_payroll WHERE id = p_payroll_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll slip not found';
  END IF;
  IF v_slip.status = 'paid' THEN
    RAISE EXCEPTION 'Payroll slip is already paid';
  END IF;

  UPDATE public.platform_staff_payroll
  SET status = 'paid', paid_at = NOW()
  WHERE id = p_payroll_id;

  SELECT COALESCE(name_ar, name_en, email) INTO v_staff_name FROM public.users WHERE id = v_slip.user_id;

  IF v_slip.net_salary > 0 THEN
    INSERT INTO public.platform_transactions (
      transaction_type, status, payment_method, paid_at, category, title, amount, currency, transaction_date, staff_user_id, created_by
    ) VALUES (
      'payroll_payout',
      'paid',
      'bank_transfer',
      NOW(),
      'Payroll',
      format('%s (%s)', COALESCE(v_staff_name, 'Staff'), v_slip.period_month),
      v_slip.net_salary,
      v_slip.currency,
      CURRENT_DATE,
      v_slip.user_id,
      v_actor
    )
    RETURNING id INTO v_tx_id;
  END IF;

  SELECT COALESCE(name_en, email) INTO v_actor_name FROM public.users WHERE id = v_actor;
  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, new_values
  ) VALUES (
    NULL, v_actor, v_actor_name, 'PLATFORM_PAYROLL_PAID', 'platform_staff_payroll', p_payroll_id::TEXT,
    jsonb_build_object('period_month', v_slip.period_month, 'net_salary', v_slip.net_salary, 'tx_id', v_tx_id)
  );

  RETURN COALESCE(v_tx_id, p_payroll_id);
END;
$$;

-- 2. Facility Provisioning automatically records a PENDING financial transaction
DROP FUNCTION IF EXISTS public.platform_provision_facility(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB);
CREATE OR REPLACE FUNCTION public.platform_provision_facility(
  p_actor_id UUID,
  p_owner_user_id UUID,
  p_owner_email TEXT,
  p_owner_name_ar TEXT,
  p_owner_name_en TEXT,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_city TEXT,
  p_address TEXT,
  p_facility_type TEXT,
  p_specialties JSONB DEFAULT '["general_practice"]'::jsonb,
  p_plan_id UUID DEFAULT NULL,
  p_cycle TEXT DEFAULT 'monthly'
)
RETURNS TABLE (organization_id UUID, branch_id UUID, owner_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID := gen_random_uuid();
  v_branch_id UUID := gen_random_uuid();
  v_sub_id UUID;
  v_plan public.subscription_plans%ROWTYPE;
  v_cycle TEXT := CASE WHEN p_cycle IN ('monthly', 'annual', 'lifetime', 'trial') THEN p_cycle ELSE 'monthly' END;
  v_plan_amount NUMERIC(12, 2);
  v_slug TEXT := 'clinic-' || REPLACE(gen_random_uuid()::TEXT, '-', '');
  v_specialties JSONB;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = p_actor_id AND u.role = 'super_admin' AND u.is_active
  ) THEN
    RAISE EXCEPTION 'An active platform administrator is required';
  END IF;
  IF NULLIF(BTRIM(p_name_ar), '') IS NULL OR NULLIF(BTRIM(p_name_en), '') IS NULL
     OR NULLIF(BTRIM(p_email), '') IS NULL OR NULLIF(BTRIM(p_phone), '') IS NULL
     OR NULLIF(BTRIM(p_city), '') IS NULL OR NULLIF(BTRIM(p_address), '') IS NULL
     OR NULLIF(BTRIM(p_owner_email), '') IS NULL OR NULLIF(BTRIM(p_owner_name_ar), '') IS NULL THEN
    RAISE EXCEPTION 'Facility and owner details are required';
  END IF;
  IF p_facility_type NOT IN ('private_clinic', 'poly_clinic', 'medical_center', 'specialized_center', 'complex', 'hospital') THEN
    RAISE EXCEPTION 'Unsupported facility type';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users au
    WHERE au.id = p_owner_user_id AND LOWER(au.email) = LOWER(BTRIM(p_owner_email))
  ) OR NOT EXISTS (
    SELECT 1 FROM public.users pu
    WHERE pu.id = p_owner_user_id AND pu.is_active = false AND pu.organization_id IS NULL
  ) THEN
    RAISE EXCEPTION 'The invited owner account is missing or already assigned';
  END IF;

  v_specialties := CASE
    WHEN jsonb_typeof(p_specialties) = 'array' AND jsonb_array_length(p_specialties) > 0
      THEN p_specialties
    ELSE '["general_practice"]'::jsonb
  END;

  IF p_plan_id IS NOT NULL THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id AND is_active LIMIT 1;
  END IF;
  IF v_plan.id IS NULL THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE slug = 'starter' AND is_active LIMIT 1;
  END IF;
  IF v_plan.id IS NULL THEN
    SELECT * INTO v_plan FROM public.subscription_plans WHERE is_active ORDER BY price_monthly LIMIT 1;
  END IF;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Subscription plan is not configured'; END IF;

  v_plan_amount := CASE
    WHEN v_cycle = 'trial' THEN 0.00
    WHEN v_cycle = 'annual' THEN v_plan.price_annual
    ELSE v_plan.price_monthly
  END;

  INSERT INTO public.organizations (
    id, name_ar, name_en, slug, facility_type, status, email, phone, country, city,
    address, timezone, default_currency, specialties
  ) VALUES (
    v_org_id, BTRIM(p_name_ar), BTRIM(p_name_en), v_slug, p_facility_type::public.facility_type,
    'active', LOWER(BTRIM(p_email)), BTRIM(p_phone), 'Egypt', BTRIM(p_city),
    BTRIM(p_address), 'Africa/Cairo', COALESCE(v_plan.currency, 'EGP'), v_specialties
  );

  INSERT INTO public.branches (
    id, organization_id, name_ar, name_en, code, phone, email, address, city, is_main_branch, specialties
  ) VALUES (
    v_branch_id, v_org_id, BTRIM(p_name_ar), BTRIM(p_name_en), 'MAIN', BTRIM(p_phone),
    LOWER(BTRIM(p_email)), BTRIM(p_address), BTRIM(p_city), true, v_specialties
  );

  INSERT INTO public.users (id, organization_id, primary_branch_id, email, name_ar, name_en, role, is_active, updated_at)
  VALUES (
    p_owner_user_id, v_org_id, v_branch_id, LOWER(BTRIM(p_owner_email)), BTRIM(p_owner_name_ar),
    COALESCE(NULLIF(BTRIM(p_owner_name_en), ''), BTRIM(p_owner_name_ar)), 'org_owner', true, NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    primary_branch_id = EXCLUDED.primary_branch_id,
    email = EXCLUDED.email,
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    role = 'org_owner',
    is_active = true,
    updated_at = NOW();

  INSERT INTO public.user_branch_access (organization_id, user_id, branch_id, is_default)
  VALUES (v_org_id, p_owner_user_id, v_branch_id, true);
  INSERT INTO public.cashboxes (organization_id, branch_id, name, current_balance, assigned_user_id)
  VALUES (v_org_id, v_branch_id, 'الخزينة الرئيسية', 0, p_owner_user_id);

  INSERT INTO public.subscriptions (
    organization_id, plan_id, status, cycle, amount, currency, trial_ends_at
  ) VALUES (
    v_org_id, v_plan.id, 'trialing', v_cycle::public.billing_cycle, v_plan_amount, COALESCE(v_plan.currency, 'EGP'), NOW() + INTERVAL '14 days'
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
      'Facility Provisioning',
      format('اشتراك منشأة: %s (%s)', BTRIM(p_name_ar), v_plan.name_ar),
      v_plan_amount,
      COALESCE(v_plan.currency, 'EGP'),
      CURRENT_DATE,
      v_org_id,
      v_sub_id,
      format('تسجيل تلقائي قيد السداد عند إنشاء المنشأة — %s', BTRIM(p_name_en)),
      p_actor_id
    );
  END IF;

  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, new_values
  ) VALUES (
    v_org_id, p_actor_id,
    (SELECT COALESCE(name_en, email) FROM public.users WHERE id = p_actor_id),
    'CREATE', 'organizations', v_org_id::TEXT,
    jsonb_build_object(
      'name_ar', BTRIM(p_name_ar),
      'name_en', BTRIM(p_name_en),
      'facility_type', p_facility_type,
      'specialties', v_specialties,
      'plan_slug', v_plan.slug,
      'pending_amount', v_plan_amount,
      'owner_user_id', p_owner_user_id
    )
  );

  RETURN QUERY SELECT v_org_id, v_branch_id, p_owner_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_provision_facility(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_provision_facility(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) TO service_role;

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

  RETURN QUERY SELECT v_org_id, v_branch_id;
END;
$$;

-- 3. Clinic Billing: Auto-invoice new Appointments as 'unpaid' ("قيد السداد")
--    + Expand record_invoice_payment for 'instapay' and 'wallet'
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_appointment
  ON public.invoices(appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.auto_invoice_on_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc RECORD;
  v_fee NUMERIC(12, 2);
  v_invoice_id UUID := gen_random_uuid();
  v_number TEXT := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
  v_item_desc TEXT;
BEGIN
  IF NEW.status IN ('cancelled', 'no_show') THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE appointment_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT consultation_fee, follow_up_fee, specialty_title_ar
  INTO v_doc
  FROM public.doctors
  WHERE id = NEW.doctor_id AND organization_id = NEW.organization_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_fee := CASE
    WHEN NEW.type::TEXT = 'follow_up' THEN COALESCE(NULLIF(v_doc.follow_up_fee, 0), v_doc.consultation_fee, 0)
    ELSE COALESCE(v_doc.consultation_fee, 0)
  END;

  IF COALESCE(v_fee, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  v_item_desc := CASE
    WHEN NEW.type::TEXT = 'follow_up' THEN format('متابعة طبية (%s) - %s', COALESCE(v_doc.specialty_title_ar, 'عيادة'), NEW.appointment_number)
    ELSE format('كشف طبي (%s) - %s', COALESCE(v_doc.specialty_title_ar, 'عيادة'), NEW.appointment_number)
  END;

  INSERT INTO public.invoices (
    id, organization_id, branch_id, patient_id, doctor_id, appointment_id,
    invoice_number, issue_date, subtotal, discount_amount, tax_amount,
    total_amount, paid_amount, balance_due, status, notes, created_by
  ) VALUES (
    v_invoice_id, NEW.organization_id, NEW.branch_id, NEW.patient_id, NEW.doctor_id, NEW.id,
    v_number, COALESCE(NEW.appointment_date, CURRENT_DATE), v_fee, 0, 0,
    v_fee, 0, v_fee, 'unpaid'::public.invoice_status,
    format('فاتورة تلقائية قيد السداد للموعد %s', NEW.appointment_number),
    NEW.created_by
  );

  INSERT INTO public.invoice_items (
    organization_id, invoice_id, description, quantity, unit_price, discount, total_price
  ) VALUES (
    NEW.organization_id, v_invoice_id, v_item_desc, 1, v_fee, 0, v_fee
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_invoice_on_appointment ON public.appointments;
CREATE TRIGGER trg_auto_invoice_on_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.auto_invoice_on_appointment();

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
     OR v_user.role::TEXT NOT IN ('org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist') THEN
    RAISE EXCEPTION 'Insufficient billing permissions';
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

-- 4. Legacy & Ongoing Patient Financial Account Ledger (debits/credits/physio packages)
CREATE TABLE IF NOT EXISTS public.patient_balance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('legacy_debit', 'legacy_credit', 'debit_payment', 'credit_usage', 'credit_refund')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_mode TEXT CHECK (payment_mode IN ('cash', 'instapay', 'wallet', 'vodafone_cash', 'fawry', 'credit_card', 'bank_transfer', 'insurance')),
  description TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_legacy BOOLEAN NOT NULL DEFAULT true,
  reference_no TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_balance_entries_org_patient
  ON public.patient_balance_entries(organization_id, patient_id, entry_date DESC, created_at DESC);

ALTER TABLE public.patient_balance_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation on patient balance entries" ON public.patient_balance_entries;
CREATE POLICY "Tenant isolation on patient balance entries"
  ON public.patient_balance_entries
  FOR ALL
  TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'medical_director', 'doctor', 'assistant_doctor', 'nurse', 'receptionist', 'accountant', 'records_officer'])
    )
    OR (
      patient_id IN (SELECT pt.id FROM public.patients pt WHERE pt.auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist', 'records_officer'])
    )
  );

GRANT SELECT, INSERT ON public.patient_balance_entries TO authenticated;

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

  IF v_user.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_patient.organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_user.organization_id IS DISTINCT FROM v_patient.organization_id
     OR v_user.role::TEXT NOT IN ('org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist', 'records_officer') THEN
    RAISE EXCEPTION 'Insufficient permission to modify patient account balance';
  END IF;

  IF p_entry_type NOT IN ('legacy_debit', 'legacy_credit', 'debit_payment', 'credit_usage', 'credit_refund')
     OR p_amount IS NULL OR p_amount <= 0
     OR NULLIF(BTRIM(p_description), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid patient balance entry details';
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
      IF v_cashbox.current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient cashbox balance for refund';
      END IF;
      UPDATE public.cashboxes SET current_balance = current_balance - p_amount WHERE id = v_cashbox.id;
    END IF;
  END IF;

  INSERT INTO public.patient_balance_entries (
    organization_id, branch_id, patient_id, entry_type, amount, payment_mode,
    description, entry_date, is_legacy, reference_no, created_by
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
    auth.uid()
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

REVOKE ALL ON FUNCTION public.record_patient_balance_entry(UUID, TEXT, NUMERIC, TEXT, DATE, TEXT, UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_patient_balance_entry(UUID, TEXT, NUMERIC, TEXT, DATE, TEXT, UUID, BOOLEAN, TEXT) TO authenticated;
