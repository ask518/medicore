// ============================================================================
// MEDICORE – Multi-Tenant Seed Fixtures for Instant Testing & Offline Zero-Config
// ============================================================================

import { 
  Organization, SubscriptionPlan, Subscription, Branch, User, Doctor,
  Patient, Appointment, Consultation, AnatomicalFinding, Prescription,
  Medication, LaboratoryTest, LaboratoryOrder, LaboratoryResult, RadiologyOrder,
  Service, Invoice, Payment, Cashbox, DoctorCommission, InsuranceCompany,
  AuditLog, SupportTicket, SystemAnnouncement
} from '../types/database';

export const INITIAL_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan-starter',
    slug: 'starter',
    name_ar: 'الباقة الأساسية للعيادات الفردية',
    name_en: 'Starter Single-Clinic',
    tier: 'starter',
    price_monthly: 599,
    price_annual: 5990,
    currency: 'EGP',
    max_branches: 1,
    max_doctors: 2,
    max_users: 5,
    max_storage_mb: 2048,
    has_laboratory: false,
    has_radiology: false,
    has_inventory: false,
    has_insurance: false,
    has_specialty_canvas: true,
    has_accounting_ledger: false,
    has_patient_portal: true,
    has_dedicated_db: false,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-pro',
    slug: 'professional',
    name_ar: 'باقة العيادات التخصصية المتقدمة',
    name_en: 'Professional Multi-Doctor',
    tier: 'professional',
    price_monthly: 1299,
    price_annual: 12990,
    currency: 'EGP',
    max_branches: 2,
    max_doctors: 6,
    max_users: 15,
    max_storage_mb: 10240,
    has_laboratory: false,
    has_radiology: false,
    has_inventory: true,
    has_insurance: true,
    has_specialty_canvas: true,
    has_accounting_ledger: true,
    has_patient_portal: true,
    has_dedicated_db: false,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-center',
    slug: 'medical_center',
    name_ar: 'باقة المجمعات والمراكز الطبية الشاملة',
    name_en: 'Medical Center & Polyclinic',
    tier: 'medical_center',
    price_monthly: 2799,
    price_annual: 27990,
    currency: 'EGP',
    max_branches: 5,
    max_doctors: 25,
    max_users: 60,
    max_storage_mb: 51200,
    has_laboratory: true,
    has_radiology: true,
    has_inventory: true,
    has_insurance: true,
    has_specialty_canvas: true,
    has_accounting_ledger: true,
    has_patient_portal: true,
    has_dedicated_db: false,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'plan-enterprise',
    slug: 'enterprise',
    name_ar: 'باقة المستشفيات والمؤسسات الكبرى (Dedicated)',
    name_en: 'Enterprise Dedicated Suite',
    tier: 'enterprise',
    price_monthly: 6999,
    price_annual: 69990,
    currency: 'EGP',
    max_branches: 999,
    max_doctors: 999,
    max_users: 999,
    max_storage_mb: 1048576,
    has_laboratory: true,
    has_radiology: true,
    has_inventory: true,
    has_insurance: true,
    has_specialty_canvas: true,
    has_accounting_ledger: true,
    has_patient_portal: true,
    has_dedicated_db: true,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
];

// ============================================================================
// ORGANIZATIONS (TENANTS)
// ============================================================================

