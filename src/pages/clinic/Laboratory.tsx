import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { FlaskConical } from 'lucide-react';

export const Laboratory: React.FC = () => {
  const { locale, t } = useLanguage();
  return <section className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <FlaskConical className="mx-auto h-10 w-10 text-amber-700" />
    <h1 className="mt-3 text-xl font-black text-slate-900">{t.nav.laboratory}</h1>
    <p className="mt-2 text-sm leading-7 text-amber-950">{locale === 'ar' ? 'وحدة المعمل غير متصلة بقاعدة البيانات بعد. أوقفنا إدخال وعرض البيانات التجريبية حتى يتم ربطها بجداول Supabase وسياسات الصلاحيات.' : 'The laboratory module is not connected to the database yet. Sample data entry and display are disabled until Supabase tables and access policies are implemented.'}</p>
  </section>;
};
