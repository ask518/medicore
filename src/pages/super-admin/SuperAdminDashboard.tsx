import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { AppRole, Organization, Subscription, User } from '../../types/database';
import { Building2, Users, ShieldCheck, RefreshCw, Plus, Pencil, UserRoundX, UserRoundCheck, X, LogIn, KeyRound, Eye, EyeOff } from 'lucide-react';

interface Props { activeTab: string; onSelectTab: (tab: string) => void }
type OrganizationRow = Organization & { branches?: { id: string }[]; subscriptions?: Subscription[] };
type AdminUser = Pick<User, 'id' | 'email' | 'name_ar' | 'name_en' | 'role' | 'is_active' | 'organization_id'>;
type EditableUser = AdminUser & { password?: string };

const platformRoles: AppRole[] = [
  'super_admin', 'org_owner', 'general_manager', 'branch_manager', 'doctor', 'assistant_doctor',
  'nurse', 'receptionist', 'accountant', 'lab_technician', 'radiology_technician', 'pharmacist',
  'insurance_officer', 'inventory_manager', 'records_officer', 'patient',
];
const facilityTypes = ['private_clinic', 'poly_clinic', 'medical_center', 'specialized_center', 'complex', 'hospital'] as const;

const emptyFacility = {
  name_ar: '', name_en: '', email: '', phone: '', city: '', address: '', facility_type: 'private_clinic',
  owner_email: '', owner_password: '', owner_name_ar: '', owner_name_en: '',
};

const emptyNewUser = {
  email: '', password: '', name_ar: '', name_en: '', phone: '', role: 'org_owner' as AppRole,
  organization_id: '', specialty_title_ar: 'طب عام', specialty_title_en: 'General Practice',
};

const generateStrongPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let out = 'Mc9!';
  for (let i = 0; i < 10; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
};

const getAdminErrorMessage = async (error: unknown, fallback: string) => {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json() as { error?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
    } catch {
      // Fall through to the Supabase client message when the response isn't JSON.
    }
  }
  return error instanceof Error ? error.message : fallback;
};

