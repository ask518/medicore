// ============================================================================
// MEDICORE – Doctor Clinical Consultation Workflow
// Vitals, ICD-10 Diagnoses, Embedded Specialty Visualizer, e-Rx & Digital Signature
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { SkeletonViewer } from '../../components/anatomy/SkeletonViewer';
import { SkeletonViewer3D } from '../../components/anatomy/SkeletonViewer3D';
import { OdontogramViewer } from '../../components/anatomy/OdontogramViewer';
import { OdontogramViewer3D } from '../../components/anatomy/OdontogramViewer3D';
import { DermatomeMap } from '../../components/anatomy/DermatomeMap';
import { DermatomeMap3D } from '../../components/anatomy/DermatomeMap3D';
import { OphthalmologyViewer } from '../../components/anatomy/OphthalmologyViewer';
import { OrthopedicFinding, ToothRecord, DermaFinding, EyeExaminationData } from '../../types/specialty';
import { CardiologyModule, CardiologyData } from '../../components/anatomy/CardiologyModule';
import { GastroenterologyModule, GastroenterologyData } from '../../components/anatomy/GastroenterologyModule';
import { PediatricsModule, PediatricsData } from '../../components/anatomy/PediatricsModule';
import { GynecologyModule, GynecologyData } from '../../components/anatomy/GynecologyModule';
import { NeurologyModule, NeurologyData } from '../../components/anatomy/NeurologyModule';
import { PulmonologyModule, PulmonologyData } from '../../components/anatomy/PulmonologyModule';
import { EntModule, EntData } from '../../components/anatomy/EntModule';
import { UrologyModule, UrologyData } from '../../components/anatomy/UrologyModule';
import { PsychiatryModule, PsychiatryData } from '../../components/anatomy/PsychiatryModule';
import { GeneralClinicalTemplate, GeneralClinicalData } from '../../components/anatomy/GeneralClinicalTemplate';
import { resolveClinicalModule, getSpecialtyByCode, ClinicalModuleType } from '../../config/medicalSpecialties';
import { COMMON_ICD10_DIAGNOSES } from '../../config/appConfig';
import { 
  Stethoscope, User, Heart, Activity, FileText, CheckCircle2, 
  AlertTriangle, Plus, Trash2, Lock, ShieldCheck, Sparkles, Send, Box, Sliders
} from 'lucide-react';

