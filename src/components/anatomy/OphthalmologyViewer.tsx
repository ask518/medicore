// ============================================================================
// MEDICORE – Interactive Ophthalmology Examination Component
// Visual Acuity, Tonometry (IOP), Refraction & Anterior/Posterior Eye Diagram
// ============================================================================

import React from 'react';
import { EyeExaminationData } from '../../types/specialty';
import { useLanguage } from '../../context/LanguageContext';
import { Eye, Activity } from 'lucide-react';

interface OphthalmologyViewerProps {
  data: EyeExaminationData;
  onChange: (data: EyeExaminationData) => void;
  readOnly?: boolean;
}

export const OphthalmologyViewer: React.FC<OphthalmologyViewerProps> = ({
  data,
  onChange,
  readOnly = false,
}) => {
  const { locale } = useLanguage();

  const handleUpdate = (path: string, val: any) => {
    if (readOnly) return;
    const clone = JSON.parse(JSON.stringify(data));
    const parts = path.split('.');
    if (parts.length === 1) {
      clone[parts[0]] = val;
    } else if (parts.length === 2) {
      clone[parts[0]][parts[1]] = val;
    }
    onChange(clone);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-medicore-600" />
          {locale === 'ar' ? 'فحص مقاييس وقاع العينين (OD / OS)' : 'Bilateral Ophthalmic Examination (OD / OS)'}
        </h3>

        {/* Bilateral Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Right Eye (OD - Oculus Dexter) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-sky-50/30 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-sky-100">
              <span className="font-bold text-sm text-sky-900">
                {locale === 'ar' ? 'العين اليمنى (OD - Right Eye)' : 'Right Eye (OD)'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">OD</span>
            </div>

            {/* Visual Acuity & IOP */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {locale === 'ar' ? 'حدة الإبصار (VA)' : 'Visual Acuity (VA)'}
                </label>
                <select
                  disabled={readOnly}
                  value={data.rightEye.visualAcuityUncorrected}
                  onChange={e => handleUpdate('rightEye.visualAcuityUncorrected', e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 bg-white"
                >
                  <option value="6/6">6/6 (Normal)</option>
                  <option value="6/9">6/9</option>
                  <option value="6/12">6/12</option>
                  <option value="6/18">6/18</option>
                  <option value="6/24">6/24</option>
                  <option value="6/36">6/36</option>
                  <option value="6/60">6/60</option>
                  <option value="CF">Counting Fingers (CF)</option>
                  <option value="HM">Hand Motion (HM)</option>
                  <option value="LP">Light Perception (LP)</option>
                  <option value="NLP">No LP</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {locale === 'ar' ? 'ضغط العين (IOP mmHg)' : 'IOP (mmHg)'}
                </label>
                <input
                  type="number"
                  disabled={readOnly}
                  value={data.rightEye.intraocularPressureMmHg}
                  onChange={e => handleUpdate('rightEye.intraocularPressureMmHg', Number(e.target.value))}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {locale === 'ar' ? 'القرنية وعدسة العين (Cornea & Lens)' : 'Cornea & Lens'}
              </label>
              <input
                type="text"
                disabled={readOnly}
                value={data.rightEye.corneaStatus}
                onChange={e => handleUpdate('rightEye.corneaStatus', e.target.value)}
                placeholder={locale === 'ar' ? 'القرنية شفافة، عدسة سليمة...' : 'Clear cornea, lens normal...'}
                className="w-full text-sm rounded-lg border border-slate-300 p-2 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {locale === 'ar' ? 'فحص قاع العين والشبكية (Fundus & Retina)' : 'Fundus & Retina'}
              </label>
              <textarea
                rows={2}
                disabled={readOnly}
                value={data.rightEye.fundusRetinaNotes}
                onChange={e => handleUpdate('rightEye.fundusRetinaNotes', e.target.value)}
                placeholder={locale === 'ar' ? 'حليمة العصب البصري، الأوعية، البقعة الصفراء...' : 'Optic disc, vessels, macula...'}
                className="w-full text-sm rounded-lg border border-slate-300 p-2 bg-white"
              />
            </div>
          </div>

          {/* Left Eye (OS - Oculus Sinister) */}
          <div className="p-4 rounded-xl border border-slate-200 bg-teal-50/30 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-teal-100">
              <span className="font-bold text-sm text-teal-900">
                {locale === 'ar' ? 'العين اليسرى (OS - Left Eye)' : 'Left Eye (OS)'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold">OS</span>
            </div>

            {/* Visual Acuity & IOP */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {locale === 'ar' ? 'حدة الإبصار (VA)' : 'Visual Acuity (VA)'}
                </label>
                <select
                  disabled={readOnly}
                  value={data.leftEye.visualAcuityUncorrected}
                  onChange={e => handleUpdate('leftEye.visualAcuityUncorrected', e.target.value)}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 bg-white"
                >
                  <option value="6/6">6/6 (Normal)</option>
                  <option value="6/9">6/9</option>
                  <option value="6/12">6/12</option>
                  <option value="6/18">6/18</option>
                  <option value="6/24">6/24</option>
                  <option value="6/36">6/36</option>
                  <option value="6/60">6/60</option>
                  <option value="CF">Counting Fingers (CF)</option>
                  <option value="HM">Hand Motion (HM)</option>
                  <option value="LP">Light Perception (LP)</option>
                  <option value="NLP">No LP</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {locale === 'ar' ? 'ضغط العين (IOP mmHg)' : 'IOP (mmHg)'}
                </label>
                <input
                  type="number"
                  disabled={readOnly}
                  value={data.leftEye.intraocularPressureMmHg}
                  onChange={e => handleUpdate('leftEye.intraocularPressureMmHg', Number(e.target.value))}
                  className="w-full text-sm rounded-lg border border-slate-300 p-2 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {locale === 'ar' ? 'القرنية وعدسة العين (Cornea & Lens)' : 'Cornea & Lens'}
              </label>
              <input
                type="text"
                disabled={readOnly}
                value={data.leftEye.corneaStatus}
                onChange={e => handleUpdate('leftEye.corneaStatus', e.target.value)}
                placeholder={locale === 'ar' ? 'القرنية شفافة، عدسة سليمة...' : 'Clear cornea, lens normal...'}
                className="w-full text-sm rounded-lg border border-slate-300 p-2 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {locale === 'ar' ? 'فحص قاع العين والشبكية (Fundus & Retina)' : 'Fundus & Retina'}
              </label>
              <textarea
                rows={2}
                disabled={readOnly}
                value={data.leftEye.fundusRetinaNotes}
                onChange={e => handleUpdate('leftEye.fundusRetinaNotes', e.target.value)}
                placeholder={locale === 'ar' ? 'حليمة العصب البصري، الأوعية، البقعة الصفراء...' : 'Optic disc, vessels, macula...'}
                className="w-full text-sm rounded-lg border border-slate-300 p-2 bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