export const INITIAL_ORGS: Organization[] = [
  {
    id: 'org-alnoor',
    name_ar: 'مجمع النور الطبي التخصصي',
    name_en: 'Al-Noor Medical Complex',
    slug: 'al-noor-medical',
    facility_type: 'medical_center',
    status: 'active',
    logo_url: '/favicon.svg',
    email: 'contact@alnoor-medical.com',
    phone: '+20 100 123 4567',
    tax_number: '123-456-789',
    commercial_reg_no: 'CR-987654',
    country: 'مصر',
    city: 'القاهرة',
    address: 'شارع عباس العقاد، مدينة نصر',
    timezone: 'Africa/Cairo',
    default_currency: 'EGP',
    is_enterprise_dedicated: false,
    storage_consumed_mb: 420.5,
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-02-01T12:00:00Z',
  },
  {
    id: 'org-alamal',
    name_ar: 'عيادة الأمل لجراحة العظام',
    name_en: 'Al-Amal Orthopedic Clinic',
    slug: 'alamal-ortho',
    facility_type: 'private_clinic',
    status: 'active',
    logo_url: '/favicon.svg',
    email: 'info@alamal-ortho.com',
    phone: '+20 111 987 6543',
    tax_number: '456-789-012',
    commercial_reg_no: 'CR-123987',
    country: 'مصر',
    city: 'الجيزة',
    address: 'ميدان لبنان، المهندسين',
    timezone: 'Africa/Cairo',
    default_currency: 'EGP',
    is_enterprise_dedicated: false,
    storage_consumed_mb: 85.0,
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
  }
];

export const INITIAL_SUBSCRIPTIONS: Subscription[] = [
  {
    id: 'sub-alnoor',
    organization_id: 'org-alnoor',
    plan_id: 'plan-center',
    status: 'active',
    cycle: 'monthly',
    amount: 2799,
    currency: 'EGP',
    current_period_start: '2026-11-01T00:00:00Z',
    current_period_end: '2026-12-01T00:00:00Z',
    cancel_at_period_end: false,
    payment_method: 'bank_transfer',
    last_payment_reference: 'TRANS-202611-984',
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'sub-alamal',
    organization_id: 'org-alamal',
    plan_id: 'plan-starter',
    status: 'active',
    cycle: 'monthly',
    amount: 599,
    currency: 'EGP',
    current_period_start: '2026-11-10T00:00:00Z',
    current_period_end: '2026-12-10T00:00:00Z',
    cancel_at_period_end: false,
    payment_method: 'credit_card',
    last_payment_reference: 'VISA-5541',
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-11-10T00:00:00Z',
  }
];

// ============================================================================
// BRANCHES
// ============================================================================

export const INITIAL_BRANCHES: Branch[] = [
  {
    id: 'branch-alnoor-main',
    organization_id: 'org-alnoor',
    name_ar: 'الفرع الرئيسي - مدينة نصر',
    name_en: 'Main Branch - Nasr City',
    code: 'NC-01',
    phone: '+20 2 2401 5555',
    email: 'nasrcity@alnoor-medical.com',
    address: 'شارع عباس العقاد، مدينة نصر، القاهرة',
    city: 'القاهرة',
    is_main_branch: true,
    is_active: true,
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'branch-alnoor-tagamoa',
    organization_id: 'org-alnoor',
    name_ar: 'فرع التجمع الخامس',
    name_en: 'New Cairo Branch - 5th Settlement',
    code: 'NC-02',
    phone: '+20 2 2810 7777',
    email: 'tagamoa@alnoor-medical.com',
    address: 'ميدان تريفيوم، شارع التسعين الشمالي، التجمع الخامس',
    city: 'القاهرة الجديدة',
    is_main_branch: false,
    is_active: true,
    created_at: '2026-03-01T09:00:00Z',
    updated_at: '2026-03-01T09:00:00Z',
  },
  {
    id: 'branch-alamal-main',
    organization_id: 'org-alamal',
    name_ar: 'الفرع الرئيسي - المهندسين',
    name_en: 'Main Clinic - Mohandessin',
    code: 'MOH-01',
    phone: '+20 2 3345 8888',
    email: 'mohandessin@alamal-ortho.com',
    address: 'ميدان لبنان، المهندسين، الجيزة',
    city: 'الجيزة',
    is_main_branch: true,
    is_active: true,
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
  }
];

// ============================================================================
// USERS & ROLES
// ============================================================================

