// ============================================================================
// MEDICORE – Multi-Branch Management & Doctor Schedules
// ============================================================================

import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { dbClient } from '../../lib/dbClient';
import { Building2, Plus, MapPin, Phone, Mail, Clock, CheckCircle2, X } from 'lucide-react';

export const Branches: React.FC = () => {
  const { organization } = useAuth();
  const { locale, t } = useLanguage();
  const { success } = useToast();

  if (!organization) return null;
  const orgId = organization.id;

  const branches = dbClient.getBranches(orgId);
  const [showAddModal, setShowAddModal] = useState(false);

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('القاهرة');
  const [address, setAddress] = useState('');

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    dbClient.createBranch(orgId, {
      name_ar: nameAr,
      name_en: nameEn || nameAr,
      code: code || `BR-${branches.length + 1}`,
      phone,
      address,
      city,
      is_main_branch: false,
      is_active: true,
    });

    success(locale === 'ar' ? 'تم إنشاء وإضافة الفرع الجديد بنجاح' : 'New branch created successfully');
    setShowAddModal(false);
    setNameAr('');
    setNameEn('');
    setCode('');
    setPhone('');
    setAddress('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-medicore-600" />
            {t.nav.branches}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {locale === 'ar' ? 'إدارة فروع المجمع والمراكز الطبية التابعة ومواعيد العمل' : 'Multi-branch facilities, contact details and working hours'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white text-xs font-bold rounded-xl shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{locale === 'ar' ? 'إضافة فرع جديد' : 'Add Branch'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map(b => (
          <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">
                  {b[locale === 'ar' ? 'name_ar' : 'name_en']}
                </span>
                {b.is_main_branch && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-medicore-100 text-medicore-800">
                    {locale === 'ar' ? 'الفرع الرئيسي' : 'Main'}
                  </span>
                )}
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {b.code}
              </span>
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{b.address} ({b.city})</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-mono">{b.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>السبت - الخميس (09:00 ص - 09:00 م) • الجمعة مغلق</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-in border border-slate-100">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-medicore-600" />
              {locale === 'ar' ? 'إضافة فرع طبي جديد' : 'Add New Branch'}
            </h3>

            <form onSubmit={handleCreateBranch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'اسم الفرع بالعربية' : 'Branch Name (Arabic)'} *
                </label>
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={e => setNameAr(e.target.value)}
                  placeholder="مثال: فرع الشيخ زايد"
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'كود الفرع' : 'Branch Code'} *
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="ZAYED-01"
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'رقم الهاتف' : 'Phone'} *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+20 2..."
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {locale === 'ar' ? 'المدينة' : 'City'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {locale === 'ar' ? 'العنوان التفصيلي' : 'Address'} *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="شارع، حي، مبنى..."
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm bg-medicore-600 hover:bg-medicore-700 text-white font-bold rounded-xl"
                >
                  {locale === 'ar' ? 'حفظ الفرع' : 'Save Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
