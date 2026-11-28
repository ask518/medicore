// ============================================================================
// MEDICORE – Verified Patient Portal Module
// Clinic-Verified MRN + Code Linking, Online Appointment Booking, Prescriptions,
// Approved Lab Results, Approved Radiology Reports, Attachments & Invoices
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { createAttachmentSignedUrl } from '../../lib/attachments';
import { formatDoctorDisplayName, getClinicalStatusLabel } from '../../lib/facilityLabels';
import {
  Calendar,
  FileText,
  FlaskConical,
  Heart,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Plus,
  ExternalLink,
  Receipt,
  Printer,
  LogOut,
} from 'lucide-react';

interface PortalRecordsPayload {
  linked: boolean;
  patient?: {
    id: string;
    organization_id: string;
    mrn: string;
    first_name_ar: string;
    last_name_ar: string;
    first_name_en?: string;
    last_name_en?: string;
    date_of_birth: string;
    gender: string;
    blood_group: string;
    phone: string;
    portal_linked_at?: string;
  };
  appointments?: Array<{
    id: string;
    appointment_number: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    status: string;
    type: string;
    chief_complaint_note?: string;
    branch_name_ar: string;
    branch_name_en: string;
    doctor_name_ar: string;
    doctor_name_en: string;
    specialty_title_ar: string;
    specialty_title_en: string;
  }>;
  prescriptions?: Array<{
    id: string;
    prescription_number: string;
    issued_date: string;
    diagnosis_summary?: string;
    notes?: string;
    is_dispensed: boolean;
    doctor_name_ar: string;
    doctor_name_en: string;
    items: Array<{
      id: string;
      drug_name: string;
      dosage: string;
      frequency: string;
      duration: string;
      quantity: number;
      instructions?: string;
    }>;
  }>;
  laboratory_orders?: Array<{
    id: string;
    order_number: string;
    status: string;
    priority: string;
    created_at: string;
    doctor_name_ar: string;
    doctor_name_en: string;
    results: Array<{
      id: string;
      test_code: string;
      test_name_ar: string;
      test_name_en: string;
      result_value: string;
      unit?: string;
      reference_range?: string;
      is_abnormal: boolean;
      interpretation?: string;
      approved_at?: string;
    }>;
  }>;
  radiology_orders?: Array<{
    id: string;
    order_number: string;
    imaging_modality: string;
    body_part: string;
    status: string;
    findings_report?: string | null;
    conclusion?: string | null;
    report_approved_at?: string | null;
    created_at: string;
    doctor_name_ar: string;
    doctor_name_en: string;
  }>;
  attachments?: Array<{
    id: string;
    file_name: string;
    file_type: string;
    file_size_bytes: number;
    storage_path: string;
    laboratory_order_id?: string | null;
    radiology_order_id?: string | null;
    description?: string | null;
    created_at: string;
  }>;
  invoices?: Array<{
    id: string;
    invoice_number: string;
    issue_date: string;
    total_amount: number;
    paid_amount: number;
    balance_due: number;
    status: string;
  }>;
}

interface BookingDirectoryPayload {
  linked: boolean;
  organization?: {
    id: string;
    name_ar: string;
    name_en: string;
    phone: string;
    default_currency: string;
  };
  branches?: Array<{
    id: string;
    name_ar: string;
    name_en: string;
    city: string;
    phone: string;
  }>;
  doctors?: Array<{
    id: string;
    specialty_title_ar: string;
    specialty_title_en: string;
    consultation_fee: number;
    name_ar: string;
    name_en: string;
    branch_ids: string[];
  }>;
}