export const INITIAL_USERS: User[] = [
  // Super Admin (Platform Owner)
  {
    id: 'user-super-admin',
    email: 'admin@medicore.cloud',
    phone: '+20 100 000 0000',
    name_ar: 'المهندس مدير المنصة السحابية',
    name_en: 'Platform Super Administrator',
    role: 'super_admin',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  // Al-Noor Medical Complex Users
  {
    id: 'user-alnoor-owner',
    organization_id: 'org-alnoor',
    email: 'owner@alnoor.com',
    phone: '+20 100 111 2222',
    name_ar: 'د. عاصم النور (المدير العام)',
    name_en: 'Dr. Assem Al-Noor (Owner & GM)',
    role: 'org_owner',
    is_active: true,
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'user-dr-tarek',
    organization_id: 'org-alnoor',
    email: 'dr.tarek@alnoor.com',
    phone: '+20 100 222 3333',
    name_ar: 'د. طارق السعيد (استشاري عظام)',
    name_en: 'Dr. Tarek El-Saeed (Orthopedic)',
    role: 'doctor',
    specialty_id: 'orthopedics',
    license_number: 'EGY-MED-44892',
    is_active: true,
    created_at: '2026-01-16T10:00:00Z',
    updated_at: '2026-01-16T10:00:00Z',
  },
  {
    id: 'user-dr-sarah',
    organization_id: 'org-alnoor',
    email: 'dr.sarah@alnoor.com',
    phone: '+20 100 333 4444',
    name_ar: 'د. سارة وجدي (أخصائية أسنان)',
    name_en: 'Dr. Sarah Wagdi (Dentist)',
    role: 'doctor',
    specialty_id: 'dentistry',
    license_number: 'EGY-DEN-78210',
    is_active: true,
    created_at: '2026-01-16T10:00:00Z',
    updated_at: '2026-01-16T10:00:00Z',
  },
  {
    id: 'user-alnoor-receptionist',
    organization_id: 'org-alnoor',
    email: 'reception@alnoor.com',
    phone: '+20 100 444 5555',
    name_ar: 'هدى مصطفى (مسؤولة الاستقبال)',
    name_en: 'Hoda Mostafa (Receptionist)',
    role: 'receptionist',
    is_active: true,
    created_at: '2026-01-17T11:00:00Z',
    updated_at: '2026-01-17T11:00:00Z',
  },
  {
    id: 'user-alnoor-accountant',
    organization_id: 'org-alnoor',
    email: 'accountant@alnoor.com',
    phone: '+20 100 555 6666',
    name_ar: 'أ. خالد كمال (المدير المالي)',
    name_en: 'Khaled Kamal (Accountant)',
    role: 'accountant',
    is_active: true,
    created_at: '2026-01-17T11:00:00Z',
    updated_at: '2026-01-17T11:00:00Z',
  },
  // Al-Amal Clinic Users (Separate Tenant)
  {
    id: 'user-alamal-owner',
    organization_id: 'org-alamal',
    email: 'dr.hesham@alamal.com',
    phone: '+20 111 222 3333',
    name_ar: 'د. هشام الفقي (استشاري العظام)',
    name_en: 'Dr. Hesham El-Feky (Owner & Ortho)',
    role: 'org_owner',
    specialty_id: 'orthopedics',
    license_number: 'EGY-MED-12345',
    is_active: true,
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
  },
  // Patient Portal User
  {
    id: 'user-patient-portal',
    organization_id: 'org-alnoor',
    email: 'patient@alnoor.com',
    phone: '+20 122 333 4444',
    name_ar: 'أحمد محمود حسن (بوابة المريض)',
    name_en: 'Ahmed Mahmoud Hassan (Patient)',
    role: 'patient',
    is_active: true,
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
  }
];

export const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'doc-tarek',
    organization_id: 'org-alnoor',
    user_id: 'user-dr-tarek',
    specialty_code: 'orthopedics',
    specialty_title_ar: 'استشاري جراحة العظام والمفاصل والمناظير',
    specialty_title_en: 'Consultant Orthopedic & Arthroscopic Surgeon',
    bio_ar: 'دكتوراه جراحة العظام، استشاري جراحات الركبة والكتف والمناظير',
    commission_type: 'percentage',
    commission_rate: 60, // 60% commission per consultation
    consultation_fee: 400,
    follow_up_fee: 200,
    slot_duration_minutes: 20,
    is_active: true,
    created_at: '2026-01-16T10:00:00Z',
  },
  {
    id: 'doc-sarah',
    organization_id: 'org-alnoor',
    user_id: 'user-dr-sarah',
    specialty_code: 'dentistry',
    specialty_title_ar: 'أخصائية طب وجراحة الفم والأسنان وتجميل الابتسامة',
    specialty_title_en: 'Specialist Dental Surgeon & Aesthetic Odontologist',
    bio_ar: 'ماجستير علاج الجذور وتجميل وزراعة الأسنان',
    commission_type: 'percentage',
    commission_rate: 55,
    consultation_fee: 300,
    follow_up_fee: 150,
    slot_duration_minutes: 30,
    is_active: true,
    created_at: '2026-01-16T10:00:00Z',
  },
  {
    id: 'doc-hesham',
    organization_id: 'org-alamal',
    user_id: 'user-alamal-owner',
    specialty_code: 'orthopedics',
    specialty_title_ar: 'استشاري العظام والعمود الفقري',
    specialty_title_en: 'Consultant Orthopedic & Spine Surgery',
    commission_type: 'percentage',
    commission_rate: 80,
    consultation_fee: 350,
    follow_up_fee: 180,
    slot_duration_minutes: 20,
    is_active: true,
    created_at: '2026-02-10T10:00:00Z',
  }
];

