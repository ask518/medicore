// ============================================================================
// MEDICORE – Neurology Clinical Examination Suite
// Section 11 Implementation: GCS, Cranial Nerves, Motor (MRC), Sensory, Reflexes & Gait
// ============================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Brain, Activity, Zap, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

export interface NeurologyData {
  gcsEye: number; // 1-4
  gcsVerbal: number; // 1-5
  gcsMotor: number; // 1-6
  cranialNervesStatus: 'intact' | 'abnormal';
  cranialNervesNotes: string;
  motorPowerUpperRight: number; // 0-5
  motorPowerUpperLeft: number; // 0-5
  motorPowerLowerRight: number; // 0-5
  motorPowerLowerLeft: number; // 0-5
  muscleTone: 'normal' | 'hypotonia' | 'spasticity' | 'rigidity';
  sensoryExam: 'intact' | 'paresthesia' | 'hypoesthesia' | 'level_deficit';
  sensoryNotes: string;
  reflexBiceps: string; // 0, 1+, 2+, 3+, 4+
  reflexPatellar: string; // 0, 1+, 2+, 3+, 4+
  babinskiSign: 'negative' | 'positive_right' | 'positive_left' | 'bilateral';
  cerebellarCoordination: 'intact' | 'dysmetria' | 'ataxic' | 'tremor';
  gaitType: 'normal' | 'antalgic' | 'ataxic' | 'hemiplegic' | 'parkinsonian' | 'neuropathic';
  neuroNotes: string;
}

interface NeurologyModuleProps {
  data: NeurologyData;
  onChange: (data: NeurologyData) => void;
  readOnly?: boolean;
}

