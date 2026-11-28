import React, { useMemo, useState } from 'react';
import { MASTER_MEDICAL_SPECIALTIES } from '../../config/medicalSpecialties';
import { Check, ChevronDown, Layers, Search, X } from 'lucide-react';

interface SpecialtySelectorProps {
  selected: string[];
  onChange: (next: string[]) => void;
  ar: boolean;
  facilityType?: string;
  label?: string;
}

const normalizeSearch = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();

export const SpecialtySelector: React.FC<SpecialtySelectorProps> = ({
  selected,
  onChange,
  ar,
  facilityType = 'poly_clinic',
  label,
}) => {
  const activeSpecialties = useMemo(
    () => MASTER_MEDICAL_SPECIALTIES.filter(s => s.is_active),
    []
  );
  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isSingleMode = facilityType === 'private_clinic';

  const filteredSpecialties = useMemo(() => {
    const q = normalizeSearch(search);
    if (!q) return activeSpecialties;
    return activeSpecialties.filter(spec =>
      normalizeSearch(`${spec.name_ar} ${spec.name_en} ${spec.category_name_ar} ${spec.category_name_en} ${spec.code}`).includes(q)
    );
  }, [activeSpecialties, search]);

  const selectedItems = useMemo(
    () => activeSpecialties.filter(spec => selected.includes(spec.code)),
    [activeSpecialties, selected]
  );

  const primarySelected = selectedItems[0] || activeSpecialties[0];

  const selectSingle = (code: string) => {
    onChange([code]);
    setDropdownOpen(false);
    setSearch('');
  };

  const toggleMulti = (code: string) => {
    if (selected.includes(code)) {
      if (selected.length <= 1) return;
      onChange(selected.filter(c => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };

  const renderBadge = (clinicalModule: string) => {
    if (clinicalModule === 'general_template') return null;
    const is3d = ['orthopedics', 'dentistry', 'dermatology'].includes(clinicalModule);
    return (
      <span
        title={ar ? 'يدعم محركاً تشخيصياً تفاعلياً' : 'Interactive diagnostic module'}
        className="inline-flex shrink-0 items-center gap-0.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700"
      >
        <Layers className="h-2.5 w-2.5" />
        {is3d ? '3D' : 'UI'}
      </span>
    );
  };

  if (isSingleMode) {
    return (
      <div className="space-y-1.5 relative">
        <label className="block text-xs font-bold text-slate-700">
          {label || (ar ? 'تخصص العيادة الخاصة (مرتبط بالشاشة التشخيصية)' : 'Private Clinic Specialty (Linked to Diagnostic Suite)')}
        </label>

        <button
          type="button"
          onClick={() => setDropdownOpen(prev => !prev)}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-start text-sm font-bold text-slate-800 hover:border-medicore-400"
        >
          <span className="flex items-center gap-2 truncate">
            <span className="truncate">{primarySelected ? (ar ? primarySelected.name_ar : primarySelected.name_en) : '—'}</span>
            {primarySelected && renderBadge(primarySelected.clinical_module)}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div className="z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-slate-50 px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={ar ? 'ابحث باسم التخصص... مثال: باطنة، قلب، عيون، عظام' : 'Search specialty... e.g., Internal, Cardio, Eye, Ortho'}
                className="w-full bg-transparent text-xs outline-none"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-700">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
              {filteredSpecialties.length === 0 ? (
                <p className="p-4 text-center text-xs text-slate-400">{ar ? 'لا توجد تخصصات مطابقة.' : 'No matching specialties.'}</p>
              ) : (
                filteredSpecialties.map(spec => {
                  const isCurrent = selected[0] === spec.code;
                  return (
                    <button
                      key={spec.code}
                      type="button"
                      onClick={() => selectSingle(spec.code)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-xs hover:bg-medicore-50 ${
                        isCurrent ? 'bg-medicore-50 font-black text-medicore-900' : 'font-semibold text-slate-700'
                      }`}
                    >
                      <span className="truncate">
                        {ar ? spec.name_ar : spec.name_en}
                        <span className="ms-2 text-[10px] font-normal text-slate-400">
                          ({ar ? spec.category_name_ar : spec.category_name_en})
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {renderBadge(spec.clinical_module)}
                        {isCurrent && <Check className="h-3.5 w-3.5 text-medicore-600" />}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700">
          {label || (ar ? 'التخصصات الطبية الفعّالة (مرتبطة بشاشة المحركات التشخيصية)' : 'Active Medical Specialties (Linked to Diagnostic Suite)')}
        </span>
        <div className="flex items-center gap-2 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => onChange(activeSpecialties.map(s => s.code))}
            className="text-medicore-600 hover:underline"
          >
            {ar ? 'تحديد الكل' : 'Select all'}
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => onChange(['general_practice'])}
            className="text-slate-500 hover:underline"
          >
            {ar ? 'افتراضي (طب عام)' : 'General only'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={ar ? 'بحث سريع عن تخصص... (باطنة، قلب، عيون، عظام...)' : 'Quick filter specialty... (Internal, Cardio, Eye...)'}
          className="w-full bg-transparent text-xs outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-700">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 sm:grid-cols-2">
        {filteredSpecialties.length === 0 ? (
          <p className="col-span-full py-3 text-center text-xs text-slate-400">{ar ? 'لا توجد تخصصات مطابقة.' : 'No matching specialties.'}</p>
        ) : (
          filteredSpecialties.map(spec => {
            const isSelected = selected.includes(spec.code);
            return (
              <button
                key={spec.code}
                type="button"
                onClick={() => toggleMulti(spec.code)}
                className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-start text-xs font-semibold transition ${
                  isSelected
                    ? 'border-medicore-500 bg-medicore-50 text-medicore-900 shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-1.5 truncate">
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${
                    isSelected ? 'border-medicore-600 bg-medicore-600 text-white' : 'border-slate-300 bg-white'
                  }`}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{ar ? spec.name_ar : spec.name_en}</span>
                </span>
                {renderBadge(spec.clinical_module)}
              </button>
            );
          })
        )}
      </div>

      <p className="text-[11px] text-slate-500">
        {ar
          ? `تم اختيار ${selected.length} تخصص — هذه التخصصات هي التي ستظهر في لوحة المحركات التشخيصية بالمنشأة.`
          : `${selected.length} specialty/specialties selected — directly activates those diagnostic modules inside the facility.`}
      </p>
    </div>
  );
};
