// ============================================================================
// MEDICORE – Electronic Medical Records (EMR) & Patient File Management
// Search, Demographics, Documented Allergies & Chronological Medical Timeline
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Patient, BloodGroupType, GenderType, InsuranceCompany } from '../../types/database';
import { 
  Users, Search, Plus, UserPlus, Phone, Calendar, Heart, 
  AlertTriangle, Clock, FileText, ChevronRight, X, ShieldAlert,
  Printer, MessageCircle
} from 'lucide-react';
import {
  buildTemplateMessage, logAndOpenWhatsApp, logAndStartCall, NotificationTemplateKey
} from '../../lib/communications';

export const Patients: React.FC = () => {
  const { organization, activeBranch, user } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientAllergies, setPatientAllergies] = useState<any[]>([]);
  const [medicalHistories, setMedicalHistories] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [allergyLoadError, setAllergyLoadError] = useState(false);
  const [historyLoadError, setHistoryLoadError] = useState(false);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  const [allergen, setAllergen] = useState('');
  const [allergySeverity, setAllergySeverity] = useState<'mild'|'moderate'|'severe'|'anaphylactic'>('moderate');
  const [allergyReaction, setAllergyReaction] = useState('');
  const [conditionName, setConditionName] = useState('');
  const [conditionType, setConditionType] = useState<'chronic_disease'|'past_surgery'|'family_history'|'lifestyle'>('chronic_disease');
  const [conditionNotes, setConditionNotes] = useState('');
  const [conditionYear, setConditionYear] = useState('');
  const [savingClinicalData, setSavingClinicalData] = useState(false);

  // New Patient Form
  const [firstNameAr, setFirstNameAr] = useState('');
  const [lastNameAr, setLastNameAr] = useState('');
  const [firstNameEn, setFirstNameEn] = useState('');
  const [lastNameEn, setLastNameEn] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<GenderType | ''>('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroupType>('unknown');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([]);
  const [insuranceCompanyId, setInsuranceCompanyId] = useState('');
  const [insuranceCardNumber, setInsuranceCardNumber] = useState('');
  const [insuranceCoveragePercent, setInsuranceCoveragePercent] = useState('80');
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [waTemplate, setWaTemplate] = useState<NotificationTemplateKey>('follow_up_reminder');
  const [waMessage, setWaMessage] = useState('');

  const orgId = organization?.id || '';

  useEffect(() => {
    let active = true;
    const loadPatients = async () => {
      if (!orgId) return;
      if (!supabase) { setIsLoadingPatients(false); error('اتصال قاعدة البيانات غير مهيأ.'); return; }
      setIsLoadingPatients(true);
      const [{ data, error: queryError }, { data: compData }] = await Promise.all([
        supabase.from('patients').select('*').eq('organization_id', orgId).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('insurance_companies').select('*').eq('organization_id', orgId).eq('is_active', true),
      ]);
      if (!active) return;
      if (queryError) { setPatients([]); error('تعذر تحميل ملفات المرضى من قاعدة البيانات.'); }
      else setPatients((data || []) as Patient[]);
      setInsuranceCompanies((compData || []) as InsuranceCompany[]);
      setIsLoadingPatients(false);
    };
    void loadPatients();
    return () => { active = false; };
  }, [orgId]);

  const patientsList = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase();
    return q ? patients.filter(patient => [patient.first_name_ar, patient.last_name_ar, patient.first_name_en, patient.last_name_en, patient.phone, patient.mrn, patient.national_id].some(value => value?.toLocaleLowerCase().includes(q))) : patients;
  }, [patients, searchQuery]);

  useEffect(() => {
    let active = true;
    const loadRecords = async () => {
      if (!supabase || !selectedPatient) {
        setPatientAllergies([]); setMedicalHistories([]); setConsultations([]); setPrescriptions([]);
        setAllergyLoadError(false); setHistoryLoadError(false); return;
      }
      const [allergies, histories, cons, rxs] = await Promise.all([
        supabase.from('patient_allergies').select('*').eq('organization_id', orgId).eq('patient_id', selectedPatient.id),
        supabase.from('medical_histories').select('*').eq('organization_id', orgId).eq('patient_id', selectedPatient.id).eq('is_active', true).order('created_at', { ascending: false }),
        supabase.from('consultations').select('*').eq('organization_id', orgId).eq('patient_id', selectedPatient.id).order('consultation_date', { ascending: false }),
        supabase.from('prescriptions').select('*').eq('organization_id', orgId).eq('patient_id', selectedPatient.id).order('issued_date', { ascending: false }),
      ]);
      if (!active) return;
      setAllergyLoadError(Boolean(allergies.error));
      setHistoryLoadError(Boolean(histories.error || cons.error || rxs.error));
      setPatientAllergies(allergies.error ? [] : allergies.data || []);
      setMedicalHistories(histories.error ? [] : histories.data || []);
      setConsultations(cons.error ? [] : cons.data || []);
      const rxRows = rxs.error ? [] : rxs.data || [];
      if (!rxRows.length) { setPrescriptions([]); return; }
      const { data: items, error: itemsError } = await supabase.from('prescription_items').select('*').eq('organization_id', orgId).in('prescription_id', rxRows.map(rx => rx.id));
      if (!active) return;
      if (itemsError) setHistoryLoadError(true);
      setPrescriptions(rxRows.map(rx => ({ ...rx, items: (items || []).filter(item => item.prescription_id === rx.id) })));
    };
    void loadRecords();
    return () => { active = false; };
  }, [selectedPatient?.id, orgId]);

  const saveAllergy = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !organization || !selectedPatient || !allergen.trim()) return;
    if (!['org_owner','general_manager','branch_manager','doctor','assistant_doctor','nurse'].includes(user?.role || '')) { error(locale==='ar'?'إضافة بيانات الحساسية متاحة للفريق السريري فقط.':'Only clinical staff can add allergy records.'); return; }
    setSavingClinicalData(true);
    const { data, error: insertError } = await supabase.from('patient_allergies').insert({ organization_id: organization.id, patient_id: selectedPatient.id, allergen: allergen.trim(), severity: allergySeverity, reaction: allergyReaction.trim() || null, diagnosed_date: new Date().toISOString().slice(0,10) }).select('*').single();
    setSavingClinicalData(false);
    if (insertError || !data) { error(locale==='ar'?'تعذر حفظ سجل الحساسية.':'Could not save allergy record.'); return; }
    setPatientAllergies(rows=>[data,...rows]); setAllergen(''); setAllergyReaction(''); success(locale==='ar'?'تم حفظ الحساسية في ملف المريض.':'Allergy saved to the patient record.');
  };

  const saveMedicalHistory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !organization || !selectedPatient || !conditionName.trim()) return;
    if (!['org_owner','general_manager','branch_manager','doctor','assistant_doctor','nurse'].includes(user?.role || '')) { error(locale==='ar'?'إضافة التاريخ المرضي متاحة للفريق السريري فقط.':'Only clinical staff can add medical history.'); return; }
    setSavingClinicalData(true);
    const { data, error: insertError } = await supabase.from('medical_histories').insert({ organization_id: organization.id, patient_id: selectedPatient.id, condition_name: conditionName.trim(), condition_type: conditionType, notes: conditionNotes.trim() || null, onset_year: conditionYear ? Number(conditionYear) : null, is_active: true }).select('*').single();
    setSavingClinicalData(false);
    if (insertError || !data) { error(locale==='ar'?'تعذر حفظ التاريخ المرضي.':'Could not save medical history.'); return; }
    setMedicalHistories(rows=>[data,...rows]); setConditionName(''); setConditionNotes(''); setConditionYear(''); success(locale==='ar'?'تم حفظ التاريخ المرضي في الملف.':'Medical history saved to the patient record.');
  };

  if (!organization) return null;

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

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstNameAr || !lastNameAr || !phone) return;

    if (!supabase) { error('اتصال قاعدة البيانات غير مهيأ؛ لم يتم حفظ الملف.'); return; }
    setIsSavingPatient(true);
    const mrn = `MRN-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: row, error: insertError } = await supabase.from('patients').insert({
      organization_id: orgId, primary_branch_id: activeBranch?.id || null, mrn,
      national_id: nationalId || null, first_name_ar: firstNameAr.trim(), last_name_ar: lastNameAr.trim(),
      first_name_en: firstNameEn.trim() || null, last_name_en: lastNameEn.trim() || null,
      date_of_birth: dob, gender, blood_group: bloodGroup, phone: phone.trim(),
      whatsapp: whatsapp.trim() || phone.trim(), emergency_contact_name: emergencyContactName.trim() || null,
      emergency_contact_phone: emergencyContactPhone.trim() || null,
      insurance_company_id: insuranceCompanyId || null,
      insurance_card_number: insuranceCardNumber.trim() || null,
      insurance_coverage_percent: insuranceCompanyId ? Math.min(100, Math.max(0, Number(insuranceCoveragePercent) || 0)) : 0,
      is_active: true,
    }).select('*').single();
    setIsSavingPatient(false);
    if (insertError || !row) { error('تعذر حفظ ملف المريض. تحقق من البيانات وصلاحية الحساب.'); return; }
    const created = row as Patient;
    setPatients(current => [created, ...current]);

    success(locale === 'ar' ? `تم فتح ملف مريض جديد برقم ${created.mrn}` : `Patient registered: ${created.mrn}`);
    setShowAddModal(false);
    setSelectedPatient(created);

    // Reset fields
    setFirstNameAr('');
    setLastNameAr('');
    setFirstNameEn('');
    setLastNameEn('');
    setDob('');
    setGender('');
    setBloodGroup('unknown');
    setPhone('');
    setWhatsapp('');
    setNationalId('');
    setInsuranceCompanyId('');
    setInsuranceCardNumber('');
    setInsuranceCoveragePercent('80');
  };

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
                {isLoadingPatients ? (locale === 'ar' ? 'جارٍ تحميل ملفات المرضى...' : 'Loading patient records...') : (locale === 'ar' ? 'لا يوجد مرضى مطابقين للبحث' : 'No matching patients found')}
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
                        {pat.gender === 'male' ? '♂' : pat.gender === 'female' ? '♀' : '·'}
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
                    <span>{selectedPatient.gender === 'male' ? t.emr.male : selectedPatient.gender === 'female' ? t.emr.female : (locale === 'ar' ? 'أخرى' : 'Other')}</span>
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
                  onClick={() => void logAndStartCall({
                    organizationId: orgId,
                    branchId: activeBranch?.id,
                    patientId: selectedPatient.id,
                    phone: selectedPatient.phone,
                    userId: user?.id,
                  })}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold"
                  title={locale === 'ar' ? 'اتصال مباشر بالمريض' : 'Call Patient'}
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{locale === 'ar' ? 'اتصال' : 'Call'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tpl: NotificationTemplateKey = 'follow_up_reminder';
                    setWaTemplate(tpl);
                    setWaMessage(buildTemplateMessage(tpl, {
                      patientName: `${selectedPatient.first_name_ar} ${selectedPatient.last_name_ar}`,
                      clinicName: organization[locale === 'ar' ? 'name_ar' : 'name_en'],
                      locale,
                    }));
                    setWaModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold"
                  title={locale === 'ar' ? 'إرسال إشعار واتساب للمريض' : 'Send WhatsApp Notification'}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{locale === 'ar' ? 'واتساب' : 'WhatsApp'}</span>
                </button>
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
                    {allergyLoadError
                      ? (locale === 'ar' ? 'تعذر تحميل سجل الحساسية. لا تعتمد على عدم ظهور حساسية.' : 'Could not load allergy history; do not assume there are no allergies.')
                      : patientAllergies.length ? patientAllergies.map(item => `${item.allergen} (${item.severity})`).join('، ') : (locale === 'ar' ? 'لا توجد حساسية مسجلة في الملف' : 'No allergies recorded in this file')}
                  </p>
                </div>
              </div>
              {patientAllergies.length > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 uppercase">{locale === 'ar' ? 'مُسجل' : 'Recorded'}</span>}
            </div>

            {['org_owner','general_manager','branch_manager','doctor','assistant_doctor','nurse'].includes(user?.role || '') && <div className="grid gap-4 lg:grid-cols-2">
              <form onSubmit={saveAllergy} className="space-y-3 rounded-xl border border-rose-200 bg-white p-4">
                <h3 className="text-sm font-black text-rose-900">{locale==='ar'?'إضافة حساسية':'Record an allergy'}</h3>
                <label className="block text-xs font-bold">{locale==='ar'?'مسبب الحساسية':'Allergen'}<input required maxLength={255} value={allergen} onChange={e=>setAllergen(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5"/></label>
                <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">{locale==='ar'?'الشدة':'Severity'}<select value={allergySeverity} onChange={e=>setAllergySeverity(e.target.value as typeof allergySeverity)} className="mt-1 w-full rounded-lg border bg-white p-2.5"><option value="mild">{locale==='ar'?'خفيفة':'Mild'}</option><option value="moderate">{locale==='ar'?'متوسطة':'Moderate'}</option><option value="severe">{locale==='ar'?'شديدة':'Severe'}</option><option value="anaphylactic">{locale==='ar'?'تأق':'Anaphylactic'}</option></select></label><label className="text-xs font-bold">{locale==='ar'?'رد الفعل':'Reaction'}<input maxLength={2000} value={allergyReaction} onChange={e=>setAllergyReaction(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5"/></label></div>
                <button disabled={savingClinicalData} className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{locale==='ar'?'حفظ الحساسية':'Save allergy'}</button>
              </form>
              <form onSubmit={saveMedicalHistory} className="space-y-3 rounded-xl border border-indigo-200 bg-white p-4">
                <h3 className="text-sm font-black text-indigo-900">{locale==='ar'?'إضافة تاريخ مرضي':'Record medical history'}</h3>
                <label className="block text-xs font-bold">{locale==='ar'?'الحالة أو الإجراء':'Condition or procedure'}<input required maxLength={255} value={conditionName} onChange={e=>setConditionName(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5"/></label>
                <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">{locale==='ar'?'التصنيف':'Category'}<select value={conditionType} onChange={e=>setConditionType(e.target.value as typeof conditionType)} className="mt-1 w-full rounded-lg border bg-white p-2.5"><option value="chronic_disease">{locale==='ar'?'مرض مزمن':'Chronic disease'}</option><option value="past_surgery">{locale==='ar'?'جراحة سابقة':'Past surgery'}</option><option value="family_history">{locale==='ar'?'تاريخ عائلي':'Family history'}</option><option value="lifestyle">{locale==='ar'?'نمط حياة':'Lifestyle'}</option></select></label><label className="text-xs font-bold">{locale==='ar'?'سنة البداية (اختياري)':'Onset year (optional)'}<input type="number" min="1900" max={new Date().getFullYear()} value={conditionYear} onChange={e=>setConditionYear(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5"/></label></div>
                <label className="block text-xs font-bold">{locale==='ar'?'ملاحظات':'Notes'}<textarea maxLength={5000} value={conditionNotes} onChange={e=>setConditionNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border p-2.5"/></label>
                <button disabled={savingClinicalData} className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{locale==='ar'?'حفظ التاريخ المرضي':'Save medical history'}</button>
              </form>
            </div>}

            <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-black">{locale==='ar'?'التاريخ المرضي المسجل':'Recorded medical history'}</h3>
              {medicalHistories.length ? medicalHistories.map(item=><article key={item.id} className="rounded-lg border bg-white p-3 text-xs"><b>{item.condition_name}</b><span className="ms-2 text-slate-500">{item.condition_type}{item.onset_year?` · ${item.onset_year}`:''}</span>{item.notes&&<p className="mt-1 text-slate-600">{item.notes}</p>}</article>) : <p className="text-xs text-slate-500">{locale==='ar'?'لا يوجد تاريخ مرضي مسجل في هذا الملف.':'No medical history is recorded in this file.'}</p>}
            </section>

            {/* Chronological Clinical Timeline */}
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-medicore-600" />
                {t.emr.medicalTimeline}
              </h3>

              {historyLoadError && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold leading-5 text-amber-950">{locale === 'ar' ? 'تعذر تحميل جزء من السجل السريري؛ القائمة الظاهرة قد تكون ناقصة.' : 'Part of the clinical history could not be loaded; the visible list may be incomplete.'}</div>}

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
                    {rx.items?.map((it: any) => (
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
                    required
                    value={gender}
                    onChange={e => setGender(e.target.value as GenderType)}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                  >
                    <option value="">{locale === 'ar' ? 'اختر النوع' : 'Select gender'}</option>
                    <option value="male">{t.emr.male}</option>
                    <option value="female">{t.emr.female}</option>
                    <option value="other">{locale === 'ar' ? 'أخرى' : 'Other'}</option>
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

              {/* Health Insurance Section */}
              <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-100 space-y-3">
                <p className="text-xs font-black text-teal-800">{t.emr.insuranceDetails}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'شركة التأمين' : 'Provider'}
                    </label>
                    <select
                      value={insuranceCompanyId}
                      onChange={e => setInsuranceCompanyId(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white"
                    >
                      <option value="">{locale === 'ar' ? 'بدون تأمين (كاش)' : 'Self-Pay (None)'}</option>
                      {insuranceCompanies.map(c => (
                        <option key={c.id} value={c.id}>{locale === 'ar' ? c.name_ar : c.name_en}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'رقم البطاقة' : 'Card #'}
                    </label>
                    <input
                      type="text"
                      disabled={!insuranceCompanyId}
                      value={insuranceCardNumber}
                      onChange={e => setInsuranceCardNumber(e.target.value)}
                      placeholder="INS-..."
                      className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white disabled:opacity-50 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      {locale === 'ar' ? 'نسبة التغطية %' : 'Coverage %'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      disabled={!insuranceCompanyId}
                      value={insuranceCoveragePercent}
                      onChange={e => setInsuranceCoveragePercent(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white disabled:opacity-50 font-mono"
                    />
                  </div>
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
                  disabled={isSavingPatient}
                  className="px-5 py-2 text-sm bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {isSavingPatient ? (locale === 'ar' ? 'جارٍ الحفظ...' : 'Saving...') : t.emr.addPatient}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Notification Modal */}
      {waModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-emerald-600" />
                <span>{locale === 'ar' ? 'إرسال إشعار واتساب للمريض' : 'Send WhatsApp Notification'}</span>
              </h3>
              <button type="button" onClick={() => setWaModalOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="text-xs text-slate-600">
              {selectedPatient.first_name_ar} {selectedPatient.last_name_ar} — <span className="font-mono font-bold">{selectedPatient.whatsapp || selectedPatient.phone}</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{locale === 'ar' ? 'قالب الرسالة' : 'Message Template'}</label>
              <select
                value={waTemplate}
                onChange={e => {
                  const key = e.target.value as NotificationTemplateKey;
                  setWaTemplate(key);
                  setWaMessage(buildTemplateMessage(key, {
                    patientName: `${selectedPatient.first_name_ar} ${selectedPatient.last_name_ar}`,
                    clinicName: organization[locale === 'ar' ? 'name_ar' : 'name_en'],
                    locale,
                  }));
                }}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-bold"
              >
                <option value="follow_up_reminder">{locale === 'ar' ? 'تذكير بموعد المتابعة' : 'Follow-up Reminder'}</option>
                <option value="appointment_reminder">{locale === 'ar' ? 'تذكير بموعد العيادة' : 'Appointment Reminder'}</option>
                <option value="lab_results_ready">{locale === 'ar' ? 'نتائج الفحوصات جاهزة' : 'Results Ready'}</option>
                <option value="custom">{locale === 'ar' ? 'رسالة مخصصة' : 'Custom Message'}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{locale === 'ar' ? 'نص الرسالة' : 'Message Body'}</label>
              <textarea rows={4} value={waMessage} onChange={e => setWaMessage(e.target.value)} className="w-full text-xs rounded-xl border border-slate-300 p-2.5" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setWaModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-100">{t.common.cancel}</button>
              <button
                type="button"
                onClick={() => void logAndOpenWhatsApp({
                  organizationId: orgId,
                  branchId: activeBranch?.id,
                  patientId: selectedPatient.id,
                  phone: selectedPatient.whatsapp || selectedPatient.phone,
                  templateKey: waTemplate,
                  message: waMessage,
                  userId: user?.id,
                }).then(res => {
                  if (!res.ok) error(res.error || 'Invalid WhatsApp number');
                  else {
                    success(locale === 'ar' ? 'تم تسجيل الإشعار وفتح واتساب للإرسال' : 'Notification logged and WhatsApp opened');
                    setWaModalOpen(false);
                  }
                })}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{locale === 'ar' ? 'إرسال عبر واتساب' : 'Send via WhatsApp'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
