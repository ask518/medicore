CREATE OR REPLACE FUNCTION public.platform_update_facility(
  p_actor_id UUID,
  p_organization_id UUID,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_facility_type TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_city TEXT,
  p_address TEXT
)
RETURNS TABLE (organization_id UUID, main_branch_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_old public.organizations%ROWTYPE;
  v_new public.organizations%ROWTYPE;
  v_branch_id UUID;
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
     OR NULLIF(BTRIM(p_city), '') IS NULL OR NULLIF(BTRIM(p_address), '') IS NULL THEN
    RAISE EXCEPTION 'Facility details are required';
  END IF;
  IF p_facility_type NOT IN ('private_clinic', 'poly_clinic', 'medical_center', 'specialized_center', 'complex', 'hospital') THEN
    RAISE EXCEPTION 'Unsupported facility type';
  END IF;

  SELECT * INTO v_old FROM public.organizations WHERE id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Facility not found'; END IF;

  UPDATE public.organizations SET
    name_ar = BTRIM(p_name_ar), name_en = BTRIM(p_name_en),
    facility_type = p_facility_type::public.facility_type,
    email = LOWER(BTRIM(p_email)), phone = BTRIM(p_phone),
    city = BTRIM(p_city), address = BTRIM(p_address), updated_at = NOW()
  WHERE id = p_organization_id
  RETURNING * INTO v_new;

  UPDATE public.branches AS b SET
    name_ar = BTRIM(p_name_ar), name_en = BTRIM(p_name_en),
    email = LOWER(BTRIM(p_email)), phone = BTRIM(p_phone),
    city = BTRIM(p_city), address = BTRIM(p_address), updated_at = NOW()
  WHERE b.organization_id = p_organization_id AND b.is_main_branch
  RETURNING b.id INTO v_branch_id;

  INSERT INTO public.audit_logs (
    organization_id, user_id, user_name, action, entity_type, entity_id, old_values, new_values
  ) VALUES (
    p_organization_id, p_actor_id,
    (SELECT COALESCE(name_en, email) FROM public.users WHERE id = p_actor_id),
    'UPDATE', 'organizations', p_organization_id::TEXT,
    jsonb_build_object('name_ar', v_old.name_ar, 'name_en', v_old.name_en, 'facility_type', v_old.facility_type,
      'email', v_old.email, 'phone', v_old.phone, 'city', v_old.city, 'address', v_old.address),
    jsonb_build_object('name_ar', v_new.name_ar, 'name_en', v_new.name_en, 'facility_type', v_new.facility_type,
      'email', v_new.email, 'phone', v_new.phone, 'city', v_new.city, 'address', v_new.address)
  );

  RETURN QUERY SELECT p_organization_id, v_branch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_update_facility(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_update_facility(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
