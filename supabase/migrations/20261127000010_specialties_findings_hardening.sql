-- ============================================================================
-- MEDICORE – Specialties Interactive Findings Hardening & Audit Trail
-- Adds branch/author/specialty columns to anatomical_findings, server-side
-- scope verification, audit logging, and aligned RLS policies.
-- ============================================================================

ALTER TABLE public.anatomical_findings
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS specialty_code VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_anatomical_findings_patient_module
  ON public.anatomical_findings(organization_id, patient_id, module_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.validate_anatomical_finding_scope()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = NEW.patient_id
      AND p.organization_id = NEW.organization_id
      AND p.is_active
  ) THEN
    RAISE EXCEPTION 'Patient is not active in this organization';
  END IF;

  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id
      AND b.organization_id = NEW.organization_id
      AND b.is_active
  ) THEN
    RAISE EXCEPTION 'Branch is not active in this organization';
  END IF;

  IF NEW.consultation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.consultations c
    WHERE c.id = NEW.consultation_id
      AND c.organization_id = NEW.organization_id
      AND c.patient_id = NEW.patient_id
  ) THEN
    RAISE EXCEPTION 'Consultation does not match patient and organization';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.recorded_by := auth.uid();
  ELSE
    NEW.recorded_by := OLD.recorded_by;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_anatomical_finding_scope ON public.anatomical_findings;
CREATE TRIGGER trg_validate_anatomical_finding_scope
  BEFORE INSERT OR UPDATE ON public.anatomical_findings
  FOR EACH ROW EXECUTE FUNCTION public.validate_anatomical_finding_scope();

DROP TRIGGER IF EXISTS trg_audit_anatomical_findings ON public.anatomical_findings;
CREATE TRIGGER trg_audit_anatomical_findings
  AFTER INSERT OR UPDATE OR DELETE ON public.anatomical_findings
  FOR EACH ROW EXECUTE FUNCTION public.log_record_audit();

DROP POLICY IF EXISTS "tenant_isolation_select_anatomical_findings" ON public.anatomical_findings;
DROP POLICY IF EXISTS "tenant_isolation_insert_anatomical_findings" ON public.anatomical_findings;
DROP POLICY IF EXISTS "tenant_isolation_update_anatomical_findings" ON public.anatomical_findings;

CREATE POLICY "tenant_isolation_select_anatomical_findings"
  ON public.anatomical_findings FOR SELECT TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = public.anatomical_findings.patient_id
          AND p.organization_id = public.anatomical_findings.organization_id
          AND (
            (p.primary_branch_id IS NULL AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director']))
            OR public.user_has_branch_access(p.primary_branch_id)
          )
      )
    )
  );

CREATE POLICY "tenant_isolation_insert_anatomical_findings"
  ON public.anatomical_findings FOR INSERT TO authenticated
  WITH CHECK (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse'])
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = public.anatomical_findings.patient_id
          AND p.organization_id = public.anatomical_findings.organization_id
          AND (
            (p.primary_branch_id IS NULL AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director']))
            OR public.user_has_branch_access(p.primary_branch_id)
          )
      )
    )
  );

CREATE POLICY "tenant_isolation_update_anatomical_findings"
  ON public.anatomical_findings FOR UPDATE TO authenticated
  USING (
    public.is_platform_super_admin()
    OR (
      organization_id = public.current_user_organization_id()
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor'])
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = public.anatomical_findings.patient_id
          AND p.organization_id = public.anatomical_findings.organization_id
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
      AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor'])
      AND EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = public.anatomical_findings.patient_id
          AND p.organization_id = public.anatomical_findings.organization_id
          AND (
            (p.primary_branch_id IS NULL AND public.has_any_role(ARRAY['org_owner', 'general_manager', 'medical_director']))
            OR public.user_has_branch_access(p.primary_branch_id)
          )
      )
    )
  );