// ============================================================================
// PATIENTS & TIMELINES
// ============================================================================

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pat-ahmed',
    organization_id: 'org-alnoor',
    primary_branch_id: 'branch-alnoor-main',
    mrn: 'MRN-2026-001',
    national_id: '29001010102589',
    first_name_ar: 'أحمد',
    last_name_ar: 'محمود حسن',
    first_name_en: 'Ahmed',
    last_name_en: 'Mahmoud Hassan',
    date_of_birth: '1990-05-14',
    gender: 'male',
    blood_group: 'O+',
    phone: '+20 122 333 4444',
    whatsapp: '+20 122 333 4444',
    email: 'ahmed.mahmoud@gmail.com',
    address: 'شارع النصر، مدينة نصر',
    city: 'القاهرة',
    emergency_contact_name: 'محمود حسن (الوالد)',
    emergency_contact_phone: '+20 100 555 9999',
    emergency_contact_relation: 'أب',
    is_active: true,
    created_at: '2026-01-20T10:00:00Z',
    updated_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'pat-mona',
    organization_id: 'org-alnoor',
    primary_branch_id: 'branch-alnoor-tagamoa',
    mrn: 'MRN-2026-002',
    national_id: '29508150103642',
    first_name_ar: 'منى',
    last_name_ar: 'السيد عبد الرحمن',
    first_name_en: 'Mona',
    last_name_en: 'El-Sayed',
    date_of_birth: '1995-08-15',
    gender: 'female',
    blood_group: 'A+',
    phone: '+20 111 444 8888',
    whatsapp: '+20 111 444 8888',
    email: 'mona.elsayed@yahoo.com',
    address: 'حي البنفسج، التجمع الأول',
    city: 'القاهرة الجديدة',
    is_active: true,
    created_at: '2026-01-22T11:00:00Z',
    updated_at: '2026-01-22T11:00:00Z',
  },
  // Patient in Al-Amal Clinic (Tenant 2)
  {
    id: 'pat-mostafa',
    organization_id: 'org-alamal',
    primary_branch_id: 'branch-alamal-main',
    mrn: 'AMAL-2026-001',
    national_id: '28803120109988',
    first_name_ar: 'مصطفى',
    last_name_ar: 'إبراهيم توفيق',
    first_name_en: 'Mostafa',
    last_name_en: 'Ibrahim',
    date_of_birth: '1988-03-12',
    gender: 'male',
    blood_group: 'B+',
    phone: '+20 101 234 5678',
    address: 'شارع السودان، المهندسين',
    city: 'الجيزة',
    is_active: true,
    created_at: '2026-02-11T12:00:00Z',
    updated_at: '2026-02-11T12:00:00Z',
  }
];

