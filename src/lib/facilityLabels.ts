import { BillingCycle, FacilityType, SubscriptionStatus } from '../types/database';

export const FACILITY_TYPES: ReadonlyArray<{
  value: FacilityType;
  label_ar: string;
  label_en: string;
}> = [
  { value: 'private_clinic', label_ar: 'عيادة خاصة', label_en: 'Private Clinic' },
  { value: 'poly_clinic', label_ar: 'مجمع عيادات', label_en: 'Polyclinic' },
  { value: 'medical_center', label_ar: 'مركز طبي', label_en: 'Medical Center' },
  { value: 'specialized_center', label_ar: 'مركز تخصصي', label_en: 'Specialized Center' },
  { value: 'complex', label_ar: 'مجمع طبي متكامل', label_en: 'Medical Complex' },
  { value: 'hospital', label_ar: 'مستشفى', label_en: 'Hospital' },
];

export const getFacilityTypeLabel = (type: string, ar: boolean): string => {
  const matched = FACILITY_TYPES.find(item => item.value === type);
  if (!matched) return type;
  return ar ? matched.label_ar : matched.label_en;
};

export const getSubscriptionStatusLabel = (status: SubscriptionStatus | string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    trialing: ['فترة تجريبية', 'Trialing'],
    active: ['نشط', 'Active'],
    past_due: ['متأخر السداد', 'Past Due'],
    canceled: ['ملغى', 'Canceled'],
    expired: ['منتهي', 'Expired'],
    suspended: ['موقوف', 'Suspended'],
  };
  const pair = map[status];
  return pair ? (ar ? pair[0] : pair[1]) : status;
};

export const getBillingCycleLabel = (cycle: BillingCycle | string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    monthly: ['شهري', 'Monthly'],
    annual: ['سنوي', 'Annual'],
    lifetime: ['مدى الحياة', 'Lifetime'],
    trial: ['تجريبي', 'Trial'],
  };
  const pair = map[cycle];
  return pair ? (ar ? pair[0] : pair[1]) : cycle;
};

export const getAnnouncementSeverityLabel = (severity: string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    info: ['إشعار عام', 'General Notice'],
    warning: ['تنبيه هام', 'Important Alert'],
    maintenance: ['إشعار صيانة', 'Maintenance Notice'],
  };
  const pair = map[severity];
  return pair ? (ar ? pair[0] : pair[1]) : severity;
};

