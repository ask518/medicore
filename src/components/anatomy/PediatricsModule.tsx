// ============================================================================
// MEDICORE – Pediatrics Clinical Examination, Growth Charts & Vaccines
// Section 11 Implementation: Anthropometrics, Percentiles, Milestones & Immunization
// ============================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Baby, Activity, CheckSquare, Square, ShieldCheck, Heart } from 'lucide-react';

export interface PediatricsData {
  ageMonths: number;
  weightKg: number;
  heightCm: number;
  headCircumferenceCm: number;
  weightPercentile: string;
  heightPercentile: string;
  headPercentile: string;
  grossMotorMilestone: string;
  fineMotorMilestone: string;
  languageMilestone: string;
  socialMilestone: string;
  completedVaccines: string[];
  feedingType: string;
  pediatricNotes: string;
}

interface PediatricsModuleProps {
  data: PediatricsData;
  onChange: (data: PediatricsData) => void;
  readOnly?: boolean;
}

export const PediatricsModule: React.FC<PediatricsModuleProps> = ({
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const update = (field: keyof PediatricsData, val: any) => {
    if (readOnly) return;
    onChange({ ...data, [field]: val });
  };

  const toggleVaccine = (vacId: string) => {
    if (readOnly) return;
    const current = data.completedVaccines || [];
    if (current.includes(vacId)) {
      update('completedVaccines', current.filter(v => v !== vacId));
    } else {
      update('completedVaccines', [...current, vacId]);
    }
  };

  const vaccinesList = [
    { id: 'bcg', name_ar: 'الدرن (BCG عند الولادة)' },
    { id: 'hepb_0', name_ar: 'الكبدي B جرعة الولادة' },
    { id: 'penta_1', name_ar: 'الخماسي الجرعة الأولى (شهران)' },
    { id: 'polio_1', name_ar: 'شلل الأطفال الجرعة الأولى' },
    { id: 'rota_1', name_ar: 'الروتا الجرعة الأولى' },
    { id: 'penta_2', name_ar: 'الخماسي الجرعة الثانية (4 أشهر)' },
    { id: 'penta_3', name_ar: 'الخماسي الجرعة الثالثة (6 أشهر)' },
    { id: 'polio_boost', name_ar: 'شلل الأطفال الجرعات التنشيطية' },
    { id: 'mmr_1', name_ar: 'الحصبة والنكاف والحصبة الألمانية (سنة)' },
    { id: 'dpt_boost', name_ar: 'الثلاثي البكتيري المنشط (18 شهراً)' },
  ];

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-sky-50/40 via-white to-slate-50 border border-sky-100">
      <div className="flex items-center justify-between pb-2 border-b border-sky-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <Baby className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
              {locale === 'ar' ? 'فحص طب الأطفال والنمو والتطعيمات (Pediatric Growth Suite)' : 'Pediatrics Growth & Milestones Suite'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {locale === 'ar' ? 'منحنيات النمو، محيط الرأس، التطور الحركي واللغوي، وسجل التطعيمات' : 'Growth tracking, head circumference, milestones and immunization'}
            </p>
          </div>
        </div>

        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800">
          {(data.completedVaccines || []).length} / {vaccinesList.length} {locale === 'ar' ? 'تطعيمات مكتملة' : 'Vaccines'}
        </span>
      </div>

      {/* Anthropometric Measurements */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'العمر (بالشهور)' : 'Age (Months)'}
          </label>
          <input
            type="number"
            disabled={readOnly}
            value={data.ageMonths || 12}
            onChange={e => update('ageMonths', Number(e.target.value))}
            className="w-full text-base font-black text-slate-900 p-1 border rounded-lg"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'الوزن (كجم)' : 'Weight (kg)'}
          </label>
          <input
            type="number"
            step="0.1"
            disabled={readOnly}
            value={data.weightKg || 9.5}
            onChange={e => update('weightKg', Number(e.target.value))}
            className="w-full text-base font-black text-sky-700 p-1 border rounded-lg"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'الطول (سم)' : 'Height/Length (cm)'}
          </label>
          <input
            type="number"
            step="0.5"
            disabled={readOnly}
            value={data.heightCm || 76}
            onChange={e => update('heightCm', Number(e.target.value))}
            className="w-full text-base font-black text-sky-700 p-1 border rounded-lg"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-600 mb-1">
            {locale === 'ar' ? 'محيط الرأس (سم)' : 'Head Circ (cm)'}
          </label>
          <input
            type="number"
            step="0.1"
            disabled={readOnly}
            value={data.headCircumferenceCm || 46}
            onChange={e => update('headCircumferenceCm', Number(e.target.value))}
            className="w-full text-base font-black text-slate-900 p-1 border rounded-lg"
          />
        </div>
      </div>

      {/* Developmental Milestones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'التطور الحركي الكبير (Gross Motor)' : 'Gross Motor'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.grossMotorMilestone || ''}
            onChange={e => update('grossMotorMilestone', e.target.value)}
            placeholder="مثال: يقف بمفرده ويمشي خطوات متزنة"
            className="w-full text-xs rounded-lg border border-slate-200 p-2"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'التطور اللغوي والتواصلي (Language)' : 'Language & Social'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.languageMilestone || ''}
            onChange={e => update('languageMilestone', e.target.value)}
            placeholder="مثال: ينطق بابا وماما بوعي ويشير للأشياء"
            className="w-full text-xs rounded-lg border border-slate-200 p-2"
          />
        </div>
      </div>

      {/* Immunization Checklist */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
          <span>{locale === 'ar' ? 'سجل التطعيمات الإلزامية والإضافية:' : 'Immunization Checklist:'}</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-white p-3 rounded-xl border border-slate-200">
          {vaccinesList.map(v => {
            const isCompleted = (data.completedVaccines || []).includes(v.id);
            return (
              <button
                key={v.id}
                type="button"
                disabled={readOnly}
                onClick={() => toggleVaccine(v.id)}
                className={`p-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition-all text-start ${
                  isCompleted ? 'bg-sky-50 border-sky-300 text-sky-900' : 'bg-slate-50 border-slate-200 text-slate-500'
                }`}
              >
                {isCompleted ? <CheckSquare className="w-3.5 h-3.5 text-sky-600 shrink-0" /> : <Square className="w-3.5 h-3.5 text-slate-300 shrink-0" />}
                <span className="truncate">{v.name_ar}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
