// ============================================================================
// MEDICORE – Dedicated Patient Health Portal
// Self-Service Online Appointments, Approved Prescriptions & Lab Results
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { 
  Calendar, FileText, FlaskConical, Clock, Plus, 
  Download, Printer, Heart, CheckCircle2, ChevronRight
} from 'lucide-react';

export const PatientPortal: React.FC = () => {
  const { locale, t } = useLanguage();
  const { success, warning } = useToast();

  const [activeTab, setActiveTab] = useState<'appointments' | 'prescriptions' | 'labs'>('appointments');
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Default patient: Ahmed Mahmoud (pat-ahmed)
  const defaultPat = dbClient.getPatients('org-alnoor')[0];
  const patientId = defaultPat ? defaultPat.id : '';

  const orgId = defaultPat ? defaultPat.organization_id : 'org-alnoor';
  const appointments = dbClient.getAppointments(orgId).filter(a => a.patient_id === patientId);
  const prescriptions = dbClient.getPrescriptions(orgId, patientId);
  const doctors = dbClient.getDoctors(orgId);
  const branches = dbClient.getBranches(orgId);

  // Booking Form State
  const [selectedDocId, setSelectedDocId] = useState(doctors[0]?.id || '');
  const [selectedBranchId, setSelectedBranchId] = useState(branches[0]?.id || '');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bookingTime, setBookingTime] = useState('16:00');
  const [reason, setReason] = useState('');

  const handleBookOnline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDocId || !bookingDate || !bookingTime) return;

    try {
      const apt = dbClient.createAppointment(orgId, {
        branch_id: selectedBranchId,
        doctor_id: selectedDocId,
        patient_id: patientId,
        appointment_date: bookingDate,
        start_time: bookingTime,
        end_time: '16:20',
        type: 'new_consultation',
        status: 'confirmed',
        reason_for_visit: reason,
      });

      success(locale === 'ar' ? `تم تأكيد حجزك أونلاين برقم ${apt.appointment_number}` : `Appointment booked: ${apt.appointment_number}`);
      setShowBookingModal(false);
    } catch (err: any) {
      warning(err.message || t.appointments.doubleBookingPrevented);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Patient Welcome Banner */}
      <div className="bg-gradient-to-r from-teal-700 to-medicore-700 p-6 rounded-3xl text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 text-white uppercase tracking-wider">
            {locale === 'ar' ? 'البوابة الصحية الشخصية للمريض' : 'Patient Self-Service Portal'}
          </span>
          <h1 className="text-xl md:text-2xl font-black mt-2">
            {defaultPat ? `${defaultPat.first_name_ar} ${defaultPat.last_name_ar}` : t.portal.welcome}
          </h1>
          <p className="text-teal-100 text-xs md:text-sm mt-1">
            {t.portal.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowBookingModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-white text-teal-800 hover:bg-teal-50 text-xs font-bold rounded-xl shadow-md transition-all self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.portal.bookAppointment}</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('appointments')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'appointments'
              ? 'bg-medicore-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t.portal.myAppointments} ({appointments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('prescriptions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'prescriptions'
              ? 'bg-medicore-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t.portal.myPrescriptions} ({prescriptions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('labs')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'labs'
              ? 'bg-medicore-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>{t.portal.myLabResults}</span>
        </button>
      </div>

      {/* Tab 1: Appointments */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs divide-y divide-slate-100 overflow-hidden">
          {appointments.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>{locale === 'ar' ? 'لا توجد مواعيد محجوزة' : 'No appointments booked'}</p>
            </div>
          ) : (
            appointments.map(apt => (
              <div key={apt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex flex-col items-center justify-center shrink-0">
                    <span className="font-mono font-bold text-xs text-teal-800">{apt.appointment_date}</span>
                    <span className="font-mono text-[10px] text-slate-400">{apt.start_time}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      {apt.doctor?.user?.name_ar || apt.doctor?.specialty_title_ar}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {apt.branch?.name_ar} {apt.reason_for_visit && `• ${apt.reason_for_visit}`}
                    </p>
                  </div>
                </div>

                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 self-end sm:self-auto">
                  {t.appointments[`status_${apt.status}`] || apt.status}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Approved Prescriptions */}
      {activeTab === 'prescriptions' && (
        <div className="space-y-4">
          {prescriptions.map(rx => (
            <div key={rx.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-slate-900">{rx.prescription_number}</span>
                    <span className="text-xs text-slate-400 font-mono">({rx.issued_date})</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {locale === 'ar' ? 'الطبيب المعالج:' : 'Doctor:'} {rx.doctor?.user?.name_ar}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{locale === 'ar' ? 'طباعة الروشتة' : 'Print Rx'}</span>
                </button>
              </div>

              <div className="divide-y divide-slate-100">
                {rx.items?.map((it, idx) => (
                  <div key={it.id || idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{it.drug_name}</p>
                      <p className="text-slate-500">{it.instructions || it.dosage}</p>
                    </div>
                    <div className="text-end font-semibold text-slate-700">
                      <span>{it.frequency}</span>
                      <span className="text-slate-400 ms-1 font-normal">({it.duration})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Lab Results */}
      {activeTab === 'labs' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs text-center text-slate-500 text-xs">
          <FlaskConical className="w-10 h-10 mx-auto text-purple-400 mb-2 opacity-50" />
          <p className="font-bold text-sm text-slate-800">{locale === 'ar' ? 'سجل التحاليل والأشعة الطبية' : 'Diagnostic Results'}</p>
          <p className="mt-1 text-slate-400">
            {locale === 'ar' ? 'تظهر هنا تقارير الفحوصات والتحاليل بمجرد اعتمادها من أخصائي المختبر' : 'Approved lab & radiology reports appear here once released by the clinic'}
          </p>
        </div>
      )}

      {/* Online Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              {t.portal.bookAppointment}
            </h3>

            <form onSubmit={handleBookOnline} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'الفرع المطلوب' : 'Clinic Branch'}
                </label>
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name_ar}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.appointments.selectDoctor}
                </label>
                <select
                  value={selectedDocId}
                  onChange={e => setSelectedDocId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.user ? d.user.name_ar : ''} — {d.specialty_title_ar} (كشف: {d.consultation_fee} ج.م)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.appointments.appointmentDate}
                  </label>
                  <input
                    type="date"
                    required
                    value={bookingDate}
                    onChange={e => setBookingDate(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.appointments.appointmentTime}
                  </label>
                  <input
                    type="time"
                    required
                    value={bookingTime}
                    onChange={e => setBookingTime(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.appointments.reason}
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={locale === 'ar' ? 'سبب الزيارة أو الأعراض...' : 'Reason for visit...'}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {locale === 'ar' ? 'تأكيد الحجز أونلاين' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
