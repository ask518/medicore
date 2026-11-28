-- ============================================================================
-- MEDICORE – Platform Metrics RPC, Safe Org Cascade Audit & Lifecycle Controls
-- ============================================================================

-- 1. Make log_record_audit cascade-safe when a facility is permanently deleted.
CREATE OR REPLACE FUNCTION public.log_record_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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
    v_action := 'CREATE';
    v_row := to_jsonb(NEW);
    v_org_id := NEW.organization_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'UPDATE';
    v_row := to_jsonb(NEW);
    v_old := to_jsonb(OLD);
    v_org_id := NEW.organization_id;
  ELSE
    v_action := 'DELETE';
    v_row := to_jsonb(OLD);
    v_old := to_jsonb(OLD);
    v_org_id := OLD.organization_id;
    IF v_org_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = v_org_id) THEN
      RETURN NULL;
    END IF;
  END IF;

  v_branch_id := COALESCE(
    NULLIF(v_row->>'branch_id', '')::UUID,
    NULLIF(v_row->>'primary_branch_id', '')::UUID
  );
  IF v_branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = v_branch_id) THEN
    v_branch_id := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_values, new_values, created_at
  ) VALUES (
    v_org_id,
    v_branch_id,
    v_user_id,
    v_action,
    TG_TABLE_NAME,
    v_row->>'id',
    v_old,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE v_row END,
    NOW()
  );
  RETURN NULL;
END;
$$;

