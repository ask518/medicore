import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { AppRole, CustomPermissionKey, CustomPermissionsMap, User } from '../../types/database';
import { MASTER_MEDICAL_SPECIALTIES } from '../../config/medicalSpecialties';
import { CUSTOM_PERMISSION_DEFINITIONS, hasCustomCapability } from '../../config/rbacPermissions';
import { generateStrongPassword } from '../../lib/passwords';
import { extractFunctionErrorMessage } from '../../lib/errors';
import { formatQuotaErrorMessage } from '../../lib/facilityLabels';
import { PlanQuotaNotice } from '../../components/common/PlanQuotaNotice';
import {
  UserCog,
  Plus,
  Mail,
  Phone,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  Stethoscope,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';

const ROLES: AppRole[] = [
  'general_manager',
  'branch_manager',
  'medical_director',
  'doctor',
  'assistant_doctor',
  'nurse',
  'receptionist',
  'accountant',
  'lab_technician',
  'radiology_technician',
  'pharmacist',
  'insurance_officer',
  'inventory_manager',
  'records_officer',
];

export const Staff: React.FC = () => {
  const { user, organization, activeBranch, availableBranches, can, hasCustomPermission, refreshIdentity } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();
  const [staff, setStaff] = useState<User[]>([]);
  const [doctorUserIds, setDoctorUserIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add Staff Modal
  const [open, setOpen] = useState(false);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AppRole>('doctor');
  const [branchId, setBranchId] = useState(activeBranch?.id || '');
  const [specialtyCode, setSpecialtyCode] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [followUpFee, setFollowUpFee] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password?: string; link?: string } | null>(null);

  // Self-activate as treating doctor modal (for org_owner / managers practicing directly)
  const [selfDocOpen, setSelfDocOpen] = useState(false);
  const [selfSpecCode, setSelfSpecCode] = useState('');
  const [selfConsultFee, setSelfConsultFee] = useState('250');
  const [selfFollowFee, setSelfFollowFee] = useState('150');
  const [selfCommRate, setSelfCommRate] = useState('0');
  const [savingSelfDoc, setSavingSelfDoc] = useState(false);

  // Permissions & Role Manager Modal
  const [editingMember, setEditingMember] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<AppRole>('doctor');
  const [editActive, setEditActive] = useState(true);
  const [editPerms, setEditPerms] = useState<CustomPermissionsMap>({});
  const [savingAccess, setSavingAccess] = useState(false);

  const ar = locale === 'ar';
  const orgId = organization?.id || '';
  const canManageTeam = can('staff', 'view') || hasCustomPermission('staff_manage');
  const isOwnerOrGm = ['super_admin', 'org_owner', 'general_manager'].includes(user?.role || '');

  const defaultOrgSpecialtyCode = useMemo(() => {
    const orgSpecs = Array.isArray(organization?.specialties) ? organization.specialties : [];
    const matched = orgSpecs.find(code => MASTER_MEDICAL_SPECIALTIES.some(s => s.is_active && s.code === code));
    return matched || MASTER_MEDICAL_SPECIALTIES.find(s => s.is_active)?.code || 'general_practice';
  }, [organization?.specialties]);

  useEffect(() => {
    if (!specialtyCode) setSpecialtyCode(defaultOrgSpecialtyCode);
    if (!selfSpecCode) setSelfSpecCode(defaultOrgSpecialtyCode);
  }, [defaultOrgSpecialtyCode, specialtyCode, selfSpecCode]);

  const loadStaff = useCallback(async () => {
    if (!supabase || !orgId || !canManageTeam) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [usersRes, docsRes] = await Promise.all([
      supabase.from('users').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }),
      supabase.from('doctors').select('user_id').eq('organization_id', orgId).eq('is_active', true),
    ]);
    if (usersRes.error) error(ar ? 'تعذر تحميل فريق العمل.' : 'Could not load staff.');
    else setStaff((usersRes.data || []) as User[]);
    setDoctorUserIds(new Set(((docsRes.data || []) as Array<{ user_id: string }>).map(d => d.user_id)));
    setLoading(false);
  }, [orgId, canManageTeam, ar, error]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization || !supabase) return;
    if (!branchId) { error(ar ? 'اختر الفرع.' : 'Select a branch.'); return; }
    if (password && (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) {
      error(ar ? 'كلمة المرور يجب أن تكون 12 خانة على الأقل مع حرف ورقم.' : 'Password must be at least 12 characters with a letter and a number.');
      return;
    }
    const chosenCode = specialtyCode || defaultOrgSpecialtyCode;
    const specialty = MASTER_MEDICAL_SPECIALTIES.find(item => item.code === chosenCode) || MASTER_MEDICAL_SPECIALTIES.find(item => item.is_active);
    setSaving(true);
    const { data, error: inviteError } = await supabase.functions.invoke('invite-staff', {
      body: {
        organization_id: orgId,
        email,
        password: password || undefined,
        name_ar: nameAr,
        name_en: nameEn || nameAr,
        phone,
        role,
        branch_id: branchId,
        specialty_code: specialty?.code,
        specialty_title_ar: specialty?.name_ar,
        specialty_title_en: specialty?.name_en,
        consultation_fee: Number(consultationFee || 0),
        follow_up_fee: Number(followUpFee || 0),
        commission_rate: Number(commissionRate || 0),
      },
    });
    setSaving(false);
    if (inviteError || data?.error) {
      const raw = data?.error || await extractFunctionErrorMessage(inviteError, ar ? 'تعذر إنشاء الحساب.' : 'Staff provisioning failed.');
      error(formatQuotaErrorMessage(raw, ar) || raw);
      return;
    }

    if (data?.delivery_mode === 'direct_password') {
      setCreatedCredentials({ email: data.email || email, password });
      success(ar ? 'تم إنشاء حساب الموظف وتفعيله فوراً بدون انتظار البريد.' : 'Staff account created and confirmed immediately.');
    } else if (data?.invitation_link) {
      setCreatedCredentials({ email: data.email || email, link: data.invitation_link });
      success(ar ? 'تم تجهيز رابط تفعيل الموظف.' : 'Staff activation link generated.');
    } else {
      success(ar ? 'تم إرسال دعوة الموظف وإنشاء صلاحياته.' : 'Staff invitation sent and access provisioned.');
    }

    setOpen(false);
    setNameAr(''); setNameEn(''); setEmail(''); setPassword(''); setPhone(''); setRole('doctor');
    setSpecialtyCode(defaultOrgSpecialtyCode);
    setConsultationFee(''); setFollowUpFee(''); setCommissionRate('');
    await loadStaff();
  };

  const activateSelfAsDoctor = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !organization) return;
    const chosenCode = selfSpecCode || defaultOrgSpecialtyCode;
    const spec = MASTER_MEDICAL_SPECIALTIES.find(s => s.code === chosenCode) || MASTER_MEDICAL_SPECIALTIES.find(s => s.is_active);
    setSavingSelfDoc(true);
    const { error: rpcErr } = await supabase.rpc('register_self_as_doctor', {
      p_specialty_code: spec?.code || 'general_practice',
      p_specialty_title_ar: spec?.name_ar || 'طب عام',
      p_specialty_title_en: spec?.name_en || 'General Practice',
      p_consultation_fee: Math.max(0, Number(selfConsultFee || 0)),
      p_follow_up_fee: Math.max(0, Number(selfFollowFee || 0)),
      p_commission_rate: Math.min(100, Math.max(0, Number(selfCommRate || 0))),
    });
    setSavingSelfDoc(false);
    if (rpcErr) {
      error(formatQuotaErrorMessage(rpcErr.message, ar) || (ar ? `تعذر تفعيل ملف الطبيب: ${rpcErr.message}` : `Failed: ${rpcErr.message}`));
      return;
    }
    success(ar ? 'تم تفعيل حسابك كطبيب/أخصائي معالج بنجاح! يمكنك الآن حجز المواعيد واعتماد الكشوفات.' : 'Your clinician profile is now active for appointments and consultations!');
    setSelfDocOpen(false);
    await Promise.all([loadStaff(), refreshIdentity()]);
  };

  const openMemberPermissions = (member: User) => {
    setEditingMember(member);
    setEditRole(member.role);
    setEditActive(member.is_active);
    setEditPerms({ ...(member.custom_permissions || {}) });
  };

  const saveMemberPermissions = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !editingMember) return;
    setSavingAccess(true);
    const { error: rpcErr } = await supabase.rpc('update_organization_member_access', {
      p_target_user_id: editingMember.id,
      p_role: editRole,
      p_is_active: editActive,
      p_custom_permissions: editPerms,
    });
    setSavingAccess(false);
    if (rpcErr) {
      error(ar ? `تعذر حفظ الصلاحيات: ${rpcErr.message}` : `Could not update permissions: ${rpcErr.message}`);
      return;
    }
    success(ar ? 'تم تحديث دور وصلاحيات الموظف وحفظها في قاعدة البيانات.' : 'Staff role and permissions updated in database.');
    setEditingMember(null);
    await loadStaff();
  };

  const currentUserCanSelfActivate =
    Boolean(user?.id) &&
    ['org_owner', 'general_manager', 'medical_director', 'branch_manager'].includes(user?.role || '') &&
    !doctorUserIds.has(user!.id);

  if (!organization) return <div className="rounded-2xl border bg-white p-8 text-center">{ar ? 'لا توجد منشأة نشطة.' : 'No active facility.'}</div>;
  if (!canManageTeam) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center" dir={ar ? 'rtl' : 'ltr'}>
        <h1 className="text-lg font-black text-slate-900">{t.nav.staff}</h1>
        <p className="mt-2 text-sm text-rose-900">
          {ar ? 'ليست لديك صلاحية إدارة فريق العمل والصلاحيات.' : 'You do not have permission to manage team access.'}
        </p>
      </section>
    );
  }

  const effectivePreviewUser = editingMember ? { role: editRole, custom_permissions: editPerms } : null;

  return (
    <main className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black"><UserCog className="h-6 w-6 text-medicore-600" />{t.nav.staff}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {ar
              ? 'إنشاء حسابات الفريق والأطباء والتحكم الدقيق في الصلاحيات المالية والتحصيل لكل موظف.'
              : 'Provision staff & clinicians and control granular financial, collection, and clinical permissions.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {currentUserCanSelfActivate && (
            <button
              type="button"
              onClick={() => { setSelfSpecCode(defaultOrgSpecialtyCode); setSelfDocOpen(true); }}
              className="inline-flex items-center gap-2 rounded-xl border border-teal-300 bg-teal-50 px-4 py-2.5 text-xs font-black text-teal-900 hover:bg-teal-100"
            >
              <Stethoscope className="h-4 w-4" />
              {ar ? 'تفعيل ملفي كطبيب / أخصائي معالج' : 'Activate My Profile as Clinician'}
            </button>
          )}
          {isOwnerOrGm && (
            <button
              type="button"
              onClick={() => { setBranchId(activeBranch?.id || availableBranches[0]?.id || ''); setSpecialtyCode(defaultOrgSpecialtyCode); setOpen(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-medicore-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-medicore-700"
            >
              <Plus className="h-4 w-4" />{ar ? 'إضافة موظف / طبيب' : 'Add staff'}
            </button>
          )}
        </div>
      </header>

      {currentUserCanSelfActivate && (
        <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <p className="font-black text-teal-950">
              {ar ? 'هل تعالج المرضى بنفسك في هذه المنشأة؟' : 'Do you personally see & treat patients in this facility?'}
            </p>
            <p className="text-teal-800">
              {ar
                ? 'اضغط على «تفعيل ملفي كطبيب / أخصائي معالج» ليظهر اسمك وتخصصك (مثل العلاج الطبيعي) في جدول المواعيد وشاشة الكشف فوراً.'
                : 'Activate your clinician profile so your name & specialty appear immediately in Appointments & Consultation.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setSelfSpecCode(defaultOrgSpecialtyCode); setSelfDocOpen(true); }}
            className="rounded-xl bg-teal-600 px-4 py-2 font-black text-white hover:bg-teal-700"
          >
            {ar ? 'تفعيل الآن' : 'Activate Now'}
          </button>
        </div>
      )}

      <PlanQuotaNotice orgId={orgId} ar={ar} scope="doctors" />
      <PlanQuotaNotice orgId={orgId} ar={ar} scope="users" />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b p-4 text-sm font-bold text-slate-600">{staff.length} {ar ? 'موظف' : 'staff members'}</div>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">{ar ? 'جار التحميل...' : 'Loading...'}</div> : staff.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">{ar ? 'لم تتم إضافة موظفين بعد.' : 'No staff members yet.'}</div> : (
          <div className="divide-y">
            {staff.map(member => {
              const hasFinView = hasCustomCapability(member, 'billing_view');
              const hasCollect = hasCustomCapability(member, 'billing_collect');
              const hasBalances = hasCustomCapability(member, 'patient_balances_manage');
              const isClinicDoctor = doctorUserIds.has(member.id);
              const editable = isOwnerOrGm && member.id !== user?.id && member.role !== 'org_owner' && !(member.role === 'general_manager' && user?.role === 'general_manager');
              return (
                <article key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{ar ? member.name_ar : member.name_en}</span>
                      {isClinicDoctor && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                          <Stethoscope className="h-3 w-3" />
                          {ar ? 'طبيب / معالج مفعل' : 'Treating Clinician'}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{member.email}</span>
                      {member.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                      <span className={`rounded-full px-2 py-0.5 ${hasFinView ? 'bg-sky-50 text-sky-800 border border-sky-200' : 'bg-slate-100 text-slate-500'}`}>
                        {hasFinView ? (ar ? 'صلاحية مالية: مفعلة' : 'Financial View: ON') : (ar ? 'بدون عرض مالي' : 'No Financial View')}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 ${hasCollect ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                        {hasCollect ? (ar ? 'حق التحصيل: مفعل' : 'Collection: ON') : (ar ? 'بدون حق تحصيل' : 'No Collection')}
                      </span>
                      {hasBalances && (
                        <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-amber-800">
                          {ar ? 'أرصدة المرضى' : 'Balances'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{t.roles[member.role] || member.role}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${member.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {member.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'موقوف' : 'Inactive')}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        onClick={() => openMemberPermissions(member)}
                        className="inline-flex items-center gap-1 rounded-xl border border-medicore-200 bg-medicore-50 px-3 py-1.5 text-xs font-bold text-medicore-800 hover:bg-medicore-100"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span>{ar ? 'الصلاحيات والدور' : 'Permissions'}</span>
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Add Staff Modal */}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={invite} className="max-h-[90vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div>
              <h2 className="text-lg font-black">{ar ? 'إضافة وتفعيل حساب موظف / طبيب' : 'Add & Activate Staff Account'}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {ar ? 'أدخل كلمة مرور لتفعيل الحساب فوراً في Supabase بدون انتظار رسائل البريد الإلكتروني.' : 'Set a password to activate the account in Supabase immediately without waiting on email delivery.'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">{ar ? 'الاسم بالعربية *' : 'Arabic name *'}<input required maxLength={255} value={nameAr} onChange={e => setNameAr(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <label className="text-xs font-bold">{ar ? 'الاسم بالإنجليزية' : 'English name'}<input maxLength={255} value={nameEn} onChange={e => setNameEn(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <label className="text-xs font-bold">{ar ? 'البريد الإلكتروني أو اسم المستخدم *' : 'Email or Username *'}<input required type="text" placeholder="dr_ahmed or email@clinic.com" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <label className="text-xs font-bold">{ar ? 'الهاتف' : 'Phone'}<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{ar ? 'كلمة المرور المباشرة (12 خانة على الأقل — حرف ورقم)' : 'Direct Password (12+ chars, letter & number)'}</span>
                  <button type="button" onClick={() => { setPassword(generateStrongPassword()); setShowPassword(true); }} className="inline-flex items-center gap-1 text-[11px] font-bold text-medicore-600 hover:underline">
                    <KeyRound className="h-3 w-3" />{ar ? 'توليد كلمة مرور قوية' : 'Generate strong password'}
                  </button>
                </div>
                <div className="relative mt-1">
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={ar ? 'اتركه فارغاً فقط إذا أردت إرسال رابط دعوة' : 'Leave blank only to send invite email'} className="w-full rounded-xl border p-2.5 pe-10 text-sm font-mono" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <label className="text-xs font-bold">{ar ? 'الدور الوظيفي' : 'Role'}<select value={role} onChange={e => setRole(e.target.value as AppRole)} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">{ROLES.map(item => <option key={item} value={item}>{t.roles[item] || item}</option>)}</select></label>
              <label className="text-xs font-bold">{ar ? 'الفرع' : 'Branch'}<select required value={branchId} onChange={e => setBranchId(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">{availableBranches.map(branch => <option key={branch.id} value={branch.id}>{ar ? branch.name_ar : branch.name_en}</option>)}</select></label>
            </div>
            {['doctor', 'assistant_doctor'].includes(role) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">{ar ? 'التخصص' : 'Specialty'}<select value={specialtyCode} onChange={e => setSpecialtyCode(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">{MASTER_MEDICAL_SPECIALTIES.filter(x => x.is_active).map(item => <option key={item.code} value={item.code}>{ar ? item.name_ar : item.name_en}</option>)}</select></label>
                <label className="text-xs font-bold">{ar ? 'سعر الكشف' : 'Consultation fee'}<input type="number" min="0" step="0.01" value={consultationFee} onChange={e => setConsultationFee(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold">{ar ? 'سعر المتابعة' : 'Follow-up fee'}<input type="number" min="0" step="0.01" value={followUpFee} onChange={e => setFollowUpFee(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold">{ar ? 'نسبة العمولة %' : 'Commission %'}<input type="number" min="0" max="100" step="0.01" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button disabled={saving || !availableBranches.length} className="rounded-xl bg-medicore-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? (ar ? 'جار الحفظ...' : 'Saving...') : (password ? (ar ? 'إنشاء وتفعيل الحساب فوراً' : 'Create & Activate Now') : (ar ? 'إرسال الدعوة' : 'Send invitation'))}</button>
            </div>
          </form>
        </div>
      )}

      {/* Self-Activate as Clinician Modal */}
      {selfDocOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={activateSelfAsDoctor} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-teal-600" />
              <h2 className="text-lg font-black">{ar ? 'تفعيل حسابك كطبيب / أخصائي معالج' : 'Activate Clinician Profile'}</h2>
            </div>
            <p className="text-xs text-slate-500 leading-5">
              {ar
                ? 'سيُضاف ملفك الطبي مع الحفاظ على كامل صلاحياتك كمالك/مدير للمنشأة، مما يتيح الحجز باسمك وإصدار الفواتير التلقائية للمواعيد واعتماد الكشوفات.'
                : 'Creates your clinician record while keeping your full owner/manager privileges so appointments, auto-invoicing, and consultations work under your name.'}
            </p>
            <div className="space-y-3 text-xs">
              <label className="block font-bold">
                {ar ? 'التخصص الطبي' : 'Medical Specialty'}
                <select value={selfSpecCode} onChange={e => setSelfSpecCode(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                  {MASTER_MEDICAL_SPECIALTIES.filter(s => s.is_active).map(s => (
                    <option key={s.code} value={s.code}>{ar ? s.name_ar : s.name_en}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <label className="font-bold">{ar ? 'سعر الكشف / الجلسة' : 'Consult Fee'}<input type="number" min="0" step="0.01" value={selfConsultFee} onChange={e => setSelfConsultFee(e.target.value)} className="mt-1 w-full rounded-xl border p-2 text-sm font-mono" /></label>
                <label className="font-bold">{ar ? 'سعر المتابعة' : 'Follow-up'}<input type="number" min="0" step="0.01" value={selfFollowFee} onChange={e => setSelfFollowFee(e.target.value)} className="mt-1 w-full rounded-xl border p-2 text-sm font-mono" /></label>
                <label className="font-bold">{ar ? 'العمولة %' : 'Comm %'}<input type="number" min="0" max="100" step="0.01" value={selfCommRate} onChange={e => setSelfCommRate(e.target.value)} className="mt-1 w-full rounded-xl border p-2 text-sm font-mono" /></label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <button type="button" onClick={() => setSelfDocOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" disabled={savingSelfDoc} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50">
                {savingSelfDoc ? (ar ? 'جار التفعيل...' : 'Activating...') : (ar ? 'تفعيل وحفظ' : 'Activate & Save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Owner Staff Permissions & Role Control Modal */}
      {editingMember && effectivePreviewUser && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form onSubmit={saveMemberPermissions} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-900">
                  <ShieldCheck className="h-5 w-5 text-medicore-600" />
                  <span>{ar ? `إدارة صلاحيات: ${editingMember.name_ar}` : `Permissions: ${editingMember.name_en}`}</span>
                </h2>
                <p className="text-xs text-slate-500">{editingMember.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditPerms({})}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{ar ? 'استعادة افتراضي الدور' : 'Reset to Role Defaults'}</span>
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                {ar ? 'الدور الوظيفي' : 'Role'}
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as AppRole)}
                  className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm"
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{t.roles[r] || r}</option>
                  ))}
                </select>
              </label>
              <div className="flex items-end">
                <label className="flex w-full items-center justify-between rounded-xl border p-2.5 text-xs font-bold cursor-pointer">
                  <span>{ar ? 'حالة الحساب (نشط / موقوف)' : 'Account Active'}</span>
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={e => setEditActive(e.target.checked)}
                    className="h-4 w-4 accent-medicore-600"
                  />
                </label>
              </div>
            </div>

            {(['financial', 'clinical', 'admin'] as const).map(cat => {
              const items = CUSTOM_PERMISSION_DEFINITIONS.filter(d => d.category === cat);
              const catTitle = cat === 'financial'
                ? (ar ? 'الصلاحيات المالية والتحصيل' : 'Financial & Collection Controls')
                : cat === 'clinical'
                  ? (ar ? 'الصلاحيات السريرية والمرضى' : 'Clinical & Patient Controls')
                  : (ar ? 'صلاحيات الإدارة والمخزون' : 'Admin & Inventory Controls');
              return (
                <div key={cat} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5">
                  <h3 className="text-xs font-black text-slate-900">{catTitle}</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map(def => {
                      const defaultAllowed = def.defaultRoles.includes(editRole);
                      const overrideVal = editPerms[def.key];
                      const effectiveAllowed = hasCustomCapability(effectivePreviewUser, def.key);
                      const isOverridden = typeof overrideVal === 'boolean';
                      return (
                        <label
                          key={def.key}
                          className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-xs cursor-pointer transition ${
                            effectiveAllowed ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-slate-100/70'
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900">{ar ? def.label_ar : def.label_en}</p>
                            <p className="mt-0.5 text-[10px] text-slate-500 leading-4">{ar ? def.description_ar : def.description_en}</p>
                            <span className={`mt-1 inline-block text-[10px] font-bold ${isOverridden ? 'text-medicore-700' : 'text-slate-400'}`}>
                              {isOverridden
                                ? (ar ? 'تعديل يدوي من المالك' : 'Owner Override')
                                : (defaultAllowed ? (ar ? 'افتراضي الدور: مسموح' : 'Default: Allowed') : (ar ? 'افتراضي الدور: مقيد' : 'Default: Restricted'))}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={effectiveAllowed}
                            onChange={e => {
                              const nextChecked = e.target.checked;
                              setEditPerms(prev => {
                                const copy: CustomPermissionsMap = { ...prev };
                                if (nextChecked === defaultAllowed) {
                                  delete copy[def.key as CustomPermissionKey];
                                } else {
                                  copy[def.key as CustomPermissionKey] = nextChecked;
                                }
                                return copy;
                              });
                            }}
                            className="mt-1 h-4 w-4 shrink-0 accent-medicore-600"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end gap-2 border-t pt-4">
              <button type="button" onClick={() => setEditingMember(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" disabled={savingAccess} className="rounded-xl bg-medicore-600 px-5 py-2 text-sm font-bold text-white hover:bg-medicore-700 disabled:opacity-50">
                {savingAccess ? (ar ? 'جار الحفظ...' : 'Saving...') : (ar ? 'حفظ الصلاحيات' : 'Save Permissions')}
              </button>
            </div>
          </form>
        </div>
      )}

      {createdCredentials && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-emerald-700">{ar ? 'بيانات دخول الحساب الجاهز' : 'Account Login Credentials Ready'}</h3>
            <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-xs font-mono">
              <div><strong>Login:</strong> {createdCredentials.email}</div>
              {createdCredentials.password && <div><strong>Password:</strong> {createdCredentials.password}</div>}
              {createdCredentials.link && <div className="break-all"><strong>Link:</strong> {createdCredentials.link}</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => {
                const txt = createdCredentials.password
                  ? `Login: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`
                  : (createdCredentials.link || '');
                void navigator.clipboard.writeText(txt).then(() => success(ar ? 'تم النسخ' : 'Copied'));
              }} className="rounded-xl border px-4 py-2 text-xs font-bold">{ar ? 'نسخ البيانات' : 'Copy'}</button>
              <button type="button" onClick={() => setCreatedCredentials(null)} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">{ar ? 'إغلاق' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
