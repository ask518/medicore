// ============================================================================
// MEDICORE – Language & RTL/LTR Direction Context
// ============================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Locale } from '../config/i18n';
import { APP_CONFIG } from '../config/appConfig';

interface LanguageContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  dir: 'rtl' | 'ltr';
  t: typeof translations['ar'];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem('medicore_locale') as Locale;
    return saved === 'en' || saved === 'ar' ? saved : APP_CONFIG.defaultLocale;
  });

  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    localStorage.setItem('medicore_locale', locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
    if (locale === 'ar') {
      document.body.classList.add('font-arabic');
    } else {
      document.body.classList.remove('font-arabic');
    }
  }, [locale, dir]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
  };

  const t = translations[locale];

  return (
    <LanguageContext.Provider value={{ locale, setLocale, dir, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
