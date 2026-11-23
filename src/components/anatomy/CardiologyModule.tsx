// ============================================================================
// MEDICORE – Cardiology Clinical Examination & Diagnostic Visualizer
// Section 11 Implementation: Vitals, Hemodynamics, Auscultation, ECG & Echo
// ============================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Heart, Activity, Waves, Gauge, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

export interface CardiologyData {
  systolicBp: number;
  diastolicBp: number;
  heartRate: number;
  rhythm: string;
  heartSounds: string;
  murmurGrade: string;
  murmurTiming: string;
  edemaGrade: string;
  jvpStatus: string;
  nyhaClass: string;
  ejectionFraction: number;
  ecgSummary: string;
  echoFindings: string;
  cardiacNotes: string;
}

interface CardiologyModuleProps {
  data: CardiologyData;
  onChange: (data: CardiologyData) => void;
  readOnly?: boolean;
}

export const CardiologyModule: React.FC<CardiologyModuleProps> = ({
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const update = (field: keyof CardiologyData, val: any) => {
    if (readOnly) return;
    onChange({ ...data, [field]: val });
  };

  // Auto-calculate blood pressure stage
  const getBpStage = (sys: number, dia: number) => {
    if (sys > 180 || dia > 120) return { label: locale === 'ar' ? 'أزمة فرط ضغط الدم (Hypertensive Crisis)' : 'Crisis', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    if (sys >= 140 || dia >= 90) return { label: locale === 'ar' ? 'ضغط دم مرتفع - المرحلة الثانية (Stage 2 HTN)' : 'Stage 2 HTN', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    if (sys >= 130 || dia >= 80) return { label: locale === 'ar' ? 'ضغط دم مرتفع - المرحلة الأولى (Stage 1 HTN)' : 'Stage 1 HTN', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (sys >= 120 && dia < 80) return { label: locale === 'ar' ? 'ضغط دم معتدل مرتفع (Elevated)' : 'Elevated', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    return { label: locale === 'ar' ? 'ضغط دم طبيعي ومثالي (Normal BP)' : 'Normal BP', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  };

  const bpStage = getBpStage(data.systolicBp || 120, data.diastolicBp || 80);

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-rose-50/40 via-white to-slate-50 border border-rose-100">
      <div className="flex items-center justify-between pb-2 border-b border-rose-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
              {locale === 'ar' ? 'الفحص القلبي والوعائي المتقدم (Cardiology Suite)' : 'Cardiovascular Examination Suite'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {locale === 'ar' ? 'تخطيط النبض، أصوات وصمامات القلب، درجات النفخات، والكفاءة الانقباضية (EF%)' : 'Hemodynamics, auscultation, murmurs, NYHA class & Echocardiography'}
            </p>
          </div>
        </div>

        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${bpStage.color}`}>
          {bpStage.label}
        </span>
      </div>

      {/* Hemodynamics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'ضغط الدم الانقباضي (mmHg)' : 'Systolic BP'}
          </label>
          <input
            type="number"
            disabled={readOnly}
            value={data.systolicBp || 120}
            onChange={e => update('systolicBp', Number(e.target.value))}
            className="w-full text-base font-black text-slate-900 p-1 border rounded-lg"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'ضغط الدم الانبساطي (mmHg)' : 'Diastolic BP'}
          </label>
          <input
            type="number"
            disabled={readOnly}
            value={data.diastolicBp || 80}
            onChange={e => update('diastolicBp', Number(e.target.value))}
            className="w-full text-base font-black text-slate-900 p-1 border rounded-lg"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'إيقاع القلب (Cardiac Rhythm)' : 'Cardiac Rhythm'}
          </label>
          <select
            disabled={readOnly}
            value={data.rhythm || 'sinus'}
            onChange={e => update('rhythm', e.target.value)}
            className="w-full text-xs font-bold text-slate-800 p-2 border rounded-lg bg-white"
          >
            <option value="sinus">{locale === 'ar' ? 'إيقاع جيبي طبيعي (Normal Sinus)' : 'Normal Sinus Rhythm'}</option>
            <option value="afib">{locale === 'ar' ? 'رجفان أذيني (Atrial Fibrillation)' : 'Atrial Fibrillation'}</option>
            <option value="bradycardia">{locale === 'ar' ? 'بطء نبض القلب (Sinus Bradycardia)' : 'Bradycardia'}</option>
            <option value="tachycardia">{locale === 'ar' ? 'تسارع نبض القلب (Tachycardia)' : 'Tachycardia'}</option>
            <option value="arrhythmia">{locale === 'ar' ? 'اضطراب نبض غير منتظم (Arrhythmia)' : 'Arrhythmia'}</option>
          </select>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'كفاءة القلب الكسرية (EF %)' : 'Ejection Fraction (EF%)'}
          </label>
          <input
            type="number"
            disabled={readOnly}
            value={data.ejectionFraction || 60}
            onChange={e => update('ejectionFraction', Number(e.target.value))}
            className="w-full text-base font-black text-medicore-700 p-1 border rounded-lg"
          />
        </div>
      </div>

      {/* Auscultation & Clinical Exam Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'أصوات القلب والتسمع (Heart Sounds)' : 'Heart Sounds'}
          </label>
          <select
            disabled={readOnly}
            value={data.heartSounds || 'normal'}
            onChange={e => update('heartSounds', e.target.value)}
            className="w-full text-xs font-medium text-slate-800 p-2 border rounded-lg bg-white"
          >
            <option value="normal">{locale === 'ar' ? 'أصوات طبيعية (S1 + S2 Normal)' : 'S1 + S2 Normal'}</option>
            <option value="s3_gallop">{locale === 'ar' ? 'صوت ثالث مرضي (S3 Gallop)' : 'S3 Gallop'}</option>
            <option value="s4_gallop">{locale === 'ar' ? 'صوت رابع انقباضي (S4 Gallop)' : 'S4 Gallop'}</option>
            <option value="friction_rub">{locale === 'ar' ? 'احتكاك التامور (Pericardial Friction Rub)' : 'Pericardial Friction Rub'}</option>
          </select>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'نفخات القلب واللغط (Murmurs)' : 'Cardiac Murmurs'}
          </label>
          <select
            disabled={readOnly}
            value={data.murmurGrade || 'none'}
            onChange={e => update('murmurGrade', e.target.value)}
            className="w-full text-xs font-medium text-slate-800 p-2 border rounded-lg bg-white"
          >
            <option value="none">{locale === 'ar' ? 'لا توجد نفخات (No Murmurs)' : 'No Murmurs'}</option>
            <option value="grade_1">Grade I/VI (خافتة جداً)</option>
            <option value="grade_2">Grade II/VI (واضحة خفيفة)</option>
            <option value="grade_3">Grade III/VI (متوسطة واضحة)</option>
            <option value="grade_4">Grade IV/VI (شديدة مع اهتزاز Thrill)</option>
            <option value="grade_5">Grade V/VI (شديدة جداً)</option>
            <option value="grade_6">Grade VI/VI (تسمع بدون سماعة ملاصقة)</option>
          </select>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'تصنيف كفاءة القلب الوظيفي (NYHA)' : 'NYHA Functional Class'}
          </label>
          <select
            disabled={readOnly}
            value={data.nyhaClass || 'class_1'}
            onChange={e => update('nyhaClass', e.target.value)}
            className="w-full text-xs font-medium text-slate-800 p-2 border rounded-lg bg-white"
          >
            <option value="class_1">{locale === 'ar' ? 'Class I: لا توجد صعوبة في الأنشطة العادية' : 'Class I: No limitation'}</option>
            <option value="class_2">{locale === 'ar' ? 'Class II: صعوبة خفيفة مع المجهود العادي' : 'Class II: Mild limitation'}</option>
            <option value="class_3">{locale === 'ar' ? 'Class III: صعوبة ملحوظة مع أقل مجهود' : 'Class III: Marked limitation'}</option>
            <option value="class_4">{locale === 'ar' ? 'Class IV: أعراض ضيق حتى في وضع الراحة' : 'Class IV: Severe symptoms at rest'}</option>
          </select>
        </div>
      </div>

      {/* ECG & Echo Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'ملخص فحص رسم القلب الكهربائي (12-Lead ECG Findings)' : '12-Lead ECG Findings'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.ecgSummary || ''}
            onChange={e => update('ecgSummary', e.target.value)}
            placeholder="مثال: Normal Sinus Rhythm, No ST-T changes, PR 160ms"
            className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-rose-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'تقرير الموجات فوق الصوتية على القلب (Echocardiography)' : 'Echocardiography Report'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.echoFindings || ''}
            onChange={e => update('echoFindings', e.target.value)}
            placeholder="مثال: Normal LV dimensions, EF 62%, Mild Mitral Regurgitation"
            className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-rose-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
