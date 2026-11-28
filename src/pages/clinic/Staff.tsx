import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { AppRole, User } from '../../types/database';
import { MASTER_MEDICAL_SPECIALTIES } from '../../config/medicalSpecialties';
import { generateStrongPassword } from '../../lib/passwords';
import { extractFunctionErrorMessage } from '../../lib/errors';
import { formatQuotaErrorMessage } from '../../lib/facilityLabels';
import { PlanQuotaNotice } from '../../components/common/PlanQuotaNotice';
import { UserCog, Plus, Mail, Phone, KeyRound, Eye, EyeOff } from 'lucide-react';

const ROLES: AppRole[] = ['general_manager', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse', 'receptionist', 'accountant', 'lab_technician', 'radiology_technician', 'pharmacist', 'insurance_officer', 'inventory_manager', 'records_officer'];

export const Staff: React.FC = () => {
  const { organization, activeBranch, availableBranches } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const ar = locale === 'ar';
  const orgId = organization?.id || '';

  const loadStaff = useCallback(async () => {
    if (!supabase || !orgId) { setLoading(false); return; }
    setLoading(true);
    const { data, error: queryError } = await supabase.from('users').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
    if (queryError) error(ar ? 'تعذر تحميل فريق العمل.' : 'Could not load staff.');
    else setStaff((data || []) as User[]);
    setLoading(false);
  }, [orgId, ar, error]);
  useEffect(() => { void loadStaff(); }, [loadStaff]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization || !supabase) return;
    if (!branchId) { error(ar ? 'اختر الفرع.' : 'Select a branch.'); return; }
    if (password && (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password))) {
      error(ar ? 'كلمة المرور يجب أن تكون 12 خانة على الأقل مع حرف ورقم.' : 'Password must be at least 12 characters with a letter and a number.');
      return;
    }
    const specialty = MASTER_MEDICAL_SPECIALTIES.find(item => item.code === specialtyCode) || MASTER_MEDICAL_SPECIALTIES.find(item => item.is_active);
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
    setConsultationFee(''); setFollowUpFee(''); setCommissionRate('');
    await loadStaff();
  };

  if (!organization) return <div className="rounded-2xl border bg-white p-8 text-center">{ar ? 'لا توجد منشأة نشطة.' : 'No active facility.'}</div>;
  return (
    <main className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black"><UserCog className="h-6 w-6 text-medicore-600" />{t.nav.staff}</h1>
          <p className="mt-1 text-sm text-slate-500">{ar ? 'إنشاء حسابات الفريق والاطباء فوراً بكلمة مرور أو دعوة بريدية.' : 'Provision staff & clinician accounts immediately with password or email.'}</p>
        </div>
        <button onClick={() => { setBranchId(activeBranch?.id || availableBranches[0]?.id || ''); setOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-medicore-600 px-4 py-2.5 text-sm font-bold text-white">
          <Plus className="h-4 w-4" />{ar ? 'إضافة موظف / طبيب' : 'Add staff'}
        </button>
      </header>

      <PlanQuotaNotice orgId={orgId} ar={ar} scope="doctors" />
      <PlanQuotaNotice orgId={orgId} ar={ar} scope="users" />

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b p-4 text-sm font-bold text-slate-600">{staff.length} {ar ? 'موظف' : 'staff members'}</div>
        {loading ? <div className="p-8 text-center text-sm text-slate-500">{ar ? 'جار التحميل...' : 'Loading...'}</div> : staff.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">{ar ? 'لم تتم إضافة موظفين بعد.' : 'No staff members yet.'}</div> : (
          <div className="divide-y">
            {staff.map(member => (
              <article key={member.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-bold text-slate-900">{ar ? member.name_ar : member.name_en}</div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{member.email}</span>
                    {member.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{member.phone}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{t.roles[member.role] || member.role}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${member.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{member.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'موقوف' : 'Inactive')}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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