// ============================================================================
// APPOINTMENTS
// ============================================================================

export const INITIAL_APPOINTMENTS: Appointment[] = [
  {
    id: 'apt-001',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    doctor_id: 'doc-tarek',
    patient_id: 'pat-ahmed',
    appointment_number: 'APT-2026-001',
    appointment_date: '2026-11-23',
    start_time: '10:00',
    end_time: '10:20',
    type: 'new_consultation',
    status: 'checked_in',
    reason_for_visit: 'آلام حادة والتواء بالركبة اليمنى بعد تمرين رياضي',
    checked_in_at: '2026-11-23T09:50:00Z',
    created_at: '2026-11-22T12:00:00Z',
    updated_at: '2026-11-23T09:50:00Z',
  },
  {
    id: 'apt-002',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    doctor_id: 'doc-sarah',
    patient_id: 'pat-mona',
    appointment_number: 'APT-2026-002',
    appointment_date: '2026-11-23',
    start_time: '11:00',
    end_time: '11:30',
    type: 'new_consultation',
    status: 'waiting',
    reason_for_visit: 'ألم بالضرس العلوي الأيمن مع المشروبات الباردة',
    checked_in_at: '2026-11-23T10:45:00Z',
    created_at: '2026-11-22T14:00:00Z',
    updated_at: '2026-11-23T10:45:00Z',
  },
  {
    id: 'apt-003',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    doctor_id: 'doc-tarek',
    patient_id: 'pat-mona',
    appointment_number: 'APT-2026-003',
    appointment_date: '2026-11-24',
    start_time: '14:00',
    end_time: '14:20',
    type: 'routine_checkup',
    status: 'confirmed',
    reason_for_visit: 'متابعة وفحص عام',
    created_at: '2026-11-22T15:00:00Z',
    updated_at: '2026-11-22T15:00:00Z',
  }
];

// ============================================================================
// CONSULTATIONS & SPECIALTY FINDINGS
// ============================================================================

export const INITIAL_CONSULTATIONS: Consultation[] = [
  {
    id: 'con-001',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    appointment_id: 'apt-001',
    patient_id: 'pat-ahmed',
    doctor_id: 'doc-tarek',
    consultation_date: '2026-11-22T10:30:00Z',
    status: 'finalized',
    systolic_bp: 120,
    diastolic_bp: 80,
    heart_rate: 76,
    temperature_celsius: 37.0,
    respiratory_rate: 16,
    oxygen_saturation: 99,
    weight_kg: 82,
    height_cm: 180,
    bmi: 25.3,
    blood_glucose_mg_dl: 95,
    chief_complaint: 'ألم وتورم بالركبة اليمنى بعد سقوط أثناء لعب كرة القدم مع صعوبة فرد المفصل بالكامل',
    chiefComplaint: 'ألم وتورم بالركبة اليمنى بعد سقوط أثناء لعب كرة القدم مع صعوبة فرد المفصل بالكامل',
    history_of_present_illness: 'بدأت الأعراض قبل يومين، مصحوبة بصوت فرقعة داخل المفصل وانصباب خفيف',
    physical_examination: 'إيجابية اختبار Lachman test واختبار McMurray للغضروف الهلالي الإنسي في الركبة اليمنى',
    diagnoses_json: [
      { code: 'M23.2', description: 'تمزق أو التواء بالغضروف الهلالي للركبة اليمنى (Meniscal Tear)', is_primary: true },
      { code: 'M17.1', description: 'خشونة أولية في مفصل الركبة', is_primary: false }
    ],
    treatment_plan: 'راحة تامة، كمادات ثلج، رباط ضاغط طبي، علاج دوائي مضاد للالتهاب ومسكن مع طلب رنين مغناطيسي MRI',
    dietary_lifestyle_instructions: 'تجنب ثني الركبة الحاد أو صعود السلالم لمدة أسبوعين',
    follow_up_date: '2026-12-05',
    follow_up_instructions: 'إعادة الكشف مع إحضار تقرير وأفلام الرنين المغناطيسي للركبة اليمنى',
    specialty_code: 'orthopedics',
    specialty_data: {
      affectedSide: 'right',
      joint: 'knee',
      injuryType: 'sprain_meniscus',
      painScore: 7
    },
    signed_by: 'user-dr-tarek',
    signed_at: '2026-11-22T10:50:00Z',
    created_at: '2026-11-22T10:20:00Z',
    updated_at: '2026-11-22T10:50:00Z',
  }
];

