-- Fix column name mismatch (`reason_for_visit` instead of `chief_complaint_note`)
-- and invalid appointment_type enum literal ('new_consultation' instead of 'portal_booking')
-- in Patient Portal RPCs.

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
        'chief_complaint_note', a.reason_for_visit,
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
  v_duration INTEGER := 20;
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

  SELECT COALESCE(os.appointment_slot_duration_minutes, 20) INTO v_duration
  FROM public.organization_settings os
  WHERE os.organization_id = v_patient.organization_id;

  IF v_duration IS NULL OR v_duration <= 0 THEN
    v_duration := 20;
  END IF;

  INSERT INTO public.appointments (
    id, organization_id, branch_id, patient_id, doctor_id,
    appointment_number, appointment_date, start_time, end_time,
    status, type, reason_for_visit, created_by
  ) VALUES (
    v_appt_id, v_patient.organization_id, p_branch_id, v_patient.id, p_doctor_id,
    v_number, p_date, p_start_time, (p_start_time + make_interval(mins => v_duration))::TIME,
    'pending', 'new_consultation'::public.appointment_type, NULLIF(BTRIM(p_notes), ''), v_uid
  );

  RETURN QUERY SELECT v_appt_id, v_number;
END;
$$;
