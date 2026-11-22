// ============================================================================
// MEDICORE – Multi-Tenant Auth Context with Role & Branch Switching
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Organization, Branch, Subscription } from '../types/database';
import { dbClient } from '../lib/dbClient';
import { APP_CONFIG } from '../config/appConfig';

interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  activeBranch: Branch | null;
  availableBranches: Branch[];
  subscription: Subscription | null;
  isSuperAdmin: boolean;
  isOrgOwner: boolean;
  isDoctor: boolean;
  isReceptionist: boolean;
  isAccountant: boolean;
  isPatient: boolean;
  isEnterpriseDedicated: boolean;
  switchRole: (userId: string) => void;
  switchBranch: (branchId: string) => void;
  switchOrganization: (orgId: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Default to Dr. Assem (Org Owner of Al-Noor Medical Complex) or Super Admin
  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem('medicore_user_id') || 'user-alnoor-owner';
  });

  const [activeBranchId, setActiveBranchId] = useState<string>(() => {
    return localStorage.getItem('medicore_branch_id') || 'branch-alnoor-main';
  });

  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const refreshState = () => {
    const u = dbClient.getUserById(currentUserId) || dbClient.getUsers()[0];
    setUser(u || null);

    if (u?.organization_id) {
      const org = dbClient.getOrganizationById(u.organization_id);
      setOrganization(org || null);

      const branches = dbClient.getBranches(u.organization_id);
      setAvailableBranches(branches);

      const branch = branches.find(b => b.id === activeBranchId) || branches[0] || null;
      setActiveBranch(branch);

      const sub = dbClient.getSubscriptionByOrgId(u.organization_id);
      setSubscription(sub || null);
    } else {
      // Super admin or unassociated
      setOrganization(null);
      setAvailableBranches([]);
      setActiveBranch(null);
      setSubscription(null);
    }
  };

  useEffect(() => {
    refreshState();
    return dbClient.subscribe(refreshState);
  }, [currentUserId, activeBranchId]);

  const switchRole = (userId: string) => {
    setCurrentUserId(userId);
    localStorage.setItem('medicore_user_id', userId);
    const u = dbClient.getUserById(userId);
    if (u?.organization_id) {
      const branches = dbClient.getBranches(u.organization_id);
      if (branches.length > 0) {
        setActiveBranchId(branches[0].id);
        localStorage.setItem('medicore_branch_id', branches[0].id);
      }
    }
  };

  const switchBranch = (branchId: string) => {
    setActiveBranchId(branchId);
    localStorage.setItem('medicore_branch_id', branchId);
  };

  const switchOrganization = (orgId: string) => {
    const orgUsers = dbClient.getUsers(orgId);
    if (orgUsers.length > 0) {
      switchRole(orgUsers[0].id);
    }
  };

  const logout = () => {
    // Switch to patient portal or clear
    switchRole('user-super-admin');
  };

  const isSuperAdmin = user?.role === 'super_admin';
  const isOrgOwner = user?.role === 'org_owner' || user?.role === 'general_manager';
  const isDoctor = user?.role === 'doctor' || user?.role === 'assistant_doctor';
  const isReceptionist = user?.role === 'receptionist';
  const isAccountant = user?.role === 'accountant';
  const isPatient = user?.role === 'patient';
  const isEnterpriseDedicated = Boolean(organization?.is_enterprise_dedicated || APP_CONFIG.isEnterpriseMode);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        activeBranch,
        availableBranches,
        subscription,
        isSuperAdmin,
        isOrgOwner,
        isDoctor,
        isReceptionist,
        isAccountant,
        isPatient,
        isEnterpriseDedicated,
        switchRole,
        switchBranch,
        switchOrganization,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
