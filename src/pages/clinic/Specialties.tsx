import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Stethoscope } from 'lucide-react';

export const Specialties: React.FC = () => {
  const { locale, t } = useLanguage();
  return <section className="mx-auto max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
    <Stethoscope className="mx-auto h-10 w-10 text-amber-700" />
    <h1 className="mt-3 text-xl font-black text-slate-900">{t.nav.specialties}</h1>
    <p className="mt-2 text-sm leading-7 text-amber-950">{locale === 'ar' ? 'نماذج التخصصات التفاعلية كانت تعرض قيماً سريرية افتراضية ولا تحفظ في قاعدة البيانات. أوقفناها لحماية السجل الطبي. ستعود بعد ربطها بملف المريض والحفظ والتدقيق.' : 'The specialty demos contained sample clinical values and did not save to the database. They are disabled to protect the medical record until patient-linked saving and audit history are implemented.'}</p>
  </section>;
};
