import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { CreditCard, DollarSign, Plus, Receipt, Wallet } from 'lucide-react';
import { getClinicalStatusLabel, getPaymentModeLabel } from '../../lib/facilityLabels';

type PatientOption = { id: string; mrn: string; first_name_ar: string; last_name_ar: string };
type DoctorOption = { id: string; user?: { name_ar: string; name_en?: string }; specialty_title_ar: string };
type ServiceOption = { id: string; code: string; name_ar: string; name_en: string; standard_price: number };
type CashboxOption = { id: string; name: string; current_balance: number };
type InvoiceRow = {
  id: string;
  invoice_number: string;
  issue_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  patient?: PatientOption;
  doctor?: DoctorOption;
  items?: { description: string; quantity: number; unit_price: number }[];
};
type CommissionRow = {
  id: string;
  amount: number;
  commission_date: string;
  is_settled: boolean;
  settlement_reference?: string | null;
  doctor?: DoctorOption;
  invoice?: { invoice_number: string };
};

import { PaymentMode } from '../../types/database';

type PaymentRow = {
  id: string;
  receipt_number: string;
  amount: number;
  payment_mode: PaymentMode;
  payment_date: string;
  transaction_reference?: string | null;
  patient?: PatientOption;
};

const MODES: PaymentMode[] = ['cash', 'instapay', 'wallet', 'vodafone_cash', 'fawry', 'credit_card', 'bank_transfer', 'insurance'];

