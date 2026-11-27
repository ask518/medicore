// ============================================================================
// MEDICORE – Human Resources, Payroll, Leave Requests & Operating Expenses
// Server-Enforced Approval, Cashbox-Linked Payroll Payout & Doctor Commissions
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { LeaveType } from '../../types/database';
import {
  Briefcase,
  Plus,
  CheckCircle2,
  XCircle,
  Wallet,
  Calendar,
  DollarSign,
  Receipt,
  RefreshCw,
  AlertTriangle,
  X,
} from 'lucide-react';

interface StaffDirectoryItem {
  id: string;
  name_ar: string;
  name_en: string;
  role: string;
  primary_branch_id?: string | null;
}

interface PayrollRow {
  id: string;
  branch_id: string;
  user_id: string;
  month: string;
  base_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  payment_status: 'draft' | 'approved' | 'paid';
  payment_date?: string | null;
  payment_method?: string | null;
  expense_id?: string | null;
  notes?: string | null;
}

interface LeaveRow {
  id: string;
  user_id: string;
  leave_type: LeaveType;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string | null;
  created_at: string;
}

interface ExpenseRow {
  id: string;
  branch_id: string;
  category: string;
  title: string;
  amount: number;
  expense_date: string;
  vendor_name?: string | null;
  notes?: string | null;
}

interface CommissionRow {
  id: string;
  amount: number;
  commission_date: string;
  is_settled: boolean;
  settlement_reference?: string | null;
  doctor?: { user?: { name_ar?: string; name_en?: string } | null } | null;
}

interface CashboxOption {
  id: string;
  name: string;
  current_balance: number;
}

const EXPENSE_CATEGORIES = [
  'Salaries',
  'Rent',
  'Utilities',
  'Medical Supplies',
  'Maintenance',
  'Marketing',
  'Other',
];

const LEAVE_TYPES: LeaveType[] = ['annual', 'sick', 'casual', 'unpaid', 'maternity', 'emergency'];

