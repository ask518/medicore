// ============================================================================
// MEDICORE – Organization Profile, Branding & Dedicated Enterprise Deployment
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabase';
import { Settings as SettingsIcon, Building2, Shield, Palette, Globe, Server, Check } from 'lucide-react';

export const Settings: React.FC = () => {
  const { organization, isEnterpriseDedicated, isOrgOwner } = useAuth();
  const { locale, t } = useLanguage();
  const { success, error } = useToast();

  const [nameAr, setNameAr] = useState(organization?.name_ar || '');
  const [nameEn, setNameEn] = useState(organization?.name_en || '');
  const [phone, setPhone] = useState(organization?.phone || '');
  const [email, setEmail] = useState(organization?.email || '');
  const [address, setAddress] = useState(organization?.address || '');
  const [taxNumber, setTaxNumber] = useState(organization?.tax_number || '');
  const [commercialReg, setCommercialReg] = useState(organization?.commercial_reg_no || '');
  const [primaryColor, setPrimaryColor] = useState('#0C87EB');
  const [customDomain, setCustomDomain] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase || !organization) return;
    setNameAr(organization.name_ar); setNameEn(organization.name_en); setPhone(organization.phone); setEmail(organization.email);
    setAddress(organization.address || ''); setTaxNumber(organization.tax_number || ''); setCommercialReg(organization.commercial_reg_no || '');
    void supabase.from('organization_settings').select('primary_color,custom_domain').eq('organization_id', organization.id).maybeSingle().then(({data}) => {
      if (data?.primary_color) setPrimaryColor(data.primary_color);
      if (data?.custom_domain) setCustomDomain(data.custom_domain);
    });
  }, [organization?.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !supabase || !isOrgOwner) { error(locale==='ar'?'حفظ الإعدادات متاح لمالك المنشأة والمدير العام فقط.':'Only the owner or general manager can save settings.'); return; }
    setSaving(true);
    const { error: orgError } = await supabase.from('organizations').update({
      name_ar: nameAr,
      name_en: nameEn,
      phone,
      email,
      address: address || null,
      tax_number: taxNumber || null,
      commercial_reg_no: commercialReg || null,
    }).eq('id', organization.id);
    if (orgError) { setSaving(false); error(locale==='ar'?'تعذر حفظ بيانات المنشأة.':'Could not save facility details.'); return; }
    const { error: settingsError } = await supabase.from('organization_settings').upsert({ organization_id: organization.id, primary_color: primaryColor, custom_domain: customDomain || null, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
    setSaving(false);
    if (settingsError) { error(locale==='ar'?'تم حفظ بيانات المنشأة لكن تعذر حفظ الهوية البصرية.':'Facility details saved, but branding settings failed.'); return; }
    success(locale === 'ar' ? 'تم حفظ إعدادات وبيانات المنشأة بنجاح' : 'Settings saved successfully');
    window.location.reload();
  };

  if (!organization) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-slate-700" />
          {t.nav.settings}
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
          {locale === 'ar' ? 'بيانات المنشأة الطبية، الهوية البصرية وخيارات النشر المخصص (Dedicated Enterprise)' : 'Facility Profile, Visual Brand & Dedicated Enterprise Configuration'}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Organization Information */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-medicore-600" />
            {locale === 'ar' ? 'بيانات المنشأة القانونية والتواصل' : 'Facility Profile & Legal Info'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === 'ar' ? 'اسم المنشأة بالعربية' : 'Facility Name (Arabic)'} *
              </label>
              <input
                type="text"
                required
                value={nameAr}
                onChange={e => setNameAr(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === 'ar' ? 'اسم المنشأة بالإنجليزية' : 'Facility Name (English)'} *
              </label>
              <input
                type="text"
                required
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === 'ar' ? 'البريد الرسمي' : 'Official Email'}
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === 'ar' ? 'رقم الهاتف الموحد' : 'Unified Phone'}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full text-sm rounded-xl border border-slate-300 p-2.5"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === 'ar' ? 'الرقم الضريبي' : 'Tax Registration #'}
              </label>
              <input
                type="text"
                value={taxNumber}
                onChange={e => setTaxNumber(e.target.value)}
                placeholder="123-456-789"
                className="w-full text-sm rounded-xl border border-slate-300 p-2.5 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === 'ar' ? 'السجل التجاري' : 'Commercial Reg #'}
              </label>
              <input
                type="text"
                value={commercialReg}
                onChange={e => setCommercialReg(e.target.value)}
                placeholder="CR-12345"
                className="w-full text-sm rounded-xl border border-slate-300 p-2.5 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Enterprise Dedicated Deployment Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-600" />
              {locale === 'ar' ? 'وضع النشر المخصص (Dedicated Enterprise Profile)' : 'Dedicated Enterprise Deployment Profile'}
            </h3>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${
              isEnterpriseDedicated ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {isEnterpriseDedicated ? 'Dedicated Active' : 'SaaS Multi-Tenant'}
            </span>
          </div>

          <p className="text-xs text-slate-500">
            {locale === 'ar' 
              ? 'يتيح إصدار Enterprise فصل قاعدة البيانات بالكامل وتخصيص دومين خاص وهوية بصرية مستقلة للمجمعات الكبرى' 
              : 'Enterprise profile provides separate database isolation, custom domain, and independent branding.'}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === 'ar' ? 'النطاق المخصص (Custom Domain)' : 'Custom Domain'}
              </label>
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={customDomain}
                  onChange={e => setCustomDomain(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-300 p-2.5 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {locale === 'ar' ? 'اللون الرئيسي للهوية (Theme Primary)' : 'Theme Primary Color'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 p-0.5 rounded-xl border border-slate-300 cursor-pointer"
                />
                <span className="font-mono text-xs font-bold text-slate-700">{primaryColor}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !isOrgOwner}
            className="px-6 py-2.5 bg-medicore-600 hover:bg-medicore-700 text-white font-bold text-sm rounded-xl shadow-xs"
          >
            {saving ? (locale==='ar'?'جار الحفظ...':'Saving...') : t.common.save}
          </button>
        </div>
      </form>
    </div>
  );
};
