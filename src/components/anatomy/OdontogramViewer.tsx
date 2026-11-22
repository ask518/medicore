// ============================================================================
// MEDICORE – Interactive Dental Odontogram (FDI 2-Digit Tooth Numbering)
// Adult Permanent (32) & Pediatric Primary (20) Teeth with Clinical Conditions
// ============================================================================

import React, { useState } from 'react';
import { AnatomyCanvasWrapper } from './AnatomyCanvasWrapper';
import { DentalCondition, ToothRecord, ToothSurface } from '../../types/specialty';
import { useLanguage } from '../../context/LanguageContext';
import { Smile, X, Check, DollarSign } from 'lucide-react';

interface OdontogramViewerProps {
  records: Record<number, ToothRecord>;
  onChange: (records: Record<number, ToothRecord>) => void;
  readOnly?: boolean;
}

// FDI Quadrants
const ADULT_UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const ADULT_UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const ADULT_LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

const PEDO_UPPER_RIGHT = [55, 54, 53, 52, 51];
const PEDO_UPPER_LEFT = [61, 62, 63, 64, 65];
const PEDO_LOWER_RIGHT = [85, 84, 83, 82, 81];
const PEDO_LOWER_LEFT = [71, 72, 73, 74, 75];

export const OdontogramViewer: React.FC<OdontogramViewerProps> = ({
  records,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();
  const [dentitionType, setDentitionType] = useState<'adult' | 'pediatric'>('adult');
  const [activeTooth, setActiveTooth] = useState<number | null>(null);

  // Edit state for modal
  const [condition, setCondition] = useState<DentalCondition>('sound');
  const [surfaces, setSurfaces] = useState<ToothSurface[]>([]);
  const [notes, setNotes] = useState('');
  const [cost, setCost] = useState<number>(0);
  const [completed, setCompleted] = useState<boolean>(false);

  const handleToothClick = (toothNumber: number) => {
    if (readOnly) return;
    setActiveTooth(toothNumber);
    const existing = records[toothNumber];
    if (existing) {
      setCondition(existing.condition);
      setSurfaces(existing.surfaces || []);
      setNotes(existing.notes || '');
      setCost(existing.cost || 0);
      setCompleted(existing.completed || false);
    } else {
      setCondition('caries');
      setSurfaces(['O']);
      setNotes('');
      setCost(300);
      setCompleted(false);
    }
  };

  const handleSaveTooth = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTooth === null) return;

    const updated: ToothRecord = {
      toothNumber: activeTooth,
      condition,
      surfaces,
      notes,
      cost,
      completed,
    };

    onChange({
      ...records,
      [activeTooth]: updated,
    });
    setActiveTooth(null);
  };

  const toggleSurface = (s: ToothSurface) => {
    setSurfaces(prev => 
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const getConditionColor = (cond: DentalCondition) => {
    switch (cond) {
      case 'caries': return 'bg-rose-500 text-white border-rose-600';
      case 'composite_filling': return 'bg-sky-500 text-white border-sky-600';
      case 'amalgam_filling': return 'bg-slate-600 text-white border-slate-700';
      case 'crown': return 'bg-amber-400 text-amber-950 border-amber-500 font-bold';
      case 'root_canal': return 'bg-purple-600 text-white border-purple-700';
      case 'implant': return 'bg-emerald-600 text-white border-emerald-700';
      case 'missing': return 'bg-slate-200 text-slate-400 line-through border-slate-300';
      case 'extraction_indicated': return 'bg-rose-100 text-rose-800 border-dashed border-rose-500';
      default: return 'bg-white text-slate-700 border-slate-300 hover:border-medicore-500';
    }
  };

  const renderToothBox = (toothNumber: number) => {
    const rec = records[toothNumber];
    const cond = rec?.condition || 'sound';
    const isSpecial = cond !== 'sound';

    return (
      <button
        key={toothNumber}
        type="button"
        onClick={() => handleToothClick(toothNumber)}
        className={`w-9 h-14 rounded-lg border-2 flex flex-col items-center justify-between p-1 transition-all ${
          getConditionColor(cond)
        } ${!readOnly ? 'hover:scale-105 cursor-pointer shadow-xs' : ''}`}
        title={`Tooth ${toothNumber}: ${cond}`}
      >
        <span className="text-[10px] font-bold">{toothNumber}</span>
        
        {/* Visual tooth surfaces indicator */}
        <div className="w-5 h-5 relative border border-current rounded-xs my-auto flex items-center justify-center">
          {rec?.surfaces?.includes('O') && <div className="w-2 h-2 bg-current rounded-full" />}
          {isSpecial && <span className="text-[8px] font-extrabold uppercase">{cond.slice(0, 2)}</span>}
        </div>

        {rec?.completed ? (
          <Check className="w-2.5 h-2.5 text-emerald-600" />
        ) : (
          <span className="text-[9px] opacity-70">{rec?.surfaces?.join('') || '-'}</span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <AnatomyCanvasWrapper
        title={locale === 'ar' ? 'مخطط الأسنان التفاعلي (FDI Odontogram)' : 'Interactive FDI Dental Odontogram'}
        subtitle={locale === 'ar' ? 'نظام ترقيم الأسنان العالمي FDI للبالغين والأطفال مع توثيق الحشو والتاج والخلع والعصب' : 'FDI 2-digit tooth chart with surface mapping, caries, endo, crowns, and implants'}
        canUndo={false}
        extraControls={
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setDentitionType('adult')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                dentitionType === 'adult'
                  ? 'bg-white text-medicore-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {locale === 'ar' ? 'أسنان البالغين الدائمة (32)' : 'Adult (Permanent)'}
            </button>
            <button
              type="button"
              onClick={() => setDentitionType('pediatric')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                dentitionType === 'pediatric'
                  ? 'bg-white text-medicore-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {locale === 'ar' ? 'أسنان الأطفال اللبنية (20)' : 'Pediatric (Deciduous)'}
            </button>
          </div>
        }
      >
        {() => (
          <div className="w-full max-w-2xl mx-auto p-4 flex flex-col items-center justify-center space-y-6">
            {/* Upper Jaw (Maxilla) */}
            <div className="w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-center font-bold text-xs text-slate-500 mb-2 uppercase tracking-wide">
                {locale === 'ar' ? 'الفك العلوي (Maxilla - Upper Jaw)' : 'Maxilla (Upper Jaw)'}
              </div>
              <div className="flex items-center justify-center gap-6">
                {/* Upper Right Quadrant (Q1 or Q5) */}
                <div className="flex items-center gap-1.5">
                  {(dentitionType === 'adult' ? ADULT_UPPER_RIGHT : PEDO_UPPER_RIGHT).map(renderToothBox)}
                </div>
                {/* Center Midline */}
                <div className="w-0.5 h-16 bg-rose-400" title="Midline" />
                {/* Upper Left Quadrant (Q2 or Q6) */}
                <div className="flex items-center gap-1.5">
                  {(dentitionType === 'adult' ? ADULT_UPPER_LEFT : PEDO_UPPER_LEFT).map(renderToothBox)}
                </div>
              </div>
            </div>

            {/* Dental Arch Color Legend */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/70 p-2.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-500" /> {locale === 'ar' ? 'تسوس (Caries)' : 'Caries'}</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-sky-500" /> {locale === 'ar' ? 'حشو كمبوزيت' : 'Composite'}</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-600" /> {locale === 'ar' ? 'حشو أملجم' : 'Amalgam'}</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400" /> {locale === 'ar' ? 'تاج / طربوش (Crown)' : 'Crown'}</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-600" /> {locale === 'ar' ? 'علاج عصب (Root Canal)' : 'Endo'}</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-600" /> {locale === 'ar' ? 'زراعة (Implant)' : 'Implant'}</div>
              <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-300" /> {locale === 'ar' ? 'مفقود (Missing)' : 'Missing'}</div>
            </div>

            {/* Lower Jaw (Mandible) */}
            <div className="w-full bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-center gap-6 mb-2">
                {/* Lower Right Quadrant (Q4 or Q8) */}
                <div className="flex items-center gap-1.5">
                  {(dentitionType === 'adult' ? ADULT_LOWER_RIGHT : PEDO_LOWER_RIGHT).map(renderToothBox)}
                </div>
                {/* Center Midline */}
                <div className="w-0.5 h-16 bg-rose-400" title="Midline" />
                {/* Lower Left Quadrant (Q3 or Q7) */}
                <div className="flex items-center gap-1.5">
                  {(dentitionType === 'adult' ? ADULT_LOWER_LEFT : PEDO_LOWER_LEFT).map(renderToothBox)}
                </div>
              </div>
              <div className="text-center font-bold text-xs text-slate-500 uppercase tracking-wide">
                {locale === 'ar' ? 'الفك السفلي (Mandible - Lower Jaw)' : 'Mandible (Lower Jaw)'}
              </div>
            </div>
          </div>
        )}
      </AnatomyCanvasWrapper>

      {/* Tooth Treatment Modal */}
      {activeTooth !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Smile className="w-5 h-5 text-medicore-600" />
                <h3 className="font-bold text-slate-800 text-base">
                  {locale === 'ar' ? `تشخيص وعلاج السن رقم (${activeTooth})` : `Tooth #${activeTooth} Clinical Diagnosis`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveTooth(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTooth} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {locale === 'ar' ? 'الحالة السريرية والإجراء المطلوب' : 'Tooth Clinical Condition'}
                </label>
                <select
                  value={condition}
                  onChange={e => setCondition(e.target.value as DentalCondition)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-medicore-500"
                >
                  <option value="sound">{locale === 'ar' ? 'سليم تماماً (Sound)' : 'Sound / Normal'}</option>
                  <option value="caries">{locale === 'ar' ? 'تسوس نخر (Caries)' : 'Caries'}</option>
                  <option value="composite_filling">{locale === 'ar' ? 'حشو تجميلي كمبوزيت (Composite Filling)' : 'Composite Filling'}</option>
                  <option value="amalgam_filling">{locale === 'ar' ? 'حشو أملجم فضي (Amalgam Filling)' : 'Amalgam Filling'}</option>
                  <option value="crown">{locale === 'ar' ? 'تاج / طربوش سيراميك أو زيركون (Crown)' : 'Crown / Cap'}</option>
                  <option value="root_canal">{locale === 'ar' ? 'علاج جذور وعصب (Root Canal Treatment)' : 'Root Canal (Endo)'}</option>
                  <option value="implant">{locale === 'ar' ? 'زراعة سن (Dental Implant)' : 'Dental Implant'}</option>
                  <option value="missing">{locale === 'ar' ? 'سن مفقود ومخلوع (Missing Tooth)' : 'Missing'}</option>
                  <option value="extraction_indicated">{locale === 'ar' ? 'يوصى بالخلع الجراحي (Extraction Indicated)' : 'Extraction Indicated'}</option>
                  <option value="fractured">{locale === 'ar' ? 'كسر في تاج السن (Fractured)' : 'Fractured Tooth'}</option>
                </select>
              </div>

              {/* Tooth Surfaces Checkboxes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {locale === 'ar' ? 'الأسطح المتأثرة (Tooth Surfaces)' : 'Tooth Surfaces'}
                </label>
                <div className="flex items-center gap-2">
                  {(['O', 'M', 'D', 'B', 'L'] as ToothSurface[]).map(s => {
                    const names = {
                      O: locale === 'ar' ? 'الإطباقي (O)' : 'Occlusal (O)',
                      M: locale === 'ar' ? 'الإنسي (M)' : 'Mesial (M)',
                      D: locale === 'ar' ? 'الوحشي (D)' : 'Distal (D)',
                      B: locale === 'ar' ? 'الخدي (B)' : 'Buccal (B)',
                      L: locale === 'ar' ? 'اللساني (L)' : 'Lingual (L)',
                    };
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSurface(s)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          surfaces.includes(s)
                            ? 'bg-medicore-600 text-white border-medicore-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cost & Completion */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {locale === 'ar' ? 'التكلفة التقديرية (ج.م)' : 'Estimated Cost (EGP)'}
                  </label>
                  <input
                    type="number"
                    value={cost}
                    onChange={e => setCost(Number(e.target.value))}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={e => setCompleted(e.target.checked)}
                      className="rounded text-medicore-600 focus:ring-medicore-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-slate-700">
                      {locale === 'ar' ? 'تم اكتمال الإجراء' : 'Procedure Done'}
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'ملاحظات الطبيب' : 'Clinical Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={locale === 'ar' ? 'ملاحظات حول عمق التسوس، الحشو أو القنوات...' : 'Notes about caries depth, canals...'}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTooth(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {locale === 'ar' ? 'حفظ السن' : 'Save Tooth'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
