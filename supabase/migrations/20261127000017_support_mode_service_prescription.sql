-- ============================================================================
-- Enable audited super_admin Support Mode on save_service & issue_prescription
-- (matching create_invoice & record_invoice_payment in migration 20261127000008)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.save_service(
  p_code TEXT,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_category TEXT,
  p_price NUMERIC,
  p_cost NUMERIC DEFAULT 0
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_target_org UUID;
  v_service_id UUID;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactive user';
  END IF;

  IF v_user.role = 'super_admin' THEN
    SELECT s.organization_id INTO v_target_org
    FROM public.platform_support_sessions s
    WHERE s.platform_user_id = auth.uid()
      AND s.ended_at IS NULL
      AND s.expires_at > NOW()
    ORDER BY s.started_at DESC
    LIMIT 1;
    IF v_target_org IS NULL THEN
      RAISE EXCEPTION 'Active support session required to modify service catalog';
    END IF;
  ELSIF v_user.role IN ('org_owner', 'general_manager') THEN
    v_target_org := v_user.organization_id;
  ELSE
    RAISE EXCEPTION 'Only facility managers may change the service catalog';
  END IF;

  IF v_target_org IS NULL
     OR NULLIF(BTRIM(p_code), '') IS NULL
     OR NULLIF(BTRIM(p_name_ar), '') IS NULL
     OR NULLIF(BTRIM(p_name_en), '') IS NULL
     OR NULLIF(BTRIM(p_category), '') IS NULL
     OR p_price < 0 OR p_cost < 0 OR p_cost > p_price THEN
    RAISE EXCEPTION 'Invalid service details';
  END IF;

  INSERT INTO public.services (organization_id, code, name_ar, name_en, category, standard_price, cost, is_active)
  VALUES (v_target_org, UPPER(BTRIM(p_code)), BTRIM(p_name_ar), BTRIM(p_name_en), BTRIM(p_category), p_price, p_cost, true)
  ON CONFLICT (organization_id, code) DO UPDATE
    SET name_ar = EXCLUDED.name_ar,
        name_en = EXCLUDED.name_en,
        category = EXCLUDED.category,
        standard_price = EXCLUDED.standard_price,
        cost = EXCLUDED.cost,
        is_active = true
  RETURNING id INTO v_service_id;

  RETURN v_service_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_prescription(
  p_consultation_id UUID,
  p_items JSONB,
  p_diagnosis_summary TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (prescription_id UUID, prescription_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user public.users%ROWTYPE;
  v_consultation public.consultations%ROWTYPE;
  v_prescription UUID := gen_random_uuid();
  v_number TEXT := 'RX-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
  v_item JSONB;
  v_count INTEGER := 0;
BEGIN
  SELECT * INTO v_user FROM public.users WHERE id = auth.uid() AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inactive user';
  END IF;

  SELECT * INTO v_consultation FROM public.consultations
  WHERE id = p_consultation_id AND status = 'finalized';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Signed consultation is unavailable';
  END IF;

  IF v_user.role = 'super_admin' THEN
    IF NOT public.has_active_support_session(v_consultation.organization_id) THEN
      RAISE EXCEPTION 'Active support session required for prescription';
    END IF;
  ELSIF v_user.organization_id IS DISTINCT FROM v_consultation.organization_id
     OR v_user.role NOT IN ('org_owner', 'general_manager', 'doctor', 'assistant_doctor') THEN
    RAISE EXCEPTION 'Insufficient clinical permissions';
  END IF;

  IF NOT public.user_has_branch_access(v_consultation.branch_id) THEN
    RAISE EXCEPTION 'Signed consultation branch is unavailable';
  END IF;

  IF v_user.role IN ('doctor', 'assistant_doctor') AND NOT EXISTS (
    SELECT 1 FROM public.doctors d WHERE d.id = v_consultation.doctor_id AND d.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Clinicians may prescribe only for their own consultations';
  END IF;

  IF COALESCE(jsonb_typeof(p_items), '') <> 'array'
     OR jsonb_array_length(p_items) < 1
     OR jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION 'A prescription must contain between 1 and 30 items';
  END IF;

  INSERT INTO public.prescriptions (
    id, organization_id, branch_id, consultation_id, patient_id, doctor_id,
    prescription_number, issued_date, diagnosis_summary, notes
  ) VALUES (
    v_prescription, v_consultation.organization_id, v_consultation.branch_id,
    v_consultation.id, v_consultation.patient_id, v_consultation.doctor_id,
    v_number, CURRENT_DATE, NULLIF(BTRIM(p_diagnosis_summary), ''), NULLIF(BTRIM(p_notes), '')
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF NULLIF(BTRIM(v_item->>'drug_name'), '') IS NULL
       OR NULLIF(BTRIM(v_item->>'dosage'), '') IS NULL
       OR NULLIF(BTRIM(v_item->>'frequency'), '') IS NULL
       OR NULLIF(BTRIM(v_item->>'duration'), '') IS NULL
       OR COALESCE((v_item->>'quantity')::INTEGER, 0) < 1
       OR COALESCE((v_item->>'quantity')::INTEGER, 0) > 10000 THEN
      RAISE EXCEPTION 'Each prescription item needs a medication, dose, frequency, duration, and valid quantity';
    END IF;

    INSERT INTO public.prescription_items (
      organization_id, prescription_id, drug_name, dosage, frequency, duration, quantity, instructions
    ) VALUES (
      v_consultation.organization_id,
      v_prescription,
      LEFT(BTRIM(v_item->>'drug_name'), 255),
      LEFT(BTRIM(v_item->>'dosage'), 100),
      LEFT(BTRIM(v_item->>'frequency'), 100),
      LEFT(BTRIM(v_item->>'duration'), 100),
      (v_item->>'quantity')::INTEGER,
      NULLIF(LEFT(BTRIM(v_item->>'instructions'), 2000), '')
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_prescription, v_number;
END;
$$;
