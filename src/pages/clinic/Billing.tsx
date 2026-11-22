// ============================================================================
// MEDICORE – Financial Management, Invoicing, Cashboxes & Doctor Commissions
// Immutable Financial Ledgers, Payment Collection & Daily Cashbox Closing
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { Invoice, PaymentMode, InvoiceStatus } from '../../types/database';
import { 
  CreditCard, DollarSign, Plus, Receipt, CheckCircle2, 
  Clock, ArrowUpRight, ArrowDownLeft, X, Printer, Lock
} from 'lucide-react';

export const Billing: React.FC = () => {
  const { organization, activeBranch, user } = useAuth();
  const { locale, t } = useLanguage();
  const { success, warning } = useToast();

  if (!organization) return null;
  const orgId = organization.id;

  const invoices = dbClient.getInvoices(orgId);
  const cashboxes = dbClient.getCashboxes(orgId);
  const services = dbClient.getServices(orgId);
  const patients = dbClient.getPatients(orgId);
  const doctors = dbClient.getDoctors(orgId);
  const commissions = dbClient.getCommissions(orgId);

  // States
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);

  // New Invoice Form
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || '');
  const [selectedServiceId, setSelectedServiceId] = useState(services[0]?.id || '');
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [selectedCashboxId, setSelectedCashboxId] = useState(cashboxes[0]?.id || '');

  // Totals
  const totalBilled = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.paid_amount, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.balance_due, 0);

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedServiceId) return;

    const srv = services.find(s => s.id === selectedServiceId);
    if (!srv) return;

    const subtotal = srv.standard_price;
    const net = Math.max(0, subtotal - invoiceDiscount);

    const created = dbClient.createInvoice(orgId, {
      branch_id: activeBranch?.id || 'branch-alnoor-main',
      patient_id: selectedPatientId,
      doctor_id: selectedDoctorId || undefined,
      issue_date: new Date().toISOString().split('T')[0],
      subtotal,
      discount_amount: invoiceDiscount,
      tax_amount: 0,
      total_amount: net,
      paid_amount: 0,
      balance_due: net,
      status: 'unpaid',
      created_by: user?.id,
      items: [
        {
          id: `invi-${Date.now()}`,
          organization_id: orgId,
          invoice_id: '',
          service_id: srv.id,
          description: srv[locale === 'ar' ? 'name_ar' : 'name_en'],
          quantity: 1,
          unit_price: srv.standard_price,
          discount: invoiceDiscount,
          total_price: net,
          created_at: new Date().toISOString(),
        }
      ]
    });

    success(locale === 'ar' ? `تم إصدار الفاتورة رقم ${created.invoice_number}` : `Invoice created: ${created.invoice_number}`);
    setShowNewInvoiceModal(false);
  };

  const handleOpenPayment = (inv: Invoice) => {
    setSelectedInvoiceForPayment(inv);
    setPaymentAmount(inv.balance_due);
    setShowPaymentModal(true);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment || paymentAmount <= 0) return;

    const pay = dbClient.recordPayment(orgId, {
      branch_id: activeBranch?.id || 'branch-alnoor-main',
      invoice_id: selectedInvoiceForPayment.id,
      patient_id: selectedInvoiceForPayment.patient_id,
      cashbox_id: selectedCashboxId || undefined,
      payment_date: new Date().toISOString(),
      amount: paymentAmount,
      payment_mode: paymentMode,
      is_reversal: false,
      received_by: user?.id,
    });

    success(locale === 'ar' ? `تم تسجيل إيصال التحصيل رقم ${pay.receipt_number} بمبلغ ${paymentAmount} ج.م` : `Payment recorded: ${pay.receipt_number}`);
    setShowPaymentModal(false);
    setSelectedInvoiceForPayment(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-medicore-600" />
            {t.billing.title}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' ? 'الفوترة الإلكترونية، تحصيل الدفعات، إغلاق الخزائن وعمولات الأطباء' : 'Invoicing, Cashbox Ledger, Collections & Doctor Commissions'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewInvoiceModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white text-xs font-bold rounded-xl shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{locale === 'ar' ? 'إصدار فاتورة جديدة' : 'Create Invoice'}</span>
        </button>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{locale === 'ar' ? 'إجمالي الفواتير الصادرة' : 'Total Billed'}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">
            {totalBilled.toLocaleString()} <span className="text-xs font-semibold text-slate-500">ج.م</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-emerald-600">{t.billing.paidAmount}</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">
            {totalCollected.toLocaleString()} <span className="text-xs font-semibold text-slate-500">ج.م</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-amber-600">{t.billing.balanceDue}</p>
          <p className="text-2xl font-black text-amber-700 mt-1">
            {totalOutstanding.toLocaleString()} <span className="text-xs font-semibold text-slate-500">ج.م</span>
          </p>
        </div>
      </div>

      {/* Cashbox Status Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <h3 className="font-bold text-slate-900 text-sm">
            {locale === 'ar' ? 'أرصدة الخزائن النشطة بالمنشأة' : 'Active Facility Cashboxes'}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {cashboxes.map(cb => (
            <div key={cb.id} className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center gap-2">
              <span className="font-semibold text-slate-700">{cb.name}:</span>
              <span className="font-mono font-bold text-emerald-700">{cb.current_balance.toLocaleString()} ج.م</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
            {invoices.length} {locale === 'ar' ? 'فاتورة مسجلة' : 'Invoices'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3.5 text-start">{t.billing.invoiceNumber}</th>
                <th className="p-3.5 text-start">{t.emr.patientFile}</th>
                <th className="p-3.5 text-start">{locale === 'ar' ? 'الطبيب' : 'Doctor'}</th>
                <th className="p-3.5 text-start">{t.billing.netTotal}</th>
                <th className="p-3.5 text-start">{t.billing.paidAmount}</th>
                <th className="p-3.5 text-start">{t.billing.balanceDue}</th>
                <th className="p-3.5 text-start">{t.common.status}</th>
                <th className="p-3.5 text-end">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(inv => {
                const statusStyles: Record<InvoiceStatus, string> = {
                  paid: 'bg-emerald-100 text-emerald-800',
                  partially_paid: 'bg-amber-100 text-amber-800',
                  unpaid: 'bg-rose-100 text-rose-800',
                  draft: 'bg-slate-100 text-slate-600',
                  refunded: 'bg-purple-100 text-purple-800',
                  void: 'bg-slate-200 text-slate-500 line-through',
                };

                return (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-slate-800">
                      {inv.invoice_number}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">
                      {inv.patient ? `${inv.patient.first_name_ar} ${inv.patient.last_name_ar}` : ''}
                    </td>
                    <td className="p-3.5 text-slate-600">
                      {inv.doctor?.user?.name_ar || inv.doctor?.specialty_title_ar || '—'}
                    </td>
                    <td className="p-3.5 font-bold font-mono text-slate-900">{inv.total_amount} ج.م</td>
                    <td className="p-3.5 font-bold font-mono text-emerald-700">{inv.paid_amount} ج.م</td>
                    <td className="p-3.5 font-bold font-mono text-amber-700">{inv.balance_due} ج.م</td>
                    <td className="p-3.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${statusStyles[inv.status]}`}>
                        {t.billing[`status_${inv.status}`] || inv.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-end">
                      {inv.balance_due > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenPayment(inv)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs"
                        >
                          {t.billing.receivePayment}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Doctor Commissions Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
        <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-amber-500" />
          {t.billing.doctorCommissions}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {commissions.map(com => (
            <div key={com.id} className="p-3.5 rounded-xl border border-slate-100 bg-amber-50/30 flex items-center justify-between">
              <div>
                <p className="font-bold text-xs text-slate-900">
                  {com.doctor?.user?.name_ar || 'د. استشاري'}
                </p>
                <p className="text-[11px] text-slate-500">{com.commission_date}</p>
              </div>
              <div className="text-end">
                <span className="font-mono font-bold text-sm text-amber-900">
                  {com.amount} ج.م
                </span>
                <p className="text-[10px] text-emerald-600 font-semibold">
                  {com.is_settled ? 'تمت التسوية' : 'مستحق الصرف'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Invoice Modal */}
      {showNewInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-medicore-600" />
              {locale === 'ar' ? 'إصدار فاتورة كشف أو خدمة جديدة' : 'Create Patient Invoice'}
            </h3>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.appointments.selectPatient} *
                </label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={e => setSelectedPatientId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.first_name_ar} {p.last_name_ar} ({p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'الخدمة أو الكشف' : 'Service / Procedure'} *
                </label>
                <select
                  required
                  value={selectedServiceId}
                  onChange={e => setSelectedServiceId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s[locale === 'ar' ? 'name_ar' : 'name_en']} — {s.standard_price} ج.م
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'الطبيب المعالج' : 'Doctor'}
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={e => setSelectedDoctorId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.user ? d.user[locale === 'ar' ? 'name_ar' : 'name_en'] : ''} ({d[locale === 'ar' ? 'specialty_title_ar' : 'specialty_title_en']})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.billing.discount} (ج.م)
                </label>
                <input
                  type="number"
                  min="0"
                  value={invoiceDiscount}
                  onChange={e => setInvoiceDiscount(Number(e.target.value))}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewInvoiceModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl"
                >
                  {t.common.confirm}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              {t.billing.receivePayment}
            </h3>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs">
                <div className="flex justify-between font-bold text-emerald-950">
                  <span>{t.billing.invoiceNumber}: {selectedInvoiceForPayment.invoice_number}</span>
                  <span>المتبقي: {selectedInvoiceForPayment.balance_due} ج.م</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'المبلغ المحصل الآن (ج.م)' : 'Amount (EGP)'} *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedInvoiceForPayment.balance_due}
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(Number(e.target.value))}
                  className="w-full text-sm font-bold font-mono rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.billing.paymentMode} *
                </label>
                <select
                  value={paymentMode}
                  onChange={e => setPaymentMode(e.target.value as PaymentMode)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white font-semibold"
                >
                  <option value="cash">{t.billing.cash}</option>
                  <option value="credit_card">{t.billing.visa}</option>
                  <option value="bank_transfer">{t.billing.transfer}</option>
                  <option value="vodafone_cash">{t.billing.vodafoneCash}</option>
                  <option value="fawry">{t.billing.fawry}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'توريد إلى الخزينة' : 'Deposit into Cashbox'}
                </label>
                <select
                  value={selectedCashboxId}
                  onChange={e => setSelectedCashboxId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  {cashboxes.map(cb => (
                    <option key={cb.id} value={cb.id}>{cb.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {t.billing.receivePayment}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
