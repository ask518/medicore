// ============================================================================
// MEDICORE – Centralized Medical Activities & Specialties Multi-Selector
// Section 8 & 9 Implementation: Categorized, Searchable, Expandable
// ============================================================================

import React, { useState, useMemo } from 'react';
import { 
  SPECIALTY_CATEGORIES, 
  MASTER_MEDICAL_SPECIALTIES, 
  MedicalSpecialtyItem, 
  SpecialtyCategoryCode 
} from '../../config/medicalSpecialties';
import { useLanguage } from '../../context/LanguageContext';
import { 
  Search, CheckSquare, Square, X, Plus, Sparkles, Filter, 
  CheckCircle2, Layers, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';

interface SpecialtyMultiSelectorProps {
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
  maxAllowed?: number;
  readOnly?: boolean;
}

export const SpecialtyMultiSelector: React.FC<SpecialtyMultiSelectorProps> = ({
  selectedCodes,
  onChange,
  maxAllowed,
  readOnly = false,
}) => {
  const { locale } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SpecialtyCategoryCode | 'all'>('all');
  const [customSpecialties, setCustomSpecialties] = useState<MedicalSpecialtyItem[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customNameAr, setCustomNameAr] = useState('');
  const [customNameEn, setCustomNameEn] = useState('');

  // Combine master with custom
  const allSpecialties = useMemo(() => {
    return [...MASTER_MEDICAL_SPECIALTIES, ...customSpecialties];
  }, [customSpecialties]);

  // Filtered specialties by search & category
  const filteredSpecialties = useMemo(() => {
    let list = allSpecialties;

    if (selectedCategory !== 'all') {
      list = list.filter(s => s.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => 
        s.name_ar.includes(q) ||
        s.name_en.toLowerCase().includes(q) ||
        s.category_name_ar.includes(q) ||
        s.category_name_en.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allSpecialties, selectedCategory, searchQuery]);

  const toggleSpecialty = (code: string) => {
    if (readOnly) return;
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter(c => c !== code));
    } else {
      if (maxAllowed && selectedCodes.length >= maxAllowed) {
        alert(locale === 'ar' ? `الحد الأقصى للتخصصات في هذه الباقة هو ${maxAllowed}` : `Max allowed specialties is ${maxAllowed}`);
        return;
      }
      onChange([...selectedCodes, code]);
    }
  };

  const selectAllInCategory = (catCode: SpecialtyCategoryCode | 'all') => {
    if (readOnly) return;
    const catItems = catCode === 'all' 
      ? filteredSpecialties.map(s => s.code)
      : allSpecialties.filter(s => s.category === catCode).map(s => s.code);
    
    const newSelection = Array.from(new Set([...selectedCodes, ...catItems]));
    if (maxAllowed && newSelection.length > maxAllowed) {
      onChange(newSelection.slice(0, maxAllowed));
    } else {
      onChange(newSelection);
    }
  };

  const deselectAllInCategory = (catCode: SpecialtyCategoryCode | 'all') => {
    if (readOnly) return;
    const catCodes = new Set(
      catCode === 'all' 
        ? filteredSpecialties.map(s => s.code)
        : allSpecialties.filter(s => s.category === catCode).map(s => s.code)
    );
    onChange(selectedCodes.filter(code => !catCodes.has(code)));
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customNameAr.trim()) return;

    const newCode = `custom_${Date.now()}`;
    const newSpecialty: MedicalSpecialtyItem = {
      code: newCode,
      name_ar: customNameAr.trim(),
      name_en: customNameEn.trim() || customNameAr.trim(),
      category: 'diagnostic_and_therapeutic',
      category_name_ar: 'تخصص مخصص للمنشأة',
      category_name_en: 'Custom Facility Specialty',
      clinical_module: 'general_template',
      icon_name: 'Sparkles',
      is_active: true,
      is_custom: true
    };

    setCustomSpecialties(prev => [...prev, newSpecialty]);
    onChange([...selectedCodes, newCode]);
    setCustomNameAr('');
    setCustomNameEn('');
    setShowAddCustom(false);
  };

  const selectedItems = useMemo(() => {
    return allSpecialties.filter(s => selectedCodes.includes(s.code));
  }, [allSpecialties, selectedCodes]);

  return (
    <div className="space-y-3.5 border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
      {/* Header & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
        <div>
          <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-medicore-600" />
            <span>{locale === 'ar' ? 'الأنشطة والتخصصات الطبية للمنشأة (Medical Activities & Specialties)' : 'Medical Activities & Specialties'}</span>
          </h4>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {locale === 'ar' 
              ? 'اختر التخصصات والعيادات المصرح لها بالعمل في هذه المنشأة وفروعها' 
              : 'Select medical specialties permitted in this organization and branches'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-black px-2.5 py-1 rounded-full bg-medicore-100 text-medicore-800 border border-medicore-200">
            {selectedCodes.length} {locale === 'ar' ? 'تخصصات محددة' : 'Selected'}
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowAddCustom(!showAddCustom)}
              className="text-[11px] font-bold text-medicore-700 hover:text-medicore-800 flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs"
            >
              <Plus className="w-3 h-3" />
              <span>{locale === 'ar' ? 'إضافة تخصص مخصص' : 'Add Custom'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Selected Items Summary Chips */}
      {selectedItems.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {locale === 'ar' ? 'ملخص التخصصات المختارة:' : 'Selected Specialties Summary:'}
            </span>
            {!readOnly && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] font-bold text-rose-600 hover:underline"
              >
                {locale === 'ar' ? 'إلغاء تحديد الكل' : 'Clear All'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
            {selectedItems.map(item => (
              <span
                key={item.code}
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-medicore-50 text-medicore-800 border border-medicore-200 animate-scale-in"
              >
                <span>{item[locale === 'ar' ? 'name_ar' : 'name_en']}</span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => toggleSpecialty(item.code)}
                    className="w-3.5 h-3.5 rounded-full hover:bg-medicore-200 flex items-center justify-center text-medicore-600"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Add Custom Specialty Inline Form */}
      {showAddCustom && !readOnly && (
        <form onSubmit={handleAddCustom} className="p-3 bg-white rounded-xl border border-medicore-200 space-y-2 animate-scale-in">
          <span className="text-xs font-bold text-medicore-800 block">
            {locale === 'ar' ? 'إضافة تخصص طبي جديد مخصص' : 'Add Custom Medical Specialty'}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              required
              value={customNameAr}
              onChange={e => setCustomNameAr(e.target.value)}
              placeholder="اسم التخصص بالعربية (مثال: جراحة الركبة المتقدمة)"
              className="text-xs rounded-lg border border-slate-200 p-2 focus:border-medicore-500 focus:outline-none"
            />
            <input
              type="text"
              value={customNameEn}
              onChange={e => setCustomNameEn(e.target.value)}
              placeholder="Specialty Name in English (Optional)"
              className="text-xs rounded-lg border border-slate-200 p-2 focus:border-medicore-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddCustom(false)}
              className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="px-3 py-1 text-xs bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-lg"
            >
              {locale === 'ar' ? 'إضافة واعتماد' : 'Add Specialty'}
            </button>
          </div>
        </form>
      )}

      {/* Search & Category Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={locale === 'ar' ? 'ابحث في التخصصات الطبية والجراحية...' : 'Search medical & surgical specialties...'}
            className="w-full text-xs rounded-xl border border-slate-200 ps-8 pe-3 py-2 bg-white focus:border-medicore-500 focus:outline-none"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value as SpecialtyCategoryCode | 'all')}
          className="text-xs rounded-xl border border-slate-200 p-2 bg-white focus:border-medicore-500 focus:outline-none font-bold text-slate-700 max-w-full sm:max-w-xs"
        >
          <option value="all">{locale === 'ar' ? 'جميع الأقسام والتصنيفات (A - I)' : 'All Categories (A - I)'}</option>
          {SPECIALTY_CATEGORIES.map(cat => (
            <option key={cat.code} value={cat.code}>
              {cat.letter}. {cat[locale === 'ar' ? 'name_ar' : 'name_en']}
            </option>
          ))}
        </select>
      </div>

      {/* Quick Select Actions for Filtered Group */}
      {!readOnly && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span>{filteredSpecialties.length} {locale === 'ar' ? 'تخصص متاح للتعيين' : 'specialties available'}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => selectAllInCategory(selectedCategory)}
              className="text-medicore-700 font-bold hover:underline"
            >
              {locale === 'ar' ? 'تحديد كل المعروض' : 'Select All Filtered'}
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => deselectAllInCategory(selectedCategory)}
              className="text-slate-500 font-bold hover:underline"
            >
              {locale === 'ar' ? 'إلغاء المعروض' : 'Deselect Filtered'}
            </button>
          </div>
        </div>
      )}

      {/* Specialty Checkboxes Grid */}
      <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 divide-y divide-slate-100">
        {filteredSpecialties.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            {locale === 'ar' ? 'لا توجد تخصصات مطابقة للبحث' : 'No specialties matched your search'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1">
            {filteredSpecialties.map(item => {
              const isSelected = selectedCodes.includes(item.code);
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => toggleSpecialty(item.code)}
                  className={`w-full text-start p-2 rounded-xl text-xs flex items-center justify-between border transition-all ${
                    isSelected 
                      ? 'bg-medicore-50/80 border-medicore-300 text-medicore-900 font-bold shadow-2xs' 
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-medicore-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="truncate">{item[locale === 'ar' ? 'name_ar' : 'name_en']}</div>
                      <div className="text-[10px] text-slate-400 font-normal truncate">
                        {item.category_name_ar}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
