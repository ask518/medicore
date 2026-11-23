// ============================================================================
// MEDICORE – Urology & Andrology Clinical Examination Suite
// Section 11 Implementation: LUTS, IPSS, DRE (Prostate), Scrotum, PVR & Urinalysis
// ============================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Droplet, Activity, ShieldAlert, CheckCircle2, FileText } from 'lucide-react';

export interface UrologyData {
  dysuria: boolean;
  frequency: boolean;
  urgency: boolean;
  nocturiaCount: number; // times per night
  streamQuality: 'normal' | 'weak_intermittent' | 'straining';
  hematuria: 'none' | 'microscopic' | 'gross_painless' | 'gross_painful';
  ipssScore: number; // 0-35
  ipssQolScore: number; // 0-6 (Delighted to Terrible)
  prostateSize: 'normal_grade1' | 'moderate_grade2' | 'large_grade3' | 'massive_grade4';
  prostateConsistency: 'smooth_elastic' | 'firm_bph' | 'hard_nodular_suspicious' | 'tender_boggy';
  costovertebralTenderness: 'none' | 'right_positive' | 'left_positive' | 'bilateral';
  scrotalExam: 'normal' | 'varicocele' | 'hydrocele' | 'epididymo_orchitis' | 'mass';
  pvrVolumeMl?: number; // Post-void residual
  serumPsa?: number; // ng/mL
  catheterStatus: 'none' | 'foley_indwelling' | 'suprapubic' | 'cic';
  uroNotes: string;
}

interface UrologyModuleProps {
  data: UrologyData;
  onChange: (data: UrologyData) => void;
  readOnly?: boolean;
}

