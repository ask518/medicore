-- Fix enforce_subscription_quota() shared trigger across branches, doctors, users, and patients.
-- Direct NEW.<field> references fail in PL/pgSQL when a trigger runs on a table that lacks that column
-- (e.g., is_main_branch only exists on branches). Reading table-specific fields via to_jsonb(NEW/OLD)
-- avoids cross-table record field binding errors.
CREATE OR REPLACE FUNCTION public.enforce_subscription_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID := NEW.organization_id;
  v_new_json JSONB := to_jsonb(NEW);
  v_old_json JSONB := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_plan RECORD;
  v_count INTEGER;
  v_new_id UUID;
BEGIN
  IF v_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow initial Main Branch creation during facility provisioning
  IF TG_TABLE_NAME = 'branches' THEN
    IF COALESCE((v_new_json->>'is_main_branch')::BOOLEAN, false) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- On users UPDATE, only enforce when newly joining org or reactivating non-patient staff
  IF TG_TABLE_NAME = 'users' THEN
    IF COALESCE(v_new_json->>'role', '') = 'patient' OR NOT COALESCE((v_new_json->>'is_active')::BOOLEAN, true) THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE'
       AND (v_old_json->>'organization_id') IS NOT DISTINCT FROM (v_new_json->>'organization_id')
       AND COALESCE((v_old_json->>'is_active')::BOOLEAN, false) THEN
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
    v_new_id := NULLIF(v_new_json->>'id', '')::UUID;
    SELECT COUNT(*) INTO v_count
    FROM public.users
    WHERE organization_id = v_org_id AND is_active AND role <> 'patient' AND id IS DISTINCT FROM v_new_id;
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
