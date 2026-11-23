// ============================================================================
// MEDICORE – Psychiatry & Behavioral Health Clinical Examination Suite
// Section 11 Implementation: MSE (Mental Status Exam), PHQ-9, GAD-7 & Risk Assessment
// ============================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Smile, AlertTriangle, ShieldCheck, HeartPulse, FileText } from 'lucide-react';

export interface PsychiatryData {
  appearanceBehavior: 'well_groomed' | 'disheveled' | 'psychomotor_agitation' | 'psychomotor_retardation' | 'cooperative' | 'guarded';
  speechCharacteristics: 'normal_rate_tone' | 'pressured' | 'slow_monotone' | 'sparse_mute';
  moodSubjective: 'euthymic' | 'depressed' | 'anxious' | 'elevated_euphoric' | 'irritable';
  affectObjective: 'congruent_full' | 'blunted_flat' | 'labile' | 'incongruent';
  thoughtProcess: 'linear_goal_directed' | 'circumstantial' | 'tangential' | 'flight_of_ideas' | 'loosening';
  thoughtContent: 'normal' | 'suicidal_ideation' | 'delusions_persecutory' | 'obsessions' | 'homicidal_ideation';
  perceptualDisturbances: 'none' | 'auditory_hallucinations' | 'visual_hallucinations' | 'illusions';
  insightJudgment: 'intact_good' | 'partial_fair' | 'poor_absent';
  phq9Score: number; // 0-27
  gad7Score: number; // 0-21
  suicideRisk: 'none_low' | 'moderate' | 'high_imminent';
  psychNotes: string;
}

interface PsychiatryModuleProps {
  data: PsychiatryData;
  onChange: (data: PsychiatryData) => void;
  readOnly?: boolean;
}

