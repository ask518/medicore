-- Fix platform_delete_facility failing with "Signed consultations cannot be edited"
-- by deleting dependent tenant clinical/billing records explicitly before
-- deleting organizations instead of running UPDATE on immutable consultations.

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

  -- Explicitly remove tenant records in dependency order before deleting the organization
  -- so ON DELETE SET NULL / FK triggers do not try to UPDATE immutable signed consultations.
  DELETE FROM public.medical_attachments WHERE organization_id = p_organization_id;
  DELETE FROM public.laboratory_results WHERE organization_id = p_organization_id;
  DELETE FROM public.laboratory_orders WHERE organization_id = p_organization_id;
  DELETE FROM public.radiology_orders WHERE organization_id = p_organization_id;
  DELETE FROM public.prescription_items WHERE organization_id = p_organization_id;
  DELETE FROM public.prescriptions WHERE organization_id = p_organization_id;
  DELETE FROM public.doctor_commissions WHERE organization_id = p_organization_id;
  DELETE FROM public.payments WHERE organization_id = p_organization_id;
  DELETE FROM public.patient_balance_entries WHERE organization_id = p_organization_id;
  DELETE FROM public.invoice_items WHERE organization_id = p_organization_id;
  DELETE FROM public.invoices WHERE organization_id = p_organization_id;
  DELETE FROM public.anatomical_findings WHERE organization_id = p_organization_id;
  DELETE FROM public.consultations WHERE organization_id = p_organization_id;
  DELETE FROM public.appointments WHERE organization_id = p_organization_id;
  DELETE FROM public.expenses WHERE organization_id = p_organization_id;
  DELETE FROM public.cashboxes WHERE organization_id = p_organization_id;
  DELETE FROM public.inventory_movements WHERE organization_id = p_organization_id;
  DELETE FROM public.platform_transactions WHERE organization_id = p_organization_id;
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