export const INITIAL_ANATOMICAL_FINDINGS: AnatomicalFinding[] = [
  {
    id: 'find-001',
    organization_id: 'org-alnoor',
    consultation_id: 'con-001',
    patient_id: 'pat-ahmed',
    module_type: 'orthopedics',
    canvas_view: 'skeleton_front',
    anatomical_region_id: 'knee_r',
    finding_type: 'sprain_strain',
    severity: 'moderate',
    coordinates_x: 43.5,
    coordinates_y: 68.2,
    annotation_text: 'اشتباه تمزق بالغضروف الهلالي الداخلي مع رشح مفصلي خفيف',
    marker_color: '#EF4444',
    created_at: '2026-11-22T10:35:00Z',
  }
];

// ============================================================================
// PRESCRIPTIONS
// ============================================================================

export const INITIAL_PRESCRIPTIONS: Prescription[] = [
  {
    id: 'rx-001',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    consultation_id: 'con-001',
    patient_id: 'pat-ahmed',
    doctor_id: 'doc-tarek',
    prescription_number: 'RX-2026-0001',
    issued_date: '2026-11-22',
    diagnosis_summary: 'التواء مفصل الركبة اليمنى وتمزق الغضروف الهلالي',
    notes: 'يتم الالتزام بالجرعات بعد الأكل لتجنب تهيج المعدة',
    is_dispensed: false,
    created_at: '2026-11-22T10:45:00Z',
    items: [
      {
        id: 'rxi-01',
        organization_id: 'org-alnoor',
        prescription_id: 'rx-001',
        drug_name: 'Cataflam 50mg (Diclofenac Potassium)',
        dosage: 'قرص واحد',
        frequency: 'كل 8 ساعات بعد الوجبات',
        duration: '7 أيام',
        quantity: 1,
        instructions: 'مسكن ومضاد قوي للالتهاب والتورم',
        created_at: '2026-11-22T10:45:00Z',
      },
      {
        id: 'rxi-02',
        organization_id: 'org-alnoor',
        prescription_id: 'rx-001',
        drug_name: 'Controloc 40mg (Pantoprazole)',
        dosage: 'قرص واحد',
        frequency: 'صباحاً قبل الإفطار بنصف ساعة',
        duration: '14 يوماً',
        quantity: 1,
        instructions: 'حماية المعدة من مضادات الالتهاب',
        created_at: '2026-11-22T10:45:00Z',
      },
      {
        id: 'rxi-03',
        organization_id: 'org-alnoor',
        prescription_id: 'rx-001',
        drug_name: 'Voltaren Emulgel 1% (Diclofenac)',
        dosage: 'دهان موضعي',
        frequency: '3 مرات يومياً على الركبة',
        duration: '10 أيام',
        quantity: 1,
        instructions: 'دهان خفيف بدون تدليك عنيف',
        created_at: '2026-11-22T10:45:00Z',
      }
    ]
  }
];

