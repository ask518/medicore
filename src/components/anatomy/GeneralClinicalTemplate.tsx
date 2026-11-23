// ============================================================================
// MEDICORE – Universal Clinical Examination & Specialist Documentation Template
// Applicable for Internal Med, General Surgery, Family Med, Endocrinology, etc.
// ============================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ClipboardList, Stethoscope, AlertCircle, FileCheck, Layers } from 'lucide-react';

export interface GeneralClinicalData {
  primaryComplaint: string;
  durationOnset: string;
  hpiNarrative: string;
  pallor: boolean;
  jaundice: boolean;
  cyanosis: boolean;
  clubbing: boolean;
  lymphadenopathy: boolean;
  pedalEdema: boolean;
  systemicExamNotes: string;
  differentialDiagnosis: string;
  clinicalPlan: string;
  followUpDays: number;
}

interface GeneralClinicalTemplateProps {
  specialtyTitle?: string;
  data: GeneralClinicalData;
  onChange: (data: GeneralClinicalData) => void;
  readOnly?: boolean;
}

export const GeneralClinicalTemplate: React.FC<GeneralClinicalTemplateProps> = ({
  specialtyTitle,
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const update = (field: keyof GeneralClinicalData, val: any) => {
    if (readOnly) return;
    onChange({ ...data, [field]: val });
  };

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-slate-50/70 via-white to-blue-50/20 border border-slate-200">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
            <ClipboardList className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
              {locale === 'ar'
                ? `التقييم السريري التخصصي (${specialtyTitle || 'الطب العام والباطني'})`
                : `Specialist Clinical Evaluation (${specialtyTitle || 'General/Internal Medicine'})`}
            </h4>
            <p className="text-[10px] text-slate-500">
              {locale === 'ar' ? 'القصة المرضية المفصلة، الفحص السريري الموجه، العلامات العامة وخطة المتابعة' : 'History of Present Illness, Systemic Examination & Management Plan'}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-700 border-slate-200">
          {specialtyTitle || (locale === 'ar' ? 'فحص سريري متكامل' : 'Standard Clinical Suite')}
        </span>
      </div>

      {/* Primary Complaint & Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'الشكوى الرئيسية (Chief Complaint)' : 'Chief Complaint'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.primaryComplaint || ''}
            onChange={e => update('primaryComplaint', e.target.value)}
            placeholder={locale === 'ar' ? 'السبب الرئيسي للزيارة بكلمات المريض...' : 'Main symptom or presenting reason...'}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'مدة الأعراض والبدء' : 'Onset & Duration'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.durationOnset || ''}
            onChange={e => update('durationOnset', e.target.value)}
            placeholder={locale === 'ar' ? 'مثال: منذ 3 أيام تدريجياً' : 'e.g. 3 days, acute onset'}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          />
        </div>
      </div>

      {/* General Signs (Cardio-Respiratory & Metabolic alerts) */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <h5 className="text-xs font-bold text-slate-800 mb-2">
          {locale === 'ar' ? 'العلامات السريرية العامة السريعة (General Signs)' : 'General Physical Signs'}
        </h5>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={data.pallor || false}
              onChange={e => update('pallor', e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] font-medium text-slate-700">{locale === 'ar' ? 'شحوب (Pallor)' : 'Pallor'}</span>
          </label>

          <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={data.jaundice || false}
              onChange={e => update('jaundice', e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] font-medium text-slate-700">{locale === 'ar' ? 'يرقان (Jaundice)' : 'Jaundice'}</span>
          </label>

          <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={data.cyanosis || false}
              onChange={e => update('cyanosis', e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] font-medium text-slate-700">{locale === 'ar' ? 'زرقة (Cyanosis)' : 'Cyanosis'}</span>
          </label>

          <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={data.clubbing || false}
              onChange={e => update('clubbing', e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] font-medium text-slate-700">{locale === 'ar' ? 'تبقرط أصابع' : 'Clubbing'}</span>
          </label>

          <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={data.lymphadenopathy || false}
              onChange={e => update('lymphadenopathy', e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] font-medium text-slate-700">{locale === 'ar' ? 'اعتلال عقد' : 'Lymph nodes'}</span>
          </label>

          <label className="flex items-center gap-1.5 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={data.pedalEdema || false}
              onChange={e => update('pedalEdema', e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] font-medium text-slate-700">{locale === 'ar' ? 'وذمة أطراف' : 'Edema'}</span>
          </label>
        </div>
      </div>

      {/* Systemic Examination & Differential */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'الفحص الموجه للعضو/الجهاز المصاب' : 'Systemic & Focused Examination'}
          </label>
          <textarea
            rows={3}
            disabled={readOnly}
            value={data.systemicExamNotes || ''}
            onChange={e => update('systemicExamNotes', e.target.value)}
            placeholder={locale === 'ar' ? 'تفاصيل فحص العضو والنتائج السريرية الموضوعية...' : 'Systemic exam notes, palpatory findings, special tests...'}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'التشخيص التفريقي والاستقصاءات' : 'Differential Diagnosis & Workup'}
          </label>
          <textarea
            rows={3}
            disabled={readOnly}
            value={data.differentialDiagnosis || ''}
            onChange={e => update('differentialDiagnosis', e.target.value)}
            placeholder={locale === 'ar' ? 'التشاخيص المحتملة، التحاليل والأشعة المطلوبة...' : 'Differential diagnoses, laboratory/radiological requests...'}
            className="w-full text-xs p-2 border rounded-lg bg-slate-50"
          />
        </div>
      </div>
    </div>
  );
};