export const SuperAdminDashboard: React.FC<Props> = ({ activeTab, onSelectTab }) => {
  const { locale, t } = useLanguage();
  const { user: currentUser, enterFacilitySupport, isFacilitySupportMode } = useAuth();
  const { success, error } = useToast();
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [confirmUserSave, setConfirmUserSave] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ ...emptyNewUser });
  const [showNewUserPass, setShowNewUserPass] = useState(false);
  const [showFacilityForm, setShowFacilityForm] = useState(false);
  const [showOwnerPass, setShowOwnerPass] = useState(false);
  const [confirmFacilityCreate, setConfirmFacilityCreate] = useState(false);
  const [editingFacility, setEditingFacility] = useState<OrganizationRow | null>(null);
  const [confirmFacilityUpdate, setConfirmFacilityUpdate] = useState(false);
  const [facility, setFacility] = useState({ ...emptyFacility });
  const [manualInvitation, setManualInvitation] = useState<{ email: string; password?: string; link?: string } | null>(null);
  const [supportCandidate, setSupportCandidate] = useState<OrganizationRow | null>(null);
  const [search, setSearch] = useState('');
  const [startingSupport, setStartingSupport] = useState(false);
  const ar = locale === 'ar';

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      error(ar ? 'اتصال قاعدة البيانات غير مهيأ.' : 'Database connection is not configured.');
      return;
    }
    setLoading(true);
    const [orgResult, userResult] = await Promise.all([
      supabase.from('organizations').select('*,branches(id),subscriptions(*)').order('created_at', { ascending: false }),
      supabase.from('users').select('id,email,name_ar,name_en,role,is_active,organization_id', { count: 'exact' }).order('created_at', { ascending: false }),
    ]);
    if (orgResult.error || userResult.error) {
      error(ar ? 'تعذر تحميل بيانات المنصة. تحقق من ترحيلات الصلاحيات.' : 'Could not load platform data. Check the security migrations.');
      setLoading(false);
      return;
    }
    setOrganizations((orgResult.data || []) as unknown as OrganizationRow[]);
    setUsers((userResult.data || []) as AdminUser[]);
    setUserCount(userResult.count || 0);
    setLoading(false);
  }, [ar, error]);

  useEffect(() => { void load(); }, [load]);

  const callPlatformAdmin = async (body: Record<string, unknown>) => {
    if (!supabase) return { data: null, error: new Error('Database connection is not configured.') };
    return supabase.functions.invoke('platform-admin', { body });
  };

  const startFacilitySupport = async () => {
    if (!supportCandidate || isFacilitySupportMode) return;
    setStartingSupport(true);
    const result = await enterFacilitySupport(supportCandidate.id);
    setStartingSupport(false);
    if (!result.success) {
      error(result.error || (ar ? 'تعذر فتح المنشأة.' : 'Could not open facility.'));
      return;
    }
    success(ar ? 'بدأت جلسة دخول دعم مؤقتة للمنشأة.' : 'A temporary facility support session has started.');
    setSupportCandidate(null);
    onSelectTab('dashboard');
  };

  const createUserAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (newUser.password.length < 12 || !/[A-Za-z]/.test(newUser.password) || !/[0-9]/.test(newUser.password)) {
      error(ar ? 'كلمة المرور يجب أن تكون 12 خانة على الأقل مع حرف ورقم.' : 'Password must be at least 12 characters with a letter and a number.');
      return;
    }
    setSaving(true);
    const { data, error: invokeError } = await callPlatformAdmin({
      action: 'create_user',
      ...newUser,
      organization_id: newUser.role === 'super_admin' ? null : newUser.organization_id,
    });
    setSaving(false);
    if (invokeError || data?.error) {
      error(data?.error || await getAdminErrorMessage(invokeError, ar ? 'تعذر إنشاء الحساب.' : 'Could not create user.'));
      return;
    }
    setManualInvitation({ email: data.email || newUser.email, password: newUser.password });
    success(ar ? 'تم إنشاء الحساب وتفعيله في Supabase فوراً.' : 'User account created and confirmed in Supabase.');
    setNewUser({ ...emptyNewUser });
    setShowCreateUser(false);
    await load();
  };

  const saveUser = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingUser) return;
    if (editingUser.password && (editingUser.password.length < 12 || !/[A-Za-z]/.test(editingUser.password) || !/[0-9]/.test(editingUser.password))) {
      error(ar ? 'كلمة المرور الجديدة يجب أن تكون 12 خانة على الأقل مع حرف ورقم.' : 'New password must be at least 12 characters with a letter and a number.');
      return;
    }
    setSaving(true);
    const { data, error: invokeError } = await callPlatformAdmin({
      action: 'update_user',
      user_id: editingUser.id,
      name_ar: editingUser.name_ar,
      name_en: editingUser.name_en,
      role: editingUser.role,
      is_active: editingUser.is_active,
      ...(editingUser.password ? { password: editingUser.password } : {}),
    });
    setSaving(false);
    if (invokeError || data?.error) {
      error(data?.error || await getAdminErrorMessage(invokeError, ar ? 'تعذر تحديث الحساب.' : 'Could not update account.'));
      return;
    }
    success(ar ? 'تم تحديث الحساب وتسجيل العملية.' : 'Account updated and audited.');
    setEditingUser(null);
    setConfirmUserSave(false);
    await load();
  };

  const createFacility = async (event: FormEvent) => {
    event.preventDefault();
    if (facility.owner_password && (facility.owner_password.length < 12 || !/[A-Za-z]/.test(facility.owner_password) || !/[0-9]/.test(facility.owner_password))) {
      error(ar ? 'كلمة مرور المالك يجب أن تكون 12 خانة على الأقل مع حرف ورقم.' : 'Owner password must be at least 12 characters with a letter and a number.');
      return;
    }
    setSaving(true);
    const { data, error: invokeError } = await callPlatformAdmin({ action: 'create_facility', ...facility });
    setSaving(false);
    if (invokeError || data?.error) {
      error(data?.error || await getAdminErrorMessage(invokeError, ar ? 'تعذر إنشاء المنشأة.' : 'Could not create facility.'));
      return;
    }
    if (data?.invitation_delivery === 'direct_password') {
      setManualInvitation({ email: data.owner_email || facility.owner_email, password: facility.owner_password });
      success(ar ? 'تم إنشاء المنشأة وحساب المالك بكلمة المرور فوراً بدون انتظار البريد.' : 'Facility and owner account created immediately.');
    } else if (data?.invitation_link) {
      setManualInvitation({ email: facility.owner_email, link: data.invitation_link });
      success(ar ? 'تم إنشاء المنشأة. رابط التفعيل جاهز.' : 'Facility created; activation link ready.');
    } else {
      success(ar ? 'تم إنشاء المنشأة والفرع الرئيسي وإرسال دعوة المالك.' : 'Facility and main branch created; owner invitation sent.');
    }
    setFacility({ ...emptyFacility });
    setShowFacilityForm(false);
    setConfirmFacilityCreate(false);
    await load();
  };

  const saveFacility = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingFacility) return;
    setSaving(true);
    const { data, error: invokeError } = await callPlatformAdmin({
      action: 'update_facility', organization_id: editingFacility.id,
      name_ar: editingFacility.name_ar, name_en: editingFacility.name_en,
      facility_type: editingFacility.facility_type, email: editingFacility.email,
      phone: editingFacility.phone, city: editingFacility.city, address: editingFacility.address,
    });
    setSaving(false);
    if (invokeError || data?.error) {
      error(data?.error || await getAdminErrorMessage(invokeError, ar ? 'تعذر حفظ بيانات المنشأة.' : 'Could not save facility details.'));
      return;
    }
    success(ar ? 'تم حفظ بيانات المنشأة والفرع الرئيسي في السحابة.' : 'Facility and main branch details were saved to the cloud.');
    setEditingFacility(null);
    setConfirmFacilityUpdate(false);
    await load();
  };

  const activeCount = organizations.filter(org => org.status === 'active').length;
  const branchCount = organizations.reduce((count, org) => count + (org.branches?.length || 0), 0);
  const trialCount = organizations.reduce((count, org) => count + (org.subscriptions || []).filter(sub => sub.status === 'trialing').length, 0);
  const tabs = [
    ['super_admin_dashboard', ar ? 'نظرة عامة' : 'Overview'],
    ['super_admin_orgs', ar ? 'المنشآت' : 'Facilities'],
    ['super_admin_users', ar ? 'الحسابات' : 'Accounts'],
    ['super_admin_subscriptions', ar ? 'الاشتراكات' : 'Subscriptions'],
  ];
  const visibleUsers = users.filter(item => `${item.email} ${item.name_ar} ${item.name_en}`.toLowerCase().includes(search.toLowerCase()));

  const roleLabel = (role: AppRole) => t.roles[role] || role;
  const roleOptions = platformRoles.filter(role => !editingUser?.organization_id || role !== 'super_admin');
  const statusLabel = (status: Organization['status']) => ({
    active: ar ? 'نشطة' : 'Active',
    pending_approval: ar ? 'بانتظار الموافقة' : 'Pending approval',
    suspended: ar ? 'موقوفة' : 'Suspended',
    archived: ar ? 'مؤرشفة' : 'Archived',
  })[status];

  return (
    <main className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
      <header className="rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 p-6 text-white">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-purple-300" />
          <div>
            <h1 className="text-2xl font-black">{ar ? 'إدارة المنصة' : 'Platform administration'}</h1>
            <p className="mt-1 text-sm text-purple-100">{ar ? 'إدارة المنشآت والحسابات بإجراءات موثقة ومحمية على الخادم.' : 'Manage facilities and accounts through audited, server-protected workflows.'}</p>
          </div>
          <button onClick={() => void load()} className="ms-auto rounded-xl border border-white/20 p-2" title={ar ? 'تحديث' : 'Refresh'}><RefreshCw className="h-4 w-4" /></button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => onSelectTab(key)} className={`rounded-xl px-4 py-2 text-xs font-bold ${activeTab === key ? 'bg-purple-900 text-white' : 'border bg-white text-slate-700'}`}>{label}</button>
        ))}
      </nav>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [ar ? 'المنشآت' : 'Facilities', organizations.length, <Building2 key="o" className="h-5 w-5" />],
          [ar ? 'المنشآت النشطة' : 'Active facilities', activeCount, <ShieldCheck key="a" className="h-5 w-5" />],
          [ar ? 'الفروع' : 'Branches', branchCount, <Building2 key="b" className="h-5 w-5" />],
          [ar ? 'حسابات المستخدمين' : 'User accounts', userCount, <Users key="u" className="h-5 w-5" />],
        ].map(([label, value, icon]) => (
          <article key={String(label)} className="flex items-center justify-between rounded-2xl border bg-white p-5">
            <div>
              <p className="text-xs font-bold text-slate-500">{String(label)}</p>
              <p className="mt-1 text-2xl font-black">{loading ? '—' : String(value)}</p>
            </div>
            <span className="text-purple-700">{icon}</span>
          </article>
        ))}
      </section>

      {(activeTab === 'super_admin_subscriptions' || activeTab === 'super_admin_dashboard') && (
        <p className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
          {ar ? `الاشتراكات التجريبية الحالية: ${loading ? '—' : trialCount}. إدارة التحصيل والخطط المالية غير مفعلة.` : `Current trial subscriptions: ${loading ? '—' : trialCount}. Payment collection and plan pricing controls remain disabled.`}
        </p>
      )}

      {activeTab === 'super_admin_users' && (
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <h2 className="font-black">{ar ? 'حسابات المستخدمين' : 'User accounts'}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder={ar ? 'بحث بالاسم أو البريد' : 'Search name or email'} className="rounded-xl border px-3 py-2 text-xs" />
              <button onClick={() => { setNewUser({ ...emptyNewUser, organization_id: organizations[0]?.id || '' }); setShowCreateUser(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-medicore-600 px-3 py-2 text-xs font-bold text-white">
                <Plus className="h-4 w-4" />{ar ? 'إنشاء حساب مستخدم' : 'Create User'}
              </button>
            </div>
          </div>
          {loading ? <p className="p-8 text-sm text-slate-500">{ar ? 'جار تحميل البيانات...' : 'Loading...'}</p> : visibleUsers.length === 0 ? <p className="p-8 text-sm text-slate-500">{ar ? 'لا توجد حسابات مطابقة.' : 'No matching accounts.'}</p> : visibleUsers.map(item => (
            <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <p className="font-bold">{ar ? item.name_ar : item.name_en}</p>
                <p className="text-xs text-slate-500">{item.email}</p>
                <p className="mt-1 text-[11px] text-slate-400">{item.organization_id ? (ar ? 'حساب منشأة' : 'Facility account') : (ar ? 'حساب منصة' : 'Platform account')}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{roleLabel(item.role)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs ${item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{item.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'موقوف' : 'Disabled')}</span>
                <button disabled={saving} onClick={() => { setEditingUser({ ...item, password: '' }); setConfirmUserSave(false); }} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"><Pencil className="h-3.5 w-3.5" />{ar ? 'تعديل' : 'Edit'}</button>
                <button disabled={saving || item.id === currentUser?.id || (item.role === 'super_admin' && item.is_active && users.filter(row => row.role === 'super_admin' && row.is_active).length <= 1)} onClick={() => { setEditingUser({ ...item, is_active: !item.is_active }); setConfirmUserSave(true); }} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">
                  {item.is_active ? <UserRoundX className="h-3.5 w-3.5" /> : <UserRoundCheck className="h-3.5 w-3.5" />}{item.is_active ? (ar ? 'إيقاف الحساب' : 'Disable account') : (ar ? 'إعادة التفعيل' : 'Reactivate')}
                </button>
              </div>
            </article>
          ))}
          <p className="p-4 text-xs leading-6 text-slate-500">{ar ? 'إيقاف الحساب يمنع الدخول ويحافظ على ملكية السجلات الطبية وسجل التدقيق؛ الحذف النهائي غير متاح.' : 'Disabling an account blocks sign-in while preserving clinical record ownership and audit history. Permanent deletion is not available.'}</p>
        </section>
      )}

      {activeTab !== 'super_admin_users' && (
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <h2 className="font-black">{ar ? 'المنشآت المسجلة' : 'Registered facilities'}</h2>
            <button onClick={() => { setShowFacilityForm(true); setConfirmFacilityCreate(false); }} className="inline-flex items-center gap-2 rounded-xl bg-medicore-600 px-3 py-2 text-xs font-bold text-white"><Plus className="h-4 w-4" />{ar ? 'إنشاء منشأة' : 'Create facility'}</button>
          </div>
          {loading ? <p className="p-8 text-sm text-slate-500">{ar ? 'جار تحميل البيانات...' : 'Loading...'}</p> : organizations.length === 0 ? <p className="p-8 text-sm text-slate-500">{ar ? 'لا توجد منشآت مسجلة.' : 'No facilities are registered.'}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50">
                  <tr>{[ar ? 'المنشأة' : 'Facility', ar ? 'المدينة' : 'City', ar ? 'الحالة' : 'Status', ar ? 'الفروع' : 'Branches', ar ? 'تاريخ التسجيل' : 'Created', ar ? 'إجراء' : 'Action'].map(header => <th key={header} className="p-3 text-start">{header}</th>)}</tr>
                </thead>
                <tbody>
                  {organizations.map(org => (
                    <tr key={org.id} className="border-t">
                      <td className="p-3 font-bold">{ar ? org.name_ar : org.name_en}<div className="font-normal text-slate-500">{org.email}</div></td>
                      <td className="p-3">{org.city}</td>
                      <td className="p-3">{statusLabel(org.status)}</td>
                      <td className="p-3">{org.branches?.length || 0}</td>
                      <td className="p-3">{new Date(org.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => { setEditingFacility({ ...org }); setConfirmFacilityUpdate(false); }} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 font-bold"><Pencil className="h-3.5 w-3.5" />{ar ? 'تعديل' : 'Edit'}</button>
                          {org.status === 'active' && (
                            <button onClick={() => setSupportCandidate(org)} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 font-bold text-amber-900">
                              <LogIn className="h-3.5 w-3.5" />{ar ? 'دخول المنشأة' : 'Enter facility'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Create Direct User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={createUserAccount} className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">{ar ? 'إنشاء حساب مستخدم مباشرة في Supabase' : 'Create User Account Directly'}</h2>
                <p className="mt-1 text-xs text-slate-500">{ar ? 'الحساب يُفعّل فوراً بكلمة المرور دون انتظار رسائل بريدية.' : 'Account is confirmed immediately with password; no email limits.'}</p>
              </div>
              <button type="button" onClick={() => setShowCreateUser(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">{ar ? 'البريد الإلكتروني أو اسم المستخدم *' : 'Email or Username *'}<input required value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="dr_ahmed or dr@clinic.com" className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <label className="text-xs font-bold">{ar ? 'الهاتف' : 'Phone'}<input value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <label className="text-xs font-bold">{ar ? 'الاسم بالعربية *' : 'Arabic name *'}<input required value={newUser.name_ar} onChange={e => setNewUser({ ...newUser, name_ar: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <label className="text-xs font-bold">{ar ? 'الاسم بالإنجليزية' : 'English name'}<input value={newUser.name_en} onChange={e => setNewUser({ ...newUser, name_en: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{ar ? 'كلمة المرور * (12 خانة على الأقل)' : 'Password * (12+ chars)'}</span>
                  <button type="button" onClick={() => { setNewUser({ ...newUser, password: generateStrongPassword() }); setShowNewUserPass(true); }} className="inline-flex items-center gap-1 text-[11px] font-bold text-medicore-600 hover:underline">
                    <KeyRound className="h-3 w-3" />{ar ? 'توليد كلمة مرور قوية' : 'Generate'}
                  </button>
                </div>
                <div className="relative mt-1">
                  <input required type={showNewUserPass ? 'text' : 'password'} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="w-full rounded-xl border p-2.5 pe-10 text-sm font-mono" />
                  <button type="button" onClick={() => setShowNewUserPass(!showNewUserPass)} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400">{showNewUserPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                </div>
              </div>
              <label className="text-xs font-bold">{ar ? 'الدور الوظيفي *' : 'Role *'}<select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as AppRole })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">{platformRoles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
              {newUser.role !== 'super_admin' && (
                <label className="text-xs font-bold">{ar ? 'المنشأة *' : 'Facility *'}<select required value={newUser.organization_id} onChange={e => setNewUser({ ...newUser, organization_id: e.target.value })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm"><option value="">{ar ? '-- اختر المنشأة --' : '-- Select --'}</option>{organizations.map(o => <option key={o.id} value={o.id}>{ar ? o.name_ar : o.name_en}</option>)}</select></label>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <button type="button" onClick={() => setShowCreateUser(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button disabled={saving} className="rounded-xl bg-medicore-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? '...' : (ar ? 'إنشاء وتفعيل فوراً' : 'Create Account')}</button>
            </div>
          </form>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={event => confirmUserSave ? void saveUser(event) : (event.preventDefault(), setConfirmUserSave(true))} className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">{confirmUserSave ? (ar ? 'تأكيد تغيير الحساب' : 'Confirm account change') : (ar ? 'تعديل حساب المستخدم' : 'Edit user account')}</h2><button type="button" onClick={() => { setEditingUser(null); setConfirmUserSave(false); }} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
            {confirmUserSave ? (
              <div className="space-y-3 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <p>{ar ? `الحساب: ${editingUser.email}` : `Account: ${editingUser.email}`}</p>
                <p>{ar ? `الصلاحية الجديدة: ${roleLabel(editingUser.role)}` : `New role: ${roleLabel(editingUser.role)}`}</p>
                <p>{ar ? `الحالة: ${editingUser.is_active ? 'نشط' : 'موقوف'}` : `Status: ${editingUser.is_active ? 'Active' : 'Disabled'}`}</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500">{editingUser.email}</p>
                <label className="block text-xs font-bold">{ar ? 'الاسم بالعربية' : 'Arabic name'}<input required maxLength={255} value={editingUser.name_ar} onChange={event => setEditingUser({ ...editingUser, name_ar: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="block text-xs font-bold">{ar ? 'الاسم بالإنجليزية' : 'English name'}<input required maxLength={255} value={editingUser.name_en} onChange={event => setEditingUser({ ...editingUser, name_en: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="block text-xs font-bold">{ar ? 'الدور' : 'Role'}<select disabled={editingUser.id === currentUser?.id} value={editingUser.role} onChange={event => setEditingUser({ ...editingUser, role: event.target.value as AppRole })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm disabled:bg-slate-100">{roleOptions.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
                <label className="block text-xs font-bold">{ar ? 'تعيين كلمة مرور جديدة (اختياري - 12 خانة)' : 'Reset password (optional)'}<input type="text" value={editingUser.password || ''} onChange={event => setEditingUser({ ...editingUser, password: event.target.value })} placeholder={ar ? 'اتركه فارغاً للإبقاء على الحالية' : 'Leave empty to keep current'} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={editingUser.id === currentUser?.id} checked={editingUser.is_active} onChange={event => setEditingUser({ ...editingUser, is_active: event.target.checked })} />{ar ? 'الحساب نشط' : 'Account active'}</label>
              </>
            )}
            <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => confirmUserSave ? setConfirmUserSave(false) : setEditingUser(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'رجوع' : 'Back'}</button><button disabled={saving} className="rounded-xl bg-medicore-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? '...' : confirmUserSave ? (ar ? 'تأكيد وتطبيق' : 'Confirm and apply') : (ar ? 'مراجعة التغيير' : 'Review change')}</button></div>
          </form>
        </div>
      )}

      {showFacilityForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={event => confirmFacilityCreate ? void createFacility(event) : (event.preventDefault(), setConfirmFacilityCreate(true))} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black">{confirmFacilityCreate ? (ar ? 'مراجعة إنشاء المنشأة' : 'Review facility creation') : (ar ? 'إنشاء منشأة وعيادة رئيسية' : 'Create facility and main branch')}</h2>
                <p className="mt-1 text-xs text-slate-500">{ar ? 'حدد كلمة مرور للمالك للتفعيل الفوري في Supabase بدون حدود البريد الإلكتروني.' : 'Set an owner password for instant Supabase activation without email rate limits.'}</p>
              </div>
              <button type="button" onClick={() => { setShowFacilityForm(false); setConfirmFacilityCreate(false); }} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            {confirmFacilityCreate ? (
              <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <p>{ar ? `المنشأة: ${facility.name_ar} (${facility.name_en})` : `Facility: ${facility.name_en} (${facility.name_ar})`}</p>
                <p>{ar ? `حساب المالك: ${facility.owner_email}` : `Owner login: ${facility.owner_email}`}</p>
                <p>{facility.owner_password ? (ar ? 'التفعيل: فوري بكلمة مرور مباشرة (بدون انتظار البريد)' : 'Activation: Instant direct password') : (ar ? 'التفعيل: إرسال دعوة بريدية' : 'Activation: Email invite')}</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold">{ar ? 'اسم المنشأة بالعربية' : 'Facility name (Arabic)'}<input required maxLength={255} value={facility.name_ar} onChange={event => setFacility({ ...facility, name_ar: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <label className="text-xs font-bold">{ar ? 'اسم المنشأة بالإنجليزية' : 'Facility name (English)'}<input required maxLength={255} value={facility.name_en} onChange={event => setFacility({ ...facility, name_en: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <label className="text-xs font-bold">{ar ? 'نوع المنشأة' : 'Facility type'}<select value={facility.facility_type} onChange={event => setFacility({ ...facility, facility_type: event.target.value })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">{facilityTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
                  <label className="text-xs font-bold">{ar ? 'البريد الرسمي للمنشأة' : 'Facility email'}<input required type="email" value={facility.email} onChange={event => setFacility({ ...facility, email: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <label className="text-xs font-bold">{ar ? 'الهاتف' : 'Phone'}<input required type="tel" maxLength={50} value={facility.phone} onChange={event => setFacility({ ...facility, phone: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <label className="text-xs font-bold">{ar ? 'المدينة' : 'City'}<input required maxLength={100} value={facility.city} onChange={event => setFacility({ ...facility, city: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <label className="text-xs font-bold sm:col-span-2">{ar ? 'العنوان' : 'Address'}<input required maxLength={500} value={facility.address} onChange={event => setFacility({ ...facility, address: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                </div>
                <div className="border-t pt-3">
                  <h3 className="mb-2 text-sm font-black">{ar ? 'بيانات دخول مالك المنشأة' : 'Facility owner login'}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-bold">{ar ? 'اسم المالك بالعربية' : 'Owner name (Arabic)'}<input required maxLength={255} value={facility.owner_name_ar} onChange={event => setFacility({ ...facility, owner_name_ar: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                    <label className="text-xs font-bold">{ar ? 'اسم المالك بالإنجليزية' : 'Owner name (English)'}<input maxLength={255} value={facility.owner_name_en} onChange={event => setFacility({ ...facility, owner_name_en: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                    <label className="text-xs font-bold">{ar ? 'بريد أو اسم مستخدم المالك *' : 'Owner email or username *'}<input required type="text" placeholder="owner_clinic1 or owner@clinic.com" value={facility.owner_email} onChange={event => setFacility({ ...facility, owner_email: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{ar ? 'كلمة المرور المباشرة (12+ خانة)' : 'Direct Password (12+ chars)'}</span>
                        <button type="button" onClick={() => { setFacility({ ...facility, owner_password: generateStrongPassword() }); setShowOwnerPass(true); }} className="inline-flex items-center gap-1 text-[11px] font-bold text-medicore-600 hover:underline"><KeyRound className="h-3 w-3" />{ar ? 'توليد' : 'Gen'}</button>
                      </div>
                      <div className="relative mt-1">
                        <input type={showOwnerPass ? 'text' : 'password'} value={facility.owner_password} onChange={event => setFacility({ ...facility, owner_password: event.target.value })} placeholder={ar ? 'تفعيل فوري بدون دعوة بريدية' : 'Instant activation password'} className="w-full rounded-xl border p-2.5 pe-10 text-sm font-mono" />
                        <button type="button" onClick={() => setShowOwnerPass(!showOwnerPass)} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400">{showOwnerPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => confirmFacilityCreate ? setConfirmFacilityCreate(false) : setShowFacilityForm(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'رجوع' : 'Back'}</button><button disabled={saving} className="rounded-xl bg-medicore-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? '...' : confirmFacilityCreate ? (ar ? 'إنشاء المنشأة وتفعيلها' : 'Create facility') : (ar ? 'مراجعة قبل الإنشاء' : 'Review before creating')}</button></div>
          </form>
        </div>
      )}

      {editingFacility && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={event => confirmFacilityUpdate ? void saveFacility(event) : (event.preventDefault(), setConfirmFacilityUpdate(true))} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-black">{confirmFacilityUpdate ? (ar ? 'مراجعة تعديل المنشأة' : 'Review facility update') : (ar ? 'تعديل بيانات المنشأة' : 'Edit facility details')}</h2></div><button type="button" onClick={() => { setEditingFacility(null); setConfirmFacilityUpdate(false); }} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>
            {confirmFacilityUpdate ? (
              <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><p>{editingFacility.name_ar} — {editingFacility.email}</p></div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">{ar ? 'اسم المنشأة بالعربية' : 'Facility name (Arabic)'}<input required maxLength={255} value={editingFacility.name_ar} onChange={event => setEditingFacility({ ...editingFacility, name_ar: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold">{ar ? 'اسم المنشأة بالإنجليزية' : 'Facility name (English)'}<input required maxLength={255} value={editingFacility.name_en} onChange={event => setEditingFacility({ ...editingFacility, name_en: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold">{ar ? 'نوع المنشأة' : 'Facility type'}<select value={editingFacility.facility_type} onChange={event => setEditingFacility({ ...editingFacility, facility_type: event.target.value as Organization['facility_type'] })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">{facilityTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
                <label className="text-xs font-bold">{ar ? 'البريد الرسمي للمنشأة' : 'Facility email'}<input required type="email" value={editingFacility.email} onChange={event => setEditingFacility({ ...editingFacility, email: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold">{ar ? 'الهاتف' : 'Phone'}<input required maxLength={50} value={editingFacility.phone} onChange={event => setEditingFacility({ ...editingFacility, phone: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold">{ar ? 'المدينة' : 'City'}<input required maxLength={100} value={editingFacility.city} onChange={event => setEditingFacility({ ...editingFacility, city: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold sm:col-span-2">{ar ? 'العنوان' : 'Address'}<input required maxLength={500} value={editingFacility.address || ''} onChange={event => setEditingFacility({ ...editingFacility, address: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => confirmFacilityUpdate ? setConfirmFacilityUpdate(false) : setEditingFacility(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'رجوع' : 'Back'}</button><button disabled={saving} className="rounded-xl bg-medicore-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? '...' : confirmFacilityUpdate ? (ar ? 'تأكيد وحفظ' : 'Confirm and save') : (ar ? 'مراجعة التعديل' : 'Review changes')}</button></div>
          </form>
        </div>
      )}

      {supportCandidate && (
        <div className="fixed inset-0 z-[55] grid place-items-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black">{ar ? 'تأكيد دخول دعم المنشأة' : 'Confirm facility support access'}</h2>
            <p className="text-sm leading-6 text-slate-700">{ar ? `ستفتح مساحة «${supportCandidate.name_ar}» بحساب السوبر أدمن لمدة 15 دقيقة، وكل ما تنفذه سيُسجل باسمك في سجل التدقيق.` : `Open “${supportCandidate.name_en}” for 15 minutes as platform super admin; all actions are audited.`}</p>
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setSupportCandidate(null)} disabled={startingSupport} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'إلغاء' : 'Cancel'}</button><button type="button" onClick={() => void startFacilitySupport()} disabled={startingSupport} className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-bold text-white">{startingSupport ? '...' : (ar ? 'تأكيد وفتح المنشأة' : 'Confirm and enter')}</button></div>
          </section>
        </div>
      )}

      {manualInvitation && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-xl space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black text-emerald-700">{manualInvitation.password ? (ar ? 'تم تفعيل الحساب بنجاح' : 'Account Ready for Immediate Sign-In') : (ar ? 'رابط تفعيل الحساب' : 'Account activation link')}</h2>
            <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-xs font-mono">
              <div><strong>Login:</strong> {manualInvitation.email}</div>
              {manualInvitation.password && <div><strong>Password:</strong> {manualInvitation.password}</div>}
              {manualInvitation.link && <input readOnly value={manualInvitation.link} onFocus={e => e.currentTarget.select()} className="w-full rounded border bg-white p-2 text-xs" />}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => {
                const txt = manualInvitation.password
                  ? `Login: ${manualInvitation.email}\nPassword: ${manualInvitation.password}`
                  : (manualInvitation.link || '');
                void navigator.clipboard.writeText(txt).then(() => success(ar ? 'تم النسخ.' : 'Copied.'));
              }} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'نسخ البيانات' : 'Copy'}</button>
              <button type="button" onClick={() => setManualInvitation(null)} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">{ar ? 'إغلاق' : 'Close'}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
