-- ============================================================================
-- MEDICORE – Subscription Plans Full CRUD, Patient Quota Column,
-- Real Usage Metrics RPC & Soft-Enforcement DB Quota Triggers
-- ============================================================================

-- 1. Add max_patients quota column (0 = unlimited)
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_patients INTEGER NOT NULL DEFAULT 500;

UPDATE public.subscription_plans SET max_patients = 200 WHERE slug = 'starter' AND max_patients = 500;
UPDATE public.subscription_plans SET max_patients = 1500 WHERE slug = 'professional' AND max_patients = 500;
UPDATE public.subscription_plans SET max_patients = 10000 WHERE slug = 'medical_center' AND max_patients = 500;
UPDATE public.subscription_plans SET max_patients = 0, max_branches = 0, max_doctors = 0, max_users = 0 WHERE slug = 'enterprise' AND max_patients = 500;

-- 2. Live facility quota & usage lookup RPC for Clinic UI notices & meters
CREATE OR REPLACE FUNCTION public.get_org_plan_limits(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_sub RECORD;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF v_user.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(p_org_id) THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  ELSIF v_user.organization_id IS DISTINCT FROM p_org_id THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT
    s.status::TEXT AS subscription_status,
    s.cycle::TEXT AS billing_cycle,
    p.id AS plan_id,
    p.name_ar AS plan_name_ar,
    p.name_en AS plan_name_en,
    p.max_branches,
    p.max_doctors,
    p.max_users,
    p.max_patients,
    p.max_storage_mb
  INTO v_sub
  FROM public.subscriptions s
  JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE s.organization_id = p_org_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'subscription_status', COALESCE(v_sub.subscription_status, 'none'),
    'plan_id', v_sub.plan_id,
    'plan_name_ar', COALESCE(v_sub.plan_name_ar, 'الافتراضية'),
    'plan_name_en', COALESCE(v_sub.plan_name_en, 'Default'),
    'limits', jsonb_build_object(
      'max_branches', COALESCE(v_sub.max_branches, 1),
      'max_doctors', COALESCE(v_sub.max_doctors, 2),
      'max_users', COALESCE(v_sub.max_users, 5),
      'max_patients', COALESCE(v_sub.max_patients, 200)
    ),
    'usage', jsonb_build_object(
      'branches', (SELECT COUNT(*) FROM public.branches b WHERE b.organization_id = p_org_id AND b.is_active),
      'doctors', (SELECT COUNT(*) FROM public.doctors d WHERE d.organization_id = p_org_id AND d.is_active),
      'users', (SELECT COUNT(*) FROM public.users u WHERE u.organization_id = p_org_id AND u.is_active AND u.role <> 'patient'),
      'patients', (SELECT COUNT(*) FROM public.patients pt WHERE pt.organization_id = p_org_id AND pt.is_active)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_plan_limits(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_plan_limits(UUID) TO authenticated;

-- 3. Quota enforcement trigger: blocks ONLY NEW additions once quota reached,
--    leaving existing record updates, consultations, billing & HR fully operational.
CREATE OR REPLACE FUNCTION public.enforce_subscription_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_plan RECORD;
  v_count INTEGER;
BEGIN
  v_org_id := NEW.organization_id;
  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow initial Main Branch creation during facility provisioning
  IF TG_TABLE_NAME = 'branches' AND COALESCE(NEW.is_main_branch, false) THEN
    RETURN NEW;
  END IF;

  -- On users UPDATE, only enforce when newly joining org or reactivating non-patient staff
  IF TG_TABLE_NAME = 'users' THEN
    IF NEW.role = 'patient' OR NOT NEW.is_active THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.organization_id IS NOT DISTINCT FROM NEW.organization_id AND OLD.is_active THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT p.max_branches, p.max_doctors, p.max_users, p.max_patients
  INTO v_plan
  FROM public.subscriptions s
  JOIN public.subscription_plans p ON p.id = s.plan_id
  WHERE s.organization_id = v_org_id
    AND s.status IN ('trialing', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'branches' AND v_plan.max_branches > 0 THEN
    SELECT COUNT(*) INTO v_count FROM public.branches WHERE organization_id = v_org_id AND is_active;
    IF v_count >= v_plan.max_branches THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED:branches:%', v_plan.max_branches USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'doctors' AND v_plan.max_doctors > 0 THEN
    SELECT COUNT(*) INTO v_count FROM public.doctors WHERE organization_id = v_org_id AND is_active;
    IF v_count >= v_plan.max_doctors THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED:doctors:%', v_plan.max_doctors USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'users' AND v_plan.max_users > 0 THEN
    SELECT COUNT(*) INTO v_count
    FROM public.users
    WHERE organization_id = v_org_id AND is_active AND role <> 'patient' AND id IS DISTINCT FROM NEW.id;
    IF v_count >= v_plan.max_users THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED:users:%', v_plan.max_users USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'patients' AND v_plan.max_patients > 0 THEN
    SELECT COUNT(*) INTO v_count FROM public.patients WHERE organization_id = v_org_id AND is_active;
    IF v_count >= v_plan.max_patients THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED:patients:%', v_plan.max_patients USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quota_branches ON public.branches;
CREATE TRIGGER trg_quota_branches
  BEFORE INSERT ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_quota();

DROP TRIGGER IF EXISTS trg_quota_doctors ON public.doctors;
CREATE TRIGGER trg_quota_doctors
  BEFORE INSERT ON public.doctors
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_quota();

DROP TRIGGER IF EXISTS trg_quota_users ON public.users;
CREATE TRIGGER trg_quota_users
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_quota();

DROP TRIGGER IF EXISTS trg_quota_patients ON public.patients;
CREATE TRIGGER trg_quota_patients
  BEFORE INSERT ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.enforce_subscription_quota();

-- 4. Platform Admin RPCs for Subscription Plans CRUD
CREATE OR REPLACE FUNCTION public.platform_save_subscription_plan(
  p_actor_id UUID,
  p_plan_id UUID DEFAULT NULL,
  p_slug TEXT DEFAULT NULL,
  p_name_ar TEXT DEFAULT NULL,
  p_name_en TEXT DEFAULT NULL,
  p_tier TEXT DEFAULT 'starter',
  p_price_monthly NUMERIC DEFAULT 0,
  p_price_annual NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'EGP',
  p_max_branches INTEGER DEFAULT 1,
  p_max_doctors INTEGER DEFAULT 3,
  p_max_users INTEGER DEFAULT 10,
  p_max_patients INTEGER DEFAULT 500,
  p_max_storage_mb INTEGER DEFAULT 2048,
  p_has_laboratory BOOLEAN DEFAULT false,
  p_has_radiology BOOLEAN DEFAULT false,
  p_has_inventory BOOLEAN DEFAULT false,
  p_has_insurance BOOLEAN DEFAULT false,
  p_has_specialty_canvas BOOLEAN DEFAULT true,
  p_has_accounting_ledger BOOLEAN DEFAULT false,
  p_has_patient_portal BOOLEAN DEFAULT true,
  p_has_dedicated_db BOOLEAN DEFAULT false,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_plan_id UUID;
  v_actor_name TEXT;
  v_clean_slug TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = p_actor_id AND u.role = 'super_admin' AND u.is_active
  ) THEN
    RAISE EXCEPTION 'An active platform administrator is required';
  END IF;
  IF NULLIF(BTRIM(p_name_ar), '') IS NULL OR NULLIF(BTRIM(p_name_en), '') IS NULL THEN
    RAISE EXCEPTION 'Plan Arabic and English names are required';
  END IF;
  IF p_tier NOT IN ('starter', 'professional', 'medical_center', 'enterprise') THEN
    RAISE EXCEPTION 'Unsupported plan tier';
  END IF;
  IF p_price_monthly < 0 OR p_price_annual < 0 OR p_max_branches < 0 OR p_max_doctors < 0 OR p_max_users < 0 OR p_max_patients < 0 OR p_max_storage_mb < 100 THEN
    RAISE EXCEPTION 'Plan prices and limits must be non-negative';
  END IF;

  v_clean_slug := LOWER(REGEXP_REPLACE(COALESCE(NULLIF(BTRIM(p_slug), ''), p_name_en), '[^a-zA-Z0-9_-]+', '-', 'g'));
  SELECT COALESCE(name_en, email) INTO v_actor_name FROM public.users WHERE id = p_actor_id;

  IF p_plan_id IS NOT NULL THEN
    UPDATE public.subscription_plans SET
      slug = v_clean_slug,
      name_ar = BTRIM(p_name_ar),
      name_en = BTRIM(p_name_en),
      tier = p_tier::public.subscription_tier,
      price_monthly = p_price_monthly,
      price_annual = p_price_annual,
      currency = COALESCE(NULLIF(BTRIM(p_currency), ''), 'EGP'),
      max_branches = p_max_branches,
      max_doctors = p_max_doctors,
      max_users = p_max_users,
      max_patients = p_max_patients,
      max_storage_mb = p_max_storage_mb,
      has_laboratory = p_has_laboratory,
      has_radiology = p_has_radiology,
      has_inventory = p_has_inventory,
      has_insurance = p_has_insurance,
      has_specialty_canvas = p_has_specialty_canvas,
      has_accounting_ledger = p_has_accounting_ledger,
      has_patient_portal = p_has_patient_portal,
      has_dedicated_db = p_has_dedicated_db,
      is_active = p_is_active,
      updated_at = NOW()
    WHERE id = p_plan_id
    RETURNING id INTO v_plan_id;

    IF v_plan_id IS NULL THEN
      RAISE EXCEPTION 'Subscription plan not found';
    END IF;

    INSERT INTO public.audit_logs (
      organization_id, user_id, user_name, action, entity_type, entity_id, new_values
    ) VALUES (
      NULL, p_actor_id, v_actor_name, 'PLATFORM_PLAN_UPDATE', 'subscription_plans', v_plan_id::TEXT,
      jsonb_build_object('slug', v_clean_slug, 'price_monthly', p_price_monthly, 'max_branches', p_max_branches, 'max_doctors', p_max_doctors, 'max_patients', p_max_patients)
    );
  ELSE
    INSERT INTO public.subscription_plans (
      slug, name_ar, name_en, tier, price_monthly, price_annual, currency,
      max_branches, max_doctors, max_users, max_patients, max_storage_mb,
      has_laboratory, has_radiology, has_inventory, has_insurance,
      has_specialty_canvas, has_accounting_ledger, has_patient_portal, has_dedicated_db, is_active
    ) VALUES (
      v_clean_slug, BTRIM(p_name_ar), BTRIM(p_name_en), p_tier::public.subscription_tier,
      p_price_monthly, p_price_annual, COALESCE(NULLIF(BTRIM(p_currency), ''), 'EGP'),
      p_max_branches, p_max_doctors, p_max_users, p_max_patients, p_max_storage_mb,
      p_has_laboratory, p_has_radiology, p_has_inventory, p_has_insurance,
      p_has_specialty_canvas, p_has_accounting_ledger, p_has_patient_portal, p_has_dedicated_db, p_is_active
    )
    RETURNING id INTO v_plan_id;

    INSERT INTO public.audit_logs (
      organization_id, user_id, user_name, action, entity_type, entity_id, new_values
    ) VALUES (
      NULL, p_actor_id, v_actor_name, 'PLATFORM_PLAN_CREATE', 'subscription_plans', v_plan_id::TEXT,
      jsonb_build_object('slug', v_clean_slug, 'price_monthly', p_price_monthly, 'max_branches', p_max_branches, 'max_doctors', p_max_doctors, 'max_patients', p_max_patients)
    );
  END IF;

  RETURN v_plan_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_save_subscription_plan(UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_save_subscription_plan(UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO service_role;

CREATE OR REPLACE FUNCTION public.platform_delete_subscription_plan(
  p_actor_id UUID,
  p_plan_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_actor_name TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = p_actor_id AND u.role = 'super_admin' AND u.is_active
  ) THEN
    RAISE EXCEPTION 'An active platform administrator is required';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription plan not found';
  END IF;

  IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.plan_id = p_plan_id) THEN
    RAISE EXCEPTION 'Cannot delete a plan currently assigned to facilities; migrate or deactivate it instead';
  END IF;

  DELETE FROM public.subscription_plans WHERE id = p_plan_id;

  SELECT COALESCE(name_en, email) INTO v_actor_name FROM public.users WHERE id = p_actor_id;
  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, old_values
  ) VALUES (
    NULL, p_actor_id, v_actor_name, 'PLATFORM_PLAN_DELETE', 'subscription_plans', p_plan_id::TEXT,
    jsonb_build_object('slug', v_plan.slug, 'name_ar', v_plan.name_ar, 'name_en', v_plan.name_en)
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_delete_subscription_plan(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_delete_subscription_plan(UUID, UUID) TO service_role;
