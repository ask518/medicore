// ============================================================================
// MEDICORE – Role-Based Access Control (RBAC) & Granular Permissions Engine
// Section 6 Implementation: Platform & Organization Permissions Matrix
// ============================================================================

import { AppRole, CustomPermissionKey, CustomPermissionsMap, User } from '../types/database';

export type RbacModule = 
  | 'organizations'
  | 'subscriptions'
  | 'dashboard'
  | 'patients'
  | 'appointments'
  | 'consultations'
  | 'prescriptions'
  | 'laboratory'
  | 'radiology'
  | 'billing'
  | 'insurance'
  | 'inventory'
  | 'commissions'
  | 'branches'
  | 'staff'
  | 'hr'
  | 'reports'
  | 'settings'
  | 'audit_logs';

export type RbacAction = 
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'export'
  | 'print'
  | 'manage'
  | 'configure';

export interface RoleDefinition {
  role: AppRole;
  scope: 'platform' | 'organization';
  title_ar: string;
  title_en: string;
  description_ar: string;
  description_en: string;
}

export const ROLE_DEFINITIONS: Record<AppRole, RoleDefinition> = {
  // Platform Roles
  super_admin: {
    role: 'super_admin',
    scope: 'platform',
    title_ar: 'مالك المنصة الأعلى (Super Admin)',
    title_en: 'Platform Super Admin',
    description_ar: 'كامل الصلاحيات السيادية على المنصة، المنشآت، الاشتراكات والفوترة',
    description_en: 'Full sovereign access to platform, organizations, billing & settings'
  },
  platform_admin: {
    role: 'platform_admin',
    scope: 'platform',
    title_ar: 'مدير المنصة السحابية',
    title_en: 'Platform Administrator',
    description_ar: 'إدارة المنشآت الطبية، الدعم الفني ومتابعة سلامة الخوادم',
    description_en: 'Manage medical organizations, technical support and cloud uptime'
  },
  platform_support: {
    role: 'platform_support',
    scope: 'platform',
    title_ar: 'أخصائي دعم المنصة',
    title_en: 'Platform Support Agent',
    description_ar: 'تقديم المساعدة التقنية وتذاكر الدعم للمنشآت',
    description_en: 'Technical assistance and support ticket resolution for clinics'
  },
  billing_admin: {
    role: 'billing_admin',
    scope: 'platform',
    title_ar: 'مسؤول الفوترة السحابية للمنصة',
    title_en: 'Platform Billing Administrator',
    description_ar: 'إدارة اشتراكات SaaS، الفواتير، وتحصيل الإيرادات الشهرية',
    description_en: 'Manage SaaS subscriptions, MRR/ARR collections and plans'
  },

  // Organization Roles
  org_owner: {
    role: 'org_owner',
    scope: 'organization',
    title_ar: 'مالك المنشأة / المدير العام',
    title_en: 'Organization Owner / GM',
    description_ar: 'كامل الصلاحيات الإدارية والمالية والطبية على مستوى المنشأة وفروعها',
    description_en: 'Full organizational authority across all branches, staff and financials'
  },
  general_manager: {
    role: 'general_manager',
    scope: 'organization',
    title_ar: 'المدير التنفيذي للمجمع',
    title_en: 'General Manager',
    description_ar: 'الإشراف على العمليات اليومية، الفروع، الميزانية، والتقارير العامة',
    description_en: 'Supervise daily operations, branches, budgets and executive reports'
  },
  branch_manager: {
    role: 'branch_manager',
    scope: 'organization',
    title_ar: 'مدير الفرع',
    title_en: 'Branch Manager',
    description_ar: 'إدارة العمليات اليومية وحركة المرضى والموظفين في الفرع المعين فقط',
    description_en: 'Manage operations, staff and patient flow within assigned branch only'
  },
  medical_director: {
    role: 'medical_director',
    scope: 'organization',
    title_ar: 'المدير الطبي للمنشأة',
    title_en: 'Medical Director',
    description_ar: 'الإشراف على الجودة السريرية، البروتوكولات الطبية واعتماد القرارات',
    description_en: 'Supervise clinical quality, medical protocols and medical audits'
  },
  doctor: {
    role: 'doctor',
    scope: 'organization',
    title_ar: 'طبيب استشاري / أخصائي',
    title_en: 'Consultant / Specialist Doctor',
    description_ar: 'الكشف السريري، تشخيص الحالات، كتابة الروشتات، طلب الأشعة والتحاليل',
    description_en: 'Clinical exams, diagnoses, prescriptions, lab/radiology orders'
  },
  assistant_doctor: {
    role: 'assistant_doctor',
    scope: 'organization',
    title_ar: 'طبيب مقيم / مساعد',
    title_en: 'Resident / Assistant Doctor',
    description_ar: 'تسجيل العلامات الحيوية، التاريخ المرضي والمساعدة السريرية',
    description_en: 'Record vitals, medical history and clinical assistance under supervision'
  },
  nurse: {
    role: 'nurse',
    scope: 'organization',
    title_ar: 'طاقم التمريض',
    title_en: 'Clinical Nurse',
    description_ar: 'قياس العلامات الحيوية، تجهيز المرضى للكشف، وتسجيل الملاحظات التمريضية',
    description_en: 'Take vitals, prep patients for consultation and record triage notes'
  },
  receptionist: {
    role: 'receptionist',
    scope: 'organization',
    title_ar: 'موظف الاستقبال والحجوزات',
    title_en: 'Receptionist',
    description_ar: 'فتح ملفات المرضى، حجز المواعيد، تسجيل الدخول لطابور الانتظار',
    description_en: 'Patient registration, appointment scheduling & waiting queue check-in'
  },
  accountant: {
    role: 'accountant',
    scope: 'organization',
    title_ar: 'المحاسب المالي وأمين الخزينة',
    title_en: 'Accountant & Cashier',
    description_ar: 'إصدار الفواتير، استلام الدفعات النقدية، إدارة الخزائن، وعمولات الأطباء',
    description_en: 'Issue invoices, record payments, manage cashboxes & doctor commissions'
  },
  lab_technician: {
    role: 'lab_technician',
    scope: 'organization',
    title_ar: 'أخصائي التحاليل الطبية',
    title_en: 'Laboratory Technician',
    description_ar: 'استلام عينات المختبر، تسجيل نتائج الفحوصات ورفع التقارير المخبرية',
    description_en: 'Process lab orders, input lab test results and attach reports'
  },
  radiology_technician: {
    role: 'radiology_technician',
    scope: 'organization',
    title_ar: 'أخصائي الأشعة والتصوير الطبي',
    title_en: 'Radiology Technician',
    description_ar: 'تنفيذ طلبات الأشعة، تصوير المرضى ورفع صور الـ DICOM والتقارير',
    description_en: 'Fulfill radiology requests, capture imaging and upload reports'
  },
  pharmacist: {
    role: 'pharmacist',
    scope: 'organization',
    title_ar: 'صيدلي المنشأة',
    title_en: 'Clinical Pharmacist',
    description_ar: 'صرف الروشتات الإلكترونية والتحقق من التداخلات الدوائية',
    description_en: 'Dispense electronic prescriptions and check drug interactions'
  },
  insurance_officer: {
    role: 'insurance_officer',
    scope: 'organization',
    title_ar: 'مسؤول التأمين الصحي والشركات',
    title_en: 'Insurance Claims Officer',
    description_ar: 'إدارة مطالبات شركات التأمين والموافقات الطبية المسبقة',
    description_en: 'Manage insurance claims, pre-authorizations and co-payments'
  },
  inventory_manager: {
    role: 'inventory_manager',
    scope: 'organization',
    title_ar: 'أمين المخزن والمستلزمات الطبية',
    title_en: 'Inventory & Supply Manager',
    description_ar: 'متابعة رصيد الأدوية والمستهلكات وتواريخ الصلاحية وحركات المخزن',
    description_en: 'Track medical supplies, batch expirations and stock movements'
  },
  records_officer: {
    role: 'records_officer',
    scope: 'organization',
    title_ar: 'مسؤول السجلات الطبية والأرشيف',
    title_en: 'Medical Records Officer',
    description_ar: 'حفظ وتدقيق السجلات الطبية وأرشفة وثائق المرضى ومطابقة الهويات',
    description_en: 'Audit medical archives, patient file validation & document compliance'
  },
  patient: {
    role: 'patient',
    scope: 'organization',
    title_ar: 'مريض (بوابة المرضى)',
    title_en: 'Patient (Self-Service Portal)',
    description_ar: 'استعراض المواعيد الشخصية، نتائج التحاليل، والروشتات المعتمدة',
    description_en: 'View personal appointments, lab results and verified prescriptions'
  }
};

