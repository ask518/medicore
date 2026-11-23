// ============================================================================
// MEDICORE – Gastroenterology Clinical Examination & Abdominal Visualizer
// Section 11 Implementation: 9 Abdominal Quadrants, Signs & Bristol Stool Scale
// ============================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Compass, CheckSquare, Square, AlertCircle, Layers } from 'lucide-react';

export interface GastroData {
  painQuadrants: string[];
  tenderness: boolean;
  reboundTenderness: boolean;
  guarding: boolean;
  murphySign: boolean;
  hepatomegaly: boolean;
  splenomegaly: boolean;
  ascites: boolean;
  bristolScale: number;
  bowelSounds: string;
  endoscopyReport: string;
  notes: string;
}

export type GastroenterologyData = GastroData;

interface GastroModuleProps {
  data: GastroData;
  onChange: (data: GastroData) => void;
  readOnly?: boolean;
}

export const GastroenterologyModule: React.FC<GastroModuleProps> = ({
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const update = (field: keyof GastroData, val: any) => {
    if (readOnly) return;
    onChange({ ...data, [field]: val });
  };

  const toggleQuadrant = (quadId: string) => {
    if (readOnly) return;
    const current = data.painQuadrants || [];
    if (current.includes(quadId)) {
      update('painQuadrants', current.filter(q => q !== quadId));
    } else {
      update('painQuadrants', [...current, quadId]);
    }
  };

  const quadrants = [
    { id: 'ruq', name_ar: 'الربع العلوي الأيمن (RUQ)', name_en: 'Right Upper Quadrant (Liver/Gallbladder)' },
    { id: 'epigastric', name_ar: 'المنطقة الشرسوفية فم المعدة', name_en: 'Epigastric (Stomach/Pancreas)' },
    { id: 'luq', name_ar: 'الربع العلوي الأيسر (LUQ)', name_en: 'Left Upper Quadrant (Spleen/Stomach)' },
    { id: 'r_flank', name_ar: 'الخاصرة اليمنى (Right Lumbar)', name_en: 'Right Flank (Ascending Colon/Kidney)' },
    { id: 'umbilical', name_ar: 'حول السرة (Umbilical)', name_en: 'Umbilical (Small Intestine/Aorta)' },
    { id: 'l_flank', name_ar: 'الخاصرة اليسرى (Left Lumbar)', name_en: 'Left Flank (Descending Colon/Kidney)' },
    { id: 'rlq', name_ar: 'الربع السفلي الأيمن (RLQ - الزائدة)', name_en: 'Right Lower Quadrant (Appendix/Cecum)' },
    { id: 'suprapubic', name_ar: 'فوق العانة (Suprapubic)', name_en: 'Suprapubic (Bladder/Uterus)' },
    { id: 'llq', name_ar: 'الربع السفلي الأيسر (LLQ)', name_en: 'Left Lower Quadrant (Sigmoid Colon)' }
  ];

  return (
    <div className="space-y-4 p-4 rounded-2xl bg-gradient-to-br from-amber-50/40 via-white to-slate-50 border border-amber-200/60">
      <div className="flex items-center justify-between pb-2 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-slate-900">
              {locale === 'ar' ? 'فحص الجهاز الهضمي والبطن التفاعلي (Gastroenterology)' : 'Gastroenterology & Abdominal Examination'}
            </h4>
            <p className="text-[10px] text-slate-500">
              {locale === 'ar' ? 'تحديد مواضع الألم في مناطق البطن التسع، علامات الالتهاب ومقياس بريستول' : '9 Abdominal quadrants pain mapping, peritoneal signs & Bristol scale'}
            </p>
          </div>
        </div>

        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900">
          {(data.painQuadrants || []).length} {locale === 'ar' ? 'مواضع ألم' : 'Pain Sites'}
        </span>
      </div>

      {/* 9 Abdominal Quadrants Grid */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">
          {locale === 'ar' ? 'مخطط مناطق البطن التسع (انقر لتحديد موضع الألم/الانتفاخ):' : '9-Region Abdominal Map (Click to toggle pain location):'}
        </label>
        <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto bg-slate-100 p-2.5 rounded-2xl border border-slate-200">
          {quadrants.map(q => {
            const isSelected = (data.painQuadrants || []).includes(q.id);
            return (
              <button
                key={q.id}
                type="button"
                disabled={readOnly}
                onClick={() => toggleQuadrant(q.id)}
                className={`p-3 rounded-xl text-xs font-bold text-center transition-all border ${
                  isSelected 
                    ? 'bg-rose-500 text-white border-rose-600 shadow-md scale-98' 
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                <div>{q[locale === 'ar' ? 'name_ar' : 'name_en']}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Clinical Signs Checklist */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
        {[
          { key: 'tenderness', label_ar: 'ألم عند الضغط (Tenderness)' },
          { key: 'reboundTenderness', label_ar: 'ألم ارتدادي (Rebound Sign)' },
          { key: 'guarding', label_ar: 'تصلب لاإرادي (Guarding)' },
          { key: 'murphySign', label_ar: 'علامة مورفي (Murphy Sign)' },
          { key: 'hepatomegaly', label_ar: 'تضخم الكبد (Hepatomegaly)' },
          { key: 'splenomegaly', label_ar: 'تضخم الطحال (Splenomegaly)' },
          { key: 'ascites', label_ar: 'استسقاء البطن (Ascites)' },
        ].map(item => {
          const isChecked = Boolean((data as any)[item.key]);
          return (
            <button
              key={item.key}
              type="button"
              disabled={readOnly}
              onClick={() => update(item.key as keyof GastroData, !isChecked)}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-2 border text-start transition-all ${
                isChecked ? 'bg-amber-100/70 border-amber-300 text-amber-900' : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              {isChecked ? <CheckSquare className="w-3.5 h-3.5 text-amber-700" /> : <Square className="w-3.5 h-3.5 text-slate-300" />}
              <span className="truncate">{item.label_ar}</span>
            </button>
          );
        })}
      </div>

      {/* Bristol Stool Scale & Endoscopy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'مقياس بريستول لقوام البراز (Bristol Stool Scale 1-7)' : 'Bristol Stool Scale'}
          </label>
          <select
            disabled={readOnly}
            value={data.bristolScale || 4}
            onChange={e => update('bristolScale', Number(e.target.value))}
            className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 bg-white"
          >
            <option value={1}>Type 1: كتل صلبة منفصلة (إمساك شديد)</option>
            <option value={2}>Type 2: متكتل يشبه السجق (إمساك خفيف)</option>
            <option value={3}>Type 3: يشبه السجق مع شقوق بالسطح (طبيعي)</option>
            <option value={4}>Type 4: أملس وناعم كالثعبان (مثالي)</option>
            <option value={5}>Type 5: بقع ناعمة ذات حواف واضحة</option>
            <option value={6}>Type 6: قطع رغوية رخوة مع حواف متعرجة (إسهال خفيف)</option>
            <option value={7}>Type 7: مائي بالكامل بدون قطع صلبة (إسهال شديد)</option>
          </select>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            {locale === 'ar' ? 'تقرير المناظير (Gastroscopy / Colonoscopy)' : 'Endoscopy Findings'}
          </label>
          <input
            type="text"
            disabled={readOnly}
            value={data.endoscopyReport || ''}
            onChange={e => update('endoscopyReport', e.target.value)}
            placeholder="مثال: Antral gastritis, H. Pylori +, No ulcers"
            className="w-full text-xs rounded-xl border border-slate-200 p-2 focus:border-amber-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
