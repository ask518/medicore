import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { User, Organization, Branch, Subscription, CustomPermissionKey } from '../types/database';
import { supabase } from '../lib/supabase';
import { APP_CONFIG } from '../config/appConfig';
import { hasPermission, hasUserPermission, hasCustomCapability, RbacModule, RbacAction } from '../config/rbacPermissions';

interface AuthContextType {
  user: User | null; session: Session | null; organization: Organization | null;
  activeBranch: Branch | null; availableBranches: Branch[]; subscription: Subscription | null;
  isFacilitySupportMode: boolean; supportSessionExpiresAt: string | null;
  isAuthenticated: boolean; isLoading: boolean; isPasswordRecovery: boolean;
  isSuperAdmin: boolean; isOrgOwner: boolean;
  isDoctor: boolean; isReceptionist: boolean; isAccountant: boolean; isPatient: boolean;
  isEnterpriseDedicated: boolean;
  can: (module: RbacModule, action?: RbacAction) => boolean;
  hasCustomPermission: (key: CustomPermissionKey) => boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name_ar: string, name_en?: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  switchBranch: (branchId: string) => void;
  refreshIdentity: () => Promise<void>;
  enterFacilitySupport: (organizationId: string) => Promise<{ success: boolean; error?: string }>;
  exitFacilitySupport: (reason?: 'user_exit' | 'expired') => Promise<void>;
  logout: () => Promise<void>;
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
  const [supportSession, setSupportSession] = useState<{ id: string; expiresAt: string } | null>(null);
  const branchIdRef = useRef('');
  const supportSessionRef = useRef<typeof supportSession>(null);
  const supportOrgIdRef = useRef('');
  useEffect(() => { supportSessionRef.current = supportSession; }, [supportSession]);

