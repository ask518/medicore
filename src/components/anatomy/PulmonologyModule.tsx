// ============================================================================
// MEDICORE – Pulmonology & Respiratory Clinical Examination Suite
// Section 11 Implementation: SpO2, Auscultation, Spirometry, mMRC & Adventitious Sounds
// ============================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Wind, Activity, Gauge, Stethoscope, AlertCircle, FileText } from 'lucide-react';

export interface PulmonologyData {
  spO2: number; // %
  o2Therapy: 'room_air' | 'nasal_cannula' | 'venturi_mask' | 'bipap_cpap' | 'mechanical_vent';
  o2FlowRate?: number; // L/min
  respiratoryRate: number; // bpm
  mmrcScore: number; // 0-4
  chestExpansion: 'symmetric' | 'asymmetric_right' | 'asymmetric_left' | 'barrel_chest';
  breathSounds: 'vesicular_normal' | 'bronchial' | 'diminished_right' | 'diminished_left' | 'bilaterally_diminished';
  adventitiousSounds: 'none' | 'polyphonic_wheezes' | 'inspiratory_crackles_fine' | 'coarse_crackles' | 'stridor' | 'pleural_rub';
  percussionNote: 'resonant_normal' | 'dull_right' | 'dull_left' | 'hyperresonant' | 'stony_dull';
  coughType: 'none' | 'dry' | 'productive_clear' | 'productive_purulent' | 'hemoptysis';
  fev1Percent?: number; // % predicted
  fvcPercent?: number; // % predicted
  fev1FvcRatio?: number; // ratio (e.g. 70%)
  peakExpiratoryFlow?: number; // L/min
  imagingFindings: string;
  pulmoNotes: string;
}

interface PulmonologyModuleProps {
  data: PulmonologyData;
  onChange: (data: PulmonologyData) => void;
  readOnly?: boolean;
}

