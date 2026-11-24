// ============================================================================
// MEDICORE – Human Resources, Payroll, Operating Expenses & Leaves Management
// Section 9 Business Implementation: Multi-Tenant RBAC & Financial Control
// ============================================================================

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { 
  PayrollSlip, FacilityExpense, LeaveRequest, PayrollStatus, 
  ExpenseCategory, LeaveType, User, AppRole 
} from '../../types/database';
import { 
  Briefcase, DollarSign, Calendar, Clock, Plus, Check, 
  X, AlertTriangle, FileText, Building2, UserCheck, 
  WalletCards, Receipt, Filter, Search, Printer, CheckCircle2,
  CalendarDays, ArrowUpRight, ArrowDownLeft, ShieldCheck
} from 'lucide-react';

export const HR: React.FC = () => {
  const { organization, activeBranch, user, isOrgOwner, isSuperAdmin } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error, warning } = useToast();

  const orgId = organization?.id || '';
  const canManage = isOrgOwner || isSuperAdmin || user?.role === 'branch_manager' || user?.role === 'accountant';

  const [activeTab, setActiveTab] = useState<'payroll' | 'expenses' | 'leaves' | 'attendance'>('payroll');

  // Data from DB
  const staff = orgId ? dbClient.getUsers(orgId) : [];
  const payrollSlips = orgId ? dbClient.getPayrollSlips(orgId) : [];
  const expenses = orgId ? dbClient.getExpenses(orgId) : [];
  const leaveRequests = orgId ? dbClient.getLeaveRequests(orgId) : [];
  const cashboxes = orgId ? dbClient.getCashboxes(orgId) : [];

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11');
  const [payrollStatusFilter, setPayrollStatusFilter] = useState<string>('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>('all');
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('all');

  // Modals
  const [showAddPayrollModal, setShowAddPayrollModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddLeaveModal, setShowAddLeaveModal] = useState(false);
  const [selectedSlipForPrint, setSelectedSlipForPrint] = useState<PayrollSlip | null>(null);

  // New Payroll Form State
  const [payrollUserId, setPayrollUserId] = useState<string>(staff[0]?.id || '');
  const [baseSalary, setBaseSalary] = useState<number>(6000);
  const [allowances, setAllowances] = useState<number>(1000);
  const [deductions, setDeductions] = useState<number>(500);
  const [payrollMethod, setPayrollMethod] = useState<'cash' | 'bank_transfer' | 'cheque'>('bank_transfer');
  const [payrollNotes, setPayrollNotes] = useState<string>('');

  // New Expense Form State
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('medical_supplies');
  const [expenseAmount, setExpenseAmount] = useState<number>(1500);
  const [expensePaidTo, setExpensePaidTo] = useState<string>('');
  const [expenseMethod, setExpenseMethod] = useState<'cash' | 'bank_transfer' | 'credit_card' | 'cheque'>('cash');
  const [expenseCashboxId, setExpenseCashboxId] = useState<string>(cashboxes[0]?.id || '');
  const [expenseReceiptNo, setExpenseReceiptNo] = useState<string>('');
  const [expenseNotes, setExpenseNotes] = useState<string>('');

  // New Leave Form State
  const [leaveUserId, setLeaveUserId] = useState<string>(staff[0]?.id || '');
  const [leaveType, setLeaveType] = useState<LeaveType>('annual');
  const [leaveStartDate, setLeaveStartDate] = useState<string>('2026-11-25');
  const [leaveEndDate, setLeaveEndDate] = useState<string>('2026-11-28');
  const [leaveReason, setLeaveReason] = useState<string>('');

  // Metrics
  const totalPayrollMonth = useMemo(() => {
    return payrollSlips
      .filter(s => s.month === selectedMonth)
      .reduce((sum, s) => sum + s.net_salary, 0);
  }, [payrollSlips, selectedMonth]);

  const paidPayrollMonth = useMemo(() => {
    return payrollSlips
      .filter(s => s.month === selectedMonth && s.payment_status === 'paid')
      .reduce((sum, s) => sum + s.net_salary, 0);
  }, [payrollSlips, selectedMonth]);

  const totalExpensesMonth = useMemo(() => {
    return expenses
      .filter(e => e.expense_date.startsWith(selectedMonth))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, selectedMonth]);

  const pendingLeavesCount = useMemo(() => {
    return leaveRequests.filter(l => l.status === 'pending').length;
  }, [leaveRequests]);

  // Handlers: Payroll
  const handleCreatePayrollSlip = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = staff.find(u => u.id === payrollUserId);
    if (!emp) {
      error(locale === 'ar' ? 'يرجى اختيار الموظف' : 'Select employee');
      return;
    }

    const net = Math.max(0, baseSalary + allowances - deductions);
    dbClient.createPayrollSlip(orgId, {
      branch_id: activeBranch?.id,
      user_id: emp.id,
      employee_name_ar: emp.name_ar,
      employee_name_en: emp.name_en,
      employee_role: emp.role,
      month: selectedMonth,
      base_salary: baseSalary,
      allowances,
      deductions,
      net_salary: net,
      payment_status: 'draft',
      payment_method: payrollMethod,
      notes: payrollNotes || undefined,
    });

    success(locale === 'ar' ? `تم إدراج مسير راتب ${emp.name_ar} بنجاح` : `Payroll slip generated for ${emp.name_ar}`);
    setShowAddPayrollModal(false);
    setPayrollNotes('');
  };

  const handleUpdatePayrollStatus = (slipId: string, newStatus: PayrollStatus) => {
    const payDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : undefined;
    dbClient.updatePayrollStatus(slipId, newStatus, payDate);
    success(locale === 'ar' ? `تم تحديث حالة الراتب إلى: ${newStatus === 'paid' ? 'تم الصرف بنجاح' : 'معتمد للصرف'}` : `Payroll status updated to ${newStatus}`);
  };

  // Handlers: Expenses
  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || expenseAmount <= 0) {
      error(locale === 'ar' ? 'يرجى إدخال اسم المصروف وقيمة المبلغ' : 'Provide expense title and valid amount');
      return;
    }

    dbClient.createExpense(orgId, {
      branch_id: activeBranch?.id,
      expense_category: expenseCategory,
      title: expenseTitle,
      amount: expenseAmount,
      currency: 'EGP',
      expense_date: new Date().toISOString().split('T')[0],
      paid_to: expensePaidTo || 'مستلم عام',
      payment_method: expenseMethod,
      cashbox_id: expenseMethod === 'cash' ? expenseCashboxId : undefined,
      receipt_number: expenseReceiptNo || `EXP-${Date.now().toString().slice(-5)}`,
      status: 'paid',
      notes: expenseNotes || undefined,
    });

    success(locale === 'ar' ? `تم قيد المصروف "${expenseTitle}" بقيمة ${expenseAmount} ج.م` : `Expense recorded: ${expenseAmount} EGP`);
    setShowAddExpenseModal(false);
    setExpenseTitle('');
    setExpensePaidTo('');
    setExpenseNotes('');
  };

  const handleDeleteExpense = (id: string, title: string) => {
    if (window.confirm(locale === 'ar' ? `هل أنت متأكد من حذف سند الصرف "${title}"؟` : `Delete expense voucher "${title}"?`)) {
      dbClient.deleteExpense(id);
      success(locale === 'ar' ? 'تم حذف السند بنجاح' : 'Expense deleted');
    }
  };

  // Handlers: Leaves
  const handleCreateLeaveRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const emp = staff.find(u => u.id === leaveUserId);
    if (!emp) return;

    const start = new Date(leaveStartDate);
    const end = new Date(leaveEndDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    dbClient.createLeaveRequest(orgId, {
      user_id: emp.id,
      employee_name_ar: emp.name_ar,
      employee_role: emp.role,
      leave_type: leaveType,
      start_date: leaveStartDate,
      end_date: leaveEndDate,
      total_days: diffDays,
      reason: leaveReason || 'إجازة اعتيادية سنوية',
      status: 'pending',
    });

    success(locale === 'ar' ? `تم تقديم طلب إجازة لمدة ${diffDays} يوم بنجاح` : `Leave request submitted: ${diffDays} days`);
    setShowAddLeaveModal(false);
    setLeaveReason('');
  };

  const handleDecideLeave = (leaveId: string, newStatus: 'approved' | 'rejected') => {
    dbClient.updateLeaveStatus(leaveId, newStatus, user?.name_ar || 'مسؤول الموارد البشرية');
    success(locale === 'ar' ? `تم ${newStatus === 'approved' ? 'الموافقة على الإجازة واعتمادها' : 'رفض طلب الإجازة'}` : `Leave request ${newStatus}`);
  };

  if (!organization) return null;

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5" />
              <span>{locale === 'ar' ? 'إدارة الموارد البشرية والرواتب (HR Suite)' : 'Enterprise HR Suite'}</span>
            </span>
            <span className="text-xs text-slate-500 font-bold">
              {locale === 'ar' ? organization.name_ar : organization.name_en}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <WalletCards className="w-6 h-6 text-purple-600" />
            {locale === 'ar' ? 'الموارد البشرية، مسيرات الرواتب والمصاريف' : 'Human Resources, Payroll & Facility Expenses'}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' 
              ? 'إدارة رواتب الطاقم الطبي والإداري، المستقطعات والبدلات، سندات المصاريف التشغيلية والإجازات السنوية' 
              : 'Staff salaries, allowances, deductions, facility operating expense vouchers and leave requests'}
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'payroll' && (
              <button
                type="button"
                onClick={() => setShowAddPayrollModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{locale === 'ar' ? '+ إصدار مسير راتب / مكافأة' : '+ Generate Payroll Slip'}</span>
              </button>
            )}

            {activeTab === 'expenses' && (
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{locale === 'ar' ? '+ تسجيل سند صرف / مصروف جديد' : '+ Record Expense Voucher'}</span>
              </button>
            )}

            {activeTab === 'leaves' && (
              <button
                type="button"
                onClick={() => setShowAddLeaveModal(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>{locale === 'ar' ? '+ تقديم طلب إجازة' : '+ Request Leave'}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* KPI Financial & HR Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Payroll */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">{locale === 'ar' ? 'إجمالي الرواتب المستحقة (الشهر)' : 'Total Payroll Due'}</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {totalPayrollMonth.toLocaleString()} <span className="text-xs font-normal text-slate-500">ج.م</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{paidPayrollMonth.toLocaleString()} ج.م مسدد بالفعل</span>
          </div>
        </div>

        {/* Operating Expenses */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">{locale === 'ar' ? 'المصاريف التشغيلية (الشهر)' : 'Operating Expenses'}</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {totalExpensesMonth.toLocaleString()} <span className="text-xs font-normal text-slate-500">ج.م</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {expenses.filter(e => e.expense_date.startsWith(selectedMonth)).length} سندات صرف موثقة
          </div>
        </div>

        {/* Staff Headcount */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">{locale === 'ar' ? 'إجمالي الكادر الوظيفي' : 'Total Headcount'}</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {staff.length} <span className="text-xs font-normal text-slate-500">{locale === 'ar' ? 'موظف وطبيب' : 'Members'}</span>
          </div>
          <div className="text-[11px] text-blue-600 font-bold">
            {staff.filter(s => s.role === 'doctor').length} أطباء ممارسون
          </div>
        </div>

        {/* Pending Leaves */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold">{locale === 'ar' ? 'طلبات الإجازة المعلقة' : 'Pending Leave Requests'}</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <CalendarDays className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {pendingLeavesCount} <span className="text-xs font-normal text-slate-500">طلب</span>
          </div>
          <div className="text-[11px] text-amber-600 font-bold">
            {pendingLeavesCount > 0 ? 'يتطلب مراجعة واعتماد الإدارة' : 'لا توجد طلبات معلقة'}
          </div>
        </div>
      </div>

      {/* Tabs Controller */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'payroll'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>{locale === 'ar' ? 'مسيرات الرواتب والأجور الشهرية' : 'Monthly Payroll & Salaries'}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
            activeTab === 'payroll' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {payrollSlips.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'expenses'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>{locale === 'ar' ? 'المصاريف التشغيلية وسندات الصرف' : 'Facility Operating Expenses'}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
            activeTab === 'expenses' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
          }`}>
            {expenses.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaves')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'leaves'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>{locale === 'ar' ? 'طلبات الإجازات وأرصدة الغياب' : 'Leaves & Vacations'}</span>
          {pendingLeavesCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-black animate-pulse">
              {pendingLeavesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'attendance'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{locale === 'ar' ? 'سجل الحضور والانصراف اليومي' : 'Daily Attendance'}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PAYROLL */}
      {/* ========================================================================= */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">{locale === 'ar' ? 'شهر المسير:' : 'Payroll Month:'}</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="text-xs font-bold p-2 border border-slate-200 rounded-xl bg-slate-50"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">{locale === 'ar' ? 'الحالة:' : 'Status:'}</span>
              <select
                value={payrollStatusFilter}
                onChange={e => setPayrollStatusFilter(e.target.value)}
                className="text-xs font-bold p-2 border border-slate-200 rounded-xl bg-slate-50"
              >
                <option value="all">{locale === 'ar' ? 'كافة الحالات' : 'All'}</option>
                <option value="draft">{locale === 'ar' ? 'مسودة (Draft)' : 'Draft'}</option>
                <option value="approved">{locale === 'ar' ? 'معتمد للصرف (Approved)' : 'Approved'}</option>
                <option value="paid">{locale === 'ar' ? 'تم الصرف والسداد (Paid)' : 'Paid'}</option>
              </select>
            </div>
          </div>

          {/* Payroll Slips Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">الموظف / الكادر</th>
                    <th className="p-3.5">الدور الوظيفي</th>
                    <th className="p-3.5 text-center">الراتب الأساسي</th>
                    <th className="p-3.5 text-center">البدلات والحوافز</th>
                    <th className="p-3.5 text-center">الاستقطاعات والخصم</th>
                    <th className="p-3.5 text-center font-black">صافي المستحق</th>
                    <th className="p-3.5 text-center">طريقة الصرف</th>
                    <th className="p-3.5 text-center">الحالة</th>
                    <th className="p-3.5 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrollSlips
                    .filter(s => s.month === selectedMonth)
                    .filter(s => payrollStatusFilter === 'all' || s.payment_status === payrollStatusFilter)
                    .map(slip => (
                      <tr key={slip.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">
                          {slip.employee_name_ar}
                          {slip.notes && <div className="text-[10px] text-slate-400 font-normal">{slip.notes}</div>}
                        </td>
                        <td className="p-3.5 text-slate-600">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-medium text-[11px]">
                            {slip.employee_role}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono">{slip.base_salary.toLocaleString()} ج.م</td>
                        <td className="p-3.5 text-center font-mono text-emerald-600">+{slip.allowances.toLocaleString()} ج.م</td>
                        <td className="p-3.5 text-center font-mono text-rose-600">-{slip.deductions.toLocaleString()} ج.م</td>
                        <td className="p-3.5 text-center font-mono font-black text-slate-900 bg-purple-50/50">
                          {slip.net_salary.toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5 text-center text-slate-500">
                          {slip.payment_method === 'bank_transfer' ? 'تحويل بنكي' : (slip.payment_method === 'cash' ? 'نقداً من الخزينة' : 'شيك مصرفي')}
                        </td>
                        <td className="p-3.5 text-center">
                          {slip.payment_status === 'paid' && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              تم الصرف ✓
                            </span>
                          )}
                          {slip.payment_status === 'approved' && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              معتمد للصرف
                            </span>
                          )}
                          {slip.payment_status === 'draft' && (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              مسودة قيد المراجعة
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {canManage && slip.payment_status === 'draft' && (
                              <button
                                type="button"
                                onClick={() => handleUpdatePayrollStatus(slip.id, 'approved')}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[10px] shadow-xs"
                              >
                                اعتماد
                              </button>
                            )}
                            {canManage && slip.payment_status === 'approved' && (
                              <button
                                type="button"
                                onClick={() => handleUpdatePayrollStatus(slip.id, 'paid')}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] shadow-xs"
                              >
                                تأكيد الصرف
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedSlipForPrint(slip)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                              title="طباعة إيصال الراتب"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {payrollSlips.filter(s => s.month === selectedMonth).length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        لا توجد مسيرات رواتب مسجلة لشهر {selectedMonth}. انقر على "+ إصدار مسير راتب" للبدء.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EXPENSES */}
      {/* ========================================================================= */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Expenses Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">التصنيف:</span>
              <select
                value={expenseCategoryFilter}
                onChange={e => setExpenseCategoryFilter(e.target.value)}
                className="text-xs font-bold p-2 border border-slate-200 rounded-xl bg-slate-50"
              >
                <option value="all">كافة التصنيفات</option>
                <option value="medical_supplies">مستلزمات وأدوية طبية</option>
                <option value="rent">إيجار المقر / العيادات</option>
                <option value="utilities">مرافق (كهرباء / مياه / إنترنت)</option>
                <option value="maintenance">صيانة ونظافة وأجهزة</option>
                <option value="hospitality">ضيافة واستقبال</option>
                <option value="marketing">تسويق وإعلانات</option>
                <option value="other">مصاريف أخرى متنوعة</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-bold">
              إجمالي سندات الصرف: <span className="font-mono text-slate-800">{expenses.length}</span>
            </div>
          </div>

          {/* Expenses Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">رقم السند</th>
                    <th className="p-3.5">بند المصروف / البيان</th>
                    <th className="p-3.5">التصنيف</th>
                    <th className="p-3.5 text-center">المبلغ</th>
                    <th className="p-3.5">الجهة / المستلم</th>
                    <th className="p-3.5 text-center">طريقة الدفع</th>
                    <th className="p-3.5 text-center">التاريخ</th>
                    <th className="p-3.5 text-center">الحالة</th>
                    <th className="p-3.5 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses
                    .filter(e => expenseCategoryFilter === 'all' || e.expense_category === expenseCategoryFilter)
                    .map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3.5 font-mono text-slate-500">{exp.receipt_number || exp.id.slice(0, 8)}</td>
                        <td className="p-3.5 font-bold text-slate-900">
                          {exp.title}
                          {exp.notes && <div className="text-[10px] text-slate-400 font-normal">{exp.notes}</div>}
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                            {exp.expense_category}
                          </span>
                        </td>
                        <td className="p-3.5 text-center font-mono font-bold text-rose-600">
                          {exp.amount.toLocaleString()} ج.م
                        </td>
                        <td className="p-3.5 text-slate-700">{exp.paid_to}</td>
                        <td className="p-3.5 text-center text-slate-500">
                          {exp.payment_method === 'cash' ? 'نقداً من الخزينة' : exp.payment_method}
                        </td>
                        <td className="p-3.5 text-center font-mono text-slate-500">{exp.expense_date}</td>
                        <td className="p-3.5 text-center">
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            سند مسدد ✓
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp.id, exp.title)}
                              className="text-rose-600 hover:text-rose-800 text-[11px] font-bold"
                            >
                              حذف
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        لا توجد سندات مصاريف مسجلة حتى الآن. انقر على "+ تسجيل سند صرف جديد" لقيد المصروفات.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LEAVES & VACATIONS */}
      {/* ========================================================================= */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">الموظف / الطبيب</th>
                    <th className="p-3.5">نوع الإجازة</th>
                    <th className="p-3.5 text-center">تاريخ البدء</th>
                    <th className="p-3.5 text-center">تاريخ الانتهاء</th>
                    <th className="p-3.5 text-center">المدة</th>
                    <th className="p-3.5">السبب / الملاحظات</th>
                    <th className="p-3.5 text-center">الحالة</th>
                    <th className="p-3.5 text-center">قرار الإدارة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaveRequests.map(leave => (
                    <tr key={leave.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900">{leave.employee_name_ar}</td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-bold text-[10px]">
                          {leave.leave_type === 'annual' ? 'سنوية اعتيادية' : (leave.leave_type === 'sick' ? 'مرضية' : leave.leave_type)}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-600">{leave.start_date}</td>
                      <td className="p-3.5 text-center font-mono text-slate-600">{leave.end_date}</td>
                      <td className="p-3.5 text-center font-bold font-mono">{leave.total_days} أيام</td>
                      <td className="p-3.5 text-slate-600">{leave.reason}</td>
                      <td className="p-3.5 text-center">
                        {leave.status === 'approved' && (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            معتمدة ومقبولة ✓
                          </span>
                        )}
                        {leave.status === 'rejected' && (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            مرفوضة
                          </span>
                        )}
                        {leave.status === 'pending' && (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            قيد المراجعة والاعتماد
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        {canManage && leave.status === 'pending' && (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleDecideLeave(leave.id, 'approved')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] shadow-xs"
                            >
                              موافقة
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDecideLeave(leave.id, 'rejected')}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[10px] shadow-xs"
                            >
                              رفض
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {leaveRequests.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        لا توجد طلبات إجازة مسجلة. انقر على "+ تقديم طلب إجازة" لإنشاء طلب جديد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ATTENDANCE */}
      {/* ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>كشف تسجيل الحضور والانصراف اليومي (اليوم: {new Date().toISOString().split('T')[0]})</span>
            </h3>
            <span className="text-xs text-slate-500 font-bold">
              {staff.length} كادر مسجل بالمنشأة
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">الموظف / الطبيب</th>
                  <th className="p-3.5">الدور الوظيفي</th>
                  <th className="p-3.5 text-center">وقت الحضور الفعلي</th>
                  <th className="p-3.5 text-center">وقت الانصراف</th>
                  <th className="p-3.5 text-center">ساعات العمل</th>
                  <th className="p-3.5 text-center">الحالة اليومية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((member, idx) => (
                  <tr key={member.id} className="hover:bg-slate-50">
                    <td className="p-3.5 font-bold text-slate-900">{member.name_ar}</td>
                    <td className="p-3.5 text-slate-600">{member.role}</td>
                    <td className="p-3.5 text-center font-mono text-emerald-700">08:45 AM</td>
                    <td className="p-3.5 text-center font-mono text-slate-400">--:--</td>
                    <td className="p-3.5 text-center font-mono font-bold">7.5 س</td>
                    <td className="p-3.5 text-center">
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        حاضر بالعيادة ✓
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD PAYROLL SLIP */}
      {/* ========================================================================= */}
      {showAddPayrollModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-purple-600" />
                <span>إصدار مسير راتب شهري لكادر المنشأة</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddPayrollModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePayrollSlip} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اختر الموظف / الطبيب *</label>
                <select
                  value={payrollUserId}
                  onChange={e => setPayrollUserId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                >
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name_ar} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الراتب الأساسي (ج.م) *</label>
                  <input
                    type="number"
                    required
                    value={baseSalary}
                    onChange={e => setBaseSalary(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">البدلات والحوافز</label>
                  <input
                    type="number"
                    value={allowances}
                    onChange={e => setAllowances(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الخصومات والتأمينات</label>
                  <input
                    type="number"
                    value={deductions}
                    onChange={e => setDeductions(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-rose-600"
                  />
                </div>
              </div>

              <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
                <span className="font-bold text-purple-900">صافي الراتب المستحق للصرف:</span>
                <span className="text-base font-black font-mono text-purple-700">
                  {Math.max(0, baseSalary + allowances - deductions).toLocaleString()} ج.م
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">شهر الاستحقاق</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">طريقة الصرف</label>
                  <select
                    value={payrollMethod}
                    onChange={e => setPayrollMethod(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="cash">نقداً من الخزينة</option>
                    <option value="cheque">شيك</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات / بيان إضافي</label>
                <input
                  type="text"
                  value={payrollNotes}
                  onChange={e => setPayrollNotes(e.target.value)}
                  placeholder="مثال: حافز تميز إكلينيكي + بدل انتقال"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPayrollModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md"
                >
                  اعتماد وحفظ المسير
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD EXPENSE */}
      {/* ========================================================================= */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-rose-600" />
                <span>تسجيل سند صرف / مصروف تشغيلي</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddExpenseModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">بيان المصروف / البند *</label>
                <input
                  type="text"
                  required
                  value={expenseTitle}
                  onChange={e => setExpenseTitle(e.target.value)}
                  placeholder="مثال: فاتورة كهرباء الفرع الرئيسي / شراء قفازات وشاش طبي"
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">التصنيف *</label>
                  <select
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value as ExpenseCategory)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="medical_supplies">مستلزمات وأدوية طبية</option>
                    <option value="rent">إيجار المقر / العيادات</option>
                    <option value="utilities">مرافق (كهرباء / مياه / إنترنت)</option>
                    <option value="maintenance">صيانة ونظافة وأجهزة</option>
                    <option value="hospitality">ضيافة واستقبال</option>
                    <option value="marketing">تسويق وإعلانات</option>
                    <option value="salaries">مرتبات ومكافآت</option>
                    <option value="other">مصاريف أخرى متنوعة</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المبلغ (ج.م) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold text-rose-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">المستلم / الجهة</label>
                  <input
                    type="text"
                    value={expensePaidTo}
                    onChange={e => setExpensePaidTo(e.target.value)}
                    placeholder="مثال: شركة الكهرباء / المورد الطبي"
                    className="w-full p-2.5 rounded-xl border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">طريقة الصرف</label>
                  <select
                    value={expenseMethod}
                    onChange={e => setExpenseMethod(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  >
                    <option value="cash">نقداً من الخزينة</option>
                    <option value="bank_transfer">تحويل بنكي</option>
                    <option value="credit_card">بطاقة بنكية</option>
                    <option value="cheque">شيك</option>
                  </select>
                </div>
              </div>

              {expenseMethod === 'cash' && cashboxes.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الخزينة المنصرف منها (لخصم الرصيد تلقائياً)</label>
                  <select
                    value={expenseCashboxId}
                    onChange={e => setExpenseCashboxId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  >
                    {cashboxes.map(cb => (
                      <option key={cb.id} value={cb.id}>
                        {cb.name} (رصيدها: {cb.current_balance.toLocaleString()} ج.م)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الفاتورة أو الإيصال الخارجي</label>
                <input
                  type="text"
                  value={expenseReceiptNo}
                  onChange={e => setExpenseReceiptNo(e.target.value)}
                  placeholder="مثال: INV-99218"
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddExpenseModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md"
                >
                  حفظ وتسجيل الصرف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD LEAVE REQUEST */}
      {/* ========================================================================= */}
      {showAddLeaveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
                <span>تقديم طلب إجازة لكادر المنشأة</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddLeaveModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLeaveRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الموظف / الطبيب طالب الإجازة *</label>
                <select
                  value={leaveUserId}
                  onChange={e => setLeaveUserId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold"
                >
                  {staff.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name_ar} ({s.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">نوع الإجازة *</label>
                <select
                  value={leaveType}
                  onChange={e => setLeaveType(e.target.value as LeaveType)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                >
                  <option value="annual">إجازة اعتيادية سنوية</option>
                  <option value="sick">إجازة مرضية معتمدة</option>
                  <option value="casual">إجازة عارضة</option>
                  <option value="emergency">إجازة طارئة</option>
                  <option value="unpaid">إجازة بدون مرتب</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ البدء *</label>
                  <input
                    type="date"
                    required
                    value={leaveStartDate}
                    onChange={e => setLeaveStartDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ الانتهاء *</label>
                  <input
                    type="date"
                    required
                    value={leaveEndDate}
                    onChange={e => setLeaveEndDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سبب الإجازة والملاحظات</label>
                <textarea
                  rows={3}
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  placeholder="سبب طلب الإجازة أو التكليف بالبديل أثناء الغياب..."
                  className="w-full p-2.5 rounded-xl border border-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLeaveModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md"
                >
                  إرسال الطلب
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRINT SALARY SLIP */}
      {/* ========================================================================= */}
      {selectedSlipForPrint && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scale-in text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-black flex items-center justify-center">
                  M+
                </div>
                <div>
                  <div className="font-bold text-slate-900">{organization.name_ar}</div>
                  <div className="text-[10px] text-slate-400">إيصال كشف مسير راتب شهري موثق</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlipForPrint(null)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">اسم الموظف:</span>
                <span className="font-bold text-slate-900">{selectedSlipForPrint.employee_name_ar}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">الدور الوظيفي:</span>
                <span className="font-medium text-slate-800">{selectedSlipForPrint.employee_role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">شهر الاستحقاق:</span>
                <span className="font-mono font-bold text-slate-900">{selectedSlipForPrint.month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">حالة الصرف:</span>
                <span className="font-bold text-emerald-700">
                  {selectedSlipForPrint.payment_status === 'paid' ? 'تم الصرف والسداد ✓' : 'معتمد للصرف'}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 border-t border-b border-slate-100 py-3">
              <div className="flex justify-between">
                <span className="text-slate-600">الراتب الأساسي:</span>
                <span className="font-mono">{selectedSlipForPrint.base_salary.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>البدلات والمكافآت:</span>
                <span className="font-mono">+{selectedSlipForPrint.allowances.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>الاستقطاعات والخصم:</span>
                <span className="font-mono">-{selectedSlipForPrint.deductions.toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between font-black text-sm text-slate-900 pt-2 border-t border-slate-200">
                <span>صافي الراتب المستحق:</span>
                <span className="font-mono text-purple-700">{selectedSlipForPrint.net_salary.toLocaleString()} ج.م</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</span>
              <span>نظام MEDICORE SaaS الموحد</span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الإيصال الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