export const getAuditActionLabel = (action: string, entityType: string, ar: boolean): string => {
  const key = `${action.toUpperCase()}:${entityType.toLowerCase()}`;
  const specific: Record<string, [string, string]> = {
    'CREATE:organizations': ['تم تسجيل وإنشاء منشأة طبية جديدة', 'Provisioned a new medical facility'],
    'UPDATE:organizations': ['تم تحديث بيانات وتخصصات المنشأة', 'Updated facility profile & specialties'],
    'PLATFORM_DELETE_FACILITY:organizations': ['تم حذف المنشأة وسجلاتها نهائياً', 'Permanently deleted facility and records'],
    'PLATFORM_FACILITY_STATUS:organizations': ['تم تعديل الحالة التشغيلية للمنشأة', 'Updated facility operational status'],
    'PLATFORM_SUBSCRIPTION_UPDATE:subscriptions': ['تم تعديل باقة الاشتراك والفوترة', 'Updated subscription plan & billing'],
    'PLATFORM_SUPPORT_START:platform_support_session': ['تم بدء جلسة دعم فني مؤقتة للمنشأة', 'Started an audited facility support session'],
    'PLATFORM_SUPPORT_END:platform_support_session': ['تم إنهاء جلسة الدعم الفني للمنشأة', 'Ended facility support session'],
    'PLATFORM_PLAN_CREATE:subscription_plans': ['تمت إضافة باقة اشتراك جديدة للمنصة', 'Created a new subscription plan'],
    'PLATFORM_PLAN_UPDATE:subscription_plans': ['تم تعديل أسعار ومميزات باقة اشتراك', 'Updated subscription plan pricing & limits'],
    'PLATFORM_PLAN_DELETE:subscription_plans': ['تم حذف باقة اشتراك غير مستخدمة', 'Deleted unused subscription plan'],
    'PLATFORM_FINANCE_TX:platform_transactions': ['تم تسجيل معاملة مالية في دفتر المنصة', 'Recorded a platform financial transaction'],
    'PLATFORM_FINANCE_PAID:platform_transactions': ['تم تأكيد تحصيل قيد مالي للمنصة', 'Confirmed collection of platform transaction'],
    'PLATFORM_PAYROLL_PAID:platform_staff_payroll': ['تم اعتماد وصرف راتب فريق المنصة', 'Approved and paid platform staff payroll'],
    'CREATE:users': ['تم إنشاء وتفعيل حساب مستخدم جديد', 'Created & activated a user account'],
    'UPDATE:users': ['تم تعديل بيانات أو صلاحيات حساب مستخدم', 'Updated user account & permissions'],
  };
  if (specific[key]) {
    return ar ? specific[key][0] : specific[key][1];
  }

  const generic: Record<string, [string, string]> = {
    CREATE: ['تمت إضافة سجل جديد', 'Created a new record'],
    INSERT: ['تمت إضافة سجل جديد', 'Created a new record'],
    UPDATE: ['تم تحديث بيانات السجل', 'Updated record details'],
    DELETE: ['تم حذف السجل', 'Removed record'],
    SIGN: ['تم التوقيع والاعتماد الطبي', 'Signed & finalized clinically'],
    AMEND: ['تمت إضافة تعديل موثق', 'Recorded an audited amendment'],
    LOGIN: ['تم تسجيل الدخول للنظام', 'Signed in to system'],
    EXPORT: ['تم تصدير البيانات', 'Exported dataset'],
    PLATFORM_SUPPORT_START: ['بدء جلسة دعم فني موثقة', 'Started audited support session'],
    PLATFORM_SUPPORT_END: ['إنهاء جلسة الدعم الفني', 'Closed support session'],
    PLATFORM_FACILITY_STATUS: ['تغيير حالة المنشأة التشغيلية', 'Changed facility status'],
    PLATFORM_SUBSCRIPTION_UPDATE: ['تحديث باقة الاشتراك', 'Updated subscription plan'],
    PLATFORM_DELETE_FACILITY: ['حذف نهائي لمنشأة طبية', 'Permanently deleted facility'],
    PLATFORM_FINANCE_TX: ['تسجيل حركة مالية للمنصة', 'Recorded platform financial transaction'],
    PLATFORM_PAYROLL_PAID: ['صرف مسير راتب لفريق المنصة', 'Disbursed platform team payroll'],
  };
  const pair = generic[action.toUpperCase()];
  return pair ? (ar ? pair[0] : pair[1]) : action;
};

