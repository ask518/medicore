-- ============================================================================
-- MEDICORE HEALTHCARE PLATFORM – DATABASE SCHEMA MIGRATION 01
-- Multi-Tenant Architecture, Complete Clinical EMR, Accounting, RBAC & Storage
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. SUBSCRIPTION PLANS & PLATFORM CONFIGURATION (GLOBAL / PLATFORM OWNER)
-- ============================================================================

CREATE TYPE subscription_tier AS ENUM ('starter', 'professional', 'medical_center', 'enterprise');
CREATE TYPE billing_cycle AS ENUM ('monthly', 'annual', 'lifetime', 'trial');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended');

CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    tier subscription_tier NOT NULL,
    price_monthly DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    price_annual DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
    max_branches INTEGER NOT NULL DEFAULT 1,
    max_doctors INTEGER NOT NULL DEFAULT 3,
    max_users INTEGER NOT NULL DEFAULT 10,
    max_storage_mb INTEGER NOT NULL DEFAULT 1024,
    has_laboratory BOOLEAN NOT NULL DEFAULT false,
    has_radiology BOOLEAN NOT NULL DEFAULT false,
    has_inventory BOOLEAN NOT NULL DEFAULT false,
    has_insurance BOOLEAN NOT NULL DEFAULT false,
    has_specialty_canvas BOOLEAN NOT NULL DEFAULT true,
    has_accounting_ledger BOOLEAN NOT NULL DEFAULT false,
    has_patient_portal BOOLEAN NOT NULL DEFAULT false,
    has_dedicated_db BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. ORGANIZATIONS (TENANTS) & SUBSCRIPTIONS
-- ============================================================================

CREATE TYPE facility_type AS ENUM (
    'private_clinic',
    'poly_clinic',
    'medical_center',
    'specialized_center',
    'complex',
    'hospital'
);

CREATE TYPE organization_status AS ENUM ('pending_approval', 'active', 'suspended', 'archived');

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    facility_type facility_type NOT NULL DEFAULT 'private_clinic',
    status organization_status NOT NULL DEFAULT 'active',
    logo_url TEXT,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    tax_number VARCHAR(100),
    commercial_reg_no VARCHAR(100),
    country VARCHAR(100) NOT NULL DEFAULT 'Egypt',
    city VARCHAR(100) NOT NULL DEFAULT 'Cairo',
    address TEXT,
    website VARCHAR(255),
    timezone VARCHAR(50) NOT NULL DEFAULT 'Africa/Cairo',
    default_currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
    is_enterprise_dedicated BOOLEAN NOT NULL DEFAULT false,
    dedicated_db_connection TEXT,
    storage_consumed_mb DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE organization_settings (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    primary_color VARCHAR(20) DEFAULT '#0C87EB',
    secondary_color VARCHAR(20) DEFAULT '#14B8A6',
    default_language VARCHAR(5) DEFAULT 'ar',
    allow_online_booking BOOLEAN DEFAULT true,
    require_appointment_approval BOOLEAN DEFAULT false,
    appointment_slot_duration_minutes INTEGER DEFAULT 20,
    vat_percentage DECIMAL(5, 2) DEFAULT 0.00,
    enable_sms_reminders BOOLEAN DEFAULT false,
    enable_whatsapp_reminders BOOLEAN DEFAULT false,
    ai_assistant_enabled BOOLEAN DEFAULT true,
    prescription_footer_note_ar TEXT,
    prescription_footer_note_en TEXT,
    custom_domain VARCHAR(255),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES subscription_plans(id),
    status subscription_status NOT NULL DEFAULT 'trialing',
    cycle billing_cycle NOT NULL DEFAULT 'monthly',
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,
    payment_method VARCHAR(50) DEFAULT 'manual_bank_transfer',
    last_payment_reference VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE subscription_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    actor_id UUID,
    actor_name VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. BRANCHES & DEPARTMENTS
-- ============================================================================

CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    code VARCHAR(20) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    is_main_branch BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    working_hours_json JSONB DEFAULT '{"mon":{"open":"09:00","close":"21:00"},"tue":{"open":"09:00","close":"21:00"},"wed":{"open":"09:00","close":"21:00"},"thu":{"open":"09:00","close":"21:00"},"sat":{"open":"09:00","close":"21:00"},"sun":{"open":"09:00","close":"21:00"},"fri":{"closed":true}}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, code)
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE examination_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- ============================================================================
-- 4. USERS, ROLES, PERMISSIONS & BRANCH ASSIGNMENTS
-- ============================================================================

CREATE TYPE app_role AS ENUM (
    'super_admin',
    'org_owner',
    'general_manager',
    'branch_manager',
    'doctor',
    'assistant_doctor',
    'nurse',
    'receptionist',
    'accountant',
    'lab_technician',
    'radiology_technician',
    'pharmacist',
    'insurance_officer',
    'records_officer',
    'patient'
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    role app_role NOT NULL DEFAULT 'receptionist',
    is_active BOOLEAN NOT NULL DEFAULT true,
    avatar_url TEXT,
    national_id VARCHAR(50),
    specialty_id VARCHAR(50),
    license_number VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_branch_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, branch_id)
);

CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    specialty_code VARCHAR(50) NOT NULL, -- 'orthopedics', 'dentistry', 'dermatology', etc.
    specialty_title_ar VARCHAR(100) NOT NULL,
    specialty_title_en VARCHAR(100) NOT NULL,
    bio_ar TEXT,
    bio_en TEXT,
    commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed', 'salary'
    commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    consultation_fee DECIMAL(10, 2) NOT NULL DEFAULT 200.00,
    follow_up_fee DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
    slot_duration_minutes INTEGER NOT NULL DEFAULT 20,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doctor_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_patients INTEGER DEFAULT 20,
    room_id UUID REFERENCES examination_rooms(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. PATIENTS & ELECTRONIC MEDICAL RECORD (EMR)
-- ============================================================================

CREATE TYPE gender_type AS ENUM ('male', 'female', 'other');
CREATE TYPE blood_group_type AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown');

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    primary_branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    mrn VARCHAR(50) NOT NULL, -- Medical Record Number
    national_id VARCHAR(50),
    first_name_ar VARCHAR(100) NOT NULL,
    last_name_ar VARCHAR(100) NOT NULL,
    first_name_en VARCHAR(100),
    last_name_en VARCHAR(100),
    date_of_birth DATE NOT NULL,
    gender gender_type NOT NULL,
    blood_group blood_group_type NOT NULL DEFAULT 'unknown',
    phone VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    city VARCHAR(100),
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relation VARCHAR(50),
    insurance_company_id UUID,
    insurance_card_number VARCHAR(100),
    insurance_policy_number VARCHAR(100),
    insurance_coverage_percent DECIMAL(5, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, mrn)
);

CREATE TABLE patient_allergies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    allergen VARCHAR(255) NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'moderate', -- mild, moderate, severe, anaphylactic
    reaction TEXT,
    diagnosed_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE medical_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    condition_name VARCHAR(255) NOT NULL,
    condition_type VARCHAR(50) NOT NULL, -- 'chronic_disease', 'past_surgery', 'family_history', 'lifestyle'
    notes TEXT,
    onset_year INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. APPOINTMENTS & RECEPTION WORKFLOW
-- ============================================================================