// ============================================================================
// LABORATORY & RADIOLOGY ORDERS
// ============================================================================

export const INITIAL_LAB_TESTS: LaboratoryTest[] = [
  {
    id: 'lab-cbc',
    organization_id: 'org-alnoor',
    test_code: 'CBC',
    name_ar: 'صورة دم كاملة',
    name_en: 'Complete Blood Count (CBC)',
    category: 'Hematology',
    sample_type: 'EDTA Blood',
    price: 150,
    reference_range_text: 'WBC: 4.0 - 11.0 x10^3/uL, Hb: 13.0 - 17.5 g/dL',
    is_active: true,
  },
  {
    id: 'lab-esr',
    organization_id: 'org-alnoor',
    test_code: 'ESR',
    name_ar: 'سرعة ترسب الدم',
    name_en: 'Erythrocyte Sedimentation Rate',
    category: 'Hematology',
    sample_type: 'Citrated Blood',
    price: 80,
    reference_range_text: '0 - 15 mm/hr',
    is_active: true,
  },
  {
    id: 'lab-crp',
    organization_id: 'org-alnoor',
    test_code: 'CRP',
    name_ar: 'بروتين سي التفاعلي',
    name_en: 'C-Reactive Protein (Quantitative)',
    category: 'Immunology',
    sample_type: 'Serum',
    price: 120,
    reference_range_text: '< 6.0 mg/L',
    is_active: true,
  }
];

export const INITIAL_RAD_ORDERS: RadiologyOrder[] = [
  {
    id: 'rad-001',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    patient_id: 'pat-ahmed',
    doctor_id: 'doc-tarek',
    consultation_id: 'con-001',
    order_number: 'RAD-2026-001',
    imaging_modality: 'MRI',
    body_part: 'الركبة اليمنى (Right Knee)',
    status: 'requested',
    findings_report: 'طلب رنين مغناطيسي لتحديد مدى تمزق الغضروف الهلالي الإنسي والأربطة الصليبية',
    created_at: '2026-11-22T10:46:00Z',
    updated_at: '2026-11-22T10:46:00Z',
  }
];

// ============================================================================
// BILLING, CASHBOXES & INVOICES
// ============================================================================

export const INITIAL_SERVICES: Service[] = [
  {
    id: 'srv-ortho-consult',
    organization_id: 'org-alnoor',
    code: 'SRV-01',
    name_ar: 'كشف استشاري عظام ومفاصل',
    name_en: 'Orthopedic Consultant Consultation',
    category: 'Consultation',
    standard_price: 400,
    cost: 50,
    is_active: true,
  },
  {
    id: 'srv-dental-consult',
    organization_id: 'org-alnoor',
    code: 'SRV-02',
    name_ar: 'كشف وفحص أسنان شامل',
    name_en: 'Comprehensive Dental Examination',
    category: 'Consultation',
    standard_price: 300,
    cost: 30,
    is_active: true,
  },
  {
    id: 'srv-composite-filling',
    organization_id: 'org-alnoor',
    code: 'SRV-03',
    name_ar: 'حشو كمبوزيت ليزر تجميلي',
    name_en: 'Aesthetic Light-Cured Composite Filling',
    category: 'Dentistry',
    standard_price: 600,
    cost: 150,
    is_active: true,
  },
  {
    id: 'srv-knee-aspiration',
    organization_id: 'org-alnoor',
    code: 'SRV-04',
    name_ar: 'بذل ورشح مفصل الركبة وحقن موضعي',
    name_en: 'Knee Arthrocentesis & Intra-articular Injection',
    category: 'Orthopedic Procedure',
    standard_price: 500,
    cost: 100,
    is_active: true,
  }
];