export const getAuditEntityLabel = (entityType: string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    organizations: ['منشأة طبية', 'Medical Facility'],
    branches: ['فرع منشأة', 'Facility Branch'],
    users: ['حساب مستخدم', 'User Account'],
    subscriptions: ['اشتراك وباقة', 'Subscription'],
    subscription_plans: ['باقة اشتراك', 'Subscription Plan'],
    platform_transactions: ['حركة مالية للمنصة', 'Platform Transaction'],
    patient_balance_entries: ['حساب مريض مالي', 'Patient Financial Account'],
    platform_staff_payroll: ['مسير رواتب المنصة', 'Platform Payroll'],
    platform_leave_requests: ['طلب إجازة المنصة', 'Platform Leave Request'],
    platform_support_session: ['جلسة دعم فني', 'Support Session'],
    patients: ['ملف مريض', 'Patient Record'],
    patient: ['بوابة المريض', 'Patient Portal'],
    appointments: ['موعد زيارة', 'Appointment'],
    consultations: ['كشف واستشارة', 'Consultation'],
    prescriptions: ['روشتة طبية', 'Prescription'],
    prescription_items: ['صنف روشتة', 'Prescription Item'],
    anatomical_findings: ['فحص تخصصي 3D', 'Specialty Exam'],
    laboratory_orders: ['طلب تحليل معملي', 'Lab Order'],
    laboratory_results: ['نتيجة تحليل معملي', 'Lab Result'],
    radiology_orders: ['طلب أشعة وتصوير', 'Radiology Order'],
    invoices: ['فاتورة مالية', 'Invoice'],
    invoice_items: ['بند فاتورة', 'Invoice Item'],
    payments: ['سند تحصيل', 'Payment'],
    cashboxes: ['خزينة نقدية', 'Cashbox'],
    expenses: ['مصروف تشغيلي', 'Operating Expense'],
    payroll_slips: ['مسير رواتب', 'Payroll Slip'],
    leave_requests: ['طلب إجازة', 'Leave Request'],
    doctor_commissions: ['عمولة طبيب', 'Doctor Commission'],
    doctors: ['ملف طبيب', 'Doctor Profile'],
    clinical_vitals: ['العلامات الحيوية', 'Clinical Vitals'],
    patient_allergies: ['سجل حساسية مريض', 'Patient Allergy'],
    patient_conditions: ['تاريخ مرضي ومزمن', 'Medical Condition'],
    service_catalog: ['قائمة الخدمات والأسعار', 'Service Catalog'],
    insurance_claims: ['مطالبة تأمين', 'Insurance Claim'],
    insurance_providers: ['شركة تأمين', 'Insurance Provider'],
    inventory_items: ['صنف مخزني/دوائي', 'Inventory Item'],
    inventory_movements: ['حركة مخزون', 'Inventory Movement'],
    stock_movements: ['حركة مخزون', 'Stock Movement'],
  };
  const pair = map[entityType.toLowerCase()];
  return pair ? (ar ? pair[0] : pair[1]) : entityType;
};

export const formatQuotaErrorMessage = (rawMessage: string | undefined | null, ar: boolean): string | null => {
  const msg = String(rawMessage || '');
  const match = msg.match(/PLAN_LIMIT_REACHED:(branches|doctors|users|patients):(\d+)/);
  if (!match) return null;
  const [, resource, limit] = match;
  const resourceAr: Record<string, string> = {
    branches: 'الفروع',
    doctors: 'الأطباء',
    users: 'الموظفين والمستخدمين',
    patients: 'المرضى',
  };
  const resourceEn: Record<string, string> = {
    branches: 'branches',
    doctors: 'doctors',
    users: 'staff accounts',
    patients: 'patients',
  };
  return ar
    ? `تنبيه الباقة: بلغت الحد الأقصى المسموح به لعدد ${resourceAr[resource] || resource} (${limit}). يمكنك الاستمرار في إدارة وتحديث السجلات الحالية بشكل طبيعي، ولإضافة سجل جديد يرجى ترقية الباقة.`
    : `Plan Limit Notice: You have reached the maximum allowed ${resourceEn[resource] || resource} (${limit}) for your current plan. You may continue managing existing records normally; upgrade your plan to add new ones.`;
};

export const formatDoctorDisplayName = (name: string | undefined | null, ar: boolean): string => {
  const clean = (name || '').trim();
  if (!clean) return ar ? 'الطبيب' : 'Doctor';
  if (ar) {
    return /^(د\.|د\/|دكتور|أ\.د)/.test(clean) ? clean : `د. ${clean}`;
  }
  return /^(Dr\.|Dr |Prof\.)/i.test(clean) ? clean : `Dr. ${clean}`;
};

export const getAllergySeverityLabel = (severity: string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    mild: ['خفيفة', 'Mild'],
    moderate: ['متوسطة', 'Moderate'],
    severe: ['شديدة', 'Severe'],
    anaphylactic: ['صدمة تأقية (حرجة)', 'Anaphylactic'],
  };
  const pair = map[severity.toLowerCase()];
  return pair ? (ar ? pair[0] : pair[1]) : severity;
};

