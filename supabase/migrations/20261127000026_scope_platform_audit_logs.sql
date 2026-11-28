-- ============================================================================
-- MEDICORE – Scope Platform Overview Audit Activity strictly to
-- Platform-Level Governance, Subscriptions, Platform Finance/HR & Facilities
-- (Excluding internal clinic employee leaves, expenses, cashboxes, EMR, etc.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.platform_overview_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_totals JSONB;
  v_by_org JSONB;
  v_recent_audits JSONB;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_super_admin() THEN
    RAISE EXCEPTION 'An active platform super admin is required' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'organizations', (SELECT COUNT(*) FROM public.organizations),
    'active_organizations', (SELECT COUNT(*) FROM public.organizations WHERE status = 'active'),
    'suspended_organizations', (SELECT COUNT(*) FROM public.organizations WHERE status = 'suspended'),
    'pending_organizations', (SELECT COUNT(*) FROM public.organizations WHERE status = 'pending_approval'),
    'branches', (SELECT COUNT(*) FROM public.branches),
    'users', (SELECT COUNT(*) FROM public.users),
    'patients', (SELECT COUNT(*) FROM public.patients),
    'appointments', (SELECT COUNT(*) FROM public.appointments),
    'consultations', (SELECT COUNT(*) FROM public.consultations),
    'invoices', (SELECT COUNT(*) FROM public.invoices),
    'laboratory_orders', (SELECT COUNT(*) FROM public.laboratory_orders),
    'radiology_orders', (SELECT COUNT(*) FROM public.radiology_orders),
    'active_announcements', (SELECT COUNT(*) FROM public.system_announcements WHERE is_active)
  ) INTO v_totals;

  SELECT COALESCE(jsonb_agg(row_to_json(org_stats) ORDER BY org_stats.created_at DESC), '[]'::jsonb)
  INTO v_by_org
  FROM (
    SELECT
      o.id AS organization_id,
      o.name_ar,
      o.name_en,
      o.status::TEXT AS status,
      o.facility_type::TEXT AS facility_type,
      o.created_at,
      (SELECT COUNT(*) FROM public.branches b WHERE b.organization_id = o.id) AS branches_count,
      (SELECT COUNT(*) FROM public.users u WHERE u.organization_id = o.id) AS users_count,
      (SELECT COUNT(*) FROM public.patients p WHERE p.organization_id = o.id) AS patients_count,
      (SELECT COUNT(*) FROM public.appointments a WHERE a.organization_id = o.id) AS appointments_count,
      (SELECT COUNT(*) FROM public.invoices i WHERE i.organization_id = o.id) AS invoices_count
    FROM public.organizations o
  ) org_stats;

  SELECT COALESCE(jsonb_agg(row_to_json(a_row)), '[]'::jsonb)
  INTO v_recent_audits
  FROM (
    SELECT
      al.id,
      al.organization_id,
      COALESCE(al.user_name, u.name_en, u.email, 'system') AS user_name,
      al.action,
      al.entity_type,
      al.entity_id,
      al.created_at
    FROM public.audit_logs al
    LEFT JOIN public.users u ON u.id = al.user_id
    WHERE al.organization_id IS NULL
       OR al.action LIKE 'PLATFORM_%'
       OR al.entity_type IN (
         'organizations',
         'subscriptions',
         'subscription_plans',
         'platform_transactions',
         'platform_staff_payroll',
         'platform_leave_requests',
         'platform_support_session',
         'system_announcements'
       )
       OR (
         al.entity_type = 'users'
         AND EXISTS (
           SELECT 1 FROM public.users target_u
           WHERE target_u.id::TEXT = al.entity_id
             AND target_u.role::TEXT IN ('super_admin', 'org_owner')
         )
       )
    ORDER BY al.created_at DESC
    LIMIT 15
  ) a_row;

  RETURN jsonb_build_object(
    'totals', v_totals,
    'by_organization', v_by_org,
    'recent_audits', v_recent_audits
  );
END;
$$;

REVOKE ALL ON FUNCTION public.platform_overview_metrics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_overview_metrics() TO authenticated;