export const HR: React.FC = () => {
  const { user, organization, activeBranch, can } = useAuth();
  const { locale } = useLanguage();
  const { success, error } = useToast();
  const ar = locale === 'ar';

  const orgId = organization?.id || '';
  const branchId = activeBranch?.id || '';
  const currency = organization?.default_currency || 'EGP';
  const role = user?.role || '';

  const canView = can('hr', 'view');
  const canManagePayroll = ['super_admin', 'org_owner', 'general_manager', 'branch_manager', 'accountant'].includes(role);
  const canApprovePayroll = ['super_admin', 'org_owner', 'general_manager', 'accountant'].includes(role);
  const canDecideLeave = ['super_admin', 'org_owner', 'general_manager', 'medical_director', 'branch_manager'].includes(role);

  const [activeTab, setActiveTab] = useState<'payroll' | 'leaves' | 'expenses' | 'commissions'>('payroll');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [staff, setStaff] = useState<StaffDirectoryItem[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [cashboxes, setCashboxes] = useState<CashboxOption[]>([]);

  // Payroll Draft Modal
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [payUserId, setPayUserId] = useState('');
  const [payBase, setPayBase] = useState('0');
  const [payAllowances, setPayAllowances] = useState('0');
  const [payDeductions, setPayDeductions] = useState('0');
  const [payNotes, setPayNotes] = useState('');

  // Pay Payout Modal
  const [payoutTarget, setPayoutTarget] = useState<PayrollRow | null>(null);
  const [payoutMethod, setPayoutMethod] = useState<'cash' | 'bank_transfer' | 'cheque'>('bank_transfer');
  const [payoutCashboxId, setPayoutCashboxId] = useState('');

  // Leave Modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveEmployeeId, setLeaveEmployeeId] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [leaveStart, setLeaveStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveEnd, setLeaveEnd] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState('');

  // Expense Modal
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expCategory, setExpCategory] = useState('Utilities');
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expVendor, setExpVendor] = useState('');
  const [expCashboxId, setExpCashboxId] = useState('');
  const [expNotes, setExpNotes] = useState('');

  const loadData = useCallback(async () => {
    if (!supabase || !orgId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const staffPromise = canManagePayroll || canDecideLeave
        ? supabase.rpc('get_hr_staff_directory', { p_organization_id: orgId })
        : Promise.resolve({
            data: user
              ? [{ id: user.id, name_ar: user.name_ar, name_en: user.name_en, role: user.role, primary_branch_id: user.primary_branch_id }]
              : [],
            error: null,
          });

      let payrollQuery = supabase
        .from('payroll_slips')
        .select('*')
        .eq('organization_id', orgId)
        .eq('month', selectedMonth)
        .order('created_at', { ascending: false });
      if (branchId) payrollQuery = payrollQuery.eq('branch_id', branchId);

      let expenseQuery = supabase
        .from('expenses')
        .select('*')
        .eq('organization_id', orgId)
        .order('expense_date', { ascending: false })
        .limit(100);
      if (branchId) expenseQuery = expenseQuery.eq('branch_id', branchId);

      const cashboxQuery = branchId
        ? supabase.from('cashboxes').select('id,name,current_balance').eq('organization_id', orgId).eq('branch_id', branchId).eq('is_active', true)
        : Promise.resolve({ data: [], error: null });

      const commissionQuery = canManagePayroll
        ? supabase
            .from('doctor_commissions')
            .select('id,amount,commission_date,is_settled,settlement_reference,doctor:doctors(user:users(name_ar,name_en))')
            .eq('organization_id', orgId)
            .order('commission_date', { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [], error: null });

      const [staffRes, payRes, leaveRes, expRes, boxRes, commRes] = await Promise.all([
        staffPromise,
        payrollQuery,
        supabase.from('leave_requests').select('*').eq('organization_id', orgId).order('created_at', { ascending: false }).limit(100),
        expenseQuery,
        cashboxQuery,
        commissionQuery,
      ]);

      if (payRes.error) throw payRes.error;
      if (leaveRes.error) throw leaveRes.error;

      const staffList = (staffRes.data || []) as StaffDirectoryItem[];
      setStaff(staffList);
      setPayrolls((payRes.data || []) as PayrollRow[]);
      setLeaves((leaveRes.data || []) as LeaveRow[]);
      setExpenses((expRes.data || []) as ExpenseRow[]);
      const boxes = (boxRes.data || []) as CashboxOption[];
      setCashboxes(boxes);
      setCommissions((commRes.data || []) as unknown as CommissionRow[]);

      if (staffList.length && !payUserId) setPayUserId(staffList[0].id);
      if (user?.id && !leaveEmployeeId) setLeaveEmployeeId(user.id);
      if (boxes.length && !expCashboxId) setExpCashboxId(boxes[0].id);
      if (boxes.length && !payoutCashboxId) setPayoutCashboxId(boxes[0].id);
    } catch (err) {
      console.error('HR load error:', err);
      error(ar ? 'تعذر تحميل بيانات الموارد البشرية.' : 'Unable to load HR data.');
    } finally {
      setLoading(false);
    }
  }, [orgId, branchId, selectedMonth, canView, canManagePayroll, canDecideLeave, user, ar, error, payUserId, leaveEmployeeId, expCashboxId, payoutCashboxId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const staffNameMap = useMemo(() => {
    const map = new Map<string, StaffDirectoryItem>();
    for (const s of staff) map.set(s.id, s);
    return map;
  }, [staff]);

  const stats = useMemo(() => {
    const totalPayroll = payrolls.reduce((sum, s) => sum + Number(s.net_salary || 0), 0);
    const paidPayroll = payrolls.filter((s) => s.payment_status === 'paid').reduce((sum, s) => sum + Number(s.net_salary || 0), 0);
    const pendingLeaves = leaves.filter((l) => l.status === 'pending').length;
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return { totalPayroll, paidPayroll, pendingLeaves, totalExpenses };
  }, [payrolls, leaves, expenses]);

  const createPayrollDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !orgId || !branchId || !payUserId) {
      error(ar ? 'اختر فرعاً نشطاً وموظفاً.' : 'Select an active branch and employee.');
      return;
    }
    const base = Number(payBase);
    const allow = Number(payAllowances);
    const ded = Number(payDeductions);
    if (![base, allow, ded].every((n) => Number.isFinite(n) && n >= 0)) {
      error(ar ? 'القيم المالية يجب أن تكون موجبة أو صفراً.' : 'Salary values must be non-negative numbers.');
      return;
    }
    setSaving(true);
    try {
      const { error: insErr } = await supabase.from('payroll_slips').insert({
        organization_id: orgId,
        branch_id: branchId,
        user_id: payUserId,
        month: selectedMonth,
        base_salary: base,
        allowances: allow,
        deductions: ded,
        net_salary: Math.max(0, base + allow - ded),
        payment_status: 'draft',
        notes: payNotes.trim() || null,
      });
      if (insErr) throw insErr;

      success(ar ? 'تم إنشاء مسودة الراتب بنجاح.' : 'Payroll draft created.');
      setShowPayrollModal(false);
      setPayNotes('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      error(
        msg.includes('unique') || msg.includes('duplicate')
          ? ar
            ? 'يوجد كشف راتب مسجل لهذا الموظف في نفس الشهر.'
            : 'Payroll slip already exists for this employee and month.'
          : ar
          ? 'تعذر إنشاء كشف الراتب.'
          : 'Failed to create payroll draft.'
      );
    } finally {
      setSaving(false);
    }
  };

  const approveSlip = async (slipId: string) => {
    if (!supabase) return;
    setSaving(true);
    try {
      const { error: rpcErr } = await supabase.rpc('approve_payroll_slip', { p_slip_id: slipId });
      if (rpcErr) throw rpcErr;
      success(ar ? 'تم اعتماد كشف الراتب.' : 'Payroll slip approved.');
      await loadData();
    } catch {
      error(ar ? 'تعذر اعتماد الراتب.' : 'Could not approve payroll slip.');
    } finally {
      setSaving(false);
    }
  };

  const paySlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !payoutTarget) return;
    setSaving(true);
    try {
      const { error: rpcErr } = await supabase.rpc('pay_payroll_slip', {
        p_slip_id: payoutTarget.id,
        p_payment_method: payoutMethod,
        p_cashbox_id: payoutMethod === 'cash' ? payoutCashboxId || null : null,
      });
      if (rpcErr) throw rpcErr;
      success(ar ? 'تم صرف الراتب وتسجيله في المصروفات.' : 'Payroll disbursed and recorded in expenses.');
      setPayoutTarget(null);
      await loadData();
    } catch {
      error(ar ? 'تعذر صرف الراتب. تأكد من الخزينة والصلاحية.' : 'Payroll payout failed.');
    } finally {
      setSaving(false);
    }
  };

  const submitLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !orgId || !leaveStart || !leaveEnd || !leaveReason.trim()) {
      error(ar ? 'أكمل تواريخ الإجازة والسبب.' : 'Complete dates and reason.');
      return;
    }
    const targetUserId = canDecideLeave && leaveEmployeeId ? leaveEmployeeId : user?.id || '';
    const days = Math.floor((new Date(leaveEnd).getTime() - new Date(leaveStart).getTime()) / 86400000) + 1;
    if (days < 1) {
      error(ar ? 'تاريخ النهاية يجب أن يساوي أو يلي تاريخ البداية.' : 'End date must be on or after start date.');
      return;
    }
    setSaving(true);
    try {
      const { error: insErr } = await supabase.from('leave_requests').insert({
        organization_id: orgId,
        branch_id: branchId || null,
        user_id: targetUserId,
        leave_type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        total_days: days,
        reason: leaveReason.trim(),
        status: 'pending',
      });
      if (insErr) throw insErr;

      success(ar ? 'تم تقديم طلب الإجازة.' : 'Leave request submitted.');
      setShowLeaveModal(false);
      setLeaveReason('');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      error(
        msg.includes('Overlapping')
          ? ar
            ? 'يوجد طلب إجازة متداخل مع هذه التواريخ.'
            : 'Overlapping leave request exists for these dates.'
          : ar
          ? 'تعذر تسجيل طلب الإجازة.'
          : 'Failed to submit leave request.'
      );
    } finally {
      setSaving(false);
    }
  };

  const decideLeave = async (leaveId: string, decision: 'approved' | 'rejected') => {
    if (!supabase) return;
    setSaving(true);
    try {
      const { error: rpcErr } = await supabase.rpc('decide_leave_request', {
        p_leave_id: leaveId,
        p_decision: decision,
        p_notes: null,
      });
      if (rpcErr) throw rpcErr;
      success(decision === 'approved' ? (ar ? 'تمت الموافقة على الإجازة.' : 'Leave approved.') : ar ? 'تم رفض الإجازة.' : 'Leave rejected.');
      await loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      error(
        msg.includes('Self-approval')
          ? ar
            ? 'لا يمكن للموظف اعتماد طلب إجازته بنفسه.'
            : 'Self-approval of leave requests is not allowed.'
          : ar
          ? 'تعذر اتخاذ القرار.'
          : 'Unable to update leave status.'
      );
    } finally {
      setSaving(false);
    }
  };

  const submitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !branchId || !expTitle.trim()) {
      error(ar ? 'اختر فرعاً نشطاً وأدخل بيان المصروف.' : 'Select an active branch and enter expense title.');
      return;
    }
    const amt = Number(expAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      error(ar ? 'المبلغ يجب أن يكون أكبر من صفر.' : 'Amount must be greater than zero.');
      return;
    }
    setSaving(true);
    try {
      const { error: rpcErr } = await supabase.rpc('record_facility_expense', {
        p_branch_id: branchId,
        p_cashbox_id: expCashboxId || null,
        p_category: expCategory,
        p_title: expTitle.trim(),
        p_amount: amt,
        p_expense_date: expDate,
        p_vendor_name: expVendor.trim() || null,
        p_notes: expNotes.trim() || null,
      });
      if (rpcErr) throw rpcErr;

      success(ar ? 'تم تسجيل المصروف وتحديث رصيد الخزينة.' : 'Expense recorded and cashbox updated.');
      setShowExpenseModal(false);
      setExpTitle('');
      setExpAmount('');
      setExpVendor('');
      setExpNotes('');
      await loadData();
    } catch {
      error(ar ? 'تعذر تسجيل المصروف. راجع الخزينة والصلاحيات.' : 'Failed to record expense.');
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center" dir={ar ? 'rtl' : 'ltr'}>
        <AlertTriangle className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-3 text-lg font-black text-slate-900">{ar ? 'الموارد البشرية' : 'Human Resources'}</h1>
        <p className="mt-2 text-sm text-rose-900">
          {ar ? 'ليست لديك صلاحية عرض الموارد البشرية.' : 'You do not have permission to view HR.'}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <Briefcase className="h-7 w-7 text-purple-600" />
            {ar ? 'الموارد البشرية، الرواتب والمصروفات' : 'HR, Payroll, Leaves & Operating Expenses'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ar
              ? 'إدارة مسير الرواتب المربوط بالخزينة والمصروفات، طلبات الإجازات، وعمولات الأطباء.'
              : 'Audited payroll runs tied to expenses and cashboxes, leave approvals, and commissions.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
          />
          <button
            type="button"
            onClick={() => void loadData()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {ar ? 'تحديث' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">{ar ? 'إجمالي رواتب الشهر' : 'Monthly Payroll Total'}</p>
          <p className="mt-1 text-xl font-black text-slate-900">
            {stats.totalPayroll.toLocaleString()} {currency}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold text-emerald-800">{ar ? 'الرواتب المصروفة' : 'Paid Salaries'}</p>
          <p className="mt-1 text-xl font-black text-emerald-900">
            {stats.paidPayroll.toLocaleString()} {currency}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800">{ar ? 'طلبات إجازة معلقة' : 'Pending Leaves'}</p>
          <p className="mt-1 text-xl font-black text-amber-900">{stats.pendingLeaves}</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold text-rose-800">{ar ? 'إجمالي المصروفات' : 'Recorded Expenses'}</p>
          <p className="mt-1 text-xl font-black text-rose-900">
            {stats.totalExpenses.toLocaleString()} {currency}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold ${
            activeTab === 'payroll' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wallet className="h-4 w-4" />
          {ar ? 'الرواتب' : 'Payroll'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leaves')}
          className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold ${
            activeTab === 'leaves' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="h-4 w-4" />
          {ar ? 'الإجازات' : 'Leaves'}
        </button>
        {canManagePayroll && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('expenses')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold ${
                activeTab === 'expenses' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Receipt className="h-4 w-4" />
              {ar ? 'المصروفات التشغيلية' : 'Expenses'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('commissions')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold ${
                activeTab === 'commissions' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              <DollarSign className="h-4 w-4" />
              {ar ? 'عمولات الأطباء' : 'Commissions'}
            </button>
          </>
        )}
      </div>

      {/* PAYROLL TAB */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {canManagePayroll && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowPayrollModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700"
              >
                <Plus className="h-4 w-4" />
                {ar ? 'إعداد راتب شهر' : 'Create Payroll Slip'}
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                <tr>
                  <th className="p-3.5 text-start">{ar ? 'الموظف' : 'Employee'}</th>
                  <th className="p-3.5 text-start">{ar ? 'الشهر' : 'Month'}</th>
                  <th className="p-3.5 text-start">{ar ? 'الأساسي' : 'Base'}</th>
                  <th className="p-3.5 text-start">{ar ? 'البدلات' : 'Allowances'}</th>
                  <th className="p-3.5 text-start">{ar ? 'الاستقطاعات' : 'Deductions'}</th>
                  <th className="p-3.5 text-start">{ar ? 'الصافي' : 'Net Salary'}</th>
                  <th className="p-3.5 text-start">{ar ? 'الحالة' : 'Status'}</th>
                  <th className="p-3.5 text-end">{ar ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payrolls.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      {ar ? 'لا توجد مسيرات رواتب مسجلة لهذا الشهر.' : 'No payroll slips for this month.'}
                    </td>
                  </tr>
                ) : (
                  payrolls.map((slip) => {
                    const emp = staffNameMap.get(slip.user_id);
                    return (
                      <tr key={slip.id} className="hover:bg-slate-50/70">
                        <td className="p-3.5 font-bold text-slate-900">
                          {emp ? (ar ? emp.name_ar : emp.name_en) : slip.user_id.slice(0, 8)}
                        </td>
                        <td className="p-3.5 font-mono">{slip.month}</td>
                        <td className="p-3.5">{Number(slip.base_salary).toLocaleString()}</td>
                        <td className="p-3.5 text-emerald-700">+{Number(slip.allowances).toLocaleString()}</td>
                        <td className="p-3.5 text-rose-700">-{Number(slip.deductions).toLocaleString()}</td>
                        <td className="p-3.5 font-black text-slate-900">
                          {Number(slip.net_salary).toLocaleString()} {currency}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-bold ${
                              slip.payment_status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : slip.payment_status === 'approved'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {slip.payment_status}
                          </span>
                        </td>
                        <td className="p-3.5 text-end">
                          {slip.payment_status === 'draft' && canApprovePayroll && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void approveSlip(slip.id)}
                              className="rounded-lg bg-blue-600 px-3 py-1 font-bold text-white hover:bg-blue-700"
                            >
                              {ar ? 'اعتماد' : 'Approve'}
                            </button>
                          )}
                          {slip.payment_status === 'approved' && canApprovePayroll && (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setPayoutTarget(slip)}
                              className="rounded-lg bg-emerald-600 px-3 py-1 font-bold text-white hover:bg-emerald-700"
                            >
                              {ar ? 'صرف الآن' : 'Disburse'}
                            </button>
                          )}
                          {slip.payment_status === 'paid' && (
                            <span className="text-[11px] text-slate-500">
                              {slip.payment_date || ''} ({slip.payment_method || ''})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LEAVES TAB */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              {ar ? 'تقديم طلب إجازة' : 'Request Leave'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                <tr>
                  <th className="p-3.5 text-start">{ar ? 'الموظف' : 'Employee'}</th>
                  <th className="p-3.5 text-start">{ar ? 'النوع' : 'Type'}</th>
                  <th className="p-3.5 text-start">{ar ? 'من - إلى' : 'Dates'}</th>
                  <th className="p-3.5 text-start">{ar ? 'الأيام' : 'Days'}</th>
                  <th className="p-3.5 text-start">{ar ? 'السبب' : 'Reason'}</th>
                  <th className="p-3.5 text-start">{ar ? 'الحالة' : 'Status'}</th>
                  {canDecideLeave && <th className="p-3.5 text-end">{ar ? 'القرار' : 'Decision'}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      {ar ? 'لا توجد طلبات إجازة.' : 'No leave requests.'}
                    </td>
                  </tr>
                ) : (
                  leaves.map((lv) => {
                    const emp = staffNameMap.get(lv.user_id);
                    const isSelf = lv.user_id === user?.id && role !== 'super_admin';
                    return (
                      <tr key={lv.id}>
                        <td className="p-3.5 font-bold text-slate-900">
                          {emp ? (ar ? emp.name_ar : emp.name_en) : lv.user_id === user?.id ? (ar ? user?.name_ar : user?.name_en) : lv.user_id.slice(0, 8)}
                        </td>
                        <td className="p-3.5">{lv.leave_type}</td>
                        <td className="p-3.5 font-mono">
                          {lv.start_date} → {lv.end_date}
                        </td>
                        <td className="p-3.5 font-bold">{lv.total_days}</td>
                        <td className="p-3.5 text-slate-600">{lv.reason}</td>
                        <td className="p-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 font-bold ${
                              lv.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : lv.status === 'rejected'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {lv.status}
                          </span>
                        </td>
                        {canDecideLeave && (
                          <td className="p-3.5 text-end">
                            {lv.status === 'pending' && !isSelf ? (
                              <div className="inline-flex gap-1.5">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void decideLeave(lv.id, 'approved')}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white hover:bg-emerald-700"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  {ar ? 'موافقة' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void decideLeave(lv.id, 'rejected')}
                                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 font-bold text-white hover:bg-rose-700"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  {ar ? 'رفض' : 'Reject'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                {lv.status === 'pending' && isSelf ? (ar ? 'بانتظار مدير آخر' : 'Pending manager') : '—'}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EXPENSES TAB */}
      {activeTab === 'expenses' && canManagePayroll && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowExpenseModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" />
              {ar ? 'تسجيل مصروف تشغيلي' : 'Record Expense'}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                <tr>
                  <th className="p-3.5 text-start">{ar ? 'التاريخ' : 'Date'}</th>
                  <th className="p-3.5 text-start">{ar ? 'البند' : 'Category'}</th>
                  <th className="p-3.5 text-start">{ar ? 'البيان' : 'Title'}</th>
                  <th className="p-3.5 text-start">{ar ? 'الجهة / المورد' : 'Vendor'}</th>
                  <th className="p-3.5 text-start">{ar ? 'المبلغ' : 'Amount'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      {ar ? 'لا توجد مصروفات مسجلة.' : 'No expenses recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="p-3.5 font-mono">{exp.expense_date}</td>
                      <td className="p-3.5 font-bold text-purple-700">{exp.category}</td>
                      <td className="p-3.5 font-bold text-slate-900">{exp.title}</td>
                      <td className="p-3.5 text-slate-600">{exp.vendor_name || '—'}</td>
                      <td className="p-3.5 font-black text-rose-700">
                        {Number(exp.amount).toLocaleString()} {currency}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* COMMISSIONS TAB */}
      {activeTab === 'commissions' && canManagePayroll && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-start text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
              <tr>
                <th className="p-3.5 text-start">{ar ? 'التاريخ' : 'Date'}</th>
                <th className="p-3.5 text-start">{ar ? 'الطبيب' : 'Doctor'}</th>
                <th className="p-3.5 text-start">{ar ? 'العمولة' : 'Commission'}</th>
                <th className="p-3.5 text-start">{ar ? 'حالة التسوية' : 'Settlement'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commissions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    {ar ? 'لا توجد عمولات مسجلة.' : 'No doctor commissions recorded yet.'}
                  </td>
                </tr>
              ) : (
                commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="p-3.5 font-mono">{c.commission_date}</td>
                    <td className="p-3.5 font-bold text-slate-900">
                      {c.doctor?.user?.name_ar || c.doctor?.user?.name_en || '-'}
                    </td>
                    <td className="p-3.5 font-black text-emerald-700">
                      {Number(c.amount).toLocaleString()} {currency}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-bold ${
                          c.is_settled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {c.is_settled ? (ar ? 'مسوّاة' : 'Settled') : ar ? 'مستحقة' : 'Unsettled'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Payroll Slip Modal */}
      {showPayrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={createPayrollDraft} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">{ar ? `مسودة راتب (${selectedMonth})` : `New Payroll (${selectedMonth})`}</h3>
              <button type="button" onClick={() => setShowPayrollModal(false)} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'الموظف' : 'Employee'}</label>
                <select
                  required
                  value={payUserId}
                  onChange={(e) => setPayUserId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {ar ? s.name_ar : s.name_en} ({s.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'الأساسي' : 'Base'}</label>
                  <input required type="number" min="0" step="0.01" value={payBase} onChange={(e) => setPayBase(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'البدلات' : 'Allowances'}</label>
                  <input required type="number" min="0" step="0.01" value={payAllowances} onChange={(e) => setPayAllowances(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'الاستقطاع' : 'Deductions'}</label>
                  <input required type="number" min="0" step="0.01" value={payDeductions} onChange={(e) => setPayDeductions(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-2.5 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'ملاحظات' : 'Notes'}</label>
                <input type="text" value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowPayrollModal(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" disabled={saving} className="rounded-xl bg-purple-600 px-5 py-2 text-sm font-bold text-white">
                {ar ? 'حفظ المسودة' : 'Save Draft'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Disburse Payroll Modal */}
      {payoutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={paySlip} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-black text-slate-900">{ar ? 'تأكيد صرف الراتب' : 'Confirm Payroll Disbursement'}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {ar ? 'الصافي المستحق: ' : 'Net Amount: '}
              <strong>
                {Number(payoutTarget.net_salary).toLocaleString()} {currency}
              </strong>
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'طريقة الصرف' : 'Payment Method'}</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as 'cash' | 'bank_transfer' | 'cheque')}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="bank_transfer">{ar ? 'تحويل بنكي' : 'Bank Transfer'}</option>
                  <option value="cash">{ar ? 'نقدي من الخزينة' : 'Cash (from Cashbox)'}</option>
                  <option value="cheque">{ar ? 'شيك' : 'Cheque'}</option>
                </select>
              </div>
              {payoutMethod === 'cash' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'الخزينة' : 'Cashbox'}</label>
                  <select
                    required
                    value={payoutCashboxId}
                    onChange={(e) => setPayoutCashboxId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">{ar ? 'اختر الخزينة...' : 'Select cashbox...'}</option>
                    {cashboxes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({Number(c.current_balance).toLocaleString()} {currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPayoutTarget(null)} className="rounded-xl border px-4 py-2 text-sm font-bold">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white">
                {ar ? 'صرف وتسجيل المصروف' : 'Disburse & Record Expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Request Leave Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={submitLeaveRequest} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">{ar ? 'طلب إجازة جديد' : 'Submit Leave Request'}</h3>
              <button type="button" onClick={() => setShowLeaveModal(false)} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {canDecideLeave && staff.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'الموظف' : 'Employee'}</label>
                  <select
                    value={leaveEmployeeId}
                    onChange={(e) => setLeaveEmployeeId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  >
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {ar ? s.name_ar : s.name_en}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'نوع الإجازة' : 'Leave Type'}</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  {LEAVE_TYPES.map((lt) => (
                    <option key={lt} value={lt}>
                      {lt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'من تاريخ' : 'Start Date'}</label>
                  <input required type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'إلى تاريخ' : 'End Date'}</label>
                  <input required type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'السبب' : 'Reason'}</label>
                <textarea required rows={2} value={leaveReason} onChange={(e) => setLeaveReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowLeaveModal(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" disabled={saving} className="rounded-xl bg-purple-600 px-5 py-2 text-sm font-bold text-white">
                {ar ? 'إرسال الطلب' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Record Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form onSubmit={submitExpense} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">{ar ? 'تسجيل مصروف تشغيلي' : 'Record Operating Expense'}</h3>
              <button type="button" onClick={() => setShowExpenseModal(false)} className="text-slate-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'التصنيف' : 'Category'}</label>
                  <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'التاريخ' : 'Date'}</label>
                  <input required type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'بيان المصروف' : 'Title'}</label>
                <input required type="text" value={expTitle} onChange={(e) => setExpTitle(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'المبلغ' : 'Amount'}</label>
                  <input required type="number" min="0.01" step="0.01" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700">{ar ? 'الخزينة (اختياري)' : 'Cashbox (Optional)'}</label>
                  <select value={expCashboxId} onChange={(e) => setExpCashboxId(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
                    <option value="">{ar ? 'خارج الخزينة / تحويل' : 'External / Bank'}</option>
                    {cashboxes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'المورد / المستفيد' : 'Vendor'}</label>
                <input type="text" value={expVendor} onChange={(e) => setExpVendor(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowExpenseModal(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" disabled={saving} className="rounded-xl bg-purple-600 px-5 py-2 text-sm font-bold text-white">
                {ar ? 'تسجيل المصروف' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
