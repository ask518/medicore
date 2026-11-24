// ============================================================================
// MEDICORE – Role-Based Access Control (RBAC) & Granular Permissions Engine
// Section 6 Implementation: Platform & Organization Permissions Matrix
// ============================================================================

import { AppRole } from '../types/database';

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
    if (['appointments', 'staff'].includes(module)) return ['view', 'approve'].includes(action);
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

  // 16. Patient Portal
  if (role === 'patient') {
    if (['appointments', 'prescriptions', 'laboratory'].includes(module)) return ['view', 'print'].includes(action);
    return false;
  }

  return false;
};