export const NeurologyModule: React.FC<NeurologyModuleProps> = ({
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const update = (field: keyof NeurologyData, val: any) => {
    if (readOnly) return;
    onChange({ ...data, [field]: val });
  };

  const totalGcs = (data.gcsEye || 4) + (data.gcsVerbal || 5) + (data.gcsMotor || 6);

  const getGcsSeverity = (score: number) => {
    if (score <= 8) return { label: locale === 'ar' ? 'إصابة عصبية حادة / غيبوبة (Severe <= 8)' : 'Severe (<= 8)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    if (score <= 12) return { label: locale === 'ar' ? 'إصابة متوسطة (Moderate 9-12)' : 'Moderate (9-12)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    return { label: locale === 'ar' ? 'وعي كامل ويقظ (Mild / Normal 13-15)' : 'Mild / Normal (13-15)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  };

  const gcsSev = getGcsSeverity(totalGcs);

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-indigo-50/40 via-white to-slate-50 border border-indigo-100">
      <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
              {locale === 'ar' ? 'الفحص العصبي السريري الشامل (Neurology Suite)' : 'Neurology Clinical Examination Suite'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {locale === 'ar' ? 'مقياس غلاسكو (GCS)، الأعصاب القحفية، القوة العضلية (MRC)، المنعكسات والتوازن' : 'GCS, Cranial Nerves, Motor Power (MRC 0-5), Reflexes & Gait'}
            </p>
          </div>
        </div>

        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${gcsSev.color}`}>
          GCS: {totalGcs}/15 – {gcsSev.label}
        </span>
      </div>

      {/* GCS Calculator */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
          <Activity className="w-3.5 h-3.5 text-indigo-600" />
          <span>{locale === 'ar' ? 'مقياس غلاسكو للوعي (Glasgow Coma Scale - GCS)' : 'Glasgow Coma Scale'}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              {locale === 'ar' ? 'استجابة العين (Eye - max 4)' : 'Eye Opening (1-4)'}
            </label>
            <select
              disabled={readOnly}
              value={data.gcsEye || 4}
              onChange={e => update('gcsEye', Number(e.target.value))}
              className="w-full text-xs p-2 border rounded-lg bg-slate-50 font-medium"
            >
              <option value={4}>4 - {locale === 'ar' ? 'تلقائي (Spontaneous)' : 'Spontaneous'}</option>
              <option value={3}>3 - {locale === 'ar' ? 'للصوت أو الأوامر (To speech)' : 'To speech'}</option>
              <option value={2}>2 - {locale === 'ar' ? 'للألم (To pain)' : 'To pain'}</option>
              <option value={1}>1 - {locale === 'ar' ? 'لا استجابة (None)' : 'None'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              {locale === 'ar' ? 'الاستجابة اللفظية (Verbal - max 5)' : 'Verbal Response (1-5)'}
            </label>
            <select
              disabled={readOnly}
              value={data.gcsVerbal || 5}
              onChange={e => update('gcsVerbal', Number(e.target.value))}
              className="w-full text-xs p-2 border rounded-lg bg-slate-50 font-medium"
            >
              <option value={5}>5 - {locale === 'ar' ? 'موجه ومترابط (Oriented)' : 'Oriented'}</option>
              <option value={4}>4 - {locale === 'ar' ? 'مرتبك ومشوش (Confused)' : 'Confused'}</option>
              <option value={3}>3 - {locale === 'ar' ? 'كلمات غير ملائمة (Inappropriate)' : 'Inappropriate'}</option>
              <option value={2}>2 - {locale === 'ar' ? 'أصوات غير مفهومة (Incomprehensible)' : 'Incomprehensible'}</option>
              <option value={1}>1 - {locale === 'ar' ? 'لا استجابة (None)' : 'None'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-600 mb-1">
              {locale === 'ar' ? 'الاستجابة الحركية (Motor - max 6)' : 'Motor Response (1-6)'}
            </label>
            <select
              disabled={readOnly}
              value={data.gcsMotor || 6}
              onChange={e => update('gcsMotor', Number(e.target.value))}
              className="w-full text-xs p-2 border rounded-lg bg-slate-50 font-medium"
            >
              <option value={6}>6 - {locale === 'ar' ? 'ينفذ الأوامر (Obeys commands)' : 'Obeys commands'}</option>
              <option value={5}>5 - {locale === 'ar' ? 'يحدد موضع الألم (Localizes pain)' : 'Localizes pain'}</option>
              <option value={4}>4 - {locale === 'ar' ? 'انسحاب بالانثناء (Withdrawal)' : 'Withdrawal'}</option>
              <option value={3}>3 - {locale === 'ar' ? 'انثناء شاذ (Decorticate)' : 'Decorticate'}</option>
              <option value={2}>2 - {locale === 'ar' ? 'انبساط شاذ (Decerebrate)' : 'Decerebrate'}</option>
              <option value={1}>1 - {locale === 'ar' ? 'لا استجابة (None)' : 'None'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Motor Power MRC Scale (0-5) */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>{locale === 'ar' ? 'فحص القوة العضلية الحركية (MRC Power Scale 0-5)' : 'Motor Power Scale (MRC 0-5)'}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <span className="block text-[10px] font-bold text-slate-600 mb-1">{locale === 'ar' ? 'الطرف العلوي الأيمن (RUE)' : 'Right Upper'}</span>
            <select
              disabled={readOnly}
              value={data.motorPowerUpperRight ?? 5}
              onChange={e => update('motorPowerUpperRight', Number(e.target.value))}
              className="w-full text-xs font-bold p-1.5 border rounded bg-white text-indigo-700"
            >
              {[5, 4, 3, 2, 1, 0].map(n => (
                <option key={n} value={n}>{n}/5 {n === 5 ? '(Normal)' : n === 0 ? '(Paralysis)' : ''}</option>
              ))}
            </select>
          </div>

          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <span className="block text-[10px] font-bold text-slate-600 mb-1">{locale === 'ar' ? 'الطرف العلوي الأيسر (LUE)' : 'Left Upper'}</span>
            <select
              disabled={readOnly}
              value={data.motorPowerUpperLeft ?? 5}
              onChange={e => update('motorPowerUpperLeft', Number(e.target.value))}
              className="w-full text-xs font-bold p-1.5 border rounded bg-white text-indigo-700"
            >
              {[5, 4, 3, 2, 1, 0].map(n => (
                <option key={n} value={n}>{n}/5 {n === 5 ? '(Normal)' : n === 0 ? '(Paralysis)' : ''}</option>
              ))}
            </select>
          </div>

          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <span className="block text-[10px] font-bold text-slate-600 mb-1">{locale === 'ar' ? 'الطرف السفلي الأيمن (RLE)' : 'Right Lower'}</span>
            <select
              disabled={readOnly}
              value={data.motorPowerLowerRight ?? 5}
              onChange={e => update('motorPowerLowerRight', Number(e.target.value))}
              className="w-full text-xs font-bold p-1.5 border rounded bg-white text-indigo-700"
            >
              {[5, 4, 3, 2, 1, 0].map(n => (
                <option key={n} value={n}>{n}/5 {n === 5 ? '(Normal)' : n === 0 ? '(Paralysis)' : ''}</option>
              ))}
            </select>
          </div>

          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
            <span className="block text-[10px] font-bold text-slate-600 mb-1">{locale === 'ar' ? 'الطرف السفلي الأيسر (LLE)' : 'Left Lower'}</span>
            <select
              disabled={readOnly}
              value={data.motorPowerLowerLeft ?? 5}
              onChange={e => update('motorPowerLowerLeft', Number(e.target.value))}
              className="w-full text-xs font-bold p-1.5 border rounded bg-white text-indigo-700"
            >
              {[5, 4, 3, 2, 1, 0].map(n => (
                <option key={n} value={n}>{n}/5 {n === 5 ? '(Normal)' : n === 0 ? '(Paralysis)' : ''}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reflexes, Babinski & Gait */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'علامة بابينسكي (Babinski)' : 'Plantar (Babinski)'}
          </label>
          <select
            disabled={readOnly}
            value={data.babinskiSign || 'negative'}
            onChange={e => update('babinskiSign', e.target.value)}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          >
            <option value="negative">{locale === 'ar' ? 'سلبية طبيعية (Flexor / Negative)' : 'Flexor / Negative'}</option>
            <option value="positive_right">{locale === 'ar' ? 'إيجابية باليمين (Extensor Right)' : 'Extensor Right'}</option>
            <option value="positive_left">{locale === 'ar' ? 'إيجابية باليسار (Extensor Left)' : 'Extensor Left'}</option>
            <option value="bilateral">{locale === 'ar' ? 'إيجابية ثنائية (Bilateral Extensor)' : 'Bilateral Extensor'}</option>
          </select>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'التوافق الحركي والمخيخ' : 'Cerebellar / Coordination'}
          </label>
          <select
            disabled={readOnly}
            value={data.cerebellarCoordination || 'intact'}
            onChange={e => update('cerebellarCoordination', e.target.value)}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          >
            <option value="intact">{locale === 'ar' ? 'سليم تماماً (Intact)' : 'Intact'}</option>
            <option value="dysmetria">{locale === 'ar' ? 'خلل قياس الحركة (Dysmetria)' : 'Dysmetria'}</option>
            <option value="ataxic">{locale === 'ar' ? 'ترنح (Ataxia / Romberg +)' : 'Ataxia / Romberg +'}</option>
            <option value="tremor">{locale === 'ar' ? 'رعاش حركي قصدي (Intention tremor)' : 'Intention tremor'}</option>
          </select>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'نمط المشي (Gait)' : 'Gait'}
          </label>
          <select
            disabled={readOnly}
            value={data.gaitType || 'normal'}
            onChange={e => update('gaitType', e.target.value)}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          >
            <option value="normal">{locale === 'ar' ? 'طبيعي ومستقر (Normal)' : 'Normal'}</option>
            <option value="antalgic">{locale === 'ar' ? 'مشي مسكن للألم (Antalgic)' : 'Antalgic'}</option>
            <option value="hemiplegic">{locale === 'ar' ? 'فالجي شللي (Hemiplegic)' : 'Hemiplegic'}</option>
            <option value="parkinsonian">{locale === 'ar' ? 'باركنسوني خطوي (Parkinsonian)' : 'Parkinsonian'}</option>
            <option value="ataxic">{locale === 'ar' ? 'مترنح عريض القاعدة (Ataxic)' : 'Ataxic'}</option>
          </select>
        </div>
      </div>

      {/* Cranial Nerves & Detailed Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'فحص الأعصاب القحفية (Cranial Nerves I-XII)' : 'Cranial Nerves (I-XII)'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.cranialNervesNotes || ''}
            onChange={e => update('cranialNervesNotes', e.target.value)}
            placeholder={locale === 'ar' ? 'ملاحظات فحص العصب الوجهي، البصري، وحركات العين...' : 'Pupils, ocular motility, facial symmetry notes...'}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'الخلاصة والتشخيص العصبي' : 'Neurological Summary'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.neuroNotes || ''}
            onChange={e => update('neuroNotes', e.target.value)}
            placeholder={locale === 'ar' ? 'تحديد موضع الإصابة والتقييم النهائي...' : 'Lesion localization & clinical assessment...'}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          />
        </div>
      </div>
    </div>
  );
};
