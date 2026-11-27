-- ============================================================================
-- MEDICORE – Verified Patient Portal Account Linking, RLS & Booking RPCs
-- ============================================================================

-- 1. Patient portal linkage columns (zero email-based auto-linking)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS portal_activation_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS portal_activation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS portal_linked_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_org_auth_user
  ON public.patients(organization_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_auth_user
  ON public.patients(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 2. Generate a one-time clinic-verified activation code for a patient
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
     OR v_actor.role NOT IN ('org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'receptionist', 'records_officer')
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

-- 3. Verified claim by authenticated patient user using MRN + activation code
CREATE OR REPLACE FUNCTION public.claim_patient_portal_record(
  p_mrn TEXT,
  p_activation_code TEXT
)
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user public.users%ROWTYPE;
  v_patient public.patients%ROWTYPE;
  v_clean_mrn TEXT := UPPER(BTRIM(COALESCE(p_mrn, '')));
  v_clean_code TEXT := UPPER(BTRIM(COALESCE(p_activation_code, '')));
  v_hash TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = v_uid;
  IF NOT FOUND OR v_user.role <> 'patient' THEN
    RAISE EXCEPTION 'Only patient accounts can claim a patient medical record';
  END IF;

  IF v_clean_mrn = '' OR v_clean_code = '' THEN
    RAISE EXCEPTION 'MRN and activation code are required';
  END IF;

  v_hash := encode(sha256(convert_to(v_clean_code, 'UTF8')), 'hex');

  SELECT * INTO v_patient
  FROM public.patients p
  WHERE UPPER(p.mrn) = v_clean_mrn
    AND p.is_active = true
    AND p.portal_activation_code_hash = v_hash
    AND p.portal_activation_expires_at > NOW()
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired MRN / activation code';
  END IF;

  IF v_patient.auth_user_id IS NOT NULL AND v_patient.auth_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'This medical record is already linked to another account';
  END IF;

  UPDATE public.patients
  SET auth_user_id = v_uid,
      portal_linked_at = NOW(),
      portal_activation_code_hash = NULL,
      portal_activation_expires_at = NULL,
      updated_at = NOW()
  WHERE id = v_patient.id;

  UPDATE public.users
  SET organization_id = v_patient.organization_id,
      primary_branch_id = COALESCE(primary_branch_id, v_patient.primary_branch_id),
      is_active = true,
      name_ar = COALESCE(NULLIF(BTRIM(name_ar), ''), v_patient.first_name_ar || ' ' || v_patient.last_name_ar),
      updated_at = NOW()
  WHERE id = v_uid AND role = 'patient';

  INSERT INTO public.audit_logs (organization_id, branch_id, user_id, action, entity_type, entity_id, new_values)
  VALUES (
    v_patient.organization_id,
    v_patient.primary_branch_id,
    v_uid,
    'PATIENT_PORTAL_LINKED',
    'patient',
    v_patient.id::TEXT,
    jsonb_build_object('mrn', v_patient.mrn)
  );

  RETURN v_patient.id;
END;
$$;

-- 4. Patient booking directory & appointment request RPCs
CREATE OR REPLACE FUNCTION public.get_patient_booking_directory()
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_patient public.patients%ROWTYPE;
  v_org JSONB;
  v_branches JSONB;
  v_doctors JSONB;
BEGIN
  SELECT * INTO v_patient
  FROM public.patients
  WHERE auth_user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false);
  END IF;

  SELECT jsonb_build_object(
    'id', o.id,
    'name_ar', o.name_ar,
    'name_en', o.name_en,
    'phone', o.phone,
    'default_currency', o.default_currency
  ) INTO v_org
  FROM public.organizations o
  WHERE o.id = v_patient.organization_id AND o.status = 'active';

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', b.id, 'name_ar', b.name_ar, 'name_en', b.name_en, 'city', b.city, 'phone', b.phone)
    ORDER BY b.is_main_branch DESC, b.name_ar
  ), '[]'::jsonb) INTO v_branches
  FROM public.branches b
  WHERE b.organization_id = v_patient.organization_id AND b.is_active = true;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'specialty_title_ar', d.specialty_title_ar,
      'specialty_title_en', d.specialty_title_en,
      'consultation_fee', d.consultation_fee,
      'name_ar', u.name_ar,
      'name_en', u.name_en,
      'branch_ids', (
        SELECT COALESCE(jsonb_agg(uba.branch_id), '[]'::jsonb)
        FROM public.user_branch_access uba
        WHERE uba.user_id = d.user_id AND uba.organization_id = v_patient.organization_id
      )
    )
    ORDER BY u.name_ar
  ), '[]'::jsonb) INTO v_doctors
  FROM public.doctors d
  JOIN public.users u ON u.id = d.user_id AND u.is_active = true
  WHERE d.organization_id = v_patient.organization_id AND d.is_active = true;

  RETURN jsonb_build_object(
    'linked', true,
    'organization', v_org,
    'branches', v_branches,
    'doctors', v_doctors
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_patient_portal_records()
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_patient public.patients%ROWTYPE;
  v_appointments JSONB;
  v_prescriptions JSONB;
  v_lab_orders JSONB;
  v_rad_orders JSONB;
  v_invoices JSONB;
  v_attachments JSONB;
BEGIN
  SELECT * INTO v_patient
  FROM public.patients
  WHERE auth_user_id = v_uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('linked', false);
  END IF;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY appointment_date DESC, start_time DESC), '[]'::jsonb)
  INTO v_appointments
  FROM (
    SELECT
      a.appointment_date,
      a.start_time,
      jsonb_build_object(
        'id', a.id,
        'appointment_number', a.appointment_number,
        'appointment_date', a.appointment_date,
        'start_time', a.start_time,
        'end_time', a.end_time,
        'status', a.status,
        'type', a.type,
        'chief_complaint_note', a.chief_complaint_note,
        'branch_name_ar', b.name_ar,
        'branch_name_en', b.name_en,
        'doctor_name_ar', u.name_ar,
        'doctor_name_en', u.name_en,
        'specialty_title_ar', d.specialty_title_ar,
        'specialty_title_en', d.specialty_title_en
      ) AS row_data
    FROM public.appointments a
    JOIN public.branches b ON b.id = a.branch_id
    JOIN public.doctors d ON d.id = a.doctor_id
    JOIN public.users u ON u.id = d.user_id
    WHERE a.patient_id = v_patient.id AND a.organization_id = v_patient.organization_id
    ORDER BY a.appointment_date DESC, a.start_time DESC
    LIMIT 50
  ) sub;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY issued_date DESC, created_at DESC), '[]'::jsonb)
  INTO v_prescriptions
  FROM (
    SELECT
      p.issued_date,
      p.created_at,
      jsonb_build_object(
        'id', p.id,
        'prescription_number', p.prescription_number,
        'issued_date', p.issued_date,
        'diagnosis_summary', p.diagnosis_summary,
        'notes', p.notes,
        'is_dispensed', p.is_dispensed,
        'doctor_name_ar', u.name_ar,
        'doctor_name_en', u.name_en,
        'items', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', pi.id,
              'drug_name', pi.drug_name,
              'dosage', pi.dosage,
              'frequency', pi.frequency,
              'duration', pi.duration,
              'quantity', pi.quantity,
              'instructions', pi.instructions
            )
          ), '[]'::jsonb)
          FROM public.prescription_items pi
          WHERE pi.prescription_id = p.id
        )
      ) AS row_data
    FROM public.prescriptions p
    JOIN public.doctors d ON d.id = p.doctor_id
    JOIN public.users u ON u.id = d.user_id
    WHERE p.patient_id = v_patient.id AND p.organization_id = v_patient.organization_id
    ORDER BY p.issued_date DESC, p.created_at DESC
    LIMIT 50
  ) sub;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_lab_orders
  FROM (
    SELECT
      lo.created_at,
      jsonb_build_object(
        'id', lo.id,
        'order_number', lo.order_number,
        'status', lo.status,
        'priority', lo.priority,
        'created_at', lo.created_at,
        'doctor_name_ar', u.name_ar,
        'doctor_name_en', u.name_en,
        'results', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'id', lr.id,
              'test_code', lt.test_code,
              'test_name_ar', lt.name_ar,
              'test_name_en', lt.name_en,
              'result_value', lr.result_value,
              'unit', lr.unit,
              'reference_range', lr.reference_range,
              'is_abnormal', lr.is_abnormal,
              'interpretation', lr.interpretation,
              'approved_at', lr.approved_at
            )
          ), '[]'::jsonb)
          FROM public.laboratory_results lr
          JOIN public.laboratory_tests lt ON lt.id = lr.test_id
          WHERE lr.order_id = lo.id AND lr.approved_at IS NOT NULL
        )
      ) AS row_data
    FROM public.laboratory_orders lo
    JOIN public.doctors d ON d.id = lo.doctor_id
    JOIN public.users u ON u.id = d.user_id
    WHERE lo.patient_id = v_patient.id AND lo.organization_id = v_patient.organization_id
    ORDER BY lo.created_at DESC
    LIMIT 50
  ) sub;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY created_at DESC), '[]'::jsonb)
  INTO v_rad_orders
  FROM (
    SELECT
      ro.created_at,
      jsonb_build_object(
        'id', ro.id,
        'order_number', ro.order_number,
        'imaging_modality', ro.imaging_modality,
        'body_part', ro.body_part,
        'status', ro.status,
        'findings_report', CASE WHEN ro.report_approved_at IS NOT NULL THEN ro.findings_report ELSE NULL END,
        'conclusion', CASE WHEN ro.report_approved_at IS NOT NULL THEN ro.conclusion ELSE NULL END,
        'report_approved_at', ro.report_approved_at,
        'created_at', ro.created_at,
        'doctor_name_ar', u.name_ar,
        'doctor_name_en', u.name_en
      ) AS row_data
    FROM public.radiology_orders ro
    JOIN public.doctors d ON d.id = ro.doctor_id
    JOIN public.users u ON u.id = d.user_id
    WHERE ro.patient_id = v_patient.id AND ro.organization_id = v_patient.organization_id
    ORDER BY ro.created_at DESC
    LIMIT 50
  ) sub;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ma.id,
      'file_name', ma.file_name,
      'file_type', ma.file_type,
      'file_size_bytes', ma.file_size_bytes,
      'storage_path', ma.storage_path,
      'laboratory_order_id', ma.laboratory_order_id,
      'radiology_order_id', ma.radiology_order_id,
      'description', ma.description,
      'created_at', ma.created_at
    ) ORDER BY ma.created_at DESC
  ), '[]'::jsonb) INTO v_attachments
  FROM public.medical_attachments ma
  WHERE ma.patient_id = v_patient.id
    AND ma.organization_id = v_patient.organization_id
    AND (
      (ma.laboratory_order_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.laboratory_orders lo WHERE lo.id = ma.laboratory_order_id AND lo.status = 'completed'))
      OR (ma.radiology_order_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.radiology_orders ro WHERE ro.id = ma.radiology_order_id AND ro.report_approved_at IS NOT NULL))
    );

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'invoice_number', i.invoice_number,
      'issue_date', i.issue_date,
      'total_amount', i.total_amount,
      'paid_amount', i.paid_amount,
      'balance_due', i.balance_due,
      'status', i.status
    ) ORDER BY i.issue_date DESC, i.created_at DESC
  ), '[]'::jsonb) INTO v_invoices
  FROM public.invoices i
  WHERE i.patient_id = v_patient.id AND i.organization_id = v_patient.organization_id;

  RETURN jsonb_build_object(
    'linked', true,
    'patient', jsonb_build_object(
      'id', v_patient.id,
      'organization_id', v_patient.organization_id,
      'mrn', v_patient.mrn,
      'first_name_ar', v_patient.first_name_ar,
      'last_name_ar', v_patient.last_name_ar,
      'first_name_en', v_patient.first_name_en,
      'last_name_en', v_patient.last_name_en,
      'date_of_birth', v_patient.date_of_birth,
      'gender', v_patient.gender,
      'blood_group', v_patient.blood_group,
      'phone', v_patient.phone,
      'portal_linked_at', v_patient.portal_linked_at
    ),
    'appointments', v_appointments,
    'prescriptions', v_prescriptions,
    'laboratory_orders', v_lab_orders,
    'radiology_orders', v_rad_orders,
    'attachments', v_attachments,
    'invoices', v_invoices
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.book_patient_appointment(
  p_branch_id UUID,
  p_doctor_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(appointment_id UUID, appointment_number TEXT)
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_patient public.patients%ROWTYPE;
  v_duration INTEGER := 30;
  v_appt_id UUID := gen_random_uuid();
  v_number TEXT := 'APT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));
BEGIN
  SELECT * INTO v_patient FROM public.patients WHERE auth_user_id = v_uid AND is_active = true LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link your medical record before booking an appointment';
  END IF;

  IF p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Appointment date cannot be in the past';
  END IF;

  SELECT COALESCE(os.appointment_slot_duration_minutes, 30) INTO v_duration
  FROM public.organization_settings os
  WHERE os.organization_id = v_patient.organization_id;

  INSERT INTO public.appointments (
    id, organization_id, branch_id, patient_id, doctor_id,
    appointment_number, appointment_date, start_time, end_time,
    status, type, chief_complaint_note, created_by
  ) VALUES (
    v_appt_id, v_patient.organization_id, p_branch_id, v_patient.id, p_doctor_id,
    v_number, p_date, p_start_time, (p_start_time + make_interval(mins => v_duration))::TIME,
    'pending', 'portal_booking', NULLIF(BTRIM(p_notes), ''), v_uid
  );

  RETURN QUERY SELECT v_appt_id, v_number;
END;
$$;

-- 5. Allow authenticated linked patient to generate signed URLs ONLY for released reports
DROP POLICY IF EXISTS "Patient read approved medical-attachments" ON storage.objects;
CREATE POLICY "Patient read approved medical-attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical-attachments'
    AND EXISTS (
      SELECT 1
      FROM public.medical_attachments ma
      JOIN public.patients p ON p.id = ma.patient_id
      WHERE ma.storage_path = name
        AND p.auth_user_id = auth.uid()
        AND (
          (ma.laboratory_order_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.laboratory_orders lo WHERE lo.id = ma.laboratory_order_id AND lo.status = 'completed'))
          OR (ma.radiology_order_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.radiology_orders ro WHERE ro.id = ma.radiology_order_id AND ro.report_approved_at IS NOT NULL))
        )
    )
  );

REVOKE ALL ON FUNCTION public.generate_patient_portal_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_patient_portal_code(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_patient_portal_record(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_patient_portal_record(TEXT, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.get_patient_booking_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_booking_directory() TO authenticated;

REVOKE ALL ON FUNCTION public.get_patient_portal_records() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_patient_portal_records() TO authenticated;

REVOKE ALL ON FUNCTION public.book_patient_appointment(UUID, UUID, DATE, TIME, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_patient_appointment(UUID, UUID, DATE, TIME, TEXT) TO authenticated;