export const getConditionTypeLabel = (type: string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    chronic_disease: ['مرض مزمن', 'Chronic Disease'],
    past_surgery: ['جراحة سابقة', 'Past Surgery'],
    family_history: ['تاريخ عائلي', 'Family History'],
    lifestyle: ['نمط حياة', 'Lifestyle'],
  };
  const pair = map[type.toLowerCase()];
  return pair ? (ar ? pair[0] : pair[1]) : type;
};

export const getClinicalStatusLabel = (status: string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    requested: ['مطلوب', 'Requested'],
    sample_collected: ['تم سحب العينة', 'Sample Collected'],
    in_progress: ['قيد التنفيذ', 'In Progress'],
    completed: ['مكتمل ومعتمد', 'Completed'],
    canceled: ['ملغى', 'Canceled'],
    cancelled: ['ملغى', 'Cancelled'],
    draft: ['مسودة', 'Draft'],
    finalized: ['معتمد', 'Finalized'],
    amended: ['معدّل', 'Amended'],
    signed: ['موقّع', 'Signed'],
    unpaid: ['قيد السداد', 'Pending Payment'],
    partially_paid: ['مسددة جزئياً', 'Partially Paid'],
    partial: ['مدفوعة جزئياً', 'Partial'],
    paid: ['تم السداد', 'Paid'],
    overdue: ['متأخرة السداد', 'Overdue'],
    pending: ['قيد السداد / المراجعة', 'Pending'],
    approved: ['معتمد', 'Approved'],
    rejected: ['مرفوض', 'Rejected'],
    routine: ['عادي', 'Routine'],
    urgent: ['عاجل', 'Urgent'],
    stat: ['طوارئ قصوى (STAT)', 'STAT'],
    cash: ['نقدي (كاش)', 'Cash'],
    instapay: ['إنستاباي (InstaPay)', 'InstaPay'],
    wallet: ['محفظة إلكترونية', 'E-Wallet'],
    vodafone_cash: ['فودافون كاش', 'Vodafone Cash'],
    fawry: ['فوري', 'Fawry'],
    credit_card: ['بطاقة بنكية', 'Credit Card'],
    bank_transfer: ['تحويل بنكي', 'Bank Transfer'],
    insurance: ['تأمين طبي', 'Insurance'],
    cheque: ['شيك', 'Cheque'],
    other: ['وسيلة أخرى', 'Other'],
  };
  const pair = map[status.toLowerCase()];
  return pair ? (ar ? pair[0] : pair[1]) : status;
};

export const getPaymentModeLabel = (mode: string | undefined | null, ar: boolean): string =>
  getClinicalStatusLabel((mode || 'other').toLowerCase(), ar);

export const getSpecialtyModuleLabel = (moduleType: string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    orthopedics: ['جراحة العظام 3D', 'Orthopedics 3D'],
    dentistry: ['طب الأسنان 3D', 'Dentistry 3D'],
    dermatology: ['الجلدية والتناسلية', 'Dermatology'],
    ophthalmology: ['طب وجراحة العيون', 'Ophthalmology'],
    cardiology: ['أمراض القلب', 'Cardiology'],
    ent: ['الأنف والأذن والحنجرة', 'ENT'],
    gastroenterology: ['الجهاز الهضمي', 'Gastroenterology'],
    gynecology_obstetrics: ['النساء والتوليد', 'OB/GYN'],
    neurology: ['المخ والأعصاب', 'Neurology'],
    pediatrics: ['طب الأطفال', 'Pediatrics'],
    psychiatry: ['الطب النفسي', 'Psychiatry'],
    pulmonology: ['الأمراض الصدرية', 'Pulmonology'],
    urology: ['المسالك البولية', 'Urology'],
    general: ['الفحص السريري العام', 'General Clinical'],
  };
  const pair = map[moduleType.toLowerCase()];
  return pair ? (ar ? pair[0] : pair[1]) : moduleType;
};

