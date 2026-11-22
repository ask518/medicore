// ============================================================================
// MEDICORE – Interactive Orthopedic Skeletal Anatomical Map
// High-Precision SVG Skeletal Engine with Anterior/Posterior Views & Findings
// ============================================================================

import React, { useState } from 'react';
import { AnatomyCanvasWrapper } from './AnatomyCanvasWrapper';
import { BoneRegionId, OrthoFindingType, OrthopedicFinding } from '../../types/specialty';
import { useLanguage } from '../../context/LanguageContext';
import { AlertCircle, Plus, X, Activity } from 'lucide-react';

interface SkeletonViewerProps {
  findings: OrthopedicFinding[];
  onChange: (findings: OrthopedicFinding[]) => void;
  readOnly?: boolean;
}

const BONE_REGIONS: Record<BoneRegionId, { name_ar: string; name_en: string; x: number; y: number }> = {
  skull: { name_ar: 'الجمجمة والفك (Skull & Mandible)', name_en: 'Skull & Mandible', x: 50, y: 8 },
  cervical_spine: { name_ar: 'الفقرات العنقية (Cervical Spine C1-C7)', name_en: 'Cervical Spine', x: 50, y: 15 },
  thoracic_spine: { name_ar: 'الفقرات الصدرية (Thoracic Spine T1-T12)', name_en: 'Thoracic Spine', x: 50, y: 26 },
  lumbar_spine: { name_ar: 'الفقرات القطنية (Lumbar Spine L1-L5)', name_en: 'Lumbar Spine', x: 50, y: 38 },
  sacrum_pelvis: { name_ar: 'عظام الحوض والعجز (Pelvis & Sacrum)', name_en: 'Pelvis & Sacrum', x: 50, y: 46 },
  clavicle_r: { name_ar: 'الترقوة اليمنى (Right Clavicle)', name_en: 'Right Clavicle', x: 38, y: 18 },
  clavicle_l: { name_ar: 'الترقوة اليسرى (Left Clavicle)', name_en: 'Left Clavicle', x: 62, y: 18 },
  scapula_r: { name_ar: 'لوح الكتف الأيمن (Right Scapula)', name_en: 'Right Scapula', x: 34, y: 22 },
  scapula_l: { name_ar: 'لوح الكتف الأيسر (Left Scapula)', name_en: 'Left Scapula', x: 66, y: 22 },
  shoulder_r: { name_ar: 'مفصل الكتف الأيمن (Right Shoulder)', name_en: 'Right Shoulder', x: 32, y: 20 },
  shoulder_l: { name_ar: 'مفصل الكتف الأيسر (Left Shoulder)', name_en: 'Left Shoulder', x: 68, y: 20 },
  humerus_r: { name_ar: 'عضد الطرف الأيمن (Right Humerus)', name_en: 'Right Humerus', x: 28, y: 28 },
  humerus_l: { name_ar: 'عضد الطرف الأيسر (Left Humerus)', name_en: 'Left Humerus', x: 72, y: 28 },
  elbow_r: { name_ar: 'مفصل الكوع الأيمن (Right Elbow)', name_en: 'Right Elbow', x: 26, y: 36 },
  elbow_l: { name_ar: 'مفصل الكوع الأيسر (Left Elbow)', name_en: 'Left Elbow', x: 74, y: 36 },
  radius_ulna_r: { name_ar: 'ساعد اليد اليمنى (Right Radius & Ulna)', name_en: 'Right Radius & Ulna', x: 22, y: 44 },
  radius_ulna_l: { name_ar: 'ساعد اليد اليسرى (Left Radius & Ulna)', name_en: 'Left Radius & Ulna', x: 78, y: 44 },
  wrist_hand_r: { name_ar: 'رسغ ومشط اليد اليمنى (Right Wrist & Hand)', name_en: 'Right Wrist & Hand', x: 18, y: 53 },
  wrist_hand_l: { name_ar: 'رسغ ومشط اليد اليسرى (Left Wrist & Hand)', name_en: 'Left Wrist & Hand', x: 82, y: 53 },
  hip_joint_r: { name_ar: 'مفصل الفخذ الأيمن (Right Hip Joint)', name_en: 'Right Hip Joint', x: 42, y: 48 },
  hip_joint_l: { name_ar: 'مفصل الفخذ الأيسر (Left Hip Joint)', name_en: 'Left Hip Joint', x: 58, y: 48 },
  femur_r: { name_ar: 'عظمة الفخذ اليمنى (Right Femur)', name_en: 'Right Femur', x: 41, y: 58 },
  femur_l: { name_ar: 'عظمة الفخذ اليسرى (Left Femur)', name_en: 'Left Femur', x: 59, y: 58 },
  knee_r: { name_ar: 'مفصل الركبة اليمنى (Right Knee)', name_en: 'Right Knee', x: 41, y: 69 },
  knee_l: { name_ar: 'مفصل الركبة اليسرى (Left Knee)', name_en: 'Left Knee', x: 59, y: 69 },
  tibia_fibula_r: { name_ar: 'ساق الرجل اليمنى (Right Tibia & Fibula)', name_en: 'Right Tibia & Fibula', x: 41, y: 79 },
  tibia_fibula_l: { name_ar: 'ساق الرجل اليسرى (Left Tibia & Fibula)', name_en: 'Left Tibia & Fibula', x: 59, y: 79 },
  ankle_foot_r: { name_ar: 'كاحل وقدم الرجل اليمنى (Right Ankle & Foot)', name_en: 'Right Ankle & Foot', x: 40, y: 92 },
  ankle_foot_l: { name_ar: 'كاحل وقدم الرجل اليسرى (Left Ankle & Foot)', name_en: 'Left Ankle & Foot', x: 60, y: 92 },
};