  const loadIdentity = useCallback(async (current: Session | null) => {
    setSession(current);
    setUser(null); setOrganization(null); setActiveBranch(null); setAvailableBranches([]); setSubscription(null);
    setSupportSession(null); branchIdRef.current = '';
    if (!current || !supabase) return;
    const { data: profile, error: profileError } = await supabase.from('users').select('*').eq('id', current.user.id).maybeSingle();
    if (profileError || !profile) return;
    if (!profile.is_active && profile.role !== 'patient') return;
    const typedUser = profile as User;
    setUser(typedUser);
    if (!typedUser.organization_id) return;
    const [orgResult, branchesResult, subResult] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', typedUser.organization_id).maybeSingle(),
      supabase.from('branches').select('*').eq('organization_id', typedUser.organization_id).eq('is_active', true),
      supabase.from('subscriptions').select('*, plan:subscription_plans(*)').eq('organization_id', typedUser.organization_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (orgResult.data) setOrganization(orgResult.data as Organization);
    const branches = (branchesResult.data || []) as Branch[];
    setAvailableBranches(branches);
    setActiveBranch(branches.find(branch => branch.id === (branchIdRef.current || typedUser.primary_branch_id)) || branches[0] || null);
    if (subResult.data) setSubscription(subResult.data as Subscription);
  }, []);

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
      if (event === 'TOKEN_REFRESHED' && supportSessionRef.current) {
        setSession(current);
        setIsLoading(false);
        return;
      }
      void loadIdentity(current).finally(() => setIsLoading(false));
    });
    return () => { alive = false; authSubscription.unsubscribe(); };
  }, [loadIdentity]);

  const login: AuthContextType['login'] = async (email, password) => {
    if (!supabase) return { success: false, error: 'اتصال قاعدة البيانات غير مهيأ.' };
    const clean = email.trim().toLowerCase();
    const normalizedEmail = clean.includes('@') ? clean : (/^[a-z0-9._-]{3,50}$/.test(clean) ? `${clean}@medicore.local` : clean);
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    return error ? { success: false, error: 'بيانات الدخول غير صحيحة.' } : { success: true };
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
  const changePassword: AuthContextType['changePassword'] = async (currentPassword, newPassword) => {
    if (!supabase || !session?.user?.email) {
      return { success: false, error: 'الجلسة غير نشطة.' };
    }
    if (!currentPassword) {
      return { success: false, error: 'أدخل كلمة المرور الحالية.' };
    }
    if (newPassword.length < 12 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return { success: false, error: 'كلمة المرور الجديدة يجب أن تكون 12 خانة على الأقل مع حرف لاتيني ورقم.' };
    }
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });
    if (verifyErr) {
      return { success: false, error: 'كلمة المرور الحالية غير صحيحة.' };
    }
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    if (updateErr) {
      return { success: false, error: updateErr.message };
    }
    return { success: true };
  };
  const refreshIdentity = useCallback(async () => {
    if (!supabase) return;
    const activeSupport = supportSessionRef.current;
    const activeSupportOrgId = supportOrgIdRef.current;
    if (activeSupport && activeSupportOrgId) {
      const [orgResult, branchResult, subscriptionResult] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', activeSupportOrgId).maybeSingle(),
        supabase.from('branches').select('*').eq('organization_id', activeSupportOrgId).eq('is_active', true).order('is_main_branch', { ascending: false }),
        supabase.from('subscriptions').select('*, plan:subscription_plans(*)').eq('organization_id', activeSupportOrgId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (orgResult.data) setOrganization(orgResult.data as Organization);
      const branches = (branchResult.data || []) as Branch[];
      setAvailableBranches(branches);
      setActiveBranch(branches.find(b => b.id === branchIdRef.current) || branches[0] || null);
      if (subscriptionResult.data) setSubscription(subscriptionResult.data as Subscription);
      return;
    }
    const { data } = await supabase.auth.getSession();
    await loadIdentity(data.session);
  }, [loadIdentity]);

  const switchBranch = (id: string) => {
    const permitted = availableBranches.find(branch => branch.id === id);
    if (permitted) { branchIdRef.current = id; setActiveBranch(permitted); }
  };
  const isFacilitySupportMode = Boolean(supportSession && organization);
  const can = useCallback((module: RbacModule, action: RbacAction = 'view') => {
    if (isFacilitySupportMode) return true;
    return hasUserPermission(user, module, action);
  }, [isFacilitySupportMode, user]);
  const hasCustomPermission = useCallback((key: CustomPermissionKey) => {
    if (isFacilitySupportMode) return true;
    return hasCustomCapability(user, key);
  }, [isFacilitySupportMode, user]);
  const isSuperAdmin = user?.role === 'super_admin';
  const enterFacilitySupport = useCallback<AuthContextType['enterFacilitySupport']>(async organizationId => {
    if (!supabase || !session || !isSuperAdmin) return { success: false, error: 'دخول المنشأة متاح لمالك المنصة فقط.' };
    if (supportSession) return { success: false, error: 'أنه جلسة دعم المنشأة الحالية أولاً.' };

    const { data: startData, error: startError } = await supabase.rpc('platform_start_support_session', { p_organization_id: organizationId });
    const started = Array.isArray(startData) ? startData[0] : startData;
    if (startError || !started?.session_id || !started?.expires_at) {
      return { success: false, error: startError?.message || 'تعذر بدء جلسة دعم المنشأة.' };
    }

    const [orgResult, branchResult, subscriptionResult] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', organizationId).maybeSingle(),
      supabase.from('branches').select('*').eq('organization_id', organizationId).eq('is_active', true).order('is_main_branch', { ascending: false }),
      supabase.from('subscriptions').select('*, plan:subscription_plans(*)').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const org = orgResult.data as Organization | null;
    if (orgResult.error || !org || org.status !== 'active' || branchResult.error) {
      await supabase.rpc('platform_end_support_session', { p_session_id: started.session_id, p_reason: 'setup_failed' });
      return { success: false, error: 'تعذر تحميل المنشأة النشطة. لم يتم فتح مساحة العمل.' };
    }

    const branches = (branchResult.data || []) as Branch[];
    supportOrgIdRef.current = organizationId;
    setOrganization(org);
    setAvailableBranches(branches);
    setActiveBranch(branches[0] || null);
    branchIdRef.current = branches[0]?.id || '';
    setSubscription((subscriptionResult.data as Subscription | null) || null);
    setSupportSession({ id: started.session_id, expiresAt: started.expires_at });
    return { success: true };
  }, [isSuperAdmin, session, supportSession]);
  const exitFacilitySupport = useCallback<AuthContextType['exitFacilitySupport']>(async reason => {
    const active = supportSession;
    if (active && supabase) {
      await supabase.rpc('platform_end_support_session', {
        p_session_id: active.id,
        p_reason: reason || 'user_exit',
      });
    }
    supportOrgIdRef.current = '';
    setSupportSession(null);
    setOrganization(null); setActiveBranch(null); setAvailableBranches([]); setSubscription(null); branchIdRef.current = '';
  }, [supportSession]);
  useEffect(() => {
    if (!supportSession) return;
    const remaining = Math.max(0, new Date(supportSession.expiresAt).getTime() - Date.now());
    const timer = window.setTimeout(() => { void exitFacilitySupport('expired'); }, remaining);
    return () => window.clearTimeout(timer);
  }, [supportSession, exitFacilitySupport]);
  const logout = async () => {
    try {
      if (supportSession && supabase) await supabase.rpc('platform_end_support_session', { p_session_id: supportSession.id, p_reason: 'user_exit' });
      if (supabase) await supabase.auth.signOut({ scope: 'global' });
    }
    finally { setSession(null); setUser(null); setOrganization(null); setActiveBranch(null); setAvailableBranches([]); setSubscription(null); setSupportSession(null); branchIdRef.current = ''; }
  };
  const value = useMemo<AuthContextType>(() => ({
    user, session, organization, activeBranch, availableBranches, subscription, isAuthenticated: Boolean(session && user),
    isFacilitySupportMode, supportSessionExpiresAt: supportSession?.expiresAt || null,
    isPasswordRecovery,
    isLoading, isSuperAdmin,
    isOrgOwner: user?.role === 'org_owner' || user?.role === 'general_manager' || isFacilitySupportMode,
    isDoctor: user?.role === 'doctor' || user?.role === 'assistant_doctor', isReceptionist: user?.role === 'receptionist',
    isAccountant: user?.role === 'accountant', isPatient: user?.role === 'patient',
    isEnterpriseDedicated: Boolean(organization?.is_enterprise_dedicated || APP_CONFIG.isEnterpriseMode),
    can, hasCustomPermission, login, register, resetPassword, updatePassword, changePassword, switchBranch, refreshIdentity, enterFacilitySupport, exitFacilitySupport, logout,
  }), [user, session, organization, activeBranch, availableBranches, subscription, isLoading, isPasswordRecovery, isSuperAdmin, isFacilitySupportMode, supportSession, can, hasCustomPermission, enterFacilitySupport, exitFacilitySupport, refreshIdentity]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
