// ============================================================================
// MEDICORE – Interactive Clinical Specialties & 3D Anatomy Suite
// Patient-Linked Versioned Examinations Saved & Audited in Supabase
// ============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatSpecialtyFindingTypeLabel } from '../../lib/facilityLabels';
import {
  ClinicalModuleType,
  MASTER_MEDICAL_SPECIALTIES,
  getSpecialtyByCode,
  resolveClinicalModule,
} from '../../config/medicalSpecialties';
import { AnatomicalFinding, Patient } from '../../types/database';
import {
  CardiologyData,
  DermaFinding,
  EntData,
  EyeExaminationData,
  GastroData,
  GeneralClinicalData,
  GynecologyData,
  NeurologyData,
  OrthopedicFinding,
  PediatricsData,
  PsychiatryData,
  PulmonologyData,
  ToothRecord,
  UrologyData,
} from '../../types/specialty';
import {
  createEmptyCardiologyData,
  createEmptyEntData,
  createEmptyEyeData,
  createEmptyGastroData,
  createEmptyGeneralClinicalData,
  createEmptyGynecologyData,
  createEmptyNeurologyData,
  createEmptyPediatricsData,
  createEmptyPsychiatryData,
  createEmptyPulmonologyData,
  createEmptyUrologyData,
} from '../../lib/specialtyDefaults';
import { SkeletonViewer3D } from '../../components/anatomy/SkeletonViewer3D';
import { SkeletonViewer } from '../../components/anatomy/SkeletonViewer';
import { OdontogramViewer3D } from '../../components/anatomy/OdontogramViewer3D';
import { OdontogramViewer } from '../../components/anatomy/OdontogramViewer';
import { DermatomeMap3D } from '../../components/anatomy/DermatomeMap3D';
import { DermatomeMap } from '../../components/anatomy/DermatomeMap';
import { OphthalmologyViewer } from '../../components/anatomy/OphthalmologyViewer';
import { CardiologyModule } from '../../components/anatomy/CardiologyModule';
import { EntModule } from '../../components/anatomy/EntModule';
import { GastroenterologyModule } from '../../components/anatomy/GastroenterologyModule';
import { GynecologyModule } from '../../components/anatomy/GynecologyModule';
import { NeurologyModule } from '../../components/anatomy/NeurologyModule';
import { PediatricsModule } from '../../components/anatomy/PediatricsModule';
import { PsychiatryModule } from '../../components/anatomy/PsychiatryModule';
import { PulmonologyModule } from '../../components/anatomy/PulmonologyModule';
import { UrologyModule } from '../../components/anatomy/UrologyModule';
import { GeneralClinicalTemplate } from '../../components/anatomy/GeneralClinicalTemplate';
import {
  Stethoscope,
  Save,
  History,
  Box,
  Layers,
  UserCheck,
  RefreshCw,
  AlertTriangle,
  Plus,
} from 'lucide-react';

type PatientOption = Pick<
  Patient,
  'id' | 'mrn' | 'first_name_ar' | 'last_name_ar' | 'first_name_en' | 'last_name_en'
>;

type ConsultationOption = {
  id: string;
  consultation_date: string;
  chief_complaint: string;
};

type SnapshotRow = AnatomicalFinding & {
  recorder?: { name_ar?: string; name_en?: string } | null;
};