CREATE TYPE appointment_type AS ENUM ('new_consultation', 'follow_up', 'procedure', 'emergency', 'walk_in', 'routine_checkup');
CREATE TYPE appointment_status AS ENUM (
    'pending',
    'confirmed',
    'checked_in',
    'waiting',
    'in_consultation',
    'completed',
    'cancelled',
    'no_show'
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    room_id UUID REFERENCES examination_rooms(id) ON DELETE SET NULL,
    appointment_number VARCHAR(50) NOT NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    type appointment_type NOT NULL DEFAULT 'new_consultation',
    status appointment_status NOT NULL DEFAULT 'pending',
    reason_for_visit TEXT,
    checked_in_at TIMESTAMPTZ,
    consultation_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index to enforce double-booking prevention on active appointments
CREATE UNIQUE INDEX idx_doctor_appointment_slot 
ON appointments(doctor_id, appointment_date, start_time) 
WHERE status NOT IN ('cancelled', 'no_show');

-- ============================================================================
-- 7. CLINICAL CONSULTATION WORKFLOW & SPECIALTY MODULES
-- ============================================================================

CREATE TYPE consultation_status AS ENUM ('draft', 'finalized', 'amended');

CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    consultation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status consultation_status NOT NULL DEFAULT 'draft',
    
    -- Vitals
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    heart_rate INTEGER,
    temperature_celsius DECIMAL(4, 1),
    respiratory_rate INTEGER,
    oxygen_saturation INTEGER,
    weight_kg DECIMAL(5, 2),
    height_cm DECIMAL(5, 1),
    bmi DECIMAL(4, 1),
    blood_glucose_mg_dl INTEGER,
    
    -- Clinical Subjective & Objective
    chief_complaint TEXT NOT NULL,
    history_of_present_illness TEXT,
    physical_examination TEXT,
    
    -- Assessment & Diagnoses
    diagnoses_json JSONB DEFAULT '[]'::jsonb, -- Array of ICD-10 objects: [{code, description, is_primary}]
    treatment_plan TEXT,
    dietary_lifestyle_instructions TEXT,
    follow_up_date DATE,
    follow_up_instructions TEXT,
    
    -- Specialty Specific Data
    specialty_code VARCHAR(50) NOT NULL,
    specialty_data JSONB DEFAULT '{}'::jsonb,
    
    signed_by UUID REFERENCES users(id),
    signed_at TIMESTAMPTZ,
    amendment_reason TEXT,
    amended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Interactive anatomical canvas findings (Orthopedic skeleton, Odontogram, Derma body map)
CREATE TABLE anatomical_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    module_type VARCHAR(50) NOT NULL, -- 'orthopedics', 'dentistry', 'dermatology', 'ophthalmology'
    canvas_view VARCHAR(50) NOT NULL, -- 'skeleton_front', 'skeleton_back', 'odontogram_fdi', 'body_front'
    anatomical_region_id VARCHAR(100) NOT NULL, -- 'femur_r', 'tooth_16', 'forearm_l'
    finding_type VARCHAR(100) NOT NULL, -- 'fracture', 'caries', 'lesion', 'implant', 'pain_point'
    severity VARCHAR(50),
    coordinates_x DECIMAL(8, 4),
    coordinates_y DECIMAL(8, 4),
    annotation_text TEXT,
    marker_color VARCHAR(20) DEFAULT '#EF4444',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. ELECTRONIC PRESCRIPTIONS & VERIFIED MEDICATIONS CATALOG
-- ============================================================================

CREATE TABLE medications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL for verified global catalog
    brand_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255) NOT NULL,
    strength VARCHAR(100) NOT NULL,
    form VARCHAR(100) NOT NULL, -- tablet, syrup, injection, cream, drops
    route VARCHAR(100) NOT NULL DEFAULT 'oral',
    atc_code VARCHAR(20),
    is_controlled BOOLEAN NOT NULL DEFAULT false,
    standard_instructions TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    prescription_number VARCHAR(50) NOT NULL,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    diagnosis_summary TEXT,
    notes TEXT,
    is_dispensed BOOLEAN NOT NULL DEFAULT false,
    dispensed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
    medication_id UUID REFERENCES medications(id) ON DELETE SET NULL,
    drug_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL, -- e.g. "Every 8 hours after meals"
    duration VARCHAR(100) NOT NULL,  -- e.g. "5 days"
    quantity INTEGER NOT NULL DEFAULT 1,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. LABORATORY & RADIOLOGY ORDERS & RESULTS
-- ============================================================================

CREATE TABLE laboratory_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    test_code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Hematology, Biochemistry, Immunology, Urine/Stool
    sample_type VARCHAR(100) NOT NULL DEFAULT 'Venous Blood',
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    reference_range_text TEXT,
    unit VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (organization_id, test_code)
);

CREATE TYPE order_status AS ENUM ('requested', 'sample_collected', 'in_progress', 'completed', 'canceled');

CREATE TABLE laboratory_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    order_number VARCHAR(50) NOT NULL,
    status order_status NOT NULL DEFAULT 'requested',
    clinical_indication TEXT,
    priority VARCHAR(20) DEFAULT 'routine', -- routine, urgent, stat
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE laboratory_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES laboratory_orders(id) ON DELETE CASCADE,
    test_id UUID NOT NULL REFERENCES laboratory_tests(id) ON DELETE CASCADE,
    result_value VARCHAR(255) NOT NULL,
    unit VARCHAR(50),
    reference_range VARCHAR(100),
    is_abnormal BOOLEAN NOT NULL DEFAULT false,
    interpretation TEXT,
    technician_id UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE radiology_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    order_number VARCHAR(50) NOT NULL,
    imaging_modality VARCHAR(50) NOT NULL, -- X-Ray, CT, MRI, Ultrasound, Mammography
    body_part VARCHAR(100) NOT NULL,
    status order_status NOT NULL DEFAULT 'requested',
    findings_report TEXT,
    conclusion TEXT,
    radiologist_id UUID REFERENCES users(id),
    report_approved_at TIMESTAMPTZ,
    dicom_link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE medical_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    storage_path TEXT NOT NULL,
    description TEXT,
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. BILLING, CASHBOXES, DOUBLE-ENTRY ACCOUNTING & COMMISSIONS
-- ============================================================================

