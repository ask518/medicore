-- ============================================================================
-- MEDICORE – Laboratory, Radiology, and Private Medical Attachments Hardening
-- Aligns RLS with clinical roles, enforces server-side approval attribution,
-- adds order links to medical_attachments, and provisions private storage.
-- ============================================================================

-- 1. Link medical_attachments optionally to laboratory/radiology orders
ALTER TABLE public.medical_attachments
  ADD COLUMN IF NOT EXISTS laboratory_order_id UUID REFERENCES public.laboratory_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS radiology_order_id UUID REFERENCES public.radiology_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_medical_attachments_patient
  ON public.medical_attachments(organization_id, patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medical_attachments_lab_order
  ON public.medical_attachments(organization_id, laboratory_order_id)
  WHERE laboratory_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medical_attachments_rad_order
  ON public.medical_attachments(organization_id, radiology_order_id)
  WHERE radiology_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_orders_org_branch_created
  ON public.laboratory_orders(organization_id, branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rad_orders_org_branch_created
  ON public.radiology_orders(organization_id, branch_id, created_at DESC);

-- 2. Server-side validation & attribution triggers
CREATE OR REPLACE FUNCTION public.validate_laboratory_order_scope()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_doctor_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id AND b.organization_id = NEW.organization_id AND b.is_active
  ) THEN
    RAISE EXCEPTION 'Laboratory branch is not active in this organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id AND p.organization_id = NEW.organization_id AND p.is_active
  ) THEN
    RAISE EXCEPTION 'Patient is not active in this organization';
  END IF;

  SELECT d.user_id INTO v_doctor_user_id
  FROM public.doctors d
  JOIN public.users u ON u.id = d.user_id AND u.is_active
  WHERE d.id = NEW.doctor_id AND d.organization_id = NEW.organization_id AND d.is_active;

  IF v_doctor_user_id IS NULL THEN
    RAISE EXCEPTION 'Ordering doctor is not active in this organization';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IN ('completed', 'canceled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Closed laboratory orders cannot change status';
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_laboratory_order_scope ON public.laboratory_orders;
CREATE TRIGGER trg_validate_laboratory_order_scope
  BEFORE INSERT OR UPDATE ON public.laboratory_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_laboratory_order_scope();

CREATE OR REPLACE FUNCTION public.validate_laboratory_result_audit()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_order public.laboratory_orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.laboratory_orders WHERE id = NEW.order_id;
  IF NOT FOUND OR v_order.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Laboratory order does not match organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.laboratory_tests t
    WHERE t.id = NEW.test_id AND t.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Laboratory test does not belong to this organization';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NULLIF(BTRIM(NEW.result_value), '') IS NULL THEN
      NEW.result_value := 'PENDING';
    END IF;
    IF NEW.result_value <> 'PENDING' THEN
      NEW.technician_id := auth.uid();
    ELSE
      NEW.technician_id := NULL;
    END IF;
    IF NEW.approved_at IS NOT NULL THEN
      IF NEW.result_value = 'PENDING' THEN
        RAISE EXCEPTION 'Cannot approve a pending laboratory result';
      END IF;
      NEW.approved_by := auth.uid();
      NEW.approved_at := NOW();
    ELSE
      NEW.approved_by := NULL;
    END IF;
  ELSE
    IF OLD.approved_at IS NOT NULL AND (
      NEW.result_value IS DISTINCT FROM OLD.result_value
      OR NEW.is_abnormal IS DISTINCT FROM OLD.is_abnormal
      OR NEW.interpretation IS DISTINCT FROM OLD.interpretation
    ) THEN
      RAISE EXCEPTION 'Approved laboratory results cannot be altered';
    END IF;

    IF NEW.result_value IS DISTINCT FROM OLD.result_value AND NEW.result_value <> 'PENDING' THEN
      NEW.technician_id := auth.uid();
    END IF;

    IF OLD.approved_at IS NULL AND NEW.approved_at IS NOT NULL THEN
      IF NULLIF(BTRIM(NEW.result_value), '') IS NULL OR NEW.result_value = 'PENDING' THEN
        RAISE EXCEPTION 'Enter a valid result before approving';
      END IF;
      NEW.approved_by := auth.uid();
      NEW.approved_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_laboratory_result_audit ON public.laboratory_results;
CREATE TRIGGER trg_validate_laboratory_result_audit
  BEFORE INSERT OR UPDATE ON public.laboratory_results
  FOR EACH ROW EXECUTE FUNCTION public.validate_laboratory_result_audit();

CREATE OR REPLACE FUNCTION public.validate_radiology_order_audit()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_doctor_user_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id AND b.organization_id = NEW.organization_id AND b.is_active
  ) THEN
    RAISE EXCEPTION 'Radiology branch is not active in this organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id AND p.organization_id = NEW.organization_id AND p.is_active
  ) THEN
    RAISE EXCEPTION 'Patient is not active in this organization';
  END IF;

  SELECT d.user_id INTO v_doctor_user_id
  FROM public.doctors d
  JOIN public.users u ON u.id = d.user_id AND u.is_active
  WHERE d.id = NEW.doctor_id AND d.organization_id = NEW.organization_id AND d.is_active;

  IF v_doctor_user_id IS NULL THEN
    RAISE EXCEPTION 'Ordering doctor is not active in this organization';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('completed', 'canceled') AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Closed radiology orders cannot change status';
    END IF;

    IF OLD.report_approved_at IS NOT NULL AND (
      NEW.findings_report IS DISTINCT FROM OLD.findings_report
      OR NEW.conclusion IS DISTINCT FROM OLD.conclusion
    ) THEN
      RAISE EXCEPTION 'Approved radiology reports cannot be altered';
    END IF;

    IF OLD.report_approved_at IS NULL AND (NEW.report_approved_at IS NOT NULL OR NEW.status = 'completed') THEN
      IF NULLIF(BTRIM(NEW.findings_report), '') IS NULL THEN
        RAISE EXCEPTION 'Findings report is required before approval';
      END IF;
      NEW.radiologist_id := auth.uid();
      NEW.report_approved_at := NOW();
      NEW.status := 'completed';
    END IF;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_radiology_order_audit ON public.radiology_orders;
