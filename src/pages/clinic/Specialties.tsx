// ============================================================================
// MEDICORE – Interactive Diagnostic Visualization Center
// Specialty Playground: Orthopedics, Dentistry, Dermatology & Ophthalmology
// ============================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { SkeletonViewer } from '../../components/anatomy/SkeletonViewer';
import { OdontogramViewer } from '../../components/anatomy/OdontogramViewer';
import { DermatomeMap } from '../../components/anatomy/DermatomeMap';
import { OphthalmologyViewer } from '../../components/anatomy/OphthalmologyViewer';
import { OrthopedicFinding, ToothRecord, DermaFinding, EyeExaminationData } from '../../types/specialty';
import { Activity, Smile, Sparkles, Eye, Info } from 'lucide-react';

export const Specialties: React.FC = () => {
  const { locale, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'orthopedics' | 'dentistry' | 'dermatology' | 'ophthalmology'>('orthopedics');

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
          <Activity className="w-6 h-6 text-medicore-600" />
          {locale === 'ar' ? 'المحركات التشخيصية التفاعلية للتخصصات الطبية' : 'Interactive Specialty Diagnostic Engines'}
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
          {locale === 'ar' ? 'أدوات توثيق سريري وتفاعلي متخصصة ومستقلة لكل تخصص طبي مع حفظ ومقارنة التحديدات' : 'Dedicated interactive diagnostic maps for orthopedics, dentistry, dermatology & ophthalmology'}
        </p>
      </div>

      {/* Specialty Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('orthopedics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'orthopedics'
              ? 'bg-medicore-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>{locale === 'ar' ? 'جراحة العظام (الهيكل العظمي)' : 'Orthopedic Skeleton'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dentistry')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'dentistry'
              ? 'bg-medicore-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Smile className="w-4 h-4" />
          <span>{locale === 'ar' ? 'طب الأسنان (FDI Odontogram)' : 'Dental Odontogram'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('dermatology')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'dermatology'
              ? 'bg-medicore-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{locale === 'ar' ? 'الجلدية (خريطة الجسم والآفات)' : 'Dermatology Body Map'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ophthalmology')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'ophthalmology'
              ? 'bg-medicore-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>{locale === 'ar' ? 'العيون وقاع العين (Ophthalmology)' : 'Ophthalmology (OD/OS)'}</span>
        </button>
      </div>

      {/* Main Interactive Canvas Active Tab */}
      <div className="animate-fade-in">
        {activeTab === 'orthopedics' && (
          <SkeletonViewer findings={orthoFindings} onChange={setOrthoFindings} />
        )}

        {activeTab === 'dentistry' && (
          <OdontogramViewer records={dentalRecords} onChange={setDentalRecords} />
        )}

        {activeTab === 'dermatology' && (
          <DermatomeMap findings={dermaFindings} onChange={setDermaFindings} />
        )}

        {activeTab === 'ophthalmology' && (
          <OphthalmologyViewer data={eyeData} onChange={setEyeData} />
        )}
      </div>
    </div>
  );
};
