// ============================================================================
// MEDICORE – Advanced Appointment Scheduling & Double-Booking Guard Engine
// Branch & Doctor Calendar with Realtime Reception Check-In Queue
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { Appointment, AppointmentStatus, AppointmentType } from '../../types/database';
import { 
  Calendar, Clock, User, Plus, CheckCircle, XCircle, 
  AlertTriangle, Filter, ChevronLeft, ChevronRight, Stethoscope,
  Building2, Check
} from 'lucide-react';

export const Appointments: React.FC = () => {
  const { organization, activeBranch } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error, warning } = useToast();

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Booking Form State
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('11:00');
  const [appointmentType, setAppointmentType] = useState<AppointmentType>('new_consultation');
  const [reason, setReason] = useState('');

  if (!organization) return null;
  const orgId = organization.id;

  const doctors = dbClient.getDoctors(orgId);
  const patients = dbClient.getPatients(orgId);
  const branches = dbClient.getBranches(orgId);

  const appointments = dbClient.getAppointments(orgId, {
    branchId: activeBranch?.id,
    doctorId: selectedDoctorId !== 'all' ? selectedDoctorId : undefined,
    date: selectedDate,
    status: statusFilter !== 'all' ? statusFilter : undefined,
  });

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !doctorId || !appointmentDate || !startTime) {
      warning(t.common.required);
      return;
    }

    try {
      const created = dbClient.createAppointment(orgId, {
        branch_id: activeBranch?.id || branches[0].id,
        doctor_id: doctorId,
        patient_id: patientId,
        appointment_date: appointmentDate,
        start_time: startTime,
        end_time: calculateEndTime(startTime, 20),
        type: appointmentType,
        status: 'confirmed',
        reason_for_visit: reason,
      });

      success(locale === 'ar' ? `تم حجز الموعد بنجاح برقم ${created.appointment_number}` : `Appointment booked: ${created.appointment_number}`);
      setShowBookingModal(false);
      setReason('');
    } catch (err: any) {
      error(err.message || t.appointments.doubleBookingPrevented);
    }
  };

  const calculateEndTime = (start: string, durationMinutes: number) => {
    const [h, m] = start.split(':').map(Number);
    const totalMinutes = h * 60 + m + durationMinutes;
    const endH = Math.floor(totalMinutes / 60) % 24;
    const endM = totalMinutes % 60;
    return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
  };

  const handleUpdateStatus = (id: string, newStatus: AppointmentStatus) => {
    dbClient.updateAppointmentStatus(id, newStatus);
    success(locale === 'ar' ? 'تم تحديث حالة الموعد' : 'Appointment status updated');
  };

  return (
    <div className="space-y-6">
      {/* Header & Date Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-medicore-600" />
            {t.appointments.schedule}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' ? 'محرك الحجوزات الذكي، حماية التعارض وتدفق صالة الانتظار' : 'Intelligent booking engine, conflict prevention, and queue'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (doctors.length > 0) setDoctorId(doctors[0].id);
            if (patients.length > 0) setPatientId(patients[0].id);
            setShowBookingModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t.appointments.newAppointment}</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* Date Selector */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="text-xs font-bold p-2 rounded-xl border border-slate-300 bg-white"
          />
          <button
            type="button"
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            {locale === 'ar' ? 'اليوم' : 'Today'}
          </button>
        </div>

        {/* Doctor & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Doctor Filter */}
          <select
            value={selectedDoctorId}
            onChange={e => setSelectedDoctorId(e.target.value)}
            className="text-xs font-bold p-2 rounded-xl border border-slate-300 bg-white"
          >
            <option value="all">{locale === 'ar' ? 'جميع الأطباء' : 'All Doctors'}</option>
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {d.user ? d.user[locale === 'ar' ? 'name_ar' : 'name_en'] : d.specialty_title_ar}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs font-bold p-2 rounded-xl border border-slate-300 bg-white"
          >
            <option value="all">{locale === 'ar' ? 'جميع الحالات' : 'All Statuses'}</option>
            <option value="pending">{t.appointments.status_pending}</option>
            <option value="confirmed">{t.appointments.status_confirmed}</option>
            <option value="checked_in">{t.appointments.status_checked_in}</option>
            <option value="waiting">{t.appointments.status_waiting}</option>
            <option value="in_consultation">{t.appointments.status_in_consultation}</option>
            <option value="completed">{t.appointments.status_completed}</option>
            <option value="cancelled">{t.appointments.status_cancelled}</option>
          </select>
        </div>
      </div>

      {/* Appointments List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
            {appointments.length} {locale === 'ar' ? 'مواعيد مسجلة لهذا التاريخ' : 'Appointments Scheduled'}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {appointments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>{locale === 'ar' ? 'لا توجد مواعيد مسجلة في هذا اليوم أو التصفية' : 'No appointments scheduled for this selection'}</p>
            </div>
          ) : (
            appointments.map(apt => {
              const statusStyles: Record<AppointmentStatus, string> = {
                pending: 'bg-slate-100 text-slate-700',
                confirmed: 'bg-sky-100 text-sky-800',
                checked_in: 'bg-emerald-100 text-emerald-800 font-bold',
                waiting: 'bg-amber-100 text-amber-800',
                in_consultation: 'bg-indigo-100 text-indigo-800 animate-pulse font-bold',
                completed: 'bg-slate-100 text-slate-500',
                cancelled: 'bg-rose-100 text-rose-800 line-through',
                no_show: 'bg-rose-50 text-rose-600',
              };

              return (
                <div key={apt.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-medicore-50 border border-medicore-100 flex flex-col items-center justify-center shrink-0">
                      <span className="font-mono font-bold text-xs text-medicore-700">{apt.start_time}</span>
                      <span className="text-[9px] text-slate-400 font-mono">{apt.end_time}</span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {apt.patient ? `${apt.patient.first_name_ar} ${apt.patient.last_name_ar}` : ''}
                        </span>
                        <span className="text-xs font-mono text-slate-400">({apt.patient?.mrn})</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {locale === 'ar' ? 'الطبيب:' : 'Doctor:'} {apt.doctor?.user?.name_ar || apt.doctor?.specialty_title_ar}
                        {apt.reason_for_visit && ` — ${apt.reason_for_visit}`}
                      </p>
                    </div>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${statusStyles[apt.status]}`}>
                      {t.appointments[`status_${apt.status}`] || apt.status}
                    </span>

                    {/* Reception quick transitions */}
                    {apt.status === 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(apt.id, 'checked_in')}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg"
                      >
                        {t.appointments.checkIn}
                      </button>
                    )}

                    {apt.status === 'checked_in' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(apt.id, 'waiting')}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg"
                      >
                        {locale === 'ar' ? 'تحويل للانتظار' : 'To Waiting Room'}
                      </button>
                    )}

                    {['pending', 'confirmed'].includes(apt.status) && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(apt.id, 'cancelled')}
                        className="px-2.5 py-1 text-slate-400 hover:text-rose-600 text-xs rounded-lg"
                        title={t.common.cancel}
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Book Appointment Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-medicore-600" />
              {t.appointments.newAppointment}
            </h3>

            <form onSubmit={handleCreateAppointment} className="space-y-4">
              {/* Patient Selection */}
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
                  <option value="">{locale === 'ar' ? '-- اختر المريض --' : '-- Select Patient --'}</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.first_name_ar} {p.last_name_ar} ({p.mrn}) — {p.phone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t.appointments.selectDoctor} *
                </label>
                <select
                  required
                  value={doctorId}
                  onChange={e => setDoctorId(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  <option value="">{locale === 'ar' ? '-- اختر الطبيب المعالج --' : '-- Select Doctor --'}</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.user ? d.user[locale === 'ar' ? 'name_ar' : 'name_en'] : ''} ({d[locale === 'ar' ? 'specialty_title_ar' : 'specialty_title_en']})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.appointments.appointmentDate} *
                  </label>
                  <input
                    type="date"
                    required
                    value={appointmentDate}
                    onChange={e => setAppointmentDate(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.appointments.appointmentTime} *
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
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
                  placeholder={locale === 'ar' ? 'شكوى المريض الأولية أو سبب الزيارة...' : 'Initial patient complaint...'}
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
                  className="px-5 py-2 text-sm bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {t.appointments.newAppointment}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
