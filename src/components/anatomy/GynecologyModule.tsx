// ============================================================================
// MEDICORE – Obstetrics & Gynecology Clinical Examination Suite
// Section 11 Implementation: GPAL, LMP, Auto-EDD, Gestational Age & Ultrasound
// ============================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Heart, Activity, Calendar, Radio, CheckCircle2 } from 'lucide-react';

export interface GynecologyData {
  gravida: number;
  para: number;
  abortions: number;
  living: number;
  lmpDate: string;
  isPregnant: boolean;
  fundalHeightCm: number;
  fetalPresentation: string;
  fetalHeartRateBpm: number;
  amnioticFluidIndex: number;
  placentaLocation: string;
  ultrasoundNotes: string;
  papSmearStatus: string;
}

interface GynecologyModuleProps {
  data: GynecologyData;
  onChange: (data: GynecologyData) => void;
  readOnly?: boolean;
}

export const GynecologyModule: React.FC<GynecologyModuleProps> = ({
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const update = (field: keyof GynecologyData, val: any) => {
    if (readOnly) return;
    onChange({ ...data, [field]: val });
  };

  // Naegele's Rule: EDD = LMP + 1 year - 3 months + 7 days (~280 days)
  const calculateEddAndGa = (lmpStr: string) => {
    if (!lmpStr) return { edd: '', gaWeeks: 0, gaDays: 0 };
    const lmp = new Date(lmpStr);
    if (isNaN(lmp.getTime())) return { edd: '', gaWeeks: 0, gaDays: 0 };

    const eddDate = new Date(lmp.getTime() + 280 * 86400000);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - lmp.getTime()) / 86400000);
    const gaWeeks = Math.max(0, Math.floor(diffDays / 7));
    const gaDays = Math.max(0, diffDays % 7);

    return {
      edd: eddDate.toISOString().split('T')[0],
      gaWeeks,
      gaDays,
    };
  };

  const { edd, gaWeeks, gaDays } = calculateEddAndGa(data.lmpDate || '');

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-purple-50/40 via-white to-slate-50 border border-purple-100">
      <div className="flex items-center justify-between pb-2 border-b border-purple-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
            <Heart className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
              {locale === 'ar' ? 'فحص النساء والتوليد ورعاية الحوامل (OB/GYN Suite)' : 'Obstetrics & Gynecology Clinical Suite'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {locale === 'ar' ? 'تاريخ الحمل والولادة GPAL، حساب موعد الولادة المتوقع وعمر الجنين بالأسابيع' : 'GPAL history, LMP tracking, EDD calculation and ultrasound biometry'}
            </p>
          </div>
        </div>

        {data.isPregnant && gaWeeks > 0 && (
          <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
            {gaWeeks} {locale === 'ar' ? 'أسبوع حمل' : 'Weeks GA'} (+{gaDays} {locale === 'ar' ? 'يوم' : 'd'})
          </span>
        )}
      </div>

      {/* Obstetric Profile (GPAL) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
          <label className="block text-[11px] font-bold text-slate-500">Gravida (G) حمل</label>
          <input
            type="number"
            disabled={readOnly}
            value={data.gravida || 0}
            onChange={e => update('gravida', Number(e.target.value))}
            className="w-full text-center font-black text-slate-900 text-sm mt-1"
          />
        </div>
        <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
          <label className="block text-[11px] font-bold text-slate-500">Para (P) ولادات</label>
          <input
            type="number"
            disabled={readOnly}
            value={data.para || 0}
            onChange={e => update('para', Number(e.target.value))}
            className="w-full text-center font-black text-slate-900 text-sm mt-1"
          />
        </div>
        <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
          <label className="block text-[11px] font-bold text-slate-500">Abortions (A) إجهاض</label>
          <input
            type="number"
            disabled={readOnly}
            value={data.abortions || 0}
            onChange={e => update('abortions', Number(e.target.value))}
            className="w-full text-center font-black text-slate-900 text-sm mt-1"
          />
        </div>
        <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
          <label className="block text-[11px] font-bold text-slate-500">Living (L) أحياء</label>
          <input
            type="number"
            disabled={readOnly}
            value={data.living || 0}
            onChange={e => update('living', Number(e.target.value))}
            className="w-full text-center font-black text-slate-900 text-sm mt-1"
          />
        </div>
        <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-center">
          <label className="block text-[11px] font-bold text-slate-500">{locale === 'ar' ? 'حالة الحمل' : 'Pregnancy'}</label>
          <button
            type="button"
            disabled={readOnly}
            onClick={() => update('isPregnant', !data.isPregnant)}
            className={`w-full text-xs font-bold py-1 mt-1 rounded-lg transition-colors ${
              data.isPregnant ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {data.isPregnant ? (locale === 'ar' ? 'حامل حالياً' : 'Pregnant') : (locale === 'ar' ? 'غير حامل' : 'Not Pregnant')}
          </button>
        </div>
      </div>

      {/* Pregnancy Tracking (LMP & EDD) */}
      {data.isPregnant && (
        <div className="p-3.5 bg-white rounded-xl border border-purple-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'تاريخ أول يوم لآخر دورة شهرية (LMP)' : 'Last Menstrual Period (LMP)'}
            </label>
            <input
              type="date"
              disabled={readOnly}
              value={data.lmpDate || ''}
              onChange={e => update('lmpDate', e.target.value)}
              className="w-full text-xs font-bold p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'تاريخ الولادة المتوقع المحسوب (EDD)' : 'Estimated Due Date (EDD)'}
            </label>
            <div className="text-sm font-black text-purple-700 p-2 bg-purple-50 rounded-lg border border-purple-100">
              {edd || (locale === 'ar' ? 'حدد تاريخ الدورة' : 'Set LMP')}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'نبض الجنين (FHR bpm)' : 'Fetal Heart Rate (bpm)'}
            </label>
            <input
              type="number"
              disabled={readOnly}
              value={data.fetalHeartRateBpm || 140}
              onChange={e => update('fetalHeartRateBpm', Number(e.target.value))}
              className="w-full text-sm font-black text-slate-900 p-2 border rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Ultrasound Biometry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'موضع المشيمة والسائل الأمنيوسي (AFI)' : 'Placenta & Amniotic Fluid'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.placentaLocation || ''}
            onChange={e => update('placentaLocation', e.target.value)}
            placeholder="مثال: Placenta Anterior Grade II, AFI 14 cm"
            className="w-full text-xs rounded-lg border border-slate-200 p-2 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'تقرير قياسات السونار التوليدي (Ultrasound Biometry)' : 'Obstetric Ultrasound'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.ultrasoundNotes || ''}
            onChange={e => update('ultrasoundNotes', e.target.value)}
            placeholder="مثال: Single viable fetus, Cephalic, BPD 65mm, FL 48mm, EFW 1400g"
            className="w-full text-xs rounded-lg border border-slate-200 p-2 focus:border-purple-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
