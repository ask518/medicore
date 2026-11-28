import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { BarChart3, Download, RefreshCw, Wallet } from 'lucide-react';
import { getPaymentModeLabel } from '../../lib/facilityLabels';

interface ReportMetrics {
  patients: number;
  appointments: number;
  consultations: number;
  doctors: number;
  labOrders: number;
  radOrders: number;
  revenue: number;
  expenses: number;
  commissions: number;
  payrollPaid: number;
  byPaymentMode: Record<string, number>;
}

const emptyMetrics: ReportMetrics = {
  patients: 0,
  appointments: 0,
  consultations: 0,
  doctors: 0,
  labOrders: 0,
  radOrders: 0,
  revenue: 0,
  expenses: 0,
  commissions: 0,
  payrollPaid: 0,
  byPaymentMode: {},
};

const REPORT_PAYMENT_MODES = ['cash', 'instapay', 'wallet', 'vodafone_cash', 'fawry', 'credit_card', 'bank_transfer', 'insurance'] as const;

export const Reports: React.FC = () => {
  const { organization, activeBranch, can } = useAuth();
  const { locale, t } = useLanguage();
  const { error } = useToast();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<ReportMetrics>(emptyMetrics);
  const [modeFilter, setModeFilter] = useState<string>('all');
  const ar = locale === 'ar';
  const orgId = organization?.id || '';
  const currency = organization?.default_currency || 'EGP';
  const canViewReports = can('reports', 'view');
  const canBillingView = can('billing', 'view');

  const load = useCallback(async () => {
    if (!supabase || !orgId || !canViewReports) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const branchId = activeBranch?.id;
    let apptsQ = supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
    let consQ = supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
    let labQ = supabase.from('laboratory_orders').select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
    let radQ = supabase.from('radiology_orders').select('id', { count: 'exact', head: true }).eq('organization_id', orgId);
    let payQ = supabase.from('payments').select('amount,payment_mode').eq('organization_id', orgId).eq('is_reversal', false);
    let expQ = supabase.from('expenses').select('amount').eq('organization_id', orgId);
    let commQ = supabase.from('doctor_commissions').select('amount').eq('organization_id', orgId);
    let paySlipQ = supabase.from('payroll_slips').select('net_salary').eq('organization_id', orgId).eq('payment_status', 'paid');
    if (branchId) {
      apptsQ = apptsQ.eq('branch_id', branchId);
      consQ = consQ.eq('branch_id', branchId);
      labQ = labQ.eq('branch_id', branchId);
      radQ = radQ.eq('branch_id', branchId);
      payQ = payQ.eq('branch_id', branchId);
      expQ = expQ.eq('branch_id', branchId);
      commQ = commQ.eq('branch_id', branchId);
      paySlipQ = paySlipQ.eq('branch_id', branchId);
    }

    const emptyOk = Promise.resolve({ data: [], error: null });
    const [
      patientsRes,
      appointmentsRes,
      consultationsRes,
      doctorsRes,
      labRes,
      radRes,
      paymentsRes,
      expensesRes,
      commissionsRes,
      payrollRes,
    ] = await Promise.all([
      supabase.from('patients').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
      apptsQ,
      consQ,
      supabase.from('doctors').select('id', { count: 'exact', head: true }).eq('organization_id', orgId).eq('is_active', true),
      labQ,
      radQ,
      canBillingView ? payQ : emptyOk,
      canBillingView ? expQ : emptyOk,
      canBillingView ? commQ : emptyOk,
      canBillingView ? paySlipQ : emptyOk,
    ]);

    if (
      patientsRes.error ||
      appointmentsRes.error ||
      consultationsRes.error ||
      doctorsRes.error ||
      labRes.error ||
      radRes.error ||
      paymentsRes.error ||
      expensesRes.error ||
      commissionsRes.error ||
      payrollRes.error
    ) {
      error(ar ? 'تعذر تحميل مؤشرات التقارير.' : 'Could not load report metrics.');
      setLoading(false);
      return;
    }

    const sumCol = (rows: Record<string, unknown>[] | null | undefined, key: string): number =>
      (rows || []).reduce<number>((sum, row) => sum + Number(row[key] || 0), 0);

    const payRows = (paymentsRes.data || []) as Array<{ amount?: number; payment_mode?: string }>;
    const byPaymentMode: Record<string, number> = {};
    for (const p of payRows) {
      const m = p.payment_mode || 'cash';
      byPaymentMode[m] = (byPaymentMode[m] || 0) + Number(p.amount || 0);
    }

    setMetrics({
      patients: patientsRes.count || 0,
      appointments: appointmentsRes.count || 0,
      consultations: consultationsRes.count || 0,
      doctors: doctorsRes.count || 0,
      labOrders: labRes.count || 0,
      radOrders: radRes.count || 0,
      revenue: sumCol(payRows as Record<string, unknown>[], 'amount'),
      expenses: sumCol(expensesRes.data as Record<string, unknown>[] | null, 'amount'),
      commissions: sumCol(commissionsRes.data as Record<string, unknown>[] | null, 'amount'),
      payrollPaid: sumCol(payrollRes.data as Record<string, unknown>[] | null, 'net_salary'),
      byPaymentMode,
    });
    setLoading(false);
  }, [orgId, activeBranch?.id, error, ar]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportCsv = () => {
    if (!organization) return;
    const rows = [
      ['Metric', 'Value', 'Currency'],
      ['Active Patients', String(metrics.patients), ''],
      ['Appointments', String(metrics.appointments), ''],
      ['Consultations', String(metrics.consultations), ''],
      ['Active Doctors', String(metrics.doctors), ''],
      ['Laboratory Orders', String(metrics.labOrders), ''],
      ['Radiology Orders', String(metrics.radOrders), ''],
      ['Collected Revenue', String(metrics.revenue), currency],
      ...REPORT_PAYMENT_MODES
        .filter(m => modeFilter === 'all' || (modeFilter === '__wallets__' ? ['wallet', 'vodafone_cash'].includes(m) : modeFilter === m))
        .map(m => [`Collection via ${getPaymentModeLabel(m, false)}`, String(metrics.byPaymentMode[m] || 0), currency]),
      ['Recorded Expenses', String(metrics.expenses), currency],
      ['Doctor Commissions', String(metrics.commissions), currency],
      ['Paid Payroll', String(metrics.payrollPaid), currency],
      ['Net Operating Cashflow', String(metrics.revenue - metrics.expenses), currency],
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medicore-report-${organization.slug || 'clinic'}-${modeFilter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!organization) return null;
  if (!canViewReports) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center" dir={ar ? 'rtl' : 'ltr'}>
        <h1 className="text-lg font-black text-slate-900">{t.nav.reports}</h1>
        <p className="mt-2 text-sm text-rose-900">
          {ar ? 'ليست لديك صلاحية عرض التقارير التحليلية. يمكن لمالك المنشأة تفعيلها من شاشة الصلاحيات.' : 'You do not have permission to view analytics reports.'}
        </p>
      </section>
    );
  }

  const netOperating = metrics.revenue - metrics.expenses;
  const restrictedLabel = ar ? 'مقيد بالصلاحيات' : 'Restricted';

  const cards: [string, string | number][] = [
    [ar ? 'المرضى النشطون' : 'Active Patients', metrics.patients],
    [ar ? 'المواعيد' : 'Appointments', metrics.appointments],
    [ar ? 'الكشوفات الطبية' : 'Consultations', metrics.consultations],
    [ar ? 'الأطباء النشطون' : 'Active Doctors', metrics.doctors],
    [ar ? 'طلبات المعمل' : 'Laboratory Orders', metrics.labOrders],
    [ar ? 'طلبات الأشعة' : 'Radiology Orders', metrics.radOrders],
    [ar ? 'الإيرادات المحصلة' : 'Collected Revenue', canBillingView ? `${metrics.revenue.toLocaleString()} ${currency}` : restrictedLabel],
    [ar ? 'المصروفات التشغيلية' : 'Expenses', canBillingView ? `${metrics.expenses.toLocaleString()} ${currency}` : restrictedLabel],
    [ar ? 'عمولات الأطباء' : 'Doctor Commissions', canBillingView ? `${metrics.commissions.toLocaleString()} ${currency}` : restrictedLabel],
    [ar ? 'الرواتب المنصرفة' : 'Paid Payroll', canBillingView ? `${metrics.payrollPaid.toLocaleString()} ${currency}` : restrictedLabel],
    [ar ? 'صافي التدفق التشغيلي' : 'Net Operating Cashflow', canBillingView ? `${netOperating.toLocaleString()} ${currency}` : restrictedLabel],
  ];

  return (
    <main className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <BarChart3 className="h-6 w-6 text-cyan-600" />
            {t.nav.reports}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ar
              ? 'تقارير وإحصائيات مباشرة من قاعدة بيانات Supabase وفق نطاق الفرع الحالي.'
              : 'Live operational and financial metrics from Supabase scoped by your active branch.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {ar ? 'تحديث' : 'Refresh'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl bg-medicore-600 px-3 py-2 text-xs font-bold text-white hover:bg-medicore-700 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {ar ? 'تصدير CSV' : 'Export CSV'}
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <article key={label} className="rounded-2xl border bg-white p-5">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{loading ? '—' : value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <h2 className="flex items-center gap-2 text-sm font-black text-slate-900">
            <Wallet className="h-4 w-4 text-emerald-600" />
            {ar ? 'تقارير التحصيل حسب وسيلة الدفع (كاش / إنستاباي / محافظ)' : 'Collections by Payment Method'}
          </h2>
          <select
            value={modeFilter}
            onChange={e => setModeFilter(e.target.value)}
            className="rounded-xl border bg-white px-3 py-1.5 text-xs font-bold"
          >
            <option value="all">{ar ? 'كل وسائل التحصيل' : 'All Payment Methods'}</option>
            <option value="cash">{getPaymentModeLabel('cash', ar)}</option>
            <option value="instapay">{getPaymentModeLabel('instapay', ar)}</option>
            <option value="__wallets__">{ar ? 'كل المحافظ الإلكترونية (Wallet + Vodafone Cash)' : 'All E-Wallets'}</option>
            <option value="wallet">{getPaymentModeLabel('wallet', ar)}</option>
            <option value="vodafone_cash">{getPaymentModeLabel('vodafone_cash', ar)}</option>
            <option value="fawry">{getPaymentModeLabel('fawry', ar)}</option>
            <option value="credit_card">{getPaymentModeLabel('credit_card', ar)}</option>
            <option value="bank_transfer">{getPaymentModeLabel('bank_transfer', ar)}</option>
            <option value="insurance">{getPaymentModeLabel('insurance', ar)}</option>
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {REPORT_PAYMENT_MODES
            .filter(m => modeFilter === 'all' || (modeFilter === '__wallets__' ? ['wallet', 'vodafone_cash'].includes(m) : modeFilter === m))
            .map(m => (
              <div key={m} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <p className="text-xs font-bold text-slate-600">{getPaymentModeLabel(m, ar)}</p>
                <p className="mt-1 text-xl font-black font-mono text-emerald-700">
                  {loading ? '—' : `${(metrics.byPaymentMode[m] || 0).toLocaleString()} ${currency}`}
                </p>
              </div>
            ))}
        </div>
      </section>
    </main>
  );
};
