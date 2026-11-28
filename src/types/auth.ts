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
