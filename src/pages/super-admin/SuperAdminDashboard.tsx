import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  AppRole, BillingCycle, Organization, Subscription, SubscriptionPlan, SubscriptionStatus, SystemAnnouncement, User,
} from '../../types/database';
import { generateStrongPassword } from '../../lib/passwords';
import { extractFunctionErrorMessage as getAdminErrorMessage } from '../../lib/errors';
import {
  FACILITY_TYPES, getFacilityTypeLabel, getSubscriptionStatusLabel,
  getBillingCycleLabel, getAnnouncementSeverityLabel, getAuditActionLabel,
  getAuditEntityLabel, getPaymentModeLabel,
} from '../../lib/facilityLabels';
import { getSpecialtyByCode } from '../../config/medicalSpecialties';
import { SpecialtySelector } from '../../components/common/SpecialtySelector';
import {
  Building2, Users, ShieldCheck, RefreshCw, Plus, Pencil, UserRoundX, UserRoundCheck,
  X, LogIn, KeyRound, Eye, EyeOff, BarChart3, Megaphone, Trash2, PauseCircle, PlayCircle,
  Activity, CreditCard, FileClock, DollarSign, Briefcase, CheckCircle2, Download, Wallet,
} from 'lucide-react';

interface Props { activeTab: string; onSelectTab: (tab: string) => void }
type OrganizationRow = Organization & { branches?: { id: string }[]; subscriptions?: Subscription[] };
type AdminUser = Pick<User, 'id' | 'email' | 'name_ar' | 'name_en' | 'role' | 'is_active' | 'organization_id'>;
type EditableUser = AdminUser & { password?: string };

interface OrgMetricRow {
  organization_id: string;
  name_ar: string;
  name_en: string;
  status: Organization['status'];
  facility_type: Organization['facility_type'];
  created_at: string;
  branches_count: number;
  users_count: number;
  patients_count: number;
  appointments_count: number;
  invoices_count: number;
}

interface RecentAuditRow {
  id: string;
  organization_id: string | null;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}

interface PlatformMetricsPayload {
  totals: {
    organizations: number;
    active_organizations: number;
    suspended_organizations: number;
    pending_organizations: number;
    branches: number;
    users: number;
    patients: number;
    appointments: number;
    consultations: number;
    invoices: number;
    laboratory_orders: number;
    radiology_orders: number;
    active_announcements: number;
  };
  by_organization: OrgMetricRow[];
  recent_audits: RecentAuditRow[];
}

interface EditingSubscriptionState {
  organization_id: string;
  organization_name: string;
  plan_id: string;
  status: SubscriptionStatus;
  cycle: BillingCycle;
  current_period_end: string;
}

interface EditingPlanState {
  id?: string;
  slug: string;
  name_ar: string;
  name_en: string;
  tier: SubscriptionPlan['tier'];
  price_monthly: number;
  price_annual: number;
  currency: string;
  allow_branches: boolean;
  max_branches: number;
  max_doctors: number;
  max_users: number;
  max_patients: number;
  max_storage_mb: number;
  has_laboratory: boolean;
  has_radiology: boolean;
  has_inventory: boolean;
  has_insurance: boolean;
  has_specialty_canvas: boolean;
  has_accounting_ledger: boolean;
  has_patient_portal: boolean;
  has_dedicated_db: boolean;
  is_active: boolean;
}

interface PlatformTransaction {
  id: string;
  transaction_type: 'subscription_income' | 'operating_expense' | 'payroll_payout' | 'adjustment';
  status: 'pending' | 'paid' | 'cancelled';
  payment_method: string | null;
  paid_at: string | null;
  subscription_id: string | null;
  category: string;
  title: string;
  amount: number;
  currency: string;
  transaction_date: string;
  organization_id: string | null;
  staff_user_id: string | null;
  reference_no: string | null;
  notes: string | null;
  created_at: string;
}

interface PlatformPayrollSlip {
  id: string;
  user_id: string;
  period_month: string;
  base_salary: number;
  bonuses: number;
  deductions: number;
  net_salary: number;
  currency: string;
  status: 'draft' | 'approved' | 'paid';
  paid_at: string | null;
}

interface PlatformLeaveRequest {
  id: string;
  user_id: string;
  leave_type: 'annual' | 'sick' | 'unpaid' | 'emergency';
  start_date: string;
  end_date: string;
  days_count: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const createEmptyPlan = (): EditingPlanState => ({
  slug: '',
  name_ar: '',
  name_en: '',
  tier: 'starter',
  price_monthly: 599,
  price_annual: 5990,
  currency: 'EGP',
  allow_branches: false,
  max_branches: 1,
  max_doctors: 3,
  max_users: 10,
  max_patients: 500,
  max_storage_mb: 2048,
  has_laboratory: false,
  has_radiology: false,
  has_inventory: true,
  has_insurance: true,
  has_specialty_canvas: true,
  has_accounting_ledger: true,
  has_patient_portal: true,
  has_dedicated_db: false,
  is_active: true,
});

const platformScopedRoles: AppRole[] = ['super_admin', 'org_owner'];
const emptyFacility = {
  name_ar: '', name_en: '', email: '', phone: '', city: '', address: '', facility_type: 'private_clinic',
  specialties: ['general_practice'] as string[],
  plan_id: '', cycle: 'monthly' as 'monthly' | 'annual',
  owner_email: '', owner_password: '', owner_name_ar: '', owner_name_en: '',
};

const emptyNewUser = {
  email: '', password: '', name_ar: '', name_en: '', phone: '', role: 'super_admin' as AppRole,
  organization_id: '',
};

export const SuperAdminDashboard: React.FC<Props> = ({ activeTab, onSelectTab }) => {
  const { locale, t } = useLanguage();
  const { user: currentUser, enterFacilitySupport, isFacilitySupportMode } = useAuth();
  const { success, error } = useToast();

  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
  const [metrics, setMetrics] = useState<PlatformMetricsPayload | null>(null);
  const [platformTxs, setPlatformTxs] = useState<PlatformTransaction[]>([]);
  const [platformPayrolls, setPlatformPayrolls] = useState<PlatformPayrollSlip[]>([]);
  const [platformLeaves, setPlatformLeaves] = useState<PlatformLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userOrgFilter, setUserOrgFilter] = useState<string>('all');
  const [orgSearch, setOrgSearch] = useState('');
  const [orgStatusFilter, setOrgStatusFilter] = useState<string>('all');

