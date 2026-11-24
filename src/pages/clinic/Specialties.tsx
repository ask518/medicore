// ============================================================================
// MEDICORE – Interactive Diagnostic Visualization Center
// Dynamic Specialty Engines: Strictly Filtered by Facility's Licensed Activities
// ============================================================================

import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { MASTER_MEDICAL_SPECIALTIES, ClinicalModuleType } from '../../config/medicalSpecialties';

// Anatomy & Specialty Visualizer Components
import { SkeletonViewer } from '../../components/anatomy/SkeletonViewer';
import { SkeletonViewer3D } from '../../components/anatomy/SkeletonViewer3D';
import { OdontogramViewer } from '../../components/anatomy/OdontogramViewer';
import { OdontogramViewer3D } from '../../components/anatomy/OdontogramViewer3D';
import { DermatomeMap } from '../../components/anatomy/DermatomeMap';
import { DermatomeMap3D } from '../../components/anatomy/DermatomeMap3D';
import { OphthalmologyViewer } from '../../components/anatomy/OphthalmologyViewer';
import { CardiologyModule } from '../../components/anatomy/CardiologyModule';
import { GastroenterologyModule } from '../../components/anatomy/GastroenterologyModule';
import { PediatricsModule } from '../../components/anatomy/PediatricsModule';
import { GynecologyModule } from '../../components/anatomy/GynecologyModule';
import { NeurologyModule } from '../../components/anatomy/NeurologyModule';
import { PulmonologyModule } from '../../components/anatomy/PulmonologyModule';
import { EntModule } from '../../components/anatomy/EntModule';
import { UrologyModule } from '../../components/anatomy/UrologyModule';
import { PsychiatryModule } from '../../components/anatomy/PsychiatryModule';
import { GeneralClinicalTemplate } from '../../components/anatomy/GeneralClinicalTemplate';

// Types
import { 
  OrthopedicFinding, ToothRecord, DermaFinding, EyeExaminationData,
  CardiologyData, GastroenterologyData, PediatricsData, GynecologyData,
  NeurologyData, PulmonologyData, EntData, UrologyData, PsychiatryData, GeneralClinicalData
} from '../../types/specialty';

import { 
  Activity, Smile, Sparkles, Eye, Box, Sliders, Heart, 
  Baby, Brain, Wind, Stethoscope, ShieldCheck, CheckCircle2
} from 'lucide-react';

interface EngineConfig {
  key: ClinicalModuleType;
  titleAr: string;
  titleEn: string;
  badgeAr: string;
  badgeEn: string;
  icon: React.ComponentType<{ className?: string }>;
  supports3d: boolean;
}