CREATE TYPE invoice_status AS ENUM ('draft', 'unpaid', 'partially_paid', 'paid', 'refunded', 'void');
CREATE TYPE payment_mode AS ENUM ('cash', 'credit_card', 'bank_transfer', 'insurance', 'vodafone_cash', 'fawry');

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    standard_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (organization_id, code)
);

CREATE TABLE cashboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    current_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    assigned_user_id UUID REFERENCES users(id),
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES doctors(id) ON DELETE SET NULL,
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    invoice_number VARCHAR(50) NOT NULL,
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    balance_due DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    status invoice_status NOT NULL DEFAULT 'unpaid',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, invoice_number)
);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    cashbox_id UUID REFERENCES cashboxes(id) ON DELETE SET NULL,
    receipt_number VARCHAR(50) NOT NULL,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount DECIMAL(12, 2) NOT NULL,
    payment_mode payment_mode NOT NULL DEFAULT 'cash',
    transaction_reference VARCHAR(100),
    is_reversal BOOLEAN NOT NULL DEFAULT false,
    reversal_reason TEXT,
    received_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, receipt_number)
);

CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    cashbox_id UUID REFERENCES cashboxes(id) ON DELETE SET NULL,
    category VARCHAR(100) NOT NULL, -- Rent, Utilities, Supplies, Salaries, Maintenance
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor_name VARCHAR(150),
    receipt_image_url TEXT,
    notes TEXT,
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE doctor_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    amount DECIMAL(10, 2) NOT NULL,
    commission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_settled BOOLEAN NOT NULL DEFAULT false,
    settlement_reference VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 11. INSURANCE & CLAIMS MANAGEMENT
-- ============================================================================

CREATE TABLE insurance_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(50),
    email VARCHAR(255),
    tax_id VARCHAR(50),
    default_discount_percent DECIMAL(5, 2) DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE insurance_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    insurance_company_id UUID NOT NULL REFERENCES insurance_companies(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    claim_number VARCHAR(100) NOT NULL,
    claimed_amount DECIMAL(12, 2) NOT NULL,
    approved_amount DECIMAL(12, 2) DEFAULT 0.00,
    rejected_amount DECIMAL(12, 2) DEFAULT 0.00,
    co_payment_amount DECIMAL(12, 2) DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'submitted', -- submitted, approved, partially_approved, rejected, paid
    rejection_reason TEXT,
    submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    settlement_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, claim_number)
);

-- ============================================================================
-- 12. INVENTORY & PHARMACY MANAGEMENT
-- ============================================================================

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    sku VARCHAR(50) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    name_en VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Medication, Consumable, Surgical, Lab Reagent
    current_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_threshold INTEGER NOT NULL DEFAULT 10,
    unit VARCHAR(50) NOT NULL DEFAULT 'piece',
    unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    selling_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    batch_number VARCHAR(100),
    expiry_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (organization_id, branch_id, sku)
);

CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL, -- 'purchase', 'dispense', 'adjustment', 'transfer_in', 'transfer_out', 'damage'
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    reference_id VARCHAR(100), -- invoice_id or purchase_order_id
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 13. AUDIT TRAILS & ACTIVITY LOGGING
-- ============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(150),
    action VARCHAR(100) NOT NULL, -- CREATE, UPDATE, DELETE, SIGN, AMEND, LOGIN, EXPORT
    entity_type VARCHAR(100) NOT NULL, -- patients, appointments, consultations, invoices, etc.
    entity_id VARCHAR(100) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast audit filtering by tenant and entity
CREATE INDEX idx_audit_org_entity ON audit_logs(organization_id, entity_type, entity_id);

-- ============================================================================
-- 14. SUPPORT TICKETS & SYSTEM ANNOUNCEMENTS
-- ============================================================================

CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- Billing, Technical, Bug, Feature Request, Clinical
    priority VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, in_progress, waiting_client, resolved, closed
    messages_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE system_announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title_ar VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    body_ar TEXT NOT NULL,
    body_en TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info', -- info, warning, maintenance
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
-- ============================================================================
-- MEDICORE HEALTHCARE PLATFORM – DATABASE SCHEMA MIGRATION 03
-- Triggers, Automatic Balancing, Audit Logging & Integrity Functions
-- ============================================================================

-- ============================================================================
-- 1. AUTOMATIC INVOICE TOTAL & BALANCE RECALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_invoice_financials() RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID;
    v_subtotal DECIMAL(12, 2);
    v_total_paid DECIMAL(12, 2);
    v_discount DECIMAL(12, 2);
    v_tax DECIMAL(12, 2);
    v_net DECIMAL(12, 2);
    v_balance DECIMAL(12, 2);
    v_new_status invoice_status;
