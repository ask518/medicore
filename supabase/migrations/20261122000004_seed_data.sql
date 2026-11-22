-- ============================================================================
-- MEDICORE HEALTHCARE PLATFORM – DATABASE SCHEMA MIGRATION 04
-- Seed Data: Subscription Plans, Verified Medication Catalog & Multi-Tenant Fixtures
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

-- ============================================================================
-- 2. VERIFIED MEDICATIONS CATALOG
-- ============================================================================

INSERT INTO medications (id, brand_name, generic_name, strength, form, route, standard_instructions) VALUES
('22222222-2222-2222-2222-222222222201', 'Panadol Extra', 'Paracetamol / Caffeine', '500mg / 65mg', 'Tablet', 'oral', 'قرص أو قرصان كل 8 ساعات عند اللزوم بعد الأكل'),
('22222222-2222-2222-2222-222222222202', 'Augmentin', 'Amoxicillin / Clavulanic Acid', '1g', 'Tablet', 'oral', 'قرص كل 12 ساعة بعد الأكل لمدة 7 أيام'),
('22222222-2222-2222-2222-222222222203', 'Cataflam', 'Diclofenac Potassium', '50mg', 'Tablet', 'oral', 'قرص بعد الوجبات مرتين إلى ثلاث مرات يومياً'),
('22222222-2222-2222-2222-222222222204', 'Concor', 'Bisoprolol Fumarate', '5mg', 'Tablet', 'oral', 'قرص صباحاً يومياً قبل الإفطار'),
('22222222-2222-2222-2222-222222222205', 'Glucophage', 'Metformin Hydrochloride', '1000mg', 'Tablet', 'oral', 'قرص مع وجبة الغداء أو العشاء يومياً'),
('22222222-2222-2222-2222-222222222206', 'Controloc', 'Pantoprazole', '40mg', 'Tablet', 'oral', 'قرص يومياً قبل الإفطار بنصف ساعة'),
('22222222-2222-2222-2222-222222222207', 'Zithrokan', 'Azithromycin', '500mg', 'Capsule', 'oral', 'كبسولة واحدة يومياً قبل الأكل بساعة لمدة 3 أيام'),
('22222222-2222-2222-2222-222222222208', 'Voltaren Emulgel', 'Diclofenac Diethylamine', '1%', 'Gel', 'topical', 'دهان موضعي على مكان الألم مرتين إلى ثلاث مرات يومياً'),
('22222222-2222-2222-2222-222222222209', 'Tobradex', 'Tobramycin / Dexamethasone', '0.3% / 0.1%', 'Eye Drops', 'ophthalmic', 'نقطتان في العين المصابة كل 6 ساعات لمدة 5 أيام'),
('22222222-2222-2222-2222-222222222210', 'Ventolin Inhaler', 'Salbutamol', '100mcg/dose', 'Inhaler', 'inhalation', 'بختان عند ضيق التنفس أو الأزمة')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 3. SYSTEM ANNOUNCEMENTS
-- ============================================================================

INSERT INTO system_announcements (title_ar, title_en, body_ar, body_en, severity) VALUES
(
    'مرحباً بكم في منصة MEDICORE السحابية v1.0',
    'Welcome to MEDICORE Healthcare Cloud Platform v1.0',
    'تم تفعيل أحدث محرك تشخيصي تفاعلي للهيكل العظمي، مخطط الأسنان، وخريطة الجلد السريرية مع دعم كامل للفوترة الإلكترونية.',
    'Interactive skeletal, odontogram, and dermatology canvas engines are now live with full electronic billing & multi-tenant isolation.',
    'info'
);
