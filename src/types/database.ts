// ============================================================================
// MEDICORE – TypeScript Database Schema Definitions
// ============================================================================

export type SubscriptionTier = 'starter' | 'professional' | 'medical_center' | 'enterprise';
export type BillingCycle = 'monthly' | 'annual' | 'lifetime' | 'trial';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired' | 'suspended';

export interface SubscriptionPlan {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  tier: SubscriptionTier;
  price_monthly: number;
  price_annual: number;
  currency: string;
  max_branches: number;
  max_doctors: number;
  max_users: number;
  max_storage_mb: number;
  has_laboratory: boolean;
  has_radiology: boolean;
  has_inventory: boolean;
  has_insurance: boolean;
  has_specialty_canvas: boolean;
  has_accounting_ledger: boolean;
  has_patient_portal: boolean;
  has_dedicated_db: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type FacilityType = 
  | 'private_clinic'
  | 'poly_clinic'
  | 'medical_center'
  | 'specialized_center'
  | 'complex'
  | 'hospital';

export type OrganizationStatus = 'pending_approval' | 'active' | 'suspended' | 'archived';

export interface Organization {
  id: string;
  name_ar: string;
  name_en: string;
  slug: string;
  facility_type: FacilityType;
  status: OrganizationStatus;
  logo_url?: string;
  email: string;
  phone: string;
  tax_number?: string;
  commercial_reg_no?: string;
  country: string;
  city: string;
  address?: string;
  website?: string;
  timezone: string;
  default_currency: string;
  is_enterprise_dedicated: boolean;
  dedicated_db_connection?: string;
  storage_consumed_mb: number;
  specialties?: string[];
  created_at: string;
  updated_at: string;
}

export interface OrganizationSettings {
  organization_id: string;
  primary_color: string;
  secondary_color: string;
  default_language: 'ar' | 'en';
  allow_online_booking: boolean;
  require_appointment_approval: boolean;
  appointment_slot_duration_minutes: number;
  vat_percentage: number;
  enable_sms_reminders: boolean;
  enable_whatsapp_reminders: boolean;
  ai_assistant_enabled: boolean;
  prescription_footer_note_ar?: string;
  prescription_footer_note_en?: string;
  custom_domain?: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  cycle: BillingCycle;
  amount: number;
  currency: string;
  trial_ends_at?: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at?: string;
  payment_method: string;
  last_payment_reference?: string;
  created_at: string;
  updated_at: string;
  plan?: SubscriptionPlan;
}

export interface Branch {
  id: string;
  organization_id: string;
  name_ar: string;
  name_en: string;
  code: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  is_main_branch: boolean;
  is_active: boolean;
  specialties?: string[];
  working_hours_json?: Record<string, { open?: string; close?: string; closed?: boolean }>;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  organization_id: string;
  branch_id?: string;
  name_ar: string;
  name_en: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface ExaminationRoom {
  id: string;
  organization_id: string;
  branch_id: string;
  room_number: string;
  name: string;
  department_id?: string;
  is_active: boolean;
}

export type AppRole = 
  | 'super_admin'
  | 'platform_admin'
  | 'platform_support'
  | 'billing_admin'
  | 'org_owner'
  | 'general_manager'
  | 'branch_manager'
  | 'medical_director'
  | 'doctor'
  | 'assistant_doctor'
  | 'nurse'
  | 'receptionist'
  | 'accountant'
  | 'lab_technician'
  | 'radiology_technician'
  | 'pharmacist'
  | 'insurance_officer'
  | 'inventory_manager'
  | 'records_officer'
  | 'patient';

export interface User {
  id: string;
  organization_id?: string;
  primary_branch_id?: string;
  email: string;
  phone?: string;
  name_ar: string;
  name_en: string;
  role: AppRole;
  is_active: boolean;
  avatar_url?: string;
  national_id?: string;
  specialty_id?: string;
  license_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  organization_id: string;
  user_id: string;
  specialty_code: string;
  specialty_title_ar: string;
  specialty_title_en: string;
  subspecialty_code?: string;
  subspecialty_title_ar?: string;
  subspecialty_title_en?: string;
  professional_title?: string;
  qualifications?: string;
  bio_ar?: string;
  bio_en?: string;
  commission_type: 'percentage' | 'fixed' | 'salary';
  commission_rate: number;
  consultation_fee: number;
  follow_up_fee: number;
  slot_duration_minutes: number;
  is_active: boolean;
  created_at: string;
  user?: User;
}

export interface DoctorSchedule {
  id: string;
  organization_id: string;
  doctor_id: string;
  branch_id: string;
  day_of_week: number; // 0=Sunday, 6=Saturday
  start_time: string; // "09:00"
  end_time: string;   // "17:00"
  max_patients?: number;
  room_id?: string;
  is_active: boolean;
  created_at: string;
}

export type GenderType = 'male' | 'female' | 'other';
export type BloodGroupType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';

export interface Patient {
  id: string;
  organization_id: string;
  primary_branch_id?: string;
  mrn: string;
  national_id?: string;
  first_name_ar: string;
  last_name_ar: string;
  first_name_en?: string;
  last_name_en?: string;
  date_of_birth: string;
  gender: GenderType;
  blood_group: BloodGroupType;
  phone: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  insurance_company_id?: string;
  insurance_card_number?: string;
  insurance_policy_number?: string;
  insurance_coverage_percent?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientAllergy {
  id: string;
  organization_id: string;
  patient_id: string;
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe' | 'anaphylactic';
  reaction?: string;
  diagnosed_date?: string;
  created_at: string;
}

export interface MedicalHistory {
  id: string;
  organization_id: string;
  patient_id: string;
  condition_name: string;
  condition_type: 'chronic_disease' | 'past_surgery' | 'family_history' | 'lifestyle';
  notes?: string;
  onset_year?: number;
  is_active: boolean;
  created_at: string;
}

export type AppointmentType = 
  | 'new_consultation'
  | 'follow_up'
  | 'procedure'
  | 'emergency'
  | 'walk_in'
  | 'routine_checkup';

export type AppointmentStatus = 
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'waiting'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  id: string;
  organization_id: string;
  branch_id: string;
  doctor_id: string;
  patient_id: string;
  room_id?: string;
  appointment_number: string;
  appointment_date: string; // YYYY-MM-DD
  start_time: string;       // HH:mm
  end_time: string;         // HH:mm
  type: AppointmentType;
  status: AppointmentStatus;
  reason_for_visit?: string;
  checked_in_at?: string;
  consultation_started_at?: string;
  completed_at?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  doctor?: Doctor;
  branch?: Branch;
}

export type ConsultationStatus = 'draft' | 'finalized' | 'amended';

export interface DiagnosisItem {
  code: string;
  description: string;
  is_primary: boolean;
}

export interface Consultation {
  id: string;
  organization_id: string;
  branch_id: string;
  appointment_id?: string;
  patient_id: string;
  doctor_id: string;
  consultation_date: string;
  status: ConsultationStatus;
  