interface PatientPortalProps {
  activeTab?: string;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({ activeTab = 'patient_portal' }) => {
  const { refreshIdentity, logout } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();
  const ar = locale === 'ar';

  const [tab, setTab] = useState<'patient_portal' | 'patient_rx' | 'patient_labs'>(
    (activeTab as 'patient_portal' | 'patient_rx' | 'patient_labs') || 'patient_portal'
  );

  useEffect(() => {
    if (activeTab === 'patient_portal' || activeTab === 'patient_rx' || activeTab === 'patient_labs') {
      setTab(activeTab);
    }
  }, [activeTab]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<PortalRecordsPayload>({ linked: false });
  const [directory, setDirectory] = useState<BookingDirectoryPayload>({ linked: false });

  // Claim Form (when unlinked)
  const [mrnInput, setMrnInput] = useState('');
  const [codeInput, setCodeInput] = useState('');

  // Book Appointment Form
  const [bookBranchId, setBookBranchId] = useState('');
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDate, setBookDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookTime, setBookTime] = useState('10:00');
  const [bookNotes, setBookNotes] = useState('');

  const loadPortal = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [recRes, dirRes] = await Promise.all([
        supabase.rpc('get_patient_portal_records'),
        supabase.rpc('get_patient_booking_directory'),
      ]);
      if (recRes.error) throw recRes.error;
      if (dirRes.error) throw dirRes.error;

      const recData = (recRes.data || { linked: false }) as PortalRecordsPayload;
      const dirData = (dirRes.data || { linked: false }) as BookingDirectoryPayload;
      setRecords(recData);
      setDirectory(dirData);

      if (dirData.branches?.length && !bookBranchId) {
        const defaultBranch = dirData.branches[0].id;
        setBookBranchId(defaultBranch);
        const firstDoc = dirData.doctors?.find((d) => d.branch_ids.includes(defaultBranch)) || dirData.doctors?.[0];
        if (firstDoc && !bookDoctorId) setBookDoctorId(firstDoc.id);
      }
    } catch (err) {
      console.error('Load patient portal error:', err);
      error(ar ? 'تعذر تحميل بيانات البوابة الطبية.' : 'Unable to load patient portal.');
    } finally {
      setLoading(false);
    }
  }, [ar, error, bookBranchId, bookDoctorId]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  const handleClaimRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !mrnInput.trim() || !codeInput.trim()) return;
    setSubmitting(true);
    try {
      const { error: claimErr } = await supabase.rpc('claim_patient_portal_record', {
        p_mrn: mrnInput.trim(),
        p_activation_code: codeInput.trim(),
      });
      if (claimErr) throw claimErr;

      success(ar ? 'تم توثيق وربط ملفك الطبي بنجاح!' : 'Medical record verified and linked!');
      await refreshIdentity();
      await loadPortal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      error(
        msg.includes('expired') || msg.includes('Invalid')
          ? ar
            ? 'رقم الملف الطبي أو كود التفعيل غير صحيح أو منتهي الصلاحية.'
            : 'Invalid or expired MRN / activation code.'
          : ar
          ? 'تعذر ربط الملف الطبي. تواصل مع العيادة.'
          : 'Unable to link medical record.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !bookBranchId || !bookDoctorId || !bookDate || !bookTime) {
      error(ar ? 'أكمل بيانات الفرع والطبيب والموعد.' : 'Complete branch, doctor, date, and time.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: bookErr } = await supabase.rpc('book_patient_appointment', {
        p_branch_id: bookBranchId,
        p_doctor_id: bookDoctorId,
        p_date: bookDate,
        p_start_time: bookTime,
        p_notes: bookNotes.trim() || null,
      });
      if (bookErr) throw bookErr;
      const created = Array.isArray(data) ? data[0] : data;
      success(
        ar
          ? `تم إرسال طلب الحجز بنجاح (${created?.appointment_number || ''}).`
          : `Appointment request submitted (${created?.appointment_number || ''}).`
      );
      setBookNotes('');
      await loadPortal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      error(
        msg.includes('overlap') || msg.includes('conflict')
          ? ar
            ? 'الطبيب مشغول في هذا التوقيت؛ اختر موعداً آخر.'
            : 'Doctor has another appointment at that time; choose another slot.'
          : ar
          ? 'تعذر تسجيل الحجز. تأكد من صلاحية التاريخ والوقت.'
          : 'Could not submit booking; check date and time.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openAttachment = async (storagePath: string) => {
    try {
      const url = await createAttachmentSignedUrl(storagePath, 300);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      error(ar ? 'تعذر فتح الملف.' : 'Unable to open attachment.');
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm font-bold text-slate-500">
        {ar ? 'جاري تحميل ملفك الطبي الآمن...' : 'Loading your verified health portal...'}
      </div>
    );
  }

  if (!records.linked || !records.patient) {
    return (
      <main className="mx-auto max-w-xl py-8" dir={ar ? 'rtl' : 'ltr'}>
        <section className="rounded-3xl border border-teal-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-600">
              <KeyRound className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {ar ? 'توثيق وربط ملفك الطبي' : 'Verify & Link Your Medical Record'}
              </h1>
              <p className="text-xs text-slate-500">
                {ar
                  ? 'أدخل رقم الملف الطبي (MRN) وكود التفعيل الصادر من العيادة.'
                  : 'Enter your Medical Record Number (MRN) and clinic-issued activation code.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleClaimRecord} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {ar ? 'رقم الملف الطبي (MRN)' : 'Medical Record Number (MRN)'}
              </label>
              <input
                required
                type="text"
                value={mrnInput}
                onChange={(e) => setMrnInput(e.target.value)}
                placeholder="MRN-..."
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">
                {ar ? 'كود التفعيل من العيادة' : 'Clinic Activation Code'}
              </label>
              <input
                required
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="MED-XXXX-XXXX"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 font-mono text-sm uppercase"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                {ar ? 'تسجيل الخروج' : 'Sign out'}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-black text-white hover:bg-teal-700 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" />
                {submitting ? (ar ? 'جاري التحقق...' : 'Verifying...') : ar ? 'تأكيد وربط الملف' : 'Verify & Link'}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  const p = records.patient;
  const currency = directory.organization?.default_currency || 'EGP';
  const branchDoctors = (directory.doctors || []).filter(
    (d) => !bookBranchId || d.branch_ids.includes(bookBranchId)
  );

  return (
    <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
      {/* Patient Profile Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-xl font-black text-white">
            <Heart className="h-7 w-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">
                {ar ? `${p.first_name_ar} ${p.last_name_ar}` : `${p.first_name_en || p.first_name_ar} ${p.last_name_en || p.last_name_ar}`}
              </h1>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 font-mono text-xs font-bold text-teal-700">
                {p.mrn}
              </span>
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                {p.blood_group}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {directory.organization ? (ar ? directory.organization.name_ar : directory.organization.name_en) : ''} •{' '}
              {p.phone}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadPortal()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          {ar ? 'تحديث الملف' : 'Refresh'}
        </button>
      </div>

      {/* Portal Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('patient_portal')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
            tab === 'patient_portal' ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Calendar className="h-4 w-4" />
          {t.portal.myAppointments}
        </button>
        <button
          type="button"
          onClick={() => setTab('patient_rx')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
            tab === 'patient_rx' ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="h-4 w-4" />
          {t.portal.myPrescriptions}
        </button>
        <button
          type="button"
          onClick={() => setTab('patient_labs')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
            tab === 'patient_labs' ? 'bg-teal-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FlaskConical className="h-4 w-4" />
          {ar ? 'نتائج التحاليل والأشعة والفواتير' : 'Lab, Radiology & Invoices'}
        </button>
      </div>

      {tab === 'patient_portal' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Request Appointment */}
          <form
            onSubmit={handleBookAppointment}
            className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5"
          >
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
              <Plus className="h-4 w-4 text-teal-600" />
              {ar ? 'حجز موعد جديد' : 'Book an Appointment'}
            </h2>

            <div>
              <label className="block text-xs font-bold text-slate-700">{ar ? 'الفرع' : 'Branch'}</label>
              <select
                required
                value={bookBranchId}
                onChange={(e) => {
                  const nextBranch = e.target.value;
                  setBookBranchId(nextBranch);
                  const doc = (directory.doctors || []).find((d) => d.branch_ids.includes(nextBranch));
                  setBookDoctorId(doc?.id || '');
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {(directory.branches || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {ar ? b.name_ar : b.name_en} ({b.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">{ar ? 'الطبيب والتخصص' : 'Doctor & Specialty'}</label>
              <select
                required
                value={bookDoctorId}
                onChange={(e) => setBookDoctorId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">{ar ? 'اختر الطبيب...' : 'Select doctor...'}</option>
                {branchDoctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formatDoctorDisplayName(ar ? d.name_ar : d.name_en, ar)} — {ar ? d.specialty_title_ar : d.specialty_title_en} ({Number(d.consultation_fee).toFixed(0)} {currency})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'التاريخ' : 'Date'}</label>
                <input
                  required
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={bookDate}
                  onChange={(e) => setBookDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">{ar ? 'الوقت' : 'Time'}</label>
                <input
                  required
                  type="time"
                  value={bookTime}
                  onChange={(e) => setBookTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">{ar ? 'سبب الزيارة (اختياري)' : 'Reason for visit'}</label>
              <textarea
                rows={2}
                value={bookNotes}
                onChange={(e) => setBookNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !bookDoctorId}
              className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-black text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {submitting ? (ar ? 'جاري الحجز...' : 'Submitting...') : ar ? 'تأكيد طلب الموعد' : 'Request Appointment'}
            </button>
          </form>

          {/* Appointments List */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-7">
            <h2 className="text-base font-black text-slate-900">
              {ar ? `مواعيدي (${records.appointments?.length || 0})` : `My Appointments (${records.appointments?.length || 0})`}
            </h2>
            {!records.appointments || records.appointments.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                {ar ? 'لا توجد مواعيد مسجلة حتى الآن.' : 'No appointments recorded yet.'}
              </p>
            ) : (
              <div className="space-y-2.5">
                {records.appointments.map((apt) => (
                  <div key={apt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5">
                    <div>
                      <span className="font-mono text-xs font-bold text-teal-700">{apt.appointment_number}</span>
                      <p className="mt-0.5 text-sm font-bold text-slate-900">
                        {formatDoctorDisplayName(ar ? apt.doctor_name_ar : apt.doctor_name_en, ar)} — {ar ? apt.specialty_title_ar : apt.specialty_title_en}
                      </p>
                      <p className="text-xs text-slate-500">
                        {apt.appointment_date} • {apt.start_time.slice(0, 5)} • {ar ? apt.branch_name_ar : apt.branch_name_en}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {(t.appointments as Record<string, string>)[`status_${apt.status}`] || getClinicalStatusLabel(apt.status, ar)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'patient_rx' && (
        <div className="space-y-4">
          {!records.prescriptions || records.prescriptions.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-400">
              {ar ? 'لا توجد وصفات طبية مسجلة حتى الآن.' : 'No prescriptions recorded yet.'}
            </div>
          ) : (
            records.prescriptions.map((rx) => (
              <div key={rx.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-mono text-xs font-black text-emerald-700">{rx.prescription_number}</span>
                    <p className="text-sm font-bold text-slate-900">
                      {formatDoctorDisplayName(ar ? rx.doctor_name_ar : rx.doctor_name_en, ar)} • {rx.issued_date}
                    </p>
                    {rx.diagnosis_summary && <p className="text-xs text-slate-500">{rx.diagnosis_summary}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 print:hidden"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {ar ? 'طباعة' : 'Print'}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {rx.items.map((item) => (
                    <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-xs">
                      <p className="font-black text-slate-900">{item.drug_name}</p>
                      <p className="mt-1 text-slate-600">
                        {item.dosage} • {item.frequency} • {item.duration} ({item.quantity})
                      </p>
                      {item.instructions && <p className="mt-1 text-teal-700">{item.instructions}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'patient_labs' && (
        <div className="space-y-6">
          {/* Approved Lab Results */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-base font-black text-slate-900">{t.portal.myLabResults}</h2>
            {!records.laboratory_orders || records.laboratory_orders.length === 0 ? (
              <p className="text-sm text-slate-400">{ar ? 'لا توجد طلبات تحاليل.' : 'No laboratory orders.'}</p>
            ) : (
              <div className="space-y-3">
                {records.laboratory_orders.map((lo) => (
                  <div key={lo.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-teal-700">{lo.order_number}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold">{getClinicalStatusLabel(lo.status, ar)}</span>
                    </div>
                    {lo.results.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        {ar ? 'النتائج قيد المراجعة والاعتماد الطبي.' : 'Results awaiting clinical approval.'}
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {lo.results.map((r) => (
                          <div key={r.id} className={`rounded-lg p-3 text-xs ${r.is_abnormal ? 'bg-rose-50 border border-rose-200' : 'bg-slate-50'}`}>
                            <p className="font-bold text-slate-900">
                              {ar ? r.test_name_ar : r.test_name_en} ({r.test_code})
                            </p>
                            <p className="mt-1 font-black text-slate-900">
                              {r.result_value} {r.unit || ''}{' '}
                              {r.reference_range && <span className="font-normal text-slate-500">[{r.reference_range}]</span>}
                            </p>
                            {r.interpretation && <p className="mt-1 text-slate-600">{r.interpretation}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Approved Radiology Reports */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-base font-black text-slate-900">{ar ? 'تقارير الأشعة المعتمدة' : 'Approved Radiology Reports'}</h2>
            {!records.radiology_orders || records.radiology_orders.length === 0 ? (
              <p className="text-sm text-slate-400">{ar ? 'لا توجد طلبات أشعة.' : 'No radiology orders.'}</p>
            ) : (
              <div className="space-y-3">
                {records.radiology_orders.map((ro) => (
                  <div key={ro.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-indigo-700">
                        {ro.order_number} • {ro.imaging_modality} — {ro.body_part}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold">{getClinicalStatusLabel(ro.status, ar)}</span>
                    </div>
                    {ro.report_approved_at ? (
                      <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
                        <p className="whitespace-pre-wrap text-slate-800">{ro.findings_report}</p>
                        {ro.conclusion && <p className="font-bold text-indigo-900">{ro.conclusion}</p>}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">{ar ? 'التقرير قيد الإعداد والاعتماد.' : 'Report pending specialist approval.'}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Approved Attachments */}
          {records.attachments && records.attachments.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h2 className="text-base font-black text-slate-900">{ar ? 'المرفقات والتقارير المعتمدة' : 'Released Diagnostic Files'}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {records.attachments.map((att) => (
                  <button
                    key={att.id}
                    type="button"
                    onClick={() => void openAttachment(att.storage_path)}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-start text-xs hover:bg-slate-50"
                  >
                    <span className="truncate font-bold text-slate-800">{att.file_name}</span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-teal-600" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Invoices */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900">
              <Receipt className="h-4 w-4 text-emerald-600" />
              {ar ? 'فواتيري ومدفوعاتي' : 'My Invoices & Balances'}
            </h2>
            {!records.invoices || records.invoices.length === 0 ? (
              <p className="text-sm text-slate-400">{ar ? 'لا توجد فواتير مسجلة.' : 'No invoices found.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-2.5 text-start">{ar ? 'الفاتورة' : 'Invoice'}</th>
                      <th className="p-2.5 text-start">{ar ? 'التاريخ' : 'Date'}</th>
                      <th className="p-2.5 text-start">{ar ? 'الإجمالي' : 'Total'}</th>
                      <th className="p-2.5 text-start">{ar ? 'المدفوع' : 'Paid'}</th>
                      <th className="p-2.5 text-start">{ar ? 'المتبقي' : 'Balance'}</th>
                      <th className="p-2.5 text-start">{ar ? 'الحالة' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {records.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="p-2.5 font-mono font-bold">{inv.invoice_number}</td>
                        <td className="p-2.5">{inv.issue_date}</td>
                        <td className="p-2.5">{Number(inv.total_amount).toFixed(2)} {currency}</td>
                        <td className="p-2.5 text-emerald-700">{Number(inv.paid_amount).toFixed(2)}</td>
                        <td className="p-2.5 font-bold text-rose-700">{Number(inv.balance_due).toFixed(2)}</td>
                        <td className="p-2.5">{getClinicalStatusLabel(inv.status, ar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