export const SkeletonViewer: React.FC<SkeletonViewerProps> = ({
  findings,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();
  const [view, setView] = useState<'anterior' | 'posterior'>('anterior');
  const [activeModalRegion, setActiveModalRegion] = useState<BoneRegionId | null>(null);

  // Modal Form State
  const [findingType, setFindingType] = useState<OrthoFindingType>('fracture_closed');
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate');
  const [painScale, setPainScale] = useState<number>(5);
  const [description, setDescription] = useState('');
  const [treatment, setTreatment] = useState('');

  const currentFindings = findings.filter(f => f.view === view);

  const handleRegionClick = (regionId: BoneRegionId) => {
    if (readOnly) return;
    setActiveModalRegion(regionId);
    setFindingType('fracture_closed');
    setSeverity('moderate');
    setPainScale(5);
    setDescription('');
    setTreatment('');
  };

  const handleSaveFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModalRegion) return;

    const coords = BONE_REGIONS[activeModalRegion];
    const newFinding: OrthopedicFinding = {
      id: `ortho-${Date.now()}`,
      regionId: activeModalRegion,
      view,
      x: coords.x,
      y: coords.y,
      findingType,
      severity,
      painScale,
      description: description || BONE_REGIONS[activeModalRegion][locale === 'ar' ? 'name_ar' : 'name_en'],
      treatmentRecommended: treatment,
    };

    onChange([...findings, newFinding]);
    setActiveModalRegion(null);
  };

  const handleDeleteFinding = (id: string) => {
    onChange(findings.filter(f => f.id !== id));
  };

  const handleUndo = () => {
    if (findings.length > 0) {
      onChange(findings.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (window.confirm(locale === 'ar' ? 'هل تريد مسح كافة علامات وإصابات الهيكل العظمي؟' : 'Clear all skeleton marks?')) {
      onChange([]);
    }
  };

  return (
    <div className="space-y-4">
      <AnatomyCanvasWrapper
        title={locale === 'ar' ? 'الهيكل العظمي التفاعلي لجراحة العظام' : 'Interactive Orthopedic Skeleton'}
        subtitle={locale === 'ar' ? 'اضغط على أي عظمة أو مفصل لإضافة وتسجيل كسر، خلع، أو التواء مع تحديد شدة الألم' : 'Click on any bone or joint to document fractures, dislocations, or sprains'}
        canUndo={findings.length > 0 && !readOnly}
        onUndo={!readOnly ? handleUndo : undefined}
        onClear={!readOnly && findings.length > 0 ? handleClear : undefined}
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
              {locale === 'ar' ? 'منظر أمامي (Front)' : 'Anterior'}
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
              {locale === 'ar' ? 'منظر خلفي (Back)' : 'Posterior'}
            </button>
          </div>
        }
      >
        {() => (
          <div className="relative w-[340px] h-[520px] mx-auto select-none">
            {/* Vector Human Skeleton Graphic */}
            <svg
              viewBox="0 0 340 520"
              className="w-full h-full drop-shadow-md"
              fill="none"
              stroke="currentColor"
            >
              {/* Skull */}
              <circle cx="170" cy="40" r="26" className="fill-slate-100 stroke-slate-400 stroke-2" />
              <rect x="156" y="58" width="28" height="18" rx="6" className="fill-slate-100 stroke-slate-400 stroke-2" />
              
              {/* Cervical & Spine */}
              <line x1="170" y1="76" x2="170" y2="105" className="stroke-slate-500 stroke-[5] stroke-linecap-round" />
              <line x1="170" y1="105" x2="170" y2="210" className="stroke-slate-500 stroke-[7] stroke-linecap-round" />
              
              {/* Clavicles */}
              <path d="M 125 105 Q 150 98 170 102 Q 190 98 215 105" className="stroke-slate-400 stroke-[4] fill-none" />

              {/* Ribcage */}
              <ellipse cx="170" cy="150" rx="44" ry="46" className="stroke-slate-300 stroke-2 fill-slate-100/50" />
              <path d="M 140 125 Q 170 135 200 125" className="stroke-slate-300 stroke-2 fill-none" />
              <path d="M 132 145 Q 170 155 208 145" className="stroke-slate-300 stroke-2 fill-none" />
              <path d="M 136 165 Q 170 175 204 165" className="stroke-slate-300 stroke-2 fill-none" />

              {/* Arms (Right: viewer left, Left: viewer right) */}
              {/* Right Upper Limb */}
              <line x1="125" y1="105" x2="100" y2="185" className="stroke-slate-400 stroke-[6] stroke-linecap-round" />
              <circle cx="100" cy="185" r="7" className="fill-slate-200 stroke-slate-400 stroke-2" />
              <line x1="97" y1="190" x2="72" y2="265" className="stroke-slate-400 stroke-[5] stroke-linecap-round" />
              <line x1="103" y1="190" x2="78" y2="265" className="stroke-slate-400 stroke-[4] stroke-linecap-round" />
              <circle cx="75" cy="275" r="9" className="fill-slate-200 stroke-slate-400 stroke-2" />

              {/* Left Upper Limb */}
              <line x1="215" y1="105" x2="240" y2="185" className="stroke-slate-400 stroke-[6] stroke-linecap-round" />
              <circle cx="240" cy="185" r="7" className="fill-slate-200 stroke-slate-400 stroke-2" />
              <line x1="237" y1="190" x2="262" y2="265" className="stroke-slate-400 stroke-[5] stroke-linecap-round" />
              <line x1="243" y1="190" x2="268" y2="265" className="stroke-slate-400 stroke-[4] stroke-linecap-round" />
              <circle cx="265" cy="275" r="9" className="fill-slate-200 stroke-slate-400 stroke-2" />

              {/* Pelvis */}
              <path d="M 130 215 C 135 255, 205 255, 210 215 C 220 225, 210 245, 170 255 C 130 245, 120 225, 130 215 Z" className="fill-slate-200 stroke-slate-400 stroke-2" />

              {/* Legs */}
              {/* Right Lower Limb */}
              <line x1="145" y1="250" x2="140" y2="355" className="stroke-slate-400 stroke-[8] stroke-linecap-round" />
              <circle cx="140" cy="358" r="8" className="fill-slate-300 stroke-slate-500 stroke-2" />
              <line x1="138" y1="365" x2="136" y2="470" className="stroke-slate-400 stroke-[6] stroke-linecap-round" />
              <line x1="144" y1="365" x2="142" y2="470" className="stroke-slate-400 stroke-[4] stroke-linecap-round" />
              <ellipse cx="134" cy="485" rx="14" ry="7" className="fill-slate-200 stroke-slate-400 stroke-2" />

              {/* Left Lower Limb */}
              <line x1="195" y1="250" x2="200" y2="355" className="stroke-slate-400 stroke-[8] stroke-linecap-round" />
              <circle cx="200" cy="358" r="8" className="fill-slate-300 stroke-slate-500 stroke-2" />
              <line x1="198" y1="365" x2="196" y2="470" className="stroke-slate-400 stroke-[6] stroke-linecap-round" />
              <line x1="204" y1="365" x2="202" y2="470" className="stroke-slate-400 stroke-[4] stroke-linecap-round" />
              <ellipse cx="206" cy="485" rx="14" ry="7" className="fill-slate-200 stroke-slate-400 stroke-2" />
            </svg>

            {/* Clickable Hotspots overlay */}
            {!readOnly && Object.entries(BONE_REGIONS).map(([key, region]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleRegionClick(key as BoneRegionId)}
                title={region[locale === 'ar' ? 'name_ar' : 'name_en']}
                style={{ left: `${region.x}%`, top: `${region.y}%` }}
                className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-medicore-500/10 hover:bg-medicore-500/40 hover:scale-125 border border-medicore-400/30 transition-all flex items-center justify-center cursor-pointer group"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-medicore-600 opacity-60 group-hover:opacity-100" />
              </button>
            ))}

            {/* Rendered Findings on Canvas */}
            {currentFindings.map(finding => {
              const severityColors = {
                mild: 'bg-amber-500 border-amber-200 text-white',
                moderate: 'bg-orange-500 border-orange-200 text-white',
                severe: 'bg-rose-600 border-rose-200 text-white',
              };

              return (
                <div
                  key={finding.id}
                  style={{ left: `${finding.x}%`, top: `${finding.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 animate-pulse ${severityColors[finding.severity]}`}>
                    {finding.painScale}
                  </div>

                  {/* Tooltip Card */}
                  <div className="hidden group-hover:block absolute bottom-8 start-1/2 -translate-x-1/2 w-52 bg-slate-900 text-white text-xs rounded-xl p-2.5 shadow-xl z-30 pointer-events-auto">
                    <div className="flex items-start justify-between gap-1 mb-1 border-b border-slate-700 pb-1">
                      <span className="font-bold text-amber-400">
                        {BONE_REGIONS[finding.regionId][locale === 'ar' ? 'name_ar' : 'name_en']}
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleDeleteFinding(finding.id)}
                          className="text-slate-400 hover:text-rose-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-slate-200 font-medium">{finding.description}</p>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{locale === 'ar' ? `الألم: ${finding.painScale}/10` : `Pain: ${finding.painScale}/10`}</span>
                      <span className="uppercase">{finding.findingType.replace('_', ' ')}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AnatomyCanvasWrapper>

      {/* Findings List Summary */}
      {findings.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
          <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-medicore-600" />
            {locale === 'ar' ? 'سجل الإصابات والملاحظات المسجلة بالهيكل العظمي:' : 'Documented Skeletal Findings:'}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {findings.map((f, i) => (
              <div key={f.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-medicore-100 text-medicore-700 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <span className="font-bold text-sm text-slate-800">
                      {BONE_REGIONS[f.regionId][locale === 'ar' ? 'name_ar' : 'name_en']}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-medium">
                      {locale === 'ar' ? `مقياس الألم: ${f.painScale}/10` : `Pain: ${f.painScale}/10`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 pe-2">{f.description}</p>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFinding(f.id)}
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clinical Finding Documentation Modal */}
      {activeModalRegion && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-medicore-600" />
                <h3 className="font-bold text-slate-800 text-base">
                  {locale === 'ar' ? 'توثيق إصابة سريرية' : 'Document Clinical Finding'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalRegion(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFinding} className="space-y-4">
              <div className="bg-medicore-50/70 p-3 rounded-xl border border-medicore-100">
                <p className="text-xs text-medicore-600 font-semibold mb-0.5">
                  {locale === 'ar' ? 'الموقع التشريحي المحدد:' : 'Selected Bone / Joint:'}
                </p>
                <p className="font-bold text-slate-800 text-sm">
                  {BONE_REGIONS[activeModalRegion][locale === 'ar' ? 'name_ar' : 'name_en']}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {locale === 'ar' ? 'نوع الإصابة أو التشخيص السريري' : 'Finding / Pathology Type'}
                </label>
                <select
                  value={findingType}
                  onChange={e => setFindingType(e.target.value as OrthoFindingType)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white focus:ring-2 focus:ring-medicore-500"
                >
                  <option value="fracture_closed">{locale === 'ar' ? 'كسر مغلق (Closed Fracture)' : 'Closed Fracture'}</option>
                  <option value="fracture_open">{locale === 'ar' ? 'كسر مضاعف مفتوح (Open/Compound Fracture)' : 'Open Fracture'}</option>
                  <option value="dislocation">{locale === 'ar' ? 'خلع مفصلي (Dislocation / Subluxation)' : 'Dislocation'}</option>
                  <option value="sprain_strain">{locale === 'ar' ? 'التواء / تمزق أربطة أو غضروف هلالي (Sprain/Meniscus)' : 'Sprain / Ligament Tear'}</option>
                  <option value="osteoarthritis">{locale === 'ar' ? 'خشونة وتآكل مفصلي (Osteoarthritis)' : 'Osteoarthritis'}</option>
                  <option value="tendon_tear">{locale === 'ar' ? 'التهاب أو تمزق أوتار (Tendon Tear / Tendinitis)' : 'Tendon Injury'}</option>
                  <option value="post_operative_hardware">{locale === 'ar' ? 'تثبيت جراحي سابق / شرائح ومسامير (Hardware)' : 'Post-Op Hardware'}</option>
                  <option value="point_tenderness">{locale === 'ar' ? 'نقطة ألم حادة وموضعية (Point Tenderness)' : 'Point Tenderness'}</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {locale === 'ar' ? 'الشدة السريرية' : 'Severity'}
                  </label>
                  <select
                    value={severity}
                    onChange={e => setSeverity(e.target.value as 'mild' | 'moderate' | 'severe')}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5 bg-white"
                  >
                    <option value="mild">{locale === 'ar' ? 'بسيط (Mild)' : 'Mild'}</option>
                    <option value="moderate">{locale === 'ar' ? 'متوسط (Moderate)' : 'Moderate'}</option>
                    <option value="severe">{locale === 'ar' ? 'شديد / حاد (Severe)' : 'Severe'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {locale === 'ar' ? `مقياس الألم (${painScale}/10)` : `Pain Scale (${painScale}/10)`}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={painScale}
                    onChange={e => setPainScale(Number(e.target.value))}
                    className="w-full accent-medicore-600 mt-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'الملاحظات السريرية والتوصيف' : 'Clinical Notes & Description'}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={locale === 'ar' ? 'مثال: اشتباه تمزق بالغضروف الداخلي مع ارتشاح...' : 'e.g., Suspected medial meniscus tear...'}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:ring-2 focus:ring-medicore-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveModalRegion(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl shadow-xs"
                >
                  {locale === 'ar' ? 'تثبيت الإصابة على المخطط' : 'Record Finding'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
