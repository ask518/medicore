-- The platform admin endpoint uses the service role only after authenticating
-- an active platform super admin. This function keeps facility creation atomic.
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
  p_facility_type TEXT
)
RETURNS TABLE (organization_id UUID, branch_id UUID, owner_user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID := gen_random_uuid();
  v_branch_id UUID := gen_random_uuid();
  v_plan_id UUID;
  v_plan_amount NUMERIC;
  v_plan_currency TEXT;
  v_slug TEXT := 'clinic-' || REPLACE(gen_random_uuid()::TEXT, '-', '');
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

  SELECT id, price_monthly, currency INTO v_plan_id, v_plan_amount, v_plan_currency
  FROM public.subscription_plans WHERE slug = 'starter' AND is_active LIMIT 1;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'Starter subscription plan is not configured'; END IF;

  INSERT INTO public.organizations (
    id, name_ar, name_en, slug, facility_type, status, email, phone, country, city,
    address, timezone, default_currency
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
    v_org_id, v_plan_id, 'trialing', 'monthly', v_plan_amount, v_plan_currency, NOW() + INTERVAL '14 days'
  );
  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, new_values
  ) VALUES (
    v_org_id, p_actor_id,
    (SELECT COALESCE(name_en, email) FROM public.users WHERE id = p_actor_id),
    'CREATE', 'organizations', v_org_id::TEXT,
    jsonb_build_object('name_ar', BTRIM(p_name_ar), 'name_en', BTRIM(p_name_en), 'owner_user_id', p_owner_user_id)
  );

  RETURN QUERY SELECT v_org_id, v_branch_id, p_owner_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_provision_facility(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_provision_facility(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