export const Specialties: React.FC = () => {
  const { user, organization, activeBranch, can, hasCustomPermission } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();
  const ar = locale === 'ar';

  const orgId = organization?.id || '';
  const branchId = activeBranch?.id || '';
  const role = user?.role || '';

  const canView = can('consultations', 'view') || can('patients', 'view');
  const canWrite = (['super_admin', 'org_owner', 'general_manager', 'medical_director', 'branch_manager', 'doctor', 'assistant_doctor', 'nurse'].includes(role) || hasCustomPermission('clinical_manage')) && hasCustomPermission('clinical_manage');

  const availableSpecialties = useMemo(() => {
    const orgCodes = Array.isArray(organization?.specialties) && organization.specialties.length > 0
      ? organization.specialties
      : [];
    const branchCodes = Array.isArray(activeBranch?.specialties) && activeBranch.specialties.length > 0
      ? activeBranch.specialties
      : [];
    const activeCodes = branchCodes.length > 0 ? branchCodes : orgCodes;
    if (activeCodes.length === 0) return MASTER_MEDICAL_SPECIALTIES.filter((s) => s.is_active);

    const matched = MASTER_MEDICAL_SPECIALTIES.filter(
      (s) => s.is_active && activeCodes.includes(s.code)
    );
    return matched.length > 0 ? matched : MASTER_MEDICAL_SPECIALTIES.filter((s) => s.is_active);
  }, [organization?.specialties, activeBranch?.specialties]);

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [consultations, setConsultations] = useState<ConsultationOption[]>([]);
  const [history, setHistory] = useState<SnapshotRow[]>([]);

  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedConsultationId, setSelectedConsultationId] = useState('');
  const [selectedSpecialtyCode, setSelectedSpecialtyCode] = useState('orthopedic_surgery');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>('');
  const [use3DView, setUse3DView] = useState(true);
  const [examNotes, setExamNotes] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Clean Empty State per Module (No hardcoded patient sample data)
  const [orthoFindings, setOrthoFindings] = useState<OrthopedicFinding[]>([]);
  const [dentalRecords, setDentalRecords] = useState<Record<number, ToothRecord>>({});
  const [dermaFindings, setDermaFindings] = useState<DermaFinding[]>([]);
  const [eyeData, setEyeData] = useState<EyeExaminationData>(createEmptyEyeData);
  const [cardioData, setCardioData] = useState<CardiologyData>(createEmptyCardiologyData);
  const [entData, setEntData] = useState<EntData>(createEmptyEntData);
  const [gastroData, setGastroData] = useState<GastroData>(createEmptyGastroData);
  const [gynData, setGynData] = useState<GynecologyData>(createEmptyGynecologyData);
  const [neuroData, setNeuroData] = useState<NeurologyData>(createEmptyNeurologyData);
  const [pedData, setPedData] = useState<PediatricsData>(createEmptyPediatricsData);
  const [psychData, setPsychData] = useState<PsychiatryData>(createEmptyPsychiatryData);
  const [pulmoData, setPulmoData] = useState<PulmonologyData>(createEmptyPulmonologyData);
  const [uroData, setUroData] = useState<UrologyData>(createEmptyUrologyData);
  const [generalData, setGeneralData] = useState<GeneralClinicalData>(createEmptyGeneralClinicalData);

  // Sync default specialty code to available tenant specialties (or logged-in clinician specialty)
  useEffect(() => {
    if (!supabase || !orgId || !user?.id || !['doctor', 'assistant_doctor'].includes(role)) return;
    let alive = true;
    void supabase
      .from('doctors')
      .select('specialty_code')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data?.specialty_code) return;
        if (availableSpecialties.some(s => s.code === data.specialty_code)) {
          setSelectedSpecialtyCode(data.specialty_code);
        }
      });
    return () => { alive = false; };
  }, [orgId, user?.id, role, availableSpecialties]);

  useEffect(() => {
    if (
      availableSpecialties.length > 0 &&
      !availableSpecialties.some((s) => s.code === selectedSpecialtyCode)
    ) {
      setSelectedSpecialtyCode(availableSpecialties[0].code);
    }
  }, [availableSpecialties, selectedSpecialtyCode]);

  const activeModule: ClinicalModuleType = useMemo(
    () => resolveClinicalModule(selectedSpecialtyCode),
    [selectedSpecialtyCode]
  );

  const selectedSpecialtyMeta = useMemo(
    () => getSpecialtyByCode(selectedSpecialtyCode),
    [selectedSpecialtyCode]
  );

  const resetModulePayload = useCallback((mod: ClinicalModuleType) => {
    setSelectedSnapshotId('');
    setExamNotes('');
    switch (mod) {
      case 'orthopedics':
        setOrthoFindings([]);
        break;
      case 'dentistry':
        setDentalRecords({});
        break;
      case 'dermatology':
        setDermaFindings([]);
        break;
      case 'ophthalmology':
        setEyeData(createEmptyEyeData());
        break;
      case 'cardiology':
        setCardioData(createEmptyCardiologyData());
        break;
      case 'ent':
        setEntData(createEmptyEntData());
        break;
      case 'gastroenterology':
        setGastroData(createEmptyGastroData());
        break;
      case 'gynecology_obstetrics':
        setGynData(createEmptyGynecologyData());
        break;
      case 'neurology':
        setNeuroData(createEmptyNeurologyData());
        break;
      case 'pediatrics':
        setPedData(createEmptyPediatricsData());
        break;
      case 'psychiatry':
        setPsychData(createEmptyPsychiatryData());
        break;
      case 'pulmonology':
        setPulmoData(createEmptyPulmonologyData());
        break;
      case 'urology':
        setUroData(createEmptyUrologyData());
        break;
      default:
        setGeneralData(createEmptyGeneralClinicalData());
        break;
    }
  }, []);

  const applySnapshotPayload = useCallback((row: SnapshotRow) => {
    setSelectedSnapshotId(row.id);
    setExamNotes(row.annotation_text || '');
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const payload = meta.payload as Record<string, unknown> | undefined;
    switch (row.module_type as ClinicalModuleType) {
      case 'orthopedics':
        setOrthoFindings(Array.isArray(meta.findings) ? (meta.findings as OrthopedicFinding[]) : []);
        break;
      case 'dentistry':
        setDentalRecords(
          meta.teethRecords && typeof meta.teethRecords === 'object'
            ? (meta.teethRecords as Record<number, ToothRecord>)
            : {}
        );
        break;
      case 'dermatology':
        setDermaFindings(Array.isArray(meta.findings) ? (meta.findings as DermaFinding[]) : []);
        break;
      case 'ophthalmology':
        setEyeData((payload as unknown as EyeExaminationData) || createEmptyEyeData());
        break;
      case 'cardiology':
        setCardioData((payload as unknown as CardiologyData) || createEmptyCardiologyData());
        break;
      case 'ent':
        setEntData((payload as unknown as EntData) || createEmptyEntData());
        break;
      case 'gastroenterology':
        setGastroData((payload as unknown as GastroData) || createEmptyGastroData());
        break;
      case 'gynecology_obstetrics':
        setGynData((payload as unknown as GynecologyData) || createEmptyGynecologyData());
        break;
      case 'neurology':
        setNeuroData((payload as unknown as NeurologyData) || createEmptyNeurologyData());
        break;
      case 'pediatrics':
        setPedData((payload as unknown as PediatricsData) || createEmptyPediatricsData());
        break;
      case 'psychiatry':
        setPsychData((payload as unknown as PsychiatryData) || createEmptyPsychiatryData());
        break;
      case 'pulmonology':
        setPulmoData((payload as unknown as PulmonologyData) || createEmptyPulmonologyData());
        break;
      case 'urology':
        setUroData((payload as unknown as UrologyData) || createEmptyUrologyData());
        break;
      default:
        setGeneralData((payload as unknown as GeneralClinicalData) || createEmptyGeneralClinicalData());
        break;
    }
  }, []);

  const loadPatients = useCallback(async () => {
    if (!supabase || !orgId || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: pErr } = await supabase
        .from('patients')
        .select('id,mrn,first_name_ar,last_name_ar,first_name_en,last_name_en')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(200);
      if (pErr) throw pErr;
      const rows = (data || []) as PatientOption[];
      setPatients(rows);
      if (rows.length > 0 && !selectedPatientId) {
        setSelectedPatientId(rows[0].id);
      }
    } catch (err) {
      console.error('Load specialty patients error:', err);
      error(ar ? 'تعذر تحميل قائمة المرضى.' : 'Unable to load patients.');
    } finally {
      setLoading(false);
    }
  }, [orgId, canView, ar, error, selectedPatientId]);

  useEffect(() => {
    void loadPatients();
  }, [loadPatients]);

  const loadPatientHistory = useCallback(async () => {
    if (!supabase || !orgId || !selectedPatientId) {
      setConsultations([]);
      setHistory([]);
      resetModulePayload(activeModule);
      return;
    }
    try {
      const [consRes, histRes] = await Promise.all([
        supabase
          .from('consultations')
          .select('id,consultation_date,chief_complaint')
          .eq('organization_id', orgId)
          .eq('patient_id', selectedPatientId)
          .order('consultation_date', { ascending: false })
          .limit(20),
        supabase
          .from('anatomical_findings')
          .select('*, recorder:users!anatomical_findings_recorded_by_fkey(name_ar,name_en)')
          .eq('organization_id', orgId)
          .eq('patient_id', selectedPatientId)
          .eq('module_type', activeModule)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      setConsultations((consRes.data || []) as ConsultationOption[]);
      if (histRes.error) throw histRes.error;
      const histRows = (histRes.data || []) as unknown as SnapshotRow[];
      setHistory(histRows);
      if (histRows.length > 0) {
        applySnapshotPayload(histRows[0]);
      } else {
        resetModulePayload(activeModule);
      }
    } catch (err) {
      console.error('Load patient specialty history error:', err);
      error(ar ? 'تعذر تحميل سجل الفحوصات التخصصية للمريض.' : 'Unable to load patient specialty history.');
    }
  }, [orgId, selectedPatientId, activeModule, ar, error, applySnapshotPayload, resetModulePayload]);

  useEffect(() => {
    void loadPatientHistory();
  }, [loadPatientHistory]);

  const buildSnapshotPayload = (): {
    regionId: string;
    findingType: string;
    metadata: Record<string, unknown>;
    hasData: boolean;
  } => {
    switch (activeModule) {
      case 'orthopedics':
        return {
          regionId: orthoFindings[0]?.regionId || 'full_skeleton',
          findingType: `${orthoFindings.length}_orthopedic_findings`,
          metadata: { findings: orthoFindings },
          hasData: orthoFindings.length > 0,
        };
      case 'dentistry': {
        const count = Object.keys(dentalRecords).length;
        return {
          regionId: count > 0 ? `teeth_${Object.keys(dentalRecords)[0]}` : 'full_arch',
          findingType: `${count}_odontogram_records`,
          metadata: { teethRecords: dentalRecords },
          hasData: count > 0,
        };
      }
      case 'dermatology':
        return {
          regionId: dermaFindings[0]?.view || 'body_surface',
          findingType: `${dermaFindings.length}_dermatology_lesions`,
          metadata: { findings: dermaFindings },
          hasData: dermaFindings.length > 0,
        };
      case 'ophthalmology':
        return {
          regionId: 'bilateral_eyes',
          findingType: 'ophthalmology_exam',
          metadata: { payload: eyeData },
          hasData: Boolean(
            eyeData.rightEye.visualAcuityUncorrected ||
              eyeData.leftEye.visualAcuityUncorrected ||
              eyeData.rightEye.intraocularPressureMmHg ||
              eyeData.leftEye.intraocularPressureMmHg ||
              eyeData.rightEye.fundusRetinaNotes ||
              eyeData.leftEye.fundusRetinaNotes
          ),
        };
      case 'cardiology':
        return {
          regionId: 'cardiovascular',
          findingType: 'cardiology_exam',
          metadata: { payload: cardioData },
          hasData: Boolean(cardioData.systolicBp || cardioData.heartRate || cardioData.ecgSummary || cardioData.cardiacNotes),
        };
      case 'ent':
        return {
          regionId: 'ent_region',
          findingType: 'ent_exam',
          metadata: { payload: entData },
          hasData: Boolean(entData.entNotes || entData.tonsilGrade > 0 || entData.rightEarTm !== 'intact_normal' || entData.leftEarTm !== 'intact_normal'),
        };
      case 'gastroenterology':
        return {
          regionId: gastroData.painQuadrants[0] || 'abdomen',
          findingType: 'gastroenterology_exam',
          metadata: { payload: gastroData },
          hasData: Boolean(gastroData.painQuadrants.length || gastroData.tenderness || gastroData.endoscopyReport || gastroData.notes),
        };
      case 'gynecology_obstetrics':
        return {
          regionId: 'ob_gyn',
          findingType: 'gynecology_exam',
          metadata: { payload: gynData },
          hasData: Boolean(gynData.lmpDate || gynData.ultrasoundNotes || gynData.gravida || gynData.fetalHeartRateBpm),
        };
      case 'neurology':
        return {
          regionId: 'nervous_system',
          findingType: 'neurology_exam',
          metadata: { payload: neuroData },
          hasData: true,
        };
      case 'pediatrics':
        return {
          regionId: 'pediatric_growth',
          findingType: 'pediatrics_exam',
          metadata: { payload: pedData },
          hasData: Boolean(pedData.weightKg || pedData.heightCm || pedData.pediatricNotes || pedData.completedVaccines.length),
        };
      case 'psychiatry':
        return {
          regionId: 'mental_status',
          findingType: 'psychiatry_mse',
          metadata: { payload: psychData },
          hasData: Boolean(psychData.phq9Score || psychData.gad7Score || psychData.psychNotes || psychData.moodSubjective !== 'euthymic'),
        };
      case 'pulmonology':
        return {
          regionId: 'respiratory_tract',
          findingType: 'pulmonology_exam',
          metadata: { payload: pulmoData },
          hasData: Boolean(pulmoData.spO2 || pulmoData.respiratoryRate || pulmoData.imagingFindings || pulmoData.pulmoNotes),
        };
      case 'urology':
        return {
          regionId: 'urinary_tract',
          findingType: 'urology_exam',
          metadata: { payload: uroData },
          hasData: Boolean(uroData.ipssScore || uroData.serumPsa || uroData.uroNotes || uroData.dysuria),
        };
      default:
        return {
          regionId: selectedSpecialtyCode,
          findingType: 'general_specialty_exam',
          metadata: { payload: generalData },
          hasData: Boolean(generalData.primaryComplaint || generalData.systemicExamNotes || generalData.clinicalPlan),
        };
    }
  };

  const saveExamSnapshot = async () => {
    if (!supabase || !orgId || !selectedPatientId) {
      error(ar ? 'اختر مريضاً أولاً قبل الحفظ.' : 'Select a patient first.');
      return;
    }
    if (!canWrite) {
      error(ar ? 'ليست لديك صلاحية تسجيل الفحوصات التخصصية.' : 'Insufficient permissions to save specialty findings.');
      return;
    }
    const built = buildSnapshotPayload();
    if (!built.hasData && !examNotes.trim()) {
      error(ar ? 'أدخل بيانات سريرية أو علامات تشريحية على الأقل قبل الحفظ.' : 'Record clinical findings or notes before saving.');
      return;
    }

    setSaving(true);
    try {
      const { data, error: insError } = await supabase
        .from('anatomical_findings')
        .insert({
          organization_id: orgId,
          branch_id: branchId || null,
          patient_id: selectedPatientId,
          consultation_id: selectedConsultationId || null,
          module_type: activeModule,
          specialty_code: selectedSpecialtyCode,
          canvas_view: use3DView ? 'interactive_3d_snapshot' : 'structured_snapshot',
          anatomical_region_id: built.regionId,
          finding_type: built.findingType,
          annotation_text: examNotes.trim() || null,
          marker_color: '#0D9488',
          metadata: built.metadata,
        })
        .select('*')
        .single();

      if (insError || !data) throw insError || new Error('Insert failed');

      success(ar ? 'تم حفظ الفحص التخصصي في سجل المريض بنجاح.' : 'Specialty examination saved to patient record.');
      setSelectedSnapshotId(data.id);
      await loadPatientHistory();
    } catch (err) {
      console.error('Save anatomical finding error:', err);
      error(ar ? 'تعذر حفظ الفحص التخصصي. تأكد من صلاحية الفرع.' : 'Failed to save specialty findings.');
    } finally {
      setSaving(false);
    }
  };

  const renderSpecialtyCanvas = () => {
    const readOnlyMode = !canWrite;
    switch (activeModule) {
      case 'orthopedics':
        return use3DView ? (
          <SkeletonViewer3D findings={orthoFindings} onChange={setOrthoFindings} readOnly={readOnlyMode} />
        ) : (
          <SkeletonViewer findings={orthoFindings} onChange={setOrthoFindings} readOnly={readOnlyMode} />
        );
      case 'dentistry':
        return use3DView ? (
          <OdontogramViewer3D records={dentalRecords} onChange={setDentalRecords} readOnly={readOnlyMode} />
        ) : (
          <OdontogramViewer records={dentalRecords} onChange={setDentalRecords} readOnly={readOnlyMode} />
        );
      case 'dermatology':
        return use3DView ? (
          <DermatomeMap3D findings={dermaFindings} onChange={setDermaFindings} readOnly={readOnlyMode} />
        ) : (
          <DermatomeMap findings={dermaFindings} onChange={setDermaFindings} readOnly={readOnlyMode} />
        );
      case 'ophthalmology':
        return <OphthalmologyViewer data={eyeData} onChange={setEyeData} readOnly={readOnlyMode} />;
      case 'cardiology':
        return <CardiologyModule data={cardioData} onChange={setCardioData} readOnly={readOnlyMode} />;
      case 'ent':
        return <EntModule data={entData} onChange={setEntData} readOnly={readOnlyMode} />;
      case 'gastroenterology':
        return <GastroenterologyModule data={gastroData} onChange={setGastroData} readOnly={readOnlyMode} />;
      case 'gynecology_obstetrics':
        return <GynecologyModule data={gynData} onChange={setGynData} readOnly={readOnlyMode} />;
      case 'neurology':
        return <NeurologyModule data={neuroData} onChange={setNeuroData} readOnly={readOnlyMode} />;
      case 'pediatrics':
        return <PediatricsModule data={pedData} onChange={setPedData} readOnly={readOnlyMode} />;
      case 'psychiatry':
        return <PsychiatryModule data={psychData} onChange={setPsychData} readOnly={readOnlyMode} />;
      case 'pulmonology':
        return <PulmonologyModule data={pulmoData} onChange={setPulmoData} readOnly={readOnlyMode} />;
      case 'urology':
        return <UrologyModule data={uroData} onChange={setUroData} readOnly={readOnlyMode} />;
      default:
        return (
          <GeneralClinicalTemplate
            specialtyTitle={ar ? selectedSpecialtyMeta?.name_ar : selectedSpecialtyMeta?.name_en}
            data={generalData}
            onChange={setGeneralData}
            readOnly={readOnlyMode}
          />
        );
    }
  };

  if (!canView) {
    return (
      <section className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center" dir={ar ? 'rtl' : 'ltr'}>
        <AlertTriangle className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-3 text-lg font-black text-slate-900">{t.nav.specialties}</h1>
        <p className="mt-2 text-sm text-rose-900">
          {ar ? 'ليست لديك صلاحية عرض وحدات التخصصات الطبية.' : 'You do not have permission to view specialty exams.'}
        </p>
      </section>
    );
  }

  const isInteractive3DCapable = ['orthopedics', 'dentistry', 'dermatology'].includes(activeModule);

  return (
    <div className="space-y-6" dir={ar ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
            <Stethoscope className="h-7 w-7 text-teal-600" />
            {t.nav.specialties}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ar
              ? 'النماذج التشريحية ثلاثية الأبعاد (3D) والفحوصات التخصصية المرتبطة مباشرة بملف المريض وسجل التدقيق.'
              : 'Interactive 3D anatomical diagrams and clinical specialty suites persisted directly to patient records.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isInteractive3DCapable && (
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setUse3DView(true)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                  use3DView ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Box className="h-3.5 w-3.5" />
                3D
              </button>
              <button
                type="button"
                onClick={() => setUse3DView(false)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                  !use3DView ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                2D
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => void loadPatientHistory()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {ar ? 'تحديث' : 'Refresh'}
          </button>

          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => resetModulePayload(activeModule)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                {ar ? 'فحص جديد فارغ' : 'New Blank Exam'}
              </button>
              <button
                type="button"
                disabled={saving || !selectedPatientId}
                onClick={() => void saveExamSnapshot()}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white hover:bg-teal-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? (ar ? 'جاري الحفظ...' : 'Saving...') : ar ? 'حفظ في ملف المريض' : 'Save to Patient Record'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Facility Specialty Strip */}
      {availableSpecialties.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          {availableSpecialties.map(s => {
            const active = selectedSpecialtyCode === s.code;
            return (
              <button
                key={s.code}
                type="button"
                onClick={() => setSelectedSpecialtyCode(s.code)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {ar ? s.name_ar : s.name_en}
              </button>
            );
          })}
        </div>
      )}

      {/* Patient, Consultation & Specialty Context Bar */}
      <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <div>
          <label className="flex items-center gap-1 text-xs font-bold text-slate-700">
            <UserCheck className="h-3.5 w-3.5 text-teal-600" />
            {ar ? 'المريض (إلزامي للحفظ)' : 'Patient (Required)'}
          </label>
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
          >
            <option value="">{ar ? 'اختر مريضاً...' : 'Select patient...'}</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.first_name_ar} {p.last_name_ar} ({p.mrn})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700">
            {ar ? 'التخصص الطبي واللوحة التفاعلية' : 'Medical Specialty & Clinical Canvas'}
          </label>
          <select
            value={selectedSpecialtyCode}
            onChange={(e) => setSelectedSpecialtyCode(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
          >
            {availableSpecialties.map((s) => (
              <option key={s.code} value={s.code}>
                {ar ? s.name_ar : s.name_en}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700">
            {ar ? 'ربط بزيارة / كشف (اختياري)' : 'Link to Consultation (Optional)'}
          </label>
          <select
            value={selectedConsultationId}
            onChange={(e) => setSelectedConsultationId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">{ar ? 'تقييم تخصصي مستقل' : 'Standalone specialty evaluation'}</option>
            {consultations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.consultation_date.slice(0, 10)} — {c.chief_complaint}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!selectedPatientId ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center text-sm text-amber-900">
          {ar
            ? 'اختر ملف مريض أولاً لفتح اللوحة التفاعلية التخصصية وعرض أو تسجيل الفحوصات.'
            : 'Select a patient above to open the clinical specialty canvas and load or record findings.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Main Interactive Viewer */}
          <div className="space-y-4 lg:col-span-9">
            {renderSpecialtyCanvas()}

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <label className="block text-xs font-bold text-slate-700">
                {ar ? 'ملخص وملاحظات الطبيب الموثقة على هذه الجلسة' : 'Session Clinical Summary & Physician Notes'}
              </label>
              <textarea
                rows={2}
                disabled={!canWrite}
                value={examNotes}
                onChange={(e) => setExamNotes(e.target.value)}
                placeholder={ar ? 'اكتب ملخص التقييم أو التوصية لهذا الفحص...' : 'Summary notes or clinical impression for this snapshot...'}
                className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-sm disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* Saved Versioned History Sidebar */}
          <div className="space-y-3 lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                <History className="h-4 w-4 text-teal-600" />
                {ar ? `السجل المحفوظ (${history.length})` : `Saved History (${history.length})`}
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">
                {ar
                  ? 'كل عملية حفظ تُنشئ نسخة موثقة غير قابلة للحذف في سجل المريض.'
                  : 'Every save records an immutable audited snapshot.'}
              </p>

              <div className="mt-3 space-y-2">
                {history.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-400">
                    {ar
                      ? 'لا توجد فحوصات مسجلة لهذا التخصص عند هذا المريض بعد.'
                      : 'No saved exams in this specialty for this patient yet.'}
                  </p>
                ) : (
                  history.map((row) => {
                    const active = row.id === selectedSnapshotId;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => applySnapshotPayload(row)}
                        className={`w-full rounded-xl border p-3 text-start text-xs transition ${
                          active
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-slate-800">{formatSpecialtyFindingTypeLabel(row.finding_type, ar)}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(row.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                          </span>
                        </div>
                        {row.annotation_text && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{row.annotation_text}</p>
                        )}
                        <p className="mt-1 text-[10px] text-slate-400">
                          {row.recorder?.name_ar || row.recorder?.name_en || '-'}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
