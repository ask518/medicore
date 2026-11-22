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
