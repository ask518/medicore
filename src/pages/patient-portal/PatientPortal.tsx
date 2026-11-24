import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Heart } from 'lucide-react';

export const PatientPortal: React.FC = () => {
  const { logout } = useAuth(); const { locale } = useLanguage(); const ar=locale==='ar';
  return <main className="grid min-h-[60vh] place-items-center p-6" dir={ar?'rtl':'ltr'}><section className="max-w-xl rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center"><Heart className="mx-auto h-10 w-10 text-rose-600"/><h1 className="mt-3 text-xl font-black text-slate-900">{ar?'بوابة المريض غير مفعّلة بعد':'Patient portal is not enabled yet'}</h1><p className="mt-3 text-sm leading-7 text-amber-950">{ar?'ربط حساب المريض بملفه الطبي وعرض المواعيد والوصفات يحتاج مسار تحقق وموافقة منفصل. لن نعرض أي ملف اعتمادًا على البريد أو بيانات نموذجية.' : 'Linking a patient login to a medical record requires a separate verified consent flow. No record is shown based on email matching or sample data.'}</p><button onClick={()=>void logout()} className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white">{ar?'تسجيل الخروج':'Sign out'}</button></section></main>;
};