-- 2. Platform overview metrics & recent audits for authenticated super_admin only.
CREATE OR REPLACE FUNCTION public.platform_overview_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_totals JSONB;
  v_by_org JSONB;
  v_recent_audits JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'An active platform super admin is required' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'organizations', (SELECT COUNT(*) FROM public.organizations),
    'active_organizations', (SELECT COUNT(*) FROM public.organizations WHERE status = 'active'),
    'suspended_organizations', (SELECT COUNT(*) FROM public.organizations WHERE status = 'suspended'),
    'pending_organizations', (SELECT COUNT(*) FROM public.organizations WHERE status = 'pending_approval'),
    'branches', (SELECT COUNT(*) FROM public.branches),
    'users', (SELECT COUNT(*) FROM public.users),
    'patients', (SELECT COUNT(*) FROM public.patients),
    'appointments', (SELECT COUNT(*) FROM public.appointments),
    'consultations', (SELECT COUNT(*) FROM public.consultations),
    'invoices', (SELECT COUNT(*) FROM public.invoices),
    'laboratory_orders', (SELECT COUNT(*) FROM public.laboratory_orders),
    'radiology_orders', (SELECT COUNT(*) FROM public.radiology_orders),
    'active_announcements', (SELECT COUNT(*) FROM public.system_announcements WHERE is_active)
  ) INTO v_totals;

  SELECT COALESCE(jsonb_agg(row_to_json(org_stats) ORDER BY org_stats.created_at DESC), '[]'::jsonb)
  INTO v_by_org
  FROM (
    SELECT
      o.id AS organization_id,
      o.name_ar,
      o.name_en,
      o.status::TEXT AS status,
      o.facility_type::TEXT AS facility_type,
      o.created_at,
      (SELECT COUNT(*) FROM public.branches b WHERE b.organization_id = o.id) AS branches_count,
      (SELECT COUNT(*) FROM public.users u WHERE u.organization_id = o.id) AS users_count,
      (SELECT COUNT(*) FROM public.patients p WHERE p.organization_id = o.id) AS patients_count,
      (SELECT COUNT(*) FROM public.appointments a WHERE a.organization_id = o.id) AS appointments_count,
      (SELECT COUNT(*) FROM public.invoices i WHERE i.organization_id = o.id) AS invoices_count
    FROM public.organizations o
  ) org_stats;

  SELECT COALESCE(jsonb_agg(row_to_json(a_row)), '[]'::jsonb)
  INTO v_recent_audits
  FROM (
    SELECT
      al.id,
      al.organization_id,
      COALESCE(al.user_name, u.name_en, u.email, 'system') AS user_name,
      al.action,
      al.entity_type,
      al.entity_id,
      al.created_at
    FROM public.audit_logs al
    LEFT JOIN public.users u ON u.id = al.user_id
    ORDER BY al.created_at DESC
    LIMIT 15
  ) a_row;

  RETURN jsonb_build_object(
    'totals', v_totals,
    'by_organization', v_by_org,
    'recent_audits', v_recent_audits
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_overview_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_overview_metrics() TO authenticated;

-- 3. Facility status lifecycle helper (service_role / platform-admin Edge Function).
CREATE OR REPLACE FUNCTION public.platform_set_facility_status(
  p_actor_id UUID,
  p_organization_id UUID,
  p_status TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_old_status TEXT;
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
  IF p_status NOT IN ('pending_approval', 'active', 'suspended', 'archived') THEN
    RAISE EXCEPTION 'Unsupported organization status';
  END IF;

  SELECT o.status::TEXT INTO v_old_status FROM public.organizations o WHERE o.id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facility not found';
  END IF;

  UPDATE public.organizations
  SET status = p_status::public.organization_status, updated_at = NOW()
  WHERE id = p_organization_id;

  IF p_status IN ('suspended', 'archived') THEN
    UPDATE public.platform_support_sessions
    SET ended_at = NOW(), end_reason = 'user_exit'
    WHERE organization_id = p_organization_id AND ended_at IS NULL;
  END IF;

  SELECT COALESCE(name_en, email) INTO v_actor_name FROM public.users WHERE id = p_actor_id;
  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, old_values, new_values
  ) VALUES (
    p_organization_id,
    p_actor_id,
    v_actor_name,
    'PLATFORM_FACILITY_STATUS',
    'organizations',
    p_organization_id::TEXT,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_status)
  );

  RETURN p_status;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_set_facility_status(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_set_facility_status(UUID, UUID, TEXT) TO service_role;

-- 4. Subscription plan/status management (service_role / platform-admin Edge Function).
CREATE OR REPLACE FUNCTION public.platform_update_subscription(
  p_actor_id UUID,
  p_organization_id UUID,
  p_plan_id UUID,
  p_status TEXT,
  p_cycle TEXT,
  p_period_end TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_sub public.subscriptions%ROWTYPE;
  v_amount NUMERIC(12, 2);
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
  IF p_status NOT IN ('trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended') THEN
    RAISE EXCEPTION 'Unsupported subscription status';
  END IF;
  IF p_cycle NOT IN ('monthly', 'annual', 'lifetime', 'trial') THEN
    RAISE EXCEPTION 'Unsupported billing cycle';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RAISE EXCEPTION 'Facility not found';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription plan not found';
  END IF;

  v_amount := CASE
    WHEN p_cycle = 'trial' THEN 0.00
    WHEN p_cycle = 'annual' THEN v_plan.price_annual
    ELSE v_plan.price_monthly
  END;

  SELECT COALESCE(name_en, email) INTO v_actor_name FROM public.users WHERE id = p_actor_id;

  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE organization_id = p_organization_id
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.subscriptions
    SET
      plan_id = p_plan_id,
      status = p_status::public.subscription_status,
      cycle = p_cycle::public.billing_cycle,
      amount = v_amount,
      currency = v_plan.currency,
      current_period_end = COALESCE(p_period_end, current_period_end),
      canceled_at = CASE WHEN p_status = 'canceled' THEN NOW() ELSE NULL END,
      updated_at = NOW()
    WHERE id = v_sub.id;
  ELSE
    INSERT INTO public.subscriptions (
      organization_id, plan_id, status, cycle, amount, currency, current_period_end
    ) VALUES (
      p_organization_id,
      p_plan_id,
      p_status::public.subscription_status,
      p_cycle::public.billing_cycle,
      v_amount,
      v_plan.currency,
      COALESCE(p_period_end, NOW() + INTERVAL '30 days')
    )
    RETURNING * INTO v_sub;
  END IF;

  INSERT INTO public.subscription_events (
    organization_id, subscription_id, event_type, description, actor_id, actor_name, metadata
  ) VALUES (
    p_organization_id,
    v_sub.id,
    'PLATFORM_UPDATE',
    format('Updated to %s (%s / %s)', v_plan.slug, p_status, p_cycle),
    p_actor_id,
    v_actor_name,
    jsonb_build_object('plan_id', p_plan_id, 'status', p_status, 'cycle', p_cycle, 'amount', v_amount)
  );

  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, new_values
  ) VALUES (
    p_organization_id,
    p_actor_id,
    v_actor_name,
    'PLATFORM_SUBSCRIPTION_UPDATE',
    'subscriptions',
    v_sub.id::TEXT,
    jsonb_build_object('plan_slug', v_plan.slug, 'status', p_status, 'cycle', p_cycle, 'amount', v_amount)
  );

  RETURN v_sub.id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_update_subscription(UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_subscription(UUID, UUID, UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- 5. Permanent facility delete (service_role only, logs platform-level audit, returns auth user IDs to delete).
CREATE OR REPLACE FUNCTION public.platform_delete_facility(
  p_actor_id UUID,
  p_organization_id UUID
)
RETURNS TABLE(deleted_org_id UUID, deleted_user_ids UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_actor_name TEXT;
  v_user_ids UUID[];
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = p_actor_id AND u.role = 'super_admin' AND u.is_active
  ) THEN
    RAISE EXCEPTION 'An active platform administrator is required';
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Facility not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.users u WHERE u.organization_id = p_organization_id AND u.role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'Refusing to delete an organization linked to a super admin account';
  END IF;

  SELECT COALESCE(array_agg(u.id), ARRAY[]::UUID[])
  INTO v_user_ids
  FROM public.users u
  WHERE u.organization_id = p_organization_id AND u.role <> 'super_admin';

  -- Detach non-cascading nullable audit/actor user references within this tenant before cascade delete.
  UPDATE public.appointments SET cancelled_by = NULL, created_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.consultations SET signed_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.laboratory_orders SET technician_id = NULL, approved_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.radiology_orders SET radiologist_id = NULL WHERE organization_id = p_organization_id;
  UPDATE public.medical_attachments SET uploaded_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.queues SET assigned_user_id = NULL WHERE organization_id = p_organization_id;
  UPDATE public.invoices SET created_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.payments SET received_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.expenses SET approved_by = NULL WHERE organization_id = p_organization_id;

  DELETE FROM public.platform_support_sessions WHERE organization_id = p_organization_id;
  DELETE FROM public.organizations WHERE id = p_organization_id;

  SELECT COALESCE(name_en, email) INTO v_actor_name FROM public.users WHERE id = p_actor_id;
  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, old_values, new_values
  ) VALUES (
    NULL,
    p_actor_id,
    v_actor_name,
    'PLATFORM_DELETE_FACILITY',
    'organizations',
    p_organization_id::TEXT,
    jsonb_build_object(
      'name_ar', v_org.name_ar,
      'name_en', v_org.name_en,
      'email', v_org.email,
      'deleted_users_count', COALESCE(array_length(v_user_ids, 1), 0)
    ),
    jsonb_build_object('deleted', true)
  );

  RETURN QUERY SELECT p_organization_id, v_user_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_delete_facility(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_delete_facility(UUID, UUID) TO service_role;
