// ============================================================================
// MEDICORE – Interactive Dermatology Body Map
// Lesion Mapping with Symptoms, Color, Size & Distribution
// ============================================================================

import React, { useState } from 'react';
import { AnatomyCanvasWrapper } from './AnatomyCanvasWrapper';
import { DermaFinding, DermaLesionType } from '../../types/specialty';
import { useLanguage } from '../../context/LanguageContext';
import { Sparkles, X, Plus } from 'lucide-react';

interface DermatomeMapProps {
  findings: DermaFinding[];
  onChange: (findings: DermaFinding[]) => void;
  readOnly?: boolean;
}

export const DermatomeMap: React.FC<DermatomeMapProps> = ({
  findings,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();
  const [view, setView] = useState<'anterior' | 'posterior'>('anterior');
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);

  // Modal form states
  const [lesionType, setLesionType] = useState<DermaLesionType>('papule');
  const [sizeMm, setSizeMm] = useState<number>(5);
  const [colorHex, setColorHex] = useState<string>('#DC2626');
  const [symmetry, setSymmetry] = useState<'symmetric' | 'asymmetric'>('symmetric');
  const [border, setBorder] = useState<'regular' | 'irregular'>('regular');
  const [symptoms, setSymptoms] = useState<('itching' | 'bleeding' | 'pain' | 'asymptomatic')[]>(['itching']);
  const [notes, setNotes] = useState('');

  const currentFindings = findings.filter(f => f.view === view);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    setPendingCoords({ x, y });
    setLesionType('papule');
    setSizeMm(5);
    setColorHex('#DC2626');
    setSymptoms(['itching']);
    setNotes('');
  };

  const handleSaveLesion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingCoords) return;

    const newFinding: DermaFinding = {
      id: `derma-${Date.now()}`,
      view,
      x: pendingCoords.x,
      y: pendingCoords.y,
      lesionType,
      sizeMm,
      colorHex,
      symmetry,
      border,
      symptoms,
      clinicalNotes: notes,
    };

    onChange([...findings, newFinding]);
    setPendingCoords(null);
  };

  const handleDelete = (id: string) => {
    onChange(findings.filter(f => f.id !== id));
  };

  const toggleSymptom = (sym: 'itching' | 'bleeding' | 'pain' | 'asymptomatic') => {
    setSymptoms(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  return (
    <div className="space-y-4">
      <AnatomyCanvasWrapper
        title={locale === 'ar' ? 'خريطة الجلد والجسم السريرية' : 'Clinical Dermatology Body Map'}
        subtitle={locale === 'ar' ? 'اضغط مباشرة على سطح الجسم لتحديد مكان الآفة، الحجم بالملليمتر والأعراض' : 'Click directly on the body surface to map lesions, size, and symptoms'}
        canUndo={findings.length > 0 && !readOnly}
        onUndo={!readOnly ? () => onChange(findings.slice(0, -1)) : undefined}
        onClear={!readOnly && findings.length > 0 ? () => onChange([]) : undefined}
        extraControls={
          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setView('anterior')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                view === 'anterior'
                  ? 'bg-white text-medicore-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {locale === 'ar' ? 'منظر أمامي' : 'Anterior'}
            </button>
            <button
              type="button"
              onClick={() => setView('posterior')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                view === 'posterior'
                  ? 'bg-white text-medicore-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {locale === 'ar' ? 'منظر خلفي' : 'Posterior'}
            </button>
          </div>
        }
      >
        {() => (
          <div
            onClick={handleCanvasClick}
            className="relative w-[320px] h-[520px] mx-auto select-none cursor-crosshair"
          >
            {/* Body Silhouette SVG */}
            <svg
              viewBox="0 0 320 520"
              className="w-full h-full drop-shadow-md"
              fill="none"
              stroke="currentColor"
            >
              {/* Head */}
              <ellipse cx="160" cy="45" rx="28" ry="34" className="fill-slate-100 stroke-slate-400 stroke-2" />
              {/* Neck */}
              <rect x="150" y="76" width="20" height="20" className="fill-slate-100 stroke-slate-400 stroke-2" />
              {/* Torso */}
              <path
                d="M 120 96 C 110 140, 115 220, 125 250 C 135 255, 185 255, 195 250 C 205 220, 210 140, 200 96 Z"
                className="fill-slate-100 stroke-slate-400 stroke-2"
              />
              {/* Arms */}
              <path d="M 120 96 C 90 140, 70 200, 60 260 C 55 270, 70 275, 75 265 C 85 210, 105 160, 125 125 Z" className="fill-slate-100 stroke-slate-400 stroke-2" />
              <path d="M 200 96 C 230 140, 250 200, 260 260 C 265 270, 250 275, 245 265 C 235 210, 215 160, 195 125 Z" className="fill-slate-100 stroke-slate-400 stroke-2" />
              {/* Legs */}
              <path d="M 128 250 C 120 330, 125 420, 120 480 C 115 490, 140 495, 145 480 C 150 420, 155 330, 158 255 Z" className="fill-slate-100 stroke-slate-400 stroke-2" />
              <path d="M 192 250 C 200 330, 195 420, 200 480 C 205 490, 180 495, 175 480 C 170 420, 165 330, 162 255 Z" className="fill-slate-100 stroke-slate-400 stroke-2" />
            </svg>

            {/* Placed Lesions */}
            {currentFindings.map(f => (
              <div
                key={f.id}
                style={{ left: `${f.x}%`, top: `${f.y}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
              >
                <div
                  style={{ backgroundColor: f.colorHex }}
                  className="w-5 h-5 rounded-full border-2 border-white shadow-md flex items-center justify-center font-bold text-[9px] text-white"
                >
                  {f.sizeMm}
                </div>

                {/* Tooltip Card */}
                <div className="hidden group-hover:block absolute bottom-7 start-1/2 -translate-x-1/2 w-48 bg-slate-900 text-white text-xs rounded-xl p-2.5 shadow-xl z-30 pointer-events-auto">
                  <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-700">
                    <span className="font-bold text-amber-400 uppercase">{f.lesionType}</span>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDelete(f.id); }}
                        className="text-slate-400 hover:text-rose-400"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-slate-200">{locale === 'ar' ? `القطر: ${f.sizeMm} ملم` : `Size: ${f.sizeMm} mm`}</p>
                  <p className="text-slate-400 text-[11px]">{f.clinicalNotes || f.symptoms.join(', ')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </AnatomyCanvasWrapper>

      {/* Lesion Modal */}
      {pendingCoords && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-medicore-600" />
                <h3 className="font-bold text-slate-800 text-base">
                  {locale === 'ar' ? 'توثيق آفة جلدية جديدة' : 'Document Dermatological Lesion'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPendingCoords(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLesion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {locale === 'ar' ? 'النوع الإكلينيكي للآفة (Lesion Morphology)' : 'Lesion Type'}
                </label>
                <select
                  value={lesionType}
                  onChange={e => setLesionType(e.target.value as DermaLesionType)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                >
                  <option value="macule">{locale === 'ar' ? 'بقعة مسطحة (Macule / Patch)' : 'Macule'}</option>
                  <option value="papule">{locale === 'ar' ? 'حطاطة بارزة (Papule)' : 'Papule'}</option>
                  <option value="plaque">{locale === 'ar' ? 'لويحة صدفية/جلدية (Plaque)' : 'Plaque'}</option>
                  <option value="nodule">{locale === 'ar' ? 'عقدة عميقة (Nodule)' : 'Nodule'}</option>
                  <option value="vesicle_bulla">{locale === 'ar' ? 'حويصلة سائلة (Vesicle / Bulla)' : 'Vesicle'}</option>
                  <option value="pustule">{locale === 'ar' ? 'بثرة صديدية (Pustule)' : 'Pustule'}</option>
                  <option value="ulcer">{locale === 'ar' ? 'قرحة جلدية (Ulcer)' : 'Ulcer'}</option>
                  <option value="biopsy_site">{locale === 'ar' ? 'موضع أخذ خزعة (Biopsy Site)' : 'Biopsy Site'}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {locale === 'ar' ? 'الحجم بالملليمتر (mm)' : 'Size (mm)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={sizeMm}
                    onChange={e => setSizeMm(Number(e.target.value))}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {locale === 'ar' ? 'لون الآفة' : 'Lesion Color'}
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="color"
                      value={colorHex}
                      onChange={e => setColorHex(e.target.value)}
                      className="w-10 h-9 p-0.5 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <span className="text-xs font-mono text-slate-600">{colorHex}</span>
                  </div>
                </div>
              </div>

              {/* Symptoms */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {locale === 'ar' ? 'الأعراض المصاحبة' : 'Associated Symptoms'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'itching', ar: 'حكة', en: 'Itching' },
                    { id: 'pain', ar: 'ألم موضعي', en: 'Pain' },
                    { id: 'bleeding', ar: 'نزيف', en: 'Bleeding' },
                    { id: 'asymptomatic', ar: 'بدون أعراض', en: 'Asymptomatic' },
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSymptom(s.id as any)}
                      className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all ${
                        symptoms.includes(s.id as any)
                          ? 'bg-medicore-600 text-white border-medicore-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {locale === 'ar' ? s.ar : s.en}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'ملاحظات الفحص' : 'Clinical Notes'}
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={locale === 'ar' ? 'التوزيع، الحواف، تطور الحالة...' : 'Border, elevation, evolution...'}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingCoords(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {locale === 'ar' ? 'تثبيت الآفة على الخريطة' : 'Record Lesion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