/**
 * Checks whether a given role is authorized to perform an action on a module.
 * Real, fail-closed RBAC enforcement.
 */
export const hasPermission = (
  role: AppRole | undefined | null,
  module: RbacModule,
  action: RbacAction = 'view'
): boolean => {
  if (!role) return false;

  // 1. Super Admin has unrestricted authority on everything
  if (role === 'super_admin') return true;

  // 2. Platform Admin
  if (role === 'platform_admin') {
    if (['organizations', 'subscriptions', 'audit_logs', 'reports'].includes(module)) return true;
    return action === 'view';
  }

  // 3. Billing Admin
  if (role === 'billing_admin') {
    if (['subscriptions', 'organizations'].includes(module)) return true;
    if (module === 'reports') return ['view', 'export', 'print'].includes(action);
    return false;
  }

  // 4. Platform Support
  if (role === 'platform_support') {
    if (['organizations', 'audit_logs'].includes(module) && action === 'view') return true;
    return false;
  }

  // Platform-only modules cannot be accessed by organization roles
  if (['organizations', 'subscriptions'].includes(module)) {
    return false;
  }

  // 5. Organization Owner & General Manager have full authority inside their organization
  if (role === 'org_owner' || role === 'general_manager') {
    return true;
  }

  // 6. Branch Manager
  if (role === 'branch_manager') {
    if (['settings'].includes(module)) return ['view', 'edit'].includes(action);
    return true; // full access within branch scope
  }

  // 7. Medical Director
  if (role === 'medical_director') {
    if (['patients', 'consultations', 'prescriptions', 'laboratory', 'radiology', 'reports'].includes(module)) return true;
    if (['appointments', 'staff', 'hr'].includes(module)) return ['view', 'approve'].includes(action);
    return action === 'view';
  }

  // 8. Doctor / Consultant
  if (role === 'doctor') {
    if (['consultations', 'prescriptions'].includes(module)) return ['view', 'create', 'edit', 'approve', 'print'].includes(action);
    if (['patients', 'appointments'].includes(module)) return ['view', 'create', 'edit'].includes(action);
    if (['laboratory', 'radiology'].includes(module)) return ['view', 'create'].includes(action);
    if (['commissions'].includes(module)) return action === 'view';
    if (module === 'hr') return ['view', 'create'].includes(action);
    if (module === 'dashboard') return action === 'view';
    return false;
  }

  // 9. Assistant Doctor
  if (role === 'assistant_doctor') {
    if (['consultations', 'prescriptions'].includes(module)) return ['view', 'create', 'edit'].includes(action);
    if (['patients', 'appointments'].includes(module)) return ['view', 'create'].includes(action);
    if (['laboratory', 'radiology'].includes(module)) return ['view', 'create'].includes(action);
    if (module === 'hr') return ['view', 'create'].includes(action);
    if (module === 'dashboard') return action === 'view';
    return false;
  }

  // 10. Nurse
  if (role === 'nurse') {
    if (['patients', 'appointments'].includes(module)) return ['view', 'create', 'edit'].includes(action);
    if (['consultations'].includes(module)) return ['view', 'create'].includes(action); // record vitals & triage notes
    if (module === 'laboratory') return ['view', 'edit'].includes(action); // specimen collection
    if (module === 'hr') return ['view', 'create'].includes(action);
    if (module === 'dashboard') return action === 'view';
    return false;
  }

  // 11. Receptionist
  if (role === 'receptionist') {
    if (['patients', 'appointments'].includes(module)) return ['view', 'create', 'edit', 'print'].includes(action);
    if (module === 'billing') return ['view', 'create'].includes(action);
    if (module === 'insurance') return action === 'view';
    if (module === 'hr') return ['view', 'create'].includes(action);
    if (module === 'dashboard') return action === 'view';
    // Receptionist CANNOT modify or edit consultations
    if (['consultations', 'prescriptions', 'staff', 'branches', 'settings'].includes(module)) return false;
    return false;
  }

  // 12. Accountant
  if (role === 'accountant') {
    if (['billing', 'insurance', 'commissions', 'reports', 'hr'].includes(module)) return true;
    if (module === 'inventory') return ['view', 'export', 'print'].includes(action);
    if (['patients', 'appointments'].includes(module)) return action === 'view';
    if (module === 'dashboard') return action === 'view';
    // Accountant CANNOT modify clinical notes or medical records
    if (['consultations', 'prescriptions', 'laboratory', 'radiology'].includes(module)) return false;
    return false;
  }

  // 12b. Insurance Claims Officer
  if (role === 'insurance_officer') {
    if (module === 'insurance') return true;
    if (['patients', 'billing', 'reports', 'dashboard'].includes(module)) return ['view', 'export', 'print'].includes(action);
    return false;
  }

  // 13. Laboratory Technician
  if (role === 'lab_technician') {
    if (module === 'laboratory') return true;
    if (['patients', 'consultations'].includes(module)) return action === 'view';
    return false;
  }

  // 14. Radiology Technician
  if (role === 'radiology_technician') {
    if (module === 'radiology') return true;
    if (['patients', 'consultations'].includes(module)) return action === 'view';
    return false;
  }

  // 15. Pharmacist
  if (role === 'pharmacist') {
    if (module === 'inventory') return true;
    if (module === 'prescriptions') return ['view', 'approve'].includes(action);
    if (['patients', 'dashboard'].includes(module)) return action === 'view';
    return false;
  }

  // 15b. Inventory & Supply Manager
  if (role === 'inventory_manager') {
    if (module === 'inventory') return true;
    if (['reports', 'dashboard'].includes(module)) return ['view', 'export', 'print'].includes(action);
    return false;
  }

  // 15c. Medical Records Officer
  if (role === 'records_officer') {
    if (module === 'patients') return ['view', 'create', 'edit', 'print', 'export'].includes(action);
    if (module === 'hr') return ['view', 'create'].includes(action);
    if (['dashboard', 'reports'].includes(module)) return action === 'view';
    return false;
  }

  // 16. Patient Portal
  if (role === 'patient') {
    if (['appointments', 'prescriptions', 'laboratory', 'radiology'].includes(module)) return ['view', 'print'].includes(action);
    return false;
  }

  return false;
};

