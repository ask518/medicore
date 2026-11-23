// ============================================================================
// MEDICORE – Otolaryngology (ENT / الأذن والأنف والحنجرة) Examination Suite
// Section 11 Implementation: Otoscopy, Weber/Rinne, Rhinoscopy, Tonsils 1-4 & Larynx
// ============================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Volume2, Eye, ShieldAlert, CheckCircle2, FileText } from 'lucide-react';

export interface EntData {
  rightEarTm: 'intact_normal' | 'congested_bulging' | 'perforated_central' | 'perforated_marginal' | 'retracted' | 'cerumen_impacted' | 'discharge';
  leftEarTm: 'intact_normal' | 'congested_bulging' | 'perforated_central' | 'perforated_marginal' | 'retracted' | 'cerumen_impacted' | 'discharge';
  weberTest: 'central_normal' | 'lateralized_right' | 'lateralized_left';
  rinneRight: 'positive_normal' | 'negative_conductive';
  rinneLeft: 'positive_normal' | 'negative_conductive';
  nasalSeptum: 'midline_straight' | 'deviated_right' | 'deviated_left' | 'septal_spur' | 'perforation';
  nasalTurbinates: 'normal' | 'hypertrophied_congested' | 'allergic_pale' | 'polyposis';
  tonsilGrade: 0 | 1 | 2 | 3 | 4; // Brodsky Grading Scale
  tonsilExudate: 'none' | 'follicular' | 'membranous' | 'peritonsillar_fullness';
  pharynxWall: 'normal' | 'granular_erythema' | 'cobblestoning_allergic';
  neckLymphNodes: 'non_palpable' | 'tender_cervical' | 'firm_enlarged' | 'submandibular';
  entNotes: string;
}

interface EntModuleProps {
  data: EntData;
  onChange: (data: EntData) => void;
  readOnly?: boolean;
}