const ALL_ENGINES: EngineConfig[] = [
  {
    key: 'dentistry',
    titleAr: 'طب وجراحة الفم والأسنان (FDI)',
    titleEn: 'Dentistry & Oral Surgery (FDI)',
    badgeAr: 'أقواس الفكين والأسنان 3D/2D',
    badgeEn: '3D/2D Dental Arches',
    icon: Smile,
    supports3d: true,
  },
  {
    key: 'orthopedics',
    titleAr: 'جراحة العظام والمفاصل',
    titleEn: 'Orthopedics & Skeleton',
    badgeAr: 'الهيكل العظمي 3D مع الأشعة والحرارة',
    badgeEn: '3D Skeleton & X-Ray',
    icon: Activity,
    supports3d: true,
  },
  {
    key: 'cardiology',
    titleAr: 'أمراض القلب والقسطرة',
    titleEn: 'Cardiology & Vascular',
    badgeAr: 'تشريح القلب والشرايين التاجية 3D',
    badgeEn: '3D Coronary & Cardiac',
    icon: Heart,
    supports3d: false,
  },
  {
    key: 'dermatology',
    titleAr: 'الجلدية والليزر والتناسلية',
    titleEn: 'Dermatology & Skin',
    badgeAr: 'مجسم الجسم البشري والقطاعات الجلدية 360°',
    badgeEn: '360° Body & Dermatome',
    icon: Sparkles,
    supports3d: true,
  },
  {
    key: 'ophthalmology',
    titleAr: 'طب وجراحة العيون والليزك',
    titleEn: 'Ophthalmology & Optics',
    badgeAr: 'فحص العينين OD/OS وقاع العين والضغط',
    badgeEn: 'Visual Acuity & Fundus',
    icon: Eye,
    supports3d: false,
  },
  {
    key: 'pediatrics',
    titleAr: 'طب الأطفال والنمو والتطعيمات',
    titleEn: 'Pediatrics & Child Health',
    badgeAr: 'منحنيات النمو WHO والتطور الحركي',
    badgeEn: 'WHO Growth Charts',
    icon: Baby,
    supports3d: false,
  },
  {
    key: 'neurology',
    titleAr: 'المخ والأعصاب والعمود الفقري',
    titleEn: 'Neurology & Spine',
    badgeAr: 'فصوص الدماغ، الأعصاب القحفية و GCS',
    badgeEn: 'Brain & Cranial Nerves',
    icon: Brain,
    supports3d: false,
  },
  {
    key: 'pulmonology',
    titleAr: 'الصدرية والرئة والحساسية',
    titleEn: 'Pulmonology & Respiratory',
    badgeAr: 'الشجرة التنفسية ووظائف الرئة PFT',
    badgeEn: 'Lungs & Spirometry',
    icon: Wind,
    supports3d: false,
  },
  {
    key: 'gastroenterology',
    titleAr: 'الجهاز الهضمي والكبد والمناظير',
    titleEn: 'Gastroenterology & Endoscopy',
    badgeAr: 'القناة الهضمية والمناظير الباطنية',
    badgeEn: 'GI Tract & Endoscopy',
    icon: Activity,
    supports3d: false,
  },
  {
    key: 'gynecology_obstetrics',
    titleAr: 'النساء والتوليد وجراحة الحوض',
    titleEn: 'Gynecology & Obstetrics',
    badgeAr: 'تشريح الحوض، الحمل والسونار',
    badgeEn: 'Pelvis & Obstetric US',
    icon: Baby,
    supports3d: false,
  },
  {
    key: 'ent',
    titleAr: 'الأنف والأذن والحنجرة والرأس',
    titleEn: 'ENT & Otolaryngology',
    badgeAr: 'تنظير الأذن، الجيوب والحنجرة',
    badgeEn: 'Otoscopy & Sinuses',
    icon: Activity,
    supports3d: false,
  },
  {
    key: 'urology',
    titleAr: 'المسالك البولية والتناسلية',
    titleEn: 'Urology & Kidneys',
    badgeAr: 'الكلى، الحالب، والمثانة IPSS',
    badgeEn: 'Kidneys & Bladder',
    icon: Activity,
    supports3d: false,
  },
  {
    key: 'psychiatry',
    titleAr: 'الطب النفسي والصحة السلوكية',
    titleEn: 'Psychiatry & Behavioral',
    badgeAr: 'الفحص العقلي MSE ومقاييس المزاج',
    badgeEn: 'Mental State Exam',
    icon: Brain,
    supports3d: false,
  },
  {
    key: 'general_template',
    titleAr: 'الباطنة العامة والفحص السريري',
    titleEn: 'General Internal Medicine',
    badgeAr: 'مراجعة الأجهزة الحيوية والتشخيص الشامل',
    badgeEn: 'Systemic Review',
    icon: Stethoscope,
    supports3d: false,
  },
];