export interface CustomPermissionDefinition {
  key: CustomPermissionKey;
  category: 'financial' | 'clinical' | 'admin';
  label_ar: string;
  label_en: string;
  description_ar: string;
  description_en: string;
  defaultRoles: AppRole[];
}

export const CUSTOM_PERMISSION_DEFINITIONS: CustomPermissionDefinition[] = [
  {
    key: 'billing_view',
    category: 'financial',
    label_ar: 'الصلاحية المالية (عرض الفواتير والخزينة)',
    label_en: 'Financial Visibility (Invoices & Cashboxes)',
    description_ar: 'الاطلاع على الفواتير وأرصدة الخزائن والمدفوعات والحساب المالي للمرضى',
    description_en: 'View facility invoices, cashbox balances, payments, and patient billing ledger',
    defaultRoles: ['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist', 'insurance_officer'],
  },
  {
    key: 'billing_collect',
    category: 'financial',
    label_ar: 'حق التحصيل واستلام المدفوعات',
    label_en: 'Payment Collection Authority',
    description_ar: 'تحصيل سداد الفواتير والديون وإصدار إيصالات الاستلام أو رد الرصيد على الخزينة',
    description_en: 'Collect invoice payments, record debt settlements, and issue cashbox refunds',
    defaultRoles: ['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist'],
  },
  {
    key: 'billing_create',
    category: 'financial',
    label_ar: 'إصدار الفواتير الجديدة',
    label_en: 'Create Invoices',
    description_ar: 'إنشاء فواتير خدمات وكشوفات جديدة للمرضى',
    description_en: 'Issue new patient service and visit invoices',
    defaultRoles: ['org_owner', 'general_manager', 'accountant', 'receptionist'],
  },
  {
    key: 'patient_balances_manage',
    category: 'financial',
    label_ar: 'تعديل أرصدة وباقات المرضى السابقة',
    label_en: 'Manage Patient Legacy Balances & Packages',
    description_ar: 'تسجيل مديونيات سابقة أو أرصدة/باقات جلسات مسبقة الدفع وخصم الجلسات',
    description_en: 'Record legacy patient balances, prepaid session packages, and session deductions',
    defaultRoles: ['org_owner', 'general_manager', 'branch_manager', 'accountant', 'receptionist', 'records_officer'],
  },
  {
    key: 'expenses_manage',
    category: 'financial',
    label_ar: 'تسجيل وإدارة المصروفات',
    label_en: 'Manage Operating Expenses',
    description_ar: 'إضافة وتعديل مصروفات المنشأة التشغيلية',
    description_en: 'Record and manage clinic operating expenses',
    defaultRoles: ['org_owner', 'general_manager', 'branch_manager', 'accountant'],
  },
  {
    key: 'payroll_manage',
    category: 'financial',
    label_ar: 'صرف وإدارة الرواتب',
    label_en: 'Payroll Disbursement',
    description_ar: 'اعتماد وصرف مسيرات رواتب الموظفين من الخزينة',
    description_en: 'Approve and disburse staff payroll slips',
    defaultRoles: ['org_owner', 'general_manager', 'accountant'],
  },
  {
    key: 'reports_view',
    category: 'financial',
    label_ar: 'عرض وتصدير التقارير التحليلية',
    label_en: 'View & Export Reports',
    description_ar: 'فتح صفحة التقارير وتصدير ملفات CSV',
    description_en: 'Access operational/analytics reports and export CSV',
    defaultRoles: ['org_owner', 'general_manager', 'branch_manager', 'medical_director', 'accountant', 'insurance_officer', 'inventory_manager', 'records_officer'],
  },
  {
    key: 'patients_manage',
    category: 'clinical',
    label_ar: 'إدارة ملفات المرضى (EMR)',
    label_en: 'Manage Patient EMR Files',
    description_ar: 'فتح وتعديل ملفات المرضى بالمنشأة',
    description_en: 'Register and update patient medical records',
    defaultRoles: ['org_owner', 'general_manager', 'branch_manager', 'medical_director', 'doctor', 'assistant_doctor', 'nurse', 'receptionist', 'records_officer'],
  },
  {
    key: 'appointments_manage',
    category: 'clinical',
    label_ar: 'إدارة المواعيد والحجوزات',
    label_en: 'Manage Appointments & Queue',
    description_ar: 'حجز وتعديل مواعيد العيادات وطابور الانتظار',
    description_en: 'Book and update clinic appointments and queue flow',
    defaultRoles: ['org_owner', 'general_manager', 'branch_manager', 'medical_director', 'doctor', 'assistant_doctor', 'nurse', 'receptionist'],
  },
  {
    key: 'clinical_manage',
    category: 'clinical',
    label_ar: 'الكشف السريري والـ 3D والروشتات',
    label_en: 'Clinical Exams, 3D & Prescriptions',
    description_ar: 'تسجيل واعتماد الكشوفات والفحوصات التخصصية 3D وإصدار الروشتات',
    description_en: 'Record consultations, 3D specialty exams, and prescriptions',
    defaultRoles: ['org_owner', 'general_manager', 'branch_manager', 'medical_director', 'doctor', 'assistant_doctor'],
  },
  {
    key: 'inventory_manage',
    category: 'admin',
    label_ar: 'إدارة الصيدلية والمخزون',
    label_en: 'Inventory & Pharmacy Management',
    description_ar: 'إضافة وصرف الأصناف والمستلزمات الطبية',
    description_en: 'Manage pharmacy items and medical supplies stock',
    defaultRoles: ['org_owner', 'general_manager', 'branch_manager', 'pharmacist', 'inventory_manager'],
  },
  {
    key: 'staff_manage',
    category: 'admin',
    label_ar: 'إدارة فريق العمل والصلاحيات',
    label_en: 'Staff & Permissions Management',
    description_ar: 'الاطلاع على حسابات الفريق وتعديل الصلاحيات',
    description_en: 'View team accounts and administer access controls',
    defaultRoles: ['org_owner', 'general_manager'],
  },
];