export const Billing: React.FC<{ initialTab?: 'invoices' | 'commissions' }> = ({ initialTab = 'invoices' }) => {
  const { organization, activeBranch, isOrgOwner, can } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();

  const [viewTab, setViewTab] = useState<'invoices' | 'commissions'>(initialTab);
  useEffect(() => {
    setViewTab(initialTab);
  }, [initialTab]);

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [cashboxes, setCashboxes] = useState<CashboxOption[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<InvoiceRow | null>(null);

  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [discount, setDiscount] = useState('0');

  const [serviceCode, setServiceCode] = useState('');
  const [serviceAr, setServiceAr] = useState('');
  const [serviceEn, setServiceEn] = useState('');
  const [servicePrice, setServicePrice] = useState('');

  const [cashboxId, setCashboxId] = useState('');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<PaymentMode>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [paymentModeFilter, setPaymentModeFilter] = useState<string>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');

  const ar = locale === 'ar';
  const orgId = organization?.id || '';
  const currency = organization?.default_currency || 'EGP';

  const load = useCallback(async () => {
    if (!supabase || !orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    let invQuery = supabase
      .from('invoices')
      .select('*,patient:patients(id,mrn,first_name_ar,last_name_ar),doctor:doctors(id,specialty_title_ar,user:users(name_ar,name_en)),items:invoice_items(description,quantity,unit_price)')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (activeBranch?.id) invQuery = invQuery.eq('branch_id', activeBranch.id);

    let commQuery = supabase
      .from('doctor_commissions')
      .select('id,amount,commission_date,is_settled,settlement_reference,doctor:doctors(id,specialty_title_ar,user:users(name_ar,name_en)),invoice:invoices(invoice_number)')
      .eq('organization_id', orgId)
      .order('commission_date', { ascending: false })
      .limit(100);
    if (activeBranch?.id) commQuery = commQuery.eq('branch_id', activeBranch.id);

    let payQuery = supabase
      .from('payments')
      .select('id,receipt_number,amount,payment_mode,payment_date,transaction_reference,patient:patients(id,mrn,first_name_ar,last_name_ar)')
      .eq('organization_id', orgId)
      .eq('is_reversal', false)
      .order('payment_date', { ascending: false })
      .limit(150);
    if (activeBranch?.id) payQuery = payQuery.eq('branch_id', activeBranch.id);

    const [pat, doc, srv, box, invRes, commRes, payRes] = await Promise.all([
      supabase.from('patients').select('id,mrn,first_name_ar,last_name_ar').eq('organization_id', orgId).eq('is_active', true),
      supabase.from('doctors').select('id,specialty_title_ar,user:users(name_ar,name_en)').eq('organization_id', orgId).eq('is_active', true),
      supabase.from('services').select('id,code,name_ar,name_en,standard_price').eq('organization_id', orgId).eq('is_active', true).order('name_ar'),
      activeBranch?.id
        ? supabase.from('cashboxes').select('id,name,current_balance').eq('organization_id', orgId).eq('branch_id', activeBranch.id).eq('is_active', true)
        : Promise.resolve({ data: [], error: null }),
      invQuery,
      commQuery,
      payQuery,
    ]);

    if (pat.error || doc.error || srv.error || box.error || invRes.error) {
      error(ar ? 'تعذر تحميل بيانات الفوترة.' : 'Could not load billing data.');
      setLoading(false);
      return;
    }

    setPatients((pat.data || []) as PatientOption[]);
    setDoctors((doc.data || []) as unknown as DoctorOption[]);
    setServices((srv.data || []) as ServiceOption[]);
    setCashboxes((box.data || []) as CashboxOption[]);
    setInvoices((invRes.data || []) as unknown as InvoiceRow[]);
    setCommissions((commRes.data || []) as unknown as CommissionRow[]);
    setPayments((payRes.error ? [] : (payRes.data || [])) as unknown as PaymentRow[]);
    setLoading(false);
  }, [orgId, activeBranch?.id, ar, error]);

  useEffect(() => {
    void load();
  }, [load]);

  const createService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc('save_service', {
      p_code: serviceCode,
      p_name_ar: serviceAr,
      p_name_en: serviceEn,
      p_category: 'consultation',
      p_price: Number(servicePrice),
      p_cost: 0,
    });
    setSaving(false);
    if (rpcError || !data) {
      error(ar ? 'تعذر حفظ الخدمة.' : 'Could not save service.');
      return;
    }
    success(ar ? 'تم حفظ الخدمة.' : 'Service saved.');
    setServiceOpen(false);
    setServiceCode('');
    setServiceAr('');
    setServiceEn('');
    setServicePrice('');
    await load();
  };

  const createInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !activeBranch) {
      error(ar ? 'اختر فرعًا نشطًا.' : 'Select an active branch.');
      return;
    }
    setSaving(true);
    const result = await supabase.rpc('create_invoice', {
      p_branch_id: activeBranch.id,
      p_patient_id: patientId,
      p_service_id: serviceId,
      p_quantity: Number(quantity),
      p_discount: Number(discount),
      p_doctor_id: doctorId || null,
    });
    setSaving(false);
    if (result.error) {
      error(ar ? 'تعذر إصدار الفاتورة. راجع الخدمة والخصم والصلاحيات.' : 'Invoice could not be issued. Check service, discount, and permissions.');
      return;
    }
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    success(ar ? `تم إصدار الفاتورة ${row?.invoice_number || ''}` : `Invoice issued ${row?.invoice_number || ''}`);
    setInvoiceOpen(false);
    setQuantity('1');
    setDiscount('0');
    await load();
  };

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !payInvoice) return;
    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc('record_invoice_payment', {
      p_invoice_id: payInvoice.id,
      p_amount: Number(amount),
      p_payment_mode: mode,
      p_cashbox_id: cashboxId,
      p_transaction_reference: paymentRef.trim() || null,
    });
    setSaving(false);
    if (rpcError) {
      error(ar ? 'تعذر تسجيل الدفعة. راجع الرصيد والخزينة.' : 'Payment failed. Check the balance and cashbox.');
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    success(ar ? `تم تسجيل الإيصال ${row?.receipt_number || ''}` : `Payment receipt ${row?.receipt_number || ''} recorded.`);
    setPayInvoice(null);
    setPaymentRef('');
    await load();
  };

  if (!organization) return null;
  const total = invoices.reduce((sum, i) => sum + Number(i.total_amount), 0);
  const collected = invoices.reduce((sum, i) => sum + Number(i.paid_amount), 0);
  const due = invoices.reduce((sum, i) => sum + Number(i.balance_due), 0);
  const totalComm = commissions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const visibleInvoices = invoiceStatusFilter === 'all'
    ? invoices
    : invoices.filter(i => invoiceStatusFilter === 'pending' ? Number(i.balance_due) > 0 : Number(i.balance_due) <= 0);
  const visiblePayments = paymentModeFilter === 'all'
    ? payments
    : payments.filter(p => paymentModeFilter === '__wallets__' ? ['wallet', 'vodafone_cash'].includes(p.payment_mode) : p.payment_mode === paymentModeFilter);
  const methodTotals = payments.reduce<Record<string, number>>((acc, p) => {
    acc[p.payment_mode] = (acc[p.payment_mode] || 0) + Number(p.amount || 0);
    return acc;
  }, {});

  return (
    <main className="space-y-5" dir={ar ? 'rtl' : 'ltr'}>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <CreditCard className="h-6 w-6 text-medicore-600" />
            {t.billing.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ar ? 'الفواتير والمدفوعات وعمولات الأطباء المحفوظة في قاعدة البيانات.' : 'Invoices, payments, and doctor commissions stored in the database.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setServiceOpen(true)}
            disabled={!isOrgOwner}
            className="rounded-xl border px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {ar ? 'إضافة خدمة' : 'Add service'}
          </button>
          <button
            onClick={() => setInvoiceOpen(true)}
            disabled={!services.length || !activeBranch || !can('billing', 'create')}
            className="inline-flex items-center gap-2 rounded-xl bg-medicore-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {ar ? 'إصدار فاتورة' : 'Create invoice'}
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          [ar ? 'إجمالي الفواتير' : 'Total invoiced', total],
          [ar ? 'المحصل' : 'Collected', collected],
          [ar ? 'المتبقي' : 'Outstanding', due],
          [ar ? 'عمولات الأطباء' : 'Doctor commissions', totalComm],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border bg-white p-4">
            <p className="text-xs font-bold text-slate-500">{String(label)}</p>
            <p className="mt-1 text-xl font-black">
              {Number(value).toLocaleString()} {currency}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setViewTab('invoices')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold ${
              viewTab === 'invoices' ? 'bg-medicore-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            {ar ? `الفواتير (${invoices.length})` : `Invoices (${invoices.length})`}
          </button>
          <button
            type="button"
            onClick={() => setViewTab('commissions')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold ${
              viewTab === 'commissions' ? 'bg-medicore-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            {ar ? `عمولات الأطباء (${commissions.length})` : `Commissions (${commissions.length})`}
          </button>
        </div>
        {viewTab === 'invoices' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={invoiceStatusFilter}
              onChange={e => setInvoiceStatusFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-1.5 font-bold"
            >
              <option value="all">{ar ? 'كل حالات السداد' : 'All Invoice Statuses'}</option>
              <option value="pending">{ar ? 'قيد السداد فقط' : 'Pending Payment'}</option>
              <option value="paid">{ar ? 'تم السداد فقط' : 'Paid'}</option>
            </select>
            <select
              value={paymentModeFilter}
              onChange={e => setPaymentModeFilter(e.target.value)}
              className="rounded-xl border bg-white px-3 py-1.5 font-bold"
            >
              <option value="all">{ar ? 'كل وسائل التحصيل' : 'All Payment Methods'}</option>
              <option value="cash">{getPaymentModeLabel('cash', ar)}</option>
              <option value="instapay">{getPaymentModeLabel('instapay', ar)}</option>
              <option value="__wallets__">{ar ? 'كل المحافظ الإلكترونية' : 'All E-Wallets'}</option>
              {MODES.filter(m => m !== 'cash' && m !== 'instapay').map(m => (
                <option key={m} value={m}>{getPaymentModeLabel(m, ar)}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!services.length && (
        <aside className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          {ar ? 'أضف خدمة أولاً حتى تصدر فاتورة.' : 'Add a service before issuing an invoice.'}
        </aside>
      )}

      {viewTab === 'invoices' ? (
        <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="border-b p-4 font-bold">
            {ar ? 'الفواتير' : 'Invoices'} · {visibleInvoices.length}
          </div>
          {loading ? (
            <p className="p-8 text-sm text-slate-500">{ar ? 'جار التحميل...' : 'Loading...'}</p>
          ) : visibleInvoices.length === 0 ? (
            <p className="p-8 text-sm text-slate-500">{ar ? 'لا توجد فواتير مطابقة في هذا الفرع.' : 'No matching invoices for this branch.'}</p>
          ) : (
            <>
              <div className="divide-y md:hidden">
                {visibleInvoices.map((inv) => (
                  <article key={inv.id} className="p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-slate-900">{inv.invoice_number}</span>
                      <span className={`rounded-full px-2 py-0.5 font-bold ${Number(inv.balance_due) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {getClinicalStatusLabel(inv.status, ar)}
                      </span>
                    </div>
                    <p className="font-bold text-slate-800">{inv.patient?.first_name_ar} {inv.patient?.last_name_ar} · {inv.issue_date}</p>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                      <span>{ar ? 'الإجمالي:' : 'Total:'} {Number(inv.total_amount).toLocaleString()}</span>
                      <span>{ar ? 'المدفوع:' : 'Paid:'} {Number(inv.paid_amount).toLocaleString()}</span>
                      <span className="font-bold text-slate-900">{ar ? 'المتبقي:' : 'Balance:'} {Number(inv.balance_due).toLocaleString()} {currency}</span>
                    </div>
                    {Number(inv.balance_due) > 0 && (
                      <button
                        onClick={() => {
                          setPayInvoice(inv);
                          setAmount(String(inv.balance_due));
                          setCashboxId(cashboxes[0]?.id || '');
                        }}
                        disabled={!cashboxes.length}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white disabled:opacity-50"
                      >
                        <Wallet className="h-3 w-3" />
                        {ar ? 'تم السداد / تحصيل' : 'Collect'}
                      </button>
                    )}
                  </article>
                ))}
              </div>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {[ar ? 'رقم الفاتورة' : 'Invoice', ar ? 'المريض' : 'Patient', ar ? 'التاريخ' : 'Date', ar ? 'الإجمالي' : 'Total', ar ? 'المدفوع' : 'Paid', ar ? 'المتبقي' : 'Balance', ar ? 'الحالة' : 'Status', ''].map((h, i) => (
                        <th key={i} className="p-3 text-start">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleInvoices.map((inv) => (
                      <tr key={inv.id} className="border-t">
                        <td className="p-3 font-mono font-bold">{inv.invoice_number}</td>
                        <td className="p-3">
                          {inv.patient?.first_name_ar} {inv.patient?.last_name_ar}
                        </td>
                        <td className="p-3">{inv.issue_date}</td>
                        <td className="p-3">{Number(inv.total_amount).toLocaleString()}</td>
                        <td className="p-3">{Number(inv.paid_amount).toLocaleString()}</td>
                        <td className="p-3 font-bold">{Number(inv.balance_due).toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`rounded-full px-2 py-0.5 font-bold ${Number(inv.balance_due) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {getClinicalStatusLabel(inv.status, ar)}
                          </span>
                        </td>
                        <td className="p-3">
                          {Number(inv.balance_due) > 0 && (
                            <button
                              onClick={() => {
                                setPayInvoice(inv);
                                setAmount(String(inv.balance_due));
                                setCashboxId(cashboxes[0]?.id || '');
                              }}
                              disabled={!cashboxes.length}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-bold text-white disabled:opacity-50"
                            >
                              <Wallet className="h-3 w-3" />
                              {ar ? 'تحصيل' : 'Collect'}
                            </button>
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

        <section className="overflow-hidden rounded-2xl border bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-900">
              {ar ? `سجل التحصيلات حسب وسيلة الدفع (${visiblePayments.length})` : `Payment Receipts by Method (${visiblePayments.length})`}
            </h3>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1">{getPaymentModeLabel('cash', ar)}: {(methodTotals.cash || 0).toLocaleString()}</span>
              <span className="rounded-lg bg-purple-50 text-purple-800 px-2.5 py-1">{getPaymentModeLabel('instapay', ar)}: {(methodTotals.instapay || 0).toLocaleString()}</span>
              <span className="rounded-lg bg-teal-50 text-teal-800 px-2.5 py-1">{getPaymentModeLabel('wallet', ar)}: {((methodTotals.wallet || 0) + (methodTotals.vodafone_cash || 0)).toLocaleString()}</span>
            </div>
          </div>
          {visiblePayments.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">{ar ? 'لا توجد سندات تحصيل بهذه الوسيلة.' : 'No payment receipts for this method.'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-2.5 text-start">{ar ? 'الإيصال' : 'Receipt'}</th>
                    <th className="p-2.5 text-start">{ar ? 'المريض' : 'Patient'}</th>
                    <th className="p-2.5 text-start">{ar ? 'الوسيلة' : 'Method'}</th>
                    <th className="p-2.5 text-start">{ar ? 'المرجع' : 'Ref'}</th>
                    <th className="p-2.5 text-start">{ar ? 'المبلغ' : 'Amount'}</th>
                    <th className="p-2.5 text-start">{ar ? 'التاريخ' : 'Date'}</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePayments.slice(0, 25).map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="p-2.5 font-mono font-bold">{p.receipt_number}</td>
                      <td className="p-2.5">{p.patient ? `${p.patient.first_name_ar} ${p.patient.last_name_ar}` : '—'}</td>
                      <td className="p-2.5"><span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold">{getPaymentModeLabel(p.payment_mode, ar)}</span></td>
                      <td className="p-2.5 font-mono text-slate-500">{p.transaction_reference || '—'}</td>
                      <td className="p-2.5 font-mono font-bold text-emerald-700">{Number(p.amount).toLocaleString()} {currency}</td>
                      <td className="p-2.5 font-mono text-slate-500">{p.payment_date?.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </div>
      ) : (
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="border-b p-4 font-bold">
            {ar ? 'سجل عمولات الأطباء التلقائي' : 'Automated Doctor Commissions Ledger'} · {commissions.length}
          </div>
          {loading ? (
            <p className="p-8 text-sm text-slate-500">{ar ? 'جار التحميل...' : 'Loading...'}</p>
          ) : commissions.length === 0 ? (
            <p className="p-8 text-sm text-slate-500">
              {ar ? 'لا توجد عمولات مسجلة بعد. تُحتسب العمولات تلقائياً عند تحصيل فواتير الأطباء ذوي نسبة العمولة.' : 'No doctor commissions recorded yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="p-3 text-start">{ar ? 'التاريخ' : 'Date'}</th>
                    <th className="p-3 text-start">{ar ? 'الطبيب' : 'Doctor'}</th>
                    <th className="p-3 text-start">{ar ? 'رقم الفاتورة' : 'Invoice'}</th>
                    <th className="p-3 text-start">{ar ? 'مبلغ العمولة' : 'Commission'}</th>
                    <th className="p-3 text-start">{ar ? 'الحالة' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3 font-mono">{c.commission_date}</td>
                      <td className="p-3 font-bold">
                        {c.doctor?.user?.name_ar || c.doctor?.user?.name_en || c.doctor?.specialty_title_ar || '-'}
                      </td>
                      <td className="p-3 font-mono">{c.invoice?.invoice_number || '-'}</td>
                      <td className="p-3 font-black text-emerald-700">
                        {Number(c.amount).toLocaleString()} {currency}
                      </td>
                      <td className="p-3">
                        <span className={`rounded-full px-2.5 py-0.5 font-bold ${c.is_settled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                          {c.is_settled ? (ar ? 'مسوّاة' : 'Settled') : ar ? 'مستحقة' : 'Unsettled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {serviceOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={createService} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h2 className="text-lg font-black">{ar ? 'إضافة خدمة' : 'Add service'}</h2>
            <label className="block text-xs font-bold">
              {ar ? 'الكود' : 'Code'}
              <input required maxLength={50} value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5" />
            </label>
            <label className="block text-xs font-bold">
              {ar ? 'الاسم بالعربية' : 'Arabic name'}
              <input required value={serviceAr} onChange={(e) => setServiceAr(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5" />
            </label>
            <label className="block text-xs font-bold">
              {ar ? 'الاسم بالإنجليزية' : 'English name'}
              <input required value={serviceEn} onChange={(e) => setServiceEn(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5" />
            </label>
            <label className="block text-xs font-bold">
              {ar ? 'السعر' : 'Price'}
              <input required type="number" min="0" step="0.01" value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setServiceOpen(false)} className="rounded-xl border px-4 py-2">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button disabled={saving} className="rounded-xl bg-medicore-600 px-4 py-2 font-bold text-white">
                {ar ? 'حفظ الخدمة' : 'Save service'}
              </button>
            </div>
          </form>
        </div>
      )}

      {invoiceOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={createInvoice} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h2 className="text-lg font-black">{ar ? 'إصدار فاتورة' : 'Create invoice'}</h2>
            <label className="block text-xs font-bold">
              {ar ? 'المريض' : 'Patient'}
              <select required value={patientId} onChange={(e) => setPatientId(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5">
                <option value="">{ar ? 'اختر المريض...' : 'Select patient...'}</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name_ar} {p.last_name_ar} · {p.mrn}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold">
              {ar ? 'الخدمة' : 'Service'}
              <select required value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5">
                <option value="">{ar ? 'اختر الخدمة...' : 'Select service...'}</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {ar ? s.name_ar : s.name_en} · {Number(s.standard_price).toLocaleString()} {currency}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold">
              {ar ? 'الطبيب (اختياري)' : 'Doctor (optional)'}
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5">
                <option value="">—</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.user?.name_ar || d.specialty_title_ar}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-bold">
                {ar ? 'الكمية' : 'Quantity'}
                <input required type="number" min="1" max="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5" />
              </label>
              <label className="text-xs font-bold">
                {ar ? 'الخصم' : 'Discount'}
                <input required type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5" />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setInvoiceOpen(false)} className="rounded-xl border px-4 py-2">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button disabled={saving || !patients.length || !services.length} className="rounded-xl bg-medicore-600 px-4 py-2 font-bold text-white">
                {ar ? 'إصدار الفاتورة' : 'Issue invoice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {payInvoice && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <form onSubmit={recordPayment} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6">
            <h2 className="flex items-center gap-2 text-lg font-black">
              <Receipt className="h-5 w-5" />
              {ar ? 'تسجيل دفعة' : 'Record payment'}
            </h2>
            <p className="text-xs text-slate-500">
              {payInvoice.invoice_number} · {ar ? 'الرصيد' : 'Balance'} {Number(payInvoice.balance_due).toLocaleString()} {currency}
            </p>
            <label className="block text-xs font-bold">
              {ar ? 'المبلغ' : 'Amount'}
              <input required type="number" min="0.01" max={payInvoice.balance_due} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-xl border p-2.5" />
            </label>
            <label className="block text-xs font-bold">
              {ar ? 'الخزينة' : 'Cashbox'}
              <select required value={cashboxId} onChange={(e) => setCashboxId(e.target.value)} className="mt-1 w-full rounded-xl border bg-white p-2.5">
                {cashboxes.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold">
              {ar ? 'طريقة الدفع' : 'Payment method'}
              <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className="mt-1 w-full rounded-xl border bg-white p-2.5">
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {getPaymentModeLabel(m, ar)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-bold">
              {ar ? 'رقم مرجعي (إنستاباي / محفظة / تحويل - اختياري)' : 'Reference No (InstaPay / Wallet / Ref)'}
              <input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="INST-..." className="mt-1 w-full rounded-xl border p-2.5 font-mono text-xs" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPayInvoice(null)} className="rounded-xl border px-4 py-2">
                {ar ? 'إلغاء' : 'Cancel'}
              </button>
              <button disabled={saving || !cashboxId} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white">
                {ar ? 'تأكيد التحصيل' : 'Confirm payment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};