  // Vitals
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  temperature_celsius?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  weight_kg?: number;
  height_cm?: number;
  bmi?: number;
  blood_glucose_mg_dl?: number;
  
  // Clinical notes
  chief_complaint: string;
  chiefComplaint?: string;
  history_of_present_illness?: string;
  physical_examination?: string;
  
  // Diagnoses & Plan
  diagnoses_json: DiagnosisItem[];
  treatment_plan?: string;
  dietary_lifestyle_instructions?: string;
  follow_up_date?: string;
  follow_up_instructions?: string;
  
  // Specialty Data
  specialty_code: string;
  specialty_data: Record<string, unknown>;
  
  signed_by?: string;
  signed_at?: string;
  amendment_reason?: string;
  amended_at?: string;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  doctor?: Doctor;
}

export interface AnatomicalFinding {
  id: string;
  organization_id: string;
  consultation_id?: string;
  patient_id: string;
  module_type: 'orthopedics' | 'dentistry' | 'dermatology' | 'ophthalmology';
  canvas_view: string;
  anatomical_region_id: string;
  finding_type: string;
  severity?: string;
  coordinates_x?: number;
  coordinates_y?: number;
  annotation_text?: string;
  marker_color: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Medication {
  id: string;
  organization_id?: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  form: string;
  route: string;
  atc_code?: string;
  is_controlled: boolean;
  standard_instructions?: string;
  is_active: boolean;
}

export interface PrescriptionItem {
  id: string;
  organization_id: string;
  prescription_id: string;
  medication_id?: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
  created_at: string;
}

export interface Prescription {
  id: string;
  organization_id: string;
  branch_id: string;
  consultation_id?: string;
  patient_id: string;
  doctor_id: string;
  prescription_number: string;
  issued_date: string;
  diagnosis_summary?: string;
  notes?: string;
  is_dispensed: boolean;
  dispensed_at?: string;
  created_at: string;
  items?: PrescriptionItem[];
  patient?: Patient;
  doctor?: Doctor;
}

export interface LaboratoryTest {
  id: string;
  organization_id: string;
  test_code: string;
  name_ar: string;
  name_en: string;
  category: string;
  sample_type: string;
  price: number;
  reference_range_text?: string;
  unit?: string;
  is_active: boolean;
}

export type OrderStatus = 'requested' | 'sample_collected' | 'in_progress' | 'completed' | 'canceled';

export interface LaboratoryOrder {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  doctor_id: string;
  consultation_id?: string;
  order_number: string;
  status: OrderStatus;
  clinical_indication?: string;
  priority: 'routine' | 'urgent' | 'stat';
  created_at: string;
  updated_at: string;
  patient?: Patient;
  doctor?: Doctor;
  results?: LaboratoryResult[];
}

export interface LaboratoryResult {
  id: string;
  organization_id: string;
  order_id: string;
  test_id: string;
  result_value: string;
  unit?: string;
  reference_range?: string;
  is_abnormal: boolean;
  interpretation?: string;
  technician_id?: string;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  test?: LaboratoryTest;
}

export interface MedicalAttachment {
  id: string;
  organization_id: string;
  patient_id: string;
  consultation_id?: string | null;
  laboratory_order_id?: string | null;
  radiology_order_id?: string | null;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  storage_path: string;
  description?: string | null;
  uploaded_by?: string | null;
  created_at: string;
}

export interface RadiologyOrder {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  doctor_id: string;
  consultation_id?: string;
  order_number: string;
  imaging_modality: string;
  body_part: string;
  status: OrderStatus;
  findings_report?: string;
  conclusion?: string;
  radiologist_id?: string;
  report_approved_at?: string;
  dicom_link?: string;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  doctor?: Doctor;
}

export interface Service {
  id: string;
  organization_id: string;
  code: string;
  name_ar: string;
  name_en: string;
  category: string;
  standard_price: number;
  cost: number;
  is_active: boolean;
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'refunded' | 'void';
export type PaymentMode = 'cash' | 'credit_card' | 'bank_transfer' | 'insurance' | 'vodafone_cash' | 'fawry';

export interface Cashbox {
  id: string;
  organization_id: string;
  branch_id: string;
  name: string;
  current_balance: number;
  assigned_user_id?: string;
  is_active: boolean;
}

export interface InvoiceItem {
  id: string;
  organization_id: string;
  invoice_id: string;
  service_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total_price: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  doctor_id?: string;
  consultation_id?: string;
  invoice_number: string;
  issue_date: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: InvoiceStatus;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  patient?: Patient;
  doctor?: Doctor;
}

export interface Payment {
  id: string;
  organization_id: string;
  branch_id: string;
  invoice_id: string;
  patient_id: string;
  cashbox_id?: string;
  receipt_number: string;
  payment_date: string;
  amount: number;
  payment_mode: payment_mode_type;
  transaction_reference?: string;
  is_reversal: boolean;
  reversal_reason?: string;
  received_by?: string;
  created_at: string;
  patient?: Patient;
}

export type payment_mode_type = PaymentMode;

export interface Expense {
  id: string;
  organization_id: string;
  branch_id: string;
  cashbox_id?: string;
  category: string;
  title: string;
  amount: number;
  expense_date: string;
  vendor_name?: string;
  receipt_image_url?: string;
  notes?: string;
  approved_by?: string;
  created_at: string;
}

export interface DoctorCommission {
  id: string;
  organization_id: string;
  branch_id: string;
  doctor_id: string;
  invoice_id?: string;
  payment_id?: string;
  amount: number;
  commission_date: string;
  is_settled: boolean;
  settlement_reference?: string;
  created_at: string;
  doctor?: Doctor;
}

export interface InsuranceCompany {
  id: string;
  organization_id: string;
  name_ar: string;
  name_en: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  default_discount_percent: number;
  is_active: boolean;
  created_at: string;
}

export interface InsuranceContract {
  id: string;
  organization_id: string;
  insurance_company_id: string;
  contract_code: string;
  plan_name_ar: string;
  plan_name_en: string;
  coverage_percent: number;
  co_payment_percent: number;
  annual_limit: number;
  requires_pre_approval_above?: number;
  valid_from: string;
  valid_to?: string;
  is_active: boolean;
  created_at: string;
  insurance_company?: InsuranceCompany;
}

export interface InsuranceClaim {
  id: string;
  organization_id: string;
  branch_id: string;
  insurance_company_id: string;
  invoice_id: string;
  patient_id: string;
  claim_number: string;
  claimed_amount: number;
  approved_amount: number;
  rejected_amount: number;
  co_payment_amount: number;
  status: 'submitted' | 'approved' | 'partially_approved' | 'rejected' | 'paid';
  rejection_reason?: string;
  pre_approval_code?: string;
  notes?: string;
  submission_date: string;
  settlement_date?: string;
  created_at: string;
  insurance_company?: InsuranceCompany;
  patient?: Patient;
  invoice?: { invoice_number: string; total_amount: number };
}

export interface InventoryItem {
  id: string;
  organization_id: string;
  branch_id: string;
  sku: string;
  name_ar: string;
  name_en: string;
  category: string;
  current_quantity: number;
  reorder_threshold: number;
  unit: string;
  unit_cost: number;
  selling_price: number;
  batch_number?: string;
  expiry_date?: string;
  is_active: boolean;
}

export type InventoryMovementType =
  | 'purchase'
  | 'dispense'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'damage';

export interface InventoryMovement {
  id: string;
  organization_id: string;
  item_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  unit_price: number;
  reference_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  item?: { sku: string; name_ar: string; name_en: string; unit: string };
}

export interface Supplier {
  id: string;
  organization_id: string;
  name_ar: string;
  name_en: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id?: string;
  branch_id?: string;
  user_id?: string;
  user_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  organization_id: string;
  user_id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'waiting_client' | 'resolved' | 'closed';
  messages_json: { sender: string; role: string; message: string; timestamp: string }[];
  created_at: string;
  updated_at: string;
}

export interface SystemAnnouncement {
  id: string;
  title_ar: string;
  title_en: string;
  body_ar: string;
  body_en: string;
  severity: 'info' | 'warning' | 'maintenance';
  is_active: boolean;
  starts_at: string;
  ends_at?: string;
  created_at: string;
}

// ============================================================================
// HR & PAYROLL & EXPENSES & LEAVES SCHEMAS
// ============================================================================

export type PayrollStatus = 'draft' | 'approved' | 'paid';
export type ExpenseCategory = 
  | 'rent'
  | 'utilities'
  | 'medical_supplies'
  | 'maintenance'
  | 'hospitality'
  | 'salaries'
  | 'marketing'
  | 'other';

export type LeaveType = 
  | 'annual'
  | 'sick'
  | 'casual'
  | 'unpaid'
  | 'maternity'
  | 'emergency';

export interface PayrollSlip {
  id: string;
  organization_id: string;
  branch_id?: string;
  user_id: string;
  employee_name_ar: string;
  employee_name_en?: string;
  employee_role: AppRole;
  month: string; // e.g. "2026-11"
  base_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  payment_status: PayrollStatus;
  payment_date?: string;
  payment_method?: 'cash' | 'bank_transfer' | 'cheque';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FacilityExpense {
  id: string;
  organization_id: string;
  branch_id?: string;
  expense_category: ExpenseCategory;
  title: string;
  amount: number;
  currency: string;
  expense_date: string;
  paid_to: string;
  payment_method: 'cash' | 'bank_transfer' | 'credit_card' | 'cheque';
  cashbox_id?: string;
  receipt_number?: string;
  status: 'paid' | 'pending_approval' | 'rejected';
  approved_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequest {
  id: string;
  organization_id: string;
  user_id: string;
  employee_name_ar: string;
  employee_role: AppRole;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  decided_at?: string;
  notes?: string;
  created_at: string;
}