export const Consultation: React.FC = () => {
  const { user, organization, activeBranch } = useAuth();
  const { locale, t } = useLanguage();
  const { success, warning, error } = useToast();

  if (!organization) return null;
  const orgId = organization.id;

  const patients = dbClient.getPatients(orgId);
  const doctors = dbClient.getDoctors(orgId);
  const appointments = dbClient.getAppointments(orgId, {
    branchId: activeBranch?.id,
    date: new Date().toISOString().split('T')[0],
  });

  // Current Patient & Doctor
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctors[0]?.id || '');

  // Active specialty tab (e.g. 'orthopedics', 'dentistry', 'dermatology', 'ophthalmology', 'cardiology', etc.)
  const currentDoctor = doctors.find(d => d.id === selectedDoctorId);
  const specialtyCode = currentDoctor?.specialty_code || 'orthopedics';
  const specialtyInfo = getSpecialtyByCode(specialtyCode);
  const autoModule = resolveClinicalModule(specialtyCode);

  // Clinical Suite active module with manual switcher option
  const [activeClinicalModule, setActiveClinicalModule] = useState<ClinicalModuleType>(autoModule);

  useEffect(() => {
    setActiveClinicalModule(autoModule);
  }, [specialtyCode, autoModule]);

  // Vitals State
  const [systolic, setSystolic] = useState<number>(120);
  const [diastolic, setDiastolic] = useState<number>(80);
  const [heartRate, setHeartRate] = useState<number>(75);
  const [temp, setTemp] = useState<number>(37.0);
  const [weightKg, setWeightKg] = useState<number>(78);
  const [heightCm, setHeightCm] = useState<number>(175);
  const [glucose, setGlucose] = useState<number>(100);

  // Auto-calculated BMI
  const bmi = heightCm > 0 ? Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1)) : 0;

  // Clinical Notes & Diagnoses
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [hpi, setHpi] = useState('');
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<{ code: string; description: string; is_primary: boolean }[]>([]);
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  // Interactive Specialty Findings State
  const [engineMode, setEngineMode] = useState<'3d' | '2d'>('3d');
  const [orthoFindings, setOrthoFindings] = useState<OrthopedicFinding[]>([]);
  const [dentalRecords, setDentalRecords] = useState<Record<number, ToothRecord>>({});
  const [dermaFindings, setDermaFindings] = useState<DermaFinding[]>([]);
  const [eyeData, setEyeData] = useState<EyeExaminationData>({
    rightEye: { visualAcuityUncorrected: '6/6', visualAcuityCorrected: '6/6', intraocularPressureMmHg: 15, anteriorSegmentNotes: '', corneaStatus: 'Clear', lensStatus: 'Clear', fundusRetinaNotes: '', cupToDiscRatio: 0.3 },
    leftEye: { visualAcuityUncorrected: '6/6', visualAcuityCorrected: '6/6', intraocularPressureMmHg: 15, anteriorSegmentNotes: '', corneaStatus: 'Clear', lensStatus: 'Clear', fundusRetinaNotes: '', cupToDiscRatio: 0.3 }
  });

  // Additional Specialty Modules State
  const [cardioData, setCardioData] = useState<CardiologyData>({
    systolicBp: 120,
    diastolicBp: 80,
    heartRate: 75,
    rhythm: 'sinus_regular',
    heartSounds: 'normal_s1_s2',
    murmurGrade: 'none',
    murmurTiming: 'none',
    edemaGrade: 'none',
    jvpStatus: 'normal',
    nyhaClass: 'I',
    ejectionFraction: 60,
    ecgSummary: '',
    echoFindings: '',
    cardiacNotes: '',
  });

  const [gastroData, setGastroData] = useState<GastroenterologyData>({
    painQuadrants: [],
    tenderness: false,
    reboundTenderness: false,
    guarding: false,
    murphySign: false,
    hepatomegaly: false,
    splenomegaly: false,
    ascites: false,
    bristolScale: 4,
    bowelSounds: 'normal',
    endoscopyReport: '',
    notes: '',
  });

  const [pediaData, setPediaData] = useState<PediatricsData>({
    ageMonths: 24,
    weightKg: 12.5,
    heightCm: 86,
    headCircumferenceCm: 48,
    weightPercentile: '50th',
    heightPercentile: '50th',
    headPercentile: '50th',
    grossMotorMilestone: 'Runs well, kicks ball',
    fineMotorMilestone: 'Builds tower of 6 cubes',
    languageMilestone: '2-word phrases',
    socialMilestone: 'Parallel play',
    completedVaccines: ['bcg', 'hepb_birth', 'dpt_1', 'opv_1'],
    feedingType: 'family_food',
    pediatricNotes: '',
  });

  const [gynData, setGynData] = useState<GynecologyData>({
    gravida: 1,
    para: 0,
    abortions: 0,
    living: 0,
    lmpDate: '',
    isPregnant: false,
    fundalHeightCm: 0,
    fetalPresentation: 'Cephalic',
    fetalHeartRateBpm: 140,
    amnioticFluidIndex: 12,
    placentaLocation: 'Anterior High',
    ultrasoundNotes: '',
    papSmearStatus: 'Normal / Not indicated',
  });

  const [neuroData, setNeuroData] = useState<NeurologyData>({
    gcsEye: 4,
    gcsVerbal: 5,
    gcsMotor: 6,
    cranialNervesStatus: 'intact',
    cranialNervesNotes: '',
    motorPowerUpperRight: 5,
    motorPowerUpperLeft: 5,
    motorPowerLowerRight: 5,
    motorPowerLowerLeft: 5,
    muscleTone: 'normal',
    sensoryExam: 'intact',
    sensoryNotes: '',
    reflexBiceps: '2+',
    reflexPatellar: '2+',
    babinskiSign: 'negative',
    cerebellarCoordination: 'intact',
    gaitType: 'normal',
    neuroNotes: '',
  });

  const [pulmoData, setPulmoData] = useState<PulmonologyData>({
    spO2: 98,
    o2Therapy: 'room_air',
    respiratoryRate: 16,
    mmrcScore: 0,
    chestExpansion: 'symmetric',
    breathSounds: 'vesicular_normal',
    adventitiousSounds: 'none',
    percussionNote: 'resonant_normal',
    coughType: 'none',
    imagingFindings: '',
    pulmoNotes: '',
  });

  const [entData, setEntData] = useState<EntData>({
    rightEarTm: 'intact_normal',
    leftEarTm: 'intact_normal',
    weberTest: 'central_normal',
    rinneRight: 'positive_normal',
    rinneLeft: 'positive_normal',
    nasalSeptum: 'midline_straight',
    nasalTurbinates: 'normal',
    tonsilGrade: 1,
    tonsilExudate: 'none',
    pharynxWall: 'normal',
    neckLymphNodes: 'non_palpable',
    entNotes: '',
  });

  const [uroData, setUroData] = useState<UrologyData>({
    dysuria: false,
    frequency: false,
    urgency: false,
    nocturiaCount: 0,
    streamQuality: 'normal',
    hematuria: 'none',
    ipssScore: 0,
    ipssQolScore: 1,
    prostateSize: 'normal_grade1',
    prostateConsistency: 'smooth_elastic',
    costovertebralTenderness: 'none',
    scrotalExam: 'normal',
    catheterStatus: 'none',
    uroNotes: '',
  });

  const [psychData, setPsychData] = useState<PsychiatryData>({
    appearanceBehavior: 'well_groomed',
    speechCharacteristics: 'normal_rate_tone',
    moodSubjective: 'euthymic',
    affectObjective: 'congruent_full',
    thoughtProcess: 'linear_goal_directed',
    thoughtContent: 'normal',
    perceptualDisturbances: 'none',
    insightJudgment: 'intact_good',
    phq9Score: 0,
    gad7Score: 0,
    suicideRisk: 'none_low',
    psychNotes: '',
  });

  const [generalData, setGeneralData] = useState<GeneralClinicalData>({
    primaryComplaint: '',
    durationOnset: '',
    hpiNarrative: '',
    pallor: false,
    jaundice: false,
    cyanosis: false,
    clubbing: false,
    lymphadenopathy: false,
    pedalEdema: false,
    systemicExamNotes: '',
    differentialDiagnosis: '',
    clinicalPlan: '',
    followUpDays: 7,
  });

  // e-Prescription Items
  const [rxItems, setRxItems] = useState<{ drugName: string; dosage: string; frequency: string; duration: string; quantity: number }[]>([
    { drugName: 'Cataflam 50mg (Diclofenac)', dosage: 'قرص واحد', frequency: 'مرتين يومياً بعد الأكل', duration: '5 أيام', quantity: 1 }
  ]);

  // Consultation Status & Digital Signing
  const [isSigned, setIsSigned] = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const handleAddDiagnosis = (code: string, desc: string) => {
    if (selectedDiagnoses.some(d => d.code === code)) return;
    setSelectedDiagnoses(prev => [...prev, { code, description: desc, is_primary: prev.length === 0 }]);
  };

  const handleRemoveDiagnosis = (code: string) => {
    setSelectedDiagnoses(prev => prev.filter(d => d.code !== code));
  };

  const handleAddRxItem = () => {
    setRxItems(prev => [...prev, { drugName: '', dosage: 'قرص واحد', frequency: 'كل 8 ساعات', duration: '5 أيام', quantity: 1 }]);
  };

  const handleRemoveRxItem = (idx: number) => {
    setRxItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSignConsultation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chiefComplaint.trim()) {
      warning(locale === 'ar' ? 'يرجى تسجيل الشكوى الرئيسية للمريض' : 'Please record chief complaint');
      return;
    }

    // Save consultation
    const saved = dbClient.saveConsultation(orgId, {
      branch_id: activeBranch?.id || dbClient.getBranches(orgId)[0]?.id || '',
      patient_id: selectedPatientId,
      doctor_id: selectedDoctorId,
      consultation_date: new Date().toISOString(),
      status: 'finalized',
      systolic_bp: systolic,
      diastolic_bp: diastolic,
      heart_rate: heartRate,
      temperature_celsius: temp,
      weight_kg: weightKg,
      height_cm: heightCm,
      bmi,
      blood_glucose_mg_dl: glucose,
      chief_complaint: chiefComplaint,
      chiefComplaint,
      history_of_present_illness: hpi,
      diagnoses_json: selectedDiagnoses,
      treatment_plan: treatmentPlan,
      follow_up_date: followUpDate || undefined,
      specialty_code: specialtyCode,
      specialty_data: {
        orthoFindings,
        dentalRecords,
        dermaFindings,
        eyeData,
        cardioData,
        gastroData,
        pediaData,
        gynData,
        neuroData,
        pulmoData,
        entData,
        uroData,
        psychData,
        generalData,
        activeClinicalModule,
      },
      signed_by: user?.id,
      signed_at: new Date().toISOString(),
    });

    // Save e-Prescription if drugs exist
    if (rxItems.length > 0 && rxItems.some(it => it.drugName)) {
      dbClient.createPrescription(orgId, {
        branch_id: activeBranch?.id || dbClient.getBranches(orgId)[0]?.id || '',
        consultation_id: saved.id,
        patient_id: selectedPatientId,
        doctor_id: selectedDoctorId,
        issued_date: new Date().toISOString().split('T')[0],
        diagnosis_summary: selectedDiagnoses.map(d => d.description).join(', '),
        is_dispensed: false,
        items: rxItems.map((it, idx) => ({
          id: `item-${idx}`,
          organization_id: orgId,
          prescription_id: '',
          drug_name: it.drugName,
          dosage: it.dosage,
          frequency: it.frequency,
          duration: it.duration,
          quantity: it.quantity,
          created_at: new Date().toISOString(),
        }))
      });
    }

    setIsSigned(true);
    success(locale === 'ar' ? 'تم توقيع واعتماد الكشف الطبي والروشتة رقمياً' : 'Consultation & e-Prescription digitally signed & finalized');
  };

  return (
    <div className="space-y-6">
      {/* Header & Patient Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-6 h-6 text-medicore-600" />
            {t.consultation.doctorDesk}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' ? 'الفحص السريري المتكامل، العلامات الحيوية، والمحركات التشخيصية التخصصية' : 'Integrated Clinical Examination, Vitals & Specialty Visualizers'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isSigned && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{t.consultation.signedNotice}</span>
            </div>
          )}
        </div>
      </div>

      {/* Patient Banner Card */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-medicore-50 text-medicore-700 font-black text-base flex items-center justify-center">
            {selectedPatient?.first_name_ar.slice(0, 1) || 'PT'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500">{t.appointments.selectPatient}:</label>
              <select
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="text-sm font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg p-1"
              >
                {patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.first_name_ar} {p.last_name_ar} ({p.mrn})
                  </option>
                ))}
              </select>
            </div>
            {selectedPatient && (
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedPatient.gender === 'male' ? t.emr.male : t.emr.female} • {t.emr.bloodGroup}: <strong className="text-rose-600">{selectedPatient.blood_group}</strong> • {selectedPatient.phone}
              </p>
            )}
          </div>
        </div>

        {/* Doctor Selection */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">{locale === 'ar' ? 'الطبيب المعالج:' : 'Doctor:'}</span>
          <select
            value={selectedDoctorId}
            onChange={e => setSelectedDoctorId(e.target.value)}
            className="text-xs font-bold p-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800"
          >
            {doctors.map(d => (
              <option key={d.id} value={d.id}>
                {d.user ? d.user[locale === 'ar' ? 'name_ar' : 'name_en'] : ''} ({d[locale === 'ar' ? 'specialty_title_ar' : 'specialty_title_en']})
              </option>
            ))}
          </select>
        </div>
      </div>

      <form onSubmit={handleSignConsultation} className="space-y-6">
        {/* 1. Vitals Section */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Heart className="w-4 h-4 text-rose-500" />
            {t.consultation.vitals}
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* BP */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500">{t.consultation.bp}</span>
              <div className="flex items-center gap-1 mt-1">
                <input
                  type="number"
                  value={systolic}
                  onChange={e => setSystolic(Number(e.target.value))}
                  className="w-12 text-sm font-mono font-bold bg-white border border-slate-300 rounded p-1 text-center"
                />
                <span className="text-slate-400 font-bold">/</span>
                <input
                  type="number"
                  value={diastolic}
                  onChange={e => setDiastolic(Number(e.target.value))}
                  className="w-12 text-sm font-mono font-bold bg-white border border-slate-300 rounded p-1 text-center"
                />
              </div>
            </div>

            {/* Pulse */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500">{t.consultation.pulse}</span>
              <input
                type="number"
                value={heartRate}
                onChange={e => setHeartRate(Number(e.target.value))}
                className="w-full text-sm font-mono font-bold bg-white border border-slate-300 rounded p-1 mt-1 text-center"
              />
            </div>

            {/* Temp */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500">{t.consultation.temp}</span>
              <input
                type="number"
                step="0.1"
                value={temp}
                onChange={e => setTemp(Number(e.target.value))}
                className="w-full text-sm font-mono font-bold bg-white border border-slate-300 rounded p-1 mt-1 text-center"
              />
            </div>

            {/* Weight */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500">{t.consultation.weight}</span>
              <input
                type="number"
                value={weightKg}
                onChange={e => setWeightKg(Number(e.target.value))}
                className="w-full text-sm font-mono font-bold bg-white border border-slate-300 rounded p-1 mt-1 text-center"
              />
            </div>

            {/* Height */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-bold text-slate-500">{t.consultation.height}</span>
              <input
                type="number"
                value={heightCm}
                onChange={e => setHeightCm(Number(e.target.value))}
                className="w-full text-sm font-mono font-bold bg-white border border-slate-300 rounded p-1 mt-1 text-center"
              />
            </div>

            {/* BMI */}
            <div className="p-3 rounded-xl bg-medicore-50 border border-medicore-100 flex flex-col justify-between">
              <span className="text-[11px] font-bold text-medicore-700">{t.consultation.bmi}</span>
              <div className="text-lg font-black text-medicore-900 font-mono mt-1 text-center">
                {bmi}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Chief Complaint & Subjective */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              {t.consultation.chiefComplaint} *
            </label>
            <textarea
              rows={3}
              required
              value={chiefComplaint}
              onChange={e => setChiefComplaint(e.target.value)}
              placeholder={locale === 'ar' ? 'شكوى المريض الرئيسية وأعراض المرض...' : 'Chief complaint...'}
              className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-medicore-500"
            />
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              {t.consultation.hpi}
            </label>
            <textarea
              rows={3}
              value={hpi}
              onChange={e => setHpi(e.target.value)}
              placeholder={locale === 'ar' ? 'تطور الأعراض، الفحص الإكلينيكي الموضعي...' : 'History of present illness & physical exam...'}
              className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
            />
          </div>
        </div>

        {/* 3. Interactive Specialty Module Embedded Directly in Consultation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-medicore-600" />
                {t.consultation.specialtyExamination}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {specialtyInfo ? (locale === 'ar' ? specialtyInfo.name_ar : specialtyInfo.name_en) : specialtyCode}
                {specialtyInfo?.category_name_ar && (
                  <span className="text-slate-400"> • {locale === 'ar' ? specialtyInfo.category_name_ar : specialtyInfo.category_name_en}</span>
                )}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Clinical Suite Switcher */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-500">
                  {locale === 'ar' ? 'أداة الفحص:' : 'Suite:'}
                </span>
                <select
                  value={activeClinicalModule}
                  onChange={e => setActiveClinicalModule(e.target.value as ClinicalModuleType)}
                  className="text-xs font-bold p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800"
                >
                  <option value="orthopedics">{locale === 'ar' ? 'جراحة العظام (Orthopedics 3D/2D)' : 'Orthopedics (3D/2D)'}</option>
                  <option value="dentistry">{locale === 'ar' ? 'طب الأسنان (Dentistry FDI 3D/2D)' : 'Dentistry FDI (3D/2D)'}</option>
                  <option value="dermatology">{locale === 'ar' ? 'الجلدية والجسم (Dermatology 3D/2D)' : 'Dermatology (3D/2D)'}</option>
                  <option value="ophthalmology">{locale === 'ar' ? 'طب العيون (Ophthalmology)' : 'Ophthalmology'}</option>
                  <option value="cardiology">{locale === 'ar' ? 'أمراض القلب (Cardiology)' : 'Cardiology'}</option>
                  <option value="gastroenterology">{locale === 'ar' ? 'الجهاز الهضمي (Gastroenterology)' : 'Gastroenterology'}</option>
                  <option value="pediatrics">{locale === 'ar' ? 'طب الأطفال (Pediatrics & Growth)' : 'Pediatrics'}</option>
                  <option value="gynecology_obstetrics">{locale === 'ar' ? 'النساء والتوليد (OB/GYN)' : 'Gynecology & OB'}</option>
                  <option value="neurology">{locale === 'ar' ? 'المخ والأعصاب (Neurology GCS/MRC)' : 'Neurology'}</option>
                  <option value="pulmonology">{locale === 'ar' ? 'الصدرية والرئة (Pulmonology PFT)' : 'Pulmonology'}</option>
                  <option value="ent">{locale === 'ar' ? 'الأنف والأذن والحنجرة (ENT)' : 'ENT'}</option>
                  <option value="urology">{locale === 'ar' ? 'المسالك البولية (Urology IPSS/DRE)' : 'Urology'}</option>
                  <option value="psychiatry">{locale === 'ar' ? 'الطب النفسي (Psychiatry MSE/PHQ-9)' : 'Psychiatry'}</option>
                  <option value="general_template">{locale === 'ar' ? 'الطب العام والباطني (General Clinical)' : 'General Clinical'}</option>
                </select>
              </div>

              {/* 3D vs 2D Mode Switcher */}
              {['orthopedics', 'dentistry', 'dermatology'].includes(activeClinicalModule) && (
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setEngineMode('3d')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                      engineMode === '3d' ? 'bg-medicore-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>3D</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEngineMode('2d')}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all ${
                      engineMode === '2d' ? 'bg-medicore-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>2D</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Interactive Visualizer Component based on active clinical module */}
          {activeClinicalModule === 'orthopedics' && (
            engineMode === '3d' ? (
              <SkeletonViewer3D findings={orthoFindings} onChange={setOrthoFindings} readOnly={isSigned} />
            ) : (
              <SkeletonViewer findings={orthoFindings} onChange={setOrthoFindings} readOnly={isSigned} />
            )
          )}

          {activeClinicalModule === 'dentistry' && (
            engineMode === '3d' ? (
              <OdontogramViewer3D records={dentalRecords} onChange={setDentalRecords} readOnly={isSigned} />
            ) : (
              <OdontogramViewer records={dentalRecords} onChange={setDentalRecords} readOnly={isSigned} />
            )
          )}

          {activeClinicalModule === 'dermatology' && (
            engineMode === '3d' ? (
              <DermatomeMap3D findings={dermaFindings} onChange={setDermaFindings} readOnly={isSigned} />
            ) : (
              <DermatomeMap findings={dermaFindings} onChange={setDermaFindings} readOnly={isSigned} />
            )
          )}

          {activeClinicalModule === 'ophthalmology' && (
            <OphthalmologyViewer data={eyeData} onChange={setEyeData} readOnly={isSigned} />
          )}

          {activeClinicalModule === 'cardiology' && (
            <CardiologyModule data={cardioData} onChange={setCardioData} readOnly={isSigned} />
          )}

          {activeClinicalModule === 'gastroenterology' && (
            <GastroenterologyModule data={gastroData} onChange={setGastroData} readOnly={isSigned} />
          )}

          {activeClinicalModule === 'pediatrics' && (
            <PediatricsModule data={pediaData} onChange={setPediaData} readOnly={isSigned} />
          )}

          {activeClinicalModule === 'gynecology_obstetrics' && (
            <GynecologyModule data={gynData} onChange={setGynData} readOnly={isSigned} />
          )}

          {activeClinicalModule === 'neurology' && (
            <NeurologyModule data={neuroData} onChange={setNeuroData} readOnly={isSigned} />
          )}

          {activeClinicalModule === 'pulmonology' && (
            <PulmonologyModule data={pulmoData} onChange={setPulmoData} readOnly={isSigned} />
          )}

          {activeClinicalModule === 'ent' && (
            <EntModule data={entData} onChange={setEntData} readOnly={isSigned} />
          )}

          {activeClinicalModule === 'urology' && (
            <UrologyModule data={uroData} onChange={setUroData} readOnly={isSigned} />
          )}

          {activeClinicalModule === 'psychiatry' && (
            <PsychiatryModule data={psychData} onChange={setPsychData} readOnly={isSigned} />
          )}

          {activeClinicalModule === 'general_template' && (
            <GeneralClinicalTemplate 
              specialtyTitle={specialtyInfo ? (locale === 'ar' ? specialtyInfo.name_ar : specialtyInfo.name_en) : undefined} 
              data={generalData} 
              onChange={setGeneralData} 
              readOnly={isSigned} 
            />
          )}
        </div>

        {/* 4. ICD-10 Diagnoses Search & Tags */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-medicore-600" />
            {t.consultation.diagnoses} (ICD-10)
          </h3>

          <div className="flex flex-wrap gap-2">
            {COMMON_ICD10_DIAGNOSES.map(d => {
              const isAdded = selectedDiagnoses.some(sd => sd.code === d.code);
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => handleAddDiagnosis(d.code, d[locale === 'ar' ? 'description_ar' : 'description_en'])}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                    isAdded
                      ? 'bg-medicore-600 text-white border-medicore-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-mono text-[11px] opacity-80">{d.code}</span>
                  <span>{d[locale === 'ar' ? 'description_ar' : 'description_en']}</span>
                </button>
              );
            })}
          </div>

          {selectedDiagnoses.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
              {selectedDiagnoses.map(d => (
                <div key={d.code} className="px-3 py-1 rounded-lg bg-medicore-50 border border-medicore-200 text-medicore-900 text-xs font-bold flex items-center gap-2">
                  <span>{d.code}: {d.description}</span>
                  {!isSigned && (
                    <button type="button" onClick={() => handleRemoveDiagnosis(d.code)} className="text-slate-400 hover:text-rose-600">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. Electronic Prescription (e-Rx) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              {t.prescriptions.title}
            </h3>
            {!isSigned && (
              <button
                type="button"
                onClick={handleAddRxItem}
                className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{locale === 'ar' ? 'إضافة دواء' : 'Add Medication'}</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            {rxItems.map((item, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-5 gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 items-center">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    disabled={isSigned}
                    value={item.drugName}
                    onChange={e => {
                      const updated = [...rxItems];
                      updated[index].drugName = e.target.value;
                      setRxItems(updated);
                    }}
                    placeholder={locale === 'ar' ? 'اسم الدواء (تجاري أو علمي)...' : 'Drug name...'}
                    className="w-full text-xs font-bold p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    disabled={isSigned}
                    value={item.dosage}
                    onChange={e => {
                      const updated = [...rxItems];
                      updated[index].dosage = e.target.value;
                      setRxItems(updated);
                    }}
                    placeholder="الجرعة"
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    disabled={isSigned}
                    value={item.frequency}
                    onChange={e => {
                      const updated = [...rxItems];
                      updated[index].frequency = e.target.value;
                      setRxItems(updated);
                    }}
                    placeholder="التكرار"
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    disabled={isSigned}
                    value={item.duration}
                    onChange={e => {
                      const updated = [...rxItems];
                      updated[index].duration = e.target.value;
                      setRxItems(updated);
                    }}
                    placeholder="المدة"
                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white"
                  />
                  {!isSigned && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRxItem(index)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. Treatment Plan & Follow-Up */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {t.consultation.treatmentPlan}
            </label>
            <textarea
              rows={2}
              disabled={isSigned}
              value={treatmentPlan}
              onChange={e => setTreatmentPlan(e.target.value)}
              placeholder={locale === 'ar' ? 'التوصيات العلاجية، الراحة، التمارين، الإرشادات...' : 'Treatment recommendations...'}
              className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.consultation.followUpDate}
              </label>
              <input
                type="date"
                disabled={isSigned}
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
              />
            </div>
          </div>
        </div>

        {/* Digital Sign & Submit Toolbar */}
        {!isSigned ? (
          <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-400 shrink-0" />
              <p className="text-xs text-slate-300">
                {locale === 'ar' ? 'عند الاعتماد والتوقيع الرقمي، سيتم قفل الكشف نهائياً وتسجيل الروشتة وسجل التدقيق' : 'Digital signing locks the clinical record to prevent silent alterations.'}
              </p>
            </div>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all"
            >
              {t.consultation.signAndFinalize}
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <div>
                <p className="font-bold text-sm text-emerald-900">
                  {locale === 'ar' ? 'تم توقيع واعتماد الكشف الطبي بنجاح' : 'Consultation Digitally Signed'}
                </p>
                <p className="text-xs text-emerald-700">
                  {t.consultation.signedNotice}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSigned(false)}
              className="text-xs font-bold text-slate-600 underline"
            >
              {t.consultation.amend}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
