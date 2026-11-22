// ============================================================================
// MEDICORE – Advanced Healthcare & Financial Reports Engine
// Branch Comparisons, Doctor Productivity, Revenue & Export to CSV/Excel
// ============================================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { 
  BarChart3, Download, Printer, DollarSign, Calendar, 
  Users, Stethoscope, Building2, TrendingUp
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { organization } = useAuth();
  const { locale, t } = useLanguage();
  const { success } = useToast();

  if (!organization) return null;
  const orgId = organization.id;

  const invoices = dbClient.getInvoices(orgId);
  const appointments = dbClient.getAppointments(orgId);
  const patients = dbClient.getPatients(orgId);
  const doctors = dbClient.getDoctors(orgId);
  const branches = dbClient.getBranches(orgId);

  const totalRevenue = invoices.reduce((s, i) => s + i.paid_amount, 0);

  const handleExportCSV = () => {
    const headers = ['Invoice Number', 'Issue Date', 'Patient Name', 'Total Amount', 'Paid Amount', 'Status'];
    const rows = invoices.map(i => [
      i.invoice_number,
      i.issue_date,
      i.patient ? `${i.patient.first_name_ar} ${i.patient.last_name_ar}` : 'Patient',
      i.total_amount,
      i.paid_amount,
      i.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medicore_financial_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    success(locale === 'ar' ? 'تم تصدير ملف التقرير المالي CSV بنجاح' : 'Financial CSV exported successfully');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-cyan-600" />
            {t.nav.reports}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' ? 'التقارير التحليلية المتقدمة، مؤشرات الأداء المالي والسريري وتصدير البيانات' : 'Advanced Clinical & Financial Performance Analytics and Data Export'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>{t.reports.exportExcel}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl"
          >
            <Printer className="w-4 h-4" />
            <span>{t.reports.exportPdf}</span>
          </button>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{locale === 'ar' ? 'إجمالي الإيرادات المحصلة' : 'Total Revenue'}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{totalRevenue.toLocaleString()} ج.م</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{locale === 'ar' ? 'عدد المواعيد الكلية' : 'Total Appointments'}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{appointments.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{locale === 'ar' ? 'عدد المرضى المسجلين' : 'Total Patients'}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{patients.length}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-bold text-slate-500">{locale === 'ar' ? 'عدد الأطباء الممارسين' : 'Active Doctors'}</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{doctors.length}</p>
        </div>
      </div>

      {/* Branch Performance Comparison */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 pb-2 border-b border-slate-100">
          <Building2 className="w-5 h-5 text-medicore-600" />
          {t.reports.revenueByBranch}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map(b => {
            const branchApts = appointments.filter(a => a.branch_id === b.id);
            const branchInvs = invoices.filter(i => i.branch_id === b.id);
            const branchRev = branchInvs.reduce((s, i) => s + i.paid_amount, 0);

            return (
              <div key={b.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between font-bold text-sm text-slate-900">
                  <span>{b[locale === 'ar' ? 'name_ar' : 'name_en']}</span>
                  <span className="text-emerald-700 font-mono">{branchRev.toLocaleString()} ج.م</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{locale === 'ar' ? 'المواعيد المنفذة:' : 'Appointments:'} {branchApts.length}</span>
                  <span>{locale === 'ar' ? 'الفواتير:' : 'Invoices:'} {branchInvs.length}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