export const Specialties: React.FC = () => {
  const { organization } = useAuth();
  const { locale } = useLanguage();

  const [engineMode, setEngineMode] = useState<'3d' | '2d'>('3d');

  // Extract facility's licensed clinical modules
  const availableEngines = useMemo(() => {
    const orgSpecs = organization?.specialties;
    
    // If organization has registered specialties, filter strictly
    if (orgSpecs && orgSpecs.length > 0) {
      // Find all clinical modules associated with these specialties
      const matchedModuleKeys = new Set<ClinicalModuleType>();
      
      for (const specCode of orgSpecs) {
        // Direct matching
        if (specCode === 'dentistry' || specCode.includes('dental') || specCode === 'general_dentistry') {
          matchedModuleKeys.add('dentistry');
        } else if (specCode === 'orthopedics' || specCode.includes('orthopedic')) {
          matchedModuleKeys.add('orthopedics');
        } else if (specCode === 'cardiology' || specCode.includes('cardio')) {
          matchedModuleKeys.add('cardiology');
        } else if (specCode === 'dermatology' || specCode.includes('derma')) {
          matchedModuleKeys.add('dermatology');
        } else if (specCode === 'ophthalmology' || specCode.includes('eye') || specCode === 'optometry' || specCode === 'lasik_surgery') {
          matchedModuleKeys.add('ophthalmology');
        } else if (specCode === 'pediatrics' || specCode.includes('pediatric')) {
          matchedModuleKeys.add('pediatrics');
        } else if (specCode === 'internal_medicine') {
          matchedModuleKeys.add('general_template');
          matchedModuleKeys.add('cardiology');
        } else if (specCode === 'neurology' || specCode.includes('neuro')) {
          matchedModuleKeys.add('neurology');
        } else if (specCode === 'pulmonology' || specCode.includes('pulmo') || specCode.includes('respiratory')) {
          matchedModuleKeys.add('pulmonology');
        } else if (specCode === 'gastroenterology' || specCode.includes('gastro') || specCode.includes('hepatology')) {
          matchedModuleKeys.add('gastroenterology');
        } else if (specCode === 'gynecology' || specCode.includes('gyn') || specCode.includes('obstetric')) {
          matchedModuleKeys.add('gynecology_obstetrics');
        } else if (specCode === 'ent') {
          matchedModuleKeys.add('ent');
        } else if (specCode === 'urology') {
          matchedModuleKeys.add('urology');
        } else if (specCode === 'psychiatry') {
          matchedModuleKeys.add('psychiatry');
        } else {
          // Look up in MASTER_MEDICAL_SPECIALTIES
          const item = MASTER_MEDICAL_SPECIALTIES.find(s => s.code === specCode);
          if (item?.clinical_module) {
            matchedModuleKeys.add(item.clinical_module);
          }
        }
      }

      const filtered = ALL_ENGINES.filter(e => matchedModuleKeys.has(e.key));
      return filtered.length > 0 ? filtered : ALL_ENGINES.slice(0, 3);
    }

    // Default fallback if no specialties configured yet
    return ALL_ENGINES;
  }, [organization?.specialties]);

  // Active tab state defaulted to the first available engine for this clinic
  const [activeTab, setActiveTab] = useState<ClinicalModuleType>(() => {
    return availableEngines[0]?.key || 'orthopedics';
  });

  // Ensure active tab stays synchronized with available engines when organization changes
  useEffect(() => {
    if (availableEngines.length > 0 && !availableEngines.some(e => e.key === activeTab)) {
      setActiveTab(availableEngines[0].key);
    }
  }, [availableEngines, activeTab]);

  // Interactive finding stores
  const [orthoFindings, setOrthoFindings] = useState<OrthopedicFinding[]>([
    {
      id: 'ortho-demo-1',
      regionId: 'knee_r',
      view: 'anterior',
      x: 41,
      y: 69,
      findingType: 'sprain_strain',
      severity: 'moderate',
      painScale: 6,
      description: 'التواء مفصل الركبة اليمنى وتمزق جزئي بالغضروف الهلالي الإنسي',
      treatmentRecommended: 'راحة، كمادات ثلج، رباط ضاغط، رنين مغناطيسي',
    }
  ]);

  const [dentalRecords, setDentalRecords] = useState<Record<number, ToothRecord>>({
    16: { toothNumber: 16, condition: 'caries', surfaces: ['O', 'M'], notes: 'تسوس عميق بالعاج', cost: 450, completed: false },
    21: { toothNumber: 21, condition: 'composite_filling', surfaces: ['B'], notes: 'حشو تجميلي ليزر', cost: 600, completed: true },
    46: { toothNumber: 46, condition: 'crown', surfaces: ['O', 'M', 'D', 'B', 'L'], notes: 'طربوش زيركون', cost: 2200, completed: true },
    36: { toothNumber: 36, condition: 'root_canal', surfaces: ['O'], notes: 'علاج جذور وسحب عصب مكتمل', cost: 1200, completed: true },
  });

  const [dermaFindings, setDermaFindings] = useState<DermaFinding[]>([
    {
      id: 'derma-demo-1',
      view: 'anterior',
      x: 35,
      y: 25,
      lesionType: 'plaque',
      sizeMm: 15,
      colorHex: '#E11D48',
      symmetry: 'symmetric',
      border: 'regular',
      symptoms: ['itching'],
      clinicalNotes: 'لويحة صدفية واضحة الحواف مع قشور فضية على الساعد الأيمن',
    }
  ]);

  const [eyeData, setEyeData] = useState<EyeExaminationData>({
    rightEye: { visualAcuityUncorrected: '6/12', visualAcuityCorrected: '6/6', intraocularPressureMmHg: 16, anteriorSegmentNotes: 'قرنية شفافة، الغرفة الأمامية عميقة وهادئة', corneaStatus: 'سليمة', lensStatus: 'شفافة', fundusRetinaNotes: 'الشبكية سليمة، العصب البصري طبيعي C/D 0.3', cupToDiscRatio: 0.3 },
    leftEye: { visualAcuityUncorrected: '6/9', visualAcuityCorrected: '6/6', intraocularPressureMmHg: 15, anteriorSegmentNotes: 'قرنية شفافة، عدسة طبيعية', corneaStatus: 'سليمة', lensStatus: 'شفافة', fundusRetinaNotes: 'قاع العين طبيعي', cupToDiscRatio: 0.3 }
  });

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

  const currentEngineConfig = availableEngines.find(e => e.key === activeTab) || availableEngines[0];

  return (
    <div className="space-y-6">
      {/* Header with Organization Context & 3D/2D Mode Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-medicore-50 text-medicore-700 border border-medicore-200 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{locale === 'ar' ? 'تخصيص سريري وفق ترخيص المنشأة' : 'Filtered to Facility License'}</span>
            </span>
            <span className="text-xs text-slate-500 font-bold">
              {organization ? (locale === 'ar' ? organization.name_ar : organization.name_en) : ''}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-medicore-600" />
            {locale === 'ar' ? 'المحركات التشخيصية التفاعلية للتخصصات الطبية' : 'Interactive Specialty Diagnostic Engines'}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' 
              ? `يتم عرض المحركات التخصصية المصرح بها لمنشأتك (${availableEngines.length} تخصص متاح) مع محاكاة 3D WebGL ونماذج الفحص الإكلينيكي الدقيق` 
              : `Displaying licensed diagnostic suites for this facility (${availableEngines.length} suites) with 3D WebGL and clinical charts`}
          </p>
        </div>

        {/* Engine Switcher (3D WebGL vs 2D Precision Chart) if active engine supports 3D */}
        {currentEngineConfig?.supports3d && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-2xl self-start md:self-auto">
            <button
              type="button"
              onClick={() => setEngineMode('3d')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                engineMode === '3d'
                  ? 'bg-medicore-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>{locale === 'ar' ? 'محرك ثلاثي الأبعاد 3D WebGL' : '3D WebGL Engine'}</span>
            </button>

            <button
              type="button"
              onClick={() => setEngineMode('2d')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                engineMode === '2d'
                  ? 'bg-medicore-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>{locale === 'ar' ? 'مخطط سريري ثنائي الأبعاد 2D' : '2D Clinical Chart'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Specialty Tabs: STRICTLY FILTERED by Facility's Licensed Activities */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {availableEngines.map(engine => {
          const Icon = engine.icon;
          const isActive = activeTab === engine.key;
          return (
            <button
              key={engine.key}
              type="button"
              onClick={() => setActiveTab(engine.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                isActive
                  ? 'bg-medicore-600 text-white shadow-md'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{locale === 'ar' ? engine.titleAr : engine.titleEn}</span>
              {engine.supports3d && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  3D
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Engine Description Banner */}
      {currentEngineConfig && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>{locale === 'ar' ? currentEngineConfig.titleAr : currentEngineConfig.titleEn}</strong>: {locale === 'ar' ? currentEngineConfig.badgeAr : currentEngineConfig.badgeEn}
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {locale === 'ar' ? 'نشط ومعتمد للمنشأة' : 'Licensed & Active'}
          </span>
        </div>
      )}

      {/* Main Interactive Canvas Active Tab */}
      <div className="animate-fade-in">
        {/* 1. Dentistry */}
        {activeTab === 'dentistry' && (
          engineMode === '3d' ? (
            <OdontogramViewer3D records={dentalRecords} onChange={setDentalRecords} />
          ) : (
            <OdontogramViewer records={dentalRecords} onChange={setDentalRecords} />
          )
        )}

        {/* 2. Orthopedics */}
        {activeTab === 'orthopedics' && (
          engineMode === '3d' ? (
            <SkeletonViewer3D findings={orthoFindings} onChange={setOrthoFindings} />
          ) : (
            <SkeletonViewer findings={orthoFindings} onChange={setOrthoFindings} />
          )
        )}

        {/* 3. Dermatology */}
        {activeTab === 'dermatology' && (
          engineMode === '3d' ? (
            <DermatomeMap3D findings={dermaFindings} onChange={setDermaFindings} />
          ) : (
            <DermatomeMap findings={dermaFindings} onChange={setDermaFindings} />
          )
        )}

        {/* 4. Ophthalmology */}
        {activeTab === 'ophthalmology' && (
          <OphthalmologyViewer data={eyeData} onChange={setEyeData} />
        )}

        {/* 5. Cardiology */}
        {activeTab === 'cardiology' && (
          <CardiologyModule data={cardioData} onChange={setCardioData} />
        )}

        {/* 6. Gastroenterology */}
        {activeTab === 'gastroenterology' && (
          <GastroenterologyModule data={gastroData} onChange={setGastroData} />
        )}

        {/* 7. Pediatrics */}
        {activeTab === 'pediatrics' && (
          <PediatricsModule data={pediaData} onChange={setPediaData} />
        )}

        {/* 8. Gynecology & Obstetrics */}
        {activeTab === 'gynecology_obstetrics' && (
          <GynecologyModule data={gynData} onChange={setGynData} />
        )}

        {/* 9. Neurology */}
        {activeTab === 'neurology' && (
          <NeurologyModule data={neuroData} onChange={setNeuroData} />
        )}

        {/* 10. Pulmonology */}
        {activeTab === 'pulmonology' && (
          <PulmonologyModule data={pulmoData} onChange={setPulmoData} />
        )}

        {/* 11. ENT */}
        {activeTab === 'ent' && (
          <EntModule data={entData} onChange={setEntData} />
        )}

        {/* 12. Urology */}
        {activeTab === 'urology' && (
          <UrologyModule data={uroData} onChange={setUroData} />
        )}

        {/* 13. Psychiatry */}
        {activeTab === 'psychiatry' && (
          <PsychiatryModule data={psychData} onChange={setPsychData} />
        )}

        {/* 14. General Clinical */}
        {activeTab === 'general_template' && (
          <GeneralClinicalTemplate data={generalData} onChange={setGeneralData} />
        )}
      </div>
    </div>
  );
};