export const PulmonologyModule: React.FC<PulmonologyModuleProps> = ({
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const update = (field: keyof PulmonologyData, val: any) => {
    if (readOnly) return;
    onChange({ ...data, [field]: val });
  };

  const getOxygenSeverity = (spo2: number) => {
    if (spo2 < 88) return { label: locale === 'ar' ? 'نقص أكسجة حاد (Severe Hypoxia)' : 'Severe Hypoxia', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    if (spo2 < 92) return { label: locale === 'ar' ? 'نقص أكسجة معتدل (Moderate Hypoxia)' : 'Moderate Hypoxia', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (spo2 < 95) return { label: locale === 'ar' ? 'أكسجة منخفضة نسبياً (Mild Hypoxia)' : 'Mild Hypoxia', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    return { label: locale === 'ar' ? 'تشبع أكسجين طبيعي ومثالي (Optimal SpO2)' : 'Normal SpO2', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  };

  const oxSev = getOxygenSeverity(data.spO2 || 98);

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-cyan-50/40 via-white to-slate-50 border border-cyan-100">
      <div className="flex items-center justify-between pb-2 border-b border-cyan-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center">
            <Wind className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
              {locale === 'ar' ? 'الفحص التنفسي والرئوي المتكامل (Pulmonology Suite)' : 'Pulmonary & Respiratory Examination Suite'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {locale === 'ar' ? 'تشبع الأكسجين، الإصغاء الرئوي (أزيز، خوارير)، وظائف الرئة (Spirometry)، ومقياس ضيق النفس' : 'SpO2, Auscultation, Wheezes/Crackles, Spirometry (PFT) & mMRC'}
            </p>
          </div>
        </div>

        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${oxSev.color}`}>
          SpO2: {data.spO2 || 98}% – {oxSev.label}
        </span>
      </div>

      {/* Vitals & Oxygenation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'تشبع الأكسجين (SpO2 %)' : 'SpO2 (%)'}
          </label>
          <input
            type="number"
            disabled={readOnly}
            min={50}
            max={100}
            value={data.spO2 || 98}
            onChange={e => update('spO2', Number(e.target.value))}
            className="w-full text-base font-black text-slate-900 p-1 border rounded-lg"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'معدل التنفس (نفس/دقيقة)' : 'Resp Rate (bpm)'}
          </label>
          <input
            type="number"
            disabled={readOnly}
            min={8}
            max={60}
            value={data.respiratoryRate || 16}
            onChange={e => update('respiratoryRate', Number(e.target.value))}
            className="w-full text-base font-black text-slate-900 p-1 border rounded-lg"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'دعم الأكسجين' : 'O2 Therapy'}
          </label>
          <select
            disabled={readOnly}
            value={data.o2Therapy || 'room_air'}
            onChange={e => update('o2Therapy', e.target.value)}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50 font-medium"
          >
            <option value="room_air">{locale === 'ar' ? 'هواء الغرفة (Room Air)' : 'Room Air'}</option>
            <option value="nasal_cannula">{locale === 'ar' ? 'قنية أنفية (Nasal Cannula)' : 'Nasal Cannula'}</option>
            <option value="venturi_mask">{locale === 'ar' ? 'قناع فينتوري (Venturi)' : 'Venturi Mask'}</option>
            <option value="bipap_cpap">{locale === 'ar' ? 'تنفس لا باضع (BiPAP / CPAP)' : 'BiPAP/CPAP'}</option>
            <option value="mechanical_vent">{locale === 'ar' ? 'تنفس صناعي باضع (Invasive)' : 'Mechanical Vent'}</option>
          </select>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'مقياس ضيق التنفس (mMRC 0-4)' : 'mMRC Dyspnea'}
          </label>
          <select
            disabled={readOnly}
            value={data.mmrcScore ?? 0}
            onChange={e => update('mmrcScore', Number(e.target.value))}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50 font-medium"
          >
            <option value={0}>0 - {locale === 'ar' ? 'مع المجهود الشديد فقط' : 'Strenuous exercise only'}</option>
            <option value={1}>1 - {locale === 'ar' ? 'عند المشي السريع أو الصعود' : 'Hurrying / slight hill'}</option>
            <option value={2}>2 - {locale === 'ar' ? 'أبطأ من الأقران على المنبسط' : 'Slower than peers'}</option>
            <option value={3}>3 - {locale === 'ar' ? 'يتوقف بعد 100 متر' : 'Stops after ~100m'}</option>
            <option value={4}>4 - {locale === 'ar' ? 'عند تبديل الملابس أو مغادرة البيت' : 'Too breathless to dress'}</option>
          </select>
        </div>
      </div>

      {/* Auscultation & Sounds */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'الأصوات التنفسية الأساسية' : 'Breath Sounds'}
          </label>
          <select
            disabled={readOnly}
            value={data.breathSounds || 'vesicular_normal'}
            onChange={e => update('breathSounds', e.target.value)}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          >
            <option value="vesicular_normal">{locale === 'ar' ? 'حويصلية طبيعية متناظرة (Normal Vesicular)' : 'Normal Vesicular'}</option>
            <option value="bronchial">{locale === 'ar' ? 'أنبوبية قصبية - تكثف (Bronchial Sounds)' : 'Bronchial (Consolidation)'}</option>
            <option value="diminished_right">{locale === 'ar' ? 'منخفضة بالجانب الأيمن (Diminished Right)' : 'Diminished Right'}</option>
            <option value="diminished_left">{locale === 'ar' ? 'منخفضة بالجانب الأيسر (Diminished Left)' : 'Diminished Left'}</option>
            <option value="bilaterally_diminished">{locale === 'ar' ? 'منخفضة بالطرفين (Bilateral Emphysema)' : 'Bilaterally Diminished'}</option>
          </select>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'أصوات إضافية (أزيز / خوارير)' : 'Adventitious Sounds'}
          </label>
          <select
            disabled={readOnly}
            value={data.adventitiousSounds || 'none'}
            onChange={e => update('adventitiousSounds', e.target.value)}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          >
            <option value="none">{locale === 'ar' ? 'لا توجد أصوات إضافية (Clear)' : 'None (Clear)'}</option>
            <option value="polyphonic_wheezes">{locale === 'ar' ? 'أزيز زفيري نغمي متعدد (Polyphonic Wheeze)' : 'Polyphonic Wheezes'}</option>
            <option value="inspiratory_crackles_fine">{locale === 'ar' ? 'خراخر شهيقية ناعمة (Fine Crackles)' : 'Fine Crackles'}</option>
            <option value="coarse_crackles">{locale === 'ar' ? 'خراخر خشنة فقاعية (Coarse Crackles)' : 'Coarse Crackles'}</option>
            <option value="stridor">{locale === 'ar' ? 'صرير حنجري انسدادي (Stridor)' : 'Stridor'}</option>
            <option value="pleural_rub">{locale === 'ar' ? 'احتكاك جنبي (Pleural Friction Rub)' : 'Pleural Rub'}</option>
          </select>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'طبيعة السعال والبلغم' : 'Cough & Sputum'}
          </label>
          <select
            disabled={readOnly}
            value={data.coughType || 'none'}
            onChange={e => update('coughType', e.target.value)}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          >
            <option value="none">{locale === 'ar' ? 'لا يوجد سعال (No Cough)' : 'No Cough'}</option>
            <option value="dry">{locale === 'ar' ? 'سعال جاف متهيج (Dry Irritant)' : 'Dry Cough'}</option>
            <option value="productive_clear">{locale === 'ar' ? 'بلغمي رائق/أبيض (Mucoid)' : 'Productive (Mucoid)'}</option>
            <option value="productive_purulent">{locale === 'ar' ? 'بلغمي قيحي أصفر/أخضر (Purulent)' : 'Productive (Purulent)'}</option>
            <option value="hemoptysis">{locale === 'ar' ? 'نفث دموي (Hemoptysis - Alert)' : 'Hemoptysis'}</option>
          </select>
        </div>
      </div>

      {/* Spirometry (PFT) Quick Inputs */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
          <Activity className="w-3.5 h-3.5 text-cyan-600" />
          <span>{locale === 'ar' ? 'وظائف الرئة السريعة (Spirometry PFT)' : 'Spirometry & Peak Flow'}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">FEV1 (% predicted)</label>
            <input
              type="number"
              disabled={readOnly}
              value={data.fev1Percent || ''}
              onChange={e => update('fev1Percent', Number(e.target.value))}
              placeholder="e.g. 82%"
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-bold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">FVC (% predicted)</label>
            <input
              type="number"
              disabled={readOnly}
              value={data.fvcPercent || ''}
              onChange={e => update('fvcPercent', Number(e.target.value))}
              placeholder="e.g. 85%"
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-bold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">FEV1 / FVC Ratio</label>
            <input
              type="number"
              disabled={readOnly}
              value={data.fev1FvcRatio || ''}
              onChange={e => update('fev1FvcRatio', Number(e.target.value))}
              placeholder="e.g. 78%"
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-bold"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">Peak Flow (L/min)</label>
            <input
              type="number"
              disabled={readOnly}
              value={data.peakExpiratoryFlow || ''}
              onChange={e => update('peakExpiratoryFlow', Number(e.target.value))}
              placeholder="e.g. 450"
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-bold"
            />
          </div>
        </div>
      </div>

      {/* Notes & Imaging */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {locale === 'ar' ? 'الخلاصة الإشعاعية والسريرية (Chest X-ray / CT & Clinical Impression)' : 'Imaging & Clinical Impression'}
        </label>
        <input
          type="text"
          disabled={readOnly}
          value={data.pulmoNotes || ''}
          onChange={e => update('pulmoNotes', e.target.value)}
          placeholder={locale === 'ar' ? 'تقييم الأشعة الصدرية وتوصيات العلاج الاستنشاقي...' : 'CXR / CT findings, nebulizer therapy response, clinical notes...'}
          className="w-full text-xs p-2 border rounded-lg bg-slate-50"
        />
      </div>
    </div>
  );
};
