// ============================================================================
// MEDICORE – Authentication and Authorization Types
// ============================================================================

import { AppRole, User, Organization, Branch } from './database';

export interface AuthSession {
  user: User;
  organization?: Organization;
  activeBranch?: Branch;
  availableBranches: Branch[];
  token?: string;
  isSuperAdmin: boolean;
  isOrgOwner: boolean;
  isDoctor: boolean;
  isStaff: boolean;
  isPatient: boolean;
}

export interface PermissionCheck {
  module: string;
  action: 'view' | 'create' | 'edit' | 'delete' | 'sign' | 'approve' | 'export';
}

export const ROLE_HIERARCHY: Record<AppRole, number> = {
  super_admin: 100,
  platform_admin: 95,
  org_owner: 90,
  platform_support: 85,
  billing_admin: 85,
  general_manager: 80,
  medical_director: 75,
  branch_manager: 70,
  doctor: 60,
  assistant_doctor: 55,
  accountant: 50,
  insurance_officer: 45,
  lab_technician: 40,
  radiology_technician: 40,
  pharmacist: 40,
  inventory_manager: 40,
  records_officer: 35,
  nurse: 30,
  receptionist: 20,
  patient: 10,
};

export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  super_admin: ['*'],
  platform_admin: ['*'],
  platform_support: ['dashboard:view', 'organizations:view', 'support:*'],
  billing_admin: ['dashboard:view', 'billing:*', 'subscriptions:*', 'reports:financial'],
  org_owner: ['*'],
  general_manager: [
    'dashboard:view', 'patients:*', 'appointments:*', 'consultations:*',
    'prescriptions:*', 'laboratory:*', 'radiology:*', 'billing:*', 'staff:*',
    'branches:*', 'reports:*', 'inventory:*', 'insurance:*', 'settings:*'
  ],
  medical_director: [
    'dashboard:view', 'patients:*', 'consultations:*', 'prescriptions:*',
    'laboratory:*', 'radiology:*', 'reports:*', 'staff:view'
  ],
  branch_manager: [
    'dashboard:view', 'patients:*', 'appointments:*', 'consultations:view',
    'prescriptions:view', 'billing:*', 'staff:view', 'reports:*', 'inventory:*'
  ],
  doctor: [
    'dashboard:view', 'patients:view', 'patients:create', 'patients:edit',
    'appointments:view', 'appointments:create',
    'consultations:*', 'prescriptions:*', 'laboratory:order', 'radiology:order',
    'reports:clinical'
  ],
  assistant_doctor: [
    'dashboard:view', 'patients:view', 'appointments:view',
    'consultations:create', 'consultations:view', 'prescriptions:create'
  ],
  nurse: [
    'dashboard:view', 'patients:view', 'appointments:view', 'appointments:checkin',
    'consultations:vitals', 'laboratory:sample_collect'
  ],
  receptionist: [
    'dashboard:view', 'patients:view', 'patients:create', 'patients:edit',
    'appointments:*', 'billing:create_invoice', 'billing:receive_payment', 'cashbox:view'
  ],
  accountant: [
    'dashboard:view', 'billing:*', 'cashbox:*', 'expenses:*',
    'commissions:*', 'reports:financial', 'insurance:*'
  ],
  lab_technician: [
    'dashboard:view', 'patients:view', 'laboratory:*'
  ],
  radiology_technician: [
    'dashboard:view', 'patients:view', 'radiology:*'
  ],
  pharmacist: [
    'dashboard:view', 'prescriptions:view', 'prescriptions:dispense', 'inventory:*'
  ],
  insurance_officer: [
    'dashboard:view', 'billing:view', 'insurance:*', 'reports:insurance'
  ],
  inventory_manager: [
    'dashboard:view', 'inventory:*', 'reports:inventory'
  ],
  records_officer: [
    'dashboard:view', 'patients:*', 'reports:clinical'
  ],
  patient: [
    'portal:view', 'appointments:book', 'prescriptions:my_view', 'results:my_view'
  ]
};
