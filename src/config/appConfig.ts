// ============================================================================
// MEDICORE – Application Configuration & Multi-Tenant Deployment Profiles
// ============================================================================

export type DeploymentProfile = 'saas' | 'enterprise';

export interface AppConfig {
  deploymentProfile: DeploymentProfile;
  appName: string;
  defaultLocale: 'ar' | 'en';
  defaultCurrency: string;
  defaultCurrencySymbol: string;
  isEnterpriseMode: boolean;
  enterpriseOrgName?: string;
  enterpriseLogoUrl?: string;
  enableAiAssistant: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

const env = (import.meta as unknown as { env: Record<string, string> }).env || {};

const profile = (env.VITE_DEPLOYMENT_PROFILE || 'saas').toLowerCase() as DeploymentProfile;

export const APP_CONFIG: AppConfig = {
  deploymentProfile: profile,
  appName: env.VITE_APP_NAME || 'MEDICORE',
  defaultLocale: (env.VITE_DEFAULT_LOCALE === 'en' ? 'en' : 'ar'),
  defaultCurrency: env.VITE_CURRENCY_CODE || 'EGP',
  defaultCurrencySymbol: env.VITE_CURRENCY_SYMBOL || 'ج.م',
  isEnterpriseMode: profile === 'enterprise',
  enterpriseOrgName: env.VITE_ENTERPRISE_ORG_NAME || 'مجمع النور الطبي التخصصي',
  enterpriseLogoUrl: env.VITE_ENTERPRISE_LOGO_URL || '/favicon.svg',
  enableAiAssistant: env.VITE_ENABLE_AI_ASSISTANT !== 'false',
  supabaseUrl: env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || '',
};

export const MEDICAL_SPECIALTIES = [
  { code: 'orthopedics', name_ar: 'جراحة العظام والمفاصل', name_en: 'Orthopedics & Joint Surgery', icon: 'Bone', hasCanvas: true },
  { code: 'dentistry', name_ar: 'طب وجراحة الفم والأسنان', name_en: 'Dental Surgery & Odontology', icon: 'Smile', hasCanvas: true },
  { code: 'dermatology', name_ar: 'الأمراض الجلدية والتناسلية', name_en: 'Dermatology & Venereology', icon: 'Sparkles', hasCanvas: true },
  { code: 'ophthalmology', name_ar: 'طب وجراحة العيون', name_en: 'Ophthalmology', icon: 'Eye', hasCanvas: true },
  { code: 'cardiology', name_ar: 'أمراض القلب والأوعية الدموية', name_en: 'Cardiology', icon: 'Heart', hasCanvas: false },
  { code: 'pediatrics', name_ar: 'طب الأطفال وحديثي الولادة', name_en: 'Pediatrics & Neonatology', icon: 'Baby', hasCanvas: false },
  { code: 'gynecology_obstetrics', name_ar: 'النساء والتوليد', name_en: 'Obstetrics & Gynecology', icon: 'Users', hasCanvas: false },
  { code: 'ent', name_ar: 'الأنف والأذن والحنجرة', name_en: 'Ear, Nose & Throat (ENT)', icon: 'Headphones', hasCanvas: false },
  { code: 'internal_medicine', name_ar: 'الأمراض الباطنية والسكر', name_en: 'Internal Medicine & Endocrinology', icon: 'Activity', hasCanvas: false },
  { code: 'general_surgery', name_ar: 'الجراحة العامة والمناظير', name_en: 'General Surgery', icon: 'Scissors', hasCanvas: false },
  { code: 'neurology', name_ar: 'المخ والأعصاب', name_en: 'Neurology', icon: 'Zap', hasCanvas: false }
] as const;

export const COMMON_ICD10_DIAGNOSES = [
  { code: 'M17.1', description_ar: 'خشونة أولية في مفصل الركبة', description_en: 'Primary osteoarthritis of knee' },
  { code: 'M54.5', description_ar: 'ألم أسفل الظهر الحاد/المزمن', description_en: 'Low back pain' },
  { code: 'S52.5', description_ar: 'كسر في الطرف السفلي للكعبرة (الرسغ)', description_en: 'Fracture of lower end of radius' },
  { code: 'K02.1', description_ar: 'تسوس عاج الأسنان', description_en: 'Caries of dentine' },
  { code: 'K04.0', description_ar: 'التهاب لب السن الحاد/المزمن', description_en: 'Pulpitis' },
  { code: 'L20.9', description_ar: 'التهاب الجلد التأتبي (الإكزيما)', description_en: 'Atopic dermatitis, unspecified' },
  { code: 'L40.0', description_ar: 'الصدفية الشائعة', description_en: 'Psoriasis vulgaris' },
  { code: 'H10.9', description_ar: 'التهاب ملتحمة العين الحاد', description_en: 'Unspecified conjunctivitis' },
  { code: 'I10', description_ar: 'ارتفاع ضغط الدم الأساسي (الأولي)', description_en: 'Essential (primary) hypertension' },
  { code: 'E11.9', description_ar: 'داء السكري من النوع الثاني بدون مضاعفات', description_en: 'Type 2 diabetes mellitus without complications' },
  { code: 'J02.9', description_ar: 'التهاب البلعوم واللوزتين الحاد', description_en: 'Acute pharyngitis, unspecified' },
  { code: 'R10.4', description_ar: 'مغص وآلام حادة غير محددة بالبطن', description_en: 'Other and unspecified abdominal pain' }
];
