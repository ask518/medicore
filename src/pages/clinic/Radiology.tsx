// ============================================================================
// MEDICORE – Radiology & Diagnostic Imaging Module
// X-Ray, CT, MRI, Ultrasound Imaging Orders, Reports & DICOM Workflows
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { Radio, Plus, Eye, FileText, CheckCircle2, Link2, X } from 'lucide-react';

export const Radiology: React.FC = () => {
  const { organization, activeBranch } = useAuth();
  const { locale, t } = useLanguage();
  const { success } = useToast();

  if (!organization) return null;
  const orgId = organization.id;

  const orders = dbClient.getRadOrders(orgId);
  const patients = dbClient.getPatients(orgId);
  const doctors = dbClient.getDoctors(orgId);

  const [showModal, setShowModal] = useState(false);
  const [patientId, setPatientId] = useState(patients[0]?.id || '');
  const [doctorId, setDoctorId] = useState(doctors[0]?.id || '');
  const [modality, setModality] = useState('MRI');
  const [bodyPart, setBodyPart] = useState('الركبة اليمنى (Right Knee)');
  const [findingsReport, setFindingsReport] = useState('');

  const handleCreateRadOrder = (e: React.FormEvent) => {
    e.preventDefault();
    dbClient.createRadOrder(orgId, {
      branch_id: activeBranch?.id || 'branch-alnoor-main',
      patient_id: patientId,
      doctor_id: doctorId,
      imaging_modality: modality,
      body_part: bodyPart,
      status: 'requested',
      findings_report: findingsReport || 'طلب فحص إشعاعي تشخيصي معتمد',
    });

    success(locale === 'ar' ? 'تم إنشاء طلب الأشعة بنجاح' : 'Radiology order created');
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Radio className="w-6 h-6 text-fuchsia-600" />
            {t.nav.radiology}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' ? 'طلبات الأشعة السينية، الرنين المغناطيسي، المقطعية والموجات الصوتية وربط DICOM' : 'Radiology orders (X-Ray, CT, MRI, Ultrasound) & DICOM viewer'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold rounded-xl shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{locale === 'ar' ? 'طلب فحص أشعة جديد' : 'New Radiology Order'}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
            {orders.length} {locale === 'ar' ? 'فحوصات أشعة مسجلة' : 'Radiology Orders'}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {orders.map(ord => (
            <div key={ord.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-fuchsia-50 text-fuchsia-700 font-bold text-xs flex flex-col items-center justify-center shrink-0">
                  <span>{ord.imaging_modality}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-fuchsia-700">{ord.order_number}</span>
                    <span className="font-bold text-sm text-slate-900">{ord.body_part}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{ord.findings_report}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  {ord.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Radio className="w-5 h-5 text-fuchsia-600" />
              {locale === 'ar' ? 'طلب فحص إشعاعي تشخيصي' : 'Order Imaging Study'}
            </h3>

            <form onSubmit={handleCreateRadOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.appointments.selectPatient} *
                </label>
                <select
                  required
                  value={patientId}
                  onChange={e => setPatientId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.first_name_ar} {p.last_name_ar} ({p.mrn})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'نوع التصوير' : 'Modality'}
                  </label>
                  <select
                    value={modality}
                    onChange={e => setModality(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white font-bold"
                  >
                    <option value="X-Ray">X-Ray (أشعة سينية عادية)</option>
                    <option value="MRI">MRI (رنين مغناطيسي)</option>
                    <option value="CT">CT (أشعة مقطعية)</option>
                    <option value="Ultrasound">Ultrasound (سونار)</option>
                    <option value="Mammography">Mammography (ماموجرام)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'العضو / المنطقة' : 'Body Part'}
                  </label>
                  <input
                    type="text"
                    required
                    value={bodyPart}
                    onChange={e => setBodyPart(e.target.value)}
                    placeholder="مثال: الركبة اليمنى"
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'الشكوى السريرية ودواعي الفحص' : 'Clinical Indication'}
                </label>
                <textarea
                  rows={2}
                  value={findingsReport}
                  onChange={e => setFindingsReport(e.target.value)}
                  placeholder={locale === 'ar' ? 'اشتباه كسر، تمزق غضروف، استبعاد خشونة...' : 'Suspected fracture, meniscus tear...'}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-bold rounded-xl"
                >
                  {locale === 'ar' ? 'إرسال لمركز الأشعة' : 'Submit Radiology Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