export const PsychiatryModule: React.FC<PsychiatryModuleProps> = ({
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const update = (field: keyof PsychiatryData, val: any) => {
    if (readOnly) return;
    onChange({ ...data, [field]: val });
  };

  const getPhq9Severity = (score: number) => {
    if (score >= 20) return { label: locale === 'ar' ? 'اكتئاب حاد شديد (Severe 20-27)' : 'Severe (20-27)', color: 'bg-rose-100 text-rose-800 border-rose-300' };
    if (score >= 15) return { label: locale === 'ar' ? 'اكتئاب متوسط الشدة (Moderately Severe 15-19)' : 'Mod Severe (15-19)', color: 'bg-orange-100 text-orange-800 border-orange-300' };
    if (score >= 10) return { label: locale === 'ar' ? 'اكتئاب معتدل (Moderate 10-14)' : 'Moderate (10-14)', color: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (score >= 5) return { label: locale === 'ar' ? 'أعراض خفيفة (Mild 5-9)' : 'Mild (5-9)', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
    return { label: locale === 'ar' ? 'طبيعي - لا يوجد اكتئاب (Minimal 0-4)' : 'Minimal (0-4)', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  };

  const phqSev = getPhq9Severity(data.phq9Score || 0);

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-violet-50/40 via-white to-slate-50 border border-violet-100">
      <div className="flex items-center justify-between pb-2 border-b border-violet-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
            <Smile className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
              {locale === 'ar' ? 'الفحص النفسي والسلوكي المتخصص (Psychiatry & MSE)' : 'Psychiatry & Behavioral Health Suite'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {locale === 'ar' ? 'فحص الحالة العقلية (MSE)، مقاييس الاكتئاب والقلق (PHQ-9 / GAD-7)، وتقييم المخاطر' : 'Mental Status Exam (MSE), PHQ-9, GAD-7 & Clinical Risk Assessment'}
            </p>
          </div>
        </div>

        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${phqSev.color}`}>
          PHQ-9: {data.phq9Score || 0}/27 – {phqSev.label}
        </span>
      </div>

      {/* Mental Status Examination (MSE) Grid */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <h5 className="text-xs font-bold text-slate-800 mb-2">
          {locale === 'ar' ? 'فحص الحالة العقلية (Mental Status Examination - MSE)' : 'Mental Status Examination (MSE)'}
        </h5>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'المظهر والسلوك الحركي' : 'Appearance & Behavior'}
            </label>
            <select
              disabled={readOnly}
              value={data.appearanceBehavior || 'well_groomed'}
              onChange={e => update('appearanceBehavior', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-medium"
            >
              <option value="well_groomed">{locale === 'ar' ? 'مهندم ومتعاون (Well-groomed)' : 'Well-groomed'}</option>
              <option value="disheveled">{locale === 'ar' ? 'مهمل المظهر والنظافة (Disheveled)' : 'Disheveled'}</option>
              <option value="psychomotor_agitation">{locale === 'ar' ? 'هياج حركي نفسي (Agitated)' : 'Agitated'}</option>
              <option value="psychomotor_retardation">{locale === 'ar' ? 'بطء حركي شديد (Retarded)' : 'Retarded'}</option>
              <option value="guarded">{locale === 'ar' ? 'متحفظ وحذر ومريب (Guarded)' : 'Guarded'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'المزاج الذاتي (Mood)' : 'Mood (Subjective)'}
            </label>
            <select
              disabled={readOnly}
              value={data.moodSubjective || 'euthymic'}
              onChange={e => update('moodSubjective', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-medium"
            >
              <option value="euthymic">{locale === 'ar' ? 'طبيعي متوازن (Euthymic)' : 'Euthymic'}</option>
              <option value="depressed">{locale === 'ar' ? 'مكتئب وحزين (Depressed)' : 'Depressed'}</option>
              <option value="anxious">{locale === 'ar' ? 'قلق ومتوتر (Anxious)' : 'Anxious'}</option>
              <option value="elevated_euphoric">{locale === 'ar' ? 'مبتهج / هوسي (Elevated/Manic)' : 'Elevated / Manic'}</option>
              <option value="irritable">{locale === 'ar' ? 'سريع الغضب والانفعال (Irritable)' : 'Irritable'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'الانفعال الظاهر (Affect)' : 'Affect (Objective)'}
            </label>
            <select
              disabled={readOnly}
              value={data.affectObjective || 'congruent_full'}
              onChange={e => update('affectObjective', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-medium"
            >
              <option value="congruent_full">{locale === 'ar' ? 'متطابق ومرن (Congruent Full)' : 'Congruent Full'}</option>
              <option value="blunted_flat">{locale === 'ar' ? 'متبلد مسطح (Flat / Blunted)' : 'Flat / Blunted'}</option>
              <option value="labile">{locale === 'ar' ? 'متقلب سريع التبدل (Labile)' : 'Labile'}</option>
              <option value="incongruent">{locale === 'ar' ? 'غير متطابق مع الحديث (Incongruent)' : 'Incongruent'}</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              {locale === 'ar' ? 'مجريات التفكير (Process)' : 'Thought Process'}
            </label>
            <select
              disabled={readOnly}
              value={data.thoughtProcess || 'linear_goal_directed'}
              onChange={e => update('thoughtProcess', e.target.value)}
              className="w-full text-xs p-1.5 border rounded bg-slate-50 font-medium"
            >
              <option value="linear_goal_directed">{locale === 'ar' ? 'خطي ومترابط هادف (Goal-directed)' : 'Goal-directed'}</option>
              <option value="circumstantial">{locale === 'ar' ? 'إسهابي مع عودة للأصل (Circumstantial)' : 'Circumstantial'}</option>
              <option value="tangential">{locale === 'ar' ? 'مماسي متشعب (Tangential)' : 'Tangential'}</option>
              <option value="flight_of_ideas">{locale === 'ar' ? 'تطاير الأفكار الهوسي (Flight of ideas)' : 'Flight of Ideas'}</option>
              <option value="loosening">{locale === 'ar' ? 'تفكك ترابطي انفصامي (Loose)' : 'Loosening'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Screeners & Risk Assessment */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'مقياس الاكتئاب (PHQ-9: 0-27)' : 'PHQ-9 Depression (0-27)'}
          </label>
          <input
            type="number"
            min={0}
            max={27}
            disabled={readOnly}
            value={data.phq9Score ?? 0}
            onChange={e => update('phq9Score', Number(e.target.value))}
            className="w-full text-xs font-bold p-1.5 border rounded bg-slate-50 text-violet-800"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'مقياس القلق العام (GAD-7: 0-21)' : 'GAD-7 Anxiety (0-21)'}
          </label>
          <input
            type="number"
            min={0}
            max={21}
            disabled={readOnly}
            value={data.gad7Score ?? 0}
            onChange={e => update('gad7Score', Number(e.target.value))}
            className="w-full text-xs font-bold p-1.5 border rounded bg-slate-50 text-violet-800"
          />
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-[11px] font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'تقييم خطورة الإيذاء الذاتي' : 'Risk Assessment'}
          </label>
          <select
            disabled={readOnly}
            value={data.suicideRisk || 'none_low'}
            onChange={e => update('suicideRisk', e.target.value)}
            className={`w-full text-xs p-1.5 border rounded font-bold ${
              data.suicideRisk === 'high_imminent' ? 'bg-rose-100 text-rose-800 border-rose-300' :
              data.suicideRisk === 'moderate' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-50 text-slate-800'
            }`}
          >
            <option value="none_low">{locale === 'ar' ? 'منخفض / لا يوجد خطر (Low/None)' : 'Low / None'}</option>
            <option value="moderate">{locale === 'ar' ? 'متوسط - أفكار دون خطة (Moderate)' : 'Moderate Risk'}</option>
            <option value="high_imminent">{locale === 'ar' ? 'مرتفع جداً وطارئ (High / Imminent Alert)' : 'High / Imminent Alert'}</option>
          </select>
        </div>
      </div>

      {/* Psychiatric Notes */}
      <div className="p-3 bg-white rounded-xl border border-slate-200">
        <label className="block text-[11px] font-bold text-slate-700 mb-1">
          {locale === 'ar' ? 'الخطة العلاجية والدوائية (Pharmacotherapy & Psychotherapy)' : 'Treatment & Psychotherapy Plan'}
        </label>
        <input
          type="text"
          disabled={readOnly}
          value={data.psychNotes || ''}
          onChange={e => update('psychNotes', e.target.value)}
          placeholder={locale === 'ar' ? 'التشخيص وفق DSM-5/ICD-11، العلاج الدوائي، وجلسات العلاج السلوكي المعرفي CBT...' : 'Diagnosis, medication regimen, CBT schedule...'}
          className="w-full text-xs p-2 border rounded-lg bg-slate-50"
        />
      </div>
    </div>
  );
};