BEGIN
    IF (TG_TABLE_NAME = 'invoice_items') THEN
        v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
    ELSIF (TG_TABLE_NAME = 'payments') THEN
        v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
    ELSE
        v_invoice_id := NEW.id;
    END IF;

    -- Calculate subtotal from line items
    SELECT COALESCE(SUM(total_price), 0.00) INTO v_subtotal
    FROM invoice_items WHERE invoice_id = v_invoice_id;

    -- Calculate total paid from non-reversed payments
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid
    FROM payments WHERE invoice_id = v_invoice_id AND is_reversal = false;

    -- Fetch invoice discount and tax
    SELECT discount_amount, tax_amount INTO v_discount, v_tax
    FROM invoices WHERE id = v_invoice_id;

    v_net := GREATEST(0.00, v_subtotal - COALESCE(v_discount, 0.00) + COALESCE(v_tax, 0.00));
    v_balance := GREATEST(0.00, v_net - v_total_paid);

    IF v_net = 0.00 AND v_total_paid = 0.00 THEN
        v_new_status := 'draft';
    ELSIF v_balance = 0.00 AND v_total_paid > 0.00 THEN
        v_new_status := 'paid';
    ELSIF v_total_paid > 0.00 AND v_balance > 0.00 THEN
        v_new_status := 'partially_paid';
    ELSE
        v_new_status := 'unpaid';
    END IF;

    UPDATE invoices
    SET subtotal = v_subtotal,
        total_amount = v_net,
        paid_amount = v_total_paid,
        balance_due = v_balance,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_invoice_items_financials
AFTER INSERT OR UPDATE OR DELETE ON invoice_items
FOR EACH ROW EXECUTE FUNCTION update_invoice_financials();

CREATE TRIGGER trg_payments_financials
AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION update_invoice_financials();

-- ============================================================================
-- 2. CASHBOX BALANCE UPDATE ON PAYMENT OR EXPENSE
-- ============================================================================

CREATE OR REPLACE FUNCTION update_cashbox_balance() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_TABLE_NAME = 'payments') THEN
        IF (NEW.cashbox_id IS NOT NULL) THEN
            IF (NEW.is_reversal) THEN
                UPDATE cashboxes SET current_balance = current_balance - NEW.amount WHERE id = NEW.cashbox_id;
            ELSE
                UPDATE cashboxes SET current_balance = current_balance + NEW.amount WHERE id = NEW.cashbox_id;
            END IF;
        END IF;
    ELSIF (TG_TABLE_NAME = 'expenses') THEN
        IF (NEW.cashbox_id IS NOT NULL) THEN
            UPDATE cashboxes SET current_balance = current_balance - NEW.amount WHERE id = NEW.cashbox_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_cashbox_update
AFTER INSERT ON payments
FOR EACH ROW EXECUTE FUNCTION update_cashbox_balance();

CREATE TRIGGER trg_expense_cashbox_update
AFTER INSERT ON expenses
FOR EACH ROW EXECUTE FUNCTION update_cashbox_balance();

-- ============================================================================
-- 3. AUDIT TRAIL LOGGING TRIGGER FOR CLINICAL & FINANCIAL RECORDS
-- ============================================================================

CREATE OR REPLACE FUNCTION log_record_audit() RETURNS TRIGGER AS $$
DECLARE
    v_action VARCHAR(50);
    v_org_id UUID;
    v_user_id UUID;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        v_action := 'CREATE';
        v_org_id := NEW.organization_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_action := 'UPDATE';
        v_org_id := NEW.organization_id;
    ELSIF (TG_OP = 'DELETE') THEN
        v_action := 'DELETE';
        v_org_id := OLD.organization_id;
    END IF;

    v_user_id := auth_uid();

    INSERT INTO audit_logs (
        organization_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        created_at
    ) VALUES (
        v_org_id,
        v_user_id,
        v_action,
        TG_TABLE_NAME,
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id::text ELSE NEW.id::text END,
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
        NOW()
    );

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_patients AFTER INSERT OR UPDATE OR DELETE ON patients
FOR EACH ROW EXECUTE FUNCTION log_record_audit();

CREATE TRIGGER trg_audit_consultations AFTER INSERT OR UPDATE OR DELETE ON consultations
FOR EACH ROW EXECUTE FUNCTION log_record_audit();

CREATE TRIGGER trg_audit_prescriptions AFTER INSERT OR UPDATE OR DELETE ON prescriptions
FOR EACH ROW EXECUTE FUNCTION log_record_audit();

CREATE TRIGGER trg_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION log_record_audit();

CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION log_record_audit();
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