  // Modals & action states
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null);
  const [confirmUserSave, setConfirmUserSave] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ ...emptyNewUser });
  const [showNewUserPass, setShowNewUserPass] = useState(false);

  const [showFacilityForm, setShowFacilityForm] = useState(false);
  const [showOwnerPass, setShowOwnerPass] = useState(false);
  const [confirmFacilityCreate, setConfirmFacilityCreate] = useState(false);
  const [facility, setFacility] = useState({ ...emptyFacility });

  const [editingFacility, setEditingFacility] = useState<OrganizationRow | null>(null);
  const [confirmFacilityUpdate, setConfirmFacilityUpdate] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<OrganizationRow | null>(null);
  const [deleteAcknowledge, setDeleteAcknowledge] = useState(false);

  const [editingSub, setEditingSub] = useState<EditingSubscriptionState | null>(null);
  const [editingPlan, setEditingPlan] = useState<EditingPlanState | null>(null);
  const [deletePlanCandidate, setDeletePlanCandidate] = useState<SubscriptionPlan | null>(null);
  const [manualInvitation, setManualInvitation] = useState<{ email: string; password?: string; link?: string } | null>(null);
  const [supportCandidate, setSupportCandidate] = useState<OrganizationRow | null>(null);
  const [startingSupport, setStartingSupport] = useState(false);

  const [showAnnModal, setShowAnnModal] = useState(false);
  const [annForm, setAnnForm] = useState({
    title_ar: '', title_en: '', body_ar: '', body_en: '', severity: 'info' as 'info' | 'warning' | 'maintenance',
  });

  // Platform Finance & Internal HR state
  const [txFilter, setTxFilter] = useState<'all' | PlatformTransaction['transaction_type']>('all');
  const [txStatusFilter, setTxStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [txMethodFilter, setTxMethodFilter] = useState<string>('all');
  const [showTxModal, setShowTxModal] = useState(false);
  const [collectingTx, setCollectingTx] = useState<PlatformTransaction | null>(null);
  const [collectMethod, setCollectMethod] = useState('instapay');
  const [collectRef, setCollectRef] = useState('');
  const [collectNotes, setCollectNotes] = useState('');
  const [txForm, setTxForm] = useState({
    transaction_type: 'subscription_income' as PlatformTransaction['transaction_type'],
    status: 'paid' as 'pending' | 'paid',
    payment_method: 'cash',
    category: 'Subscription Renewal',
    title: '',
    amount: 599,
    currency: 'EGP',
    transaction_date: new Date().toISOString().slice(0, 10),
    organization_id: '',
    reference_no: '',
    notes: '',
  });
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [payrollForm, setPayrollForm] = useState({
    user_id: '',
    period_month: new Date().toISOString().slice(0, 7),
    base_salary: 8000,
    bonuses: 0,
    deductions: 0,
    currency: 'EGP',
  });
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    user_id: '',
    leave_type: 'annual' as PlatformLeaveRequest['leave_type'],
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    days_count: 1,
    reason: '',
  });

  const ar = locale === 'ar';

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      error(ar ? 'اتصال قاعدة البيانات غير مهيأ.' : 'Database connection is not configured.');
      return;
    }
    setLoading(true);
    const [orgResult, userResult, planResult, annResult, metricsResult, txResult, payResult, leaveResult] = await Promise.all([
      supabase.from('organizations').select('*,branches(id),subscriptions(*)').order('created_at', { ascending: false }),
      supabase.from('users').select('id,email,name_ar,name_en,role,is_active,organization_id', { count: 'exact' }).order('created_at', { ascending: false }),
      supabase.from('subscription_plans').select('*').order('price_monthly'),
      supabase.from('system_announcements').select('*').order('created_at', { ascending: false }),
      supabase.rpc('platform_overview_metrics'),
      supabase.from('platform_transactions').select('*').order('transaction_date', { ascending: false }).limit(200),
      supabase.from('platform_staff_payroll').select('*').order('period_month', { ascending: false }).limit(200),
      supabase.from('platform_leave_requests').select('*').order('created_at', { ascending: false }).limit(200),
    ]);
    if (orgResult.error || userResult.error) {
      error(ar ? 'تعذر تحميل بيانات المنصة. تحقق من ترحيلات الصلاحيات.' : 'Could not load platform data. Check the security migrations.');
      setLoading(false);
      return;
    }
    setOrganizations((orgResult.data || []) as unknown as OrganizationRow[]);
    setUsers((userResult.data || []) as AdminUser[]);
    setUserCount(userResult.count || 0);
    setPlans((planResult.data || []) as SubscriptionPlan[]);
    setAnnouncements((annResult.data || []) as SystemAnnouncement[]);
    if (!metricsResult.error && metricsResult.data) {
      setMetrics(metricsResult.data as unknown as PlatformMetricsPayload);
    }
    if (!txResult.error) setPlatformTxs((txResult.data || []) as PlatformTransaction[]);
    if (!payResult.error) setPlatformPayrolls((payResult.data || []) as PlatformPayrollSlip[]);
    if (!leaveResult.error) setPlatformLeaves((leaveResult.data || []) as PlatformLeaveRequest[]);
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
      action: 'update_facility',
      organization_id: editingFacility.id,
      name_ar: editingFacility.name_ar,
      name_en: editingFacility.name_en,
      facility_type: editingFacility.facility_type,
      email: editingFacility.email,
      phone: editingFacility.phone,
      city: editingFacility.city,
      address: editingFacility.address,
      specialties: Array.isArray(editingFacility.specialties) && editingFacility.specialties.length > 0
        ? editingFacility.specialties
        : ['general_practice'],
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

  const changeFacilityStatus = async (org: OrganizationRow, nextStatus: Organization['status']) => {
    setSaving(true);
    const { data, error: invokeError } = await callPlatformAdmin({
      action: 'set_facility_status',
      organization_id: org.id,
      status: nextStatus,
    });
    setSaving(false);
    if (invokeError || data?.error) {
      error(data?.error || await getAdminErrorMessage(invokeError, ar ? 'تعذر تغيير حالة المنشأة.' : 'Could not update facility status.'));
      return;
    }
    success(ar ? 'تم تحديث حالة المنشأة وتسجيلها في التدقيق.' : 'Facility status updated and audited.');
    await load();
  };

  const confirmDeleteFacility = async () => {
    if (!deleteCandidate || !deleteAcknowledge) return;
    setSaving(true);
    const { data, error: invokeError } = await callPlatformAdmin({
      action: 'delete_facility',
      organization_id: deleteCandidate.id,
      confirm: true,
    });
    setSaving(false);
    if (invokeError || data?.error) {
      error(data?.error || await getAdminErrorMessage(invokeError, ar ? 'تعذر حذف المنشأة.' : 'Could not delete facility.'));
      return;
    }
    success(
      ar
        ? `تم حذف المنشأة نهائياً وحذف ${data?.deleted_users_count ?? 0} حسابات مرتبطة.`
        : `Facility permanently deleted along with ${data?.deleted_users_count ?? 0} linked accounts.`
    );
    setDeleteCandidate(null);
    setDeleteAcknowledge(false);
    await load();
  };

  const saveSubscription = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingSub) return;
    setSaving(true);
    const { data, error: invokeError } = await callPlatformAdmin({
      action: 'update_subscription',
      organization_id: editingSub.organization_id,
      plan_id: editingSub.plan_id,
      status: editingSub.status,
      cycle: editingSub.cycle,
      current_period_end: editingSub.current_period_end ? `${editingSub.current_period_end}T23:59:59Z` : null,
    });
    setSaving(false);
    if (invokeError || data?.error) {
      error(data?.error || await getAdminErrorMessage(invokeError, ar ? 'تعذر تحديث الاشتراك.' : 'Could not update subscription.'));
      return;
    }
    success(ar ? 'تم تحديث باقة وحالة اشتراك المنشأة.' : 'Facility subscription updated.');
    setEditingSub(null);
    await load();
  };

  const savePlan = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingPlan) return;
    setSaving(true);
    const { data, error: invokeError } = await callPlatformAdmin({
      action: 'save_plan',
      plan_id: editingPlan.id || null,
      slug: editingPlan.slug || editingPlan.name_en,
      name_ar: editingPlan.name_ar,
      name_en: editingPlan.name_en,
      tier: editingPlan.tier,
      price_monthly: Number(editingPlan.price_monthly),
      price_annual: Number(editingPlan.price_annual),
      currency: editingPlan.currency,
      max_branches: editingPlan.allow_branches ? Math.max(2, Number(editingPlan.max_branches) || 2) : 1,
      max_doctors: Math.max(0, Number(editingPlan.max_doctors) || 0),
      max_users: Math.max(0, Number(editingPlan.max_users) || 0),
      max_patients: Math.max(0, Number(editingPlan.max_patients) || 0),
      max_storage_mb: Math.max(100, Number(editingPlan.max_storage_mb) || 2048),
      has_laboratory: editingPlan.has_laboratory,
      has_radiology: editingPlan.has_radiology,
      has_inventory: editingPlan.has_inventory,
      has_insurance: editingPlan.has_insurance,
      has_specialty_canvas: editingPlan.has_specialty_canvas,
      has_accounting_ledger: editingPlan.has_accounting_ledger,
      has_patient_portal: editingPlan.has_patient_portal,
      has_dedicated_db: editingPlan.has_dedicated_db,
      is_active: editingPlan.is_active,
    });
    setSaving(false);
    if (invokeError || data?.error) {
      error(data?.error || await getAdminErrorMessage(invokeError, ar ? 'تعذر حفظ الباقة.' : 'Could not save plan.'));
      return;
    }
    success(editingPlan.id ? (ar ? 'تم تحديث بيانات الباقة في السحابة.' : 'Subscription plan updated.') : (ar ? 'تمت إضافة الباقة الجديدة بنجاح.' : 'Subscription plan created.'));
    setEditingPlan(null);
    await load();
  };

  const confirmDeletePlan = async () => {
    if (!deletePlanCandidate) return;
    setSaving(true);
    const { data, error: invokeError } = await callPlatformAdmin({
      action: 'delete_plan',
      plan_id: deletePlanCandidate.id,
    });
    setSaving(false);
    if (invokeError || data?.error) {
      error(data?.error || await getAdminErrorMessage(invokeError, ar ? 'تعذر حذف الباقة.' : 'Could not delete plan.'));
      return;
    }
    success(ar ? 'تم حذف الباقة بنجاح.' : 'Subscription plan deleted.');
    setDeletePlanCandidate(null);
    await load();
  };

  const createAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !annForm.title_ar.trim() || !annForm.body_ar.trim()) return;
    setSaving(true);
    const { error: annError } = await supabase.from('system_announcements').insert({
      title_ar: annForm.title_ar.trim(),
      title_en: annForm.title_en.trim() || annForm.title_ar.trim(),
      body_ar: annForm.body_ar.trim(),
      body_en: annForm.body_en.trim() || annForm.body_ar.trim(),
      severity: annForm.severity,
      is_active: true,
    });
    setSaving(false);
    if (annError) {
      error(ar ? 'تعذر حفظ الإعلان.' : 'Could not save announcement.');
      return;
    }
    success(ar ? 'تم نشر إعلان النظام.' : 'Announcement published.');
    setAnnForm({ title_ar: '', title_en: '', body_ar: '', body_en: '', severity: 'info' });
    setShowAnnModal(false);
    await load();
  };

  const toggleAnnouncement = async (item: SystemAnnouncement) => {
    if (!supabase) return;
    const { error: updErr } = await supabase
      .from('system_announcements')
      .update({ is_active: !item.is_active })
      .eq('id', item.id);
    if (updErr) {
      error(ar ? 'تعذر تحديث حالة الإعلان.' : 'Could not update announcement.');
      return;
    }
    await load();
  };

  const deleteAnnouncement = async (item: SystemAnnouncement) => {
    if (!supabase) return;
    const { error: delErr } = await supabase.from('system_announcements').delete().eq('id', item.id);
    if (delErr) {
      error(ar ? 'تعذر حذف الإعلان.' : 'Could not delete announcement.');
      return;
    }
    success(ar ? 'تم حذف الإعلان.' : 'Announcement deleted.');
    await load();
  };

  const recordPlatformTx = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setSaving(true);
    const { error: rpcErr } = await supabase.rpc('platform_record_transaction', {
      p_type: txForm.transaction_type,
      p_category: txForm.category.trim(),
      p_title: txForm.title.trim(),
      p_amount: Number(txForm.amount),
      p_currency: txForm.currency || 'EGP',
      p_transaction_date: txForm.transaction_date,
      p_organization_id: txForm.organization_id || null,
      p_reference_no: txForm.reference_no.trim() || null,
      p_notes: txForm.notes.trim() || null,
      p_status: txForm.transaction_type === 'subscription_income' ? txForm.status : 'paid',
      p_payment_method: txForm.status === 'paid' || txForm.transaction_type !== 'subscription_income' ? txForm.payment_method : null,
    });
    setSaving(false);
    if (rpcErr) {
      error(ar ? `تعذر حفظ الحركة المالية: ${rpcErr.message}` : `Could not record transaction: ${rpcErr.message}`);
      return;
    }
    success(ar ? 'تم تسجيل الحركة المالية بنجاح في السحابة.' : 'Platform transaction recorded.');
    setShowTxModal(false);
    setTxForm({
      transaction_type: 'subscription_income', status: 'paid', payment_method: 'cash',
      category: 'Subscription Renewal', title: '',
      amount: 599, currency: 'EGP', transaction_date: new Date().toISOString().slice(0, 10),
      organization_id: '', reference_no: '', notes: '',
    });
    await load();
  };

  const markPlatformTxPaid = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !collectingTx) return;
    setSaving(true);
    const { error: rpcErr } = await supabase.rpc('platform_mark_transaction_paid', {
      p_tx_id: collectingTx.id,
      p_payment_method: collectMethod,
      p_reference_no: collectRef.trim() || null,
      p_notes: collectNotes.trim() || null,
    });
    setSaving(false);
    if (rpcErr) {
      error(ar ? `تعذر تأكيد التحصيل: ${rpcErr.message}` : `Could not confirm collection: ${rpcErr.message}`);
      return;
    }
    success(ar ? 'تم تأكيد التحصيل وتحديث الدفتر المالي واشتراك المنشأة.' : 'Collection confirmed and subscription activated.');
    setCollectingTx(null);
    setCollectRef('');
    setCollectNotes('');
    await load();
  };

  const exportPlatformFinanceCsv = () => {
    const rows = [
      ['Date', 'Type', 'Status', 'Payment Method', 'Category', 'Title', 'Facility', 'Amount', 'Currency', 'Reference'],
      ...visiblePlatformTxs.map(tx => [
        tx.transaction_date,
        tx.transaction_type,
        tx.status,
        tx.payment_method || 'pending',
        tx.category,
        tx.title,
        tx.organization_id ? (orgNameMap.get(tx.organization_id) || '') : 'Platform',
        String(tx.amount),
        tx.currency,
        tx.reference_no || '',
      ]),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medicore-platform-finance-${txMethodFilter}-${txStatusFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const deletePlatformTx = async (tx: PlatformTransaction) => {
    if (!supabase) return;
    const { error: delErr } = await supabase.from('platform_transactions').delete().eq('id', tx.id);
    if (delErr) {
      error(ar ? 'تعذر حذف السجل المالي.' : 'Could not delete transaction.');
      return;
    }
    success(ar ? 'تم حذف القيد المالي.' : 'Transaction removed.');
    await load();
  };

  const savePlatformPayroll = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !payrollForm.user_id) return;
    setSaving(true);
    const { error: insertErr } = await supabase.from('platform_staff_payroll').insert({
      user_id: payrollForm.user_id,
      period_month: payrollForm.period_month,
      base_salary: Number(payrollForm.base_salary) || 0,
      bonuses: Number(payrollForm.bonuses) || 0,
      deductions: Number(payrollForm.deductions) || 0,
      currency: payrollForm.currency || 'EGP',
      status: 'draft',
      created_by: currentUser?.id || null,
    });
    setSaving(false);
    if (insertErr) {
      error(ar ? `تعذر إنشاء مسير الراتب: ${insertErr.message}` : `Could not save payroll: ${insertErr.message}`);
      return;
    }
    success(ar ? 'تم إعداد مسير الراتب بنجاح.' : 'Payroll slip created.');
    setShowPayrollModal(false);
    await load();
  };

  const payPlatformPayroll = async (slipId: string) => {
    if (!supabase) return;
    setSaving(true);
    const { error: payErr } = await supabase.rpc('platform_pay_payroll_slip', { p_payroll_id: slipId });
    setSaving(false);
    if (payErr) {
      error(ar ? `تعذر صرف الراتب: ${payErr.message}` : `Could not disburse payroll: ${payErr.message}`);
      return;
    }
    success(ar ? 'تم صرف الراتب وترحيل المصروف للمالية السحابية.' : 'Payroll disbursed and posted to finance ledger.');
    await load();
  };

  const savePlatformLeave = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || !leaveForm.user_id) return;
    setSaving(true);
    const { error: leaveErr } = await supabase.from('platform_leave_requests').insert({
      user_id: leaveForm.user_id,
      leave_type: leaveForm.leave_type,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      days_count: Math.max(1, Number(leaveForm.days_count) || 1),
      reason: leaveForm.reason.trim() || null,
      status: 'pending',
    });
    setSaving(false);
    if (leaveErr) {
      error(ar ? `تعذر تسجيل طلب الإجازة: ${leaveErr.message}` : `Could not create leave request: ${leaveErr.message}`);
      return;
    }
    success(ar ? 'تم تسجيل طلب الإجازة.' : 'Leave request recorded.');
    setShowLeaveModal(false);
    setLeaveForm({ user_id: '', leave_type: 'annual', start_date: new Date().toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10), days_count: 1, reason: '' });
    await load();
  };

  const decidePlatformLeave = async (leaveId: string, nextStatus: 'approved' | 'rejected') => {
    if (!supabase) return;
    const { error: updErr } = await supabase
      .from('platform_leave_requests')
      .update({ status: nextStatus, decided_by: currentUser?.id || null, decided_at: new Date().toISOString() })
      .eq('id', leaveId);
    if (updErr) {
      error(ar ? 'تعذر تحديث حالة الإجازة.' : 'Could not update leave status.');
      return;
    }
    success(nextStatus === 'approved' ? (ar ? 'تم اعتماد الإجازة.' : 'Leave approved.') : (ar ? 'تم رفض الإجازة.' : 'Leave rejected.'));
    await load();
  };

  const activeCount = metrics?.totals.active_organizations ?? organizations.filter(org => org.status === 'active').length;
  const branchCount = metrics?.totals.branches ?? organizations.reduce((count, org) => count + (org.branches?.length || 0), 0);
  const trialCount = organizations.reduce((count, org) => count + (org.subscriptions || []).filter(sub => sub.status === 'trialing').length, 0);

  const tabs = [
    ['super_admin_dashboard', ar ? 'نظرة عامة' : 'Overview'],
    ['super_admin_orgs', ar ? 'إدارة المنشآت' : 'Facilities'],
    ['super_admin_users', ar ? 'فريق وحسابات المنصة' : 'Accounts'],
    ['super_admin_subscriptions', ar ? 'الاشتراكات' : 'Subscriptions'],
    ['super_admin_finance', ar ? 'المالية وإيرادات المنصة' : 'Platform Finance'],
    ['super_admin_hr', ar ? 'الموارد البشرية للمنصة' : 'Platform HR'],
    ['super_admin_analytics', ar ? 'تحليلات المنصة' : 'Analytics'],
    ['super_admin_announcements', ar ? 'إعلانات النظام' : 'Announcements'],
  ];

  const orgNameMap = new Map(organizations.map(o => [o.id, ar ? o.name_ar : o.name_en]));
  const userNameMap = new Map(users.map(u => [u.id, ar ? u.name_ar : u.name_en]));
  const platformTeamUsers = users.filter(u => !u.organization_id && u.role === 'super_admin');
  const facilityOwnerUsers = users.filter(u => Boolean(u.organization_id) && u.role === 'org_owner');
  const platformAccounts = users.filter(
    u => (!u.organization_id && u.role === 'super_admin') || (Boolean(u.organization_id) && u.role === 'org_owner')
  );
  const totalPlatformIncome = platformTxs
    .filter(t => t.status === 'paid' && (t.transaction_type === 'subscription_income' || t.transaction_type === 'adjustment'))
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalPendingIncome = platformTxs
    .filter(t => t.status === 'pending' && t.transaction_type === 'subscription_income')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalPlatformExpense = platformTxs
    .filter(t => t.status === 'paid' && (t.transaction_type === 'operating_expense' || t.transaction_type === 'payroll_payout'))
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const platformIncomeByMethod = platformTxs
    .filter(t => t.status === 'paid' && (t.transaction_type === 'subscription_income' || t.transaction_type === 'adjustment'))
    .reduce<Record<string, number>>((acc, t) => {
      const m = t.payment_method || 'cash';
      acc[m] = (acc[m] || 0) + Number(t.amount || 0);
      return acc;
    }, {});
  const visiblePlatformTxs = platformTxs.filter(t => {
    const matchType = txFilter === 'all' || t.transaction_type === txFilter;
    const matchStatus = txStatusFilter === 'all' || t.status === txStatusFilter;
    const matchMethod =
      txMethodFilter === 'all'
        ? true
        : txMethodFilter === '__wallets__'
          ? ['wallet', 'vodafone_cash'].includes(t.payment_method || '')
          : t.payment_method === txMethodFilter;
    return matchType && matchStatus && matchMethod;
  });
  const orgMetricMap = new Map((metrics?.by_organization || []).map(m => [m.organization_id, m]));

  const visibleOrgs = organizations.filter(org => {
    const matchText = `${org.name_ar} ${org.name_en} ${org.email} ${org.city}`.toLowerCase().includes(orgSearch.toLowerCase());
    const matchStatus = orgStatusFilter === 'all' || org.status === orgStatusFilter;
    return matchText && matchStatus;
  });

  const visibleUsers = platformAccounts.filter(item => {
    const matchText = `${item.email} ${item.name_ar} ${item.name_en}`.toLowerCase().includes(userSearch.toLowerCase());
    const matchRole = userRoleFilter === 'all' || item.role === userRoleFilter;
    const matchOrg =
      userOrgFilter === 'all'
        ? true
        : userOrgFilter === '__platform__'
          ? (!item.organization_id && item.role === 'super_admin')
          : userOrgFilter === '__owners__'
            ? (Boolean(item.organization_id) && item.role === 'org_owner')
            : item.organization_id === userOrgFilter;
    return matchText && matchRole && matchOrg;
  });

  const roleLabel = (role: AppRole) => t.roles[role] || role;
  const roleOptions = editingUser?.organization_id ? (['org_owner'] as AppRole[]) : (['super_admin'] as AppRole[]);
  const statusLabel = (status: Organization['status']) => ({
    active: ar ? 'نشطة' : 'Active',
    pending_approval: ar ? 'بانتظار الموافقة' : 'Pending approval',
    suspended: ar ? 'موقوفة' : 'Suspended',
    archived: ar ? 'مؤرشفة' : 'Archived',
  })[status];

  const statusBadgeClass = (status: Organization['status']) => ({
    active: 'bg-emerald-100 text-emerald-800',
    pending_approval: 'bg-amber-100 text-amber-800',
    suspended: 'bg-rose-100 text-rose-800',
    archived: 'bg-slate-200 text-slate-700',
  })[status];

  const deleteOrgMetrics = deleteCandidate ? orgMetricMap.get(deleteCandidate.id) : undefined;

  return (
    <main className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
      <header className="rounded-3xl bg-gradient-to-r from-purple-950 via-indigo-900 to-slate-900 p-6 text-white">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-purple-300" />
          <div>
            <h1 className="text-2xl font-black">{ar ? 'إدارة المنصة' : 'Platform administration'}</h1>
            <p className="mt-1 text-sm text-purple-100">
              {ar ? 'إدارة المنشآت والحسابات والاشتراكات بإجراءات موثقة ومحمية على الخادم.' : 'Manage facilities, accounts, and subscriptions through audited server-enforced workflows.'}
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="ms-auto rounded-xl border border-white/20 p-2 hover:bg-white/10" title={ar ? 'تحديث' : 'Refresh'}>
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button
            type="button"
            key={key}
            onClick={() => onSelectTab(key)}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition ${activeTab === key ? 'bg-purple-900 text-white shadow-sm' : 'border bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Top KPI strip */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [ar ? 'المنشآت' : 'Facilities', metrics?.totals.organizations ?? organizations.length, <Building2 key="o" className="h-5 w-5" />],
          [ar ? 'المنشآت النشطة' : 'Active facilities', activeCount, <ShieldCheck key="a" className="h-5 w-5" />],
          [ar ? 'الفروع' : 'Branches', branchCount, <Building2 key="b" className="h-5 w-5" />],
          [ar ? 'حسابات المستخدمين' : 'User accounts', metrics?.totals.users ?? userCount, <Users key="u" className="h-5 w-5" />],
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

      {/* 1. OVERVIEW TAB (DISTINCT FROM FACILITIES TABLE) */}
      {activeTab === 'super_admin_dashboard' && (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [ar ? 'إجمالي المرضى' : 'Total Patients', metrics?.totals.patients ?? 0],
              [ar ? 'المواعيد المسجلة' : 'Total Appointments', metrics?.totals.appointments ?? 0],
              [ar ? 'الكشوفات الطبية' : 'Consultations', metrics?.totals.consultations ?? 0],
              [ar ? 'الفواتير المصدرة' : 'Invoices Issued', metrics?.totals.invoices ?? 0],
            ].map(([lbl, val]) => (
              <article key={String(lbl)} className="rounded-2xl border bg-white p-4">
                <p className="text-xs font-bold text-slate-500">{String(lbl)}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{loading ? '—' : Number(val).toLocaleString()}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <button type="button" onClick={() => { setShowFacilityForm(true); setConfirmFacilityCreate(false); }} className="flex items-center justify-between rounded-2xl border bg-white p-4 text-start hover:border-purple-400">
              <div>
                <p className="text-sm font-black text-slate-900">{ar ? 'إنشاء منشأة طبية جديدة' : 'Provision New Facility'}</p>
                <p className="mt-1 text-xs text-slate-500">{ar ? 'إعداد المنشأة والفرع الرئيسي وحساب المالك' : 'Set up facility, main branch, and owner'}</p>
              </div>
              <Plus className="h-5 w-5 text-purple-700" />
            </button>
            <button type="button" onClick={() => onSelectTab('super_admin_orgs')} className="flex items-center justify-between rounded-2xl border bg-white p-4 text-start hover:border-purple-400">
              <div>
                <p className="text-sm font-black text-slate-900">{ar ? 'مراجعة المنشآت والدخول للدعم' : 'Manage Facilities & Support Entry'}</p>
                <p className="mt-1 text-xs text-slate-500">{ar ? `${organizations.length} منشآت مسجلة حالياً` : `${organizations.length} registered facilities`}</p>
              </div>
              <Building2 className="h-5 w-5 text-medicore-600" />
            </button>
            <button type="button" onClick={() => onSelectTab('super_admin_subscriptions')} className="flex items-center justify-between rounded-2xl border bg-white p-4 text-start hover:border-purple-400">
              <div>
                <p className="text-sm font-black text-slate-900">{ar ? 'متابعة الاشتراكات والباقات' : 'Subscriptions & Plans'}</p>
                <p className="mt-1 text-xs text-slate-500">{ar ? `${trialCount} اشتراك تجريبي نشط` : `${trialCount} active trial(s)`}</p>
              </div>
              <CreditCard className="h-5 w-5 text-emerald-600" />
            </button>
          </section>

          <section className="rounded-2xl border bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="flex items-center gap-2 font-black text-sm">
                <FileClock className="h-4 w-4 text-purple-700" />
                {ar ? 'أحدث أحداث سجل التدقيق على المنصة' : 'Recent Platform Audit Activity'}
              </h2>
              <span className="text-xs text-slate-500">{ar ? 'آخر 15 عملية' : 'Latest 15 events'}</span>
            </div>
            {!metrics?.recent_audits?.length ? (
              <p className="p-6 text-center text-xs text-slate-400">{ar ? 'لا توجد أحداث تدقيق مسجلة بعد.' : 'No audit events recorded yet.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 font-bold">
                    <tr>
                      <th className="p-3 text-start">{ar ? 'الوقت' : 'Time'}</th>
                      <th className="p-3 text-start">{ar ? 'المنفذ' : 'Actor'}</th>
                      <th className="p-3 text-start">{ar ? 'الإجراء' : 'Action'}</th>
                      <th className="p-3 text-start">{ar ? 'الكيان' : 'Entity'}</th>
                      <th className="p-3 text-start">{ar ? 'المنشأة' : 'Facility'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.recent_audits.map(row => (
                      <tr key={row.id} className="border-t">
                        <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{new Date(row.created_at).toLocaleString(ar ? 'ar-EG' : 'en-GB')}</td>
                        <td className="p-3 font-bold">{row.user_name}</td>
                        <td className="p-3 font-semibold text-slate-800">{getAuditActionLabel(row.action, row.entity_type, ar)}</td>
                        <td className="p-3"><span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-bold text-indigo-800 text-[11px]">{getAuditEntityLabel(row.entity_type, ar)}</span></td>
                        <td className="p-3 text-slate-600">{row.organization_id ? (orgNameMap.get(row.organization_id) || row.organization_id.slice(0, 8)) : (ar ? 'إدارة المنصة' : 'Platform')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* 2. FACILITIES MANAGEMENT TAB */}
      {activeTab === 'super_admin_orgs' && (
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <h2 className="font-black">{ar ? 'إدارة المنشآت الطبية المسجلة' : 'Registered Medical Facilities'}</h2>
            <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
              <input
                value={orgSearch}
                onChange={e => setOrgSearch(e.target.value)}
                placeholder={ar ? 'بحث بالاسم أو المدينة أو البريد' : 'Search name, city, or email'}
                className="w-full sm:w-auto rounded-xl border px-3 py-2 text-xs"
              />
              <select
                value={orgStatusFilter}
                onChange={e => setOrgStatusFilter(e.target.value)}
                className="rounded-xl border bg-white px-3 py-2 text-xs font-bold"
              >
                <option value="all">{ar ? 'كل الحالات' : 'All statuses'}</option>
                <option value="active">{statusLabel('active')}</option>
                <option value="pending_approval">{statusLabel('pending_approval')}</option>
                <option value="suspended">{statusLabel('suspended')}</option>
                <option value="archived">{statusLabel('archived')}</option>
              </select>
              <button
                type="button"
                onClick={() => { setShowFacilityForm(true); setConfirmFacilityCreate(false); }}
                className="inline-flex items-center gap-2 rounded-xl bg-medicore-600 px-3 py-2 text-xs font-bold text-white"
              >
                <Plus className="h-4 w-4" />{ar ? 'إنشاء منشأة' : 'Create facility'}
              </button>
            </div>
          </div>
          {loading ? (
            <p className="p-8 text-sm text-slate-500">{ar ? 'جار تحميل البيانات...' : 'Loading...'}</p>
          ) : visibleOrgs.length === 0 ? (
            <p className="p-8 text-sm text-slate-500">{ar ? 'لا توجد منشآت مطابقة.' : 'No matching facilities.'}</p>
          ) : (
            <>
              {/* Mobile Cards View */}
              <div className="divide-y md:hidden">
                {visibleOrgs.map(org => {
                  const m = orgMetricMap.get(org.id);
                  const hasSuperAdmin = users.some(u => u.organization_id === org.id && u.role === 'super_admin');
                  return (
                    <article key={org.id} className="p-4 space-y-3 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-black text-sm text-slate-900 truncate">{ar ? org.name_ar : org.name_en}</h3>
                          <p className="text-slate-500 truncate">{org.email} · {org.city}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(org.status)}`}>{statusLabel(org.status)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {getFacilityTypeLabel(org.facility_type, ar)}
                        </span>
                        {(org.specialties || []).slice(0, 3).map(code => {
                          const sp = getSpecialtyByCode(code);
                          return (
                            <span key={code} className="rounded bg-medicore-50 px-2 py-0.5 text-[10px] font-semibold text-medicore-800">
                              {sp ? (ar ? sp.name_ar : sp.name_en) : code}
                            </span>
                          );
                        })}
                        {(org.specialties || []).length > 3 && (
                          <span className="rounded bg-medicore-50 px-2 py-0.5 text-[10px] font-bold text-medicore-700">
                            +{(org.specialties || []).length - 3}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600">
                        {ar
                          ? `${org.branches?.length || 0} فرع · ${m?.users_count ?? 0} مستخدم · ${m?.patients_count ?? 0} مريض`
                          : `${org.branches?.length || 0} branch · ${m?.users_count ?? 0} users · ${m?.patients_count ?? 0} pts`}
                      </p>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button type="button" onClick={() => { setEditingFacility({ ...org }); setConfirmFacilityUpdate(false); }} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold hover:bg-slate-50">
                          <Pencil className="h-3.5 w-3.5" />{ar ? 'تعديل' : 'Edit'}
                        </button>
                        {org.status === 'active' ? (
                          <>
                            <button type="button" onClick={() => setSupportCandidate(org)} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 font-bold text-amber-900">
                              <LogIn className="h-3.5 w-3.5" />{ar ? 'دخول المنشأة' : 'Enter facility'}
                            </button>
                            <button type="button" disabled={saving} onClick={() => void changeFacilityStatus(org, 'suspended')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40">
                              <PauseCircle className="h-3.5 w-3.5" />{ar ? 'إيقاف' : 'Suspend'}
                            </button>
                          </>
                        ) : (
                          <button type="button" disabled={saving} onClick={() => void changeFacilityStatus(org, 'active')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40">
                            <PlayCircle className="h-3.5 w-3.5" />{ar ? 'تفعيل' : 'Activate'}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={saving || hasSuperAdmin}
                          onClick={() => { setDeleteCandidate(org); setDeleteAcknowledge(false); }}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />{ar ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-start text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    {[ar ? 'المنشأة' : 'Facility', ar ? 'المدينة' : 'City', ar ? 'الحالة' : 'Status', ar ? 'الحجم الفعلي' : 'Records', ar ? 'تاريخ التسجيل' : 'Created', ar ? 'إجراءات التحكم' : 'Actions'].map(header => (
                      <th key={header} className="p-3 text-start">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleOrgs.map(org => {
                    const m = orgMetricMap.get(org.id);
                    const hasSuperAdmin = users.some(u => u.organization_id === org.id && u.role === 'super_admin');
                    return (
                      <tr key={org.id} className="border-t">
                        <td className="p-3 font-bold">
                          <div>{ar ? org.name_ar : org.name_en}</div>
                          <div className="font-normal text-slate-500">{org.email}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {getFacilityTypeLabel(org.facility_type, ar)}
                            </span>
                            {(org.specialties || []).slice(0, 2).map(code => {
                              const sp = getSpecialtyByCode(code);
                              return (
                                <span key={code} className="rounded bg-medicore-50 px-1.5 py-0.5 text-[10px] font-semibold text-medicore-800">
                                  {sp ? (ar ? sp.name_ar : sp.name_en) : code}
                                </span>
                              );
                            })}
                            {(org.specialties || []).length > 2 && (
                              <span className="rounded bg-medicore-50 px-1.5 py-0.5 text-[10px] font-bold text-medicore-700">
                                +{(org.specialties || []).length - 2}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">{org.city}</td>
                        <td className="p-3">
                          <span className={`rounded-full px-2.5 py-1 font-bold ${statusBadgeClass(org.status)}`}>{statusLabel(org.status)}</span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-600">
                          {ar
                            ? `${org.branches?.length || 0} فرع · ${m?.users_count ?? 0} مستخدم · ${m?.patients_count ?? 0} مريض`
                            : `${org.branches?.length || 0} branch · ${m?.users_count ?? 0} users · ${m?.patients_count ?? 0} pts`}
                        </td>
                        <td className="p-3">{new Date(org.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => { setEditingFacility({ ...org }); setConfirmFacilityUpdate(false); }} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold hover:bg-slate-50">
                              <Pencil className="h-3.5 w-3.5" />{ar ? 'تعديل' : 'Edit'}
                            </button>
                            {org.status === 'active' ? (
                              <>
                                <button type="button" onClick={() => setSupportCandidate(org)} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 font-bold text-amber-900">
                                  <LogIn className="h-3.5 w-3.5" />{ar ? 'دخول المنشأة' : 'Enter facility'}
                                </button>
                                <button type="button" disabled={saving} onClick={() => void changeFacilityStatus(org, 'suspended')} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-40">
                                  <PauseCircle className="h-3.5 w-3.5" />{ar ? 'إيقاف' : 'Suspend'}
                                </button>
                              </>
                            ) : (
                              <button type="button" disabled={saving} onClick={() => void changeFacilityStatus(org, 'active')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40">
                                <PlayCircle className="h-3.5 w-3.5" />{ar ? 'تفعيل' : 'Activate'}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={saving || hasSuperAdmin}
                              onClick={() => { setDeleteCandidate(org); setDeleteAcknowledge(false); }}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1.5 font-bold text-rose-800 hover:bg-rose-100 disabled:opacity-40"
                              title={ar ? 'حذف المنشأة وبياناتها نهائياً' : 'Delete facility permanently'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />{ar ? 'حذف' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      )}

      {/* 3. ACCOUNTS TAB */}
      {activeTab === 'super_admin_users' && (
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <h2 className="font-black">{ar ? 'حسابات فريق المنصة وملاك المنشآت' : 'Platform Team & Facility Owners'}</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {ar
                  ? 'يقتصر هذا الدليل على فريق المنصة وملاك المنشآت فقط — باقي الطاقم الطبي والإداري والمرضى يُدارون من داخل كل منشأة.'
                  : 'Scoped to platform team accounts and facility owners only — clinic staff and patients are managed inside each facility.'}
              </p>
            </div>
            <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
              <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder={ar ? 'بحث بالاسم أو البريد' : 'Search name or email'} className="w-full sm:w-auto rounded-xl border px-3 py-2 text-xs" />
              <select value={userRoleFilter} onChange={e => setUserRoleFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-xs font-bold">
                <option value="all">{ar ? 'كل الأدوار (المنصة والملاك)' : 'All Platform & Owner Roles'}</option>
                {platformScopedRoles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              <select value={userOrgFilter} onChange={e => setUserOrgFilter(e.target.value)} className="rounded-xl border bg-white px-3 py-2 text-xs font-bold">
                <option value="all">{ar ? 'الكل (فريق المنصة + ملاك المنشآت)' : 'All (Platform Team + Facility Owners)'}</option>
                <option value="__platform__">{ar ? 'حسابات فريق المنصة فقط' : 'Platform Team Only'}</option>
                <option value="__owners__">{ar ? 'حسابات ملاك المنشآت فقط' : 'Facility Owners Only'}</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{ar ? `مالك: ${o.name_ar}` : `Owner: ${o.name_en}`}</option>)}
              </select>
              <button type="button" onClick={() => { setNewUser({ ...emptyNewUser, organization_id: organizations[0]?.id || '' }); setShowCreateUser(true); }} className="inline-flex items-center gap-1.5 rounded-xl bg-medicore-600 px-3 py-2 text-xs font-bold text-white">
                <Plus className="h-4 w-4" />{ar ? 'إنشاء حساب منصة / مالك' : 'Create Account'}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b bg-slate-50/70 px-4 py-2.5 text-xs">
            {[
              { id: 'all', label: ar ? `الكل (${platformAccounts.length})` : `All (${platformAccounts.length})` },
              { id: '__platform__', label: ar ? `فريق المنصة (${platformTeamUsers.length})` : `Platform Team (${platformTeamUsers.length})` },
              { id: '__owners__', label: ar ? `ملاك المنشآت (${facilityOwnerUsers.length})` : `Facility Owners (${facilityOwnerUsers.length})` },
            ].map(seg => (
              <button
                key={seg.id}
                type="button"
                onClick={() => setUserOrgFilter(seg.id)}
                className={`rounded-lg px-3 py-1.5 font-bold transition ${
                  userOrgFilter === seg.id ? 'bg-purple-900 text-white shadow-2xs' : 'bg-white border text-slate-700 hover:bg-slate-100'
                }`}
              >
                {seg.label}
              </button>
            ))}
          </div>
          {loading ? <p className="p-8 text-sm text-slate-500">{ar ? 'جار تحميل البيانات...' : 'Loading...'}</p> : visibleUsers.length === 0 ? <p className="p-8 text-sm text-slate-500">{ar ? 'لا توجد حسابات مطابقة.' : 'No matching accounts.'}</p> : visibleUsers.map(item => (
            <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <p className="font-bold">{ar ? item.name_ar : item.name_en}</p>
                <p className="text-xs text-slate-500">{item.email}</p>
                <p className="mt-1 text-[11px] font-semibold">
                  {item.organization_id ? (
                    <span className="text-sky-700">
                      {ar ? `مالك منشأة — ${orgNameMap.get(item.organization_id) || 'منشأة طبية'}` : `Facility Owner — ${orgNameMap.get(item.organization_id) || 'Medical Facility'}`}
                    </span>
                  ) : (
                    <span className="text-purple-700">
                      {ar ? 'حساب فريق المنصة' : 'Platform Team Account'}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs">{roleLabel(item.role)}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs ${item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{item.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'موقوف' : 'Disabled')}</span>
                <button type="button" disabled={saving} onClick={() => { setEditingUser({ ...item, password: '' }); setConfirmUserSave(false); }} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"><Pencil className="h-3.5 w-3.5" />{ar ? 'تعديل' : 'Edit'}</button>
                <button type="button" disabled={saving || item.id === currentUser?.id || (item.role === 'super_admin' && item.is_active && users.filter(row => row.role === 'super_admin' && row.is_active).length <= 1)} onClick={() => { setEditingUser({ ...item, is_active: !item.is_active }); setConfirmUserSave(true); }} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40">
                  {item.is_active ? <UserRoundX className="h-3.5 w-3.5" /> : <UserRoundCheck className="h-3.5 w-3.5" />}{item.is_active ? (ar ? 'إيقاف الحساب' : 'Disable account') : (ar ? 'إعادة التفعيل' : 'Reactivate')}
                </button>
              </div>
            </article>
          ))}
          <p className="p-4 text-xs leading-6 text-slate-500">{ar ? 'إيقاف الحساب يمنع الدخول ويحافظ على ملكية السجلات الطبية وسجل التدقيق.' : 'Disabling an account blocks sign-in while preserving clinical record ownership and audit history.'}</p>
        </section>
      )}

      {/* 4. SUBSCRIPTIONS TAB */}
      {activeTab === 'super_admin_subscriptions' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
            <span>
              {ar ? `الاشتراكات التجريبية الحالية: ${loading ? '—' : trialCount}. إدارة الباقات وحدودها وميزاتها من قاعدة البيانات:` : `Current trial subscriptions: ${loading ? '—' : trialCount}. Live subscription plans & quotas from Supabase:`}
            </span>
            <button
              type="button"
              onClick={() => setEditingPlan(createEmptyPlan())}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-800"
            >
              <Plus className="h-4 w-4" />{ar ? 'إضافة باقة جديدة' : 'Add New Plan'}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {plans.map(plan => {
              const limitTxt = (v: number) => (v === 0 ? (ar ? 'غير محدود' : 'Unlimited') : String(v));
              const branchTxt = plan.max_branches === 0
                ? (ar ? 'فروع غير محدودة' : 'Unlimited branches')
                : plan.max_branches <= 1
                  ? (ar ? 'فرع واحد فقط (بدون فروع إضافية)' : 'Single branch only')
                  : (ar ? `حتى ${plan.max_branches} فروع` : `Up to ${plan.max_branches} branches`);
              return (
                <div key={plan.id} className="rounded-2xl border bg-white p-4 text-xs space-y-2 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-black text-slate-900">{ar ? plan.name_ar : plan.name_en}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${plan.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {plan.is_active ? (ar ? 'مفعلة' : 'Active') : (ar ? 'معطلة' : 'Inactive')}
                      </span>
                    </div>
                    <p className="font-mono text-indigo-700 font-bold">
                      {Number(plan.price_monthly).toLocaleString()} {plan.currency} / {ar ? 'شهر' : 'mo'} · {Number(plan.price_annual).toLocaleString()} / {ar ? 'سنة' : 'yr'}
                    </p>
                    <p className="text-slate-600 font-semibold">{branchTxt}</p>
                    <p className="text-slate-500">
                      {ar
                        ? `أطباء: ${limitTxt(plan.max_doctors)} · مستخدمون: ${limitTxt(plan.max_users)} · مرضى: ${limitTxt(plan.max_patients ?? 500)}`
                        : `Doctors: ${limitTxt(plan.max_doctors)} · Users: ${limitTxt(plan.max_users)} · Patients: ${limitTxt(plan.max_patients ?? 500)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 border-t pt-2.5">
                    <button
                      type="button"
                      onClick={() => setEditingPlan({
                        id: plan.id,
                        slug: plan.slug,
                        name_ar: plan.name_ar,
                        name_en: plan.name_en,
                        tier: plan.tier,
                        price_monthly: Number(plan.price_monthly),
                        price_annual: Number(plan.price_annual),
                        currency: plan.currency,
                        allow_branches: plan.max_branches === 0 || plan.max_branches > 1,
                        max_branches: plan.max_branches,
                        max_doctors: plan.max_doctors,
                        max_users: plan.max_users,
                        max_patients: plan.max_patients ?? 500,
                        max_storage_mb: plan.max_storage_mb,
                        has_laboratory: plan.has_laboratory,
                        has_radiology: plan.has_radiology,
                        has_inventory: plan.has_inventory,
                        has_insurance: plan.has_insurance,
                        has_specialty_canvas: plan.has_specialty_canvas,
                        has_accounting_ledger: plan.has_accounting_ledger,
                        has_patient_portal: plan.has_patient_portal,
                        has_dedicated_db: plan.has_dedicated_db,
                        is_active: plan.is_active,
                      })}
                      className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold hover:bg-slate-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />{ar ? 'تعديل' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePlanCandidate(plan)}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 font-bold text-rose-700 hover:bg-rose-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />{ar ? 'حذف' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 font-bold">
                <tr>
                  <th className="p-3 text-start">{ar ? 'المنشأة' : 'Facility'}</th>
                  <th className="p-3 text-start">{ar ? 'الباقة' : 'Plan'}</th>
                  <th className="p-3 text-start">{ar ? 'الحالة' : 'Status'}</th>
                  <th className="p-3 text-start">{ar ? 'الدورة' : 'Cycle'}</th>
                  <th className="p-3 text-start">{ar ? 'القيمة' : 'Amount'}</th>
                  <th className="p-3 text-start">{ar ? 'نهاية الفترة' : 'Period End'}</th>
                  <th className="p-3 text-start">{ar ? 'تعديل' : 'Manage'}</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map(org => {
                  const sub = (org.subscriptions || [])[0];
                  const matchedPlan = sub ? plans.find(p => p.id === sub.plan_id) : plans[0];
                  return (
                    <tr key={org.id} className="border-t">
                      <td className="p-3 font-bold">{ar ? org.name_ar : org.name_en}</td>
                      <td className="p-3">{matchedPlan ? (ar ? matchedPlan.name_ar : matchedPlan.name_en) : '—'}</td>
                      <td className="p-3">{sub ? getSubscriptionStatusLabel(sub.status, ar) : '—'}</td>
                      <td className="p-3">{sub ? getBillingCycleLabel(sub.cycle, ar) : '—'}</td>
                      <td className="p-3 font-mono">{sub ? `${Number(sub.amount).toLocaleString()} ${sub.currency}` : '—'}</td>
                      <td className="p-3 font-mono">{sub?.current_period_end?.slice(0, 10) || '—'}</td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setEditingSub({
                            organization_id: org.id,
                            organization_name: ar ? org.name_ar : org.name_en,
                            plan_id: sub?.plan_id || plans[0]?.id || '',
                            status: sub?.status || 'trialing',
                            cycle: sub?.cycle || 'monthly',
                            current_period_end: sub?.current_period_end?.slice(0, 10) || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                          })}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 font-bold hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5" />{ar ? 'إدارة' : 'Update'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. ANALYTICS TAB */}
      {activeTab === 'super_admin_analytics' && (
        <div className="space-y-4">
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="flex items-center gap-2 font-black text-sm"><BarChart3 className="h-4 w-4 text-sky-600" />{ar ? 'توزيع المنشآت حسب النوع' : 'Facilities by Type'}</h2>
              <div className="space-y-2 text-xs">
                {FACILITY_TYPES.map(ft => {
                  const count = organizations.filter(o => o.facility_type === ft.value).length;
                  return (
                    <div key={ft.value} className="flex justify-between border-b pb-1.5">
                      <span className="font-bold text-slate-700">{ar ? ft.label_ar : ft.label_en}</span>
                      <span className="font-black text-slate-900">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-5 space-y-3">
              <h2 className="flex items-center gap-2 font-black text-sm"><Users className="h-4 w-4 text-purple-600" />{ar ? 'توزيع حسابات المنصة والملاك' : 'Platform & Facility Owner Accounts'}</h2>
              <div className="space-y-2 text-xs max-h-64 overflow-y-auto">
                {platformScopedRoles.map(r => {
                  const count = platformAccounts.filter(u => u.role === r).length;
                  return (
                    <div key={r} className="flex justify-between border-b pb-1.5">
                      <span className="text-slate-700 font-bold">{roleLabel(r)}</span>
                      <span className="font-black text-slate-900">{count}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between pt-1 text-slate-500">
                  <span className="font-semibold">{ar ? 'طاقم المنشآت والمرضى (تُدار داخل كل منشأة)' : 'Clinic Staff & Patients (Facility-scoped)'}</span>
                  <span className="font-black text-slate-700">{users.length - platformAccounts.length}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white overflow-hidden">
            <div className="border-b p-4">
              <h2 className="flex items-center gap-2 font-black text-sm"><Activity className="h-4 w-4 text-emerald-600" />{ar ? 'النشاط الفعلي لكل منشأة (من قاعدة البيانات)' : 'Per-Facility Activity Breakdown'}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 font-bold">
                  <tr>
                    <th className="p-3 text-start">{ar ? 'المنشأة' : 'Facility'}</th>
                    <th className="p-3 text-start">{ar ? 'الحالة' : 'Status'}</th>
                    <th className="p-3 text-start">{ar ? 'الفروع' : 'Branches'}</th>
                    <th className="p-3 text-start">{ar ? 'المستخدمون' : 'Users'}</th>
                    <th className="p-3 text-start">{ar ? 'المرضى' : 'Patients'}</th>
                    <th className="p-3 text-start">{ar ? 'المواعيد' : 'Appointments'}</th>
                    <th className="p-3 text-start">{ar ? 'الفواتير' : 'Invoices'}</th>
                  </tr>
                </thead>
                <tbody>
                  {(metrics?.by_organization || []).map(row => (
                    <tr key={row.organization_id} className="border-t">
                      <td className="p-3 font-bold">{ar ? row.name_ar : row.name_en}</td>
                      <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadgeClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                      <td className="p-3 font-mono">{row.branches_count}</td>
                      <td className="p-3 font-mono">{row.users_count}</td>
                      <td className="p-3 font-mono">{row.patients_count}</td>
                      <td className="p-3 font-mono">{row.appointments_count}</td>
                      <td className="p-3 font-mono">{row.invoices_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* 6. ANNOUNCEMENTS TAB */}
      {activeTab === 'super_admin_announcements' && (
        <section className="rounded-2xl border bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="flex items-center gap-2 font-black text-sm"><Megaphone className="h-4 w-4 text-amber-600" />{ar ? `إعلانات النظام (${announcements.length})` : `System Announcements (${announcements.length})`}</h2>
            <button type="button" onClick={() => setShowAnnModal(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white"><Plus className="h-4 w-4" />{ar ? 'إعلان جديد' : 'New Announcement'}</button>
          </div>
          {announcements.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-400">{ar ? 'لا توجد إعلانات مسجلة.' : 'No announcements yet.'}</p>
          ) : (
            <div className="divide-y">
              {announcements.map(ann => (
                <div key={ann.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <p className="font-black text-slate-900">{ar ? ann.title_ar : ann.title_en}</p>
                    <p className="mt-1 text-slate-600">{ar ? ann.body_ar : ann.body_en}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 font-bold ${ann.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                      {getAnnouncementSeverityLabel(ann.severity, ar)} · {ann.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'متوقف' : 'Inactive')}
                    </span>
                    <button type="button" onClick={() => void toggleAnnouncement(ann)} className="rounded-lg border px-3 py-1.5 font-bold">
                      {ann.is_active ? (ar ? 'إيقاف' : 'Disable') : (ar ? 'تفعيل' : 'Activate')}
                    </button>
                    <button type="button" onClick={() => void deleteAnnouncement(ann)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 font-bold text-rose-700 hover:bg-rose-50">
                      <Trash2 className="h-3.5 w-3.5" />{ar ? 'حذف' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 7. PLATFORM FINANCE LEDGER TAB */}
      {activeTab === 'super_admin_finance' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs font-bold text-slate-500">{ar ? 'الإيرادات المحصّلة فعلياً' : 'Collected Income'}</p>
              <p className="mt-1 text-2xl font-black text-emerald-700 font-mono">{totalPlatformIncome.toLocaleString()} EGP</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
              <p className="text-xs font-bold text-amber-800">{ar ? 'عمليات قيد السداد (مستحقة)' : 'Pending Receivables'}</p>
              <p className="mt-1 text-2xl font-black text-amber-700 font-mono">{totalPendingIncome.toLocaleString()} EGP</p>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs font-bold text-slate-500">{ar ? 'المصروفات والرواتب المدفوعة' : 'Paid Expenses & Payroll'}</p>
              <p className="mt-1 text-2xl font-black text-rose-700 font-mono">{totalPlatformExpense.toLocaleString()} EGP</p>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <p className="text-xs font-bold text-slate-500">{ar ? 'صافي التدفق النقدي المحصّل' : 'Net Collected Cashflow'}</p>
              <p className={`mt-1 text-2xl font-black font-mono ${(totalPlatformIncome - totalPlatformExpense) >= 0 ? 'text-medicore-700' : 'text-rose-700'}`}>
                {(totalPlatformIncome - totalPlatformExpense).toLocaleString()} EGP
              </p>
            </div>
          </div>

          <section className="rounded-2xl border bg-white p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-xs font-black text-slate-700"><Wallet className="h-4 w-4 text-sky-600" />{ar ? 'تقارير التحصيل حسب وسيلة الدفع (المحصّل فقط)' : 'Collected Revenue by Payment Method'}</h3>
              {txMethodFilter !== 'all' && (
                <button type="button" onClick={() => setTxMethodFilter('all')} className="text-[11px] font-bold text-medicore-700 hover:underline">
                  {ar ? 'عرض كل الوسائل' : 'Show all methods'}
                </button>
              )}
            </div>
            <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {(['cash', 'instapay', 'wallet', 'vodafone_cash', 'fawry', 'credit_card', 'bank_transfer'] as const).map(method => {
                const amt = platformIncomeByMethod[method] || 0;
                const active = txMethodFilter === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setTxMethodFilter(active ? 'all' : method)}
                    className={`rounded-xl border p-2.5 text-start transition ${active ? 'border-medicore-600 bg-medicore-50 ring-1 ring-medicore-600' : 'bg-slate-50/70 hover:bg-slate-100'}`}
                  >
                    <p className="text-[11px] font-bold text-slate-600">{getPaymentModeLabel(method, ar)}</p>
                    <p className="mt-1 font-mono text-sm font-black text-slate-900">{amt.toLocaleString()} <span className="text-[10px] font-semibold">EGP</span></p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
              <h2 className="flex items-center gap-2 font-black text-sm"><DollarSign className="h-4 w-4 text-emerald-600" />{ar ? `دفتر القيود المالية للمنصة (${visiblePlatformTxs.length})` : `Platform Finance Ledger (${visiblePlatformTxs.length})`}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <select value={txFilter} onChange={e => setTxFilter(e.target.value as any)} className="rounded-xl border bg-white px-2.5 py-1.5 text-xs font-bold">
                  <option value="all">{ar ? 'كل الحركات' : 'All Types'}</option>
                  <option value="subscription_income">{ar ? 'إيراد اشتراك' : 'Subscription Income'}</option>
                  <option value="operating_expense">{ar ? 'مصروف تشغيلي' : 'Operating Expense'}</option>
                  <option value="payroll_payout">{ar ? 'صرف رواتب المنصة' : 'Payroll Payout'}</option>
                  <option value="adjustment">{ar ? 'تسوية مالية' : 'Adjustment'}</option>
                </select>
                <select value={txStatusFilter} onChange={e => setTxStatusFilter(e.target.value as any)} className="rounded-xl border bg-white px-2.5 py-1.5 text-xs font-bold">
                  <option value="all">{ar ? 'كل الحالات' : 'All Statuses'}</option>
                  <option value="pending">{ar ? 'قيد السداد' : 'Pending'}</option>
                  <option value="paid">{ar ? 'تم السداد' : 'Paid'}</option>
                </select>
                <select value={txMethodFilter} onChange={e => setTxMethodFilter(e.target.value)} className="rounded-xl border bg-white px-2.5 py-1.5 text-xs font-bold">
                  <option value="all">{ar ? 'كل وسائل الدفع' : 'All Methods'}</option>
                  <option value="cash">{getPaymentModeLabel('cash', ar)}</option>
                  <option value="instapay">{getPaymentModeLabel('instapay', ar)}</option>
                  <option value="__wallets__">{ar ? 'كل المحافظ الإلكترونية' : 'All E-Wallets'}</option>
                  <option value="wallet">{getPaymentModeLabel('wallet', ar)}</option>
                  <option value="vodafone_cash">{getPaymentModeLabel('vodafone_cash', ar)}</option>
                  <option value="fawry">{getPaymentModeLabel('fawry', ar)}</option>
                  <option value="credit_card">{getPaymentModeLabel('credit_card', ar)}</option>
                  <option value="bank_transfer">{getPaymentModeLabel('bank_transfer', ar)}</option>
                </select>
                <button type="button" onClick={exportPlatformFinanceCsv} className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <Download className="h-3.5 w-3.5" />{ar ? 'تصدير تقرير CSV' : 'Export CSV'}
                </button>
                <button type="button" onClick={() => setShowTxModal(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Plus className="h-4 w-4" />{ar ? 'قيد مالي جديد' : 'Record Transaction'}</button>
              </div>
            </div>
            {visiblePlatformTxs.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">{ar ? 'لا توجد قيود مالية مطابقة للفلاتر الحالية.' : 'No platform financial transactions match current filters.'}</p>
            ) : (
              <>
                <div className="divide-y md:hidden">
                  {visiblePlatformTxs.map(tx => (
                    <article key={tx.id} className="p-4 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-slate-900">{tx.title}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{tx.transaction_date} · {tx.category}{tx.reference_no ? ` · #${tx.reference_no}` : ''}</p>
                          {tx.organization_id && <p className="text-[11px] font-semibold text-medicore-700 mt-0.5">{orgNameMap.get(tx.organization_id) || '—'}</p>}
                        </div>
                        <p className="font-mono text-sm font-black text-slate-900 shrink-0">{Number(tx.amount).toLocaleString()} {tx.currency}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          tx.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : tx.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {tx.status === 'paid' ? (ar ? 'تم السداد' : 'Paid') : tx.status === 'pending' ? (ar ? 'قيد السداد' : 'Pending') : (ar ? 'ملغى' : 'Cancelled')}
                        </span>
                        {tx.payment_method && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                            {getPaymentModeLabel(tx.payment_method, ar)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {tx.status === 'pending' && (
                          <button type="button" onClick={() => { setCollectingTx(tx); setCollectMethod('instapay'); setCollectRef(''); setCollectNotes(''); }} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
                            <CheckCircle2 className="h-3.5 w-3.5" />{ar ? 'تم التحصيل' : 'Mark Paid'}
                          </button>
                        )}
                        <button type="button" onClick={() => void deletePlatformTx(tx)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-rose-700 hover:bg-rose-50">
                          <Trash2 className="h-3.5 w-3.5" />{ar ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-50 font-bold">
                      <tr>
                        <th className="p-3 text-start">{ar ? 'التاريخ' : 'Date'}</th>
                        <th className="p-3 text-start">{ar ? 'النوع' : 'Type'}</th>
                        <th className="p-3 text-start">{ar ? 'البند / الوصف' : 'Title'}</th>
                        <th className="p-3 text-start">{ar ? 'المنشأة المرتبطة' : 'Facility'}</th>
                        <th className="p-3 text-start">{ar ? 'الحالة والوسيلة' : 'Status & Method'}</th>
                        <th className="p-3 text-start">{ar ? 'المبلغ' : 'Amount'}</th>
                        <th className="p-3 text-start">{ar ? 'إجراء' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePlatformTxs.map(tx => (
                        <tr key={tx.id} className="border-t">
                          <td className="p-3 font-mono whitespace-nowrap">{tx.transaction_date}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              tx.transaction_type === 'subscription_income' || tx.transaction_type === 'adjustment'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {({
                                subscription_income: ar ? 'إيراد اشتراك' : 'Income',
                                operating_expense: ar ? 'مصروف تشغيلي' : 'Expense',
                                payroll_payout: ar ? 'صرف رواتب' : 'Payroll',
                                adjustment: ar ? 'تسوية' : 'Adjustment',
                              })[tx.transaction_type]}
                            </span>
                          </td>
                          <td className="p-3">
                            <p className="font-bold text-slate-900">{tx.title}</p>
                            <p className="text-[11px] text-slate-500">{tx.category}{tx.reference_no ? ` · #${tx.reference_no}` : ''}</p>
                          </td>
                          <td className="p-3">{tx.organization_id ? (orgNameMap.get(tx.organization_id) || '—') : '—'}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                tx.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : tx.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {tx.status === 'paid' ? (ar ? 'تم السداد' : 'Paid') : tx.status === 'pending' ? (ar ? 'قيد السداد' : 'Pending') : (ar ? 'ملغى' : 'Cancelled')}
                              </span>
                              {tx.payment_method && (
                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                                  {getPaymentModeLabel(tx.payment_method, ar)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-mono font-bold whitespace-nowrap">{Number(tx.amount).toLocaleString()} {tx.currency}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1.5">
                              {tx.status === 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => { setCollectingTx(tx); setCollectMethod('instapay'); setCollectRef(''); setCollectNotes(''); }}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-white font-bold hover:bg-emerald-700 whitespace-nowrap"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />{ar ? 'تم التحصيل' : 'Mark Paid'}
                                </button>
                              )}
                              <button type="button" onClick={() => void deletePlatformTx(tx)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1 text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* 8. PLATFORM INTERNAL HR & PAYROLL TAB */}
      {activeTab === 'super_admin_hr' && (
        <div className="space-y-5">
          <section className="rounded-2xl border bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
              <h2 className="flex items-center gap-2 font-black text-sm"><Briefcase className="h-4 w-4 text-indigo-600" />{ar ? `مسيرات رواتب فريق المنصة (${platformPayrolls.length})` : `Platform Team Payroll (${platformPayrolls.length})`}</h2>
              <button
                type="button"
                onClick={() => {
                  setPayrollForm({
                    user_id: platformTeamUsers[0]?.id || '',
                    period_month: new Date().toISOString().slice(0, 7),
                    base_salary: 8000, bonuses: 0, deductions: 0, currency: 'EGP',
                  });
                  setShowPayrollModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
              >
                <Plus className="h-4 w-4" />{ar ? 'إعداد راتب شهر' : 'New Payroll Slip'}
              </button>
            </div>
            {platformPayrolls.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">{ar ? 'لا توجد مسيرات رواتب لفريق المنصة بعد.' : 'No platform payroll slips created yet.'}</p>
            ) : (
              <>
                <div className="divide-y md:hidden">
                  {platformPayrolls.map(slip => (
                    <article key={slip.id} className="p-4 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-slate-900">{userNameMap.get(slip.user_id) || slip.user_id.slice(0, 8)}</p>
                          <p className="font-mono text-[11px] text-slate-500">{slip.period_month} · {ar ? 'أساسي' : 'Base'}: {Number(slip.base_salary).toLocaleString()} (+{Number(slip.bonuses).toLocaleString()} / -{Number(slip.deductions).toLocaleString()})</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${slip.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {slip.status === 'paid' ? (ar ? 'تم الصرف' : 'Paid') : (ar ? 'مسودة' : 'Draft')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <p className="font-mono font-black text-sm text-slate-900">{Number(slip.net_salary).toLocaleString()} {slip.currency}</p>
                        {slip.status !== 'paid' ? (
                          <button type="button" disabled={saving} onClick={() => void payPlatformPayroll(slip.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-white font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" />{ar ? 'صرف وترحيل للمالية' : 'Pay & Post'}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">{slip.paid_at?.slice(0, 10) || '—'}</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-50 font-bold">
                      <tr>
                        <th className="p-3 text-start">{ar ? 'الموظف' : 'Team Member'}</th>
                        <th className="p-3 text-start">{ar ? 'الشهر' : 'Period'}</th>
                        <th className="p-3 text-start">{ar ? 'الأساسي' : 'Base'}</th>
                        <th className="p-3 text-start">{ar ? 'الحوافز / الخصم' : 'Bonus / Ded.'}</th>
                        <th className="p-3 text-start">{ar ? 'الصافي' : 'Net'}</th>
                        <th className="p-3 text-start">{ar ? 'الحالة' : 'Status'}</th>
                        <th className="p-3 text-start">{ar ? 'إجراء' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformPayrolls.map(slip => (
                        <tr key={slip.id} className="border-t">
                          <td className="p-3 font-bold">{userNameMap.get(slip.user_id) || slip.user_id.slice(0, 8)}</td>
                          <td className="p-3 font-mono">{slip.period_month}</td>
                          <td className="p-3 font-mono">{Number(slip.base_salary).toLocaleString()}</td>
                          <td className="p-3 font-mono">+{Number(slip.bonuses).toLocaleString()} / -{Number(slip.deductions).toLocaleString()}</td>
                          <td className="p-3 font-mono font-black text-slate-900">{Number(slip.net_salary).toLocaleString()} {slip.currency}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${slip.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {slip.status === 'paid' ? (ar ? 'تم الصرف' : 'Paid') : (ar ? 'مسودة' : 'Draft')}
                            </span>
                          </td>
                          <td className="p-3">
                            {slip.status !== 'paid' ? (
                              <button type="button" disabled={saving} onClick={() => void payPlatformPayroll(slip.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-white font-bold hover:bg-emerald-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />{ar ? 'صرف وترحيل للمالية' : 'Pay & Post'}
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono">{slip.paid_at?.slice(0, 10) || '—'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>

          <section className="rounded-2xl border bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
              <h2 className="flex items-center gap-2 font-black text-sm"><FileClock className="h-4 w-4 text-purple-600" />{ar ? `طلبات إجازات فريق المنصة (${platformLeaves.length})` : `Platform Team Leaves (${platformLeaves.length})`}</h2>
              <button
                type="button"
                onClick={() => {
                  setLeaveForm({
                    user_id: platformTeamUsers[0]?.id || '',
                    leave_type: 'annual', start_date: new Date().toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10),
                    days_count: 1, reason: '',
                  });
                  setShowLeaveModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white"
              >
                <Plus className="h-4 w-4" />{ar ? 'تسجيل طلب إجازة' : 'New Leave Request'}
              </button>
            </div>
            {platformLeaves.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400">{ar ? 'لا توجد طلبات إجازة مسجلة لفريق المنصة.' : 'No platform team leave requests yet.'}</p>
            ) : (
              <>
                <div className="divide-y md:hidden">
                  {platformLeaves.map(lv => (
                    <article key={lv.id} className="p-4 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-slate-900">{userNameMap.get(lv.user_id) || lv.user_id.slice(0, 8)}</p>
                          <p className="text-[11px] text-slate-500">
                            {({ annual: ar ? 'سنوية' : 'Annual', sick: ar ? 'مرضية' : 'Sick', unpaid: ar ? 'بدون راتب' : 'Unpaid', emergency: ar ? 'عارضة' : 'Emergency' })[lv.leave_type]} · <span className="font-mono">{lv.start_date} → {lv.end_date} ({lv.days_count}d)</span>
                          </p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          lv.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : lv.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {({ pending: ar ? 'قيد المراجعة' : 'Pending', approved: ar ? 'معتمدة' : 'Approved', rejected: ar ? 'مرفوضة' : 'Rejected' })[lv.status]}
                        </span>
                      </div>
                      {lv.status === 'pending' && (
                        <div className="flex gap-2 pt-1">
                          <button type="button" onClick={() => void decidePlatformLeave(lv.id, 'approved')} className="rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white">{ar ? 'اعتماد' : 'Approve'}</button>
                          <button type="button" onClick={() => void decidePlatformLeave(lv.id, 'rejected')} className="rounded-lg border border-rose-200 px-3 py-1.5 font-bold text-rose-700">{ar ? 'رفض' : 'Reject'}</button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-50 font-bold">
                      <tr>
                        <th className="p-3 text-start">{ar ? 'الموظف' : 'Team Member'}</th>
                        <th className="p-3 text-start">{ar ? 'النوع' : 'Type'}</th>
                        <th className="p-3 text-start">{ar ? 'الفترة' : 'Dates'}</th>
                        <th className="p-3 text-start">{ar ? 'الأيام' : 'Days'}</th>
                        <th className="p-3 text-start">{ar ? 'الحالة' : 'Status'}</th>
                        <th className="p-3 text-start">{ar ? 'الإجراء' : 'Decision'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {platformLeaves.map(lv => (
                        <tr key={lv.id} className="border-t">
                          <td className="p-3 font-bold">{userNameMap.get(lv.user_id) || lv.user_id.slice(0, 8)}</td>
                          <td className="p-3">{({ annual: ar ? 'سنوية' : 'Annual', sick: ar ? 'مرضية' : 'Sick', unpaid: ar ? 'بدون راتب' : 'Unpaid', emergency: ar ? 'عارضة' : 'Emergency' })[lv.leave_type]}</td>
                          <td className="p-3 font-mono">{lv.start_date} → {lv.end_date}</td>
                          <td className="p-3 font-mono">{lv.days_count}</td>
                          <td className="p-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              lv.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : lv.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {({ pending: ar ? 'قيد المراجعة' : 'Pending', approved: ar ? 'معتمدة' : 'Approved', rejected: ar ? 'مرفوضة' : 'Rejected' })[lv.status]}
                            </span>
                          </td>
                          <td className="p-3">
                            {lv.status === 'pending' ? (
                              <div className="flex gap-1.5">
                                <button type="button" onClick={() => void decidePlatformLeave(lv.id, 'approved')} className="rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white">{ar ? 'اعتماد' : 'Approve'}</button>
                                <button type="button" onClick={() => void decidePlatformLeave(lv.id, 'rejected')} className="rounded-lg border border-rose-200 px-2.5 py-1 font-bold text-rose-700">{ar ? 'رفض' : 'Reject'}</button>
                              </div>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* MODALS */}
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
              <label className="text-xs font-bold">{ar ? 'الدور الوظيفي *' : 'Role *'}<select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value as AppRole })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">{platformScopedRoles.map(r => <option key={r} value={r}>{roleLabel(r)}</option>)}</select></label>
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
                <p>{ar ? `نوع المنشأة: ${getFacilityTypeLabel(facility.facility_type, ar)}` : `Facility type: ${getFacilityTypeLabel(facility.facility_type, ar)}`}</p>
                <p>{ar ? `الباقة المختارة: ${(plans.find(p => p.id === facility.plan_id)?.[ar ? 'name_ar' : 'name_en'] || (ar ? 'البداية الافتراضية' : 'Starter (Default)'))} — ${getBillingCycleLabel(facility.cycle, ar)}` : `Subscription Plan: ${(plans.find(p => p.id === facility.plan_id)?.name_en || 'Starter (Default)')} — ${getBillingCycleLabel(facility.cycle, ar)}`}</p>
                <p>{ar ? `التخصصات المفعلة (${facility.specialties.length}):` : `Enabled specialties (${facility.specialties.length}):`} {facility.specialties.map(code => { const sp = getSpecialtyByCode(code); return sp ? (ar ? sp.name_ar : sp.name_en) : code; }).join('، ')}</p>
                <p>{ar ? `حساب المالك: ${facility.owner_email}` : `Owner login: ${facility.owner_email}`}</p>
                <p>{facility.owner_password ? (ar ? 'التفعيل: فوري بكلمة مرور مباشرة (بدون انتظار البريد)' : 'Activation: Instant direct password') : (ar ? 'التفعيل: إرسال دعوة بريدية' : 'Activation: Email invite')}</p>
                <p className="text-xs font-bold text-amber-800">{ar ? 'سيتم تسجيل مطالبة مالية تلقائياً «قيد السداد» بقيمة الباقة في دفتر المالية للمنصة.' : 'A pending receivable entry for this plan will be auto-recorded in Platform Finance.'}</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold">{ar ? 'اسم المنشأة بالعربية' : 'Facility name (Arabic)'}<input required maxLength={255} value={facility.name_ar} onChange={event => setFacility({ ...facility, name_ar: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <label className="text-xs font-bold">{ar ? 'اسم المنشأة بالإنجليزية' : 'Facility name (English)'}<input required maxLength={255} value={facility.name_en} onChange={event => setFacility({ ...facility, name_en: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <label className="text-xs font-bold">{ar ? 'تصنيف المنشأة' : 'Facility classification'}<select value={facility.facility_type} onChange={event => setFacility({ ...facility, facility_type: event.target.value })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">{FACILITY_TYPES.map(type => <option key={type.value} value={type.value}>{ar ? type.label_ar : type.label_en}</option>)}</select></label>
                  <label className="text-xs font-bold">{ar ? 'البريد الرسمي للمنشأة' : 'Facility email'}<input required type="email" value={facility.email} onChange={event => setFacility({ ...facility, email: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <label className="text-xs font-bold">{ar ? 'الهاتف' : 'Phone'}<input required type="tel" maxLength={50} value={facility.phone} onChange={event => setFacility({ ...facility, phone: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <label className="text-xs font-bold">{ar ? 'المدينة' : 'City'}<input required maxLength={100} value={facility.city} onChange={event => setFacility({ ...facility, city: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <label className="text-xs font-bold">{ar ? 'باقة الاشتراك (تسجل قيد السداد)' : 'Subscription Plan (Pending Ledger)'}
                    <select value={facility.plan_id} onChange={event => setFacility({ ...facility, plan_id: event.target.value })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                      <option value="">{ar ? '— الباقة الأساسية الافتراضية (Starter) —' : '— Default Starter Plan —'}</option>
                      {plans.filter(p => p.is_active).map(p => (
                        <option key={p.id} value={p.id}>
                          {ar ? p.name_ar : p.name_en} ({Number(facility.cycle === 'annual' ? p.price_annual : p.price_monthly).toLocaleString()} {p.currency})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-bold">{ar ? 'دورة الفوترة' : 'Billing Cycle'}
                    <select value={facility.cycle} onChange={event => setFacility({ ...facility, cycle: event.target.value as 'monthly' | 'annual' })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                      <option value="monthly">{getBillingCycleLabel('monthly', ar)}</option>
                      <option value="annual">{getBillingCycleLabel('annual', ar)}</option>
                    </select>
                  </label>
                  <label className="text-xs font-bold sm:col-span-2">{ar ? 'العنوان' : 'Address'}<input required maxLength={500} value={facility.address} onChange={event => setFacility({ ...facility, address: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                  <div className="sm:col-span-2 pt-1">
                    <SpecialtySelector
                      selected={facility.specialties}
                      onChange={next => setFacility({ ...facility, specialties: next })}
                      facilityType={facility.facility_type}
                      ar={ar}
                    />
                  </div>
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
              <div className="space-y-2 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <p>{editingFacility.name_ar} — {editingFacility.email}</p>
                <p>{getFacilityTypeLabel(editingFacility.facility_type, ar)}</p>
                <p>{ar ? 'التخصصات:' : 'Specialties:'} {(editingFacility.specialties || ['general_practice']).map(code => { const sp = getSpecialtyByCode(code); return sp ? (ar ? sp.name_ar : sp.name_en) : code; }).join('، ')}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">{ar ? 'اسم المنشأة بالعربية' : 'Facility name (Arabic)'}<input required maxLength={255} value={editingFacility.name_ar} onChange={event => setEditingFacility({ ...editingFacility, name_ar: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold">{ar ? 'اسم المنشأة بالإنجليزية' : 'Facility name (English)'}<input required maxLength={255} value={editingFacility.name_en} onChange={event => setEditingFacility({ ...editingFacility, name_en: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold">{ar ? 'تصنيف المنشأة' : 'Facility classification'}<select value={editingFacility.facility_type} onChange={event => setEditingFacility({ ...editingFacility, facility_type: event.target.value as Organization['facility_type'] })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">{FACILITY_TYPES.map(type => <option key={type.value} value={type.value}>{ar ? type.label_ar : type.label_en}</option>)}</select></label>
                <label className="text-xs font-bold">{ar ? 'البريد الرسمي للمنشأة' : 'Facility email'}<input required type="email" value={editingFacility.email} onChange={event => setEditingFacility({ ...editingFacility, email: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold">{ar ? 'الهاتف' : 'Phone'}<input required maxLength={50} value={editingFacility.phone} onChange={event => setEditingFacility({ ...editingFacility, phone: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold">{ar ? 'المدينة' : 'City'}<input required maxLength={100} value={editingFacility.city} onChange={event => setEditingFacility({ ...editingFacility, city: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <label className="text-xs font-bold sm:col-span-2">{ar ? 'العنوان' : 'Address'}<input required maxLength={500} value={editingFacility.address || ''} onChange={event => setEditingFacility({ ...editingFacility, address: event.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
                <div className="sm:col-span-2 pt-1">
                  <SpecialtySelector
                    selected={Array.isArray(editingFacility.specialties) && editingFacility.specialties.length > 0 ? editingFacility.specialties : ['general_practice']}
                    onChange={next => setEditingFacility({ ...editingFacility, specialties: next })}
                    facilityType={editingFacility.facility_type}
                    ar={ar}
                  />
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={() => confirmFacilityUpdate ? setConfirmFacilityUpdate(false) : setEditingFacility(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'رجوع' : 'Back'}</button><button disabled={saving} className="rounded-xl bg-medicore-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? '...' : confirmFacilityUpdate ? (ar ? 'تأكيد وحفظ' : 'Confirm and save') : (ar ? 'مراجعة التعديل' : 'Review changes')}</button></div>
          </form>
        </div>
      )}

      {deleteCandidate && (
        <div className="fixed inset-0 z-[58] grid place-items-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black text-rose-700">{ar ? 'تأكيد الحذف النهائي للمنشأة' : 'Confirm Permanent Facility Deletion'}</h2>
            <div className="rounded-xl bg-rose-50 p-4 text-xs leading-6 text-rose-950 space-y-1">
              <p className="font-black text-sm">{ar ? deleteCandidate.name_ar : deleteCandidate.name_en} ({deleteCandidate.email})</p>
              <p>
                {ar
                  ? `سيتم حذف المنشأة وجميع سجلاتها نهائياً: ${deleteOrgMetrics?.branches_count ?? (deleteCandidate.branches?.length || 0)} فرع، ${deleteOrgMetrics?.users_count ?? 0} مستخدم (بما في ذلك تسجيل الدخول)، ${deleteOrgMetrics?.patients_count ?? 0} مريض، ${deleteOrgMetrics?.appointments_count ?? 0} موعد، ${deleteOrgMetrics?.invoices_count ?? 0} فاتورة، وملفات المرفقات.`
                  : `This permanently removes the facility and all linked records: ${deleteOrgMetrics?.branches_count ?? (deleteCandidate.branches?.length || 0)} branch(es), ${deleteOrgMetrics?.users_count ?? 0} user account(s), ${deleteOrgMetrics?.patients_count ?? 0} patient(s), ${deleteOrgMetrics?.appointments_count ?? 0} appointment(s), ${deleteOrgMetrics?.invoices_count ?? 0} invoice(s), and attachments.`}
              </p>
            </div>
            <label className="flex items-start gap-2 text-xs font-bold text-slate-700">
              <input type="checkbox" checked={deleteAcknowledge} onChange={e => setDeleteAcknowledge(e.target.checked)} className="mt-0.5" />
              <span>{ar ? 'أؤكد أن هذا الإجراء نهائي ولا يمكن التراجع عنه.' : 'I confirm this permanent deletion cannot be undone.'}</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setDeleteCandidate(null); setDeleteAcknowledge(false); }} disabled={saving} className="rounded-xl border px-4 py-2 text-sm font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button type="button" onClick={() => void confirmDeleteFacility()} disabled={saving || !deleteAcknowledge} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">{saving ? '...' : (ar ? 'حذف المنشأة نهائياً' : 'Delete permanently')}</button>
            </div>
          </section>
        </div>
      )}

      {editingSub && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={saveSubscription} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">{ar ? 'تحديث اشتراك المنشأة' : 'Update Subscription'}</h2>
              <button type="button" onClick={() => setEditingSub(null)}><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs font-bold text-slate-500">{editingSub.organization_name}</p>
            <label className="block text-xs font-bold">
              {ar ? 'الباقة' : 'Plan'}
              <select value={editingSub.plan_id} onChange={e => setEditingSub({ ...editingSub, plan_id: e.target.value })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                {plans.map(p => <option key={p.id} value={p.id}>{ar ? p.name_ar : p.name_en} ({p.price_monthly} {p.currency})</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold">
                {ar ? 'الحالة' : 'Status'}
                <select value={editingSub.status} onChange={e => setEditingSub({ ...editingSub, status: e.target.value as SubscriptionStatus })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                  {(['trialing', 'active', 'past_due', 'canceled', 'expired', 'suspended'] as SubscriptionStatus[]).map(s => <option key={s} value={s}>{getSubscriptionStatusLabel(s, ar)}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold">
                {ar ? 'الدورة' : 'Cycle'}
                <select value={editingSub.cycle} onChange={e => setEditingSub({ ...editingSub, cycle: e.target.value as BillingCycle })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                  {(['monthly', 'annual', 'lifetime', 'trial'] as BillingCycle[]).map(c => <option key={c} value={c}>{getBillingCycleLabel(c, ar)}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs font-bold">
              {ar ? 'نهاية الفترة' : 'Period End'}
              <input type="date" value={editingSub.current_period_end} onChange={e => setEditingSub({ ...editingSub, current_period_end: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" />
            </label>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={() => setEditingSub(null)} className="rounded-xl border px-4 py-2 text-xs font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button disabled={saving} className="rounded-xl bg-medicore-600 px-4 py-2 text-xs font-bold text-white">{saving ? '...' : (ar ? 'حفظ التغييرات' : 'Save')}</button>
            </div>
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

      {showAnnModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={createAnnouncement} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h2 className="text-lg font-black">{ar ? 'نشر إعلان نظام' : 'Publish System Announcement'}</h2><button type="button" onClick={() => setShowAnnModal(false)}><X className="h-4 w-4" /></button></div>
            <label className="block text-xs font-bold">{ar ? 'العنوان بالعربية *' : 'Title (Arabic) *'}<input required value={annForm.title_ar} onChange={e => setAnnForm({ ...annForm, title_ar: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
            <label className="block text-xs font-bold">{ar ? 'العنوان بالإنجليزية' : 'Title (English)'}<input value={annForm.title_en} onChange={e => setAnnForm({ ...annForm, title_en: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
            <label className="block text-xs font-bold">{ar ? 'الأهمية' : 'Severity'}<select value={annForm.severity} onChange={e => setAnnForm({ ...annForm, severity: e.target.value as 'info' | 'warning' | 'maintenance' })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm"><option value="info">{getAnnouncementSeverityLabel('info', ar)}</option><option value="warning">{getAnnouncementSeverityLabel('warning', ar)}</option><option value="maintenance">{getAnnouncementSeverityLabel('maintenance', ar)}</option></select></label>
            <label className="block text-xs font-bold">{ar ? 'نص الإعلان بالعربية *' : 'Body (Arabic) *'}<textarea required rows={3} value={annForm.body_ar} onChange={e => setAnnForm({ ...annForm, body_ar: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowAnnModal(false)} className="rounded-xl border px-4 py-2 text-xs font-bold">{ar ? 'إلغاء' : 'Cancel'}</button><button disabled={saving} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white">{ar ? 'نشر' : 'Publish'}</button></div>
          </form>
        </div>
      )}

      {editingPlan && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={savePlan} className="max-h-[92vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">{editingPlan.id ? (ar ? 'تعديل باقة الاشتراك وحدودها' : 'Edit Subscription Plan & Quotas') : (ar ? 'إضافة باقة اشتراك جديدة' : 'Create New Subscription Plan')}</h2>
              <button type="button" onClick={() => setEditingPlan(null)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">{ar ? 'اسم الباقة بالعربية *' : 'Plan Name (Arabic) *'}<input required value={editingPlan.name_ar} onChange={e => setEditingPlan({ ...editingPlan, name_ar: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <label className="text-xs font-bold">{ar ? 'اسم الباقة بالإنجليزية *' : 'Plan Name (English) *'}<input required value={editingPlan.name_en} onChange={e => setEditingPlan({ ...editingPlan, name_en: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <label className="text-xs font-bold">{ar ? 'المعرّف المختصر (Slug)' : 'Slug'}<input value={editingPlan.slug} onChange={e => setEditingPlan({ ...editingPlan, slug: e.target.value })} placeholder="custom_clinic_pro" className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
              <label className="text-xs font-bold">{ar ? 'الفئة (Tier)' : 'Tier'}<select value={editingPlan.tier} onChange={e => setEditingPlan({ ...editingPlan, tier: e.target.value as SubscriptionPlan['tier'] })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm"><option value="starter">{ar ? 'الأساسية (Starter)' : 'Starter'}</option><option value="professional">{ar ? 'الاحترافية (Professional)' : 'Professional'}</option><option value="medical_center">{ar ? 'المراكز الطبية (Medical Center)' : 'Medical Center'}</option><option value="enterprise">{ar ? 'المؤسسات الكبرى (Enterprise)' : 'Enterprise'}</option></select></label>
              <label className="text-xs font-bold">{ar ? 'السعر الشهري' : 'Monthly Price'}<input type="number" min="0" step="0.01" value={editingPlan.price_monthly} onChange={e => setEditingPlan({ ...editingPlan, price_monthly: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
              <label className="text-xs font-bold">{ar ? 'السعر السنوي' : 'Annual Price'}<input type="number" min="0" step="0.01" value={editingPlan.price_annual} onChange={e => setEditingPlan({ ...editingPlan, price_annual: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
            </div>

            <div className="rounded-xl border bg-slate-50 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-800">{ar ? 'حدود الباقة (أدخل 0 لجعل الحد مفتوحاً / Unlimited)' : 'Plan Quotas (0 = Unlimited)'}</span>
                <label className="flex items-center gap-2 text-xs font-bold text-indigo-900">
                  <input type="checkbox" checked={editingPlan.allow_branches} onChange={e => setEditingPlan({ ...editingPlan, allow_branches: e.target.checked, max_branches: e.target.checked ? Math.max(2, editingPlan.max_branches) : 1 })} />
                  <span>{ar ? 'هل الباقة تستقبل فروع متعددة؟' : 'Allow multiple branches?'}</span>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="text-xs font-bold">{ar ? 'عدد الفروع' : 'Max Branches'}<input type="number" min={editingPlan.allow_branches ? 2 : 1} disabled={!editingPlan.allow_branches} value={editingPlan.allow_branches ? editingPlan.max_branches : 1} onChange={e => setEditingPlan({ ...editingPlan, max_branches: Number(e.target.value) })} className="mt-1 w-full rounded-xl border bg-white p-2 text-sm font-mono disabled:bg-slate-200" /></label>
                <label className="text-xs font-bold">{ar ? 'عدد الأطباء' : 'Max Doctors'}<input type="number" min="0" value={editingPlan.max_doctors} onChange={e => setEditingPlan({ ...editingPlan, max_doctors: Number(e.target.value) })} className="mt-1 w-full rounded-xl border bg-white p-2 text-sm font-mono" /></label>
                <label className="text-xs font-bold">{ar ? 'عدد المستخدمين' : 'Max Users'}<input type="number" min="0" value={editingPlan.max_users} onChange={e => setEditingPlan({ ...editingPlan, max_users: Number(e.target.value) })} className="mt-1 w-full rounded-xl border bg-white p-2 text-sm font-mono" /></label>
                <label className="text-xs font-bold">{ar ? 'عدد المرضى' : 'Max Patients'}<input type="number" min="0" value={editingPlan.max_patients} onChange={e => setEditingPlan({ ...editingPlan, max_patients: Number(e.target.value) })} className="mt-1 w-full rounded-xl border bg-white p-2 text-sm font-mono" /></label>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 text-xs font-bold text-slate-700">
              {([
                ['has_laboratory', ar ? 'وحدة المختبر والتحاليل' : 'Laboratory Module'],
                ['has_radiology', ar ? 'وحدة الأشعة والتصوير' : 'Radiology Module'],
                ['has_inventory', ar ? 'الصيدلية والمخزون' : 'Inventory & Pharmacy'],
                ['has_insurance', ar ? 'التأمين الطبي والمطالبات' : 'Insurance & Claims'],
                ['has_specialty_canvas', ar ? 'التخصصات التفاعلية 3D' : '3D Specialty Suite'],
                ['has_accounting_ledger', ar ? 'المحاسبة والخزينة والعمولات' : 'Accounting & Commissions'],
                ['has_patient_portal', ar ? 'بوابة المريض' : 'Patient Portal'],
                ['has_dedicated_db', ar ? 'نشر مخصص للمؤسسات' : 'Dedicated Enterprise DB'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-lg border p-2">
                  <input type="checkbox" checked={editingPlan[key]} onChange={e => setEditingPlan({ ...editingPlan, [key]: e.target.checked })} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={editingPlan.is_active} onChange={e => setEditingPlan({ ...editingPlan, is_active: e.target.checked })} /><span>{ar ? 'الباقة مفعّلة ومتاحة للاشتراك' : 'Plan Active'}</span></label>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={() => setEditingPlan(null)} className="rounded-xl border px-4 py-2 text-xs font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button disabled={saving} className="rounded-xl bg-medicore-600 px-4 py-2 text-xs font-bold text-white">{saving ? '...' : (ar ? 'حفظ الباقة في السحابة' : 'Save Plan')}</button>
            </div>
          </form>
        </div>
      )}

      {deletePlanCandidate && (
        <div className="fixed inset-0 z-[58] grid place-items-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black text-rose-700">{ar ? 'تأكيد حذف الباقة' : 'Confirm Plan Deletion'}</h2>
            <p className="text-xs leading-6 text-slate-700">
              {ar
                ? `هل تريد حذف باقة «${deletePlanCandidate.name_ar}»؟ (سيتم منع الحذف تلقائياً إذا كانت الباقة مرتبطة بأي منشأة حالياً).`
                : `Delete plan “${deletePlanCandidate.name_en}”? Deletion is automatically blocked if any facility is currently subscribed to this plan.`}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeletePlanCandidate(null)} disabled={saving} className="rounded-xl border px-4 py-2 text-xs font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button type="button" onClick={() => void confirmDeletePlan()} disabled={saving} className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white">{saving ? '...' : (ar ? 'حذف الباقة' : 'Delete Plan')}</button>
            </div>
          </section>
        </div>
      )}

      {showTxModal && (
        <div className="fixed inset-0 z-[58] grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={recordPlatformTx} className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">{ar ? 'تسجيل قيد مالي جديد للمنصة' : 'Record Platform Transaction'}</h2>
              <button type="button" onClick={() => setShowTxModal(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">{ar ? 'نوع الحركة *' : 'Type *'}
                <select value={txForm.transaction_type} onChange={e => setTxForm({ ...txForm, transaction_type: e.target.value as PlatformTransaction['transaction_type'] })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                  <option value="subscription_income">{ar ? 'إيراد اشتراك' : 'Subscription Income'}</option>
                  <option value="operating_expense">{ar ? 'مصروف تشغيلي' : 'Operating Expense'}</option>
                  <option value="adjustment">{ar ? 'تسوية مالية' : 'Adjustment'}</option>
                </select>
              </label>
              <label className="text-xs font-bold">{ar ? 'التصنيف *' : 'Category *'}<input required value={txForm.category} onChange={e => setTxForm({ ...txForm, category: e.target.value })} placeholder="Hosting / Subscriptions" className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              {txForm.transaction_type === 'subscription_income' && (
                <label className="text-xs font-bold">{ar ? 'حالة التحصيل' : 'Collection Status'}
                  <select value={txForm.status} onChange={e => setTxForm({ ...txForm, status: e.target.value as 'paid' | 'pending' })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                    <option value="paid">{ar ? 'تم السداد / محصّل' : 'Paid / Collected'}</option>
                    <option value="pending">{ar ? 'قيد السداد' : 'Pending Collection'}</option>
                  </select>
                </label>
              )}
              {(txForm.status === 'paid' || txForm.transaction_type !== 'subscription_income') && (
                <label className="text-xs font-bold">{ar ? 'وسيلة الدفع / التحصيل *' : 'Payment Method *'}
                  <select value={txForm.payment_method} onChange={e => setTxForm({ ...txForm, payment_method: e.target.value })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                    <option value="cash">{getPaymentModeLabel('cash', ar)}</option>
                    <option value="instapay">{getPaymentModeLabel('instapay', ar)}</option>
                    <option value="wallet">{getPaymentModeLabel('wallet', ar)}</option>
                    <option value="vodafone_cash">{getPaymentModeLabel('vodafone_cash', ar)}</option>
                    <option value="fawry">{getPaymentModeLabel('fawry', ar)}</option>
                    <option value="credit_card">{getPaymentModeLabel('credit_card', ar)}</option>
                    <option value="bank_transfer">{getPaymentModeLabel('bank_transfer', ar)}</option>
                  </select>
                </label>
              )}
              <label className="text-xs font-bold sm:col-span-2">{ar ? 'وصف الحركة *' : 'Title *'}<input required value={txForm.title} onChange={e => setTxForm({ ...txForm, title: e.target.value })} placeholder={ar ? 'مثال: تجديد باقة عيادة أو فاتورة استضافة سحابية' : 'e.g. Monthly subscription settlement'} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
              <label className="text-xs font-bold">{ar ? 'المبلغ *' : 'Amount *'}<input required type="number" min="0.01" step="0.01" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
              <label className="text-xs font-bold">{ar ? 'العملة' : 'Currency'}<input value={txForm.currency} onChange={e => setTxForm({ ...txForm, currency: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
              <label className="text-xs font-bold">{ar ? 'التاريخ *' : 'Date *'}<input required type="date" value={txForm.transaction_date} onChange={e => setTxForm({ ...txForm, transaction_date: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
              <label className="text-xs font-bold">{ar ? 'رقم مرجعي' : 'Reference No'}<input value={txForm.reference_no} onChange={e => setTxForm({ ...txForm, reference_no: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
              <label className="text-xs font-bold sm:col-span-2">{ar ? 'المنشأة المرتبطة (اختياري)' : 'Linked Facility (Optional)'}
                <select value={txForm.organization_id} onChange={e => setTxForm({ ...txForm, organization_id: e.target.value })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                  <option value="">{ar ? '— مصروف/إيراد عام للمنصة —' : '— General Platform —'}</option>
                  {organizations.map(o => <option key={o.id} value={o.id}>{ar ? o.name_ar : o.name_en}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={() => setShowTxModal(false)} className="rounded-xl border px-4 py-2 text-xs font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button disabled={saving} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">{saving ? '...' : (ar ? 'حفظ في السحابة' : 'Save Transaction')}</button>
            </div>
          </form>
        </div>
      )}

      {collectingTx && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={markPlatformTxPaid} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">{ar ? 'تأكيد تحصيل قيد مالي' : 'Confirm Payment Collection'}</h2>
              <button type="button" onClick={() => setCollectingTx(null)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="rounded-xl bg-amber-50 p-3 text-xs space-y-1 text-amber-950">
              <p className="font-black">{collectingTx.title}</p>
              <p className="font-mono font-bold text-sm">{Number(collectingTx.amount).toLocaleString()} {collectingTx.currency}</p>
            </div>
            <div className="grid gap-3">
              <label className="text-xs font-bold">{ar ? 'وسيلة التحصيل *' : 'Collection Method *'}
                <select required value={collectMethod} onChange={e => setCollectMethod(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                  <option value="instapay">{getPaymentModeLabel('instapay', ar)}</option>
                  <option value="cash">{getPaymentModeLabel('cash', ar)}</option>
                  <option value="wallet">{getPaymentModeLabel('wallet', ar)}</option>
                  <option value="vodafone_cash">{getPaymentModeLabel('vodafone_cash', ar)}</option>
                  <option value="fawry">{getPaymentModeLabel('fawry', ar)}</option>
                  <option value="credit_card">{getPaymentModeLabel('credit_card', ar)}</option>
                  <option value="bank_transfer">{getPaymentModeLabel('bank_transfer', ar)}</option>
                </select>
              </label>
              <label className="text-xs font-bold">{ar ? 'رقم العملية / المرجع (اختياري)' : 'Reference / Receipt No (Optional)'}
                <input value={collectRef} onChange={e => setCollectRef(e.target.value)} placeholder="INSTA-88421" className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" />
              </label>
              <label className="text-xs font-bold">{ar ? 'ملاحظات التحصيل (اختياري)' : 'Notes (Optional)'}
                <input value={collectNotes} onChange={e => setCollectNotes(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm" />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={() => setCollectingTx(null)} className="rounded-xl border px-4 py-2 text-xs font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">
                <CheckCircle2 className="h-4 w-4" />{saving ? '...' : (ar ? 'تأكيد السداد والتحصيل' : 'Confirm Collection')}
              </button>
            </div>
          </form>
        </div>
      )}

      {showPayrollModal && (
        <div className="fixed inset-0 z-[58] grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={savePlatformPayroll} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">{ar ? 'إعداد مسير راتب لفريق المنصة' : 'New Platform Payroll Slip'}</h2>
              <button type="button" onClick={() => setShowPayrollModal(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs font-bold">{ar ? 'عضو فريق المنصة *' : 'Platform Staff *'}
                <select required value={payrollForm.user_id} onChange={e => setPayrollForm({ ...payrollForm, user_id: e.target.value })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                  <option value="">{ar ? '-- اختر الحساب --' : '-- Select Member --'}</option>
                  {platformTeamUsers.map(u => <option key={u.id} value={u.id}>{ar ? u.name_ar : u.name_en} ({roleLabel(u.role)})</option>)}
                </select>
              </label>
              <label className="text-xs font-bold">{ar ? 'الشهر (YYYY-MM) *' : 'Month (YYYY-MM) *'}<input required pattern="\d{4}-\d{2}" value={payrollForm.period_month} onChange={e => setPayrollForm({ ...payrollForm, period_month: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs font-bold">{ar ? 'الأساسي' : 'Base'}<input required type="number" min="0" step="0.01" value={payrollForm.base_salary} onChange={e => setPayrollForm({ ...payrollForm, base_salary: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2 text-sm font-mono" /></label>
                <label className="text-xs font-bold">{ar ? 'حوافز' : 'Bonuses'}<input type="number" min="0" step="0.01" value={payrollForm.bonuses} onChange={e => setPayrollForm({ ...payrollForm, bonuses: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2 text-sm font-mono" /></label>
                <label className="text-xs font-bold">{ar ? 'استقطاع' : 'Deductions'}<input type="number" min="0" step="0.01" value={payrollForm.deductions} onChange={e => setPayrollForm({ ...payrollForm, deductions: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2 text-sm font-mono" /></label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={() => setShowPayrollModal(false)} className="rounded-xl border px-4 py-2 text-xs font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">{saving ? '...' : (ar ? 'حفظ المسير' : 'Save Slip')}</button>
            </div>
          </form>
        </div>
      )}

      {showLeaveModal && (
        <div className="fixed inset-0 z-[58] grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={savePlatformLeave} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">{ar ? 'طلب إجازة لفريق المنصة' : 'Platform Team Leave Request'}</h2>
              <button type="button" onClick={() => setShowLeaveModal(false)} className="rounded-lg p-2 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs font-bold">{ar ? 'عضو فريق المنصة *' : 'Platform Staff *'}
                <select required value={leaveForm.user_id} onChange={e => setLeaveForm({ ...leaveForm, user_id: e.target.value })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                  <option value="">{ar ? '-- اختر الحساب --' : '-- Select Member --'}</option>
                  {platformTeamUsers.map(u => <option key={u.id} value={u.id}>{ar ? u.name_ar : u.name_en}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-bold">{ar ? 'النوع *' : 'Leave Type *'}
                  <select value={leaveForm.leave_type} onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value as PlatformLeaveRequest['leave_type'] })} className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm">
                    <option value="annual">{ar ? 'سنوية' : 'Annual'}</option>
                    <option value="sick">{ar ? 'مرضية' : 'Sick'}</option>
                    <option value="emergency">{ar ? 'عارضة' : 'Emergency'}</option>
                    <option value="unpaid">{ar ? 'بدون راتب' : 'Unpaid'}</option>
                  </select>
                </label>
                <label className="text-xs font-bold">{ar ? 'عدد الأيام *' : 'Days *'}<input required type="number" min="1" value={leaveForm.days_count} onChange={e => setLeaveForm({ ...leaveForm, days_count: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
                <label className="text-xs font-bold">{ar ? 'من *' : 'Start *'}<input required type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
                <label className="text-xs font-bold">{ar ? 'إلى *' : 'End *'}<input required type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm font-mono" /></label>
              </div>
              <label className="text-xs font-bold">{ar ? 'السبب' : 'Reason'}<input value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} className="mt-1 w-full rounded-xl border p-2.5 text-sm" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button type="button" onClick={() => setShowLeaveModal(false)} className="rounded-xl border px-4 py-2 text-xs font-bold">{ar ? 'إلغاء' : 'Cancel'}</button>
              <button disabled={saving} className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white">{saving ? '...' : (ar ? 'حفظ الطلب' : 'Submit Leave')}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};