export const EntModule: React.FC<EntModuleProps> = ({
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const update = (field: keyof EntData, val: any) => {
    if (readOnly) return;
    onChange({ ...data, [field]: val });
  };

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-amber-50/40 via-white to-slate-50 border border-amber-100">
      <div className="flex items-center justify-between pb-2 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
              {locale === 'ar' ? 'فحص الأنف والأذن والحنجرة المتقدم (ENT Suite)' : 'Otolaryngology (ENT) Clinical Suite'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {locale === 'ar' ? 'تنظير الأذن وغشاء الطبل، فحص السمع (ويبر/ريني)، حاجز وقرينات الأنف، وتدرج اللوزتين (0-4)' : 'Otoscopy, Weber/Rinne, Rhinoscopy, Tonsillar Brodsky Grading & Neck'}
            </p>
          </div>
        </div>

        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
          {locale === 'ar' ? 'فحص سريري دقيق' : 'ENT Exam'}
        </span>
      </div>

      {/* Ears & Hearing */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <h5 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
          <Volume2 className="w-3.5 h-3.5 text-amber-600" />
          <span>{locale === 'ar' ? 'تنظير الأذن وغشاء الطبل (Otoscopy & Hearing)' : 'Otoscopy & Hearing Tests'}</span>
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'الأذن اليمنى (Right TM)' : 'Right Ear (TM)'}
            </label>
            <select
              disabled={readOnly}
              value={data.rightEarTm || 'intact_normal'}
              onChange={e => update('rightEarTm', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-medium"
            >
              <option value="intact_normal">{locale === 'ar' ? 'سليم طبيعي (Intact Normal)' : 'Intact Normal'}</option>
              <option value="congested_bulging">{locale === 'ar' ? 'محتقن وجاحد (AOM Bulging)' : 'Congested/Bulging'}</option>
              <option value="perforated_central">{locale === 'ar' ? 'ثقب مركزي (Central Perforation)' : 'Central Perforation'}</option>
              <option value="retracted">{locale === 'ar' ? 'غائر منكمش (Retracted)' : 'Retracted'}</option>
              <option value="cerumen_impacted">{locale === 'ar' ? 'انسداد بالشمع (Impacted Wax)' : 'Impacted Wax'}</option>
              <option value="discharge">{locale === 'ar' ? 'سيلان قيحي/نزيز (Otorrhea)' : 'Otorrhea'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'الأذن اليسرى (Left TM)' : 'Left Ear (TM)'}
            </label>
            <select
              disabled={readOnly}
              value={data.leftEarTm || 'intact_normal'}
              onChange={e => update('leftEarTm', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-medium"
            >
              <option value="intact_normal">{locale === 'ar' ? 'سليم طبيعي (Intact Normal)' : 'Intact Normal'}</option>
              <option value="congested_bulging">{locale === 'ar' ? 'محتقن وجاحد (AOM Bulging)' : 'Congested/Bulging'}</option>
              <option value="perforated_central">{locale === 'ar' ? 'ثقب مركزي (Central Perforation)' : 'Central Perforation'}</option>
              <option value="retracted">{locale === 'ar' ? 'غائر منكمش (Retracted)' : 'Retracted'}</option>
              <option value="cerumen_impacted">{locale === 'ar' ? 'انسداد بالشمع (Impacted Wax)' : 'Impacted Wax'}</option>
              <option value="discharge">{locale === 'ar' ? 'سيلان قيحي/نزيز (Otorrhea)' : 'Otorrhea'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'فحص ويبر (Weber Test)' : 'Weber Test'}
            </label>
            <select
              disabled={readOnly}
              value={data.weberTest || 'central_normal'}
              onChange={e => update('weberTest', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-medium"
            >
              <option value="central_normal">{locale === 'ar' ? 'متوسط متناظر (Central)' : 'Central (Normal)'}</option>
              <option value="lateralized_right">{locale === 'ar' ? 'انحياز لليمين (Lateralized Right)' : 'Lateralized Right'}</option>
              <option value="lateralized_left">{locale === 'ar' ? 'انحياز لليسار (Lateralized Left)' : 'Lateralized Left'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'فحص ريني (Rinne Test)' : 'Rinne Test'}
            </label>
            <select
              disabled={readOnly}
              value={data.rinneRight || 'positive_normal'}
              onChange={e => update('rinneRight', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-medium"
            >
              <option value="positive_normal">{locale === 'ar' ? 'إيجابي طبيعي AC>BC (Positive)' : 'Positive AC>BC (Normal)'}</option>
              <option value="negative_conductive">{locale === 'ar' ? 'سلبي توصيلي BC>=AC (Negative)' : 'Negative BC>=AC (Conductive)'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Nose & Throat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Nose */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
          <h5 className="text-xs font-bold text-slate-800">
            {locale === 'ar' ? 'تنظير الأنف الأمامي (Anterior Rhinoscopy)' : 'Anterior Rhinoscopy'}
          </h5>
          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">
              {locale === 'ar' ? 'حاجز الأنف (Nasal Septum)' : 'Nasal Septum'}
            </label>
            <select
              disabled={readOnly}
              value={data.nasalSeptum || 'midline_straight'}
              onChange={e => update('nasalSeptum', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50"
            >
              <option value="midline_straight">{locale === 'ar' ? 'مستقيم بالمنتصف (Midline Straight)' : 'Midline Straight'}</option>
              <option value="deviated_right">{locale === 'ar' ? 'انحراف وتيرة لليمين (DNS Right)' : 'Deviated Right'}</option>
              <option value="deviated_left">{locale === 'ar' ? 'انحراف وتيرة لليسار (DNS Left)' : 'Deviated Left'}</option>
              <option value="septal_spur">{locale === 'ar' ? 'مهماز غضروفي عظمي (Spur)' : 'Septal Spur'}</option>
              <option value="perforation">{locale === 'ar' ? 'انثقاب الحاجز (Perforation)' : 'Septal Perforation'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">
              {locale === 'ar' ? 'القرينات الأنفية (Turbinates)' : 'Turbinates'}
            </label>
            <select
              disabled={readOnly}
              value={data.nasalTurbinates || 'normal'}
              onChange={e => update('nasalTurbinates', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50"
            >
              <option value="normal">{locale === 'ar' ? 'طبيعية غير محتقنة (Normal)' : 'Normal'}</option>
              <option value="hypertrophied_congested">{locale === 'ar' ? 'ضخامة واحتقان أحمر (Hypertrophy)' : 'Hypertrophied Congested'}</option>
              <option value="allergic_pale">{locale === 'ar' ? 'شاحبة رمادية تحسسية (Allergic Pale)' : 'Allergic Pale'}</option>
              <option value="polyposis">{locale === 'ar' ? 'سلائل أنفية (Nasal Polyposis)' : 'Nasal Polyps'}</option>
            </select>
          </div>
        </div>

        {/* Throat & Tonsils */}
        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
          <h5 className="text-xs font-bold text-slate-800">
            {locale === 'ar' ? 'فحص البلعوم واللوزتين (Throat & Tonsils)' : 'Oral Cavity & Tonsils'}
          </h5>
          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">
              {locale === 'ar' ? 'درجة حجم اللوزتين (Brodsky Tonsil Grade 0-4)' : 'Tonsil Grade (0-4)'}
            </label>
            <select
              disabled={readOnly}
              value={data.tonsilGrade ?? 1}
              onChange={e => update('tonsilGrade', Number(e.target.value))}
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-bold"
            >
              <option value={0}>0 - {locale === 'ar' ? 'مستأصلة (Post-tonsillectomy)' : 'Absent / Removed'}</option>
              <option value={1}>1 - {locale === 'ar' ? 'مختفية ضمن السويقات <25%' : 'Grade 1 (<25%)'}</option>
              <option value={2}>2 - {locale === 'ar' ? 'تمتد للأعمدة 25-50%' : 'Grade 2 (25-50%)'}</option>
              <option value={3}>3 - {locale === 'ar' ? 'ضخامة واضحة 50-75%' : 'Grade 3 (50-75%)'}</option>
              <option value={4}>4 - {locale === 'ar' ? 'ملتصقة متلامسة >75% (Kissing)' : 'Grade 4 (>75% Kissing)'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-slate-600 mb-1">
              {locale === 'ar' ? 'الإفرازات والالتهاب اللوزي' : 'Tonsil Exudate / Pathology'}
            </label>
            <select
              disabled={readOnly}
              value={data.tonsilExudate || 'none'}
              onChange={e => update('tonsilExudate', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50"
            >
              <option value="none">{locale === 'ar' ? 'لا توجد إفرازات (Clean / None)' : 'None (Clean)'}</option>
              <option value="follicular">{locale === 'ar' ? 'نقاط قيحية جريبية (Follicular Exudate)' : 'Follicular Exudate'}</option>
              <option value="membranous">{locale === 'ar' ? 'غشاء التهابي (Membranous)' : 'Membranous'}</option>
              <option value="peritonsillar_fullness">{locale === 'ar' ? 'انتفاخ حول اللوزة (Peritonsillar Abscess)' : 'Peritonsillar Fullness'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ENT Notes */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {locale === 'ar' ? 'الخطة العلاجية وملاحظات التنظير' : 'Clinical & Endoscopic Impression'}
        </label>
        <input
          type="text"
          disabled={readOnly}
          value={data.entNotes || ''}
          onChange={e => update('entNotes', e.target.value)}
          placeholder={locale === 'ar' ? 'ملاحظات الحنجرة والصوت، اللحميات أو الإجراء الجراحي المقترح...' : 'Laryngoscopy, vocal cord mobility, adenoids or planned surgery...'}
          className="w-full text-xs p-2 border rounded-lg bg-slate-50"
        />
      </div>
    </div>
  );
};
