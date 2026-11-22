// ============================================================================
// MEDICORE – Laboratory Orders & Diagnostic Results
// Test Catalog, Sample Collection, Reference Ranges & Approval Workflow
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { INITIAL_LAB_TESTS } from '../../lib/mockData';
import { FlaskConical, Plus, Search, CheckCircle2, AlertTriangle, FileText, X } from 'lucide-react';

export const Laboratory: React.FC = () => {
  const { organization, activeBranch, user } = useAuth();
  const { locale, t } = useLanguage();
  const { success } = useToast();

  if (!organization) return null;
  const orgId = organization.id;

  const tests = INITIAL_LAB_TESTS;
  const patients = dbClient.getPatients(orgId);
  const doctors = dbClient.getDoctors(orgId);

  const [orders, setOrders] = useState([
    {
      id: 'lab-ord-1',
      orderNumber: 'LAB-2026-001',
      patientName: 'أحمد محمود حسن',
      mrn: 'MRN-2026-001',
      doctorName: 'د. طارق السعيد',
      testName: 'Complete Blood Count (CBC) + ESR',
      status: 'completed',
      priority: 'routine',
      date: '2026-11-22',
      results: 'Hb: 14.2 g/dL (Normal: 13-17.5), WBC: 7.8 x10^3/uL (Normal: 4-11), ESR: 12 mm/hr'
    }
  ]);

  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState(patients[0]?.id || '');
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctors[0]?.id || '');
  const [selectedTestId, setSelectedTestId] = useState(tests[0]?.id || '');
  const [clinicalIndication, setClinicalIndication] = useState('');

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const pat = patients.find(p => p.id === selectedPatientId);
    const doc = doctors.find(d => d.id === selectedDoctorId);
    const test = tests.find(t => t.id === selectedTestId);

    const newOrd = {
      id: `lab-ord-${Date.now()}`,
      orderNumber: `LAB-2026-${(orders.length + 1).toString().padStart(3, '0')}`,
      patientName: pat ? `${pat.first_name_ar} ${pat.last_name_ar}` : 'Patient',
      mrn: pat?.mrn || '',
      doctorName: doc?.user?.name_ar || 'Doctor',
      testName: test ? test[locale === 'ar' ? 'name_ar' : 'name_en'] : 'Test',
      status: 'in_progress',
      priority: 'routine',
      date: new Date().toISOString().split('T')[0],
      results: 'في انتظار فحص العينة بالمعمل'
    };

    setOrders([newOrd, ...orders]);
    success(locale === 'ar' ? 'تم إنشاء طلب التحليل بنجاح' : 'Lab order created successfully');
    setShowNewOrderModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-600" />
            {t.nav.laboratory}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' ? 'دليل التحاليل، سحب العينات، تسجيل النتائج وتحديد المعدلات الطبيعية' : 'Laboratory test orders, specimen processing, and results'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewOrderModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{locale === 'ar' ? 'طلب تحليل جديد' : 'New Lab Order'}</span>
        </button>
      </div>

      {/* Tests Catalog Preview */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
        <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-slate-400 mb-3">
          {locale === 'ar' ? 'دليل التحاليل المعملية المعتمدة' : 'Verified Laboratory Tests Catalog'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tests.map(t => (
            <div key={t.id} className="p-3 rounded-xl bg-purple-50/40 border border-purple-100 flex items-center justify-between text-xs">
              <div>
                <span className="font-mono font-bold text-purple-900">{t.test_code}</span>
                <p className="font-bold text-slate-800">{t[locale === 'ar' ? 'name_ar' : 'name_en']}</p>
                <p className="text-[10px] text-slate-500">{t.reference_range_text}</p>
              </div>
              <span className="font-mono font-bold text-purple-700">{t.price} ج.م</span>
            </div>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
            {orders.length} {locale === 'ar' ? 'طلبات تحاليل مسجلة' : 'Lab Orders'}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {orders.map(ord => (
            <div key={ord.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs text-purple-700">{ord.orderNumber}</span>
                  <span className="font-bold text-sm text-slate-900">{ord.patientName}</span>
                  <span className="text-xs text-slate-400 font-mono">({ord.mrn})</span>
                </div>
                <p className="text-xs font-semibold text-slate-700 mt-1">{ord.testName}</p>
                <p className="text-xs text-slate-500 mt-0.5">{ord.results}</p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  ord.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {ord.status === 'completed' ? 'مكتمل ومعتمد' : 'جاري الفحص'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Lab Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-600" />
              {locale === 'ar' ? 'طلب تحليل معملي جديد' : 'Order Laboratory Test'}
            </h3>

            <form onSubmit={handleCreateOrder} className="space-y-4">
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
                  {locale === 'ar' ? 'التحليل المطلوب' : 'Test'} *
                </label>
                <select
                  required
                  value={selectedTestId}
                  onChange={e => setSelectedTestId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  {tests.map(t => (
                    <option key={t.id} value={t.id}>
                      {t[locale === 'ar' ? 'name_ar' : 'name_en']} — {t.price} ج.م
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'دواعي الفحص السريري' : 'Clinical Indication'}
                </label>
                <textarea
                  rows={2}
                  value={clinicalIndication}
                  onChange={e => setClinicalIndication(e.target.value)}
                  placeholder={locale === 'ar' ? 'اشتباه أنيميا، ارتفاع مؤشرات الالتهاب...' : 'Suspected anemia, infection...'}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl"
                >
                  {locale === 'ar' ? 'إرسال الطلب للمعمل' : 'Submit Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
