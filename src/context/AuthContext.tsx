import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { User, Organization, Branch, Subscription } from '../types/database';
import { supabase } from '../lib/supabase';
import { APP_CONFIG } from '../config/appConfig';
import { hasPermission, RbacModule, RbacAction } from '../config/rbacPermissions';

interface AuthContextType {
  user: User | null; session: Session | null; organization: Organization | null;
  activeBranch: Branch | null; availableBranches: Branch[]; subscription: Subscription | null;
  isAuthenticated: boolean; isLoading: boolean; isPasswordRecovery: boolean;
  isSuperAdmin: boolean; isOrgOwner: boolean;
  isDoctor: boolean; isReceptionist: boolean; isAccountant: boolean; isPatient: boolean;
  isEnterpriseDedicated: boolean; can: (module: RbacModule, action?: RbacAction) => boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name_ar: string, name_en?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  switchBranch: (branchId: string) => void; logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(`${window.location.search}&${window.location.hash.slice(1)}`);
    return params.get('type') === 'recovery';
  });
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [branchId, setBranchId] = useState('');

  const loadIdentity = useCallback(async (current: Session | null) => {
    setSession(current);
    setUser(null); setOrganization(null); setActiveBranch(null); setAvailableBranches([]); setSubscription(null);
    if (!current || !supabase) return;
    const { data: profile, error: profileError } = await supabase.from('users').select('*').eq('id', current.user.id).maybeSingle();
    if (profileError || !profile || !profile.is_active) return;
    const typedUser = profile as User;
    setUser(typedUser);
    if (!typedUser.organization_id) return;
    const [orgResult, branchesResult, subResult] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', typedUser.organization_id).maybeSingle(),
      supabase.from('branches').select('*').eq('organization_id', typedUser.organization_id).eq('is_active', true),
      supabase.from('subscriptions').select('*').eq('organization_id', typedUser.organization_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (orgResult.data) setOrganization(orgResult.data as Organization);
    const branches = (branchesResult.data || []) as Branch[];
    setAvailableBranches(branches);
    setActiveBranch(branches.find(branch => branch.id === (branchId || typedUser.primary_branch_id)) || branches[0] || null);
    if (subResult.data) setSubscription(subResult.data as Subscription);
  }, [branchId]);

  useEffect(() => {
    if (!supabase) { setIsLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (alive) await loadIdentity(data.session);
      if (alive) setIsLoading(false);
    });
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, current) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false);
      void loadIdentity(current).finally(() => setIsLoading(false));
    });
    return () => { alive = false; authSubscription.unsubscribe(); };
  }, [loadIdentity]);

  const login: AuthContextType['login'] = async (email, password) => {
    if (!supabase) return { success: false, error: 'اتصال قاعدة البيانات غير مهيأ.' };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    return error ? { success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' } : { success: true };
  };
  const register: AuthContextType['register'] = async (email, password, name_ar, name_en) => {
    if (!supabase) return { success: false, error: 'اتصال قاعدة البيانات غير مهيأ.' };
    const { error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { name_ar, name_en: name_en || name_ar } } });
    return error ? { success: false, error: error.message } : { success: true };
  };
  const resetPassword: AuthContextType['resetPassword'] = async email => {
    if (!supabase) return { success: false, error: 'اتصال قاعدة البيانات غير مهيأ.' };
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/`,
    });
    return error ? { success: false, error: error.message } : { success: true };
  };
  const updatePassword: AuthContextType['updatePassword'] = async password => {
    if (!supabase) return { success: false, error: 'اتصال قاعدة البيانات غير مهيأ.' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { success: false, error: error.message };
    // A recovery link establishes a temporary authenticated session. End only
    // this browser session so the user must explicitly sign in with the new password.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    setIsPasswordRecovery(false);
    setSession(null);
    setUser(null);
    setOrganization(null);
    setActiveBranch(null);
    setAvailableBranches([]);
    setSubscription(null);
    window.history.replaceState({}, document.title, window.location.pathname);
    if (signOutError) {
      return { success: false, error: 'تم تغيير كلمة المرور، لكن تعذر إنهاء الجلسة. سجّل الخروج ثم ادخل مجدداً.' };
    }
    return { success: true };
  };
  const switchBranch = (id: string) => {
    const permitted = availableBranches.find(branch => branch.id === id);
    if (permitted) { setBranchId(id); setActiveBranch(permitted); }
  };
  const logout = async () => {
    try { if (supabase) await supabase.auth.signOut({ scope: 'global' }); }
    finally { setSession(null); setUser(null); setOrganization(null); setActiveBranch(null); setAvailableBranches([]); setSubscription(null); }
  };
  const can = (module: RbacModule, action: RbacAction = 'view') => hasPermission(user?.role, module, action);
  const isSuperAdmin = user?.role === 'super_admin';
  const value = useMemo<AuthContextType>(() => ({
    user, session, organization, activeBranch, availableBranches, subscription, isAuthenticated: Boolean(session && user),
    isPasswordRecovery,
    isLoading, isSuperAdmin,
    isOrgOwner: user?.role === 'org_owner' || user?.role === 'general_manager',
    isDoctor: user?.role === 'doctor' || user?.role === 'assistant_doctor', isReceptionist: user?.role === 'receptionist',
    isAccountant: user?.role === 'accountant', isPatient: user?.role === 'patient',
    isEnterpriseDedicated: Boolean(organization?.is_enterprise_dedicated || APP_CONFIG.isEnterpriseMode),
    can, login, register, resetPassword, updatePassword, switchBranch, logout,
  }), [user, session, organization, activeBranch, availableBranches, subscription, isLoading, isPasswordRecovery, isSuperAdmin]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
