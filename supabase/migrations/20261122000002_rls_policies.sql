-- ============================================================================
-- MEDICORE HEALTHCARE PLATFORM – DATABASE SCHEMA MIGRATION 02
-- Strict Multi-Tenant Row Level Security (RLS) & Cross-Tenant Boundary Policies
-- ============================================================================

-- Function to get current authenticated user ID from Supabase JWT
CREATE OR REPLACE FUNCTION auth_uid() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE SQL STABLE;

-- Function to get current user's organization_id
CREATE OR REPLACE FUNCTION current_user_organization_id() RETURNS UUID AS $$
  SELECT organization_id FROM users WHERE id = auth_uid();
$$ LANGUAGE SQL STABLE;

-- Function to check if current user is platform super_admin
CREATE OR REPLACE FUNCTION is_platform_super_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth_uid() AND role = 'super_admin'
  );
$$ LANGUAGE SQL STABLE;

-- Function to check if user has access to a specific branch
CREATE OR REPLACE FUNCTION user_has_branch_access(p_branch_id UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth_uid()
    AND (
      u.role IN ('super_admin', 'org_owner', 'general_manager')
      OR EXISTS (
        SELECT 1 FROM user_branch_access uba
        WHERE uba.user_id = u.id AND uba.branch_id = p_branch_id
      )
    )
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE examination_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_branch_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE anatomical_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratory_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratory_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE laboratory_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_announcements ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICIES: SUBSCRIPTION PLANS & SYSTEM ANNOUNCEMENTS (PUBLIC READ)
-- ============================================================================

CREATE POLICY "Public read active plans" ON subscription_plans
    FOR SELECT USING (is_active = true OR is_platform_super_admin());

CREATE POLICY "Super admin manage plans" ON subscription_plans
    FOR ALL USING (is_platform_super_admin());

CREATE POLICY "Public read active announcements" ON system_announcements
    FOR SELECT USING (is_active = true AND starts_at <= NOW() AND (ends_at IS NULL OR ends_at >= NOW()));

CREATE POLICY "Super admin manage announcements" ON system_announcements
    FOR ALL USING (is_platform_super_admin());

-- ============================================================================
-- POLICIES: ORGANIZATIONS & SETTINGS
-- ============================================================================

CREATE POLICY "Super admin view all organizations" ON organizations
    FOR ALL USING (is_platform_super_admin());

CREATE POLICY "Users view own organization" ON organizations
    FOR SELECT USING (id = current_user_organization_id());

CREATE POLICY "Org owner update own organization" ON organizations
    FOR UPDATE USING (
        id = current_user_organization_id() 
        AND EXISTS (SELECT 1 FROM users WHERE id = auth_uid() AND role IN ('org_owner', 'general_manager'))
    );

CREATE POLICY "Users view own org settings" ON organization_settings
    FOR SELECT USING (organization_id = current_user_organization_id());

CREATE POLICY "Org owner update own org settings" ON organization_settings
    FOR ALL USING (
        organization_id = current_user_organization_id() 
        AND EXISTS (SELECT 1 FROM users WHERE id = auth_uid() AND role IN ('org_owner', 'general_manager'))
    );

-- ============================================================================
-- POLICIES: SUBSCRIPTIONS
-- ============================================================================

CREATE POLICY "Org users view own subscription" ON subscriptions
    FOR SELECT USING (organization_id = current_user_organization_id() OR is_platform_super_admin());

CREATE POLICY "Super admin manage subscriptions" ON subscriptions
    FOR ALL USING (is_platform_super_admin());

CREATE POLICY "Subscription events view" ON subscription_events
    FOR SELECT USING (organization_id = current_user_organization_id() OR is_platform_super_admin());

-- ============================================================================
-- POLICIES: CORE TENANT TABLES (STRICT ISOLATION BY organization_id)
-- ============================================================================

-- Macro style RLS creation for tenant tables
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'branches', 'departments', 'examination_rooms', 'users', 'user_branch_access',
        'doctors', 'doctor_schedules', 'patients', 'patient_allergies', 'medical_histories',
        'appointments', 'consultations', 'anatomical_findings', 'prescriptions',
        'prescription_items', 'laboratory_tests', 'laboratory_orders', 'laboratory_results',
        'radiology_orders', 'medical_attachments', 'services', 'cashboxes', 'invoices',
        'invoice_items', 'payments', 'expenses', 'doctor_commissions', 'insurance_companies',
        'insurance_claims', 'inventory_items', 'inventory_movements', 'audit_logs',
        'support_tickets'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('
            CREATE POLICY "tenant_isolation_select_%I" ON %I
                FOR SELECT USING (
                    is_platform_super_admin() OR organization_id = current_user_organization_id()
                );
            CREATE POLICY "tenant_isolation_insert_%I" ON %I
                FOR INSERT WITH CHECK (
                    is_platform_super_admin() OR organization_id = current_user_organization_id()
                );
            CREATE POLICY "tenant_isolation_update_%I" ON %I
                FOR UPDATE USING (
                    is_platform_super_admin() OR organization_id = current_user_organization_id()
                );
            CREATE POLICY "tenant_isolation_delete_%I" ON %I
                FOR DELETE USING (
                    is_platform_super_admin() OR organization_id = current_user_organization_id()
                );
        ', tbl, tbl, tbl, tbl, tbl, tbl, tbl, tbl);
    END LOOP;
END $$;

-- Policies for Medications catalog (Global shared catalogue where organization_id IS NULL, or tenant-custom where organization_id matches)
CREATE POLICY "Medications catalog view" ON medications
    FOR SELECT USING (
        organization_id IS NULL 
        OR organization_id = current_user_organization_id() 
        OR is_platform_super_admin()
    );

CREATE POLICY "Medications catalog manage" ON medications
    FOR ALL USING (
        is_platform_super_admin() 
        OR (organization_id = current_user_organization_id() AND organization_id IS NOT NULL)
    );