export const UrologyModule: React.FC<UrologyModuleProps> = ({
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const update = (field: keyof UrologyData, val: any) => {
    if (readOnly) return;
    onChange({ ...data, [field]: val });
  };

  const getIpssSeverity = (score: number) => {
    if (score >= 20) return { label: locale === 'ar' ? 'أعراض شديدة (Severe 20-35)' : 'Severe (20-35)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    if (score >= 8) return { label: locale === 'ar' ? 'أعراض متوسطة (Moderate 8-19)' : 'Moderate (8-19)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    return { label: locale === 'ar' ? 'أعراض خفيفة (Mild 0-7)' : 'Mild (0-7)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  };

  const ipssSev = getIpssSeverity(data.ipssScore || 0);

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-blue-50/40 via-white to-slate-50 border border-blue-100">
      <div className="flex items-center justify-between pb-2 border-b border-blue-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <Droplet className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
              {locale === 'ar' ? 'عيادة المسالك البولية وأمراض الذكورة (Urology Suite)' : 'Urology & Andrology Clinical Suite'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {locale === 'ar' ? 'أعراض المسالك السفلية (LUTS)، تقييم البروستاتا (DRE/IPSS)، وفحص البول والثمالة البولية' : 'LUTS, IPSS Score, DRE Prostate, Renal Tenderness & PVR Volume'}
            </p>
          </div>
        </div>

        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${ipssSev.color}`}>
          IPSS: {data.ipssScore || 0}/35 – {ipssSev.label}
        </span>
      </div>

      {/* LUTS & Urinary Symptoms Checklist */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <h5 className="text-xs font-bold text-slate-800 mb-2">
          {locale === 'ar' ? 'أعراض المسالك البولية السفلية (LUTS)' : 'Lower Urinary Tract Symptoms (LUTS)'}
        </h5>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50/50">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={data.dysuria || false}
              onChange={e => update('dysuria', e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-slate-700">{locale === 'ar' ? 'عسر وحرقة بولية' : 'Dysuria'}</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50/50">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={data.frequency || false}
              onChange={e => update('frequency', e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-slate-700">{locale === 'ar' ? 'تكرار التبول نهاراً' : 'Frequency'}</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer bg-slate-50/50">
            <input
              type="checkbox"
              disabled={readOnly}
              checked={data.urgency || false}
              onChange={e => update('urgency', e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs font-medium text-slate-700">{locale === 'ar' ? 'إلحاح بولي مفاجئ' : 'Urgency'}</span>
          </label>

          <div className="p-1.5 border border-slate-200 rounded-lg bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">{locale === 'ar' ? 'تبول ليلي (مرات):' : 'Nocturia:'}</span>
            <input
              type="number"
              min={0}
              max={15}
              disabled={readOnly}
              value={data.nocturiaCount ?? 0}
              onChange={e => update('nocturiaCount', Number(e.target.value))}
              className="w-12 text-center text-xs font-bold border rounded p-1"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'قوة تدفق البول' : 'Stream Quality'}
            </label>
            <select
              disabled={readOnly}
              value={data.streamQuality || 'normal'}
              onChange={e => update('streamQuality', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50"
            >
              <option value="normal">{locale === 'ar' ? 'تدفق قوي ومستمر (Normal)' : 'Normal Stream'}</option>
              <option value="weak_intermittent">{locale === 'ar' ? 'ضعيف ومتقطع (Weak/Intermittent)' : 'Weak / Intermittent'}</option>
              <option value="straining">{locale === 'ar' ? 'صعوبة بالبدء وعصر (Straining)' : 'Hesitancy & Straining'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'البيلة الدموية (Hematuria)' : 'Hematuria'}
            </label>
            <select
              disabled={readOnly}
              value={data.hematuria || 'none'}
              onChange={e => update('hematuria', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50"
            >
              <option value="none">{locale === 'ar' ? 'لا يوجد دم (None)' : 'None'}</option>
              <option value="microscopic">{locale === 'ar' ? 'مجهري فقط بالتحليل (Microscopic)' : 'Microscopic'}</option>
              <option value="gross_painless">{locale === 'ar' ? 'عياني غير مؤلم (Gross Painless - Red flag)' : 'Gross Painless (Alert)'}</option>
              <option value="gross_painful">{locale === 'ar' ? 'عياني مؤلم مع حصوات (Gross Painful)' : 'Gross Painful'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'مقياس أعراض البروستاتا (IPSS 0-35)' : 'IPSS Score (0-35)'}
            </label>
            <input
              type="number"
              min={0}
              max={35}
              disabled={readOnly}
              value={data.ipssScore ?? 0}
              onChange={e => update('ipssScore', Number(e.target.value))}
              className="w-full text-xs font-bold p-1.5 border rounded bg-slate-50"
            />
          </div>
        </div>
      </div>

      {/* Prostate Examination (DRE) & Diagnostics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
          <h5 className="text-xs font-bold text-slate-800">
            {locale === 'ar' ? 'فحص البروستاتا الشرجي (DRE Prostate)' : 'Digital Rectal Exam (DRE)'}
          </h5>
          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">
              {locale === 'ar' ? 'حجم البروستاتا' : 'Prostate Size'}
            </label>
            <select
              disabled={readOnly}
              value={data.prostateSize || 'normal_grade1'}
              onChange={e => update('prostateSize', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50"
            >
              <option value="normal_grade1">{locale === 'ar' ? 'حجم طبيعي درجة 1 (~20g)' : 'Grade I Normal (~20g)'}</option>
              <option value="moderate_grade2">{locale === 'ar' ? 'تضخم معتدل درجة 2 (20-40g)' : 'Grade II (20-40g)'}</option>
              <option value="large_grade3">{locale === 'ar' ? 'تضخم كبير درجة 3 (40-60g)' : 'Grade III (40-60g)'}</option>
              <option value="massive_grade4">{locale === 'ar' ? 'تضخم ضخم درجة 4 (>60g)' : 'Grade IV (>60g)'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">
              {locale === 'ar' ? 'قوام وملمس الغدة' : 'Prostate Texture'}
            </label>
            <select
              disabled={readOnly}
              value={data.prostateConsistency || 'smooth_elastic'}
              onChange={e => update('prostateConsistency', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50"
            >
              <option value="smooth_elastic">{locale === 'ar' ? 'أملس ومرن طبيعي (Smooth/Elastic)' : 'Smooth / Elastic'}</option>
              <option value="firm_bph">{locale === 'ar' ? 'مطاطي متضخم حميد (Firm BPH)' : 'Firm BPH'}</option>
              <option value="hard_nodular_suspicious">{locale === 'ar' ? 'صلب به عقد مشتبهة (Hard/Nodular)' : 'Hard / Nodular'}</option>
              <option value="tender_boggy">{locale === 'ar' ? 'رخو ومؤلم جداً - التهابي (Tender/Boggy)' : 'Tender / Boggy (Prostatitis)'}</option>
            </select>
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
          <h5 className="text-xs font-bold text-slate-800">
            {locale === 'ar' ? 'المؤشرات المخبرية والسونار (Urological Labs & US)' : 'Labs & Ultrasound'}
          </h5>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium text-slate-600 mb-1">
                {locale === 'ar' ? 'الثمالة البولية (PVR mL)' : 'PVR (mL)'}
              </label>
              <input
                type="number"
                disabled={readOnly}
                value={data.pvrVolumeMl || ''}
                onChange={e => update('pvrVolumeMl', Number(e.target.value))}
                placeholder="e.g. 35 mL"
                className="w-full text-xs p-1.5 border rounded bg-slate-50 font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-slate-600 mb-1">
                {locale === 'ar' ? 'مستضد البروستاتا (PSA ng/mL)' : 'PSA (ng/mL)'}
              </label>
              <input
                type="number"
                step="0.1"
                disabled={readOnly}
                value={data.serumPsa || ''}
                onChange={e => update('serumPsa', Number(e.target.value))}
                placeholder="e.g. 1.8"
                className="w-full text-xs p-1.5 border rounded bg-slate-50 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">
              {locale === 'ar' ? 'حالة القسطرة البولية' : 'Catheter Status'}
            </label>
            <select
              disabled={readOnly}
              value={data.catheterStatus || 'none'}
              onChange={e => update('catheterStatus', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50"
            >
              <option value="none">{locale === 'ar' ? 'بدون قسطرة (None)' : 'None'}</option>
              <option value="foley_indwelling">{locale === 'ar' ? 'قسطرة فولاي مستقرة (Foley Indwelling)' : 'Foley Indwelling'}</option>
              <option value="suprapubic">{locale === 'ar' ? 'قسطرة فوق العانة (Suprapubic)' : 'Suprapubic'}</option>
              <option value="cic">{locale === 'ar' ? 'قسطرة ذاتية متقطعة (Clean Intermittent)' : 'CIC'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Urology Notes */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {locale === 'ar' ? 'الخلاصة والتشخيص الجراحي/الدوائي' : 'Urology Clinical Impression'}
        </label>
        <input
          type="text"
          disabled={readOnly}
          value={data.uroNotes || ''}
          onChange={e => update('uroNotes', e.target.value)}
          placeholder={locale === 'ar' ? 'ملاحظات السونار، حصوات الكلى، أو خطة تفتيت/تنظير الحصاة...' : 'Stone size/location, planned URS/ESWL, medications...'}
          className="w-full text-xs p-2 border rounded-lg bg-slate-50"
        />
      </div>
    </div>
  );
};