CREATE TRIGGER trg_validate_radiology_order_audit
  BEFORE INSERT OR UPDATE ON public.radiology_orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_radiology_order_audit();

CREATE OR REPLACE FUNCTION public.validate_medical_attachment_scope()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id AND p.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'Attachment patient does not belong to this organization';
  END IF;

  IF NEW.laboratory_order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.laboratory_orders o
    WHERE o.id = NEW.laboratory_order_id
      AND o.organization_id = NEW.organization_id
      AND o.patient_id = NEW.patient_id
  ) THEN
    RAISE EXCEPTION 'Attachment laboratory order does not match patient and organization';
  END IF;

  IF NEW.radiology_order_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.radiology_orders o
    WHERE o.id = NEW.radiology_order_id
      AND o.organization_id = NEW.organization_id
      AND o.patient_id = NEW.patient_id
  ) THEN
    RAISE EXCEPTION 'Attachment radiology order does not match patient and organization';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.uploaded_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_medical_attachment_scope ON public.medical_attachments;
CREATE TRIGGER trg_validate_medical_attachment_scope
  BEFORE INSERT OR UPDATE ON public.medical_attachments
  FOR EACH ROW EXECUTE FUNCTION public.validate_medical_attachment_scope();

-- 3. Align RLS policies with RBAC roles (including medical_director & technicians)
DROP POLICY IF EXISTS "tenant_isolation_insert_laboratory_tests" ON public.laboratory_tests;
DROP POLICY IF EXISTS "tenant_isolation_update_laboratory_tests" ON public.laboratory_tests;
DROP POLICY IF EXISTS "tenant_isolation_delete_laboratory_tests" ON public.laboratory_tests;

CREATE POLICY "tenant_isolation_insert_laboratory_tests"
  ON public.laboratory_tests FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'lab_technician'])
    )
  );

CREATE POLICY "tenant_isolation_update_laboratory_tests"
  ON public.laboratory_tests FOR UPDATE TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'lab_technician'])
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'lab_technician'])
    )
  );

CREATE POLICY "tenant_isolation_delete_laboratory_tests"
  ON public.laboratory_tests FOR DELETE TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director'])
    )
  );

-- laboratory_orders
DROP POLICY IF EXISTS "tenant_isolation_insert_laboratory_orders" ON public.laboratory_orders;
DROP POLICY IF EXISTS "tenant_isolation_update_laboratory_orders" ON public.laboratory_orders;

CREATE POLICY "tenant_isolation_insert_laboratory_orders"
  ON public.laboratory_orders FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'lab_technician'])
      AND public.user_has_branch_access(branch_id)
    )
  );

CREATE POLICY "tenant_isolation_update_laboratory_orders"
  ON public.laboratory_orders FOR UPDATE TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'nurse', 'lab_technician'])
      AND public.user_has_branch_access(branch_id)
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'nurse', 'lab_technician'])
      AND public.user_has_branch_access(branch_id)
    )
  );

-- laboratory_results
DROP POLICY IF EXISTS "tenant_isolation_insert_laboratory_results" ON public.laboratory_results;
DROP POLICY IF EXISTS "tenant_isolation_update_laboratory_results" ON public.laboratory_results;

CREATE POLICY "tenant_isolation_insert_laboratory_results"
  ON public.laboratory_results FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'lab_technician'])
      AND EXISTS (
        SELECT 1 FROM public.laboratory_orders o
        WHERE o.id = public.laboratory_results.order_id
          AND public.user_has_branch_access(o.branch_id)
      )
    )
  );

CREATE POLICY "tenant_isolation_update_laboratory_results"
  ON public.laboratory_results FOR UPDATE TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'lab_technician'])
      AND EXISTS (
        SELECT 1 FROM public.laboratory_orders o
        WHERE o.id = public.laboratory_results.order_id
          AND public.user_has_branch_access(o.branch_id)
      )
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'lab_technician'])
      AND EXISTS (
        SELECT 1 FROM public.laboratory_orders o
        WHERE o.id = public.laboratory_results.order_id
          AND public.user_has_branch_access(o.branch_id)
      )
    )
  );

