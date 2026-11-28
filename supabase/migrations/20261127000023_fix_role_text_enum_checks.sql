-- Cast v_actor.role::TEXT in role allowlist checks so role strings not present
-- in the base app_role enum (e.g. 'medical_director') never throw SQLSTATE 22P02.

CREATE OR REPLACE FUNCTION public.generate_patient_portal_code(p_patient_id UUID)
RETURNS TABLE(mrn TEXT, activation_code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_raw TEXT;
  v_code TEXT;
  v_expires TIMESTAMPTZ := NOW() + INTERVAL '7 days';
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactive user';
  END IF;

  SELECT * INTO v_patient FROM public.patients WHERE id = p_patient_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Patient not found';
  END IF;

  IF v_actor.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_patient.organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_actor.organization_id IS DISTINCT FROM v_patient.organization_id
     OR v_actor.role::TEXT NOT IN ('org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'receptionist', 'records_officer')
     OR (v_patient.primary_branch_id IS NOT NULL AND NOT public.user_has_branch_access(v_patient.primary_branch_id)) THEN
    RAISE EXCEPTION 'Insufficient permission to issue patient portal activation code';
  END IF;

  v_raw := UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
  v_code := 'MED-' || SUBSTRING(v_raw FROM 1 FOR 4) || '-' || SUBSTRING(v_raw FROM 5 FOR 4);

  UPDATE public.patients
  SET portal_activation_code_hash = encode(sha256(convert_to(v_code, 'UTF8')), 'hex'),
      portal_activation_expires_at = v_expires,
      updated_at = NOW()
  WHERE id = v_patient.id;

  INSERT INTO public.audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (
    v_patient.organization_id,
    v_patient.primary_branch_id,
    v_actor.id,
    'PATIENT_PORTAL_CODE_ISSUED',
    'patient',
    v_patient.id::TEXT,
    jsonb_build_object('mrn', v_patient.mrn, 'expires_at', v_expires)
  );

  RETURN QUERY SELECT v_patient.mrn::TEXT, v_code, v_expires;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_hr_staff_directory(p_organization_id UUID)
RETURNS TABLE(id UUID, name_ar TEXT, name_en TEXT, role TEXT, primary_branch_id UUID, is_active BOOLEAN)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE users.id = auth.uid() AND users.is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactive user';
  END IF;

  IF v_actor.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(p_organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_actor.organization_id IS DISTINCT FROM p_organization_id
     OR v_actor.role::TEXT NOT IN ('org_owner', 'general_manager', 'medical_director', 'branch_manager', 'accountant') THEN
    RAISE EXCEPTION 'Insufficient permissions for HR staff directory';
  END IF;

  RETURN QUERY
  SELECT u.id, u.name_ar::TEXT, u.name_en::TEXT, u.role::TEXT, u.primary_branch_id, u.is_active
  FROM public.users u
  WHERE u.organization_id = p_organization_id
    AND u.role NOT IN ('patient', 'super_admin')
    AND u.is_active = true
  ORDER BY u.name_ar;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_leave_request(
  p_leave_id UUID,
  p_decision TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor public.users%ROWTYPE;
  v_leave public.leave_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_actor FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive user'; END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  SELECT * INTO v_leave FROM public.leave_requests WHERE id = p_leave_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Leave request not found'; END IF;

  IF v_actor.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_leave.organization_id) THEN
      RAISE EXCEPTION 'Active support session required';
    END IF;
  ELSIF v_actor.organization_id IS DISTINCT FROM v_leave.organization_id
     OR v_actor.role::TEXT NOT IN ('org_owner', 'general_manager', 'medical_director', 'branch_manager') THEN
    RAISE EXCEPTION 'Insufficient permission to decide leave requests';
  END IF;

  IF v_leave.user_id = v_actor.id AND v_actor.role <> 'super_admin' THEN
    RAISE EXCEPTION 'Self-approval of leave requests is not permitted';
  END IF;

  IF v_leave.status <> 'pending' THEN
    RAISE EXCEPTION 'Leave request has already been decided';
  END IF;

  UPDATE public.leave_requests
  SET status = p_decision,
      approved_by = v_actor.id,
      decided_at = NOW(),
      notes = COALESCE(NULLIF(BTRIM(p_notes), ''), notes)
  WHERE id = v_leave.id;

  RETURN true;
END;
$$;
