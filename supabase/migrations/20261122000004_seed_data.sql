-- ============================================================================
-- MEDICORE HEALTHCARE PLATFORM – DATABASE SCHEMA MIGRATION 04
-- Seed Data: Configurable Subscription Plan Defaults
-- ============================================================================

-- ============================================================================
-- 1. SUBSCRIPTION PLANS
-- ============================================================================

INSERT INTO subscription_plans (
    id, slug, name_ar, name_en, tier, price_monthly, price_annual, currency,
    max_branches, max_doctors, max_users, max_storage_mb,
    has_laboratory, has_radiology, has_inventory, has_insurance,
    has_specialty_canvas, has_accounting_ledger, has_patient_portal, has_dedicated_db
) VALUES
(
    '11111111-1111-1111-1111-111111111101', 'starter',
    'الباقة الأساسية للعيادات الفردية', 'Starter Clinic',
    'starter', 599.00, 5990.00, 'EGP',
    1, 2, 5, 2048,
    false, false, false, false,
    true, false, true, false
),
(
    '11111111-1111-1111-1111-111111111102', 'professional',
    'باقة العيادات التخصصية المتقدمة', 'Professional Multi-Doctor',
    'professional', 1299.00, 12990.00, 'EGP',
    2, 6, 15, 10240,
    false, false, true, true,
    true, true, true, false
),
(
    '11111111-1111-1111-1111-111111111103', 'medical_center',
    'باقة المجمعات والمراكز الطبية الشاملة', 'Medical Center & Polyclinic',
    'medical_center', 2799.00, 27990.00, 'EGP',
    5, 25, 60, 51200,
    true, true, true, true,
    true, true, true, false
),
(
    '11111111-1111-1111-1111-111111111104', 'enterprise',
    'باقة المستشفيات والمؤسسات الكبرى (Dedicated)', 'Enterprise Healthcare Suite',
    'enterprise', 6999.00, 69990.00, 'EGP',
    999, 999, 999, 1048576,
    true, true, true, true,
    true, true, true, true
) ON CONFLICT (slug) DO NOTHING;