-- radiology_orders
DROP POLICY IF EXISTS "tenant_isolation_insert_radiology_orders" ON public.radiology_orders;
DROP POLICY IF EXISTS "tenant_isolation_update_radiology_orders" ON public.radiology_orders;

CREATE POLICY "tenant_isolation_insert_radiology_orders"
  ON public.radiology_orders FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'radiology_technician'])
      AND public.user_has_branch_access(branch_id)
    )
  );

CREATE POLICY "tenant_isolation_update_radiology_orders"
  ON public.radiology_orders FOR UPDATE TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'radiology_technician'])
      AND public.user_has_branch_access(branch_id)
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'radiology_technician'])
      AND public.user_has_branch_access(branch_id)
    )
  );

-- medical_attachments
DROP POLICY IF EXISTS "tenant_isolation_select_medical_attachments" ON public.medical_attachments;
DROP POLICY IF EXISTS "tenant_isolation_insert_medical_attachments" ON public.medical_attachments;
DROP POLICY IF EXISTS "tenant_isolation_update_medical_attachments" ON public.medical_attachments;

CREATE POLICY "tenant_isolation_select_medical_attachments"
  ON public.medical_attachments FOR SELECT TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = public.medical_attachments.patient_id
          AND p.organization_id = public.medical_attachments.organization_id
          AND (
            (p.primary_branch_id IS NULL AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director']))
            OR public.user_has_branch_access(p.primary_branch_id)
          )
      )
    )
  );

CREATE POLICY "tenant_isolation_insert_medical_attachments"
  ON public.medical_attachments FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse', 'lab_technician', 'radiology_technician', 'records_officer'])
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = public.medical_attachments.patient_id
          AND p.organization_id = public.medical_attachments.organization_id
          AND (
            (p.primary_branch_id IS NULL AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director']))
            OR public.user_has_branch_access(p.primary_branch_id)
          )
      )
    )
  );

CREATE POLICY "tenant_isolation_update_medical_attachments"
  ON public.medical_attachments FOR UPDATE TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'lab_technician', 'radiology_technician'])
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = public.medical_attachments.patient_id
          AND p.organization_id = public.medical_attachments.organization_id
          AND (
            (p.primary_branch_id IS NULL AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director']))
            OR public.user_has_branch_access(p.primary_branch_id)
          )
      )
    )
  )
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'lab_technician', 'radiology_technician'])
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = public.medical_attachments.patient_id
          AND p.organization_id = public.medical_attachments.organization_id
          AND (
            (p.primary_branch_id IS NULL AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director']))
            OR public.user_has_branch_access(p.primary_branch_id)
          )
      )
    )
  );

-- 4. Private Storage Bucket for Lab/Radiology & Clinical Attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'medical-attachments',
  'medical-attachments',
  false,
  20971520,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/dicom',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Tenant read medical-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Tenant upload medical-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Tenant cleanup unlinked medical-attachments" ON storage.objects;

CREATE POLICY "Tenant read medical-attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical-attachments'
    AND (
      public.is_platform_super_admin()
      OR (
        array_length(storage.foldername(name), 1) >= 2
        AND (storage.foldername(name))[1] = public.current_user_organization_id()::TEXT
        AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse', 'lab_technician', 'radiology_technician', 'records_officer'])
        AND EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id::TEXT = (storage.foldername(name))[2]
            AND p.organization_id = public.current_user_organization_id()
            AND (
              (p.primary_branch_id IS NULL AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director']))
              OR public.user_has_branch_access(p.primary_branch_id)
            )
        )
      )
    )
  );

CREATE POLICY "Tenant upload medical-attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'medical-attachments'
    AND (
      public.is_platform_super_admin()
      OR (
        array_length(storage.foldername(name), 1) >= 2
        AND (storage.foldername(name))[1] = public.current_user_organization_id()::TEXT
        AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse', 'lab_technician', 'radiology_technician', 'records_officer'])
        AND EXISTS (
          SELECT 1 FROM public.patients p
          WHERE p.id::TEXT = (storage.foldername(name))[2]
            AND p.organization_id = public.current_user_organization_id()
            AND (
              (p.primary_branch_id IS NULL AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director']))
              OR public.user_has_branch_access(p.primary_branch_id)
            )
        )
      )
    )
  );

CREATE POLICY "Tenant cleanup unlinked medical-attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'medical-attachments'
    AND NOT EXISTS (
      SELECT 1 FROM public.medical_attachments ma
      WHERE ma.storage_path = name
    )
    AND (
      public.is_platform_super_admin()
      OR (
        array_length(storage.foldername(name), 1) >= 2
        AND (storage.foldername(name))[1] = public.current_user_organization_id()::TEXT
        AND (owner = auth.uid() OR public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director']))
      )
    )
  );