export const hasCustomCapability = (
  user: Pick<User, 'role' | 'custom_permissions'> | null | undefined,
  key: CustomPermissionKey
): boolean => {
  if (!user?.role) return false;
  if (user.role === 'super_admin' || user.role === 'org_owner') return true;
  const overrides: CustomPermissionsMap | undefined = user.custom_permissions;
  if (overrides && typeof overrides[key] === 'boolean') {
    return Boolean(overrides[key]);
  }
  const def = CUSTOM_PERMISSION_DEFINITIONS.find(item => item.key === key);
  return def ? def.defaultRoles.includes(user.role) : false;
};

export const hasUserPermission = (
  user: Pick<User, 'role' | 'custom_permissions'> | null | undefined,
  module: RbacModule,
  action: RbacAction = 'view'
): boolean => {
  if (!user?.role) return false;
  if (user.role === 'super_admin' || user.role === 'org_owner') return true;
  const overrides = user.custom_permissions;
  if (overrides) {
    if (module === 'billing') {
      if (action === 'approve' && typeof overrides.billing_collect === 'boolean') return overrides.billing_collect;
      if (action === 'create' && typeof overrides.billing_create === 'boolean') return overrides.billing_create;
      if (action === 'view') {
        if (typeof overrides.billing_view === 'boolean') {
          return overrides.billing_view || Boolean(overrides.billing_collect) || Boolean(overrides.billing_create);
        }
        if (overrides.billing_collect === true || overrides.billing_create === true) return true;
      }
    }
    if (module === 'reports' && typeof overrides.reports_view === 'boolean') return overrides.reports_view;
    if (module === 'patients' && typeof overrides.patients_manage === 'boolean') return overrides.patients_manage;
    if (module === 'appointments' && typeof overrides.appointments_manage === 'boolean') return overrides.appointments_manage;
    if ((module === 'consultations' || module === 'prescriptions') && typeof overrides.clinical_manage === 'boolean') {
      return overrides.clinical_manage;
    }
    if (module === 'inventory' && typeof overrides.inventory_manage === 'boolean') return overrides.inventory_manage;
    if (module === 'staff' && typeof overrides.staff_manage === 'boolean') return overrides.staff_manage;
    if (module === 'hr') {
      if (action === 'approve' && typeof overrides.payroll_manage === 'boolean') return overrides.payroll_manage;
      if ((action === 'edit' || action === 'create') && typeof overrides.expenses_manage === 'boolean') return overrides.expenses_manage;
    }
  }
  return hasPermission(user.role, module, action);
};
