-- ============================================================================
-- Fix column/table names inside platform_delete_facility against initial schema
-- ============================================================================

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

  -- Detach non-cascading nullable actor references within this tenant before cascade delete.
  UPDATE public.appointments SET cancelled_by = NULL, created_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.consultations SET signed_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.laboratory_results SET technician_id = NULL, approved_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.radiology_orders SET radiologist_id = NULL WHERE organization_id = p_organization_id;
  UPDATE public.medical_attachments SET uploaded_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.cashboxes SET assigned_user_id = NULL WHERE organization_id = p_organization_id;
  UPDATE public.invoices SET created_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.payments SET received_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.expenses SET approved_by = NULL WHERE organization_id = p_organization_id;
  UPDATE public.inventory_movements SET created_by = NULL WHERE organization_id = p_organization_id;

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