export const INITIAL_CASHBOXES: Cashbox[] = [
  {
    id: 'cb-alnoor-main',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    name: 'خزينة الاستقبال الرئيسية (مدينة نصر)',
    current_balance: 14850,
    assigned_user_id: 'user-alnoor-receptionist',
    is_active: true,
  },
  {
    id: 'cb-alnoor-tagamoa',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-tagamoa',
    name: 'خزينة فرع التجمع الخامس',
    current_balance: 8200,
    is_active: true,
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv-001',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    patient_id: 'pat-ahmed',
    doctor_id: 'doc-tarek',
    consultation_id: 'con-001',
    invoice_number: 'INV-2026-0001',
    issue_date: '2026-11-22',
    subtotal: 400,
    discount_amount: 0,
    tax_amount: 0,
    total_amount: 400,
    paid_amount: 400,
    balance_due: 0,
    status: 'paid',
    notes: 'سداد كشف استشاري عظام نقداً بالخزينة',
    created_at: '2026-11-22T10:10:00Z',
    updated_at: '2026-11-22T10:15:00Z',
    items: [
      {
        id: 'invi-01',
        organization_id: 'org-alnoor',
        invoice_id: 'inv-001',
        service_id: 'srv-ortho-consult',
        description: 'كشف استشاري عظام ومفاصل',
        quantity: 1,
        unit_price: 400,
        discount: 0,
        total_price: 400,
        created_at: '2026-11-22T10:10:00Z',
      }
    ]
  }
];

export const INITIAL_PAYMENTS: Payment[] = [
  {
    id: 'pay-001',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    invoice_id: 'inv-001',
    patient_id: 'pat-ahmed',
    cashbox_id: 'cb-alnoor-main',
    receipt_number: 'REC-2026-0001',
    payment_date: '2026-11-22T10:15:00Z',
    amount: 400,
    payment_mode: 'cash',
    transaction_reference: 'CASH-REC-01',
    is_reversal: false,
    received_by: 'user-alnoor-receptionist',
    created_at: '2026-11-22T10:15:00Z',
  }
];

export const INITIAL_COMMISSIONS: DoctorCommission[] = [
  {
    id: 'com-001',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    doctor_id: 'doc-tarek',
    invoice_id: 'inv-001',
    payment_id: 'pay-001',
    amount: 240, // 60% of 400
    commission_date: '2026-11-22',
    is_settled: false,
    created_at: '2026-11-22T10:15:00Z',
  }
];

// ============================================================================
// AUDIT LOGS & ANNOUNCEMENTS
// ============================================================================

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-001',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    user_id: 'user-alnoor-receptionist',
    user_name: 'هدى مصطفى',
    action: 'CREATE',
    entity_type: 'patients',
    entity_id: 'pat-ahmed',
    created_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'audit-002',
    organization_id: 'org-alnoor',
    branch_id: 'branch-alnoor-main',
    user_id: 'user-dr-tarek',
    user_name: 'د. طارق السعيد',
    action: 'SIGN',
    entity_type: 'consultations',
    entity_id: 'con-001',
    created_at: '2026-11-22T10:50:00Z',
  }
];

export const INITIAL_ANNOUNCEMENTS: SystemAnnouncement[] = [
  {
    id: 'ann-001',
    title_ar: 'إطلاق منصة MEDICORE للإدارة الطبية السحابية v1.0',
    title_en: 'MEDICORE Healthcare Cloud Platform v1.0 Live',
    body_ar: 'يسرنا إطلاق النسخة الأولى المتوافقة تماماً مع معايير الأمان والخصوصية والعزل التام بين المنشآت الطبية، متضمنة المحركات التشخيصية التفاعلية للعظام والأسنان والجلدية.',
    body_en: 'We are thrilled to launch MEDICORE v1.0 with strict multi-tenant isolation, interactive anatomical diagnostic engines, and comprehensive healthcare accounting.',
    severity: 'info',
    is_active: true,
    starts_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
  }
];