export const formatSpecialtyFindingTypeLabel = (findingType: string, ar: boolean): string => {
  const orthoMatch = findingType.match(/^(\d+)_orthopedic_findings$/);
  if (orthoMatch) {
    const n = Number(orthoMatch[1]);
    return ar ? `فحص عظام 3D (${n} علامات)` : `Orthopedic 3D Exam (${n} markers)`;
  }
  const dentalMatch = findingType.match(/^(\d+)_odontogram_records$/);
  if (dentalMatch) {
    const n = Number(dentalMatch[1]);
    return ar ? `مخطط الأسنان 3D (${n} أسنان)` : `Odontogram 3D (${n} teeth)`;
  }
  const dermaMatch = findingType.match(/^(\d+)_dermatology_lesions$/);
  if (dermaMatch) {
    const n = Number(dermaMatch[1]);
    return ar ? `خريطة الجلدية (${n} ملاحظات)` : `Dermatology Map (${n} lesions)`;
  }
  const exactMap: Record<string, [string, string]> = {
    ophthalmology_exam: ['فحص العيون الشامل', 'Ophthalmology Exam'],
    cardiology_exam: ['فحص القلب والأوعية', 'Cardiology Exam'],
    ent_exam: ['فحص الأنف والأذن والحنجرة', 'ENT Exam'],
    gastroenterology_exam: ['فحص الجهاز الهضمي', 'Gastroenterology Exam'],
    gynecology_exam: ['فحص النساء والتوليد', 'OB/GYN Exam'],
    neurology_exam: ['الفحص العصبي الشامل', 'Neurology Exam'],
    pediatrics_exam: ['فحص الأطفال والنمو', 'Pediatrics Exam'],
    psychiatry_mse: ['فحص الحالة النفسية', 'Psychiatry MSE'],
    pulmonology_exam: ['فحص الصدر والتنفس', 'Pulmonology Exam'],
    urology_exam: ['فحص المسالك البولية', 'Urology Exam'],
  };
  const pair = exactMap[findingType];
  if (pair) return ar ? pair[0] : pair[1];
  return findingType.replace(/_/g, ' ');
};

export const getHrLeaveTypeLabel = (leaveType: string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    annual: ['سنوية', 'Annual'],
    sick: ['مرضية', 'Sick'],
    casual: ['عارضة', 'Casual'],
    unpaid: ['بدون أجر', 'Unpaid'],
    maternity: ['أمومة', 'Maternity'],
    emergency: ['طارئة', 'Emergency'],
  };
  const pair = map[leaveType.toLowerCase()];
  return pair ? (ar ? pair[0] : pair[1]) : leaveType;
};

export const getHrExpenseCategoryLabel = (category: string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    Salaries: ['الرواتب والأجور', 'Salaries'],
    Rent: ['الإيجار', 'Rent'],
    Utilities: ['المرافق والكهرباء والإنترنت', 'Utilities'],
    'Medical Supplies': ['المستلزمات الطبية', 'Medical Supplies'],
    Maintenance: ['الصيانة', 'Maintenance'],
    Marketing: ['التسويق', 'Marketing'],
    Other: ['مصروفات أخرى', 'Other'],
  };
  const pair = map[category];
  return pair ? (ar ? pair[0] : pair[1]) : category;
};

export const getStaffRoleLabel = (role: string, ar: boolean): string => {
  const map: Record<string, [string, string]> = {
    org_owner: ['مالك المنشأة', 'Facility Owner'],
    general_manager: ['المدير العام', 'General Manager'],
    medical_director: ['المدير الطبي', 'Medical Director'],
    branch_manager: ['مدير الفرع', 'Branch Manager'],
    doctor: ['طبيب', 'Doctor'],
    assistant_doctor: ['طبيب مساعد', 'Assistant Doctor'],
    nurse: ['تمريض', 'Nurse'],
    receptionist: ['استقبال', 'Receptionist'],
    accountant: ['محاسب', 'Accountant'],
    lab_tech: ['أخصائي معمل', 'Lab Tech'],
    radiologist: ['أخصائي أشعة', 'Radiologist'],
    pharmacist: ['صيدلي', 'Pharmacist'],
  };
  const pair = map[role];
  return pair ? (ar ? pair[0] : pair[1]) : role;
};


