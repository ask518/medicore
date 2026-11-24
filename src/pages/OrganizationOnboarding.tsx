import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { FacilityType } from '../types/database';
import { Building2, LogOut } from 'lucide-react';

export const OrganizationOnboarding: React.FC = () => {
  const { user, logout } = useAuth();
  const { locale } = useLanguage();
  const { success, error } = useToast();
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [facilityType, setFacilityType] = useState<FacilityType>('private_clinic');
  const [saving, setSaving] = useState(false);
  const ar = locale === 'ar';

  const createWorkspace = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      error(ar ? 'اتصال قاعدة البيانات غير مهيأ.' : 'Database connection is not configured.');
      return;
    }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc('create_initial_organization', {
      p_name_ar: nameAr.trim(),
      p_name_en: nameEn.trim(),
      p_email: email.trim(),
      p_phone: phone.trim(),
      p_city: city.trim(),
      p_address: address.trim(),
      p_facility_type: facilityType,
    });
    setSaving(false);
    if (rpcError) {
      error(ar ? 'تعذر إنشاء المنشأة. راجع البيانات أو تواصل مع الدعم.' : 'Unable to create the facility. Check the details or contact support.');
      return;
    }
    success(ar ? 'تم إنشاء المنشأة والفرع الرئيسي بنجاح.' : 'Facility and main branch created.');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center p-4" dir={ar ? 'rtl' : 'ltr'}>
      <form onSubmit={createWorkspace} className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-medicore-50 text-medicore-700"><Building2 /></div>
            <h1 className="text-xl font-black text-slate-900">{ar ? 'بيانات منشأتك الطبية' : 'Set up your medical facility'}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{ar ? 'أدخل بيانات المنشأة والفرع الرئيسي. تُحفظ في قاعدة البيانات، ويُنشأ حساب المالك بصلاحيات محددة.' : 'Enter the facility and main branch details. They are stored in the database under your owner account.'}</p>
          </div>
          <button type="button" onClick={() => void logout()} className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"><LogOut className="h-4 w-4" />{ar ? 'خروج' : 'Sign out'}</button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-700">{ar ? 'اسم المنشأة بالعربية' : 'Facility name (Arabic)'}<input required maxLength={255} value={nameAr} onChange={e => setNameAr(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-slate-700">{ar ? 'اسم المنشأة بالإنجليزية' : 'Facility name (English)'}<input required maxLength={255} value={nameEn} onChange={e => setNameEn(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-slate-700">{ar ? 'بريد المنشأة' : 'Facility email'}<input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-slate-700">{ar ? 'هاتف المنشأة' : 'Facility phone'}<input required type="tel" maxLength={50} value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-slate-700">{ar ? 'المدينة' : 'City'}<input required maxLength={100} value={city} onChange={e => setCity(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label>
          <label className="text-xs font-bold text-slate-700">{ar ? 'نوع المنشأة' : 'Facility type'}<select value={facilityType} onChange={e => setFacilityType(e.target.value as FacilityType)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal"><option value="private_clinic">{ar ? 'عيادة خاصة' : 'Private clinic'}</option><option value="poly_clinic">{ar ? 'مجمع عيادات' : 'Polyclinic'}</option><option value="medical_center">{ar ? 'مركز طبي' : 'Medical center'}</option><option value="specialized_center">{ar ? 'مركز تخصصي' : 'Specialized center'}</option><option value="hospital">{ar ? 'مستشفى' : 'Hospital'}</option></select></label>
          <label className="text-xs font-bold text-slate-700 sm:col-span-2">{ar ? 'العنوان' : 'Address'}<input required maxLength={500} value={address} onChange={e => setAddress(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal" /></label>
        </div>
        <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">{ar ? 'سيتم إنشاء فترة تجريبية 14 يومًا. بعد إنشاء المنشأة، أضف الموظفين والمرضى واضبط قائمة الخدمات وأسعارها بنفسك قبل إصدار الفواتير؛ لا توجد أسعار أو خدمات افتراضية.' : 'A 14-day trial will be created. After setup, add staff and patients and configure your own service catalog and prices before invoicing; no default service prices are added.'}</p>
        <button type="submit" disabled={saving} className="w-full rounded-xl bg-medicore-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{saving ? (ar ? 'جارٍ الإنشاء...' : 'Creating...') : (ar ? 'إنشاء المنشأة والبدء' : 'Create facility and continue')}</button>
      </form>
    </div>
  );
};
