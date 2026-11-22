// ============================================================================
// MEDICORE – Electronic Medical Records (EMR) & Patient File Management
// Search, Demographics, Documented Allergies & Chronological Medical Timeline
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { Patient, BloodGroupType, GenderType } from '../../types/database';
import { 
  Users, Search, Plus, UserPlus, Phone, Calendar, Heart, 
  AlertTriangle, Clock, FileText, ChevronRight, X, ShieldAlert,
  Printer
} from 'lucide-react';

export const Patients: React.FC = () => {
  const { organization, activeBranch } = useAuth();
  const { locale, t } = useLanguage();
  const { success } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // New Patient Form
  const [firstNameAr, setFirstNameAr] = useState('');
  const [lastNameAr, setLastNameAr] = useState('');
  const [firstNameEn, setFirstNameEn] = useState('');
  const [lastNameEn, setLastNameEn] = useState('');
  const [dob, setDob] = useState('1992-01-01');
  const [gender, setGender] = useState<GenderType>('male');
  const [bloodGroup, setBloodGroup] = useState<BloodGroupType>('unknown');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  if (!organization) return null;
  const orgId = organization.id;

  const patientsList = dbClient.getPatients(orgId, searchQuery);

  const calculateAge = (birthDateString: string) => {
    const today = new Date();
    const birthDate = new Date(birthDateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleCreatePatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstNameAr || !lastNameAr || !phone) return;

    const created = dbClient.createPatient(orgId, {
      primary_branch_id: activeBranch?.id,
      national_id: nationalId || undefined,
      first_name_ar: firstNameAr,
      last_name_ar: lastNameAr,
      first_name_en: firstNameEn || undefined,
      last_name_en: lastNameEn || undefined,
      date_of_birth: dob,
      gender,
      blood_group: bloodGroup,
      phone,
      whatsapp: whatsapp || phone,
      emergency_contact_name: emergencyContactName || undefined,
      emergency_contact_phone: emergencyContactPhone || undefined,
      is_active: true,
    });

    success(locale === 'ar' ? `تم فتح ملف مريض جديد برقم ${created.mrn}` : `Patient registered: ${created.mrn}`);
    setShowAddModal(false);
    setSelectedPatient(created);

    // Reset fields
    setFirstNameAr('');
    setLastNameAr('');
    setFirstNameEn('');
    setLastNameEn('');
    setPhone('');
    setWhatsapp('');
    setNationalId('');
  };

  // If a patient is selected, fetch their full timeline
  const consultations = selectedPatient ? dbClient.getConsultations(orgId, selectedPatient.id) : [];
  const prescriptions = selectedPatient ? dbClient.getPrescriptions(orgId, selectedPatient.id) : [];

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-medicore-600" />
            {t.nav.patients}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' ? 'السجل الطبي الإلكتروني الشامل (EMR)، التاريخ السريري والحساسيات' : 'Comprehensive Electronic Medical Records (EMR) & Clinical History'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t.emr.addPatient}</span>
        </button>
      </div>

      {/* Search Input Box */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400 ms-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t.common.search}
          className="w-full text-sm bg-transparent outline-none placeholder:text-slate-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-400 hover:text-slate-600 px-2"
          >
            {locale === 'ar' ? 'مسح' : 'Clear'}
          </button>
        )}
      </div>

      {/* Patients Table & Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patients List (1 or 2 Cols depending on selection) */}
        <div className={`${selectedPatient ? 'lg:col-span-1' : 'lg:col-span-3'} bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <span className="font-bold text-xs text-slate-500 uppercase tracking-wider">
              {patientsList.length} {locale === 'ar' ? 'ملف مريض' : 'Patients Found'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
            {patientsList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                {locale === 'ar' ? 'لا يوجد مرضى مطابقين للبحث' : 'No matching patients found'}
              </div>
            ) : (
              patientsList.map(pat => {
                const isSelected = selectedPatient?.id === pat.id;
                return (
                  <button
                    key={pat.id}
                    type="button"
                    onClick={() => setSelectedPatient(pat)}
                    className={`w-full text-start p-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${
                      isSelected ? 'bg-medicore-50/70 border-s-4 border-medicore-600' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                        {pat.gender === 'male' ? '♂' : '♀'}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                          <span>{pat.first_name_ar} {pat.last_name_ar}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono">
                            {pat.mrn}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                          <span>{calculateAge(pat.date_of_birth)} {locale === 'ar' ? 'سنة' : 'yrs'}</span>
                          <span>•</span>
                          <span>{pat.phone}</span>
                          <span>•</span>
                          <span className="font-semibold text-rose-600">{pat.blood_group}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 rtl:rotate-180" />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Patient Detailed EMR Drawer (2 Cols) */}
        {selectedPatient && (
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 space-y-6 animate-fade-in">
            {/* Header Card */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-medicore-600 to-teal-500 text-white font-black text-xl flex items-center justify-center shadow-md">
                  {selectedPatient.first_name_ar.slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-slate-900">
                      {selectedPatient.first_name_ar} {selectedPatient.last_name_ar}
                    </h2>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {selectedPatient.mrn}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                    <span>{locale === 'ar' ? 'العمر:' : 'Age:'} {calculateAge(selectedPatient.date_of_birth)} {locale === 'ar' ? 'سنة' : 'years'}</span>
                    <span>•</span>
                    <span>{selectedPatient.gender === 'male' ? t.emr.male : t.emr.female}</span>
                    <span>•</span>
                    <span className="font-bold text-rose-600">{selectedPatient.blood_group}</span>
                    <span>•</span>
                    <span className="font-mono">{selectedPatient.phone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title={t.common.print}
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Allergies & Alerts Warning Card */}
            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-rose-900">{t.emr.allergies}:</span>
                  <p className="text-xs text-rose-800 font-medium">
                    {locale === 'ar' ? 'حساسية مفرطة من مشتقات البنسلين (Penicillin Allergy)' : 'Severe Penicillin Allergy'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 uppercase">
                Severe
              </span>
            </div>

            {/* Chronological Clinical Timeline */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-medicore-600" />
                {t.emr.medicalTimeline}
              </h3>

              {consultations.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                  {locale === 'ar' ? 'لم يتم تسجيل كشوفات سابقة لهذا المريض' : 'No prior consultations recorded'}
                </div>
              ) : (
                <div className="space-y-3">
                  {consultations.map(con => (
                    <div key={con.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-medicore-500" />
                          <span className="font-bold text-xs text-slate-900">
                            {new Date(con.consultation_date).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-slate-500">
                            (د. {con.doctor?.user?.name_ar || con.doctor?.specialty_title_ar})
                          </span>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {con.status}
                        </span>
                      </div>

                      {/* Vitals Summary */}
                      <div className="flex flex-wrap gap-3 text-xs bg-white p-2 rounded-lg border border-slate-200 font-mono text-slate-700">
                        <span>BP: {con.systolic_bp}/{con.diastolic_bp}</span>
                        <span>HR: {con.heart_rate} bpm</span>
                        <span>Temp: {con.temperature_celsius}°C</span>
                        <span>BMI: {con.bmi}</span>
                      </div>

                      <p className="text-xs text-slate-700">
                        <span className="font-bold text-slate-900">{t.consultation.chiefComplaint}: </span>
                        {con.chief_complaint || con.chiefComplaint}
                      </p>

                      {con.treatment_plan && (
                        <p className="text-xs text-slate-700">
                          <span className="font-bold text-slate-900">{t.consultation.treatmentPlan}: </span>
                          {con.treatment_plan}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prescriptions History */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                {locale === 'ar' ? 'الروشتات المصروفة للمريض' : 'Prescription History'}
              </h3>

              {prescriptions.map(rx => (
                <div key={rx.id} className="p-3 rounded-xl border border-slate-200 bg-teal-50/20 text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>{rx.prescription_number} ({rx.issued_date})</span>
                    <span className="text-[11px] text-teal-700">د. {rx.doctor?.user?.name_ar}</span>
                  </div>
                  <div className="space-y-1">
                    {rx.items?.map(it => (
                      <p key={it.id} className="text-slate-700 ps-2 border-s-2 border-teal-400">
                        • {it.drug_name} — {it.dosage} ({it.frequency} لمدة {it.duration})
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add New Patient Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl animate-scale-in border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-medicore-600" />
                <h3 className="font-bold text-slate-800 text-base">{t.emr.addPatient}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePatient} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'الاسم الأول (بالعربية)' : 'First Name (Arabic)'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstNameAr}
                    onChange={e => setFirstNameAr(e.target.value)}
                    placeholder="مثال: حسام"
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'اسم العائلة (بالعربية)' : 'Last Name (Arabic)'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastNameAr}
                    onChange={e => setLastNameAr(e.target.value)}
                    placeholder="مثال: الشريف"
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.emr.birthDate} *
                  </label>
                  <input
                    type="date"
                    required
                    value={dob}
                    onChange={e => setDob(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.emr.gender} *
                  </label>
                  <select
                    value={gender}
                    onChange={e => setGender(e.target.value as GenderType)}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                  >
                    <option value="male">{t.emr.male}</option>
                    <option value="female">{t.emr.female}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.emr.bloodGroup}
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={e => setBloodGroup(e.target.value as BloodGroupType)}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white font-bold"
                  >
                    <option value="unknown">{locale === 'ar' ? 'غير محدد' : 'Unknown'}</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.emr.phone} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+20 1..."
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.emr.nationalId}
                  </label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={e => setNationalId(e.target.value)}
                    placeholder="29..."
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.emr.emergencyContact} (الاسم)
                  </label>
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={e => setEmergencyContactName(e.target.value)}
                    placeholder="مثال: والد المريض / الزوجة"
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.emr.emergencyContact} (الهاتف)
                  </label>
                  <input
                    type="tel"
                    value={emergencyContactPhone}
                    onChange={e => setEmergencyContactPhone(e.target.value)}
                    placeholder="+20 1..."
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {t.emr.addPatient}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
